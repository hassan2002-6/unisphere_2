import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { recordAudit } from "./audit";
import { notifyUser } from "./notifications";

/**
 * Internal messaging (spec §5 "send/receive permitted messages").
 *
 * Recipients are derived from the caller's role — never from the client:
 *  - STUDENT     → faculty of their active courses, coordinator, FYP Head
 *  - FACULTY     → students of their courses, coordinator, FYP Head, admin
 *  - COORDINATOR → faculty, students, FYP Head, admin
 *  - FYP_HEAD    → faculty, students, coordinator, admin
 *  - MENTOR      → admins
 *  - ADMIN       → everyone (capped)
 */

export type MessageRow = {
  id: string;
  subject: string | null;
  body: string;
  readAt: Date | null;
  createdAt: Date;
  other: { id: string; name: string; role: string; email: string };
};

const userSelect = { id: true, name: true, role: true, email: true } as const;

export async function listInbox(user: User, opts?: { take?: number; cursor?: string }) {
  return prisma.message.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 25,
    include: { sender: { select: userSelect } },
  });
}

export async function listSent(user: User, opts?: { take?: number }) {
  return prisma.message.findMany({
    where: { senderId: user.id },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 25,
    include: { recipient: { select: userSelect } },
  });
}

export async function getUnreadMessageCount(user: User): Promise<number> {
  return prisma.message.count({ where: { recipientId: user.id, readAt: null } });
}

export async function markMessageRead(user: User, messageId: string): Promise<boolean> {
  const res = await prisma.message.updateMany({
    where: { id: messageId, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count > 0;
}

export type RecipientRow = { id: string; name: string; role: string; label: string };

/** Who this user may message — role-derived, capped for the picker. */
export async function getRecipients(user: User): Promise<RecipientRow[]> {
  const rows: { id: string; name: string; role: string }[] = [];

  if (user.role === "STUDENT") {
    const classes = await prisma.enrollment.findMany({
      where: { studentId: user.id, status: "ACTIVE" },
      include: { class: { include: { faculty: { select: userSelect } } } },
    });
    for (const e of classes) {
      const f = e.class.faculty;
      if (f && !rows.some((r) => r.id === f.id)) rows.push(f);
    }
    const staff = await prisma.user.findMany({
      where: { role: { in: ["COORDINATOR", "FYP_HEAD"] } },
      select: userSelect,
    });
    rows.push(...staff.filter((s) => !rows.some((r) => r.id === s.id)));
  } else if (user.role === "MENTOR") {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: userSelect });
    rows.push(...admins);
  } else if (user.role === "ADMIN") {
    const everyone = await prisma.user.findMany({
      where: { id: { not: user.id } },
      select: userSelect,
      orderBy: { name: "asc" },
      take: 60,
    });
    rows.push(...everyone);
  } else {
    // FACULTY / COORDINATOR / FYP_HEAD
    const facultyIds = new Set<string>();
    if (user.role === "FACULTY") {
      const classes = await prisma.courseClass.findMany({
        where: { facultyId: user.id },
        include: {
          enrollments: { where: { status: "ACTIVE" }, include: { student: { select: userSelect } } },
        },
      });
      const seen = new Set<string>();
      for (const c of classes) {
        for (const e of c.enrollments) {
          if (!seen.has(e.student.id)) {
            seen.add(e.student.id);
            rows.push(e.student);
          }
        }
      }
    } else {
      // Coordinator / FYP Head → students + all staff
      const students = await prisma.user.findMany({
        where: { role: "STUDENT" },
        select: userSelect,
        orderBy: { name: "asc" },
        take: 40,
      });
      rows.push(...students);
    }
    const staff = await prisma.user.findMany({
      where: {
        role: { in: ["FACULTY", "COORDINATOR", "FYP_HEAD", "ADMIN"] },
        id: { not: user.id },
      },
      select: userSelect,
      orderBy: { name: "asc" },
      take: 40,
    });
    for (const s of staff) {
      if (!facultyIds.has(s.id) && !rows.some((r) => r.id === s.id)) rows.push(s);
    }
  }

  const roleLabel: Record<string, string> = {
    STUDENT: "Student",
    FACULTY: "Faculty",
    COORDINATOR: "Coordinator",
    FYP_HEAD: "FYP Head",
    MENTOR: "Mentor",
    ADMIN: "Administrator",
  };
  const unique = new Map<string, RecipientRow>();
  for (const r of rows) {
    if (unique.has(r.id)) continue;
    unique.set(r.id, { id: r.id, name: r.name, role: r.role, label: `${r.name} — ${roleLabel[r.role] ?? r.role}` });
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function sendMessage(
  user: User,
  input: { recipientId: string; subject?: string; body: string },
) {
  const body = input.body.trim();
  if (!body) throw new Error("Message body is required");
  if (body.length > 4000) throw new Error("Message is too long (4000 characters max)");
  if (input.recipientId === user.id) throw new Error("You cannot message yourself");

  const recipient = await prisma.user.findUnique({ where: { id: input.recipientId }, select: userSelect });
  if (!recipient) throw new Error("Recipient not found");

  const message = await prisma.message.create({
    data: {
      senderId: user.id,
      recipientId: recipient.id,
      subject: input.subject?.trim() ? input.subject.trim().slice(0, 120) : null,
      body,
    },
  });

  await notifyUser(recipient.id, {
    type: "MESSAGE",
    title: `New message from ${user.name}`,
    body: input.subject?.trim() || body.slice(0, 120),
    link: "/messages",
  });

  await recordAudit({
    actorId: user.id,
    action: "message.send",
    entity: "Message",
    entityId: message.id,
    summary: `Messaged ${recipient.name}${input.subject?.trim() ? ` · "${input.subject.trim()}"` : ""}`,
  });

  return message;
}

import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { assertTransition } from "@/server/status";
import { notifyRole, notifyUser } from "./notifications";
import { recordAudit } from "./audit";
import { ServiceError } from "./forms";

/**
 * FYP application service (plan M3). STUDENT submits PENDING; FYP_HEAD decides
 * (APPROVED | REJECTED with remarks). One notification each way (§6.6).
 */

export async function createFypApplication(
  user: User,
  input: {
    title: string;
    domain: string;
    description: string;
    technologies: string;
    groupName: string;
    members: string;
    registrationNos: string;
    supervisorPref?: string;
    department: string;
    semester: string;
  },
) {
  if (input.title.trim().length < 6) throw new ServiceError("validation_error", "Title is too short", 422);
  if (input.description.trim().length < 50) {
    throw new ServiceError("validation_error", "Describe the project in at least 50 characters", 422);
  }

  const existing = await prisma.fypApplication.count({ where: { applicantId: user.id } });
  if (existing >= 2) {
    throw new ServiceError("limit_reached", "You already have active FYP applications (max 2)", 409);
  }

  return prisma.$transaction(async (tx) => {
    const app = await tx.fypApplication.create({
      data: {
        applicantId: user.id,
        title: input.title.trim().slice(0, 200),
        domain: input.domain.trim().slice(0, 100),
        description: input.description.trim().slice(0, 4000),
        technologies: input.technologies.trim().slice(0, 300),
        groupName: input.groupName.trim().slice(0, 200),
        members: input.members.trim().slice(0, 500),
        registrationNos: input.registrationNos.trim().slice(0, 300),
        supervisorPref: input.supervisorPref?.trim().slice(0, 200) || null,
        department: input.department.trim().slice(0, 100),
        semester: input.semester.trim().slice(0, 50),
        status: "PENDING",
      },
    });
    await notifyRole(
      "FYP_HEAD",
      {
        type: "FYP",
        title: "New FYP application",
        body: `${user.name} submitted "${app.title}" (${app.groupName}).`,
        link: "/admin/fyp",
      },
      tx,
    );
    return app;
  });
}

export async function listMyFypApplications(user: User) {
  return prisma.fypApplication.findMany({
    where: { applicantId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      decidedBy: { select: { name: true } },
      supervisor: { select: { name: true, employeeId: true, email: true } },
      progressUpdates: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, role: true } } },
        take: 20,
      },
    },
  });
}

export async function listFypQueue() {
  return prisma.fypApplication.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      applicant: { select: { name: true, email: true, registrationNo: true } },
      decidedBy: { select: { name: true } },
      supervisor: { select: { name: true, employeeId: true } },
    },
  });
}

/** Faculty who can take an FYP group — the supervisor select on the FYP Head inbox. */
export async function listSupervisors() {
  return prisma.user.findMany({
    where: { role: "FACULTY" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeId: true },
  });
}

export async function decideFyp(
  user: User,
  id: string,
  decision: "APPROVED" | "REJECTED",
  remarks?: string,
  supervisorId?: string,
) {
  if (!can(user.role, "fyp.decide")) {
    throw new ServiceError("forbidden", "Not permitted to decide FYP applications", 403);
  }
  return prisma.$transaction(async (tx) => {
    const app = await tx.fypApplication.findUnique({
      where: { id },
      include: { applicant: { select: { id: true } } },
    });
    if (!app) throw new ServiceError("not_found", "Application not found", 404);
    assertTransition("fyp", app.status, decision);

    // A supervisor can only be attached at approval time, and must be faculty.
    let supervisor: { id: string; name: string } | null = null;
    if (decision === "APPROVED" && supervisorId) {
      const candidate = await tx.user.findUnique({
        where: { id: supervisorId },
        select: { id: true, name: true, role: true },
      });
      if (!candidate || candidate.role !== "FACULTY") {
        throw new ServiceError("validation_error", "Pick a faculty member as supervisor", 422);
      }
      supervisor = { id: candidate.id, name: candidate.name };
    }

    const updated = await tx.fypApplication.update({
      where: { id },
      data: {
        status: decision,
        remarks: remarks?.slice(0, 1000) || null,
        decidedById: user.id,
        decidedAt: new Date(),
        ...(supervisor ? { supervisorId: supervisor.id } : {}),
      },
    });
    await notifyUser(
      app.applicant.id,
      {
        type: "FYP",
        title: `FYP application ${decision.toLowerCase()}`,
        body:
          decision === "APPROVED"
            ? `"${app.title}" was approved.${supervisor ? ` Supervisor: ${supervisor.name}.` : ""}${remarks ? ` Note: ${remarks}` : ""}`
            : `"${app.title}" was rejected.${remarks ? ` Reason: ${remarks}` : ""}`,
        link: "/fyp",
      },
      tx,
    );
    if (supervisor) {
      await notifyUser(
        supervisor.id,
        {
          type: "FYP",
          title: "New FYP supervision assigned",
          body: `You are supervising "${app.title}" — group ${app.groupName} (${app.members}).`,
          link: "/faculty/fyp",
        },
        tx,
      );
    }
    return updated;
  });
}

/**
 * Student resubmission after "changes requested" (spec §12): the group revises
 * the same application — the FYP Head is notified and the queue re-opens.
 */
export async function resubmitFypApplication(
  user: User,
  id: string,
  input: {
    title: string;
    domain: string;
    description: string;
    technologies: string;
    groupName: string;
    members: string;
    registrationNos: string;
    supervisorPref?: string;
    department: string;
    semester: string;
  },
) {
  const app = await prisma.fypApplication.findUnique({ where: { id } });
  if (!app) throw new ServiceError("not_found", "Application not found", 404);
  if (app.applicantId !== user.id) {
    throw new ServiceError("forbidden", "That is not your application", 403);
  }
  if (app.status !== "CHANGES_REQUESTED") {
    throw new ServiceError("invalid_state", "This application is not awaiting corrections", 409);
  }
  if (input.title.trim().length < 6) throw new ServiceError("validation_error", "Title is too short", 422);
  if (input.description.trim().length < 50) {
    throw new ServiceError("validation_error", "Describe the project in at least 50 characters", 422);
  }
  assertTransition("fyp", app.status, "PENDING");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fypApplication.update({
      where: { id },
      data: {
        title: input.title.trim().slice(0, 200),
        domain: input.domain.trim().slice(0, 100),
        description: input.description.trim().slice(0, 4000),
        technologies: input.technologies.trim().slice(0, 300),
        groupName: input.groupName.trim().slice(0, 200),
        members: input.members.trim().slice(0, 500),
        registrationNos: input.registrationNos.trim().slice(0, 300),
        supervisorPref: input.supervisorPref?.trim().slice(0, 200) || null,
        department: input.department.trim().slice(0, 100),
        semester: input.semester.trim().slice(0, 50),
        status: "PENDING",
        remarks: null,
        decidedById: null,
        decidedAt: null,
      },
    });

    await notifyRole(
      "FYP_HEAD",
      {
        type: "FYP",
        title: "FYP application resubmitted",
        body: `The group revised "${updated.title}" and it is waiting for review again.`,
        link: "/fyphead",
      },
      tx,
    );

    await recordAudit({
      actorId: user.id,
      action: "fyp.resubmit",
      entity: "FypApplication",
      entityId: id,
      summary: `Resubmitted "${updated.title}" after corrections`,
    });

    return updated;
  });
}

/**
 * FYP Head requests corrections instead of deciding (spec §12): the group is
 * notified with the exact remarks and may resubmit through a new decision.
 */
export async function requestFypChanges(user: User, id: string, remarks: string) {
  if (!can(user.role, "fyp.decide")) {
    throw new ServiceError("forbidden", "Not permitted to review FYP applications", 403);
  }
  const note = remarks.trim();
  if (note.length < 5) throw new ServiceError("validation_error", "Explain what needs correcting", 422);

  return prisma.$transaction(async (tx) => {
    const app = await tx.fypApplication.findUnique({
      where: { id },
      include: { applicant: { select: { id: true } } },
    });
    if (!app) throw new ServiceError("not_found", "Application not found", 404);
    assertTransition("fyp", app.status, "CHANGES_REQUESTED");

    const updated = await tx.fypApplication.update({
      where: { id },
      data: {
        status: "CHANGES_REQUESTED",
        remarks: note.slice(0, 1000),
        decidedById: user.id,
        decidedAt: new Date(),
      },
    });

    await notifyUser(
      app.applicant.id,
      {
        type: "FYP",
        title: "Changes requested on your FYP application",
        body: `"${app.title}": ${note}`,
        link: "/fyp",
      },
      tx,
    );

    return updated;
  });
}

/**
 * Supervisor workspace (spec §12): the projects a faculty member supervises.
 */
export async function listSupervisedApplications(user: User) {
  return prisma.fypApplication.findMany({
    where: { supervisorId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      applicant: { select: { id: true, name: true, email: true, registrationNo: true } },
      progressUpdates: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, role: true } } },
        take: 20,
      },
    },
  });
}

/**
 * Supervisor progress remark (spec §12): recorded against the project and
 * announced to the group's applicant.
 */
export async function addFypProgressUpdate(user: User, applicationId: string, note: string) {
  const text = note.trim();
  if (text.length < 5) throw new ServiceError("validation_error", "Write a short progress note", 422);

  const app = await prisma.fypApplication.findUnique({
    where: { id: applicationId },
    include: { applicant: { select: { id: true } } },
  });
  if (!app) throw new ServiceError("not_found", "Project not found", 404);

  const allowed =
    app.supervisorId === user.id || can(user.role, "fyp.decide") || can(user.role, "users.manage");
  if (!allowed) throw new ServiceError("forbidden", "Only the assigned supervisor can add progress notes", 403);

  const update = await prisma.fypProgressUpdate.create({
    data: { applicationId, authorId: user.id, note: text.slice(0, 2000) },
  });

  await notifyUser(app.applicant.id, {
    type: "FYP",
    title: "New progress note on your FYP",
    body: `"${app.title}": ${text}`,
    link: "/fyp",
  });

  await recordAudit({
    actorId: user.id,
    action: "fyp.progress_note",
    entity: "FypApplication",
    entityId: applicationId,
    summary: `Progress note on "${app.title}": ${text.slice(0, 160)}`,
  });

  return update;
}

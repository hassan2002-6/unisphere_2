import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { assertTransition } from "@/server/status";
import { notifyUser } from "./notifications";
import { ServiceError } from "./forms";

/**
 * Mentorship service (plan M4). Students request; mentors accept/decline and
 * propose sessions (PROPOSED → CONFIRMED → COMPLETED); the completed session
 * closes the request. Capacity = maxActiveMentees.
 */

export async function listApprovedMentors(query?: string) {
  const q = query?.trim();
  return prisma.mentorProfile.findMany({
    where: {
      isApproved: true,
      ...(q
        ? {
            OR: [
              { headline: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
              { user: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { user: { name: "asc" } },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, department: true } },
    },
  });
}

export async function getMentorProfileByUserId(userId: string) {
  return prisma.mentorProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true, email: true, role: true } } },
  });
}

export async function requestMentorship(student: User, mentorUserId: string, message: string) {
  if (student.role !== "STUDENT") {
    throw new ServiceError("forbidden", "Only students can request mentorship", 403);
  }
  if (student.id === mentorUserId) throw new ServiceError("invalid", "You cannot mentor yourself", 422);
  if (message.trim().length < 10) {
    throw new ServiceError("validation_error", "Tell the mentor what you need (at least 10 characters)", 422);
  }

  const profile = await prisma.mentorProfile.findUnique({
    where: { userId: mentorUserId },
    include: { user: { select: { name: true } } },
  });
  if (!profile || !profile.isApproved) {
    throw new ServiceError("not_found", "Mentor is not available", 404);
  }

  const existing = await prisma.mentorshipRequest.findFirst({
    where: { studentId: student.id, mentorId: mentorUserId, status: { in: ["PENDING", "ACCEPTED"] } },
  });
  if (existing) {
    throw new ServiceError("already_requested", "You already have an open request with this mentor", 409);
  }

  const activeMentees = await prisma.mentorshipRequest.count({
    where: { mentorId: mentorUserId, status: "ACCEPTED" },
  });
  if (activeMentees >= profile.maxActiveMentees) {
    throw new ServiceError("at_capacity", "This mentor is at capacity right now", 409);
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.mentorshipRequest.create({
      data: { studentId: student.id, mentorId: mentorUserId, message: message.trim().slice(0, 2000) },
    });
    await notifyUser(
      mentorUserId,
      {
        type: "MENTORSHIP",
        title: "New mentorship request",
        body: `${student.name} asked for mentorship.`,
        link: "/mentor",
      },
      tx,
    );
    return request;
  });
}

export async function listMyMentorshipRequests(student: User) {
  return prisma.mentorshipRequest.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    include: {
      mentor: { select: { name: true, email: true } },
      sessions: { orderBy: { scheduledAt: "asc" } },
    },
  });
}

export async function listMentorRequests(mentor: User) {
  return prisma.mentorshipRequest.findMany({
    where: { mentorId: mentor.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      student: { select: { name: true, email: true, registrationNo: true } },
      sessions: { orderBy: { scheduledAt: "asc" } },
    },
  });
}

export async function respondToMentorship(mentor: User, requestId: string, decision: "ACCEPTED" | "DECLINED") {
  return prisma.$transaction(async (tx) => {
    const request = await tx.mentorshipRequest.findUnique({
      where: { id: requestId },
      include: { mentor: { select: { name: true } }, student: { select: { id: true } } },
    });
    if (!request) throw new ServiceError("not_found", "Request not found", 404);
    if (request.mentorId !== mentor.id) {
      throw new ServiceError("forbidden", "Only the mentor can respond", 403);
    }
    assertTransition("mentorshipRequest", request.status, decision);

    const updated = await tx.mentorshipRequest.update({
      where: { id: requestId },
      data: { status: decision },
    });
    await notifyUser(
      request.student.id,
      {
        type: "MENTORSHIP",
        title: decision === "ACCEPTED" ? "Mentorship accepted 🎉" : "Mentorship request declined",
        body:
          decision === "ACCEPTED"
            ? `${request.mentor.name} accepted — propose a first session when ready.`
            : `${request.mentor.name} can't take new mentees right now.`,
        link: "/mentorship",
      },
      tx,
    );
    return updated;
  });
}

export async function cancelMentorshipRequest(student: User, requestId: string) {
  const request = await prisma.mentorshipRequest.findFirst({ where: { id: requestId, studentId: student.id } });
  if (!request) throw new ServiceError("not_found", "Request not found", 404);
  assertTransition("mentorshipRequest", request.status, "CANCELLED");
  return prisma.mentorshipRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
}

export async function proposeSession(
  proposer: User,
  requestId: string,
  input: { scheduledAt: string; mode: string; location?: string; notes?: string },
) {
  const request = await prisma.mentorshipRequest.findUnique({
    where: { id: requestId },
    include: { mentor: { select: { id: true, name: true } }, student: { select: { id: true, name: true } } },
  });
  if (!request) throw new ServiceError("not_found", "Request not found", 404);
  if (request.mentorId !== proposer.id && request.studentId !== proposer.id) {
    throw new ServiceError("forbidden", "Only participants can propose sessions", 403);
  }
  if (request.status !== "ACCEPTED") {
    throw new ServiceError("invalid_state", "Sessions can only be proposed on accepted mentorships", 409);
  }
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new ServiceError("validation_error", "Invalid date/time", 422);
  if (!input.mode.trim()) throw new ServiceError("validation_error", "Mode is required (online / on-campus)", 422);

  const counterpartId = request.mentorId === proposer.id ? request.studentId : request.mentorId;
  return prisma.$transaction(async (tx) => {
    const session = await tx.mentorshipSession.create({
      data: {
        requestId,
        proposedById: proposer.id,
        scheduledAt: when,
        mode: input.mode.trim().slice(0, 50),
        location: input.location?.trim().slice(0, 200) || null,
        notes: input.notes?.trim().slice(0, 1000) || null,
      },
    });
    await notifyUser(
      counterpartId,
      {
        type: "MENTORSHIP",
        title: "Session proposed",
        body: `${proposer.name} proposed a session on ${when.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} (${session.mode}).`,
        link: proposer.role === "STUDENT" ? "/mentor" : "/mentorship",
      },
      tx,
    );
    return session;
  });
}

/** Counterpart confirms or cancels; proposer sees the change. */
export async function respondToSession(user: User, sessionId: string, decision: "CONFIRMED" | "CANCELLED") {
  return prisma.$transaction(async (tx) => {
    const session = await tx.mentorshipSession.findUnique({
      where: { id: sessionId },
      include: { request: { include: { mentor: { select: { id: true, name: true } }, student: { select: { id: true, name: true } } } } },
    });
    if (!session) throw new ServiceError("not_found", "Session not found", 404);
    const { mentorId, studentId } = session.request;
    if (user.id !== mentorId && user.id !== studentId) {
      throw new ServiceError("forbidden", "Not your session", 403);
    }
    assertTransition("mentorshipSession", session.status, decision);

    const updated = await tx.mentorshipSession.update({ where: { id: sessionId }, data: { status: decision } });
    const counterpartId = session.proposedById === user.id ? (user.id === mentorId ? studentId : mentorId) : session.proposedById;
    await notifyUser(
      counterpartId,
      {
        type: "MENTORSHIP",
        title: decision === "CONFIRMED" ? "Session confirmed" : "Session cancelled",
        body: `${user.name} ${decision === "CONFIRMED" ? "confirmed" : "cancelled"} the session on ${session.scheduledAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}.`,
        link: "/mentorship",
      },
      tx,
    );
    return updated;
  });
}

/** Completing a session closes the mentorship request. */
export async function completeSession(user: User, sessionId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.mentorshipSession.findUnique({
      where: { id: sessionId },
      include: { request: { include: { mentor: { select: { id: true, name: true } }, student: { select: { id: true, name: true } } } } },
    });
    if (!session) throw new ServiceError("not_found", "Session not found", 404);
    const { mentorId, studentId } = session.request;
    if (user.id !== mentorId && user.id !== studentId) {
      throw new ServiceError("forbidden", "Not your session", 403);
    }
    if (session.status !== "CONFIRMED" && session.status !== "PROPOSED") {
      throw new ServiceError("invalid_state", "Only live sessions can be completed", 409);
    }
    assertTransition("mentorshipSession", session.status, "COMPLETED");

    const updated = await tx.mentorshipSession.update({ where: { id: sessionId }, data: { status: "COMPLETED" } });
    if (session.request.status === "ACCEPTED") {
      assertTransition("mentorshipRequest", "ACCEPTED", "COMPLETED");
      await tx.mentorshipRequest.update({ where: { id: session.requestId }, data: { status: "COMPLETED" } });
    }
    const counterpartId = user.id === mentorId ? studentId : mentorId;
    await notifyUser(
      counterpartId,
      {
        type: "MENTORSHIP",
        title: "Session completed",
        body: "A mentorship session was marked complete — the mentorship is officially wrapped.",
        link: "/mentorship",
      },
      tx,
    );
    return updated;
  });
}

/* ---------- mentor profile management ---------- */

export async function upsertMentorProfile(
  user: User,
  input: { headline: string; company?: string; expertise?: string; bio?: string; linkedinUrl?: string },
) {
  if (input.headline.trim().length < 5) {
    throw new ServiceError("validation_error", "Headline is too short", 422);
  }
  const expertise = (input.expertise ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);

  return prisma.mentorProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      headline: input.headline.trim().slice(0, 200),
      company: input.company?.trim().slice(0, 150) || null,
      expertise,
      bio: input.bio?.trim().slice(0, 2000) || null,
      linkedinUrl: input.linkedinUrl?.trim().slice(0, 300) || null,
    },
    update: {
      headline: input.headline.trim().slice(0, 200),
      company: input.company?.trim().slice(0, 150) || null,
      expertise,
      bio: input.bio?.trim().slice(0, 2000) || null,
      linkedinUrl: input.linkedinUrl?.trim().slice(0, 300) || null,
    },
  });
}

export async function listAllMentorProfiles() {
  return prisma.mentorProfile.findMany({
    orderBy: [{ isApproved: "asc" }, { user: { name: "asc" } }],
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
}

export async function setMentorApproval(userId: string, isApproved: boolean) {
  const profile = await prisma.mentorProfile.findUnique({ where: { userId } });
  if (!profile) throw new ServiceError("not_found", "Mentor profile not found", 404);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.mentorProfile.update({ where: { userId }, data: { isApproved } });
    await notifyUser(
      userId,
      {
        type: "MENTORSHIP",
        title: isApproved ? "Mentor profile approved" : "Mentor profile paused",
        body: isApproved
          ? "You're now listed in the mentor directory — students can request mentorship."
          : "Your mentor profile was paused and is hidden from the directory.",
        link: "/mentor",
      },
      tx,
    );
    return updated;
  });
}

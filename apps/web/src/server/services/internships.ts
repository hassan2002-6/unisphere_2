import { prisma } from "@/lib/db";
import type { InternshipApplicationStatus, User } from "@unisphere/db";
import { assertTransition } from "@/server/status";
import { notifyUser } from "./notifications";
import { ServiceError } from "./forms";

/**
 * Internships service (plan M4). FYP_HEAD/admin post; students apply;
 * poster moves applications through APPLIED → SHORTLISTED → ACCEPTED | REJECTED
 * and the student is notified at each decision.
 */

export const APPLICATION_STATUSES: InternshipApplicationStatus[] = [
  "APPLIED",
  "SHORTLISTED",
  "ACCEPTED",
  "REJECTED",
];

export async function listInternships(opts?: { query?: string; includeClosed?: boolean }) {
  const q = opts?.query?.trim();
  return prisma.internship.findMany({
    where: {
      ...(opts?.includeClosed ? {} : { status: "OPEN" }),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { tags: { has: q.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      postedBy: { select: { name: true } },
      _count: { select: { applications: true } },
    },
  });
}

export async function getInternship(id: string) {
  return prisma.internship.findUnique({
    where: { id },
    include: {
      postedBy: { select: { name: true } },
      _count: { select: { applications: true } },
    },
  });
}

export async function listMyApplications(user: User) {
  return prisma.internshipApplication.findMany({
    where: { studentId: user.id },
    orderBy: { createdAt: "desc" },
    include: { internship: { include: { postedBy: { select: { name: true } } } } },
  });
}

export async function applyToInternship(user: User, internshipId: string, note?: string) {
  if (user.role !== "STUDENT") {
    throw new ServiceError("forbidden", "Only students can apply to internships", 403);
  }
  const internship = await prisma.internship.findUnique({
    where: { id: internshipId },
    include: { postedBy: { select: { id: true } } },
  });
  if (!internship) throw new ServiceError("not_found", "Internship not found", 404);
  if (internship.status !== "OPEN") throw new ServiceError("closed", "This internship is closed", 409);

  const existing = await prisma.internshipApplication.findUnique({
    where: { internshipId_studentId: { internshipId, studentId: user.id } },
  });
  if (existing) throw new ServiceError("already_applied", "You already applied to this internship", 409);

  return prisma.$transaction(async (tx) => {
    const application = await tx.internshipApplication.create({
      data: { internshipId, studentId: user.id, note: note?.trim().slice(0, 1000) || null },
    });
    await notifyUser(
      internship.postedById,
      {
        type: "INTERNSHIP",
        title: "New internship application",
        body: `${user.name} applied to "${internship.title}" (${internship.company}).`,
        link: "/admin/internships",
      },
      tx,
    );
    return application;
  });
}

export async function createInternship(
  poster: User,
  input: {
    title: string;
    company: string;
    description: string;
    location?: string;
    mode?: string;
    stipend?: string;
    deadline?: string;
    applyUrl?: string;
    tags?: string;
  },
) {
  if (!input.title.trim() || !input.company.trim()) {
    throw new ServiceError("validation_error", "Title and company are required", 422);
  }
  if (input.description.trim().length < 20) {
    throw new ServiceError("validation_error", "Description must be at least 20 characters", 422);
  }
  const deadline = input.deadline ? new Date(input.deadline) : null;
  if (deadline && Number.isNaN(deadline.getTime())) {
    throw new ServiceError("validation_error", "Deadline is not a valid date", 422);
  }
  const tags = (input.tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);

  return prisma.internship.create({
    data: {
      title: input.title.trim().slice(0, 200),
      company: input.company.trim().slice(0, 150),
      description: input.description.trim().slice(0, 4000),
      location: input.location?.trim().slice(0, 150) || null,
      mode: input.mode?.trim().slice(0, 50) || null,
      stipend: input.stipend?.trim().slice(0, 100) || null,
      deadline,
      applyUrl: input.applyUrl?.trim().slice(0, 500) || null,
      tags,
      status: "OPEN",
      postedById: poster.id,
    },
  });
}

export async function setInternshipStatus(id: string, status: "OPEN" | "CLOSED") {
  const internship = await prisma.internship.findUnique({ where: { id } });
  if (!internship) throw new ServiceError("not_found", "Internship not found", 404);
  return prisma.internship.update({ where: { id }, data: { status } });
}

/** Poster view: internships + all their applications. */
export async function listManagedInternships() {
  return prisma.internship.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      postedBy: { select: { name: true } },
      applications: {
        orderBy: { createdAt: "asc" },
        include: { student: { select: { name: true, registrationNo: true, email: true } } },
      },
    },
  });
}

export async function updateApplicationStatus(
  updater: User,
  applicationId: string,
  status: InternshipApplicationStatus,
) {
  return prisma.$transaction(async (tx) => {
    const application = await tx.internshipApplication.findUnique({
      where: { id: applicationId },
      include: {
        internship: { select: { title: true, company: true, postedById: true } },
        student: { select: { id: true } },
      },
    });
    if (!application) throw new ServiceError("not_found", "Application not found", 404);
    if (application.internship.postedById !== updater.id && updater.role !== "FYP_HEAD") {
      throw new ServiceError("forbidden", "Only the poster can update applications", 403);
    }
    assertTransition("internshipApplication", application.status, status);

    const updated = await tx.internshipApplication.update({
      where: { id: applicationId },
      data: { status },
    });
    await notifyUser(
      application.student.id,
      {
        type: "INTERNSHIP",
        title: `Application ${status.toLowerCase()}`,
        body: `Your application to "${application.internship.title}" (${application.internship.company}) is now ${status.toLowerCase()}.`,
        link: "/internships",
      },
      tx,
    );
    return updated;
  });
}

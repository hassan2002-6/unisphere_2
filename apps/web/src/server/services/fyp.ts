import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { assertTransition } from "@/server/status";
import { notifyRole, notifyUser } from "./notifications";
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
    include: { decidedBy: { select: { name: true } } },
  });
}

export async function listFypQueue() {
  return prisma.fypApplication.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      applicant: { select: { name: true, email: true, registrationNo: true } },
      decidedBy: { select: { name: true } },
    },
  });
}

export async function decideFyp(
  user: User,
  id: string,
  decision: "APPROVED" | "REJECTED",
  remarks?: string,
) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.fypApplication.findUnique({
      where: { id },
      include: { applicant: { select: { id: true } } },
    });
    if (!app) throw new ServiceError("not_found", "Application not found", 404);
    assertTransition("fyp", app.status, decision);

    const updated = await tx.fypApplication.update({
      where: { id },
      data: { status: decision, remarks: remarks?.slice(0, 1000) || null, decidedById: user.id, decidedAt: new Date() },
    });
    await notifyUser(
      app.applicant.id,
      {
        type: "FYP",
        title: `FYP application ${decision.toLowerCase()}`,
        body:
          decision === "APPROVED"
            ? `"${app.title}" was approved.${remarks ? ` Note: ${remarks}` : ""}`
            : `"${app.title}" was rejected.${remarks ? ` Reason: ${remarks}` : ""}`,
        link: "/fyp",
      },
      tx,
    );
    return updated;
  });
}

import { prisma } from "@/lib/db";
import type { FormStatus, Role, User } from "@unisphere/db";
import { assertTransition } from "@/server/status";
import { buildFormSchema, formFieldsSchema, type FormFieldSpec } from "@/lib/validation";
import { notifyRole, notifyUser } from "./notifications";

/**
 * Forms Center service (plan M2c). Server-side validation with the same Zod
 * schema the renderer uses; every transition writes a FormEvent and notifies
 * per the §6.6 matrix, atomically with the state change.
 */

export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

function parseFields(raw: unknown): FormFieldSpec[] {
  const parsed = formFieldsSchema.safeParse(raw);
  if (!parsed.success) throw new ServiceError("bad_template", "Template field spec is invalid", 500);
  return parsed.data;
}

/** Templates visible to the caller's role (audience), newest first. */
export async function listTemplatesFor(role: Role) {
  return prisma.formTemplate.findMany({
    where: { active: true, audienceRole: role },
    orderBy: { title: "asc" },
  });
}

export async function getTemplateByKey(key: string) {
  const tpl = await prisma.formTemplate.findUnique({ where: { key } });
  if (!tpl || !tpl.active) throw new ServiceError("not_found", "Template not found", 404);
  return tpl;
}

/**
 * Submit a form. `payload` must satisfy the template's dynamic schema.
 * Emits: FormEvent(SUBMITTED) + notify reviewers of the template's role.
 */
export async function submitForm(user: User, templateKey: string, payload: unknown) {
  const tpl = await getTemplateByKey(templateKey);
  if (tpl.audienceRole !== user.role) {
    throw new ServiceError("forbidden", "This form is not available for your role", 403);
  }

  const schema = buildFormSchema(parseFields(tpl.fields));
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("validation_error", "The submitted data is invalid", 422);
  }

  return prisma.$transaction(async (tx) => {
    const submission = await tx.formSubmission.create({
      data: {
        templateId: tpl.id,
        submittedById: user.id,
        payload: parsed.data as object,
        status: "SUBMITTED",
        events: {
          create: { actorId: user.id, toStatus: "SUBMITTED", comment: "Submitted" },
        },
      },
    });
    await notifyRole(
      tpl.reviewerRole,
      {
        type: "FORM",
        title: `New ${tpl.title}`,
        body: `${user.name} submitted a ${tpl.title}.`,
        link: `/reviews`,
      },
      tx,
    );
    return submission;
  });
}

/** Own submissions with template info (list view). */
export async function listMySubmissions(user: User, opts?: { cursor?: string; take?: number }) {
  const take = Math.min(opts?.take ?? 20, 50);
  const rows = await prisma.formSubmission.findMany({
    where: { submittedById: user.id },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    include: { template: { select: { key: true, title: true, reviewerRole: true } } },
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
}

/** Own submission detail (with events + reviewer names). */
export async function getMySubmission(user: User, id: string) {
  const sub = await prisma.formSubmission.findFirst({
    where: { id, submittedById: user.id },
    include: {
      template: true,
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!sub) throw new ServiceError("not_found", "Submission not found", 404);
  return sub;
}

/** Withdraw (submitter, before decision — plan §6.2). */
export async function withdrawSubmission(user: User, id: string) {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.formSubmission.findFirst({
      where: { id, submittedById: user.id },
      include: { template: true },
    });
    if (!sub) throw new ServiceError("not_found", "Submission not found", 404);
    assertTransition("form", sub.status, "WITHDRAWN");
    const updated = await tx.formSubmission.update({
      where: { id: sub.id },
      data: {
        status: "WITHDRAWN",
        events: { create: { actorId: user.id, fromStatus: sub.status, toStatus: "WITHDRAWN", comment: "Withdrawn by submitter" } },
      },
    });
    await notifyRole(
      sub.template.reviewerRole,
      {
        type: "FORM",
        title: `${sub.template.title} withdrawn`,
        body: `${user.name} withdrew their ${sub.template.title}.`,
        link: `/reviews`,
      },
      tx,
    );
    return updated;
  });
}

/** Review queue for reviewers: SUBMITTED/UNDER_REVIEW submissions routed to my role (or decided by me). */
export async function listReviewQueue(user: User, opts?: { cursor?: string; take?: number }) {
  const take = Math.min(opts?.take ?? 20, 50);
  const rows = await prisma.formSubmission.findMany({
    where: {
      template: { reviewerRole: user.role },
      status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
    },
    orderBy: { createdAt: "asc" },
    take: take + 1,
    include: {
      template: { select: { key: true, title: true, audienceRole: true } },
      submittedBy: { select: { name: true, email: true, registrationNo: true } },
    },
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
}

/**
 * Decide (reviewer role) or move to review. `decision` ∈ UNDER_REVIEW | APPROVED | REJECTED.
 * Notifies the submitter with the comment.
 */
export async function decideSubmission(
  user: User,
  id: string,
  decision: Extract<FormStatus, "UNDER_REVIEW" | "APPROVED" | "REJECTED">,
  comment?: string,
) {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.formSubmission.findUnique({
      where: { id },
      include: { template: true, submittedBy: { select: { id: true, name: true } } },
    });
    if (!sub) throw new ServiceError("not_found", "Submission not found", 404);
    if (sub.template.reviewerRole !== user.role) {
      throw new ServiceError("forbidden", "You are not the reviewer for this form", 403);
    }
    assertTransition("form", sub.status, decision);

    const updated = await tx.formSubmission.update({
      where: { id: sub.id },
      data: {
        status: decision,
        reviewerId: user.id,
        events: {
          create: {
            actorId: user.id,
            fromStatus: sub.status,
            toStatus: decision,
            comment: comment?.slice(0, 1000) || null,
          },
        },
      },
    });

    await notifyUser(
      sub.submittedBy.id,
      {
        type: "FORM",
        title: `${sub.template.title}: ${decision.replace("_", " ").toLowerCase()}`,
        body: comment
          ? `Decision from ${user.name}: ${comment}`
          : `Your ${sub.template.title} is now ${decision.replace("_", " ").toLowerCase()}.`,
        link: `/submissions/${sub.id}`,
      },
      tx,
    );
    return updated;
  });
}

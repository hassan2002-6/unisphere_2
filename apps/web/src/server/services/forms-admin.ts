import { prisma } from "@/lib/db";
import type { FormStatus, Prisma, Role, User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "./audit";
import { ServiceError } from "./forms";

const ROLES: Role[] = ["STUDENT", "FACULTY", "COORDINATOR", "FYP_HEAD", "MENTOR", "ADMIN"];
const FIELD_TYPES = ["text", "textarea", "number", "select", "date"] as const;

export type TemplateFieldSpec = { name: string; label: string; type: string; required: boolean; options?: string[] };

/** Admin view: every template, active or not, with usage counts (spec §11). */
export async function listAllTemplates() {
  const templates = await prisma.formTemplate.findMany({
    orderBy: [{ audienceRole: "asc" }, { title: "asc" }],
    include: { _count: { select: { submissions: true } } },
  });
  return templates.map((t) => ({ ...t, submissions: t._count.submissions }));
}

export async function setFormTemplateActive(actor: User, id: string, active: boolean) {
  if (!can(actor.role, "users.manage")) {
    throw new ServiceError("forbidden", "Not permitted to manage forms", 403);
  }
  const tpl = await prisma.formTemplate.findUnique({ where: { id } });
  if (!tpl) throw new ServiceError("not_found", "Form template not found", 404);
  if (tpl.active === active) return tpl;

  const updated = await prisma.formTemplate.update({ where: { id }, data: { active } });
  await recordAudit({
    actorId: actor.id,
    action: active ? "forms.template_activate" : "forms.template_deactivate",
    entity: "FormTemplate",
    entityId: id,
    summary: `${active ? "Activated" : "Deactivated"} form template "${tpl.title}" (${tpl.key})`,
  });
  return updated;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Parse the compact field description: one field per line, “Label | type”,
 * optionally “| optional” and “| option A, option B” for selects.
 */
export function parseTemplateFields(text: string): TemplateFieldSpec[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new ServiceError("validation_error", "Describe at least one field", 422);

  return lines.map((line) => {
    const parts = line.split("|").map((p) => p.trim());
    const label = parts[0] ?? "";
    const type = (parts[1] ?? "text") as (typeof FIELD_TYPES)[number];
    const flags = parts.slice(2).join("|").toLowerCase();
    if (!label) throw new ServiceError("validation_error", `A field is missing its label: "${line}"`, 422);
    if (!FIELD_TYPES.includes(type)) {
      throw new ServiceError("validation_error", `Unknown field type "${type}" (use ${FIELD_TYPES.join(", ")})`, 422);
    }
    const options = type === "select" ? (parts[3] ?? "").split(",").map((o) => o.trim()).filter(Boolean) : undefined;
    if (type === "select" && (!options || options.length === 0)) {
      throw new ServiceError("validation_error", `Select field "${label}" needs options: "Label | select | required | Option A, Option B"`, 422);
    }
    return {
      name: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field",
      label,
      type,
      required: !flags.includes("optional"),
      ...(options ? { options } : {}),
    };
  });
}

export type TemplateInput = {
  id?: string;
  key: string;
  title: string;
  description: string;
  audienceRole: string;
  reviewerRole: string;
  recipientLabel: string;
  slaDays: string | null;
  fieldsText: string;
  attachmentLabel?: string;
  requiresAttachment?: boolean;
};

/** Create or update a template (spec §11: add forms per actual requirements). */
export async function upsertFormTemplate(actor: User, input: TemplateInput) {
  if (!can(actor.role, "users.manage")) {
    throw new ServiceError("forbidden", "Not permitted to manage forms", 403);
  }
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 4) throw new ServiceError("validation_error", "Give the form a clear title", 422);
  if (description.length < 8) throw new ServiceError("validation_error", "Add a short description", 422);
  const key = slugify(input.key || title);
  if (key.length < 3) throw new ServiceError("validation_error", "The form key is too short", 422);
  if (!ROLES.includes(input.audienceRole as Role)) throw new ServiceError("validation_error", "Pick who can see this form", 422);
  if (!ROLES.includes(input.reviewerRole as Role)) throw new ServiceError("validation_error", "Pick who reviews this form", 422);

  const fields = parseTemplateFields(input.fieldsText) as Prisma.InputJsonValue;
  const slaDays = input.slaDays ? Math.max(1, Math.min(60, Number(input.slaDays) || 0)) : null;
  const attachmentLabel = input.attachmentLabel?.trim().slice(0, 80) || null;
  const requiresAttachment = Boolean(input.requiresAttachment);

  const data = {
    key,
    title: title.slice(0, 120),
    description: description.slice(0, 400),
    audienceRole: input.audienceRole as Role,
    reviewerRole: input.reviewerRole as Role,
    recipientLabel: (input.recipientLabel.trim() || "Coordination Office").slice(0, 80),
    slaDays: slaDays || null,
    fields,
    attachmentLabel,
    requiresAttachment,
    active: true,
  } satisfies Prisma.FormTemplateUncheckedCreateInput;

  let saved;
  if (input.id) {
    const existing = await prisma.formTemplate.findUnique({ where: { id: input.id } });
    if (!existing) throw new ServiceError("not_found", "Form template not found", 404);
    const clash = await prisma.formTemplate.findFirst({ where: { key, id: { not: input.id } } });
    if (clash) throw new ServiceError("validation_error", `Key "${key}" already belongs to “${clash.title}”`, 422);
    // Field changes create a new version — existing submissions keep their
    // snapshot, so old answers are never reinterpreted (spec §D).
    const fieldsChanged = JSON.stringify(existing.fields) !== JSON.stringify(fields);
    saved = await prisma.formTemplate.update({
      where: { id: input.id },
      data: fieldsChanged ? { ...data, version: existing.version + 1 } : data,
    });
    if (fieldsChanged) {
      await recordAudit({
        actorId: actor.id,
        action: "forms.template_version",
        entity: "FormTemplate",
        entityId: saved.id,
        summary: `Form “${saved.title}” fields changed → version ${saved.version} (existing submissions keep their snapshot)`,
      });
    }
  } else {
    const existing = await prisma.formTemplate.findUnique({ where: { key } });
    if (existing) throw new ServiceError("validation_error", `A form with key "${key}" already exists`, 422);
    saved = await prisma.formTemplate.create({ data });
  }

  await recordAudit({
    actorId: actor.id,
    action: input.id ? "forms.template_update" : "forms.template_create",
    entity: "FormTemplate",
    entityId: saved.id,
    summary: `${input.id ? "Updated" : "Created"} form template "${saved.title}" (${saved.key}) for ${saved.audienceRole}`,
  });
  return saved;
}

/** Admin submission browser (spec §D): filter by status, form, applicant, date. */
export async function listSubmissionsAdmin(
  actor: User,
  filters?: { status?: string; templateId?: string; q?: string; from?: string; to?: string; take?: number; skip?: number },
) {
  if (!can(actor.role, "users.manage")) {
    throw new ServiceError("forbidden", "Not permitted to browse submissions", 403);
  }
  const STATUS_VALUES = ["SUBMITTED", "UNDER_REVIEW", "CORRECTIONS_REQUESTED", "APPROVED", "REJECTED", "WITHDRAWN"];
  const status = filters?.status && STATUS_VALUES.includes(filters.status) ? (filters.status as FormStatus) : undefined;
  const q = filters?.q?.trim().slice(0, 80);
  const from = filters?.from ? new Date(`${filters.from}T00:00:00+05:00`) : null;
  const to = filters?.to ? new Date(`${filters.to}T23:59:59+05:00`) : null;

  const where: Prisma.FormSubmissionWhereInput = {
    ...(status ? { status } : {}),
    ...(filters?.templateId ? { templateId: filters.templateId } : {}),
    ...(q
      ? {
          submittedBy: {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { registrationNo: { contains: q, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  const take = Math.min(filters?.take ?? 50, 100);
  const skip = Math.max(filters?.skip ?? 0, 0);
  const [rows, total] = await Promise.all([
    prisma.formSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      omit: { attachmentData: true, templateSnapshot: true },
      include: {
        template: { select: { id: true, key: true, title: true, version: true } },
        submittedBy: { select: { name: true, email: true, registrationNo: true, role: true } },
      },
    }),
    prisma.formSubmission.count({ where }),
  ]);
  return { items: rows, total, hasMore: skip + rows.length < total };
}

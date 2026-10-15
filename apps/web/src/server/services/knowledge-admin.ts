import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "./audit";
import { ServiceError } from "./forms";

/**
 * Admin knowledge management (spec §9/§C): the approved knowledge sources the
 * assistant may cite, plus the review queue of questions the assistant could
 * not ground. Everything here is DB-backed — no code edits needed to teach
 * the assistant new answers.
 */

const TITLE_MAX = 160;
const SOURCE_MAX = 200;
const CONTENT_MAX = 20_000;

function assertManager(user: User) {
  if (!can(user.role, "knowledge.manage")) {
    throw new ServiceError("forbidden", "Only administrators manage the knowledge base", 403);
  }
}

export type KnowledgeInput = { title: string; source: string; content: string; tags?: string[] };

function sanitizeInput(input: KnowledgeInput) {
  const title = input.title.trim().slice(0, TITLE_MAX);
  const source = input.source.trim().slice(0, SOURCE_MAX);
  const content = input.content.trim().slice(0, CONTENT_MAX);
  const tags = (input.tags ?? [])
    .map((t) => t.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 10);
  if (title.length < 3) throw new ServiceError("validation_error", "Give the document a clear title", 422);
  if (!source) throw new ServiceError("validation_error", "Say where this knowledge comes from (e.g. SHU Handbook §4.2)", 422);
  if (content.length < 20) throw new ServiceError("validation_error", "The content is too short to be useful", 422);
  return { title, source, content, tags };
}

/** List docs for the admin screen (search + archived toggle). */
export async function listKnowledgeDocs(user: User, opts?: { q?: string; includeArchived?: boolean }) {
  assertManager(user);
  const q = opts?.q?.trim().slice(0, 80);
  return prisma.knowledgeDoc.findMany({
    where: {
      ...(opts?.includeArchived ? {} : { isArchived: false }),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { tags: { has: q } }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, source: true, tags: true, isArchived: true, updatedAt: true },
  });
}

export async function getKnowledgeDoc(user: User, id: string) {
  assertManager(user);
  const doc = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!doc) throw new ServiceError("not_found", "Knowledge document not found", 404);
  return doc;
}

export async function createKnowledgeDoc(user: User, input: KnowledgeInput) {
  assertManager(user);
  const data = sanitizeInput(input);
  const doc = await prisma.knowledgeDoc.create({ data: { ...data, updatedById: user.id } });
  await recordAudit({
    actorId: user.id,
    action: "knowledge.create",
    entity: "KnowledgeDoc",
    entityId: doc.id,
    summary: `Added knowledge document “${doc.title}” (${doc.source})`,
  });
  return doc;
}

export async function updateKnowledgeDoc(user: User, id: string, input: KnowledgeInput) {
  assertManager(user);
  const existing = await prisma.knowledgeDoc.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!existing) throw new ServiceError("not_found", "Knowledge document not found", 404);
  const data = sanitizeInput(input);
  const doc = await prisma.knowledgeDoc.update({ where: { id }, data: { ...data, updatedById: user.id } });
  await recordAudit({
    actorId: user.id,
    action: "knowledge.update",
    entity: "KnowledgeDoc",
    entityId: doc.id,
    summary: `Updated knowledge document “${existing.title}”`,
  });
  return doc;
}

/** Archive/restore instead of deleting — the assistant stops citing it at once. */
export async function setKnowledgeDocArchived(user: User, id: string, archived: boolean) {
  assertManager(user);
  const doc = await prisma.knowledgeDoc.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!doc) throw new ServiceError("not_found", "Knowledge document not found", 404);
  await prisma.knowledgeDoc.update({ where: { id }, data: { isArchived: archived, updatedById: user.id } });
  await recordAudit({
    actorId: user.id,
    action: archived ? "knowledge.archive" : "knowledge.restore",
    entity: "KnowledgeDoc",
    entityId: id,
    summary: `${archived ? "Archived" : "Restored"} knowledge document “${doc.title}”`,
  });
}

/** The review queue: questions the assistant could not ground in any source. */
export async function listUnanswered(user: User, opts?: { includeReviewed?: boolean }) {
  assertManager(user);
  return prisma.aiUnanswered.findMany({
    where: opts?.includeReviewed ? {} : { reviewedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function markUnansweredReviewed(user: User, id: string, note?: string) {
  assertManager(user);
  const row = await prisma.aiUnanswered.findUnique({ where: { id }, select: { id: true, question: true } });
  if (!row) throw new ServiceError("not_found", "Question not found", 404);
  await prisma.aiUnanswered.update({
    where: { id },
    data: { reviewedAt: new Date(), reviewedById: user.id, note: note?.trim().slice(0, 500) || null },
  });
  await recordAudit({
    actorId: user.id,
    action: "knowledge.unanswered_review",
    entity: "AiUnanswered",
    entityId: id,
    summary: `Reviewed unanswered question “${row.question.slice(0, 80)}”`,
  });
}

export async function countUnanswered(user: User) {
  assertManager(user);
  return prisma.aiUnanswered.count({ where: { reviewedAt: null } });
}

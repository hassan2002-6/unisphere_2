import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { callLLM, type ChatMsg } from "./provider";
import { buildSystemPrompt, retrieveKnowledge, retrievePersonalContext, type Source } from "./retrieval";

/**
 * Assistant orchestrator (plan M5): retrieve → prompt → persist.
 * The last N messages of the session are included so follow-ups work.
 */

const HISTORY_LIMIT = 8;

export type AssistantReply = {
  answer: string;
  sources: Source[];
  fallback: boolean;
  provider: string;
  model: string;
  sessionId: string;
};

export async function getOrCreateSession(user: User, sessionId?: string) {
  if (sessionId) {
    const existing = await prisma.chatSession.findFirst({ where: { id: sessionId, userId: user.id } });
    if (existing) return existing;
  }
  const latest = await prisma.chatSession.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (latest) return latest;
  return prisma.chatSession.create({ data: { userId: user.id, title: "New chat" } });
}

export async function listSessions(user: User) {
  return prisma.chatSession.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { _count: { select: { messages: true } } },
  });
}

export async function getSessionMessages(user: User, sessionId: string) {
  const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!session) return null;
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return { session, messages };
}

export async function ask(user: User, sessionId: string, question: string): Promise<AssistantReply> {
  const q = question.trim().slice(0, 1000);
  if (q.length < 2) throw new Error("Question is too short");

  const [sources, personalLines, history, session] = await Promise.all([
    retrieveKnowledge(q, 5),
    retrievePersonalContext(user),
    prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT }),
    prisma.chatSession.findFirst({ where: { id: sessionId, userId: user.id } }),
  ]);
  if (!session) throw new Error("Session not found");

  const messages: ChatMsg[] = [
    { role: "system", content: buildSystemPrompt(personalLines, sources) },
    ...history
      .reverse()
      .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content })),
    { role: "user", content: q },
  ];

  const result = await callLLM(
    messages,
    sources.map((s) => `${s.title}: ${s.snippet.slice(0, 200)}`),
  );

  const sourcePayload = sources.length ? (sources as unknown as object) : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.chatMessage.create({ data: { sessionId, role: "user", content: q } });
    await tx.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: result.text,
        sources: sourcePayload ?? undefined,
        tokenCount: result.tokens ?? null,
      },
    });
    // Name a fresh session after its first question (first 60 chars).
    const count = await tx.chatMessage.count({ where: { sessionId } });
    if (count <= 2) {
      await tx.chatSession.update({
        where: { id: sessionId },
        data: { title: q.length > 60 ? `${q.slice(0, 57)}…` : q },
      });
    }
  });

  return {
    answer: result.text,
    sources,
    fallback: result.fallback,
    provider: result.provider,
    model: result.model,
    sessionId,
  };
}

export function parseSources(value: unknown): Source[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      title: String(v.title ?? ""),
      source: String(v.source ?? ""),
      snippet: String(v.snippet ?? ""),
    }))
    .filter((s) => s.title || s.snippet);
}

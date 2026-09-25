/**
 * Live AI smoke test — full pipeline against the real database + provider.
 * Asks the seeded student three questions through ask() and prints the answers.
 *
 * Requires DATABASE_URL (+ COMMANDCODE_API_KEY for real generation; without a
 * key the canned fallback still answers from the knowledge base).
 * Run:  bun run scripts/smoke-ai.ts        (from apps/web)
 */

import { prisma } from "@unisphere/db";
import { ask, getOrCreateSession } from "@/server/ai/assistant";
import { aiStatus } from "@/server/ai/provider";

const QUESTIONS = [
  "When is my next class?",
  "How do I request a GPU for my FYP?",
  "What should I do if I find a clash in my timetable?",
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL is not set.");
    process.exit(2);
  }

  const status = aiStatus();
  console.log(`provider: ${status.provider} · model: ${status.model} · configured: ${status.configured}\n`);

  const student = await prisma.user.findFirst({ where: { email: "student@shu.edu.pk" } });
  if (!student) {
    console.log("SKIP: seeded student not found — run `bun run seed` first.");
    process.exit(2);
  }

  const session = await getOrCreateSession(student);
  let fallbacks = 0;

  for (const q of QUESTIONS) {
    const reply = await ask(student, session.id, q);
    if (reply.fallback) fallbacks++;
    console.log(`Q: ${q}`);
    console.log(`A: ${reply.answer.replace(/\s+/g, " ").slice(0, 320)}`);
    console.log(`   sources: ${reply.sources.map((s) => s.title).join(" | ") || "(none)"}`);
    console.log(`   fallback: ${reply.fallback}\n`);
  }

  const rows = await prisma.chatMessage.count({ where: { sessionId: session.id } });
  console.log(`persisted messages in session: ${rows}`);
  console.log(
    status.configured && fallbacks === 0
      ? "PASS: live provider answered all questions with sources."
      : `NOTE: ${fallbacks}/${QUESTIONS.length} answers used the canned fallback (provider ${status.configured ? "degraded" : "not configured"}).`,
  );
  process.exit(status.configured && fallbacks === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

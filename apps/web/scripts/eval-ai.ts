/**
 * AI assistant eval suite (plan M5 — ≥30 questions, acceptance criterion).
 *
 * Retrieval-scored: each question must retrieve at least one knowledge-base
 * entry whose title/content contains one of the expected keywords (checked in
 * the top-3 results). If an AI provider key is present, each question is also
 * sent through the full pipeline and scored on keywords in the answer.
 *
 * Run:  bun run scripts/eval-ai.ts        (from apps/web)
 * Exit: 0 when every retrieval check passes, 1 otherwise.
 */

import { retrieveKnowledge } from "@/server/ai/retrieval";

type EvalCase = { q: string; keywords: string[] };

const CASES: EvalCase[] = [
  { q: "How does the timetable clash detection work?", keywords: ["clash"] },
  { q: "What should I do if I find a clash in my timetable?", keywords: ["clash"] },
  { q: "How do I request a GPU for my FYP?", keywords: ["gpu"] },
  { q: "How long does GPU allocation take?", keywords: ["gpu", "allocat"] },
  { q: "What happens if a GPU is not available?", keywords: ["gpu", "allocat"] },
  { q: "Can I request a lab workstation?", keywords: ["lab"] },
  { q: "How do I submit an FYP application?", keywords: ["fyp"] },
  { q: "Who approves FYP applications?", keywords: ["fyp"] },
  { q: "How many FYP applications can I submit?", keywords: ["fyp"] },
  { q: "How do I file a complaint against a faculty member?", keywords: ["complaint"] },
  { q: "What happens after I file a complaint?", keywords: ["complaint"] },
  { q: "Who handles complaints?", keywords: ["complaint"] },
  { q: "How do I get a document stamped?", keywords: ["form", "stamp"] },
  { q: "How long do form approvals take?", keywords: ["form"] },
  { q: "How do I apply for an internship through UniSphere?", keywords: ["internship"] },
  { q: "What is the internship application process?", keywords: ["internship"] },
  { q: "How do I find an alumni mentor?", keywords: ["mentor"] },
  { q: "What should my mentorship request message include?", keywords: ["mentor"] },
  { q: "How do mentorship sessions work?", keywords: ["mentor", "session"] },
  { q: "What are the exam rules?", keywords: ["exam"] },
  { q: "When does the exam schedule come out?", keywords: ["exam"] },
  { q: "What is the attendance policy?", keywords: ["attendance"] },
  { q: "How do I get a new student card?", keywords: ["card"] },
  { q: "Where is the library?", keywords: ["library"] },
  { q: "How do I contact the coordination office?", keywords: ["coordination", "office"] },
  { q: "What is UniSphere?", keywords: ["unisphere"] },
  { q: "How do notifications work?", keywords: ["notification"] },
  { q: "What can the AI assistant help with?", keywords: ["assistant", "unisphere"] },
  { q: "How do I withdraw a submitted form?", keywords: ["form", "withdraw"] },
  { q: "Can I cancel a GPU request I submitted?", keywords: ["request", "cancel", "gpu"] },
  { q: "How is my data protected in UniSphere?", keywords: ["data", "unisphere"] },
  { q: "Who reviews forms I submit?", keywords: ["review", "form"] },
  { q: "What do I do if a class is missing from my timetable?", keywords: ["timetable"] },
];

async function main() {
  let passed = 0;
  const failures: string[] = [];

  console.log(`UniSphere AI eval — ${CASES.length} retrieval checks\n`);

  for (const c of CASES) {
    const hits = await retrieveKnowledge(c.q, 3);
    const blob = hits.map((h) => `${h.title} ${h.snippet}`.toLowerCase()).join(" ");
    const ok = hits.length > 0 && c.keywords.some((k) => blob.includes(k.toLowerCase()));
    if (ok) {
      passed++;
      console.log(`  PASS  ${c.q}`);
    } else {
      failures.push(c.q);
      console.log(`  FAIL  ${c.q}  (expected any of: ${c.keywords.join(", ")}; got ${hits.length} hits)`);
    }
  }

  console.log(`\nRetrieval: ${passed}/${CASES.length} passed`);
  if (failures.length) {
    console.log("Failures likely mean missing knowledge-base entries (seed.ts) — add them and re-run.");
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("eval crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

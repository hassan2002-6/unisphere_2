import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";

/**
 * Retrieval (plan M5): university knowledge corpus via Postgres FTS, plus a
 * small per-student context block (schedule, allocations, notifications).
 * Every retrieve* is failure-tolerant — a dead DB yields zero sources, never
 * a crash.
 */

export type Source = { title: string; source: string; snippet: string };

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "do", "does", "did", "how", "what",
  "when", "where", "who", "why", "which", "can", "could", "should", "would", "will", "my", "me",
  "i", "you", "we", "it", "its", "this", "that", "these", "those", "for", "of", "to", "in", "on",
  "at", "by", "with", "about", "and", "or", "if", "then", "than", "there", "here", "get", "got",
  "have", "has", "had", "but", "not", "no", "yes", "from", "as", "so", "up", "out", "into", "over",
]);

/**
 * Knowledge corpus search — websearch_to_tsquery over title+content (GIN index).
 *
 * Natural-language questions must not AND their words (that matches nothing):
 * tokens are stripped of stopwords/punctuation and OR-ed, then ranked by
 * ts_rank. Falls back to an ILIKE scan when FTS still finds nothing.
 */
export async function retrieveKnowledge(query: string, limit = 5): Promise<Source[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const tokens = Array.from(
    new Set(
      q
        .toLowerCase()
        .split(/[^a-z0-9.+-]+/)
        .map((t) => t.replace(/^[.+-]+|[.+-]+$/g, ""))
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
    ),
  ).slice(0, 10);

  try {
    if (tokens.length > 0) {
      const orQuery = tokens.join(" OR ");
      const rows = await prisma.$queryRaw<{ title: string; source: string; snippet: string }[]>`
        SELECT "title",
               "source",
               LEFT("content", 400) AS "snippet"
        FROM "KnowledgeDoc"
        WHERE to_tsvector('english', "title" || ' ' || "content") @@ websearch_to_tsquery('english', ${orQuery})
        ORDER BY ts_rank(
                   setweight(to_tsvector('english', "title"), 'A') ||
                   setweight(to_tsvector('english', "content"), 'B'),
                   websearch_to_tsquery('english', ${orQuery})
                 ) DESC
        LIMIT ${limit}
      `;
      if (rows.length > 0) return rows;
    }

    // ILIKE fallback (accent/short-word queries that FTS tokenisation drops).
    const needle = `%${q.replace(/[%_]/g, "")}%`;
    const first = tokens[0] ?? q;
    return await prisma.$queryRaw<{ title: string; source: string; snippet: string }[]>`
      SELECT "title",
             "source",
             LEFT("content", 400) AS "snippet"
      FROM "KnowledgeDoc"
      WHERE "content" ILIKE ${needle} OR "title" ILIKE ${needle} OR "content" ILIKE ${`%${first}%`}
      LIMIT ${limit}
    `;
  } catch {
    return [];
  }
}

/** Small personal context block for the signed-in user. Empty on any failure. */
export async function retrievePersonalContext(user: User): Promise<string[]> {
  const lines: string[] = [];
  try {
    const now = new Date();

    if (user.role === "STUDENT") {
      const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
      const where: { section?: string; department?: string } = {};
      if (profile?.section) where.section = profile.section;
      if (user.department) where.department = user.department;
      const classes = await prisma.courseClass.findMany({
        where,
        include: { slots: { orderBy: [{ day: "asc" }, { startMin: "asc" }] } },
        take: 30,
      });

      // "Now" in Asia/Karachi (UTC+5, no DST).
      const karachi = new Date(now.getTime() + 5 * 3600 * 1000);
      const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
      const dayOfWeek = DAYS[(karachi.getUTCDay() + 6) % 7]; // Mon=0 … Sat=5
      const nowMin = karachi.getUTCHours() * 60 + karachi.getUTCMinutes();
      const label = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

      const todays = classes
        .flatMap((c) => c.slots.filter((s) => s.day === dayOfWeek && s.endMin >= nowMin).map((s) => ({ c, s })))
        .sort((a, b) => a.s.startMin - b.s.startMin)
        .slice(0, 3);
      for (const { c, s } of todays) {
        lines.push(
          `Today ${label(s.startMin)}–${label(s.endMin)}: ${c.courseCode} ${c.title} (${c.section}) in ${s.room ?? "room TBA"}`,
        );
      }
      if (todays.length === 0) {
        const dayIdx = DAYS.indexOf(dayOfWeek);
        for (let step = 1; step <= 6 && lines.length === 0; step++) {
          const day = DAYS[(dayIdx + step) % DAYS.length];
          const next = classes
            .flatMap((c) => c.slots.filter((s) => s.day === day).map((s) => ({ c, s })))
            .sort((a, b) => a.s.startMin - b.s.startMin)
            .slice(0, 2);
          for (const { c, s } of next) {
            lines.push(`Next class ${day} ${label(s.startMin)}–${label(s.endMin)}: ${c.courseCode} ${c.title} (${c.section})`);
          }
        }
      }
    }

    const [openForms, allocations, unread, myFyp, requests] = await Promise.all([
      prisma.formSubmission.count({ where: { submittedById: user.id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.allocation.findMany({
        where: { request: { applicantId: user.id }, status: "ACTIVE" },
        take: 3,
        include: { resource: true },
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      prisma.fypApplication.findMany({
        where: { applicantId: user.id },
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { title: true, status: true },
      }),
      prisma.resourceRequest.findMany({
        where: { applicantId: user.id, status: { in: ["PENDING", "RECOMMENDED"] } },
        take: 3,
        select: { projectName: true, status: true },
      }),
    ]);

    if (openForms > 0) lines.push(`${openForms} of your form submissions are still open.`);
    for (const a of allocations) {
      lines.push(`Active allocation: ${a.resource.name} until ${a.endDate.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })}.`);
    }
    if (unread > 0) lines.push(`${unread} unread notifications.`);
    for (const f of myFyp) lines.push(`Your FYP application "${f.title}" is ${f.status.toLowerCase()}.`);
    for (const r of requests) lines.push(`Your resource request "${r.projectName}" is ${r.status.toLowerCase()}.`);
  } catch {
    return [];
  }
  return lines;
}

export function buildSystemPrompt(personalLines: string[], sources: Source[]): string {
  const knowledgeBlock = sources.length
    ? sources.map((s, i) => `[${i + 1}] ${s.title} (${s.source})\n${s.snippet}`).join("\n\n")
    : "(no matching knowledge-base entries)";
  const personalBlock = personalLines.length ? personalLines.map((l) => `- ${l}`).join("\n") : "(no personal data available)";

  return [
    "You are the UniSphere assistant for Salim Habib University students.",
    "Answer questions about timetables, exams, forms, complaints, FYP, GPU/lab resources, internships and mentorship.",
    "GROUNDING RULES:",
    "- Use ONLY the KNOWLEDGE BASE and PERSONAL CONTEXT below. If the answer is not there, say you don't have that information and point to the coordination office or the relevant portal page.",
    "- Never invent dates, deadlines, or policy. Cite knowledge-base entries as [1], [2] when you use them.",
    "- Keep answers short and practical (under 180 words), in plain text.",
    "",
    "KNOWLEDGE BASE:",
    knowledgeBlock,
    "",
    "PERSONAL CONTEXT (about the current student):",
    personalBlock,
  ].join("\n");
}

/**
 * SHU public-information knowledge-base seed (goal §14 — ground the AI
 * assistant in verified official SHU facts).
 *
 * Every fact below was read from the live official university website
 * (https://www.shu.edu.pk/ — homepage footer "Contact Info", plus the
 * /admission/ and /programs/ pages), or describes this portal's own
 * assistant scope. Nothing is invented: no email addresses, fees, deadlines
 * or policies are stated that the official site does not publish.
 *
 * Idempotent: each document is matched and updated by title — re-running
 * updates the same rows in place and never creates duplicates.
 *
 * Run:  bun run scripts/seed-shu-kb.ts        (from apps/web)
 */

import { prisma } from "@unisphere/db";

type DocSeed = { title: string; source: string; content: string; tags: string[] };

const DOCS: DocSeed[] = [
  {
    title: "SHU Campus & Contact Information",
    source: "SHU official website (https://www.shu.edu.pk/)",
    tags: ["shu", "contact", "campus"],
    content: [
      "Salim Habib University (SHU) campus & contact details, from the university's official website (https://www.shu.edu.pk/).",
      "",
      "Campus address: NC-24, Deh Dih, Dr. Salim Habib Road, Korangi Creek, Karachi 74900, Pakistan. The campus is located in Korangi Creek, Karachi.",
      "",
      "Contact phone numbers: admissions 021-35122936; main line 021-111-248-338; landline 021-35122931-5; WhatsApp 03162754504.",
      "",
      "These details come from the official SHU website and can change — for anything official (admissions, deadlines, policies) verify with the university office, or check https://www.shu.edu.pk/ directly.",
      "",
      "source: https://www.shu.edu.pk/",
    ].join("\n"),
  },
  {
    title: "SHU Faculties & Programs",
    source: "SHU official website — programs page (https://www.shu.edu.pk/programs/)",
    tags: ["shu", "programs", "faculties"],
    content: [
      "Salim Habib University (SHU) lists five faculties on its official website (https://www.shu.edu.pk/):",
      "- Faculty of Engineering",
      "- Faculty of Information Technology",
      "- Faculty of Management Sciences",
      "- Faculty of Science",
      "- Faculty of Pharmacy",
      "",
      "The official programs page (https://www.shu.edu.pk/programs/) lists undergraduate, graduate and doctoral programs. Examples: BS Computer Science, BS Software Engineering, BS Artificial Intelligence, BS Robotics and Intelligent Systems, BS(Cyber Security), BS Data Science, BS Accounting & Finance, Bachelor of Business Administration (BBA), PharmD (Faculty of Pharmacy), BS Biosciences, BS Biotechnology, MS Computer Science, MS Management Science, MBA, MS Public Health, and Ph.D. Computer Science.",
      "",
      "The official website holds the complete, current catalogue — check https://www.shu.edu.pk/programs/ for the authoritative list, and verify admission requirements and deadlines with the university office.",
      "",
      "source: https://www.shu.edu.pk/",
    ].join("\n"),
  },
  {
    title: "UniSphere Assistant — What It Can and Cannot Answer",
    source: "UniSphere assistant scope (this portal)",
    tags: ["shu", "assistant", "scope"],
    content: [
      "UniSphere assistant — what it can and cannot answer, and when to contact the university office.",
      "",
      "It cannot answer questions not covered by the knowledge base — such as admissions requirements and deadlines, tuition and fee amounts, undocumented policies — nor share another student's private records: marks, attendance, complaints. Students can only access their own records.",
      "",
      "It can help with: timetables and classes, exam schedules, forms and their status, complaints, FYP applications, GPU and lab resources, internships, mentorship, notifications, the SHU information in this knowledge base (campus address, contact numbers), and where to find official admission and program information.",
      "",
      "Contact the university office for anything outside this scope, and always verify time-sensitive information with the university before relying on it.",
    ].join("\n"),
  },
];

async function main() {
  console.log("── SHU knowledge-base seed ─────────────────────");

  for (const doc of DOCS) {
    const existing = await prisma.knowledgeDoc.findFirst({ where: { title: doc.title } });
    if (existing) {
      await prisma.knowledgeDoc.update({
        where: { id: existing.id },
        data: { source: doc.source, content: doc.content, tags: doc.tags, isArchived: false },
      });
      console.log(`✓ updated  ${doc.title}`);
    } else {
      await prisma.knowledgeDoc.create({ data: doc });
      console.log(`✓ created  ${doc.title}`);
    }
  }

  // Idempotency guard — after a run there must be exactly one live row per title.
  const total = await prisma.knowledgeDoc.count({
    where: { title: { in: DOCS.map((d) => d.title) }, isArchived: false },
  });
  console.log(`── done: ${total}/${DOCS.length} SHU knowledge docs in place ──`);
  if (total !== DOCS.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

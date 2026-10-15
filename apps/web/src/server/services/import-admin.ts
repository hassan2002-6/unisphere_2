import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "./audit";
import { ServiceError } from "./forms";

/**
 * Validated CSV import for the records the office enters by hand (spec §C/§10):
 * students, faculty and course sections. Column headers are fixed; every row is
 * validated before anything is written, and per-row failures are reported with
 * their line numbers instead of aborting the whole file.
 */

export type ImportEntity = "students" | "faculty" | "courses";

export const IMPORT_COLUMNS: Record<ImportEntity, string[]> = {
  students: ["name", "email", "registrationNo", "program", "batch", "semester", "section"],
  faculty: ["name", "email", "employeeId", "designation", "office", "department"],
  courses: ["courseCode", "title", "section", "department", "semester", "credits", "facultyEmail"],
};

export const IMPORT_HELP: Record<ImportEntity, string> = {
  students: "Institutional email + student registration number; program like BSCS, batch like 2022, semester 1–12.",
  faculty: "Institutional email + employee ID; designation like Lecturer / Assistant Professor.",
  courses: "One row per section. facultyEmail must match an existing faculty account (or leave blank).",
};

export function templateCsv(entity: ImportEntity): string {
  const columns = IMPORT_COLUMNS[entity];
  if (!columns) throw new Error(`Unknown import entity: ${entity}`);
  const header = columns.join(",");
  const samples: Record<ImportEntity, string[]> = {
    students: [
      "Ayesha Khan,ayesha.khan@shu.edu.pk,S23CSC001,BSCS,2023,3,A",
      "Bilal Ahmed,bilal.ahmed@shu.edu.pk,S23CSC002,BSCS,2023,3,B",
    ],
    faculty: [
      "Dr. Imran Ali,imran.ali@shu.edu.pk,FAC005,Assistant Professor,C-214,Computer Science",
      "Ms. Hina Raza,hina.raza@shu.edu.pk,FAC006,Lecturer,C-215,Computer Science",
    ],
    courses: [
      "CS-306,Operating Systems,A,Computer Science,Spring 2026,3,imran.ali@shu.edu.pk",
      "CS-310,Computer Networks,B,Computer Science,Spring 2026,3,",
    ],
  };
  return [header, ...samples[entity]].join("\n");
}

/** Minimal RFC-4180-ish CSV parser (quotes, embedded commas, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export type ImportRowError = { line: number; message: string };
export type ImportReport = {
  entity: ImportEntity;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertImporter(user: User) {
  if (!can(user.role, "users.manage")) throw new ServiceError("forbidden", "Only administrators import records", 403);
}

export async function importCsv(user: User, entity: ImportEntity, csvText: string): Promise<ImportReport> {
  assertImporter(user);
  if (!Object.hasOwn(IMPORT_COLUMNS, entity)) throw new ServiceError("validation_error", "Unknown import type", 422);

  const rows = parseCsv(csvText.slice(0, 2_000_000));
  if (rows.length < 2) throw new ServiceError("validation_error", "The CSV needs a header row and at least one record", 422);

  const header = rows[0].map((h) => h.trim());
  const missing = IMPORT_COLUMNS[entity].filter((c) => !header.includes(c));
  if (missing.length) {
    throw new ServiceError("validation_error", `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")} — use the template`, 422);
  }
  const idx = Object.fromEntries(IMPORT_COLUMNS[entity].map((c) => [c, header.indexOf(c)]));
  const get = (r: string[], col: string) => (r[idx[col]] ?? "").trim();

  const report: ImportReport = { entity, created: 0, updated: 0, skipped: 0, errors: [] };
  if (rows.length - 1 > 500) throw new ServiceError("validation_error", "Import at most 500 rows at a time", 422);

  for (let r = 1; r < rows.length; r++) {
    const line = r + 1; // 1-based file line, header included
    const row = rows[r];
    try {
      if (entity === "students") {
        const name = get(row, "name");
        const email = get(row, "email").toLowerCase();
        const registrationNo = get(row, "registrationNo");
        const program = get(row, "program") || "BSCS";
        const batch = get(row, "batch") || null;
        const semesterRaw = get(row, "semester");
        const section = get(row, "section") || null;
        if (!name) throw new Error("name is required");
        if (!EMAIL_RE.test(email)) throw new Error(`“${email || "(empty)"}” is not a valid email`);
        if (!registrationNo) throw new Error("registrationNo is required");
        const semester = semesterRaw ? Number(semesterRaw) : null;
        if (semesterRaw && (!Number.isInteger(semester) || semester! < 1 || semester! > 12)) throw new Error("semester must be 1–12");

        const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
        if (existing && existing.role !== "STUDENT") throw new Error(`email belongs to a ${existing.role} account — not overwritten`);
        const taken = await prisma.user.findFirst({ where: { registrationNo, NOT: existing ? { id: existing.id } : undefined }, select: { email: true } });
        if (taken) throw new Error(`registrationNo ${registrationNo} is already assigned to ${taken.email}`);

        if (existing) {
          await prisma.$transaction([
            prisma.user.update({ where: { id: existing.id }, data: { name, registrationNo } }),
            prisma.studentProfile.upsert({
              where: { userId: existing.id },
              create: { userId: existing.id, program, batch, semester, section },
              update: { program, batch, semester, section },
            }),
          ]);
          report.updated++;
        } else {
          await prisma.user.create({
            data: {
              clerkId: `pending:${crypto.randomUUID()}`,
              email,
              name,
              role: "STUDENT",
              registrationNo,
              studentProfile: { create: { program, batch, semester, section } },
            },
          });
          report.created++;
        }
      } else if (entity === "faculty") {
        const name = get(row, "name");
        const email = get(row, "email").toLowerCase();
        const employeeId = get(row, "employeeId");
        const designation = get(row, "designation") || null;
        const office = get(row, "office") || null;
        const department = get(row, "department") || null;
        if (!name) throw new Error("name is required");
        if (!EMAIL_RE.test(email)) throw new Error(`“${email || "(empty)"}” is not a valid email`);
        if (!employeeId) throw new Error("employeeId is required");

        const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
        if (existing && existing.role !== "FACULTY") throw new Error(`email belongs to a ${existing.role} account — not overwritten`);
        const taken = await prisma.user.findFirst({ where: { employeeId, NOT: existing ? { id: existing.id } : undefined }, select: { email: true } });
        if (taken) throw new Error(`employeeId ${employeeId} is already assigned to ${taken.email}`);

        if (existing) {
          await prisma.$transaction([
            prisma.user.update({ where: { id: existing.id }, data: { name, employeeId, department } }),
            prisma.facultyProfile.upsert({
              where: { userId: existing.id },
              create: { userId: existing.id, designation, office },
              update: { designation, office },
            }),
          ]);
          report.updated++;
        } else {
          await prisma.user.create({
            data: {
              clerkId: `pending:${crypto.randomUUID()}`,
              email,
              name,
              role: "FACULTY",
              employeeId,
              department,
              facultyProfile: { create: { designation, office } },
            },
          });
          report.created++;
        }
      } else {
        const courseCode = get(row, "courseCode");
        const title = get(row, "title");
        const section = get(row, "section");
        const department = get(row, "department") || "Computer Science";
        const semester = get(row, "semester");
        const creditsRaw = get(row, "credits");
        const facultyEmail = get(row, "facultyEmail").toLowerCase();
        if (!courseCode) throw new Error("courseCode is required");
        if (!title) throw new Error("title is required");
        if (!section) throw new Error("section is required");
        if (!semester) throw new Error("semester is required (e.g. “Spring 2026”)");
        const credits = creditsRaw ? Number(creditsRaw) : null;
        if (creditsRaw && (!Number.isInteger(credits) || credits! < 0 || credits! > 10)) throw new Error("credits must be 0–10");

        let facultyId: string | null = null;
        if (facultyEmail) {
          const fac = await prisma.user.findUnique({ where: { email: facultyEmail }, select: { id: true, role: true } });
          if (!fac || fac.role !== "FACULTY") throw new Error(`facultyEmail “${facultyEmail}” does not match an existing faculty account`);
          facultyId = fac.id;
        }

        const existingClass = await prisma.courseClass.findFirst({ where: { courseCode, section }, select: { id: true } });
        if (existingClass) {
          await prisma.courseClass.update({
            where: { id: existingClass.id },
            data: { title, department, semester, credits, ...(facultyId ? { facultyId } : {}) },
          });
          report.updated++;
        } else {
          await prisma.courseClass.create({ data: { courseCode, title, section, department, semester, credits, facultyId } });
          report.created++;
        }
      }
    } catch (e) {
      report.skipped++;
      report.errors.push({ line, message: e instanceof Error ? e.message : "unknown error" });
    }
  }

  await recordAudit({
    actorId: user.id,
    action: "admin.import",
    entity: "Import",
    entityId: entity,
    summary: `Imported ${entity}: ${report.created} created, ${report.updated} updated, ${report.skipped} skipped`,
  });
  return report;
}

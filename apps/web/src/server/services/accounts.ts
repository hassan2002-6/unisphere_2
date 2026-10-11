import { prisma } from "@/lib/db";
import type { Role, User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "./audit";
import { ServiceError } from "./forms";
import {
  ClerkAdminError,
  clerkConfigured,
  createClerkSignInToken,
  findClerkUserByEmail,
  getClerkAuthSummary,
  inviteClerkUser,
  setClerkBanned,
} from "@/server/clerk-admin";

/**
 * Account lifecycle service (spec §4 institutional IDs, §5 user management).
 *
 * One institution ID scheme for every role — students S22CSC001…, staff
 * FAC001 / COORD001 / FYP001 / ADMIN001 / ALU001. The DB row stays the source
 * of truth for role; Clerk provides identity + credentials only.
 */

const PROGRAM_PREFIX: Record<string, string> = {
  BSCS: "CSC",
  BSSE: "SE",
  BSAI: "AI",
  BSCY: "CY",
  BBA: "BBA",
};

type IdField = "registrationNo" | "employeeId";

function idPrefixFor(role: Role, program = "BSCS", batch = "2022"): string {
  switch (role) {
    case "STUDENT": {
      const yy = /^20\d\d$/.test(batch) ? batch.slice(2) : "22";
      return `S${yy}${PROGRAM_PREFIX[program.toUpperCase()] ?? "CSC"}`;
    }
    case "FACULTY":
      return "FAC";
    case "COORDINATOR":
      return "COORD";
    case "FYP_HEAD":
      return "FYP";
    case "ADMIN":
      return "ADMIN";
    case "MENTOR":
      return "ALU";
    default:
      return "EMP";
  }
}

/** Next free institutional ID for the role (e.g. S22CSC011, FAC004). */
export async function nextInstitutionalId(role: Role, program = "BSCS", batch = "2022"): Promise<string> {
  const prefix = idPrefixFor(role, program, batch);
  const field: IdField = role === "STUDENT" ? "registrationNo" : "employeeId";
  const rows = await prisma.user.findMany({
    where: { [field]: { startsWith: prefix } },
    select: { registrationNo: true, employeeId: true },
  });
  let max = 0;
  for (const row of rows) {
    const value = (role === "STUDENT" ? row.registrationNo : row.employeeId) ?? "";
    const m = /(\d+)\s*$/.exec(value);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * Login screen support (§4): resolve a University ID (or email) to the linked
 * account email so Clerk can authenticate it. Inactive accounts never resolve.
 */
export async function resolveLoginIdentifier(
  identifier: string,
): Promise<{ email: string; name: string } | null> {
  const value = identifier.trim();
  if (!value) return null;
  const byEmail = value.includes("@");
  const user = await prisma.user.findFirst({
    where: byEmail
      ? { email: value.toLowerCase() }
      : {
          OR: [
            { registrationNo: { equals: value, mode: "insensitive" } },
            { employeeId: { equals: value, mode: "insensitive" } },
          ],
        },
    select: { email: true, name: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { email: user.email, name: user.name };
}

export type SignInMethod = "password" | "google" | "unknown";

/**
 * Which credential does this account actually have? University accounts are
 * provisioned with a password (invitation → the holder sets it); accounts
 * created through Google have no password at all and can only use the Google
 * button. The sign-in form asks before showing a raw error (spec §4).
 */
export async function signInHintFor(identifier: string): Promise<SignInMethod | null> {
  const base = await resolveLoginIdentifier(identifier);
  if (!base) return null;
  if (!clerkConfigured()) return "unknown";
  try {
    const summary = await getClerkAuthSummary(base.email);
    if (!summary) return "unknown";
    if (summary.passwordEnabled) return "password";
    return summary.googleLinked ? "google" : "unknown";
  } catch {
    return "unknown";
  }
}

export type CreateAccountInput = {
  name: string;
  email: string;
  role: Role;
  department?: string;
  institutionalId?: string;
  /** Students */
  program?: string;
  batch?: string;
  semester?: number;
  section?: string;
  /** Faculty */
  designation?: string;
  office?: string;
  /** Test/automation: create the DB row without contacting Clerk. */
  skipInvitation?: boolean;
};

function requireUsersManage(actor: User) {
  if (!can(actor.role, "users.manage")) {
    throw new ServiceError("forbidden", "Only administrators can manage accounts", 403);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateAccountResult = {
  userId: string;
  institutionalId: string;
  invitation: "sent" | "failed" | "skipped";
  invitationNote?: string;
};

/** Admin: create an account + DB row, then invite the holder through Clerk. */
export async function createAccount(actor: User, input: CreateAccountInput): Promise<CreateAccountResult> {
  requireUsersManage(actor);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 3) throw new ServiceError("validation_error", "Enter the full name", 422);
  if (!EMAIL_RE.test(email)) throw new ServiceError("validation_error", "Enter a valid email address", 422);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ServiceError("duplicate", `${email} already has an account`, 409);

  const institutionalId =
    input.institutionalId?.trim() || (await nextInstitutionalId(input.role, input.program, input.batch));

  const clash = await prisma.user.findFirst({
    where:
      input.role === "STUDENT"
        ? { registrationNo: { equals: institutionalId, mode: "insensitive" } }
        : { employeeId: { equals: institutionalId, mode: "insensitive" } },
  });
  if (clash) throw new ServiceError("duplicate", `University ID ${institutionalId} is already in use`, 409);

  const user = await prisma.user.create({
    data: {
      clerkId: `pending:${crypto.randomUUID()}`,
      email,
      name,
      role: input.role,
      department: input.department?.trim() || null,
      registrationNo: input.role === "STUDENT" ? institutionalId : null,
      employeeId: input.role === "STUDENT" ? null : institutionalId,
      ...(input.role === "STUDENT"
        ? {
            studentProfile: {
              create: {
                program: input.program?.trim() || "BSCS",
                batch: input.batch?.trim() || null,
                semester: input.semester ?? null,
                section: input.section?.trim() || null,
              },
            },
          }
        : {}),
      ...(input.role === "FACULTY"
        ? {
            facultyProfile: {
              create: {
                designation: input.designation?.trim() || null,
                office: input.office?.trim() || null,
              },
            },
          }
        : {}),
    },
  });

  // Secure activation: invitation email → the holder sets their own password.
  let invitation: CreateAccountResult["invitation"] = "skipped";
  let invitationNote: string | undefined;
  if (input.skipInvitation) {
    invitationNote = "Invitation skipped (automation)";
  } else if (clerkConfigured()) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
      await inviteClerkUser(email, `${base}/sign-in`);
      invitation = "sent";
    } catch (e) {
      invitation = "failed";
      invitationNote = e instanceof ClerkAdminError ? e.message : "Clerk request failed";
    }
  } else {
    invitationNote = "CLERK_SECRET_KEY is not configured on this deployment";
  }

  await recordAudit({
    actorId: actor.id,
    action: "account.create",
    entity: "User",
    entityId: user.id,
    summary: `Created ${input.role} account ${institutionalId} (${email})`,
    meta: { role: input.role, institutionalId, invitation },
  });

  return { userId: user.id, institutionalId, invitation, invitationNote };
}

/** Admin: activate / deactivate. Deactivation also blocks Clerk sign-in. */
export async function setAccountActive(actor: User, userId: string, active: boolean): Promise<void> {
  requireUsersManage(actor);
  if (actor.id === userId) throw new ServiceError("forbidden", "You cannot change your own account status", 400);

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new ServiceError("not_found", "Account not found", 404);

  await prisma.user.update({ where: { id: userId }, data: { isActive: active } });

  let clerkNote = "";
  if (clerkConfigured() && !target.clerkId.startsWith("pending:")) {
    try {
      await setClerkBanned(target.clerkId, !active);
    } catch (e) {
      clerkNote = e instanceof ClerkAdminError ? ` · Clerk: ${e.message}` : " · Clerk update failed";
    }
  }

  await recordAudit({
    actorId: actor.id,
    action: active ? "account.activate" : "account.deactivate",
    entity: "User",
    entityId: userId,
    summary: `${active ? "Activated" : "Deactivated"} ${target.email}${clerkNote}`,
  });
}

/**
 * Admin-assisted recovery: mint a single-use sign-in ticket for the account
 * holder. The ticket is shown once in the admin UI (never logged, never
 * emailed by us) and expires in 15 minutes.
 */
export async function initiateAccountRecovery(actor: User, userId: string): Promise<{ url: string }> {
  requireUsersManage(actor);
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new ServiceError("not_found", "Account not found", 404);
  if (!clerkConfigured()) throw new ServiceError("not_configured", "CLERK_SECRET_KEY is not configured", 500);
  if (target.clerkId.startsWith("pending:")) {
    throw new ServiceError(
      "not_activated",
      "This account was never activated — send a new invitation instead",
      409,
    );
  }

  const clerkUser = await findClerkUserByEmail(target.email);
  if (!clerkUser) throw new ServiceError("not_found", "No Clerk account for this email", 404);

  const token = await createClerkSignInToken(clerkUser.id, 900);
  await recordAudit({
    actorId: actor.id,
    action: "account.recovery_ticket",
    entity: "User",
    entityId: userId,
    summary: `Issued a single-use recovery link for ${target.email}`,
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return { url: `${base}/sign-in?ticket=${encodeURIComponent(token)}` };
}

/** Admin: correct permitted account information (role stays out of this call). */
export type AccountInfoInput = {
  name?: string;
  department?: string;
  semester?: number | null;
  section?: string | null;
  batch?: string | null;
  program?: string;
  designation?: string | null;
  office?: string | null;
};

export async function updateAccountInfo(actor: User, userId: string, input: AccountInfoInput): Promise<void> {
  requireUsersManage(actor);
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true, facultyProfile: true },
  });
  if (!target) throw new ServiceError("not_found", "Account not found", 404);

  const changed: string[] = [];
  const userData: Record<string, string | null> = {};
  if (input.name?.trim() && input.name.trim() !== target.name) {
    userData.name = input.name.trim();
    changed.push("name");
  }
  if (input.department !== undefined && (input.department.trim() || null) !== target.department) {
    userData.department = input.department.trim() || null;
    changed.push("department");
  }
  if (Object.keys(userData).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: userData });
  }

  if (target.role === "STUDENT" && target.studentProfile) {
    const profileData: Record<string, string | number | null> = {};
    if (input.semester !== undefined && input.semester !== target.studentProfile.semester) {
      profileData.semester = input.semester;
      changed.push("semester");
    }
    if (input.section !== undefined && (input.section?.trim() || null) !== target.studentProfile.section) {
      profileData.section = input.section?.trim() || null;
      changed.push("section");
    }
    if (input.batch !== undefined && (input.batch?.trim() || null) !== target.studentProfile.batch) {
      profileData.batch = input.batch?.trim() || null;
      changed.push("batch");
    }
    if (input.program?.trim() && input.program.trim() !== target.studentProfile.program) {
      profileData.program = input.program.trim();
      changed.push("program");
    }
    if (Object.keys(profileData).length > 0) {
      await prisma.studentProfile.update({ where: { userId }, data: profileData });
    }
  }

  if (target.role === "FACULTY" && target.facultyProfile) {
    const profileData: Record<string, string | null> = {};
    if (input.designation !== undefined && (input.designation?.trim() || null) !== target.facultyProfile.designation) {
      profileData.designation = input.designation?.trim() || null;
      changed.push("designation");
    }
    if (input.office !== undefined && (input.office?.trim() || null) !== target.facultyProfile.office) {
      profileData.office = input.office?.trim() || null;
      changed.push("office");
    }
    if (Object.keys(profileData).length > 0) {
      await prisma.facultyProfile.update({ where: { userId }, data: profileData });
    }
  }

  if (changed.length === 0) throw new ServiceError("no_changes", "Nothing changed", 400);

  await recordAudit({
    actorId: actor.id,
    action: "account.update",
    entity: "User",
    entityId: userId,
    summary: `Updated ${target.email}: ${changed.join(", ")}`,
    meta: { changed },
  });
}

/** Everything that ever happened to this account (spec §5 "account history"). */
export async function listAccountHistory(userId: string, take = 40) {
  return prisma.auditLog.findMany({
    where: { OR: [{ entityId: userId }, { actorId: userId }] },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { name: true, email: true, role: true } } },
  });
}

export type CsvImportRow = {
  line: number;
  email: string;
  name: string;
  role: string;
  institutionalId: string;
};

export type CsvImportResult = { created: CsvImportRow[]; failed: (CsvImportRow & { reason: string })[] };

const VALID_ROLES = new Set(["STUDENT", "FACULTY", "COORDINATOR", "FYP_HEAD", "ADMIN", "MENTOR"]);

/** Minimal RFC-4180-ish split (quotes + doubled quotes), one row per line. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * CSV bulk import (§5). Expected header:
 * name,email,role[,department,program,batch,semester,section,institutional_id]
 * Each row is validated and created independently; per-row results are returned.
 */
export async function importAccountsFromCsv(actor: User, csvText: string): Promise<CsvImportResult> {
  requireUsersManage(actor);
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new ServiceError("validation_error", "CSV needs a header row and at least one data row", 422);

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const col = (cells: string[], name: string) => {
    const idx = header.indexOf(name);
    return idx >= 0 ? (cells[idx] ?? "") : "";
  };

  const created: CsvImportRow[] = [];
  const failed: (CsvImportRow & { reason: string })[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const role = col(cells, "role").toUpperCase();
    const row: CsvImportRow = {
      line: i + 1,
      email: col(cells, "email").toLowerCase(),
      name: col(cells, "name"),
      role,
      institutionalId: col(cells, "institutional_id") || col(cells, "id"),
    };
    if (!VALID_ROLES.has(role)) {
      failed.push({ ...row, reason: `Unknown role "${row.role || "(blank)"}"` });
      continue;
    }
    try {
      const result = await createAccount(actor, {
        name: row.name,
        email: row.email,
        role: role as Role,
        department: col(cells, "department") || undefined,
        program: col(cells, "program") || undefined,
        batch: col(cells, "batch") || undefined,
        semester: col(cells, "semester") ? Number.parseInt(col(cells, "semester"), 10) : undefined,
        section: col(cells, "section") || undefined,
        designation: col(cells, "designation") || undefined,
        office: col(cells, "office") || undefined,
        institutionalId: row.institutionalId || undefined,
      });
      created.push({ ...row, institutionalId: result.institutionalId });
    } catch (e) {
      failed.push({ ...row, reason: e instanceof ServiceError ? e.message : "Unexpected error" });
    }
  }

  await recordAudit({
    actorId: actor.id,
    action: "account.import",
    entity: "User",
    summary: `CSV import: ${created.length} created, ${failed.length} failed`,
    meta: { created: created.length, failed: failed.length },
  });

  return { created, failed };
}

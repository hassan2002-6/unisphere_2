"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { recordAudit } from "@/server/services/audit";
import { notifyUser } from "@/server/services/notifications";
import {
  createAccount,
  importAccountsFromCsv,
  initiateAccountRecovery,
  setAccountActive,
  updateAccountInfo,
} from "@/server/services/accounts";
import { ServiceError } from "@/server/services/forms";

const ROLES: Role[] = ["STUDENT", "FACULTY", "COORDINATOR", "FYP_HEAD", "MENTOR", "ADMIN"];

/**
 * Role changes are admin-only (users.manage). The new role is validated
 * against the six real values, self-changes are refused, and every accepted
 * change is audited and announced to the affected user.
 */
export async function roleChangeAction(formData: FormData) {
  const me = await requireCapability("users.manage");

  const userId = String(formData.get("userId") ?? "").trim();
  const newRole = String(formData.get("role") ?? "").trim() as Role;

  if (!userId || !ROLES.includes(newRole)) {
    redirect(`/admin/users?error=${encodeURIComponent("Pick a valid role.")}`);
  }

  if (userId === me.id) {
    redirect(`/admin/users?error=${encodeURIComponent("You cannot change your own role.")}`);
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    redirect(`/admin/users?error=${encodeURIComponent("That account no longer exists.")}`);
  }

  if (target.role === newRole) {
    redirect("/admin/users");
  }

  try {
    await prisma.user.update({ where: { id: target.id }, data: { role: newRole } });
  } catch (error) {
    console.error("role change failed:", error);
    redirect(`/admin/users?error=${encodeURIComponent("Could not update the role — try again.")}`);
  }

  await recordAudit({
    actorId: me.id,
    action: "user.role",
    entity: "User",
    entityId: target.id,
    summary: `Changed role of ${target.name} to ${newRole}`,
  });

  // Best-effort: the role is already changed even if the notification write fails.
  try {
    await notifyUser(target.id, {
      type: "SYSTEM",
      title: "Your portal role changed",
      body: `Your role was changed from ${ROLE_LABELS[target.role]} to ${ROLE_LABELS[newRole]}. Your navigation and permissions update automatically.`,
      link: "/dashboard",
    });
  } catch (notifyError) {
    console.error("role change notify failed:", notifyError);
  }

  revalidatePath("/admin/users");
  redirect(`/admin/users?changed=${encodeURIComponent(target.name)}`);
}

/**
 * Account lifecycle (spec §5) — create, bulk import, activate/deactivate,
 * recovery links and permitted corrections. Each action is admin-only
 * (users.manage), validates input, and is recorded in the audit trail.
 */

export type AccountActionState = { ok: boolean; message: string; link?: string };

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optional(formData: FormData, key: string): string | undefined {
  const value = text(formData, key);
  return value === "" ? undefined : value;
}

export async function createAccountAction(formData: FormData): Promise<AccountActionState> {
  const me = await requireCapability("users.manage");
  const role = text(formData, "role") as Role;
  const semesterRaw = text(formData, "semester");

  try {
    const result = await createAccount(me, {
      name: text(formData, "name"),
      email: text(formData, "email"),
      role: ROLES.includes(role) ? role : "STUDENT",
      department: optional(formData, "department"),
      institutionalId: optional(formData, "institutionalId"),
      program: optional(formData, "program"),
      batch: optional(formData, "batch"),
      semester: semesterRaw ? Number.parseInt(semesterRaw, 10) : undefined,
      section: optional(formData, "section"),
      designation: optional(formData, "designation"),
      office: optional(formData, "office"),
    });

    revalidatePath("/admin/users");
    const invite =
      result.invitation === "sent"
        ? "An activation email was sent so they can set their own password."
        : result.invitation === "failed"
          ? `Activation email failed (${result.invitationNote ?? "unknown error"}) — they can use “Forgot password” once email works.`
          : "No activation email was sent (Clerk not configured).";
    return {
      ok: true,
      message: `Created ${result.institutionalId} for ${text(formData, "name")}. ${invite}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ServiceError ? error.message : "Could not create the account — try again.",
    };
  }
}

export async function toggleActiveAction(formData: FormData): Promise<AccountActionState> {
  const me = await requireCapability("users.manage");
  const userId = text(formData, "userId");
  const active = text(formData, "active") === "true";
  try {
    await setAccountActive(me, userId, active);
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true, message: active ? "Account activated." : "Account deactivated — sign-in is blocked." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ServiceError ? error.message : "Could not change the account status.",
    };
  }
}

export async function recoveryLinkAction(formData: FormData): Promise<AccountActionState> {
  const me = await requireCapability("users.manage");
  const userId = text(formData, "userId");
  try {
    const { url } = await initiateAccountRecovery(me, userId);
    revalidatePath(`/admin/users/${userId}`);
    return {
      ok: true,
      message:
        "Single-use recovery link (expires in 15 minutes). Share it privately with the account holder — it signs them straight in, then they should change their password.",
      link: url,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ServiceError ? error.message : "Could not create a recovery link.",
    };
  }
}

export async function updateAccountInfoAction(formData: FormData): Promise<AccountActionState> {
  const me = await requireCapability("users.manage");
  const userId = text(formData, "userId");
  const semesterRaw = text(formData, "semester");
  try {
    await updateAccountInfo(me, userId, {
      name: optional(formData, "name"),
      department: optional(formData, "department"),
      semester: semesterRaw === "" ? undefined : semesterRaw === "none" ? null : Number.parseInt(semesterRaw, 10),
      section: formData.has("section") ? text(formData, "section") : undefined,
      batch: formData.has("batch") ? text(formData, "batch") : undefined,
      program: optional(formData, "program"),
      designation: formData.has("designation") ? text(formData, "designation") : undefined,
      office: formData.has("office") ? text(formData, "office") : undefined,
    });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true, message: "Account information updated and recorded in the audit trail." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ServiceError ? error.message : "Could not update the account.",
    };
  }
}

export async function importAccountsAction(formData: FormData): Promise<AccountActionState> {
  const me = await requireCapability("users.manage");
  try {
    const result = await importAccountsFromCsv(me, text(formData, "csv"));
    revalidatePath("/admin/users");
    const failureNote =
      result.failed.length > 0
        ? ` Failed: ${result.failed
            .slice(0, 6)
            .map((f) => `line ${f.line} (${f.email || "no email"}) — ${f.reason}`)
            .join("; ")}${result.failed.length > 6 ? ` …and ${result.failed.length - 6} more` : ""}`
        : "";
    return {
      ok: result.failed.length === 0,
      message: `Imported ${result.created.length} account${result.created.length === 1 ? "" : "s"} (activation emails sent).${failureNote}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ServiceError ? error.message : "Could not import the CSV — check the format.",
    };
  }
}

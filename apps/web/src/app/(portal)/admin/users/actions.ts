"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { recordAudit } from "@/server/services/audit";
import { notifyUser } from "@/server/services/notifications";

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

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ServiceError } from "@/server/services/forms";
import { setAdmitCardRule } from "@/server/services/admit-cards";

/** Save the admit-card singleton rule — admin only (capability admitcards.manage). */
export async function setAdmitCardRuleAction(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "admitcards.manage")) redirect("/dashboard?denied=1");

  const back = (params: string): never => {
    revalidatePath("/admin/admit-cards");
    redirect(`/admin/admit-cards${params}`);
  };

  try {
    await setAdmitCardRule(user, {
      requiredFormKey: String(formData.get("requiredFormKey") ?? "").trim() || null,
      requireEnrollment: formData.get("requireEnrollment") === "1",
      feeClearanceEnabled: formData.get("feeClearanceEnabled") === "1",
      examLabel: String(formData.get("examLabel") ?? ""),
    });
  } catch (e) {
    back(`?error=${encodeURIComponent(e instanceof ServiceError ? e.message : "Action failed — try again.")}`);
  }
  back("?ok=rule_saved");
}

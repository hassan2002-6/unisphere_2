"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { MAX_AVATAR_BYTES, removeAvatar, setAvatar, updateOwnProfile } from "@/server/services/profiles";
import { ServiceError } from "@/server/services/forms";

function backToProfile(params: string): never {
  revalidatePath("/profile");
  redirect(`/profile?${params}`);
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  try {
    await updateOwnProfile(user, {
      name: String(formData.get("name") ?? ""),
      department: String(formData.get("department") ?? ""),
    });
  } catch (e) {
    backToProfile(`error=${encodeURIComponent(e instanceof ServiceError ? e.message : "Could not save your profile — try again.")}`);
  }
  backToProfile("saved=1");
}

export async function uploadAvatarAction(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("photo");
  try {
    if (!(file instanceof File) || file.size === 0) throw new ServiceError("validation_error", "Choose a photo file first", 422);
    if (file.size > MAX_AVATAR_BYTES) {
      throw new ServiceError("validation_error", `Photos must be ${Math.round(MAX_AVATAR_BYTES / 1024)} KB or smaller`, 422);
    }
    await setAvatar(user.id, user, { name: file.name, data: Buffer.from(await file.arrayBuffer()) });
  } catch (e) {
    backToProfile(`error=${encodeURIComponent(e instanceof ServiceError ? e.message : "Could not update your photo — try again.")}`);
  }
  backToProfile("photo=1");
}

export async function removeAvatarAction() {
  const user = await requireUser();
  try {
    await removeAvatar(user.id, user);
  } catch {
    backToProfile("error=Could not remove the photo — try again.");
  }
  backToProfile("photoRemoved=1");
}

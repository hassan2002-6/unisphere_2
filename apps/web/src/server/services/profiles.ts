import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { can } from "@/lib/rbac";
import { toBytes } from "@/server/bytes";
import { recordAudit } from "./audit";
import { ServiceError } from "./forms";

/**
 * Own-profile editing + profile photos (spec §8). Photos are small images kept
 * in Postgres and served through an authorized route — no public buckets.
 */

export const MAX_AVATAR_BYTES = 400 * 1024; // 400 KB
export const AVATAR_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function validateAvatar(file: { name: string; size: number }): { ok: true; ext: string } | { ok: false; error: string } {
  const idx = file.name.lastIndexOf(".");
  const ext = (idx === -1 ? "" : file.name.slice(idx + 1)).toLowerCase();
  if (!(ext in AVATAR_MIME)) return { ok: false, error: "Photos must be PNG, JPG or WebP" };
  if (file.size <= 0) return { ok: false, error: "The photo file is empty" };
  if (file.size > MAX_AVATAR_BYTES) return { ok: false, error: `Photos must be ${Math.round(MAX_AVATAR_BYTES / 1024)} KB or smaller` };
  return { ok: true, ext };
}

/** Magic-byte sniff so a renamed non-image cannot pass the extension check. */
export function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const b = bytes;
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  // WebP: "RIFF" .... "WEBP"
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return true;
  return false;
}

export async function setAvatar(userId: string, actor: User, input: { name: string; data: Buffer }) {
  const check = validateAvatar({ name: input.name, size: input.data.length });
  if (!check.ok) throw new ServiceError("validation_error", check.error, 422);
  const bytes = toBytes(input.data);
  if (!looksLikeImage(bytes)) throw new ServiceError("validation_error", "That file is not a valid image", 422);

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!target) throw new ServiceError("not_found", "User not found", 404);
  if (userId !== actor.id && !can(actor.role, "profiles.manage")) {
    throw new ServiceError("forbidden", "You can only change your own photo", 403);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarMime: AVATAR_MIME[check.ext], avatarData: bytes, avatarUpdatedAt: new Date() },
  });
  await recordAudit({
    actorId: actor.id,
    action: "profile.photo",
    entity: "User",
    entityId: userId,
    summary: userId === actor.id ? "Updated own profile photo" : `Updated photo for ${target.name}`,
  });
}

export async function removeAvatar(userId: string, actor: User) {
  if (userId !== actor.id && !can(actor.role, "profiles.manage")) {
    throw new ServiceError("forbidden", "You can only change your own photo", 403);
  }
  await prisma.user.update({ where: { id: userId }, data: { avatarMime: null, avatarData: null, avatarUpdatedAt: null } });
  await recordAudit({ actorId: actor.id, action: "profile.photo_remove", entity: "User", entityId: userId, summary: "Removed profile photo" });
}

export async function getAvatarImage(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarMime: true, avatarData: true, avatarUpdatedAt: true },
  });
  if (!user?.avatarData || !user.avatarMime) return null;
  return { mime: user.avatarMime, data: user.avatarData, updatedAt: user.avatarUpdatedAt };
}

const EDITABLE_PROFILE_FIELDS = ["name", "department"] as const;
export type ProfileEdit = Partial<Record<(typeof EDITABLE_PROFILE_FIELDS)[number], string>>;

/** Self-service profile edit — only the permitted fields, always audited. */
export async function updateOwnProfile(user: User, patch: ProfileEdit) {
  const data: { name?: string; department?: string | null } = {};
  const changed: string[] = [];

  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 120);
    if (name.length < 2) throw new ServiceError("validation_error", "Name is too short", 422);
    if (name !== user.name) {
      data.name = name;
      changed.push("name");
    }
  }
  if (patch.department !== undefined) {
    const department = patch.department.trim().slice(0, 120);
    if (department !== (user.department ?? "")) {
      data.department = department || null;
      changed.push("department");
    }
  }
  if (changed.length === 0) return user;

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  await recordAudit({
    actorId: user.id,
    action: "profile.update",
    entity: "User",
    entityId: user.id,
    summary: `Updated own profile (${changed.join(", ")})`,
  });
  return updated;
}

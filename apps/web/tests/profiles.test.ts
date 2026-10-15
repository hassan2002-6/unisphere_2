import { describe, expect, it } from "vitest";
import { AVATAR_MIME, MAX_AVATAR_BYTES, looksLikeImage, validateAvatar } from "@/server/services/profiles";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);
const notImage = Buffer.from("MZ\x90\x00 this is not an image at all");

describe("validateAvatar()", () => {
  it("accepts png / jpg / jpeg / webp under the size cap", () => {
    for (const name of ["photo.png", "photo.jpg", "PHOTO.JPEG", "pic.webp"]) {
      const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
      expect(validateAvatar({ name, size: 1024 })).toEqual({ ok: true, ext });
    }
  });

  it("rejects unsupported extensions, empty files and oversized photos", () => {
    expect(validateAvatar({ name: "photo.gif", size: 10 }).ok).toBe(false);
    expect(validateAvatar({ name: "noextension", size: 10 }).ok).toBe(false);
    expect(validateAvatar({ name: "photo.png", size: 0 }).ok).toBe(false);
    expect(validateAvatar({ name: "photo.png", size: MAX_AVATAR_BYTES + 1 }).ok).toBe(false);
    expect(validateAvatar({ name: "photo.png", size: MAX_AVATAR_BYTES }).ok).toBe(true);
  });

  it("maps extensions to MIME types", () => {
    expect(AVATAR_MIME.jpg).toBe("image/jpeg");
    expect(AVATAR_MIME.jpeg).toBe("image/jpeg");
    expect(AVATAR_MIME.png).toBe("image/png");
    expect(AVATAR_MIME.webp).toBe("image/webp");
  });
});

describe("looksLikeImage()", () => {
  it("sniffs real PNG / JPEG / WebP magic bytes", () => {
    expect(looksLikeImage(png)).toBe(true);
    expect(looksLikeImage(jpeg)).toBe(true);
    expect(looksLikeImage(webp)).toBe(true);
  });

  it("rejects renamed non-images and short buffers", () => {
    expect(looksLikeImage(notImage)).toBe(false);
    expect(looksLikeImage(Buffer.from([0x89, 0x50]))).toBe(false);
  });
});

"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { removeAvatarAction, uploadAvatarAction } from "@/app/(portal)/profile/actions";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 400 * 1024; // keep in step with MAX_AVATAR_BYTES in services/profiles.ts

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}

/**
 * Profile photo — upload / change / remove for every role. The image is sent to
 * the uploadAvatarAction server action, validated there (type, size, magic
 * bytes) and stored in Postgres; the page then renders it from
 * /api/users/[id]/photo so it survives refreshes and new logins. The local
 * object-URL only ever previews the *pending* selection; the saved photo comes
 * back from the database.
 */
export function ProfilePhotoCard({
  name,
  userId,
  hasAvatar,
  version,
}: {
  name: string;
  userId: string;
  hasAvatar: boolean;
  version?: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function onPick(file: File | null) {
    setLocalError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      setLocalError("Photos must be PNG, JPG or WebP.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError(`Photos must be ${Math.round(MAX_BYTES / 1024)} KB or smaller — this one is ${Math.max(1, Math.round(file.size / 1024))} KB.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-3.5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ImageUp className="h-4 w-4 text-muted-foreground" />
          Profile photo
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- pending-selection preview only
              <img
                src={preview}
                alt="Selected photo preview"
                style={{ height: 88, width: 88 }}
                className="shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <UserAvatar name={name} userId={userId} hasAvatar={hasAvatar} version={version} size={88} />
            )}
            <div className="max-w-xs text-[13px] text-muted-foreground">
              <p className="font-medium text-foreground">
                {hasAvatar ? "Your photo is live across the portal." : "No photo yet — the crimson initials are the default avatar."}
              </p>
              <p className="mt-1">
                PNG, JPG or WebP · up to {Math.round(MAX_BYTES / 1024)} KB. Saved to the university database and shown on your profile and the top bar — it
                stays after sign-out.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:ml-auto sm:w-64">
            <form action={uploadAvatarAction} className="flex flex-col gap-2">
              <label htmlFor="photo" className="text-[13px] font-medium text-[#444444]">
                {hasAvatar ? "Choose a new photo" : "Choose a photo"}
              </label>
              <input
                ref={inputRef}
                id="photo"
                name="photo"
                type="file"
                accept={ACCEPT}
                required
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                className="block w-full text-[13px] text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-foreground hover:file:bg-accent"
              />
              <SubmitButton label={hasAvatar ? "Save new photo" : "Upload photo"} />
            </form>

            {hasAvatar ? (
              <form
                action={removeAvatarAction}
                onSubmit={(e) => {
                  if (!window.confirm("Remove your profile photo? The default initials avatar will be used again.")) e.preventDefault();
                }}
              >
                <Button type="submit" variant="outline" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove photo
                </Button>
              </form>
            ) : null}

            {localError ? (
              <p role="alert" className="text-[13px] text-[#721c24]">
                {localError}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

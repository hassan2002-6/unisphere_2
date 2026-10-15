import { cn } from "cn";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

/**
 * Portal avatar — the uploaded profile photo when one exists, otherwise the
 * classic crimson initials disc. Renders on the server; the photo route is
 * authorization-guarded so this only ever runs for signed-in members.
 */
export function UserAvatar({
  name,
  userId,
  hasAvatar,
  size = 38,
  className,
}: {
  name: string;
  userId: string;
  hasAvatar?: boolean;
  size?: number;
  className?: string;
}) {
  if (hasAvatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- authorized blob route, not a static asset
      <img
        src={`/api/users/${userId}/photo`}
        alt={`${name} photo`}
        width={size}
        height={size}
        style={{ height: size, width: size }}
        className={cn("shrink-0 rounded-full border border-border object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ height: size, width: size }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-white",
        size >= 54 ? "text-lg" : "text-sm",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

"use client";

import { useState } from "react";
import { cn } from "cn";

/**
 * University logo slot for the sign-in page.
 *
 * The **official** Salim Habib University logo ships at
 * `public/branding/shu-logo.png` — the university's own artwork, extracted at
 * full resolution from the logo file on its public website and trimmed (the
 * site's SVG wrapper renders blank when embedded, so only the raster ships).
 * Nothing here is invented. If the file is removed or renamed, the component
 * falls back to a clearly-labelled, replaceable placeholder.
 */
const LOGO_SOURCES = ["/branding/shu-logo.png"] as const;

export function ShuLogo({ maxHeight = 64, maxWidth = 280, className }: { maxHeight?: number; maxWidth?: number; className?: string }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = LOGO_SOURCES[sourceIndex];

  if (!source) {
    return (
      <div
        role="img"
        aria-label="Salim Habib University logo placeholder"
        title="Placeholder — add the authorized logo at apps/web/public/branding/shu-logo.png"
        style={{ height: Math.max(64, maxHeight), width: Math.max(64, maxHeight) }}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-primary/40 bg-secondary text-center",
          className,
        )}
      >
        <span className="text-[11px] leading-tight font-bold tracking-widest text-primary">SHU</span>
        <span className="text-[8px] leading-tight tracking-wide text-muted-foreground uppercase">logo</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- replaceable branding asset, not a build-time import
    <img
      src={source}
      alt="Salim Habib University logo"
      style={{ maxHeight, maxWidth }}
      className={cn("h-auto w-auto object-contain", className)}
      onError={() => setSourceIndex((i) => i + 1)}
    />
  );
}

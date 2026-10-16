"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { validateRecipientSelection } from "@/lib/complaint-policy";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type StaffOption = { id: string; name: string; role: string };

const roleLabel = (role: string) => ROLE_LABELS[role as Role] ?? role;

/**
 * To / CC multi-select picker (goal §8) for the complaint form. Selection
 * state lives here; the chosen ids ride along as hidden fields named `toIds`
 * and `ccIds` for the server action. Validation mirrors the server rule
 * exactly (`validateRecipientSelection`) and a submit with an invalid
 * selection is blocked client-side — the service still re-checks.
 */
export function ComplaintRecipientsPicker({ staff }: { staff: StaffOption[] }) {
  const [query, setQuery] = useState("");
  const [toIds, setToIds] = useState<string[]>([]);
  const [ccIds, setCcIds] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const selection = validateRecipientSelection({ toIds, ccIds });
  const pickedAnything = toIds.length > 0 || ccIds.length > 0;
  const invalid = pickedAnything && !selection.ok;
  const error = invalid && !selection.ok ? selection.error : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => s.name.toLowerCase().includes(q) || roleLabel(s.role).toLowerCase().includes(q));
  }, [staff, query]);

  // A CC without a To (or a duplicate) must never leave the browser; the
  // server action validates again. preventDefault keeps React from running it.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onSubmit = (e: Event) => {
      if (invalid) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, [invalid]);

  const toggle = (id: string, list: "to" | "cc") => {
    setToIds((prev) =>
      list === "to" ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : prev.filter((x) => x !== id),
    );
    setCcIds((prev) =>
      list === "cc" ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : prev.filter((x) => x !== id),
    );
  };

  const byId = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  return (
    <div ref={rootRef} className="grid gap-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm leading-none font-medium">Recipients (optional)</span>
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">To</span> recipients handle the complaint and can act on it;{" "}
        <span className="font-medium text-foreground">CC</span> recipients are kept in the loop and can only read it.
        Leave both empty and the university routing rules pick the office.
      </p>

      {pickedAnything ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {toIds.length > 0 ? <span className="text-xs font-medium text-muted-foreground">To</span> : null}
          {toIds.map((id) => (
            <RecipientChip key={`to-${id}`} name={byId.get(id)?.name ?? id} tone="to" onRemove={() => toggle(id, "to")} />
          ))}
          {ccIds.length > 0 ? <span className="text-xs font-medium text-muted-foreground">CC</span> : null}
          {ccIds.map((id) => (
            <RecipientChip key={`cc-${id}`} name={byId.get(id)?.name ?? id} tone="cc" onRemove={() => toggle(id, "cc")} />
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search staff by name or role…"
            aria-label="Search staff directory"
            className="h-9 rounded-none border-0 pl-8 shadow-none focus-visible:ring-0"
          />
        </div>
        <ul className="max-h-56 divide-y divide-border overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">No staff match “{query}”.</li>
          ) : (
            filtered.map((s) => {
              const inTo = toIds.includes(s.id);
              const inCc = ccIds.includes(s.id);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-sm">
                    {s.name} <span className="text-xs text-muted-foreground">· {roleLabel(s.role)}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant={inTo ? "default" : "outline"}
                      aria-pressed={inTo}
                      onClick={() => toggle(s.id, "to")}
                    >
                      To
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant={inCc ? "secondary" : "outline"}
                      aria-pressed={inCc}
                      onClick={() => toggle(s.id, "cc")}
                    >
                      CC
                    </Button>
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Form fields consumed by createComplaintAction. */}
      {toIds.map((id) => (
        <input key={`to-field-${id}`} type="hidden" name="toIds" value={id} />
      ))}
      {ccIds.map((id) => (
        <input key={`cc-field-${id}`} type="hidden" name="ccIds" value={id} />
      ))}

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : pickedAnything ? (
        <p className="text-xs text-muted-foreground">
          {toIds.length} To · {ccIds.length} CC — everyone is notified when the complaint is filed.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No recipients picked — the complaint is routed by the university rules.</p>
      )}
    </div>
  );
}

function RecipientChip({ name, tone, onRemove }: { name: string; tone: "to" | "cc"; onRemove: () => void }) {
  return (
    <Badge variant={tone === "to" ? "secondary" : "outline"} className="gap-1 pr-1">
      {tone === "cc" ? `CC: ${name}` : name}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

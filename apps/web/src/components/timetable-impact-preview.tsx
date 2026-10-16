"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import type { SaveSlotInput, SlotPreview } from "@/server/services/timetable-manage";

/**
 * Slot editor with an “Impact preview” step (goal §11): pressing Save dry-runs
 * the change server-side first and shows the conflicts, the students that will
 * be notified and up to five free windows — only then does the publish form
 * submit. The preview/publish actions are injected as props so this component
 * stays free of server imports.
 */

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

const DAY_LABELS: Record<string, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
};

const FIELD =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export type SlotPreviewResult = { ok: true; preview: SlotPreview } | { ok: false; message: string };

type SlotFormValues = { day: string; start: string; end: string; room: string };

function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function toLabel(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

const CONFLICT_LABELS: Record<string, string> = {
  room: "Room",
  faculty: "Faculty",
  student: "Students",
  exam: "Exam",
};

export function SlotImpactForm({
  classId,
  slotId,
  defaults,
  rooms,
  previewAction,
  saveAction,
  submitLabel = "Preview & save",
}: {
  classId: string;
  slotId?: string;
  defaults: SlotFormValues;
  rooms: string[];
  previewAction: (proposed: SaveSlotInput) => Promise<SlotPreviewResult>;
  saveAction: (formData: FormData) => Promise<void>;
  submitLabel?: string;
}) {
  const reactId = React.useId();
  const [day, setDay] = React.useState(defaults.day);
  const [start, setStart] = React.useState(defaults.start);
  const [end, setEnd] = React.useState(defaults.end);
  const [room, setRoom] = React.useState(defaults.room);
  const [open, setOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<SlotPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const runPreview = React.useCallback(
    (values: SlotFormValues) => {
      const startMin = toMinutes(values.start);
      const endMin = toMinutes(values.end);
      if (startMin === null || endMin === null) {
        setError("Pick a day and valid start/end times (HH:MM).");
        return;
      }
      if (startMin >= endMin) {
        setError("Start time must be before end time.");
        return;
      }
      setError(null);
      startTransition(async () => {
        const result = await previewAction({
          id: slotId,
          classId,
          day: values.day,
          startMin,
          endMin,
          room: values.room.trim() || null,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setPreview(result.preview);
        setOpen(true);
      });
    },
    [classId, previewAction, slotId, startTransition],
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runPreview({ day, start, end, room });
  }

  function applyAlternative(alt: { day: string; start: number; end: number; room: string | null }) {
    const values: SlotFormValues = { day: alt.day, start: toLabel(alt.start), end: toLabel(alt.end), room: alt.room ?? "" };
    setDay(values.day);
    setStart(values.start);
    setEnd(values.end);
    setRoom(values.room);
    runPreview(values);
  }

  const blocking = preview?.conflicts.filter((c) => c.kind !== "exam") ?? [];
  const conflicts = preview?.conflicts ?? [];
  const roomListId = `tt-rooms-${reactId}`;

  return (
    <>
      <form onSubmit={onSubmit} className="grid items-center gap-2 sm:grid-cols-[7.5rem_6.5rem_6.5rem_minmax(0,1fr)_auto]">
        {slotId ? <input type="hidden" name="id" value={slotId} /> : null}
        <select
          value={day}
          onChange={(event) => setDay(event.target.value)}
          className={FIELD}
          aria-label="Day"
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {DAY_LABELS[d]}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          className={FIELD}
          aria-label="Start time"
        />
        <input
          type="time"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          className={FIELD}
          aria-label="End time"
        />
        <input
          type="text"
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          list={roomListId}
          placeholder="Room"
          className={FIELD}
          aria-label="Room"
        />
        <datalist id={roomListId}>
          {rooms.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Checking…" : submitLabel}
        </Button>
        {error ? (
          <p role="alert" className="col-span-full text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </form>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Impact preview</DialogTitle>
            <DialogDescription>
              What this change does before it publishes — clashes, who gets notified, and free windows.
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto pr-1">
              <section className="flex flex-col gap-1.5">
                <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" /> Conflicts ({conflicts.length})
                </h3>
                {conflicts.length === 0 ? (
                  <p className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> No clashes — this change is safe to publish.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {conflicts.map((conflict, index) => (
                      <li
                        key={`${conflict.kind}-${index}`}
                        className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <Badge variant={conflict.kind === "exam" ? "secondary" : "destructive"}>
                            {CONFLICT_LABELS[conflict.kind] ?? conflict.kind}
                          </Badge>
                          <span className="font-medium">{conflict.detail}</span>
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">with {conflict.with}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {blocking.length > 0 ? (
                  <p className="text-xs text-destructive">
                    Room, faculty and student clashes block the save — pick a free window below.
                  </p>
                ) : null}
              </section>

              <section className="flex flex-col gap-1.5">
                <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Affected students ({preview.affectedStudents.count})
                </h3>
                {preview.affectedStudents.count === 0 ? (
                  <p className="text-sm text-muted-foreground">No enrolled students — nobody will be notified.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {preview.affectedStudents.count} enrolled student{preview.affectedStudents.count === 1 ? "" : "s"} will
                    be notified once this publishes
                    {preview.affectedStudents.sample.length > 0
                      ? ` — e.g. ${preview.affectedStudents.sample.join(", ")}${preview.affectedStudents.count > preview.affectedStudents.sample.length ? ", …" : ""}.`
                      : "."}
                  </p>
                )}
              </section>

              {preview.alternatives.length > 0 ? (
                <section className="flex flex-col gap-1.5">
                  <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> Free windows
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.alternatives.map((alt) => (
                      <Button
                        key={`${alt.day}-${alt.start}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyAlternative(alt)}
                      >
                        {DAY_LABELS[alt.day] ?? alt.day} {toLabel(alt.start)}–{toLabel(alt.end)}
                        {alt.room ? ` · ${alt.room}` : ""}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Click a window to drop the session there and re-check.</p>
                </section>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <form action={saveAction} className="flex w-full flex-col gap-3 text-left">
              <input type="hidden" name="classId" value={classId} />
              {slotId ? <input type="hidden" name="id" value={slotId} /> : null}
              <input type="hidden" name="day" value={day} />
              <input type="hidden" name="start" value={start} />
              <input type="hidden" name="end" value={end} />
              <input type="hidden" name="room" value={room} />
              <div className="flex flex-col gap-1.5 text-left">
                <Label htmlFor={`note-${reactId}`} className="text-[11px] text-muted-foreground">
                  History note (optional)
                </Label>
                <Textarea id={`note-${reactId}`} name="note" rows={2} placeholder="Why this change? (shown in the history)" />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton disabled={blocking.length > 0} pendingLabel="Publishing…">
                  Save &amp; publish
                </SubmitButton>
              </div>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useActionState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { importCsvAction, type ImportState } from "@/app/(portal)/admin/data/import/actions";

const ENTITIES = [
  { value: "students", label: "Students", columns: "name, email, registrationNo, program, batch, semester, section" },
  { value: "faculty", label: "Faculty", columns: "name, email, employeeId, designation, office, department" },
  { value: "courses", label: "Course sections", columns: "courseCode, title, section, department, semester, credits, facultyEmail" },
] as const;

export function ImportForm() {
  const [state, formAction, pending] = useActionState<ImportState | undefined, FormData>(importCsvAction, {});

  return (
    <Card>
      <CardHeader className="py-3.5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          CSV import
        </CardTitle>
        <CardDescription>
          Download the template for the record type, fill it in, then paste it below or upload the file. Rows are
          validated before anything is written — invalid rows are reported per line and skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="entity">Record type</Label>
              <select
                id="entity"
                name="entity"
                defaultValue="students"
                className="border-input h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {ENTITIES.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="file">CSV file (optional)</Label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".csv,text/csv"
                className="border-input h-9 rounded-md border bg-transparent px-2.5 py-1 text-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-0.5 file:text-xs"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="csv">…or paste CSV rows (header + records)</Label>
            <Textarea
              id="csv"
              name="csv"
              rows={8}
              placeholder={"name,email,registrationNo,program,batch,semester,section\nAyesha Khan,ayesha.khan@shu.edu.pk,S23CSC001,BSCS,2023,3,A"}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending} className="w-fit">
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? "Importing…" : "Validate & import"}
            </Button>
            <span className="text-xs text-muted-foreground">Up to 500 rows per import.</span>
          </div>
        </form>

        <div className="flex flex-wrap gap-2 border-t pt-3">
          {ENTITIES.map((e) => (
            <Button key={e.value} asChild variant="outline" size="sm">
              <a href={`/api/admin/import-template?entity=${e.value}`}>
                <Download className="h-3.5 w-3.5" />
                {e.label} template
              </a>
            </Button>
          ))}
        </div>

        <div className="grid gap-1 text-xs text-muted-foreground">
          {ENTITIES.map((e) => (
            <p key={e.value}>
              <span className="font-medium text-foreground">{e.label}:</span> <code>{e.columns}</code>
            </p>
          ))}
        </div>

        {state?.error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </div>
        ) : null}

        {state?.report ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Import finished — {state.report.created} created, {state.report.updated} updated, {state.report.skipped} skipped.
            </p>
            {state.report.errors.length > 0 ? (
              <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
                {state.report.errors.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-muted-foreground">line {e.line}</span>
                    <span className="text-destructive">{e.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No row errors.</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

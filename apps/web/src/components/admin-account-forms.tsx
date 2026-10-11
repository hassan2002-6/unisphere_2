"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, ShieldOff, ShieldCheck } from "lucide-react";
import {
  createAccountAction,
  importAccountsAction,
  recoveryLinkAction,
  toggleActiveAction,
  updateAccountInfoAction,
  type AccountActionState,
} from "@/app/(portal)/admin/users/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";

/**
 * Admin account-management forms (spec §5): create, CSV import, corrections,
 * activate/deactivate and admin-assisted recovery. Client components so each
 * action can report back per-submission results (including the one-time link).
 */

const ROLES = [
  ["STUDENT", "Student"],
  ["FACULTY", "Faculty"],
  ["COORDINATOR", "Course Coordinator"],
  ["FYP_HEAD", "FYP Head"],
  ["MENTOR", "Mentor"],
  ["ADMIN", "Administrator"],
] as const;

function Result({ state }: { state: AccountActionState | null }) {
  const [copied, setCopied] = useState(false);
  if (!state) return null;
  return (
    <Alert variant={state.ok ? "success" : "destructive"} className="mt-2">
      <AlertTitle>{state.ok ? "Done" : "Not completed"}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{state.message}</p>
        {state.link ? (
          <div className="flex items-center gap-2">
            <code className="max-w-[420px] truncate rounded bg-muted px-2 py-1 text-xs">{state.link}</code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(state.link ?? "");
                setCopied(true);
              }}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function CreateAccountForm() {
  const [state, formAction] = useActionState<AccountActionState | null, FormData>(
    async (_prev, formData) => createAccountAction(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-[13px] font-medium">
          Full name
          <Input name="name" required placeholder="Ayesha Khan" />
        </label>
        <label className="space-y-1 text-[13px] font-medium">
          University email
          <Input name="email" type="email" required placeholder="ayesha.khan@shu.edu.pk" />
        </label>
        <label className="space-y-1 text-[13px] font-medium">
          Role
          <select
            name="role"
            defaultValue="STUDENT"
            className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[13px] font-medium">
          Department
          <Input name="department" placeholder="Computer Science" />
        </label>
        <label className="space-y-1 text-[13px] font-medium">
          University ID <span className="font-normal text-muted-foreground">(blank = auto-assign)</span>
          <Input name="institutionalId" placeholder="S22CSC011 / FAC004" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-[13px] font-medium">
            Semester
            <Input name="semester" inputMode="numeric" placeholder="7" />
          </label>
          <label className="space-y-1 text-[13px] font-medium">
            Section
            <Input name="section" placeholder="A" />
          </label>
        </div>
        <label className="space-y-1 text-[13px] font-medium">
          Programme <span className="font-normal text-muted-foreground">(students)</span>
          <Input name="program" placeholder="BSCS" />
        </label>
        <label className="space-y-1 text-[13px] font-medium">
          Batch <span className="font-normal text-muted-foreground">(students)</span>
          <Input name="batch" placeholder="2022" />
        </label>
        <label className="space-y-1 text-[13px] font-medium">
          Designation <span className="font-normal text-muted-foreground">(faculty)</span>
          <Input name="designation" placeholder="Lecturer" />
        </label>
        <label className="space-y-1 text-[13px] font-medium">
          Office <span className="font-normal text-muted-foreground">(faculty)</span>
          <Input name="office" placeholder="F-210" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        The account holder receives a Clerk invitation email and sets their own password — no password is ever set
        here.
      </p>
      <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function CsvImportForm() {
  const [state, formAction] = useActionState<AccountActionState | null, FormData>(
    async (_prev, formData) => importAccountsAction(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Header:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          name,email,role,department,program,batch,semester,section,id
        </code>{" "}
        — role is one of STUDENT, FACULTY, COORDINATOR, FYP_HEAD, MENTOR, ADMIN. Each row is validated on its own.
      </p>
      <textarea
        name="csv"
        rows={6}
        required
        placeholder={"name,email,role\nAyesha Khan,ayesha.khan@shu.edu.pk,STUDENT\nDr. Bilal Shah,bilal.shah@shu.edu.pk,FACULTY"}
        className="border-input w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs"
      />
      <SubmitButton variant="secondary" pendingLabel="Importing…">
        Import accounts
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function AccountStatusButton({
  userId,
  active,
  disabled,
}: {
  userId: string;
  active: boolean;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<AccountActionState | null, FormData>(
    async (_prev, formData) => toggleActiveAction(formData),
    null,
  );

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
        <Button type="submit" variant={active ? "destructive" : "default"} disabled={pending || disabled}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : active ? <ShieldOff className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          {active ? "Deactivate account" : "Activate account"}
        </Button>
      </form>
      <Result state={state} />
    </div>
  );
}

export function RecoveryLinkButton({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState<AccountActionState | null, FormData>(
    async (_prev, formData) => recoveryLinkAction(formData),
    null,
  );

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <Button type="submit" variant="secondary" disabled={pending || disabled}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Generate recovery link
        </Button>
      </form>
      <Result state={state} />
    </div>
  );
}

export type EditableAccount = {
  id: string;
  role: string;
  name: string;
  department: string;
  semester: string;
  section: string;
  batch: string;
  program: string;
  designation: string;
  office: string;
};

export function EditAccountForm({ account }: { account: EditableAccount }) {
  const [state, formAction] = useActionState<AccountActionState | null, FormData>(
    async (_prev, formData) => updateAccountInfoAction(formData),
    null,
  );
  const isStudent = account.role === "STUDENT";
  const isFaculty = account.role === "FACULTY";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="userId" value={account.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-[13px] font-medium">
          Name
          <Input name="name" defaultValue={account.name} />
        </label>
        <label className="space-y-1 text-[13px] font-medium">
          Department
          <Input name="department" defaultValue={account.department} />
        </label>
        {isStudent ? (
          <>
            <label className="space-y-1 text-[13px] font-medium">
              Programme
              <Input name="program" defaultValue={account.program} />
            </label>
            <label className="space-y-1 text-[13px] font-medium">
              Batch
              <Input name="batch" defaultValue={account.batch} />
            </label>
            <label className="space-y-1 text-[13px] font-medium">
              Semester
              <Input name="semester" inputMode="numeric" defaultValue={account.semester} placeholder="e.g. 7" />
            </label>
            <label className="space-y-1 text-[13px] font-medium">
              Section
              <Input name="section" defaultValue={account.section} />
            </label>
          </>
        ) : null}
        {isFaculty ? (
          <>
            <label className="space-y-1 text-[13px] font-medium">
              Designation
              <Input name="designation" defaultValue={account.designation} />
            </label>
            <label className="space-y-1 text-[13px] font-medium">
              Office
              <Input name="office" defaultValue={account.office} />
            </label>
          </>
        ) : null}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5" /> Changes are recorded in the account history with your name.
      </p>
      <SubmitButton variant="secondary" pendingLabel="Saving…">
        Save corrections
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}

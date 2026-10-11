import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, IdCard, Mail, ShieldCheck, UserCog } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { listAccountHistory } from "@/server/services/accounts";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { AccountStatusButton, EditAccountForm, RecoveryLinkButton } from "@/components/admin-account-forms";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleChangeAction } from "../actions";

export const dynamic = "force-dynamic";

const ROLE_VALUES = ["STUDENT", "FACULTY", "COORDINATOR", "FYP_HEAD", "MENTOR", "ADMIN"] as const;

/** One account in full: identity, corrections, status, recovery, history (§5). */
export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireCapability("users.manage");
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { studentProfile: true, facultyProfile: true, mentorProfile: true },
  });
  if (!user) notFound();

  const history = await listAccountHistory(user.id);
  const isMe = user.id === me.id;
  const identity = user.registrationNo ?? user.employeeId ?? "—";

  return (
    <>
      <PageHeader
        icon={IdCard}
        title={user.name}
        description={`${ROLE_LABELS[user.role]} · ${identity} · ${user.email}`}
        actions={
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> All accounts
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCog className="h-4 w-4 text-primary" /> Correct account information
              </CardTitle>
              <CardDescription>
                Permitted corrections only — names, department and academic placement. University IDs and roles are
                changed through their dedicated controls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EditAccountForm
                account={{
                  id: user.id,
                  role: user.role,
                  name: user.name,
                  department: user.department ?? "",
                  semester: user.studentProfile?.semester ? String(user.studentProfile.semester) : "",
                  section: user.studentProfile?.section ?? "",
                  batch: user.studentProfile?.batch ?? "",
                  program: user.studentProfile?.program ?? "",
                  designation: user.facultyProfile?.designation ?? "",
                  office: user.facultyProfile?.office ?? "",
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" /> Account history
              </CardTitle>
              <CardDescription>Every recorded change to this account, newest first.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {history.length === 0 ? (
                <p className="px-6 text-sm text-muted-foreground">No recorded activity yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">When</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead className="pr-6">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="pl-6 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                          {entry.createdAt.toLocaleString("en-GB", {
                            timeZone: "Asia/Karachi",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                        <TableCell className="text-sm">{entry.actor?.name ?? "System"}</TableCell>
                        <TableCell className="pr-6 text-xs text-muted-foreground">{entry.summary ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" /> Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">University ID</span>
                <span className="font-mono font-medium">{identity}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Role</span>
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{ROLE_LABELS[user.role]}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={user.isActive ? "ACTIVE" : "DEACTIVATED"} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Email</span>
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <Mail className="h-3.5 w-3.5" /> {user.email}
                </span>
              </div>
              {user.department ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Department</span>
                  <span>{user.department}</span>
                </div>
              ) : null}
              {user.studentProfile ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Programme</span>
                  <span>
                    {user.studentProfile.program}
                    {user.studentProfile.semester ? ` · Sem ${user.studentProfile.semester}` : ""}
                    {user.studentProfile.section ? ` · Sec ${user.studentProfile.section}` : ""}
                  </span>
                </div>
              ) : null}
              {user.facultyProfile ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Designation</span>
                  <span>{user.facultyProfile.designation ?? "—"}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role</CardTitle>
              <CardDescription>Role changes apply immediately and are recorded.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={roleChangeAction} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <select
                  name="role"
                  defaultValue={user.role}
                  aria-label={`New role for ${user.name}`}
                  className="border-input h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
                  disabled={isMe}
                >
                  {ROLE_VALUES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <SubmitButton variant="secondary" pendingLabel="Saving…" disabled={isMe}>
                  Set
                </SubmitButton>
              </form>
              {isMe ? <p className="mt-2 text-xs text-muted-foreground">You cannot change your own role.</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status &amp; recovery</CardTitle>
              <CardDescription>
                Deactivation blocks sign-in at the authentication provider — records stay archived, nothing is
                deleted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <AccountStatusButton userId={user.id} active={user.isActive} disabled={isMe} />
              <RecoveryLinkButton userId={user.id} disabled={!user.isActive} />
              <p className="text-xs text-muted-foreground">
                The recovery link is single-use and expires in 15 minutes; share it through a private channel. The
                account holder can also reset their own password from the sign-in page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

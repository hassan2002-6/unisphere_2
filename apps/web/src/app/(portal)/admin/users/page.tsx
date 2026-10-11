import Link from "next/link";
import { Bell, Mail, ShieldCheck, Users } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { prisma, type Prisma } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateAccountForm, CsvImportForm } from "@/components/admin-account-forms";
import { StatusBadge } from "@/components/status-badge";
import { roleChangeAction } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_VALUES: Role[] = ["STUDENT", "FACULTY", "COORDINATOR", "FYP_HEAD", "MENTOR", "ADMIN"];

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  registrationNo: string | null;
  employeeId: string | null;
  isActive: boolean;
  createdAt: Date;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; changed?: string; error?: string }>;
}) {
  const me = await requireCapability("users.manage");
  const { q, changed, error } = await searchParams;
  const query = (q ?? "").trim();

  let users: UserRow[] = [];
  let roleCounts: Partial<Record<Role, number>> = {};
  let unreadMessages = new Map<string, number>();
  let unreadNotifications = new Map<string, number>();
  let totalUsers = 0;
  let dbError = false;

  try {
    const where: Prisma.UserWhereInput = query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { registrationNo: { contains: query, mode: "insensitive" } },
            { employeeId: { contains: query, mode: "insensitive" } },
          ],
        }
      : {};

    const [rows, counts] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { name: "asc" },
        take: 150,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          registrationNo: true,
          employeeId: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    ]);

    users = rows;
    for (const row of counts) roleCounts[row.role] = row._count._all;
    totalUsers = counts.reduce((n, row) => n + row._count._all, 0);

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const [msgCounts, notifCounts] = await Promise.all([
        prisma.message.groupBy({
          by: ["recipientId"],
          where: { recipientId: { in: ids }, readAt: null },
          _count: { _all: true },
        }),
        prisma.notification.groupBy({
          by: ["userId"],
          where: { userId: { in: ids }, readAt: null },
          _count: { _all: true },
        }),
      ]);
      unreadMessages = new Map(msgCounts.map((r) => [r.recipientId, r._count._all]));
      unreadNotifications = new Map(notifCounts.map((r) => [r.userId, r._count._all]));
    }
  } catch (loadError) {
    console.error("users load failed:", loadError);
    dbError = true;
  }

  return (
    <>
      <PageHeader
        icon={ShieldCheck}
        title="Users & Roles"
        description="Every portal account with its role — the role list is enforced server-side everywhere, so changes take effect immediately."
        actions={
          <form className="flex items-center gap-2">
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search name, email, reg no…"
              className="w-64"
              aria-label="Search accounts"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        }
      />

      {changed ? (
        <Alert variant="success">
          <AlertTitle>Role updated</AlertTitle>
          <AlertDescription>
            {changed} now has the new role. They were notified, and the change is in the audit log.
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Role not changed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Users unavailable</AlertTitle>
          <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
        </Alert>
      ) : (
        <>
          <details className="rounded-xl border bg-card px-5 py-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Create an account{" "}
              <span className="font-normal text-muted-foreground">
                — student, faculty, coordinator, FYP Head, mentor or admin
              </span>
            </summary>
            <div className="mt-4">
              <CreateAccountForm />
            </div>
          </details>

          <details className="rounded-xl border bg-card px-5 py-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Bulk import <span className="font-normal text-muted-foreground">— validated CSV</span>
            </summary>
            <div className="mt-4">
              <CsvImportForm />
            </div>
          </details>

          <section aria-label="Accounts by role" className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="tabular-nums">
              Total {totalUsers}
            </Badge>
            {ROLE_VALUES.map((role) => (
              <Badge key={role} variant="outline" className="gap-1.5">
                {ROLE_LABELS[role]}
                <span className="tabular-nums text-muted-foreground">{roleCounts[role] ?? 0}</span>
              </Badge>
            ))}
          </section>

          {query ? (
            <p className="text-xs text-muted-foreground">
              {users.length} account{users.length === 1 ? "" : "s"} matching &ldquo;{query}&rdquo; ·{" "}
              <Link href="/admin/users" className="underline underline-offset-4 hover:text-foreground">
                clear search
              </Link>
            </p>
          ) : null}

          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title={query ? "No accounts match" : "No accounts yet"}
              description={
                query
                  ? `Nothing matches “${query}” — try a different search.`
                  : "Accounts appear here once people sign in or are provisioned."
              }
              action={
                query ? (
                  <Button asChild variant="outline">
                    <Link href="/admin/users">Clear search</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card className="gap-0 overflow-hidden py-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="pl-5">Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Unread</TableHead>
                      <TableHead>Reg / Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="pr-5">Change role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const unreadMsg = unreadMessages.get(u.id) ?? 0;
                      const unreadNotif = unreadNotifications.get(u.id) ?? 0;
                      const isMe = u.id === me.id;
                      const identity = [u.registrationNo, u.employeeId].filter(Boolean).join(" · ");
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="pl-5">
                            <span className="font-medium">{u.name}</span>
                            {isMe ? (
                              <Badge variant="secondary" className="ml-2">
                                You
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                          <TableCell>
                            <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                              {ROLE_LABELS[u.role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Mail className="h-3.5 w-3.5" aria-hidden />
                                {unreadMsg}
                                <span className="sr-only">unread messages</span>
                              </span>
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Bell className="h-3.5 w-3.5" aria-hidden />
                                {unreadNotif}
                                <span className="sr-only">unread notifications</span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{identity || "—"}</TableCell>
                          <TableCell>
                            <StatusBadge status={u.isActive ? "ACTIVE" : "DEACTIVATED"} />
                          </TableCell>
                          <TableCell>{u.department ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {u.createdAt.toLocaleDateString("en-GB", {
                              timeZone: "Asia/Karachi",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="pr-5">
                            <div className="flex items-center gap-2">
                              <form action={roleChangeAction} className="flex items-center gap-2">
                                <input type="hidden" name="userId" value={u.id} />
                                <select
                                  name="role"
                                  defaultValue={u.role}
                                  aria-label={`New role for ${u.name}`}
                                  className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                                >
                                  {ROLE_VALUES.map((role) => (
                                    <option key={role} value={role}>
                                      {ROLE_LABELS[role]}
                                    </option>
                                  ))}
                                </select>
                                <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
                                  Set
                                </SubmitButton>
                              </form>
                              <Button asChild size="sm" variant="ghost">
                                <Link href={`/admin/users/${u.id}`}>Manage</Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}

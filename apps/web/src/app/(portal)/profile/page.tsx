import { BadgeCheck, IdCard, Mail, ShieldCheck, UserCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { CAPABILITY_LABELS, capabilitiesFor, ROLE_LABELS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { ProfilePhotoCard } from "@/components/profile-photo-card";
import { UserAvatar } from "@/components/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5">
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={mono ? "font-mono text-sm" : "text-sm"}>{value}</dd>
    </div>
  );
}

/**
 * Identity page for every role — the university ID (registration number for
 * students, employee ID for staff), the record attached to it, and the
 * capabilities the role holds in the portal.
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; photo?: string; photoRemoved?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  // The university ID + the role-specific record attached to it.
  let student: Awaited<ReturnType<typeof loadStudent>> | null = null;
  let faculty: Awaited<ReturnType<typeof loadFaculty>> | null = null;
  let dbError = false;
  try {
    [student, faculty] = await Promise.all([loadStudent(user.id), loadFaculty(user.id)]);
  } catch {
    dbError = true;
  }

  const uniId = user.registrationNo ?? user.employeeId ?? null;
  const canList = capabilitiesFor(user.role);

  return (
    <>
      <PageHeader
        icon={UserCircle}
        title="My Profile"
        description="Your university identity, the record attached to it, and what your role can do in the portal."
      />

      {dbError ? (
        <Alert variant="destructive">
          <AlertTitle>Profile record unavailable</AlertTitle>
          <AlertDescription>The database didn&apos;t answer — try again in a moment.</AlertDescription>
        </Alert>
      ) : null}

      {sp.error ? (
        <Alert variant="destructive">
          <AlertTitle>That didn&apos;t save</AlertTitle>
          <AlertDescription>{sp.error}</AlertDescription>
        </Alert>
      ) : null}
      {sp.saved ? (
        <Alert variant="success">
          <AlertTitle>Profile updated</AlertTitle>
          <AlertDescription>Your name and department are saved.</AlertDescription>
        </Alert>
      ) : null}
      {sp.photo ? (
        <Alert variant="success">
          <AlertTitle>Profile photo updated</AlertTitle>
          <AlertDescription>Your new photo is stored in the university database and now shows on your profile and the top bar.</AlertDescription>
        </Alert>
      ) : null}
      {sp.photoRemoved ? (
        <Alert variant="success">
          <AlertTitle>Profile photo removed</AlertTitle>
          <AlertDescription>The default initials avatar is back on your profile and the top bar.</AlertDescription>
        </Alert>
      ) : null}

      <ProfilePhotoCard
        name={user.name}
        userId={user.id}
        hasAvatar={Boolean(user.avatarMime)}
        version={user.avatarUpdatedAt?.getTime() ?? null}
      />

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <IdCard className="h-4 w-4 text-muted-foreground" />
              University identity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <UserAvatar
                name={user.name}
                userId={user.id}
                hasAvatar={Boolean(user.avatarMime)}
                version={user.avatarUpdatedAt?.getTime() ?? null}
                size={54}
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{user.name}</p>
                <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                  <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                  {user.department ? <span>{user.department}</span> : null}
                </p>
              </div>
            </div>

            <dl className="mt-4 divide-y border-t">
              <Field
                label={user.role === "STUDENT" ? "Student ID / registration no." : "Employee ID"}
                mono
                value={
                  uniId ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[13px] font-semibold text-primary">{uniId}</span>
                      <span className="text-xs text-muted-foreground">(searchable in the portal)</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not assigned yet — ask the administrator.</span>
                  )
                }
              />
              <Field
                label="Email"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {user.email}
                  </span>
                }
              />
              <Field label="Role" value={ROLE_LABELS[user.role]} />
              {user.department ? <Field label="Department" value={user.department} /> : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BadgeCheck className="h-4 w-4 text-muted-foreground" />
              {user.role === "STUDENT" ? "Academic record" : "Service record"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {user.role === "STUDENT" ? (
              student ? (
                <dl className="divide-y">
                  <Field label="Programme" value={student.program} />
                  <Field label="Batch" value={student.batch ?? "—"} />
                  <Field label="Semester" value={student.semester ? `Semester ${student.semester}` : "—"} />
                  <Field label="Section" value={student.section ?? "—"} />
                  <Field label="Active courses" value={`${student.activeCourses} enrolled this semester`} />
                  <Field
                    label="FYP"
                    value={
                      student.fypCount === 0 ? (
                        <span className="text-muted-foreground">No application on file</span>
                      ) : student.supervisor ? (
                        `Supervised by ${student.supervisor}`
                      ) : (
                        `${student.fypCount} application${student.fypCount === 1 ? "" : "s"} on file`
                      )
                    }
                  />
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">No student record is attached to this account yet.</p>
              )
            ) : faculty ? (
              <dl className="divide-y">
                <Field label="Designation" value={faculty.designation ?? "—"} />
                <Field label="Office" value={faculty.office ?? "—"} />
                <Field label="Courses teaching" value={`${faculty.courses} active`} />
                <Field label="FYP groups supervised" value={`${faculty.supervised}`} />
              </dl>
            ) : (
              <dl className="divide-y">
                <Field label="Account type" value={ROLE_LABELS[user.role]} />
                <Field label="Sign-in" value="Single sign-in — this account opens the portal for your role only." />
              </dl>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex-row items-center justify-between gap-2 border-b px-5 py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            What this role can do
          </CardTitle>
          <Badge variant="secondary">{canList.length} capabilities</Badge>
        </CardHeader>
        <CardContent className="p-5">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {canList.map((cap) => (
              <li key={cap} className="flex items-start gap-2 text-[13px]">
                <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {CAPABILITY_LABELS[cap]}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Permissions are enforced server-side on every page and action — the portal re-checks your role from the database on
            each request.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

async function loadStudent(userId: string) {
  const [profile, activeCourses, fyp] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId } }),
    prisma.enrollment.count({ where: { studentId: userId, status: "ACTIVE" } }),
    prisma.fypApplication.findFirst({
      where: { applicantId: userId },
      orderBy: { createdAt: "desc" },
      include: { supervisor: { select: { name: true } } },
    }),
  ]);
  const count = await prisma.fypApplication.count({ where: { applicantId: userId } });
  return {
    program: profile?.program ?? "BSCS",
    batch: profile?.batch ?? null,
    semester: profile?.semester ?? null,
    section: profile?.section ?? null,
    activeCourses,
    fypCount: count,
    supervisor: fyp?.supervisor?.name ?? null,
  };
}

async function loadFaculty(userId: string) {
  const [profile, courses, supervised] = await Promise.all([
    prisma.facultyProfile.findUnique({ where: { userId } }),
    prisma.courseClass.count({ where: { facultyId: userId } }),
    prisma.fypApplication.count({ where: { supervisorId: userId } }),
  ]);
  if (!profile && courses === 0 && supervised === 0) return null;
  return { designation: profile?.designation ?? null, office: profile?.office ?? null, courses, supervised };
}



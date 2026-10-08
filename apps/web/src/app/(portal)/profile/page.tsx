import { BadgeCheck, IdCard, Mail, ShieldCheck, UserCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { CAPABILITY_LABELS, capabilitiesFor, ROLE_LABELS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

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
export default async function ProfilePage() {
  const user = await requireUser();

  // The university ID + the role-specific record attached to it.
  let student: Awaited<ReturnType<typeof loadStudent>> | null = null;
  let faculty: Awaited<ReturnType<typeof loadFaculty>> | null = null;
  let mentor: Awaited<ReturnType<typeof loadMentor>> | null = null;
  let dbError = false;
  try {
    [student, faculty, mentor] = await Promise.all([loadStudent(user.id), loadFaculty(user.id), loadMentor(user.id)]);
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
              <span className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                {initials(user.name)}
              </span>
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
                {mentor ? (
                  <>
                    <Field label="Mentor headline" value={mentor.headline} />
                    <Field label="Mentees" value={`${mentor.activeMentees} active`} />
                  </>
                ) : null}
              </dl>
            ) : (
              <dl className="divide-y">
                <Field label="Account type" value={ROLE_LABELS[user.role]} />
                <Field label="Sign-in" value="Single sign-in — this account opens the portal for your role only." />
                {mentor ? (
                  <>
                    <Field label="Mentor headline" value={mentor.headline} />
                    <Field label="Company" value={mentor.company ?? "—"} />
                    <Field label="Mentees" value={`${mentor.activeMentees} active`} />
                    <Field label="Profile" value={mentor.isApproved ? "Approved — visible to students" : "Awaiting approval"} />
                  </>
                ) : null}
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

async function loadMentor(userId: string) {
  const profile = await prisma.mentorProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  const activeMentees = await prisma.mentorshipRequest.count({
    where: { mentorId: userId, status: { in: ["PENDING", "ACCEPTED"] } },
  });
  return {
    headline: profile.headline,
    company: profile.company,
    isApproved: profile.isApproved,
    activeMentees,
  };
}

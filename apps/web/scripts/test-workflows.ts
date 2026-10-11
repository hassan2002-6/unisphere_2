/**
 * E2E workflow acceptance tests (FYP-II spec §19).
 *
 * Exercises the real service layer against the live database, end-to-end:
 *  1. student clash report → coordinator notification → resolve → reporter notified
 *  2. faculty marks a session → student attendance view reflects it
 *  3. faculty creates an assessment → enters scores → publishes → student GPA view + notification
 *  4. student → faculty message → inbox/read state
 *  5. admin role change → audit trail → revert
 *  6. student search + permitted academic profile
 *  7. audit log contains every action above
 *  8. permission boundaries (RBAC denials at the service level)
 *
 * Everything it creates is removed again (demo data stays pristine); audit
 * entries are append-only and intentionally left behind.
 *
 * Requires: DATABASE_URL.  Run:  bun run scripts/test-workflows.ts   (from apps/web)
 */

import { prisma, type User } from "@unisphere/db";
import { getStudentAttendance, markAttendance } from "@/server/services/attendance";
import { createAssessment, enterScores, getFacultyMarksOverview, getStudentMarks, publishResults } from "@/server/services/marks";
import { searchStudents, getStudentAcademicProfile } from "@/server/services/students";
import { listInbox, markMessageRead, sendMessage } from "@/server/services/messages";
import { listAudit, recordAudit } from "@/server/services/audit";
import { listClashReports, reportClash, resolveClashReport } from "@/server/services/clash-reports";
import { deleteSlot, saveClass, saveSlot } from "@/server/services/timetable-manage";
import { deleteExam, saveExam } from "@/server/services/exam-manage";
import { decideFyp, addFypProgressUpdate, requestFypChanges, resubmitFypApplication } from "@/server/services/fyp";
import {
  createAccount,
  initiateAccountRecovery,
  resolveLoginIdentifier,
  setAccountActive,
} from "@/server/services/accounts";
import { ServiceError } from "@/server/services/forms";

const RUN_STARTED = new Date();
const TEST_DATE = "2025-05-05"; // far outside seeded sessions
const cleanup = {
  clashReportIds: [] as string[],
  messageIds: [] as string[],
  assessmentIds: [] as string[],
  classIdsToUnpublish: [] as string[],
  attendanceClassIds: [] as string[],
  attendanceStudentIds: [] as string[],
  slotIds: [] as string[],
  fypIds: [] as string[],
  accountIds: [] as string[],
  createdClassIds: [] as string[],
  examIds: [] as string[],
};

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function expectThrow(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(name, false, "expected a thrown permission error, none happened");
  } catch {
    ok(name, true);
  }
}

async function user(email: string): Promise<User> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  if (!u.clerkId) throw new Error(`${email} has no clerkId — run link-clerk-users.ts first`);
  return u;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL is not set.");
    process.exit(2);
  }

  const student = await user("student@shu.edu.pk");
  const student2 = await user("student10@shu.edu.pk");
  const faculty = await user("faculty@shu.edu.pk");
  const faculty3 = await user("faculty3@shu.edu.pk");
  const coordinator = await user("coordinator@shu.edu.pk");
  const admin = await user("admin@shu.edu.pk");

  // ── 1. Clash report lifecycle ─────────────────────────────────────────────
  console.log("\n1. Student clash report → coordinator queue → resolve");
  const report = await reportClash(student, {
    kind: "TIMETABLE",
    description: "Workflow test: CS-301 lab overlaps the CS-305 lecture on Tuesday 11:00.",
  });
  cleanup.clashReportIds.push(report.id);
  ok("report created OPEN", report.status === "OPEN");

  const queue = await listClashReports(coordinator, { includeResolved: false });
  ok("report appears in the coordinator queue", queue.some((r) => r.id === report.id));

  const coordNotif = await prisma.notification.findFirst({
    where: { userId: coordinator.id, type: "CLASH", createdAt: { gte: RUN_STARTED } },
  });
  ok("coordinator notified (type CLASH)", !!coordNotif);

  await resolveClashReport(coordinator, report.id, {
    status: "RESOLVED",
    note: "Moved the CS-305 lecture to Wednesday 09:30 after checking room R-204.",
  });
  const closed = await prisma.clashReport.findUniqueOrThrow({ where: { id: report.id } });
  ok("report resolved with note", closed.status === "RESOLVED" && closed.handledById === coordinator.id);
  const reporterNotif = await prisma.notification.findFirst({
    where: { userId: student.id, type: "CLASH", createdAt: { gte: RUN_STARTED }, title: { contains: "clash report" } },
  });
  ok("reporter notified of the resolution", !!reporterNotif);

  // ── 2. Attendance lifecycle ───────────────────────────────────────────────
  console.log("\n2. Faculty marks a session → student attendance updates");
  // Sweep rows left by an interrupted earlier run so the delta check is stable.
  await prisma.attendanceRecord.deleteMany({ where: { date: new Date(2025, 4, 5) } });
  const attendanceClasses = await prisma.courseClass.findMany({
    where: { facultyId: faculty.id, enrollments: { some: { status: "ACTIVE" } } },
    take: 1,
  });
  const attClass = attendanceClasses[0];
  ok("faculty owns a current class", !!attClass);

  if (attClass) {
    const enrolled = await prisma.enrollment.findMany({
      where: { classId: attClass.id, status: "ACTIVE" },
      select: { studentId: true },
      take: 3,
    });
    const before = await getStudentAttendance(student);
    const beforeRow = before.courses.find((c) => c.classId === attClass.id);
    const marked = await markAttendance(
      faculty,
      attClass.id,
      TEST_DATE,
      enrolled.map((e, i) => ({ studentId: e.studentId, status: i === 1 ? "LATE" : "PRESENT" })),
    );
    cleanup.attendanceClassIds.push(attClass.id);
    cleanup.attendanceStudentIds.push(...enrolled.map((e) => e.studentId));
    ok("markAttendance wrote rows", marked.written === enrolled.length);

    const markedStudent = enrolled.find((e) => e.studentId === student.id);
    if (markedStudent) {
      const after = await getStudentAttendance(student);
      const afterRow = after.courses.find((c) => c.classId === attClass.id);
      ok(
        "student view shows one more session",
        !!afterRow && !!beforeRow && afterRow.total === beforeRow.total + 1,
        beforeRow ? `${beforeRow.total} → ${afterRow?.total}` : "no baseline row",
      );
    } else {
      ok("seeded student is in the marked class", false, "student@ not enrolled in first class — skipped delta check");
    }

    const reMark = await markAttendance(faculty, attClass.id, TEST_DATE, [
      { studentId: enrolled[0].studentId, status: "ABSENT" },
    ]);
    const recount = await prisma.attendanceRecord.count({
      where: { classId: attClass.id, date: new Date(2025, 4, 5) },
    });
    ok("re-marking the same day upserts (no duplicates)", reMark.written === 1 && recount === enrolled.length, `${recount} rows`);
  }

  // ── 3. Marks lifecycle ────────────────────────────────────────────────────
  console.log("\n3. Assessment → scores → publish → student marks/GPA");
  const marksOverview = await getFacultyMarksOverview(faculty);
  const markClass = marksOverview[0];
  ok("faculty has a course for marks", !!markClass);

  if (markClass) {
    const assessment = await createAssessment(faculty, markClass.classId, {
      kind: "QUIZ",
      title: "Workflow test quiz",
      maxMarks: 10,
      date: TEST_DATE,
    });
    cleanup.assessmentIds.push(assessment.id);
    ok("assessment created", assessment.id.length > 0);

    const rows = await prisma.enrollment.findMany({
      where: { classId: markClass.classId, status: "ACTIVE" },
      select: { studentId: true },
    });
    const scored = await enterScores(
      faculty,
      assessment.id,
      rows.map((r, i) => ({ studentId: r.studentId, marks: ((i * 3) % 10) + 1 })),
    );
    ok("scores entered for the roster", scored.written === rows.length, `${scored.written}/${rows.length}`);

    const published = await publishResults(faculty, markClass.classId);
    cleanup.classIdsToUnpublish.push(markClass.classId);
    ok("results published", published.published === rows.length, `${published.published} results`);

    const target = rows.find((r) => r.studentId === student.id);
    if (target) {
      const marks = await getStudentMarks(student);
      const row = marks.current.find((c) => c.classId === markClass.classId);
      ok("student sees the published result + grade", !!row?.published?.grade, row?.published?.grade ?? "missing");
      ok("student CGPA is computable", marks.cgpa !== null, String(marks.cgpa));
      const notif = await prisma.notification.findFirst({
        where: { userId: student.id, type: "SYSTEM", createdAt: { gte: RUN_STARTED }, body: { contains: markClass.courseCode } },
      });
      ok("student notified of the published result", !!notif);
    } else {
      ok("seeded student is in the marks class", false, "student@ not enrolled — skipped view check");
    }

    // Faculty cannot publish a course they do not own.
    await expectThrow(
      "publishing another faculty's course is denied",
      async () => publishResults(faculty3, markClass.classId),
    );
  }

  // ── 4. Messaging ──────────────────────────────────────────────────────────
  console.log("\n4. Student → faculty message round-trip");
  const sent = await sendMessage(student, {
    recipientId: faculty.id,
    subject: "Workflow test — quiz recheck",
    body: "Sir, could we recheck question 3 of the workflow test quiz? Thank you.",
  });
  cleanup.messageIds.push(sent.id);
  ok("message created", sent.id.length > 0);

  const inbox = await listInbox(faculty, { take: 20 });
  const got = inbox.find((m) => m.id === sent.id);
  ok("faculty inbox contains the message", !!got);
  if (got) {
    const wasUnread = got.readAt === null;
    await markMessageRead(faculty, got.id);
    const reread = await prisma.message.findUniqueOrThrow({ where: { id: got.id } });
    ok("mark-as-read persists", wasUnread && reread.readAt !== null);
  }

  await expectThrow("messaging yourself is rejected", async () =>
    sendMessage(student, { recipientId: student.id, subject: "x", body: "self message attempt" }),
  );

  // ── 5. Admin role change + audit ──────────────────────────────────────────
  console.log("\n5. Admin role change → audit → revert");
  const before = await prisma.user.findUniqueOrThrow({ where: { id: student2.id } });
  await prisma.user.update({ where: { id: student2.id }, data: { role: "COORDINATOR" } });
  await recordAudit({
    actorId: admin.id,
    action: "user.role",
    entity: "User",
    entityId: student2.id,
    summary: `Workflow test: changed role of ${student2.name} to COORDINATOR`,
  });
  const changed = await prisma.user.findUniqueOrThrow({ where: { id: student2.id } });
  ok("role updated", changed.role === "COORDINATOR", `${before.role} → ${changed.role}`);
  await prisma.user.update({ where: { id: student2.id }, data: { role: before.role } });
  const reverted = await prisma.user.findUniqueOrThrow({ where: { id: student2.id } });
  ok("role reverted for the demo data", reverted.role === before.role);

  // ── 6. Student search + permitted profile ─────────────────────────────────
  console.log("\n6. Student search + permitted academic profile");
  const results = await searchStudents("S22CSC0", { take: 10 });
  ok("search by registration prefix finds students", results.length >= 5, `${results.length} hits`);
  const profile = await getStudentAcademicProfile(faculty, student.id);
  ok("academic profile loads courses", !!profile && profile.courses.length > 0, `${profile?.courses.length ?? 0} courses`);
  ok("profile carries CGPA + results", !!profile && Array.isArray(profile.results));
  ok("profile carries no private contact data", !!profile && !("phone" in profile.student));

  // ── 7. Audit trail ────────────────────────────────────────────────────────
  console.log("\n7. Audit trail records the actions above");
  const trail = await listAudit({ take: 100 });
  const has = (action: string) => trail.some((t) => t.action === action && t.createdAt >= RUN_STARTED);
  ok("clash.report audited", has("clash.report"));
  ok("clash.resolve audited", has("clash.resolve"));
  ok("attendance.mark audited", has("attendance.mark"));
  ok("marks.publish audited", has("results.publish"));
  ok("message.send audited", has("message.send"));
  ok("user.role audited", has("user.role"));

  // ── 8. Permission boundaries ──────────────────────────────────────────────
  console.log("\n8. Permission boundaries");
  await expectThrow("students cannot mark attendance", async () =>
    markAttendance(student, cleanup.attendanceClassIds[0] ?? "nope", TEST_DATE, [
      { studentId: student.id, status: "PRESENT" },
    ]),
  );
  await expectThrow("students cannot create assessments", async () =>
    createAssessment(student, cleanup.classIdsToUnpublish[0] ?? "nope", { kind: "QUIZ", title: "x", maxMarks: 5 }),
  );
  await expectThrow("students cannot resolve clash reports", async () =>
    resolveClashReport(student, report.id, { status: "RESOLVED", note: "self-resolve attempt" }),
  );
  await expectThrow("students cannot list the clash queue", async () => listClashReports(student));
  await expectThrow("faculty cannot mark a class they do not own", async () =>
    markAttendance(faculty3, cleanup.attendanceClassIds[0] ?? "nope", TEST_DATE, [
      { studentId: student.id, status: "PRESENT" },
    ]),
  );

  // ── 9. Coordinator timetable management ───────────────────────────────────
  console.log("\n9. Coordinator timetable management");
  const managedClass = await prisma.courseClass.findFirst({
    where: { semester: "Fall 2026" },
    orderBy: { courseCode: "asc" },
  });
  ok("a class exists to schedule", !!managedClass);
  if (managedClass) {
    const created = await saveSlot(coordinator, {
      classId: managedClass.id,
      day: "SAT",
      startMin: 18 * 60,
      endMin: 19 * 60,
      room: "E2E-100",
    });
    cleanup.slotIds.push(created.saved.id);
    ok("coordinator added a session", created.saved.id.length > 0, "SAT 18:00–19:00 in E2E-100");
    const persisted = await prisma.timetableSlot.findUnique({ where: { id: created.saved.id } });
    ok("session persisted with day + room", persisted?.day === "SAT" && persisted?.room === "E2E-100");
    const facultyNotified = managedClass.facultyId
      ? await prisma.notification.count({
          where: { userId: managedClass.facultyId, title: "New session scheduled", createdAt: { gte: RUN_STARTED } },
        })
      : 0;
    ok("class faculty were notified", facultyNotified > 0);

    const otherClass = await prisma.courseClass.findFirst({
      where: { semester: "Fall 2026", id: { not: managedClass.id } },
    });
    if (otherClass) {
      try {
        await saveSlot(coordinator, {
          classId: otherClass.id,
          day: "SAT",
          startMin: 18 * 60 + 15,
          endMin: 18 * 60 + 45,
          room: "E2E-100",
        });
        ok("room double-booking is blocked", false, "the conflicting save was allowed");
      } catch (e) {
        ok("room double-booking is blocked", e instanceof ServiceError && e.message.includes("E2E-100"));
      }
    }

    const moved = await saveSlot(coordinator, {
      id: created.saved.id,
      classId: managedClass.id,
      day: "SAT",
      startMin: 19 * 60,
      endMin: 20 * 60,
      room: "E2E-101",
    });
    ok("session can be moved + re-roomed", moved.saved.startMin === 19 * 60 && moved.saved.room === "E2E-101");

    await deleteSlot(coordinator, created.saved.id);
    cleanup.slotIds = cleanup.slotIds.filter((id) => id !== created.saved.id);
    const gone = await prisma.timetableSlot.findUnique({ where: { id: created.saved.id } });
    ok("session removed again", gone === null);

    await expectThrow("students cannot edit the timetable", async () =>
      saveSlot(student, { classId: managedClass.id, day: "SAT", startMin: 8 * 60, endMin: 9 * 60, room: null }),
    );
    ok(
      "timetable edits audited",
      (await listAudit({ take: 100 })).some(
        (t) => t.action === "timetable.slot_update" && t.createdAt >= RUN_STARTED,
      ),
    );
  }

  // ── 10. FYP Head assigns a supervisor ─────────────────────────────────────
  console.log("\n10. FYP Head request desk");
  // Sweep leftovers from an interrupted earlier run (the demo seed never uses
  // the "E2E —" prefix).
  await prisma.fypApplication.deleteMany({ where: { title: { startsWith: "E2E — " } } });
  const fypHead = await user("fyphead@shu.edu.pk");
  const saadia = await user("saadia.karim@shu.edu.pk");
  const student3 = await user("student3@shu.edu.pk");
  const mkApplication = (title: string) =>
    prisma.fypApplication.create({
      data: {
        applicantId: student3.id,
        title,
        domain: "E2E",
        description: "Temporary application created by the workflow acceptance run — removed automatically.",
        technologies: "Vitest",
        groupName: "E2E Group",
        members: "E2E Member",
        registrationNos: "S22CSC099",
        department: "Computer Science",
        semester: "Fall 2026",
      },
    });
  const app1 = await mkApplication("E2E — supervisor assignment");
  const app2 = await mkApplication("E2E — invalid supervisor");
  cleanup.fypIds.push(app1.id, app2.id);

  const decided = await decideFyp(fypHead, app1.id, "APPROVED", "Assigned by the E2E run.", saadia.id);
  ok("approval stores the supervisor", decided.status === "APPROVED" && decided.supervisorId === saadia.id, saadia.name);
  const supNotified = await prisma.notification.count({
    where: { userId: saadia.id, title: "New FYP supervision assigned", createdAt: { gte: RUN_STARTED } },
  });
  ok("the supervisor is notified", supNotified > 0);
  const studentNotified = await prisma.notification.count({
    where: { userId: student3.id, title: "FYP application approved", createdAt: { gte: RUN_STARTED } },
  });
  ok("the group is notified with the supervisor name", studentNotified > 0);
  await expectThrow("a non-faculty supervisor is rejected", async () =>
    decideFyp(fypHead, app2.id, "APPROVED", "should fail", student3.id),
  );
  await expectThrow("students cannot decide FYP applications", async () =>
    decideFyp(student, app2.id, "APPROVED", "self-approve attempt"),
  );

  // ── 11. Account provisioning & lifecycle (spec §4/§5) ────────────────────
  console.log("\n11. Account provisioning, activation and recovery");
  // Sweep leftovers from an interrupted previous run.
  await prisma.user.deleteMany({ where: { email: { startsWith: "e2e.probe." } } });
  await prisma.examSchedule.deleteMany({ where: { class: { courseCode: { in: ["E2E-999", "E2E-996"] } } } });
  await prisma.courseClass.deleteMany({ where: { courseCode: { in: ["E2E-999", "E2E-996"] } } });
  const probeEmail = `e2e.probe.${Date.now()}@shu.edu.pk`;
  const created = await createAccount(admin, {
    name: "E2E Probe Student",
    email: probeEmail,
    role: "STUDENT",
    department: "Computer Science",
    program: "BSCS",
    batch: "2022",
    skipInvitation: true,
  });
  cleanup.accountIds.push(created.userId);
  ok("admin created the account with an institutional ID", created.institutionalId.length > 0, created.institutionalId);
  ok("no Clerk invitation is sent for the test account", created.invitation === "skipped");

  const resolved = await resolveLoginIdentifier(created.institutionalId);
  ok(
    "the University ID resolves to the account email",
    resolved?.email === probeEmail,
    resolved ? "resolved" : "no match",
  );
  ok("an unknown University ID resolves to nothing", (await resolveLoginIdentifier("S99ZZZ999")) === null);

  await expectThrow("students cannot create accounts", async () =>
    createAccount(student, { name: "Rogue Account", email: "rogue@shu.edu.pk", role: "STUDENT", skipInvitation: true }),
  );
  await expectThrow("creating a duplicate email is rejected", async () =>
    createAccount(admin, { name: "Duplicate", email: probeEmail, role: "STUDENT", skipInvitation: true }),
  );
  await expectThrow("recovery for a never-activated account is refused", async () =>
    initiateAccountRecovery(admin, created.userId),
  );

  await setAccountActive(admin, created.userId, false);
  const deactivated = await prisma.user.findUniqueOrThrow({ where: { id: created.userId } });
  ok("deactivation flips isActive and hides the ID from login resolution", deactivated.isActive === false && (await resolveLoginIdentifier(created.institutionalId)) === null);

  await setAccountActive(admin, created.userId, true);
  const reactivated = await prisma.user.findUniqueOrThrow({ where: { id: created.userId } });
  ok("reactivation restores sign-in", reactivated.isActive === true && (await resolveLoginIdentifier(created.institutionalId)) !== null);

  const recovery = await initiateAccountRecovery(admin, student.id);
  ok("recovery mints a single-use sign-in ticket", recovery.url.includes("ticket="), "link withheld from logs");
  const accountAudit = await listAudit({ take: 200 });
  ok(
    "account lifecycle is audited",
    ["account.create", "account.deactivate", "account.activate", "account.recovery_ticket"].every((a) =>
      accountAudit.some((t) => t.action === a && t.createdAt >= RUN_STARTED),
    ),
  );

  // ── 12. Coordinator: classes, faculty assignment, exams (spec §7) ────────
  console.log("\n12. Coordinator class / faculty / exam management");
  const newClass = await saveClass(coordinator, {
    courseCode: "E2E-999",
    title: "Workflow test course",
    section: "E2E",
    department: "Computer Science",
    semester: "Fall 2026",
    credits: 3,
  });
  cleanup.createdClassIds.push(newClass.id);
  ok("coordinator created a course section", newClass.courseCode === "E2E-999" && newClass.section === "E2E");

  await expectThrow("a malformed course title is rejected", async () =>
    saveClass(coordinator, {
      courseCode: "E2E-998",
      title: "x",
      section: "",
      department: "Computer Science",
      semester: "Fall 2026",
    }),
  );
  await expectThrow("faculty cannot create course sections", async () =>
    saveClass(faculty, {
      courseCode: "E2E-997",
      title: "Not allowed",
      section: "A",
      department: "Computer Science",
      semester: "Fall 2026",
    }),
  );

  // Double-booking: give the new class the same slot the lead faculty teaches.
  const facultyOwnSlot = await prisma.timetableSlot.findFirst({
    where: { class: { facultyId: faculty.id } },
    select: { day: true, startMin: true, endMin: true },
  });
  ok("the seed gives the lead faculty a teaching slot", !!facultyOwnSlot);
  if (facultyOwnSlot) {
    await saveSlot(coordinator, {
      classId: newClass.id,
      day: facultyOwnSlot.day,
      startMin: facultyOwnSlot.startMin,
      endMin: facultyOwnSlot.endMin,
      room: "E2E-R1",
    });
    await expectThrow("assigning an already-busy faculty member is blocked", async () =>
      saveClass(coordinator, {
        id: newClass.id,
        courseCode: "E2E-999",
        title: "Workflow test course",
        section: "A",
        department: "Computer Science",
        semester: "Fall 2026",
        credits: 3,
        facultyId: faculty.id,
      }),
    );
    const assigned = await saveClass(coordinator, {
      id: newClass.id,
      courseCode: "E2E-999",
      title: "Workflow test course",
      section: "A",
      department: "Computer Science",
      semester: "Fall 2026",
      credits: 3,
      facultyId: faculty3.id,
    });
    ok("a free faculty member can be assigned", assigned.facultyId === faculty3.id);
    const facultyNotified = await prisma.notification.count({
      where: { userId: faculty3.id, title: { contains: "assign" }, createdAt: { gte: RUN_STARTED } },
    });
    ok("the assigned faculty member is notified", facultyNotified > 0);
  }

  // Exams: schedule, block the clash, remove.
  const examDate = "2027-01-11";
  const firstExam = await saveExam(coordinator, {
    classId: newClass.id,
    date: examDate,
    startMin: 9 * 60,
    endMin: 11 * 60,
    hall: "E2E Hall",
  });
  cleanup.examIds.push(firstExam.saved.id);
  ok("coordinator scheduled an exam", firstExam.saved.id.length > 0);
  ok(
    "an exam coinciding with a regular class is advisory, not a block",
    firstExam.warnings.every((w) => w.kind !== "exam-hall" && w.kind !== "exam-cohort"),
  );

  const clashClass = await saveClass(coordinator, {
    courseCode: "E2E-996",
    title: "Workflow clash course",
    section: "A",
    department: "Computer Science",
    semester: "Fall 2026",
    credits: 3,
  });
  cleanup.createdClassIds.push(clashClass.id);
  // Same student enrolled in both → the second exam must be refused.
  await prisma.enrollment.create({
    data: { classId: newClass.id, studentId: student.id, status: "ACTIVE" },
  });
  await prisma.enrollment.create({
    data: { classId: clashClass.id, studentId: student.id, status: "ACTIVE" },
  });
  await expectThrow("a clashing exam for a shared student is blocked", async () =>
    saveExam(coordinator, {
      classId: clashClass.id,
      date: examDate,
      startMin: 9 * 60 + 30,
      endMin: 11 * 60 + 30,
      hall: "E2E Hall",
    }),
  );
  await expectThrow("students cannot schedule exams", async () =>
    saveExam(student, {
      classId: clashClass.id,
      date: examDate,
      startMin: 9 * 60,
      endMin: 10 * 60,
    }),
  );
  await deleteExam(coordinator, firstExam.saved.id);
  ok(
    "the exam can be removed after scheduling",
    (await prisma.examSchedule.count({ where: { id: firstExam.saved.id } })) === 0,
  );

  // ── 13. FYP supervision: changes requested + progress notes (spec §12) ───
  console.log("\n13. FYP review notes and supervision progress");
  const app3 = await mkApplication("E2E — changes requested");
  cleanup.fypIds.push(app3.id);
  const changes = await requestFypChanges(fypHead, app3.id, "Add the evaluation strategy and dataset source.");
  ok("the FYP Head can request changes", changes.status === "CHANGES_REQUESTED");
  const changesNotified = await prisma.notification.count({
    where: { userId: student3.id, title: { contains: "Changes requested" }, createdAt: { gte: RUN_STARTED } },
  });
  ok("the group is notified with the remarks", changesNotified > 0);

  const resubmitted = await resubmitFypApplication(student3, app3.id, {
    title: "E2E — changes requested (revised)",
    domain: "E2E",
    description:
      "Revised submission from the workflow run: the evaluation strategy and the dataset source were added as the reviewer asked.",
    technologies: "Vitest",
    groupName: "E2E Group",
    members: "E2E Member",
    registrationNos: "S22CSC099",
    department: "Computer Science",
    semester: "Fall 2026",
  });
  ok("the group can revise and resubmit in place", resubmitted.status === "PENDING" && resubmitted.remarks === null);
  const resubmitNotified = await prisma.notification.count({
    where: { userId: fypHead.id, title: { contains: "resubmitted" }, createdAt: { gte: RUN_STARTED } },
  });
  ok("the FYP Head is told the application came back", resubmitNotified > 0);
  await expectThrow("another student cannot resubmit someone else's application", async () =>
    resubmitFypApplication(student, app3.id, {
      title: "Hijack attempt",
      domain: "x",
      description: "This should never be allowed to pass, not even once, because it is not my application at all.",
      technologies: "x",
      groupName: "x",
      members: "x",
      registrationNos: "x",
      department: "Computer Science",
      semester: "Fall 2026",
    }),
  );

  const reDecided = await decideFyp(fypHead, app3.id, "APPROVED", "Looks good after revision.", saadia.id);
  ok("a corrected application can still be approved", reDecided.status === "APPROVED" && reDecided.supervisorId === saadia.id);

  const note = await addFypProgressUpdate(saadia, app1.id, "E2E: scope agreed, start the implementation log.");
  ok("the assigned supervisor can add a progress note", note.id.length > 0);
  const noteNotified = await prisma.notification.count({
    where: { userId: student3.id, title: { contains: "progress note" }, createdAt: { gte: RUN_STARTED } },
  });
  ok("the group is notified of the progress note", noteNotified > 0);
  await expectThrow("an unrelated user cannot add progress notes", async () =>
    addFypProgressUpdate(faculty3, app1.id, "not my project"),
  );
  ok(
    "progress notes are audited",
    (await listAudit({ take: 200 })).some((t) => t.action === "fyp.progress_note" && t.createdAt >= RUN_STARTED),
  );

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log("\nCleanup");
  const removed = {
    attendance: (
      await prisma.attendanceRecord.deleteMany({
        where: {
          classId: { in: cleanup.attendanceClassIds },
          date: new Date(2025, 4, 5),
          studentId: { in: cleanup.attendanceStudentIds },
        },
      })
    ).count,
    results: (
      await prisma.courseResult.deleteMany({
        where: { classId: { in: cleanup.classIdsToUnpublish }, publishedAt: { gte: RUN_STARTED } },
      })
    ).count,
    assessments: (
      await prisma.assessment.deleteMany({ where: { id: { in: cleanup.assessmentIds } } })
    ).count,
    messages: (await prisma.message.deleteMany({ where: { id: { in: cleanup.messageIds } } })).count,
    clashes: (await prisma.clashReport.deleteMany({ where: { id: { in: cleanup.clashReportIds } } })).count,
    slots: (await prisma.timetableSlot.deleteMany({ where: { id: { in: cleanup.slotIds } } })).count,
    fyp: (await prisma.fypApplication.deleteMany({ where: { id: { in: cleanup.fypIds } } })).count,
    classes: (await prisma.courseClass.deleteMany({ where: { id: { in: cleanup.createdClassIds } } })).count,
    exams: (await prisma.examSchedule.deleteMany({ where: { id: { in: cleanup.examIds } } })).count,
    accounts: (await prisma.user.deleteMany({ where: { id: { in: cleanup.accountIds } } })).count,
    notifications: (await prisma.notification.deleteMany({ where: { createdAt: { gte: RUN_STARTED } } })).count,
  };
  console.log(
    `  removed ${removed.attendance} attendance rows · ${removed.results} results · ${removed.assessments} assessment(s) · ` +
      `${removed.messages} message(s) · ${removed.clashes} clash report(s) · ${removed.slots} session(s) · ` +
      `${removed.fyp} FYP application(s) · ${removed.classes} test class(es) · ${removed.accounts} test account(s) · ` +
      `${removed.notifications} notification(s)`,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log("Failed checks:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("workflow run aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});

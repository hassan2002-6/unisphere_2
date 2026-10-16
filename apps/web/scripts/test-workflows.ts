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
import {
  deleteSlot,
  getTimetableUpdatedAtFor,
  listTimetableRevisions,
  previewSlotChange,
  revertToRevision,
  saveClass,
  saveSlot,
} from "@/server/services/timetable-manage";
import { deleteExam, saveExam } from "@/server/services/exam-manage";
import { decideFyp, addFypProgressUpdate, requestFypChanges, resubmitFypApplication } from "@/server/services/fyp";
import {
  createAccount,
  initiateAccountRecovery,
  resolveLoginIdentifier,
  setAccountActive,
} from "@/server/services/accounts";
import {
  createAssignment,
  getFacultyAssignment,
  getSubmissionFile,
  gradeSubmission,
  listMyAssignments,
  submitAssignment,
  updateAssignment,
} from "@/server/services/assignments";
import {
  actOnComplaint,
  addInternalNote,
  countUnreadComplaints,
  createComplaint,
  getComplaint,
  listInboxComplaints,
  listManagedComplaints,
  markComplaintRead,
  replyToComplaint,
} from "@/server/services/complaints";
import { createComplaintCategory, upsertComplaintRoute } from "@/server/services/complaints-admin";
import { decideSubmission, getSubmissionAttachment, getSubmissionPdfData, resubmitForm, submitForm } from "@/server/services/forms";
import { ServiceError } from "@/server/services/forms";
import { getAvatarImage, removeAvatar, setAvatar } from "@/server/services/profiles";
import { getAdmitCardRule, getEligibility, missingPrerequisites, setAdmitCardRule } from "@/server/services/admit-cards";
import { createCorrectionRequest, decideCorrection, listCorrectionRequests } from "@/server/services/corrections";
import { renderSubmissionPdf } from "@/server/pdf";
import { inflateSync } from "node:zlib";

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
  assignmentIds: [] as string[],
  submissionIds: [] as string[],
  complaintIds: [] as string[],
  complaintRouteIds: [] as string[],
  formSubmissionIds: [] as string[],
  correctionIds: [] as string[],
  templateIds: [] as string[],
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
  const fyphead = await user("fyphead@shu.edu.pk");
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

  // ── 14. Assignments: author → submit → grade (spec §4) ───────────────────
  console.log("\n14. Assignments lifecycle");
  await prisma.assignment.deleteMany({ where: { title: { startsWith: "E2E — " } } });
  const aClass = await prisma.courseClass.findFirst({
    where: { facultyId: faculty.id, enrollments: { some: { studentId: student.id, status: "ACTIVE" } } },
    orderBy: { courseCode: "asc" },
  });
  ok("faculty teaches a class the student is enrolled in", !!aClass);
  if (aClass) {
    const asg = await createAssignment(faculty, {
      classId: aClass.id,
      title: "E2E — Lab Report",
      instructions: "Workflow test assignment — upload a short PDF to exercise the full path.",
      deadline: new Date(Date.now() + 3 * 86_400_000),
      maxMarks: 10,
      allowedTypes: "pdf,txt",
    });
    cleanup.assignmentIds.push(asg.id);
    ok("assignment created (open)", asg.closedAt === null);

    const myList = await listMyAssignments(student);
    ok("enrolled student sees it in /assignments", myList.some((a) => a.id === asg.id));

    const outsider = await prisma.user.findFirst({
      where: {
        role: "STUDENT",
        isActive: true,
        id: { notIn: [student.id, student2.id] },
        enrollments: { none: { classId: aClass.id } },
      },
      select: { id: true },
    });
    if (outsider) {
      const notEnrolled = await prisma.user.findUniqueOrThrow({ where: { id: outsider.id } });
      await expectThrow("a student outside the class cannot submit", async () =>
        submitAssignment(notEnrolled, asg.id, { fileName: "x.pdf", fileMime: "application/pdf", fileData: Buffer.from("nope") }),
      );
    }
    await expectThrow("a disallowed file type is rejected", async () =>
      submitAssignment(student, asg.id, { fileName: "notes.exe", fileMime: "application/octet-stream", fileData: Buffer.from("MZ") }),
    );

    const submission = await submitAssignment(student, asg.id, {
      fileName: "lab-report.pdf",
      fileMime: "application/pdf",
      fileData: Buffer.from("%PDF-1.4 E2E workflow test"),
      note: "First draft.",
    });
    cleanup.submissionIds.push(submission.id);
    ok("submission stored and on time", submission.isLate === false && submission.marks === null);

    const staffView = await getFacultyAssignment(faculty, asg.id);
    ok("faculty submission table lists it", staffView.assignment.submissions.some((s) => s.id === submission.id));

    const graded = await gradeSubmission(faculty, submission.id, { marks: 8, feedback: "Solid — add a conclusion." });
    ok("graded with marks + feedback", graded.marks === 8 && graded.gradedAt !== null);
    ok(
      "student notified about the grade",
      (await prisma.notification.count({ where: { userId: student.id, type: "ASSIGNMENT", title: "Assignment graded", createdAt: { gte: RUN_STARTED } } })) > 0,
    );

    const file = await getSubmissionFile(student, submission.id);
    ok("owner downloads the submitted file", file.fileName === "lab-report.pdf" && file.data.length > 0);
    await expectThrow("an unrelated user cannot download it", async () => getSubmissionFile(student2, submission.id));

    const closed = await updateAssignment(faculty, asg.id, { closed: true });
    ok("assignment can be closed", closed.closedAt !== null);
    await expectThrow("closed assignments refuse further submissions", async () =>
      submitAssignment(student, asg.id, { fileName: "again.pdf", fileMime: "application/pdf", fileData: Buffer.from("x") }),
    );
  }

  // ── 15. Complaints: routing → internal notes → escalate → resolve (spec §6) ─
  console.log("\n15. Complaints pipeline");
  await prisma.complaint.deleteMany({ where: { subject: { startsWith: "E2E — " } } });
  const e2eCat = await prisma.complaintCategory.findUnique({ where: { key: "e2e-workflow" } });
  if (!e2eCat) {
    try {
      await createComplaintCategory(admin, { key: "e2e-workflow", label: "E2E Workflow" });
    } catch {
      /* raced or already created by an interrupted run */
    }
  }
  const route = await upsertComplaintRoute(admin, null, {
    categoryKey: "e2e-workflow",
    targetRole: "ADMIN",
    targetUserId: null,
    defaultPriority: "MEDIUM",
    escalateAfterHours: 48,
    escalateToRole: "COORDINATOR",
    sortOrder: 99,
    active: true,
  });
  cleanup.complaintRouteIds.push(route.id);

  const complaint = await createComplaint(student, {
    subject: "E2E — Projector flickers in R-204",
    category: "e2e-workflow",
    description: "Workflow test: the projector in R-204 flickers and shuts off mid-lecture.",
  });
  cleanup.complaintIds.push(complaint.id);
  ok("reference number issued", /^[A-Z]+-\d{4}-\d{4,}$/.test(complaint.refNo), complaint.refNo);
  ok("routing auto-assigned a handler", complaint.assignedToId !== null);
  ok("routing set the rule's priority", complaint.priority === "MEDIUM");
  ok("escalation deadline set from the rule", complaint.dueAt !== null);

  const managerId = complaint.assignedToId;
  const manager = managerId ? await prisma.user.findUniqueOrThrow({ where: { id: managerId } }) : admin;
  await actOnComplaint(manager, complaint.id, "acknowledge", { comment: "Received — inspecting the room." });
  const afterAck = await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } });
  ok("acknowledged → IN_REVIEW + claimed", afterAck.status === "IN_REVIEW" && afterAck.assignedToId === manager.id);

  await addInternalNote(manager, complaint.id, "Facilities says the lamp module is end-of-life.");
  const managerView = await getComplaint(manager, complaint.id);
  const studentView = await getComplaint(student, complaint.id);
  ok(
    "internal note visible to staff only",
    managerView.events.some((e) => e.visibility === "INTERNAL") && !studentView.events.some((e) => e.visibility === "INTERNAL"),
  );

  await replyToComplaint(student, complaint.id, "It happens after about 20 minutes of use.");
  ok(
    "student reply lands in the trail",
    (await prisma.complaintEvent.count({ where: { complaintId: complaint.id, actorId: student.id, comment: { contains: "20 minutes" } } })) > 0,
  );

  await actOnComplaint(manager, complaint.id, "escalate", { comment: "Needs a budget approval for a replacement." });
  const escalated = await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } });
  ok("escalation bumps priority to HIGH", escalated.priority === "HIGH");
  ok(
    "escalation is recorded",
    (await prisma.complaintEvent.count({ where: { complaintId: complaint.id, kind: "ESCALATION" } })) > 0,
  );

  await actOnComplaint(manager, complaint.id, "resolve", { comment: "Replacement lamp fitted; verified working." });
  const resolvedRow = await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } });
  ok("manager resolves the complaint", resolvedRow.status === "RESOLVED");
  ok(
    "submitter notified of the resolution",
    (await prisma.notification.count({ where: { userId: student.id, type: "COMPLAINT", createdAt: { gte: RUN_STARTED } } })) > 0,
  );
  const managedQueue = await listManagedComplaints(manager, { q: complaint.refNo });
  ok("management queue filters by reference number", managedQueue.items.some((c) => c.id === complaint.id));

  await actOnComplaint(manager, complaint.id, "close", { comment: "Closing after confirmation." });
  ok("resolved complaint closes", (await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } })).status === "CLOSED");
  await expectThrow("a student cannot act as office staff", async () =>
    actOnComplaint(student, complaint.id, "close", {}),
  );

  // ── 16. Forms: corrections round-trip + supporting document (spec §7/§D) ──
  console.log("\n16. Form corrections + supporting document");
  const tpl = await prisma.formTemplate.findFirst({
    where: { active: true, audienceRole: "STUDENT", reviewerRole: "COORDINATOR" },
    orderBy: { title: "asc" },
  });
  ok("a student form with a coordinator reviewer exists", !!tpl);
  if (tpl) {
    type FSpec = { name: string; type: string; required: boolean; options?: string[] };
    const specs = (tpl.fields as FSpec[]).filter((f) => f && typeof f.name === "string");
    const buildPayload = () => {
      const payload: Record<string, unknown> = {};
      for (const f of specs) {
        if (!f.required) continue;
        payload[f.name] =
          f.type === "number" ? 5 : f.type === "date" ? "2026-05-05" : f.type === "select" ? (f.options?.[0] ?? "Yes") : f.type === "checkbox" ? true : "E2E workflow test entry";
      }
      return payload;
    };

    const formSub = await submitForm(student, tpl.key, buildPayload());
    cleanup.formSubmissionIds.push(formSub.id);
    ok("form submitted (status SUBMITTED)", formSub.status === "SUBMITTED");

    const correctable = await decideSubmission(coordinator, formSub.id, "CORRECTIONS_REQUESTED", "Please attach evidence and fix the semester.");
    ok("reviewer requests corrections", correctable.status === "CORRECTIONS_REQUESTED");

    const revised = await resubmitForm(student, formSub.id, buildPayload(), {
      name: "e2e-evidence.pdf",
      mime: "application/pdf",
      data: Buffer.from("%PDF-1.4 E2E evidence"),
    });
    ok("resubmission re-enters the queue", revised.status === "SUBMITTED");
    ok("supporting document stored", revised.attachmentName === "e2e-evidence.pdf");

    const reviewerFile = await getSubmissionAttachment(coordinator, formSub.id);
    ok("reviewer can open the document", reviewerFile.fileName === "e2e-evidence.pdf" && reviewerFile.data.length > 0);
    await expectThrow("an unrelated user cannot open it", async () => getSubmissionAttachment(student2, formSub.id));

    const events = await prisma.formEvent.findMany({ where: { submissionId: formSub.id }, orderBy: { createdAt: "asc" } });
    ok(
      "trail shows submit → corrections → resubmit",
      events.some((e) => e.toStatus === "SUBMITTED") &&
        events.some((e) => e.toStatus === "CORRECTIONS_REQUESTED") &&
        events.length >= 3,
    );

    const approved = await decideSubmission(coordinator, formSub.id, "APPROVED", "All good now.");
    ok("corrected submission can then be approved", approved.status === "APPROVED");
  }

  // ── 17. Profile photo persists (spec §14.12) ─────────────────────────────
  console.log("\n17. Profile photo persistence");
  const pngBytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32, 1),
  ]);
  await setAvatar(student.id, student, { name: "e2e-avatar.png", data: pngBytes });
  const afterSet = await prisma.user.findUniqueOrThrow({ where: { id: student.id }, select: { avatarMime: true, avatarData: true } });
  ok("avatar stored in the database (png)", afterSet.avatarMime === "image/png" && (afterSet.avatarData?.length ?? 0) === pngBytes.length);
  const fetched = await getAvatarImage(student.id);
  ok("avatar readable after a fresh load", fetched !== null && fetched.mime === "image/png");
  await expectThrow("a non-image is rejected", async () =>
    setAvatar(student.id, student, { name: "fake.png", data: Buffer.from("MZ definitely not an image") }),
  );
  await expectThrow("another student cannot change your photo", async () =>
    setAvatar(student.id, student2, { name: "x.png", data: pngBytes }),
  );
  await removeAvatar(student.id, student);
  ok("avatar removed cleanly", (await prisma.user.findUniqueOrThrow({ where: { id: student.id }, select: { avatarMime: true } })).avatarMime === null);

  // ── 18. Multi-recipient complaint: To acts, CC is read-only (goal §8) ────
  console.log("\n18. Multi-recipient complaint (To + CC)");
  const mrc = await createComplaint(student, {
    subject: "E2E — Multi-recipient equipment shortage",
    category: "e2e-workflow",
    description: "Workflow test: sent to one faculty member with two staff members in CC.",
    toIds: [faculty.id],
    ccIds: [coordinator.id, fyphead.id],
  });
  cleanup.complaintIds.push(mrc.id);
  const recipientRows = await prisma.complaintRecipient.findMany({ where: { complaintId: mrc.id } });
  ok(
    "one canonical record with To + CC recipient rows",
    recipientRows.length === 3 &&
      recipientRows.filter((r) => r.role === "TO").length === 1 &&
      recipientRows.filter((r) => r.role === "CC").length === 2 &&
      (await prisma.complaint.count({ where: { subject: mrc.subject } })) === 1,
  );
  ok("primary owner is the first To recipient", mrc.assignedToId === faculty.id);
  const facultyInbox = await listInboxComplaints(faculty, { view: "inbox" });
  const coordInbox = await listInboxComplaints(coordinator, { view: "inbox" });
  const headInbox = await listInboxComplaints(fyphead, { view: "inbox" });
  ok("To recipient sees it in their inbox", facultyInbox.items.some((c) => c.id === mrc.id));
  ok(
    "CC recipients see it in their inboxes",
    coordInbox.items.some((c) => c.id === mrc.id) && headInbox.items.some((c) => c.id === mrc.id),
  );
  ok(
    "unread view + count include it while unread",
    (await listInboxComplaints(faculty, { view: "unread" })).items.some((c) => c.id === mrc.id) &&
      (await countUnreadComplaints(faculty)) >= 1,
  );
  const facultyView = await getComplaint(faculty, mrc.id);
  const headView = await getComplaint(fyphead, mrc.id);
  ok("recipients can open the record with recipient details", facultyView.recipients.length === 3 && headView.recipients.length === 3);
  ok("To may act; a plain CC recipient (no desk powers) may not", facultyView.canAct === true && headView.canAct === false);
  await expectThrow("CC without desk powers cannot resolve", async () =>
    actOnComplaint(fyphead, mrc.id, "resolve", { comment: "CC must not act on this record." }),
  );
  const ccNotices = await prisma.notification.count({
    where: {
      userId: { in: [coordinator.id, fyphead.id] },
      type: "COMPLAINT",
      title: { startsWith: "CC: " },
      createdAt: { gte: RUN_STARTED },
    },
  });
  ok("CC recipients were notified with a distinguishable CC title", ccNotices >= 2);
  await actOnComplaint(faculty, mrc.id, "acknowledge", { comment: "Received — checking the lab stores." });
  await actOnComplaint(faculty, mrc.id, "respond", { comment: "Restock request sent to stores; refill expected by Thursday." });
  const studentUpdates = await getComplaint(student, mrc.id);
  ok(
    "student sees the permitted update + history",
    studentUpdates.events.some((e) => e.comment?.includes("Restock request")) &&
      studentUpdates.events.some((e) => e.comment?.includes("Received — checking")),
  );
  await markComplaintRead(coordinator, mrc.id);
  ok(
    "read state is per-recipient",
    (await prisma.complaintRecipient.findFirstOrThrow({ where: { complaintId: mrc.id, userId: coordinator.id } })).readAt !== null &&
      (await prisma.complaintRecipient.findFirstOrThrow({ where: { complaintId: mrc.id, userId: fyphead.id } })).readAt === null,
  );

  // ── 19. Form finalization → PDF (goal §9 required test) ──────────────────
  console.log("\n19. Form finalization → PDF");
  if (tpl) {
    type FSpec19 = { name: string; type: string; required: boolean; options?: string[] };
    const specs19 = (tpl.fields as FSpec19[]).filter((f) => f && typeof f.name === "string");
    const payload19: Record<string, unknown> = {};
    for (const f of specs19) {
      if (!f.required) continue;
      payload19[f.name] =
        f.type === "number" ? 5 : f.type === "date" ? "2026-06-06" : f.type === "select" ? (f.options?.[0] ?? "Yes") : f.type === "checkbox" ? true : "E2E PDF test entry";
    }
    const pdfSub = await submitForm(student, tpl.key, payload19);
    cleanup.formSubmissionIds.push(pdfSub.id);
    const preApproval = await getSubmissionPdfData(student, pdfSub.id);
    ok("pre-approval read carries no finalized date", preApproval.finalizedAt === null);
    await decideSubmission(coordinator, pdfSub.id, "APPROVED", "Approved — generating the finalized record.");
    const pdfData = await getSubmissionPdfData(student, pdfSub.id);
    ok(
      "finalized data available after approval",
      pdfData.status === "APPROVED" && pdfData.finalizedAt !== null && /^FRM-\d{4}-/.test(pdfData.refNo),
      pdfData.refNo,
    );
    ok(
      "approval history records the actor, role and decision",
      pdfData.approvals.some((a) => a.actorName === coordinator.name && a.decision === "APPROVED" && a.actorRole === "COORDINATOR"),
    );
    const pdfBytes = Buffer.from(
      await renderSubmissionPdf({
        refNo: pdfData.refNo,
        title: pdfData.title,
        status: pdfData.status,
        submittedBy: {
          name: pdfData.submittedBy.name,
          role: pdfData.submittedBy.role,
          email: pdfData.submittedBy.email,
          registrationNo: pdfData.submittedBy.registrationNo,
        },
        submittedAt: pdfData.submittedAt,
        finalizedAt: pdfData.finalizedAt,
        fields: pdfData.fields.map((f) => ({ label: f.label, value: f.value })),
        approvals: pdfData.approvals.map((a) => ({
          step: a.step,
          decision: a.decision,
          actorName: a.actorName,
          actorRole: a.actorRole,
          at: a.at,
          comment: a.comment,
        })),
      }),
    );
    ok("PDF renders with a valid header", pdfBytes.subarray(0, 5).toString("latin1").startsWith("%PDF-"), `${pdfBytes.length} bytes`);
    const rawPdf = pdfBytes.toString("latin1");
    let pdfText = rawPdf;
    for (const m of rawPdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      let content = m[1];
      try {
        content = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
      } catch {
        /* stream not flate-compressed — use the raw slice */
      }
      pdfText += content;
      // pdf-lib draws text as hex strings: <hexbytes> Tj — decode them.
      for (const hm of content.matchAll(/<([0-9A-Fa-f]{4,})>\s*Tj/g)) {
        const hx = hm[1];
        if (hx.length % 2) continue;
        const raw = Buffer.from(hx, "hex");
        if (/^feff/i.test(hx)) {
          const swapped = Buffer.from(raw);
          swapped.swap16();
          pdfText += swapped.toString("utf16le");
        } else {
          pdfText += raw.toString("latin1");
        }
      }
    }
    ok(
      "PDF embeds the reference number + the approval-record label",
      pdfText.includes(pdfData.refNo) && pdfText.includes("In-portal approval record"),
    );
  }

  // ── 20. Admit-card eligibility gate (goal §10 required test) ─────────────
  console.log("\n20. Admit-card eligibility (prerequisite gate)");
  const baseRule = await getAdmitCardRule();
  const admitKey = `e2e-admit-${Date.now()}`;
  const admitTpl = await prisma.formTemplate.create({
    data: {
      key: admitKey,
      title: "E2E Admit Prerequisite Form",
      description: "Temporary template created by the E2E suite.",
      audienceRole: "STUDENT",
      reviewerRole: "COORDINATOR",
      recipientLabel: "Examination Office",
      fields: [{ name: "ack", label: "Acknowledge the examination rules", type: "checkbox", required: true }],
      active: true,
    },
  });
  cleanup.templateIds.push(admitTpl.id);
  await setAdmitCardRule(admin, {
    requiredFormKey: admitKey,
    requireEnrollment: baseRule.requireEnrollment,
    feeClearanceEnabled: baseRule.feeClearanceEnabled,
    examLabel: baseRule.examLabel,
  });
  const blocked = await getEligibility(student, student.id);
  ok(
    "generation blocked while the required form is missing",
    blocked.eligible === false && blocked.checks.some((c) => c.key === "required_form" && !c.passed),
  );
  const admitSub = await submitForm(student, admitKey, { ack: true });
  cleanup.formSubmissionIds.push(admitSub.id);
  await decideSubmission(coordinator, admitSub.id, "APPROVED", "Prerequisite verified.");
  const allowed = await getEligibility(student, student.id);
  ok(
    "eligible once the required form is approved",
    allowed.eligible === true && missingPrerequisites(allowed.checks).length === 0,
  );
  await expectThrow("students cannot check someone else's eligibility", async () => getEligibility(student2, student.id));
  await setAdmitCardRule(admin, {
    requiredFormKey: baseRule.requiredFormKey,
    requireEnrollment: baseRule.requireEnrollment,
    feeClearanceEnabled: baseRule.feeClearanceEnabled,
    examLabel: baseRule.examLabel,
  });
  ok("eligibility rule restored after the test", (await getAdmitCardRule()).requiredFormKey === baseRule.requiredFormKey);

  // ── 21. Timetable: conflict → preview → publish once → revert (goal §11) ─
  console.log("\n21. Timetable revisions: preview, publish once, revert");
  // Pre-clean leftovers from an aborted earlier run so this section is re-runnable.
  await prisma.courseClass.deleteMany({ where: { courseCode: { in: ["E2E-901", "E2E-902"] } } });
  const revClassA = await saveClass(coordinator, {
    courseCode: "E2E-901",
    title: "Revision Test A",
    section: "Z",
    department: "CS",
    semester: "E2E 2026",
    facultyId: null,
  });
  cleanup.createdClassIds.push(revClassA.id);
  const revClassB = await saveClass(coordinator, {
    courseCode: "E2E-902",
    title: "Revision Test B",
    section: "Z",
    department: "CS",
    semester: "E2E 2026",
    facultyId: null,
  });
  cleanup.createdClassIds.push(revClassB.id);
  await prisma.enrollment.create({ data: { studentId: student.id, classId: revClassA.id, status: "ACTIVE" } });
  const revSlot = await saveSlot(
    coordinator,
    { classId: revClassA.id, day: "TUE", startMin: 14 * 60, endMin: 15 * 60, room: "E2E-R2" },
    "E2E baseline",
  );
  cleanup.slotIds.push(revSlot.saved.id);
  const clashPreview = await previewSlotChange(coordinator, {
    classId: revClassB.id,
    day: "TUE",
    startMin: 14 * 60,
    endMin: 15 * 60,
    room: "E2E-R2",
  });
  ok("impact preview flags the room conflict", clashPreview.conflicts.some((c) => c.kind === "room"));
  ok("preview proposes free alternatives", clashPreview.alternatives.length >= 1);
  const movePreview = await previewSlotChange(coordinator, {
    id: revSlot.saved.id,
    classId: revClassA.id,
    day: "SAT",
    startMin: 19 * 60,
    endMin: 20 * 60,
    room: "E2E-R3",
  });
  ok("preview names the affected student cohort", movePreview.affectedStudents.count >= 1);
  const moveStartedAt = new Date();
  await saveSlot(
    coordinator,
    { id: revSlot.saved.id, classId: revClassA.id, day: "SAT", startMin: 19 * 60, endMin: 20 * 60, room: "E2E-R3" },
    "E2E move to Saturday",
  );
  ok(
    "published change persists on the shared slot",
    (await prisma.timetableSlot.findUniqueOrThrow({ where: { id: revSlot.saved.id } })).day === "SAT",
  );
  ok(
    "each publish records a revision",
    (await prisma.timetableRevision.count({ where: { createdAt: { gte: RUN_STARTED } } })) >= 2,
  );
  const studentNotice = await prisma.notification.findFirst({
    where: { userId: student.id, type: "ANNOUNCEMENT", title: "Timetable updated", createdAt: { gte: moveStartedAt } },
  });
  ok(
    "affected student got exactly one linked notice for the publish",
    studentNotice !== null &&
      studentNotice.link === "/timetable" &&
      (await prisma.notification.count({
        where: { userId: student.id, title: "Timetable updated", createdAt: { gte: moveStartedAt } },
      })) === 1,
  );
  ok(
    "unrelated students were not notified",
    (await prisma.notification.count({
      where: { userId: student2.id, title: "Timetable updated", createdAt: { gte: moveStartedAt } },
    })) === 0,
  );
  const revisionsList = await listTimetableRevisions(coordinator, 10);
  const moveRev = revisionsList.find((r) => r.label.includes("E2E-901") && r.label.includes("moved"));
  ok("history lists the labelled change", !!moveRev, moveRev?.label);
  if (moveRev) {
    const reverted = await revertToRevision(coordinator, moveRev.id, "E2E revert after the test");
    ok(
      "revert restores the previous schedule",
      reverted.applied === true && (await prisma.timetableSlot.findUniqueOrThrow({ where: { id: revSlot.saved.id } })).day === "TUE",
    );
    ok(
      "the revert itself is a revision",
      (await prisma.timetableRevision.count({ where: { createdAt: { gte: RUN_STARTED }, label: { startsWith: "Revert to" } } })) >= 1,
    );
  }
  ok("student sees the recent-update indicator", (await getTimetableUpdatedAtFor(student)) !== null);

  // ── 22. Data correction request → admin applies it (goal §6) ─────────────
  console.log("\n22. Data correction request workflow");
  const prof = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: student.id } });
  const origSection = prof.section;
  const corr = await createCorrectionRequest(faculty, {
    entityType: "StudentProfile",
    recordId: prof.id,
    field: "section",
    newValue: "Z",
    reason: "E2E: the exam seating list shows a different section for this student.",
  });
  cleanup.correctionIds.push(corr.id);
  ok("request stored PENDING with the server-side current value", corr.status === "PENDING" && corr.oldValue === (origSection ?? null));
  await expectThrow("students cannot request corrections", async () =>
    createCorrectionRequest(student, {
      entityType: "StudentProfile",
      recordId: prof.id,
      field: "section",
      newValue: "Y",
      reason: "students must not be able to request arbitrary record edits",
    }),
  );
  await expectThrow("faculty cannot decide their own request", async () => decideCorrection(faculty, corr.id, { approve: true }));
  const pendingQueue = await listCorrectionRequests(admin, { status: "PENDING" });
  ok("admin queue shows the request", pendingQueue.some((r) => r.id === corr.id));
  await decideCorrection(admin, corr.id, { approve: true, note: "Verified against the registrar list." });
  ok(
    "approval applies the corrected value",
    (await prisma.studentProfile.findUniqueOrThrow({ where: { id: prof.id } })).section === "Z",
  );
  ok(
    "requester notified of the outcome",
    (await prisma.notification.count({
      where: { userId: faculty.id, title: { contains: "correction" }, createdAt: { gte: RUN_STARTED } },
    })) >= 1,
  );
  await expectThrow("a decided request cannot be decided again", async () =>
    decideCorrection(admin, corr.id, { approve: false, note: "changed my mind" }),
  );
  await prisma.studentProfile.update({ where: { id: prof.id }, data: { section: origSection } });
  ok(
    "test restored the original value",
    (await prisma.studentProfile.findUniqueOrThrow({ where: { id: prof.id } })).section === origSection,
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
    submissions: (await prisma.assignmentSubmission.deleteMany({ where: { id: { in: cleanup.submissionIds } } })).count,
    assignments: (await prisma.assignment.deleteMany({ where: { id: { in: cleanup.assignmentIds } } })).count,
    complaintEvents: (
      await prisma.complaintEvent.deleteMany({ where: { complaintId: { in: cleanup.complaintIds } } })
    ).count,
    complaints: (await prisma.complaint.deleteMany({ where: { id: { in: cleanup.complaintIds } } })).count,
    complaintRoutes: (await prisma.complaintRoute.deleteMany({ where: { id: { in: cleanup.complaintRouteIds } } })).count,
    corrections: (await prisma.dataCorrectionRequest.deleteMany({ where: { id: { in: cleanup.correctionIds } } })).count,
    formSubmissions: (
      await prisma.formSubmission.deleteMany({ where: { id: { in: cleanup.formSubmissionIds } } })
    ).count,
    templates: (await prisma.formTemplate.deleteMany({ where: { id: { in: cleanup.templateIds } } })).count,
    timetableRevisions: (await prisma.timetableRevision.deleteMany({ where: { createdAt: { gte: RUN_STARTED } } })).count,
    accounts: (await prisma.user.deleteMany({ where: { id: { in: cleanup.accountIds } } })).count,
    notifications: (await prisma.notification.deleteMany({ where: { createdAt: { gte: RUN_STARTED } } })).count,
  };
  console.log(
    `  removed ${removed.attendance} attendance rows · ${removed.results} results · ${removed.assessments} assessment(s) · ` +
      `${removed.messages} message(s) · ${removed.clashes} clash report(s) · ${removed.slots} session(s) · ` +
      `${removed.fyp} FYP application(s) · ${removed.classes} test class(es) · ${removed.assignments} assignment(s) · ` +
      `${removed.complaints} complaint(s) · ${removed.formSubmissions} form submission(s) · ${removed.templates} template(s) · ` +
      `${removed.timetableRevisions} revision(s) · ${removed.corrections} correction(s) · ${removed.accounts} test account(s) · ` +
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

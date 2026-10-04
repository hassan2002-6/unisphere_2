import {
  AlertTriangle,
  Bell,
  BookOpen,
  Briefcase,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  MessageSquareWarning,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import type { User } from "@unisphere/db";
import { DAYS, formatDay, getClashReport, getClassesFor, minToLabel } from "@/server/services/schedule";
import type { StatTone } from "@/components/stat-card";

export type DashboardStat = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone: StatTone;
  href?: string;
};

export type DashboardItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  href?: string;
};

export type DashboardPanel = {
  title: string;
  icon: LucideIcon;
  href?: string;
  hrefLabel?: string;
  emptyText: string;
  items: DashboardItem[];
};

export type DashboardData = {
  stats: DashboardStat[];
  panels: DashboardPanel[];
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function todayKey(): string | null {
  const idx = new Date().getDay(); // 0 = Sunday
  return idx === 0 ? null : DAYS[idx - 1];
}

/** Classes relevant to the user, with today's slots extracted. */
async function todayClasses(user: User) {
  const key = todayKey();
  if (!key) return [];
  let classes: Awaited<ReturnType<typeof getClassesFor>> = [];
  try {
    classes = await getClassesFor(user);
  } catch {
    return [];
  }
  return classes
    .flatMap((c) =>
      c.slots
        .filter((s) => s.day === key)
        .map((s) => ({
          id: s.id,
          course: c.courseCode,
          title: c.title,
          section: c.section,
          room: s.room ?? (s.labId ? "Lab" : "TBA"),
          startMin: s.startMin,
          endMin: s.endMin,
          faculty: c.faculty?.name ?? null,
          classId: c.id,
        })),
    )
    .sort((a, b) => a.startMin - b.startMin);
}

function todayLabel(): string {
  const key = todayKey();
  return key ? formatDay(key) : "Sunday";
}

export async function getDashboard(user: User): Promise<DashboardData> {
  const day = todayLabel();

  switch (user.role) {
    case "STUDENT":
      return studentDashboard(user, day);
    case "FACULTY":
      return facultyDashboard(user, day);
    case "COORDINATOR":
      return coordinatorDashboard();
    case "FYP_HEAD":
      return fypHeadDashboard();
    case "MENTOR":
      return mentorDashboard(user);
  }
}

async function studentDashboard(user: User, day: string): Promise<DashboardData> {
  const [classes, submissions, openComplaints, allocation, lastApp, nextSession, profile] = await Promise.all([
    todayClasses(user),
    prisma.formSubmission.findMany({
      where: { submittedById: user.id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      include: { template: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.complaint.findMany({
      where: { submittedById: user.id, status: { in: ["OPEN", "IN_REVIEW"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.allocation.findFirst({
      where: { status: "ACTIVE", request: { applicantId: user.id } },
      include: { resource: true },
      orderBy: { endDate: "asc" },
    }),
    prisma.internshipApplication.findFirst({
      where: { studentId: user.id },
      include: { internship: { select: { title: true, company: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.mentorshipSession.findFirst({
      where: {
        status: { in: ["PROPOSED", "CONFIRMED"] },
        request: { studentId: user.id },
        scheduledAt: { gte: new Date() },
      },
      include: { request: { include: { mentor: { select: { name: true } } } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.studentProfile.findUnique({ where: { userId: user.id } }),
  ]);

  const nextClass = classes[0];
  const stats: DashboardStat[] = [
    {
      label: nextClass ? `Next class · ${minToLabel(nextClass.startMin)}` : "Classes today",
      value: nextClass ? nextClass.course : classes.length,
      hint: nextClass
        ? `${nextClass.room} · ${nextClass.faculty ?? "TBA"}`
        : classes.length === 0
          ? `No classes on ${day}`
          : undefined,
      icon: CalendarClock,
      tone: "primary",
      href: "/timetable",
    },
    {
      label: "Forms in progress",
      value: submissions.length,
      hint: submissions.length ? "Waiting on review" : "Nothing pending",
      icon: ClipboardList,
      tone: submissions.length ? "warning" : "default",
      href: "/submissions",
    },
    {
      label: "Open complaints",
      value: openComplaints.length,
      hint: openComplaints.length ? "Being handled" : "All clear",
      icon: MessageSquareWarning,
      tone: openComplaints.length ? "info" : "default",
      href: "/complaints",
    },
    {
      label: "Active allocation",
      value: allocation ? allocation.resource.model : "None",
      hint: allocation ? `Until ${fmtDate(allocation.endDate)}` : "Request a GPU or lab",
      icon: Cpu,
      tone: allocation ? "success" : "default",
      href: "/resources/my",
    },
  ];

  const panels: DashboardPanel[] = [
    {
      title: `Today · ${day}`,
      icon: CalendarClock,
      href: "/timetable",
      hrefLabel: "Full timetable",
      emptyText: `No classes scheduled for ${day}.`,
      items: classes.slice(0, 5).map((c) => ({
        id: c.id,
        title: `${c.course} — ${c.title}`,
        subtitle: `${minToLabel(c.startMin)}–${minToLabel(c.endMin)} · ${c.room}`,
        meta: `Sec ${c.section}${c.faculty ? ` · ${c.faculty}` : ""}`,
        href: "/timetable",
      })),
    },
    {
      title: "Forms awaiting review",
      icon: ClipboardList,
      href: "/submissions",
      hrefLabel: "All submissions",
      emptyText: "You have no submissions in review. File one from the Forms Center.",
      items: submissions.map((s) => ({
        id: s.id,
        title: s.template.title,
        subtitle: `Submitted ${fmtDate(s.createdAt)}`,
        status: s.status,
        href: `/submissions/${s.id}`,
      })),
    },
    {
      title: "Complaints",
      icon: MessageSquareWarning,
      href: "/complaints",
      hrefLabel: "Complaint box",
      emptyText: "No open complaints — nice.",
      items: openComplaints.map((c) => ({
        id: c.id,
        title: c.subject,
        subtitle: `${c.category} · ${fmtDate(c.createdAt)}`,
        status: c.status,
        href: `/complaints/${c.id}`,
      })),
    },
    {
      title: "Career & mentorship",
      icon: Briefcase,
      emptyText: "Apply to an internship or request a mentor to get started.",
      items: [
        ...(lastApp
          ? [
              {
                id: lastApp.id,
                title: `${lastApp.internship.title} · ${lastApp.internship.company}`,
                subtitle: "Latest internship application",
                status: lastApp.status,
                href: `/internships/${lastApp.internshipId}`,
              },
            ]
          : []),
        ...(nextSession
          ? [
              {
                id: nextSession.id,
                title: `Session with ${nextSession.request.mentor.name}`,
                subtitle: `${fmtDateTime(nextSession.scheduledAt)} · ${nextSession.mode}`,
                status: nextSession.status,
                href: "/mentorship",
              },
            ]
          : []),
      ],
    },
  ];

  if (profile) {
    panels[0].hrefLabel = `${profile.program} · Section ${profile.section ?? "—"}`;
  }

  return { stats, panels };
}

type ScheduleClasses = Awaited<ReturnType<typeof getClassesFor>>;

/** Slots for one day key, normalised for the dashboard panels. */
function daySlots(classes: ScheduleClasses, key: string | null) {
  if (!key) return [];
  return classes
    .flatMap((c) =>
      c.slots
        .filter((s) => s.day === key)
        .map((s) => ({
          id: s.id,
          course: c.courseCode,
          title: c.title,
          section: c.section,
          room: s.room ?? (s.labId ? "Lab" : "TBA"),
          startMin: s.startMin,
          endMin: s.endMin,
        })),
    )
    .sort((a, b) => a.startMin - b.startMin);
}

/** Next day (starting `fromOffset` days ahead) that has at least one slot. */
function nextTeachingDay(classes: ScheduleClasses, fromOffset = 1) {
  const startIdx = new Date().getDay(); // 0 = Sunday
  for (let step = fromOffset; step < fromOffset + 7; step++) {
    const idx = (startIdx + step) % 7;
    if (idx === 0) continue; // Sunday — no classes in the university week
    const key = DAYS[idx - 1];
    const slots = daySlots(classes, key);
    if (slots.length) return { key, slots };
  }
  return null;
}

async function facultyDashboard(user: User, day: string): Promise<DashboardData> {
  const today = todayKey();

  let schedule: ScheduleClasses = [];
  try {
    schedule = await getClassesFor(user);
  } catch {
    schedule = [];
  }
  const todays = daySlots(schedule, today);
  const nextDay = todays.length === 0 ? nextTeachingDay(schedule, 1) : null;
  const shown = todays.length > 0 ? todays : (nextDay?.slots ?? []);

  const [queue, complaints] = await Promise.all([
    prisma.formSubmission.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, template: { reviewerRole: "FACULTY" } },
      include: { template: true, submittedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 4,
    }),
    prisma.complaint.findMany({
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { submittedBy: { select: { name: true } } },
    }),
  ]);

  const stats: DashboardStat[] = [
    {
      label: "Classes today",
      value: todays.length,
      hint: todays[0]
        ? `First at ${minToLabel(todays[0].startMin)}`
        : nextDay
          ? `Next ${formatDay(nextDay.key)} ${minToLabel(nextDay.slots[0].startMin)}`
          : `Free on ${day}`,
      icon: CalendarClock,
      tone: "primary",
      href: "/timetable",
    },
    {
      label: "Forms awaiting review",
      value: queue.length,
      hint: queue.length ? "Oldest first in the queue" : "Queue is clear",
      icon: ClipboardCheck,
      tone: queue.length ? "warning" : "default",
      href: "/faculty/reviews",
    },
    {
      label: "My courses",
      value: schedule.length,
      hint: "Across the semester",
      icon: BookOpen,
      tone: "info",
      href: "/faculty/courses",
    },
    {
      label: "Student complaints",
      value: complaints.length,
      hint: complaints.length ? "Open or in review" : "Nothing open",
      icon: MessageSquareWarning,
      tone: complaints.length ? "danger" : "default",
      href: "/faculty/complaints",
    },
  ];

  const courseItems = schedule
    .map((c) => {
      const slots = [...c.slots].sort((a, b) => a.startMin - b.startMin);
      const days = [...new Set(slots.map((s) => formatDay(s.day)))].join(", ");
      return {
        id: c.id,
        title: `${c.courseCode} — ${c.title}`,
        subtitle: days ? `${days} · ${slots.length} slot${slots.length === 1 ? "" : "s"}/week` : "No weekly slots scheduled",
        meta: `Section ${c.section}`,
        href: "/faculty/courses",
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const panels: DashboardPanel[] = [
    {
      title: todays.length > 0 ? `Teaching today · ${day}` : nextDay ? `Next classes · ${formatDay(nextDay.key)}` : `Teaching · ${day}`,
      icon: CalendarClock,
      href: "/timetable",
      hrefLabel: "Full timetable",
      emptyText: `No classes scheduled for ${day} — and nothing later this week.`,
      items: shown.slice(0, 5).map((c) => ({
        id: c.id,
        title: `${c.course} — ${c.title}`,
        subtitle: `${minToLabel(c.startMin)}–${minToLabel(c.endMin)} · ${c.room}`,
        meta: `Section ${c.section}`,
        href: "/timetable",
      })),
    },
    {
      title: `My courses · ${schedule.length}`,
      icon: BookOpen,
      href: "/faculty/courses",
      hrefLabel: "Course details",
      emptyText: "No courses are assigned to you yet — the coordinator publishes allocations each semester.",
      items: courseItems,
    },
    {
      title: "Review queue",
      icon: ClipboardCheck,
      href: "/faculty/reviews",
      hrefLabel: "Open queue",
      emptyText: "No submissions are waiting for your review.",
      items: queue.map((s) => ({
        id: s.id,
        title: s.template.title,
        subtitle: `${s.submittedBy.name} · ${fmtDate(s.createdAt)}`,
        status: s.status,
        href: `/submissions/${s.id}`,
      })),
    },
    {
      title: "Student complaints",
      icon: MessageSquareWarning,
      href: "/faculty/complaints",
      hrefLabel: "All complaints",
      emptyText: "No complaints need attention.",
      items: complaints.map((c) => ({
        id: c.id,
        title: c.subject,
        subtitle: `${c.submittedBy.name} · ${c.category}`,
        status: c.status,
        href: `/complaints/${c.id}`,
      })),
    },
  ];

  return { stats, panels };
}

async function coordinatorDashboard(): Promise<DashboardData> {
  const [queue, complaints, internships, clashes, classCount, facultyCount] = await Promise.all([
    prisma.formSubmission.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, template: { reviewerRole: "COORDINATOR" } },
      include: { template: true, submittedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 4,
    }),
    prisma.complaint.findMany({
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { submittedBy: { select: { name: true } } },
    }),
    prisma.internship.count({ where: { status: "OPEN" } }),
    getClashReport().catch(() => ({ active: [], resolved: [] })),
    prisma.courseClass.count(),
    prisma.user.count({ where: { role: "FACULTY" } }),
  ]);

  const stats: DashboardStat[] = [
    {
      label: "Active clashes",
      value: clashes.active.length,
      hint: clashes.active.length ? "Needs resolution" : `${clashes.resolved.length} resolved`,
      icon: AlertTriangle,
      tone: clashes.active.length ? "danger" : "success",
      href: "/coordinator/clashes",
    },
    {
      label: "Waiting for approval",
      value: queue.length,
      hint: queue.length ? "Oldest first" : "Queue is clear",
      icon: ClipboardCheck,
      tone: queue.length ? "warning" : "default",
      href: "/coordinator/approvals",
    },
    {
      label: "Open complaints",
      value: complaints.length,
      hint: complaints.length ? "Across all categories" : "All clear",
      icon: MessageSquareWarning,
      tone: complaints.length ? "info" : "default",
      href: "/coordinator/complaints",
    },
    {
      label: "Scheduled classes",
      value: classCount,
      hint: `${facultyCount} faculty · ${internships} open internships`,
      icon: LayoutDashboard,
      tone: "primary",
      href: "/timetable",
    },
  ];

  const panels: DashboardPanel[] = [
    {
      title: "Clash monitor",
      icon: AlertTriangle,
      href: "/coordinator/clashes",
      hrefLabel: "Resolution desk",
      emptyText: "No active clashes — the timetable is consistent.",
      items: clashes.active.slice(0, 4).map((c) => ({
        id: c.key,
        title: c.detail ?? `${c.kind} clash`,
        subtitle: `${c.a.label} ↔ ${c.b.label}`,
        meta: c.day ? `${formatDay(c.day)} ${minToLabel(c.startMin)}–${minToLabel(c.endMin)}` : undefined,
        status: "OPEN",
        href: "/coordinator/clashes",
      })),
    },
    {
      title: "Approvals",
      icon: ClipboardCheck,
      href: "/coordinator/approvals",
      hrefLabel: "Open queue",
      emptyText: "No submissions are waiting for approval.",
      items: queue.map((s) => ({
        id: s.id,
        title: s.template.title,
        subtitle: `${s.submittedBy.name} · ${fmtDate(s.createdAt)}`,
        status: s.status,
        href: `/submissions/${s.id}`,
      })),
    },
    {
      title: "Complaints",
      icon: MessageSquareWarning,
      href: "/coordinator/complaints",
      hrefLabel: "All complaints",
      emptyText: "No open complaints.",
      items: complaints.map((c) => ({
        id: c.id,
        title: c.subject,
        subtitle: `${c.submittedBy.name} · ${c.category}`,
        status: c.status,
        href: `/complaints/${c.id}`,
      })),
    },
  ];

  return { stats, panels };
}

async function fypHeadDashboard(): Promise<DashboardData> {
  const [proposals, requests, allocations, labs, students] = await Promise.all([
    prisma.fypApplication.findMany({
      where: { status: "PENDING" },
      include: { applicant: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 4,
    }),
    prisma.resourceRequest.findMany({
      where: { status: { in: ["PENDING", "RECOMMENDED"] } },
      include: { applicant: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 4,
    }),
    prisma.allocation.findMany({
      where: { status: "ACTIVE" },
      include: { resource: true, request: { select: { projectName: true } } },
      orderBy: { endDate: "asc" },
      take: 4,
    }),
    prisma.lab.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
  ]);

  const stats: DashboardStat[] = [
    {
      label: "FYP proposals pending",
      value: proposals.length,
      hint: proposals.length ? "Oldest first" : "All reviewed",
      icon: BookOpen,
      tone: proposals.length ? "warning" : "default",
      href: "/admin/fyp",
    },
    {
      label: "Resource requests",
      value: requests.length,
      hint: requests.length ? "Waiting on your decision" : "Nothing waiting",
      icon: Cpu,
      tone: requests.length ? "info" : "default",
      href: "/admin/requests",
    },
    {
      label: "Active allocations",
      value: allocations.length,
      hint: "Time-boxed GPU / lab slots",
      icon: FlaskConical,
      tone: "success",
      href: "/admin/allocations",
    },
    {
      label: "Labs & students",
      value: `${labs} / ${students}`,
      hint: "Labs · students on record",
      icon: GraduationCap,
      tone: "primary",
      href: "/admin/labs",
    },
  ];

  const panels: DashboardPanel[] = [
    {
      title: "FYP proposals",
      icon: BookOpen,
      href: "/admin/fyp",
      hrefLabel: "All proposals",
      emptyText: "No FYP proposals are waiting for a decision.",
      items: proposals.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: `${p.applicant.name} · ${p.domain}`,
        meta: p.semester,
        status: p.status,
        href: "/admin/fyp",
      })),
    },
    {
      title: "Resource requests",
      icon: Cpu,
      href: "/admin/requests",
      hrefLabel: "Manage requests",
      emptyText: "No GPU or lab requests are pending.",
      items: requests.map((r) => ({
        id: r.id,
        title: r.projectName,
        subtitle: `${r.applicant.name} · ${r.resourceType}${r.config ? ` — ${r.config}` : ""}`,
        meta: r.timeSlot ?? undefined,
        status: r.status,
        href: "/admin/requests",
      })),
    },
    {
      title: "Active allocations",
      icon: FlaskConical,
      href: "/admin/allocations",
      hrefLabel: "Allocations",
      emptyText: "No active allocations right now.",
      items: allocations.map((a) => ({
        id: a.id,
        title: `${a.resource.model} → ${a.request.projectName}`,
        subtitle: `${fmtDate(a.startDate)} – ${fmtDate(a.endDate)}`,
        meta: a.timeSlot,
        status: a.status,
        href: "/admin/allocations",
      })),
    },
    {
      title: "Insights",
      icon: ClipboardList,
      href: "/admin/reports",
      hrefLabel: "Full reports",
      emptyText: "Reports are generated from live data.",
      items: [
        {
          id: "reports",
          title: "Requests, allocations & review turnaround",
          subtitle: "Export CSV or read the summary",
          href: "/admin/reports",
        },
        {
          id: "broadcast",
          title: "Broadcast an announcement",
          subtitle: "Send a notification to a role",
          href: "/admin/broadcast",
        },
      ],
    },
  ];

  return { stats, panels };
}

async function mentorDashboard(user: User): Promise<DashboardData> {
  const [pending, accepted, sessions, profile] = await Promise.all([
    prisma.mentorshipRequest.findMany({
      where: { mentorId: user.id, status: "PENDING" },
      include: { student: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 4,
    }),
    prisma.mentorshipRequest.findMany({
      where: { mentorId: user.id, status: "ACCEPTED" },
      include: { student: { select: { name: true } } },
      take: 6,
    }),
    prisma.mentorshipSession.findMany({
      where: { request: { mentorId: user.id }, status: { in: ["PROPOSED", "CONFIRMED"] } },
      include: { request: { include: { student: { select: { name: true } } } } },
      orderBy: { scheduledAt: "asc" },
      take: 4,
    }),
    prisma.mentorProfile.findUnique({ where: { userId: user.id } }),
  ]);

  const stats: DashboardStat[] = [
    {
      label: "Pending requests",
      value: pending.length,
      hint: pending.length ? "Students waiting on you" : "All answered",
      icon: Users,
      tone: pending.length ? "warning" : "default",
      href: "/mentor",
    },
    {
      label: "Active mentees",
      value: accepted.length,
      hint: profile ? `Capacity ${profile.maxActiveMentees}` : undefined,
      icon: GraduationCap,
      tone: "success",
      href: "/mentor",
    },
    {
      label: "Upcoming sessions",
      value: sessions.length,
      hint: sessions[0] ? `Next ${fmtDateTime(sessions[0].scheduledAt)}` : "None scheduled",
      icon: CalendarClock,
      tone: "info",
      href: "/mentor",
    },
    {
      label: "Unread notifications",
      value: await prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      hint: "In the bell menu",
      icon: Bell,
      tone: "primary",
      href: "/notifications",
    },
  ];

  const panels: DashboardPanel[] = [
    {
      title: "Mentorship requests",
      icon: Users,
      href: "/mentor",
      hrefLabel: "Mentor console",
      emptyText: "No new mentorship requests.",
      items: pending.map((r) => ({
        id: r.id,
        title: r.student.name,
        subtitle: r.message,
        status: r.status,
        href: "/mentor",
      })),
    },
    {
      title: "Upcoming sessions",
      icon: CalendarClock,
      href: "/mentor",
      hrefLabel: "Schedule",
      emptyText: "No sessions scheduled yet.",
      items: sessions.map((s) => ({
        id: s.id,
        title: `With ${s.request.student.name}`,
        subtitle: `${fmtDateTime(s.scheduledAt)} · ${s.mode}${s.location ? ` · ${s.location}` : ""}`,
        status: s.status,
        href: "/mentor",
      })),
    },
    {
      title: "Active mentees",
      icon: GraduationCap,
      href: "/mentor",
      hrefLabel: "All mentees",
      emptyText: "Accept a request to start mentoring.",
      items: accepted.map((r) => ({
        id: r.id,
        title: r.student.name,
        subtitle: "Mentorship active",
        status: "ACCEPTED",
        href: "/mentor",
      })),
    },
    {
      title: "Assistant",
      icon: Sparkles,
      href: "/chat",
      hrefLabel: "Open AI chat",
      emptyText: "",
      items: [
        {
          id: "chat",
          title: "Ask the AI assistant",
          subtitle: "Grounded answers about timetable, forms and policies",
          href: "/chat",
        },
      ],
    },
  ];

  return { stats, panels };
}

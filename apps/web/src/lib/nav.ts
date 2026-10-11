import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarCog,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  FileSearch,
  FileText,
  FormInput,
  FlaskConical,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquareWarning,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCircle,
  UserSearch,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@unisphere/db";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavSection = { title: string; items: NavItem[] };

/** Sidebar map per role — plan §6.4. Each role only sees its own routes. */
export const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  STUDENT: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Messages", href: "/messages", icon: Mail },
        { label: "My Profile", href: "/profile", icon: UserCircle },
      ],
    },
    {
      title: "Academics",
      items: [
        { label: "Timetable", href: "/timetable", icon: CalendarDays },
        { label: "Exams", href: "/exams", icon: CalendarClock },
        { label: "Attendance", href: "/attendance", icon: CalendarCheck },
        { label: "Marks & GPA", href: "/marks", icon: GraduationCap },
        { label: "Clash Reports", href: "/clashes", icon: AlertTriangle },
        { label: "Academic Planning", href: "/planning", icon: GraduationCap },
      ],
    },
    {
      title: "Requests",
      items: [
        { label: "Forms Center", href: "/forms", icon: FileText },
        { label: "My Submissions", href: "/submissions", icon: ClipboardList },
        { label: "Complaint Box", href: "/complaints", icon: MessageSquareWarning },
        { label: "FYP Application", href: "/fyp", icon: BookOpen },
      ],
    },
    {
      title: "Resources",
      items: [
        { label: "Request GPU / Lab", href: "/resources/request", icon: Cpu },
        { label: "My Allocations", href: "/resources/my", icon: FlaskConical },
      ],
    },
    {
      title: "Career",
      items: [
        { label: "Internships", href: "/internships", icon: Briefcase },
        { label: "Mentorship", href: "/mentorship", icon: Users },
      ],
    },
    {
      title: "Assistant",
      items: [{ label: "AI Chat", href: "/chat", icon: Sparkles }],
    },
  ],
  FACULTY: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Messages", href: "/messages", icon: Mail },
        { label: "My Profile", href: "/profile", icon: UserCircle },
      ],
    },
    {
      title: "Teaching",
      items: [
        { label: "Timetable", href: "/timetable", icon: CalendarDays },
        { label: "Exams", href: "/exams", icon: CalendarClock },
        { label: "My Courses", href: "/faculty/courses", icon: BookOpen },
        { label: "FYP Supervision", href: "/faculty/fyp", icon: GraduationCap },
        { label: "Attendance", href: "/faculty/attendance", icon: CalendarCheck },
        { label: "Marks Entry", href: "/faculty/marks", icon: GraduationCap },
        { label: "Students", href: "/faculty/students", icon: UserSearch },
      ],
    },
    {
      title: "Service",
      items: [
        { label: "Review Queue", href: "/faculty/reviews", icon: ClipboardCheck },
        { label: "Complaints", href: "/faculty/complaints", icon: MessageSquareWarning },
        { label: "Forms Center", href: "/forms", icon: FileText },
      ],
    },
  ],
  COORDINATOR: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Messages", href: "/messages", icon: Mail },
        { label: "My Profile", href: "/profile", icon: UserCircle },
      ],
    },
    {
      title: "Academics",
      items: [
        { label: "Timetable", href: "/timetable", icon: CalendarDays },
        { label: "Timetable Manager", href: "/coordinator/timetable", icon: CalendarCog },
        { label: "Exam Manager", href: "/coordinator/exams", icon: CalendarClock },
        { label: "Exams", href: "/exams", icon: CalendarClock },
        { label: "Clash Monitor", href: "/coordinator/clashes", icon: AlertTriangle },
      ],
    },
    {
      title: "Coordination",
      items: [
        { label: "Approvals", href: "/coordinator/approvals", icon: ClipboardCheck },
        { label: "Complaints", href: "/coordinator/complaints", icon: MessageSquareWarning },
        { label: "Students", href: "/coordinator/students", icon: UserSearch },
        { label: "Faculty", href: "/coordinator/faculty", icon: Users },
        { label: "Reports", href: "/admin/reports", icon: BarChart3 },
        { label: "Review Queue", href: "/reviews", icon: FileSearch },
        { label: "Forms Center", href: "/forms", icon: FileText },
        { label: "Audit Log", href: "/admin/audit", icon: ScrollText },
      ],
    },
    {
      title: "Outreach",
      items: [
        { label: "Internships", href: "/admin/internships", icon: Briefcase },
        { label: "Broadcast", href: "/admin/broadcast", icon: Megaphone },
      ],
    },
  ],
  FYP_HEAD: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Messages", href: "/messages", icon: Mail },
        { label: "My Profile", href: "/profile", icon: UserCircle },
      ],
    },
    {
      title: "FYP",
      items: [
        { label: "Requests Inbox", href: "/fyphead", icon: Inbox },
        { label: "FYP Applications", href: "/admin/fyp", icon: BookOpen },
        { label: "Review Queue", href: "/reviews", icon: FileSearch },
        { label: "Students", href: "/coordinator/students", icon: UserSearch },
      ],
    },
    {
      title: "Resources",
      items: [
        { label: "Requests", href: "/admin/requests", icon: Cpu },
        { label: "Allocations", href: "/admin/allocations", icon: FlaskConical },
        { label: "Labs", href: "/admin/labs", icon: Boxes },
        { label: "Inventory", href: "/admin/inventory", icon: ClipboardList },
      ],
    },
    {
      title: "Outreach",
      items: [
        { label: "Internships", href: "/admin/internships", icon: Briefcase },
        { label: "Mentors", href: "/admin/mentors", icon: UserCheck },
        { label: "Broadcast", href: "/admin/broadcast", icon: Megaphone },
      ],
    },
    {
      title: "Insights",
      items: [
        { label: "Reports", href: "/admin/reports", icon: BarChart3 },
        { label: "Audit Log", href: "/admin/audit", icon: ScrollText },
      ],
    },
  ],
  MENTOR: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Messages", href: "/messages", icon: Mail },
        { label: "My Profile", href: "/profile", icon: UserCircle },
      ],
    },
    {
      title: "Mentorship",
      items: [{ label: "My Mentees", href: "/mentor", icon: Users }],
    },
  ],
  ADMIN: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Messages", href: "/messages", icon: Mail },
        { label: "My Profile", href: "/profile", icon: UserCircle },
      ],
    },
    {
      title: "Administration",
      items: [
        { label: "Users & Roles", href: "/admin/users", icon: ShieldCheck },
        { label: "Forms Manager", href: "/admin/forms", icon: FormInput },
        { label: "Audit Log", href: "/admin/audit", icon: ScrollText },
        { label: "Reports", href: "/admin/reports", icon: BarChart3 },
      ],
    },
    {
      title: "Academics",
      items: [
        { label: "Timetable", href: "/timetable", icon: CalendarDays },
        { label: "Timetable Manager", href: "/coordinator/timetable", icon: CalendarCog },
        { label: "Exams", href: "/exams", icon: CalendarClock },
        { label: "Clash Monitor", href: "/coordinator/clashes", icon: AlertTriangle },
        { label: "Students", href: "/coordinator/students", icon: UserSearch },
        { label: "Faculty", href: "/coordinator/faculty", icon: Users },
      ],
    },
    {
      title: "Operations",
      items: [
        { label: "Requests", href: "/admin/requests", icon: Cpu },
        { label: "Allocations", href: "/admin/allocations", icon: FlaskConical },
        { label: "Labs", href: "/admin/labs", icon: Boxes },
        { label: "Inventory", href: "/admin/inventory", icon: ClipboardList },
        { label: "FYP Applications", href: "/admin/fyp", icon: BookOpen },
        { label: "Internships", href: "/admin/internships", icon: Briefcase },
        { label: "Mentors", href: "/admin/mentors", icon: UserCheck },
        { label: "Broadcast", href: "/admin/broadcast", icon: Megaphone },
      ],
    },
  ],
};

/** Titles for routes that aren't primary nav items (detail pages, nested routes). */
const EXTRA_TITLES: { prefix: string; label: string }[] = [
  { prefix: "/submissions/", label: "Submission detail" },
  { prefix: "/complaints/", label: "Complaint detail" },
  { prefix: "/internships/", label: "Internship detail" },
  { prefix: "/forms/new/", label: "New submission" },
  { prefix: "/complaints/new", label: "File a complaint" },
  { prefix: "/fyphead", label: "FYP Head Console" },
  { prefix: "/coordinator/timetable", label: "Timetable Manager" },
  { prefix: "/coordinator/exams", label: "Exam Manager" },
  { prefix: "/faculty/fyp", label: "FYP Supervision" },
  { prefix: "/profile", label: "My Profile" },
];

/** Resolve the nav item (or detail-page title) matching a pathname. */
export function navItemForPath(
  pathname: string,
  role: Role,
): { item: NavItem; section: string } | null {
  const sections = NAV_BY_ROLE[role];
  let best: { item: NavItem; section: string } | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        if (!best || item.href.length > best.item.href.length) {
          best = { item, section: section.title };
        }
      }
    }
  }
  return best;
}

/** Header title for any portal route. */
export function pageTitleFor(pathname: string, role: Role): string {
  const nav = navItemForPath(pathname, role);
  if (nav) return nav.item.label;
  const extra = EXTRA_TITLES.find((t) => pathname.startsWith(t.prefix));
  return extra?.label ?? "UniSphere";
}

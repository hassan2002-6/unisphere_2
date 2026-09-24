import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Briefcase,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  FileSearch,
  FileText,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  MessageSquareWarning,
  Sparkles,
  UserCheck,
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
      ],
    },
    {
      title: "Academics",
      items: [
        { label: "Timetable", href: "/timetable", icon: CalendarDays },
        { label: "Exams", href: "/exams", icon: CalendarClock },
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
      ],
    },
    {
      title: "Teaching",
      items: [
        { label: "Timetable", href: "/timetable", icon: CalendarDays },
        { label: "Exams", href: "/exams", icon: CalendarClock },
        { label: "My Courses", href: "/faculty/courses", icon: BookOpen },
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
      ],
    },
    {
      title: "Academics",
      items: [
        { label: "Timetable", href: "/timetable", icon: CalendarDays },
        { label: "Exams", href: "/exams", icon: CalendarClock },
        { label: "Clash Monitor", href: "/coordinator/clashes", icon: AlertTriangle },
      ],
    },
    {
      title: "Coordination",
      items: [
        { label: "Approvals", href: "/coordinator/approvals", icon: ClipboardCheck },
        { label: "Complaints", href: "/coordinator/complaints", icon: MessageSquareWarning },
        { label: "Faculty", href: "/coordinator/faculty", icon: Users },
        { label: "Review Queue", href: "/reviews", icon: FileSearch },
        { label: "Forms Center", href: "/forms", icon: FileText },
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
      ],
    },
    {
      title: "FYP",
      items: [
        { label: "FYP Applications", href: "/admin/fyp", icon: BookOpen },
        { label: "Review Queue", href: "/reviews", icon: FileSearch },
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
      items: [{ label: "Reports", href: "/admin/reports", icon: BarChart3 }],
    },
  ],
  MENTOR: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Notifications", href: "/notifications", icon: Bell },
      ],
    },
    {
      title: "Mentorship",
      items: [{ label: "My Mentees", href: "/mentor", icon: Users }],
    },
  ],
};

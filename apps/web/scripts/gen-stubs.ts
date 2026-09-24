/**
 * Generates placeholder route stubs for the portal route map (plan §6.4).
 * Run: bun scripts/gen-stubs.ts   (idempotent — skips files that exist)
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "src/app/(portal)";

const stubs: { route: string; title: string; milestone: string }[] = [
  { route: "timetable", title: "Timetable", milestone: "M2" },
  { route: "exams", title: "Exam Schedule", milestone: "M2" },
  { route: "planning", title: "Academic Planning", milestone: "M2" },
  { route: "notifications", title: "Notifications", milestone: "M2" },
  { route: "forms", title: "Forms Center", milestone: "M2" },
  { route: "forms/new/[key]", title: "Submit Form", milestone: "M2" },
  { route: "submissions", title: "My Submissions", milestone: "M2" },
  { route: "reviews", title: "Review Queue", milestone: "M2" },
  { route: "complaints", title: "Complaint Box", milestone: "M2" },
  { route: "complaints/new", title: "New Complaint", milestone: "M2" },
  { route: "fyp", title: "FYP Application", milestone: "M3" },
  { route: "resources/request", title: "Request GPU / Lab Resources", milestone: "M3" },
  { route: "resources/my", title: "My Allocations", milestone: "M3" },
  { route: "internships", title: "Internships", milestone: "M4" },
  { route: "internships/[id]", title: "Internship Details", milestone: "M4" },
  { route: "mentorship", title: "Mentorship", milestone: "M4" },
  { route: "mentor", title: "Mentor Portal", milestone: "M4" },
  { route: "chat", title: "AI Assistant", milestone: "M5" },
  { route: "admin/fyp", title: "FYP Review", milestone: "M3" },
  { route: "admin/requests", title: "Resource Requests", milestone: "M3" },
  { route: "admin/allocations", title: "Allocations", milestone: "M3" },
  { route: "admin/labs", title: "Labs", milestone: "M3" },
  { route: "admin/inventory", title: "Inventory", milestone: "M3" },
  { route: "admin/internships", title: "Manage Internships", milestone: "M4" },
  { route: "admin/mentors", title: "Mentor Approvals", milestone: "M4" },
  { route: "admin/reports", title: "Reports", milestone: "M3" },
  { route: "admin/broadcast", title: "Broadcast", milestone: "M2" },
  { route: "coordinator/approvals", title: "Approvals", milestone: "M2" },
  { route: "coordinator/clashes", title: "Clash Monitor", milestone: "M2" },
  { route: "coordinator/complaints", title: "Complaints (Coordinator)", milestone: "M2" },
  { route: "coordinator/faculty", title: "Faculty Directory", milestone: "M2" },
  { route: "faculty/complaints", title: "Complaints (Faculty)", milestone: "M2" },
  { route: "faculty/reviews", title: "Review Queue (Faculty)", milestone: "M2" },
  { route: "faculty/courses", title: "My Courses", milestone: "M2" },
];

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

let created = 0;
let skipped = 0;
for (const s of stubs) {
  const dir = join(ROOT, s.route);
  const file = join(dir, "page.tsx");
  if (await exists(file)) {
    skipped++;
    continue;
  }
  await mkdir(dir, { recursive: true });
  const body = `import { Placeholder } from "@/components/placeholder";

export default function Page() {
  return <Placeholder title="${s.title.replaceAll('"', '\\"')}" milestone="${s.milestone}" />;
}
`;
  await writeFile(file, body);
  created++;
}

console.log(`gen-stubs: created=${created} skipped=${skipped} total=${stubs.length}`);

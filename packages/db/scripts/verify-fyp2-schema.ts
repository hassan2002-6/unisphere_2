// Verify the FYP-II schema additions landed in the live DB.
import { prisma } from "@unisphere/db";

const counts = await Promise.all([
  prisma.attendanceRecord.count(),
  prisma.assessment.count(),
  prisma.score.count(),
  prisma.courseResult.count(),
  prisma.message.count(),
  prisma.auditLog.count(),
  prisma.clashReport.count(),
]);
const [attendance, assessments, scores, results, messages, audits, clashReports] = counts;
console.log("new-table counts:", { attendance, assessments, scores, results, messages, audits, clashReports });

// Enum values (raw) — confirms ALTER TYPE landed.
const roles = await prisma.$queryRaw<{ enumlabel: string }[]>`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'Role' ORDER BY enumsortorder`;
const notif = await prisma.$queryRaw<{ enumlabel: string }[]>`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'NotificationType' ORDER BY enumsortorder`;
console.log("Role:", roles.map((r) => r.enumlabel).join(","));
console.log("NotificationType:", notif.map((r) => r.enumlabel).join(","));
await prisma.$disconnect();

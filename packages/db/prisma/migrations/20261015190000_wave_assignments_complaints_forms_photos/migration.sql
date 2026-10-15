-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ComplaintEventVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ComplaintEventKind" AS ENUM ('STATUS', 'RESPONSE', 'FORWARD', 'NOTE', 'ESCALATION');

-- AlterEnum
ALTER TYPE "ComplaintStatus" ADD VALUE 'AWAITING_INFO';

-- AlterEnum
ALTER TYPE "FormStatus" ADD VALUE 'CORRECTIONS_REQUESTED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT';

-- DropIndex

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "attachmentData" BYTEA,
ADD COLUMN     "attachmentMime" TEXT,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentSize" INTEGER,
ADD COLUMN     "classId" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "priority" "ComplaintPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "refNo" TEXT;

-- AlterTable
ALTER TABLE "ComplaintEvent" ADD COLUMN     "assigneeFromId" TEXT,
ADD COLUMN     "assigneeToId" TEXT,
ADD COLUMN     "kind" "ComplaintEventKind" NOT NULL DEFAULT 'STATUS',
ADD COLUMN     "visibility" "ComplaintEventVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN     "chain" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "currentStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "templateSnapshot" JSONB,
ADD COLUMN     "templateVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "FormTemplate" ADD COLUMN     "approverChain" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarData" BYTEA,
ADD COLUMN     "avatarMime" TEXT,
ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ComplaintCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintRoute" (
    "id" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "targetRole" "Role",
    "targetUserId" TEXT,
    "defaultPriority" "ComplaintPriority" NOT NULL DEFAULT 'MEDIUM',
    "escalateAfterHours" INTEGER,
    "escalateToRole" "Role",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "allowedTypes" TEXT,
    "attachmentName" TEXT,
    "attachmentMime" TEXT,
    "attachmentSize" INTEGER,
    "attachmentData" BYTEA,
    "createdById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileMime" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "marks" INTEGER,
    "feedback" TEXT,
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnansweredQuestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "role" "Role",
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "UnansweredQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintCategory_key_key" ON "ComplaintCategory"("key");

-- CreateIndex
CREATE INDEX "ComplaintCategory_active_idx" ON "ComplaintCategory"("active");

-- CreateIndex
CREATE INDEX "ComplaintRoute_categoryKey_active_idx" ON "ComplaintRoute"("categoryKey", "active");

-- CreateIndex
CREATE INDEX "Assignment_classId_idx" ON "Assignment"("classId");

-- CreateIndex
CREATE INDEX "Assignment_deadline_idx" ON "Assignment"("deadline");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_studentId_idx" ON "AssignmentSubmission"("studentId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_gradedById_idx" ON "AssignmentSubmission"("gradedById");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON "AssignmentSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "UnansweredQuestion_resolvedAt_idx" ON "UnansweredQuestion"("resolvedAt");

-- Backfill reference numbers for complaints that predate the refNo column,
-- then enforce NOT NULL + uniqueness.
UPDATE "Complaint" c SET "refNo" = 'CMP-' || to_char(c."createdAt", 'YYYY') || '-' || lpad(sub.rn::text, 4, '0')
FROM (SELECT id, row_number() OVER (PARTITION BY to_char("createdAt", 'YYYY') ORDER BY "createdAt", id) AS rn FROM "Complaint") sub
WHERE c.id = sub.id AND c."refNo" IS NULL;
ALTER TABLE "Complaint" ALTER COLUMN "refNo" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_refNo_key" ON "Complaint"("refNo");

-- CreateIndex
CREATE INDEX "Complaint_assignedToId_idx" ON "Complaint"("assignedToId");

-- CreateIndex
CREATE INDEX "Complaint_priority_idx" ON "Complaint"("priority");

-- CreateIndex
CREATE INDEX "FormSubmission_reviewerId_idx" ON "FormSubmission"("reviewerId");

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_classId_fkey" FOREIGN KEY ("classId") REFERENCES "CourseClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintEvent" ADD CONSTRAINT "ComplaintEvent_assigneeFromId_fkey" FOREIGN KEY ("assigneeFromId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintEvent" ADD CONSTRAINT "ComplaintEvent_assigneeToId_fkey" FOREIGN KEY ("assigneeToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "CourseClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnansweredQuestion" ADD CONSTRAINT "UnansweredQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


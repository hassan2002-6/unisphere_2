-- CreateEnum
CREATE TYPE "ComplaintRecipientRole" AS ENUM ('TO', 'CC');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ComplaintRecipient" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ComplaintRecipientRole" NOT NULL DEFAULT 'TO',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableRevision" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimetableRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCorrectionRequest" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmitCardRule" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "requiredFormKey" TEXT,
    "requireEnrollment" BOOLEAN NOT NULL DEFAULT true,
    "feeClearanceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "examLabel" TEXT NOT NULL DEFAULT 'Semester Examinations',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmitCardRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplaintRecipient_userId_readAt_idx" ON "ComplaintRecipient"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintRecipient_complaintId_userId_key" ON "ComplaintRecipient"("complaintId", "userId");

-- CreateIndex
CREATE INDEX "TimetableRevision_createdAt_idx" ON "TimetableRevision"("createdAt");

-- CreateIndex
CREATE INDEX "DataCorrectionRequest_status_createdAt_idx" ON "DataCorrectionRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DataCorrectionRequest_recordId_idx" ON "DataCorrectionRequest"("recordId");

-- AddForeignKey
ALTER TABLE "ComplaintRecipient" ADD CONSTRAINT "ComplaintRecipient_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintRecipient" ADD CONSTRAINT "ComplaintRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableRevision" ADD CONSTRAINT "TimetableRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataCorrectionRequest" ADD CONSTRAINT "DataCorrectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataCorrectionRequest" ADD CONSTRAINT "DataCorrectionRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN     "attachmentData" BYTEA,
ADD COLUMN     "attachmentMime" TEXT,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentSize" INTEGER;

-- AlterTable
ALTER TABLE "FormTemplate" ADD COLUMN     "attachmentLabel" TEXT,
ADD COLUMN     "requiresAttachment" BOOLEAN NOT NULL DEFAULT false;

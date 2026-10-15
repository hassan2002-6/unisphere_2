-- DropIndex

-- AlterTable
ALTER TABLE "KnowledgeDoc"
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedById" TEXT;

-- CreateTable
CREATE TABLE "AiUnanswered" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUnanswered_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUnanswered_reviewedAt_createdAt_idx" ON "AiUnanswered"("reviewedAt", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_isArchived_idx" ON "KnowledgeDoc"("isArchived");


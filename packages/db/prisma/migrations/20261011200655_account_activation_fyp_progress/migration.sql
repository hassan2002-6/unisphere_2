-- AlterEnum
ALTER TYPE "FypStatus" ADD VALUE 'CHANGES_REQUESTED';

-- DropIndex

-- AlterTable

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "FypProgressUpdate" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FypProgressUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FypProgressUpdate_applicationId_idx" ON "FypProgressUpdate"("applicationId");

-- AddForeignKey
ALTER TABLE "FypProgressUpdate" ADD CONSTRAINT "FypProgressUpdate_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FypApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FypProgressUpdate" ADD CONSTRAINT "FypProgressUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


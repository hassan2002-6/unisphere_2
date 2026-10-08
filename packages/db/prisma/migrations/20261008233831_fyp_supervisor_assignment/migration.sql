-- DropIndex

-- AlterTable
ALTER TABLE "FypApplication" ADD COLUMN     "supervisorId" TEXT;

-- AlterTable

-- CreateIndex
CREATE INDEX "FypApplication_supervisorId_idx" ON "FypApplication"("supervisorId");

-- AddForeignKey
ALTER TABLE "FypApplication" ADD CONSTRAINT "FypApplication_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


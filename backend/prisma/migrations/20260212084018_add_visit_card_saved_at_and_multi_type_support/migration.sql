-- DropIndex
DROP INDEX "VisitCard_patientBookId_key";

-- AlterTable
ALTER TABLE "VisitCard" ADD COLUMN "savedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "VisitCard_patientBookId_type_key" ON "VisitCard"("patientBookId", "type");

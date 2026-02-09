-- CreateEnum for autoclave cycle result
CREATE TYPE "AutoclaveCycleResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum for sterilization mismatch status
CREATE TYPE "SterilizationMismatchStatus" AS ENUM ('UNRESOLVED', 'RESOLVED');

-- AlterTable: Add branchId to SterilizationItem
ALTER TABLE "SterilizationItem" ADD COLUMN "branchId" INTEGER;

-- Populate branchId with default branch (first branch or create a default one)
-- This migration assumes at least one branch exists
UPDATE "SterilizationItem" 
SET "branchId" = (SELECT id FROM "Branch" LIMIT 1)
WHERE "branchId" IS NULL;

-- Make branchId NOT NULL after populating
ALTER TABLE "SterilizationItem" ALTER COLUMN "branchId" SET NOT NULL;

-- Drop old unique constraint on (categoryId, name)
ALTER TABLE "SterilizationItem" DROP CONSTRAINT IF EXISTS "SterilizationItem_categoryId_name_key";

-- Add new unique constraint on (branchId, name)
ALTER TABLE "SterilizationItem" ADD CONSTRAINT "SterilizationItem_branchId_name_key" UNIQUE ("branchId", "name");

-- CreateIndex for branchId on SterilizationItem
CREATE INDEX "SterilizationItem_branchId_idx" ON "SterilizationItem"("branchId");

-- AddForeignKey for SterilizationItem.branchId
ALTER TABLE "SterilizationItem" ADD CONSTRAINT "SterilizationItem_branchId_fkey" 
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: AutoclaveCycle
CREATE TABLE "AutoclaveCycle" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "machineNumber" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "result" "AutoclaveCycleResult" NOT NULL,
    "operator" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoclaveCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AutoclaveCycleToolLine
CREATE TABLE "AutoclaveCycleToolLine" (
    "id" SERIAL NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "toolId" INTEGER NOT NULL,
    "producedQty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoclaveCycleToolLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SterilizationDraftAttachment
CREATE TABLE "SterilizationDraftAttachment" (
    "id" SERIAL NOT NULL,
    "encounterDiagnosisId" INTEGER NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "toolId" INTEGER NOT NULL,
    "requestedQty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SterilizationDraftAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SterilizationFinalizedUsage
CREATE TABLE "SterilizationFinalizedUsage" (
    "id" SERIAL NOT NULL,
    "encounterId" INTEGER NOT NULL,
    "toolLineId" INTEGER NOT NULL,
    "usedQty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SterilizationFinalizedUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SterilizationMismatch
CREATE TABLE "SterilizationMismatch" (
    "id" SERIAL NOT NULL,
    "encounterId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "toolId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "requiredQty" INTEGER NOT NULL,
    "finalizedQty" INTEGER NOT NULL,
    "mismatchQty" INTEGER NOT NULL,
    "status" "SterilizationMismatchStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SterilizationMismatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SterilizationAdjustmentConsumption
CREATE TABLE "SterilizationAdjustmentConsumption" (
    "id" SERIAL NOT NULL,
    "mismatchId" INTEGER NOT NULL,
    "encounterId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "toolId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "resolvedByUserId" INTEGER,
    "resolvedByName" TEXT NOT NULL,
    "note" TEXT,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SterilizationAdjustmentConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutoclaveCycle_branchId_code_key" ON "AutoclaveCycle"("branchId", "code");
CREATE INDEX "AutoclaveCycle_branchId_idx" ON "AutoclaveCycle"("branchId");
CREATE INDEX "AutoclaveCycle_code_idx" ON "AutoclaveCycle"("code");
CREATE INDEX "AutoclaveCycle_result_idx" ON "AutoclaveCycle"("result");

-- CreateIndex
CREATE UNIQUE INDEX "AutoclaveCycleToolLine_cycleId_toolId_key" ON "AutoclaveCycleToolLine"("cycleId", "toolId");
CREATE INDEX "AutoclaveCycleToolLine_cycleId_idx" ON "AutoclaveCycleToolLine"("cycleId");
CREATE INDEX "AutoclaveCycleToolLine_toolId_idx" ON "AutoclaveCycleToolLine"("toolId");

-- CreateIndex
CREATE INDEX "SterilizationDraftAttachment_encounterDiagnosisId_idx" ON "SterilizationDraftAttachment"("encounterDiagnosisId");
CREATE INDEX "SterilizationDraftAttachment_cycleId_idx" ON "SterilizationDraftAttachment"("cycleId");
CREATE INDEX "SterilizationDraftAttachment_toolId_idx" ON "SterilizationDraftAttachment"("toolId");

-- CreateIndex
CREATE INDEX "SterilizationFinalizedUsage_encounterId_idx" ON "SterilizationFinalizedUsage"("encounterId");
CREATE INDEX "SterilizationFinalizedUsage_toolLineId_idx" ON "SterilizationFinalizedUsage"("toolLineId");

-- CreateIndex
CREATE INDEX "SterilizationMismatch_encounterId_idx" ON "SterilizationMismatch"("encounterId");
CREATE INDEX "SterilizationMismatch_status_idx" ON "SterilizationMismatch"("status");
CREATE INDEX "SterilizationMismatch_branchId_idx" ON "SterilizationMismatch"("branchId");

-- CreateIndex
CREATE INDEX "SterilizationAdjustmentConsumption_mismatchId_idx" ON "SterilizationAdjustmentConsumption"("mismatchId");
CREATE INDEX "SterilizationAdjustmentConsumption_encounterId_idx" ON "SterilizationAdjustmentConsumption"("encounterId");
CREATE INDEX "SterilizationAdjustmentConsumption_branchId_idx" ON "SterilizationAdjustmentConsumption"("branchId");
CREATE INDEX "SterilizationAdjustmentConsumption_toolId_idx" ON "SterilizationAdjustmentConsumption"("toolId");
CREATE INDEX "SterilizationAdjustmentConsumption_resolvedByUserId_idx" ON "SterilizationAdjustmentConsumption"("resolvedByUserId");

-- AddForeignKey
ALTER TABLE "AutoclaveCycle" ADD CONSTRAINT "AutoclaveCycle_branchId_fkey" 
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoclaveCycleToolLine" ADD CONSTRAINT "AutoclaveCycleToolLine_cycleId_fkey" 
  FOREIGN KEY ("cycleId") REFERENCES "AutoclaveCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoclaveCycleToolLine" ADD CONSTRAINT "AutoclaveCycleToolLine_toolId_fkey" 
  FOREIGN KEY ("toolId") REFERENCES "SterilizationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationDraftAttachment" ADD CONSTRAINT "SterilizationDraftAttachment_encounterDiagnosisId_fkey" 
  FOREIGN KEY ("encounterDiagnosisId") REFERENCES "EncounterDiagnosis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationDraftAttachment" ADD CONSTRAINT "SterilizationDraftAttachment_cycleId_fkey" 
  FOREIGN KEY ("cycleId") REFERENCES "AutoclaveCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationDraftAttachment" ADD CONSTRAINT "SterilizationDraftAttachment_toolId_fkey" 
  FOREIGN KEY ("toolId") REFERENCES "SterilizationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationFinalizedUsage" ADD CONSTRAINT "SterilizationFinalizedUsage_encounterId_fkey" 
  FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationFinalizedUsage" ADD CONSTRAINT "SterilizationFinalizedUsage_toolLineId_fkey" 
  FOREIGN KEY ("toolLineId") REFERENCES "AutoclaveCycleToolLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationMismatch" ADD CONSTRAINT "SterilizationMismatch_encounterId_fkey" 
  FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationMismatch" ADD CONSTRAINT "SterilizationMismatch_branchId_fkey" 
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationMismatch" ADD CONSTRAINT "SterilizationMismatch_toolId_fkey" 
  FOREIGN KEY ("toolId") REFERENCES "SterilizationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationAdjustmentConsumption" ADD CONSTRAINT "SterilizationAdjustmentConsumption_mismatchId_fkey" 
  FOREIGN KEY ("mismatchId") REFERENCES "SterilizationMismatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationAdjustmentConsumption" ADD CONSTRAINT "SterilizationAdjustmentConsumption_encounterId_fkey" 
  FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationAdjustmentConsumption" ADD CONSTRAINT "SterilizationAdjustmentConsumption_branchId_fkey" 
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationAdjustmentConsumption" ADD CONSTRAINT "SterilizationAdjustmentConsumption_toolId_fkey" 
  FOREIGN KEY ("toolId") REFERENCES "SterilizationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationAdjustmentConsumption" ADD CONSTRAINT "SterilizationAdjustmentConsumption_resolvedByUserId_fkey" 
  FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

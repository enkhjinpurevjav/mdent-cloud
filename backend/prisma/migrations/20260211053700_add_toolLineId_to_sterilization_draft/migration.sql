-- AlterTable
ALTER TABLE "SterilizationDraftAttachment" ADD COLUMN "toolLineId" INTEGER;

-- CreateIndex
CREATE INDEX "SterilizationDraftAttachment_toolLineId_idx" ON "SterilizationDraftAttachment"("toolLineId");

-- AddForeignKey
ALTER TABLE "SterilizationDraftAttachment" ADD CONSTRAINT "SterilizationDraftAttachment_toolLineId_fkey" FOREIGN KEY ("toolLineId") REFERENCES "AutoclaveCycleToolLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill toolLineId for existing rows
-- For each existing draft, find the matching AutoclaveCycleToolLine by (cycleId, toolId)
UPDATE "SterilizationDraftAttachment" AS sda
SET "toolLineId" = (
  SELECT actl.id 
  FROM "AutoclaveCycleToolLine" AS actl
  WHERE actl."cycleId" = sda."cycleId" 
    AND actl."toolId" = sda."toolId"
  LIMIT 1
)
WHERE sda."toolLineId" IS NULL;

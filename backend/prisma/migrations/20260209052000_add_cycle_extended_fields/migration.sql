-- AlterTable
ALTER TABLE "AutoclaveCycle" 
ADD COLUMN "sterilizationRunNumber" TEXT,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "pressure" DOUBLE PRECISION,
ADD COLUMN "temperature" DOUBLE PRECISION,
ADD COLUMN "finishedAt" TIMESTAMP(3),
ADD COLUMN "removedFromAutoclaveAt" TIMESTAMP(3);

-- Backfill existing records: set startedAt and finishedAt to completedAt
-- WHERE clause ensures we only update existing records (new columns start as NULL)
UPDATE "AutoclaveCycle" 
SET "startedAt" = "completedAt", "finishedAt" = "completedAt" 
WHERE "startedAt" IS NULL;

-- AlterTable
ALTER TABLE "AutoclaveCycle" 
ADD COLUMN "sterilizationRunNumber" TEXT,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "pressure" DOUBLE PRECISION,
ADD COLUMN "temperature" DOUBLE PRECISION,
ADD COLUMN "finishedAt" TIMESTAMP(3),
ADD COLUMN "removedFromAutoclaveAt" TIMESTAMP(3);

-- Update existing records to set startedAt and finishedAt to completedAt for backward compatibility
UPDATE "AutoclaveCycle" 
SET "startedAt" = "completedAt", "finishedAt" = "completedAt" 
WHERE "startedAt" IS NULL;

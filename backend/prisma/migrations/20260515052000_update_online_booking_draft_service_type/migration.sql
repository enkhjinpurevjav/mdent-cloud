-- CreateEnum
CREATE TYPE "OnlineBookingServiceType" AS ENUM ('CONSULTATION', 'TREATMENT');

-- AlterTable
ALTER TABLE "OnlineBookingDraft"
ADD COLUMN "serviceType" "OnlineBookingServiceType",
ALTER COLUMN "branchId" DROP NOT NULL;

-- Backfill existing drafts with a selected category as treatment
UPDATE "OnlineBookingDraft"
SET "serviceType" = 'TREATMENT'
WHERE "serviceCategory" IS NOT NULL
  AND "serviceType" IS NULL;

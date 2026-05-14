ALTER TABLE "SterilizationReturn"
ADD COLUMN "nurseUserId" INTEGER,
ADD COLUMN "nurseNameSnapshot" TEXT;

CREATE INDEX "SterilizationReturn_nurseUserId_idx"
ON "SterilizationReturn"("nurseUserId");

ALTER TABLE "SterilizationReturn"
ADD CONSTRAINT "SterilizationReturn_nurseUserId_fkey"
FOREIGN KEY ("nurseUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

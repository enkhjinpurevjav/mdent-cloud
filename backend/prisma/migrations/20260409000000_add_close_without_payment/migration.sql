-- AlterTable: add canCloseEncounterWithoutPayment to User
ALTER TABLE "User" ADD COLUMN "canCloseEncounterWithoutPayment" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add close-without-payment audit fields to Encounter
ALTER TABLE "Encounter"
  ADD COLUMN "closedWithoutPayment"         BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "closedWithoutPaymentNote"     TEXT,
  ADD COLUMN "closedWithoutPaymentAt"       TIMESTAMP(3),
  ADD COLUMN "closedWithoutPaymentByUserId" INTEGER;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_closedWithoutPaymentByUserId_fkey"
  FOREIGN KEY ("closedWithoutPaymentByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

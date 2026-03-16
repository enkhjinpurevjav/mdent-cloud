-- AlterTable: add checkedInAt field for patient self-check-in via tablet
ALTER TABLE "Appointment" ADD COLUMN "checkedInAt" TIMESTAMP(3);

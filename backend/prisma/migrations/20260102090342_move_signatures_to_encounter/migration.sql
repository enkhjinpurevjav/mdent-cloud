-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "patientSignaturePath" TEXT,
ADD COLUMN     "patientSignedAt" TIMESTAMP(3),
ADD COLUMN     "doctorSignaturePath" TEXT,
ADD COLUMN     "doctorSignedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EncounterConsent" DROP COLUMN "patientSignaturePath",
DROP COLUMN "patientSignedAt",
DROP COLUMN "doctorSignaturePath",
DROP COLUMN "doctorSignedAt";

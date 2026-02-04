-- CreateTable
CREATE TABLE "EncounterDiagnosisProblemText" (
    "id" SERIAL NOT NULL,
    "encounterDiagnosisId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncounterDiagnosisProblemText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncounterServiceText" (
    "id" SERIAL NOT NULL,
    "encounterServiceId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncounterServiceText_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncounterDiagnosisProblemText_encounterDiagnosisId_idx" ON "EncounterDiagnosisProblemText"("encounterDiagnosisId");

-- CreateIndex
CREATE INDEX "EncounterServiceText_encounterServiceId_idx" ON "EncounterServiceText"("encounterServiceId");

-- AddForeignKey
ALTER TABLE "EncounterDiagnosisProblemText" ADD CONSTRAINT "EncounterDiagnosisProblemText_encounterDiagnosisId_fkey" FOREIGN KEY ("encounterDiagnosisId") REFERENCES "EncounterDiagnosis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterServiceText" ADD CONSTRAINT "EncounterServiceText_encounterServiceId_fkey" FOREIGN KEY ("encounterServiceId") REFERENCES "EncounterService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

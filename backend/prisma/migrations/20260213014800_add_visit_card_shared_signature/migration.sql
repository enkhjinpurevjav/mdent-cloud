-- CreateTable
CREATE TABLE "VisitCardSharedSignature" (
    "id" SERIAL NOT NULL,
    "patientBookId" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitCardSharedSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitCardSharedSignature_patientBookId_key" ON "VisitCardSharedSignature"("patientBookId");

-- AddForeignKey
ALTER TABLE "VisitCardSharedSignature" ADD CONSTRAINT "VisitCardSharedSignature_patientBookId_fkey" FOREIGN KEY ("patientBookId") REFERENCES "PatientBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

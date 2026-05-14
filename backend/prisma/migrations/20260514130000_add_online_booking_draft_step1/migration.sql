-- CreateEnum
CREATE TYPE "OnlineBookingDraftStatus" AS ENUM (
    'PENDING_PAYMENT',
    'VERIFIED',
    'PAID',
    'EXPIRED',
    'CANCELLED'
);

-- CreateEnum
CREATE TYPE "OnlineBookingMatchStatus" AS ENUM (
    'NEW',
    'EXISTING',
    'DUPLICATE_NEEDS_REVIEW'
);

-- CreateTable
CREATE TABLE "OnlineBookingDraft" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "matchedPatientId" INTEGER,
    "status" "OnlineBookingDraftStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "matchStatus" "OnlineBookingMatchStatus" NOT NULL DEFAULT 'NEW',
    "ovog" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "regNoRaw" TEXT NOT NULL,
    "regNoNormalized" TEXT NOT NULL,
    "note" TEXT,
    "serviceCategory" "ServiceCategory",
    "selectedDate" TIMESTAMP(3),
    "selectedStartTime" TEXT,
    "selectedEndTime" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineBookingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnlineBookingDraft_branchId_createdAt_idx" ON "OnlineBookingDraft"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "OnlineBookingDraft_matchedPatientId_idx" ON "OnlineBookingDraft"("matchedPatientId");

-- CreateIndex
CREATE INDEX "OnlineBookingDraft_status_expiresAt_idx" ON "OnlineBookingDraft"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "OnlineBookingDraft_regNoNormalized_idx" ON "OnlineBookingDraft"("regNoNormalized");

-- AddForeignKey
ALTER TABLE "OnlineBookingDraft" ADD CONSTRAINT "OnlineBookingDraft_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineBookingDraft" ADD CONSTRAINT "OnlineBookingDraft_matchedPatientId_fkey" FOREIGN KEY ("matchedPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

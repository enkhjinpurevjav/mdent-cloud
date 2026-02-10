-- CreateTable
CREATE TABLE "SterilizationDisposal" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "disposedAt" TIMESTAMP(3) NOT NULL,
    "disposedByName" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SterilizationDisposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SterilizationDisposalLine" (
    "id" SERIAL NOT NULL,
    "disposalId" INTEGER NOT NULL,
    "toolLineId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SterilizationDisposalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SterilizationDisposal_branchId_idx" ON "SterilizationDisposal"("branchId");

-- CreateIndex
CREATE INDEX "SterilizationDisposal_disposedAt_idx" ON "SterilizationDisposal"("disposedAt");

-- CreateIndex
CREATE INDEX "SterilizationDisposalLine_disposalId_idx" ON "SterilizationDisposalLine"("disposalId");

-- CreateIndex
CREATE INDEX "SterilizationDisposalLine_toolLineId_idx" ON "SterilizationDisposalLine"("toolLineId");

-- AddForeignKey
ALTER TABLE "SterilizationDisposal" ADD CONSTRAINT "SterilizationDisposal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationDisposalLine" ADD CONSTRAINT "SterilizationDisposalLine_disposalId_fkey" FOREIGN KEY ("disposalId") REFERENCES "SterilizationDisposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SterilizationDisposalLine" ADD CONSTRAINT "SterilizationDisposalLine_toolLineId_fkey" FOREIGN KEY ("toolLineId") REFERENCES "AutoclaveCycleToolLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

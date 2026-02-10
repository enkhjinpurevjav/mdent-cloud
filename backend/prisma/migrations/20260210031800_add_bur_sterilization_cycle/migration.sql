-- CreateTable
CREATE TABLE "BurSterilizationCycle" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "sterilizationRunNumber" TEXT NOT NULL,
    "machineId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "pressure" TEXT,
    "temperature" DOUBLE PRECISION,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "removedFromAutoclaveAt" TIMESTAMP(3),
    "result" "AutoclaveCycleResult" NOT NULL,
    "operator" TEXT NOT NULL,
    "notes" TEXT,
    "fastBurQty" INTEGER NOT NULL DEFAULT 0,
    "slowBurQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BurSterilizationCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BurSterilizationCycle_branchId_idx" ON "BurSterilizationCycle"("branchId");

-- CreateIndex
CREATE INDEX "BurSterilizationCycle_machineId_idx" ON "BurSterilizationCycle"("machineId");

-- CreateIndex
CREATE INDEX "BurSterilizationCycle_result_idx" ON "BurSterilizationCycle"("result");

-- CreateIndex
CREATE INDEX "BurSterilizationCycle_startedAt_idx" ON "BurSterilizationCycle"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BurSterilizationCycle_branchId_code_key" ON "BurSterilizationCycle"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BurSterilizationCycle_machineId_sterilizationRunNumber_key" ON "BurSterilizationCycle"("machineId", "sterilizationRunNumber");

-- AddForeignKey
ALTER TABLE "BurSterilizationCycle" ADD CONSTRAINT "BurSterilizationCycle_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

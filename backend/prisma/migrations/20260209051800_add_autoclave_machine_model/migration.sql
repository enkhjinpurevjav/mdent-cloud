-- CreateTable
CREATE TABLE "AutoclaveMachine" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "machineNumber" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoclaveMachine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoclaveMachine_branchId_idx" ON "AutoclaveMachine"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoclaveMachine_branchId_machineNumber_key" ON "AutoclaveMachine"("branchId", "machineNumber");

-- AddForeignKey
ALTER TABLE "AutoclaveMachine" ADD CONSTRAINT "AutoclaveMachine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

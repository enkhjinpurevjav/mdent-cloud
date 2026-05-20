CREATE TABLE "SupplyInventory" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplyInventory_productId_key" ON "SupplyInventory"("productId");
CREATE INDEX "SupplyInventory_updatedByUserId_idx" ON "SupplyInventory"("updatedByUserId");
CREATE INDEX "SupplyInventory_updatedAt_idx" ON "SupplyInventory"("updatedAt");

ALTER TABLE "SupplyInventory"
ADD CONSTRAINT "SupplyInventory_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "SupplyProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplyInventory"
ADD CONSTRAINT "SupplyInventory_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SupplyWallet" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplyOrder" (
    "id" SERIAL NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "walletAmount" DOUBLE PRECISION NOT NULL,
    "transferAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplyOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplyWalletTransaction" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER,
    "delta" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyWalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplyOrder_createdByUserId_createdAt_idx" ON "SupplyOrder"("createdByUserId", "createdAt");
CREATE INDEX "SupplyOrder_createdAt_idx" ON "SupplyOrder"("createdAt");
CREATE INDEX "SupplyOrderItem_orderId_idx" ON "SupplyOrderItem"("orderId");
CREATE INDEX "SupplyOrderItem_productId_idx" ON "SupplyOrderItem"("productId");
CREATE INDEX "SupplyWalletTransaction_orderId_idx" ON "SupplyWalletTransaction"("orderId");
CREATE INDEX "SupplyWalletTransaction_createdByUserId_createdAt_idx" ON "SupplyWalletTransaction"("createdByUserId", "createdAt");
CREATE INDEX "SupplyWalletTransaction_createdAt_idx" ON "SupplyWalletTransaction"("createdAt");

ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyOrderItem" ADD CONSTRAINT "SupplyOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SupplyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplyOrderItem" ADD CONSTRAINT "SupplyOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SupplyProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyWalletTransaction" ADD CONSTRAINT "SupplyWalletTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SupplyOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplyWalletTransaction" ADD CONSTRAINT "SupplyWalletTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "SupplyWallet" ("id", "currentBalance", "updatedAt")
VALUES (1, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

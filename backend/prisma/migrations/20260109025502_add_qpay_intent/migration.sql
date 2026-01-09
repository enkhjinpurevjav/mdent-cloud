-- CreateTable
CREATE TABLE "QPayIntent" (
    "id" SERIAL NOT NULL,
    "environment" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" INTEGER NOT NULL,
    "qpayInvoiceId" TEXT NOT NULL,
    "senderInvoiceNo" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "paidAmount" DOUBLE PRECISION,
    "qpayPaymentId" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QPayIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QPayIntent_qpayInvoiceId_key" ON "QPayIntent"("qpayInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "QPayIntent_senderInvoiceNo_key" ON "QPayIntent"("senderInvoiceNo");

-- CreateIndex
CREATE INDEX "QPayIntent_objectType_objectId_idx" ON "QPayIntent"("objectType", "objectId");

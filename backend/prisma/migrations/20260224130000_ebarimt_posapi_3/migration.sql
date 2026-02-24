-- CreateEnum: eBarimt receipt status
CREATE TYPE "EBarimtReceiptStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELED');

-- CreateEnum: buyer type
CREATE TYPE "BuyerType" AS ENUM ('B2C', 'B2B');

-- CreateEnum: operator merchant request status
CREATE TYPE "OperatorMerchantRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- AlterTable: add buyerType and buyerTin to Invoice
ALTER TABLE "Invoice" ADD COLUMN "buyerType" "BuyerType" NOT NULL DEFAULT 'B2C';
ALTER TABLE "Invoice" ADD COLUMN "buyerTin" TEXT;

-- DropTable: old simple EBarimtReceipt
DROP TABLE "EBarimtReceipt";

-- CreateTable: new full EBarimtReceipt
CREATE TABLE "EBarimtReceipt" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "status" "EBarimtReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "ddtd" TEXT,
    "printedAt" TIMESTAMP(3),
    "printedAtText" TEXT,
    "posId" TEXT,
    "posNo" TEXT,
    "merchantTin" TEXT,
    "branchNo" TEXT,
    "districtCode" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "vat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cityTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "issueRawRequest" JSONB,
    "issueRawResponse" JSONB,
    "cancelRawRequest" JSONB,
    "cancelRawResponse" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EBarimtReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EBarimtReceipt_invoiceId_key" ON "EBarimtReceipt"("invoiceId");

-- CreateIndex
CREATE INDEX "EBarimtReceipt_status_idx" ON "EBarimtReceipt"("status");

-- AddForeignKey
ALTER TABLE "EBarimtReceipt" ADD CONSTRAINT "EBarimtReceipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: OperatorMerchantRequest
CREATE TABLE "OperatorMerchantRequest" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER,
    "posNo" TEXT NOT NULL,
    "merchantTin" TEXT NOT NULL,
    "status" "OperatorMerchantRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rawRequest" JSONB,
    "rawResponse" JSONB,
    "errorMessage" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorMerchantRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorMerchantRequest_status_idx" ON "OperatorMerchantRequest"("status");

-- CreateIndex
CREATE INDEX "OperatorMerchantRequest_merchantTin_idx" ON "OperatorMerchantRequest"("merchantTin");

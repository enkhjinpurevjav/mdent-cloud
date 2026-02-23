-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'ONLINE_HELD';
ALTER TYPE "BookingStatus" ADD VALUE 'ONLINE_CONFIRMED';
ALTER TYPE "BookingStatus" ADD VALUE 'ONLINE_EXPIRED';

-- CreateTable
CREATE TABLE "BookingDeposit" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "qpayInvoiceId" TEXT NOT NULL,
    "senderInvoiceNo" TEXT NOT NULL,
    "callbackToken" TEXT NOT NULL,
    "paidAmount" INTEGER,
    "qpayPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingDeposit_bookingId_key" ON "BookingDeposit"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingDeposit_qpayInvoiceId_key" ON "BookingDeposit"("qpayInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingDeposit_senderInvoiceNo_key" ON "BookingDeposit"("senderInvoiceNo");

-- CreateIndex
CREATE INDEX "BookingDeposit_branchId_idx" ON "BookingDeposit"("branchId");

-- AddForeignKey
ALTER TABLE "BookingDeposit" ADD CONSTRAINT "BookingDeposit_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

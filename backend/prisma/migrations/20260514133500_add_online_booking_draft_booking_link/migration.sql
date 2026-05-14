-- AlterTable
ALTER TABLE "OnlineBookingDraft" ADD COLUMN "bookingId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "OnlineBookingDraft_bookingId_key" ON "OnlineBookingDraft"("bookingId");

-- AddForeignKey
ALTER TABLE "OnlineBookingDraft" ADD CONSTRAINT "OnlineBookingDraft_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index on Payment.qpayTxnId for idempotency checks
CREATE INDEX "Payment_qpayTxnId_idx" ON "Payment"("qpayTxnId");

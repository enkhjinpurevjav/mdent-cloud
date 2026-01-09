# QPay Integration Documentation

## Overview
This integration adds QPay payment support (sandbox and live) to M Dent, allowing patients to pay invoices via QR code scanning.

## Environment Variables

Add these to your `.env` file in the `backend/` directory:

```bash
# QPay Environment (sandbox or live)
QPAY_ENV=sandbox

# QPay API Base URLs
QPAY_BASE_URL_SANDBOX=https://merchant-sandbox.qpay.mn
QPAY_BASE_URL_LIVE=https://merchant.qpay.mn

# QPay Credentials (obtain from QPay merchant portal)
QPAY_CLIENT_ID=your_client_id_here
QPAY_CLIENT_SECRET=your_client_secret_here
QPAY_INVOICE_CODE=your_invoice_code_here

# QPay Callback URL (your domain)
QPAY_CALLBACK_URL=https://your-domain.com/api/qpay/callback

# Optional: Receiver code (default: terminal)
QPAY_RECEIVER_CODE=terminal
```

## Database Setup

Run Prisma migrations to create the `QPayIntent` table and add the QPAY payment method:

```bash
cd backend
npx prisma migrate deploy
```

Or manually run migrations:
```bash
npx prisma migrate dev
```

## Backend Architecture

### 1. QPayIntent Model (`backend/prisma/schema.prisma`)
Tracks QPay invoice creation and payment status:
- `environment`: "sandbox" or "live"
- `objectType`: "INVOICE" or "BOOKING"
- `qpayInvoiceId`: Unique QPay invoice identifier
- `status`: "NEW", "PAID", "FAILED", "CANCELLED"
- `raw`: Full QPay API response (JSONB)

### 2. QPay Service (`backend/src/services/qpayService.js`)
Core QPay API integration:
- `getAccessToken()`: Token management with 50-minute cache
- `createInvoice()`: Generate QPay invoice + QR code
- `checkInvoicePaid()`: Poll payment status

### 3. QPay Router (`backend/src/routes/qpay.js`)
API endpoints:
- `POST /api/qpay/invoice`: Create QPay invoice for M Dent invoice
- `POST /api/qpay/check`: Check if QPay invoice is paid
- `GET/POST /api/qpay/callback`: QPay webhook (logs only, polling is primary)
- `POST /api/qpay/dev/create-test-invoice`: Dev helper (non-production)

### 4. Settlement Integration (`backend/src/routes/invoices.js`)
Modified settlement route for QPAY idempotency:
- Checks `qpayTxnId` to prevent duplicate settlements
- Stores `qpayPaymentId` in `Payment.qpayTxnId`

## Frontend Architecture

### 1. Payment UI (`frontend/pages/billing/[id].tsx`)
QPAY checkbox in payment section:
- Amount input
- "Generate QR" button
- Opens modal with QR code

### 2. QPay Modal
Displays:
- QR image for scanning
- QR text (copyable)
- Deep links for mobile apps
- "Waiting for payment..." status

### 3. Polling Logic
- Every 3 seconds: `POST /api/qpay/check`
- When paid: Auto-calls settlement endpoint
- Stops polling when modal closes or payment confirmed

## Testing Flow

### 1. Backend Tests (Manual)
```bash
# Start backend
cd backend
npm start

# In another terminal, test endpoints:
curl -X POST http://localhost:8080/api/qpay/invoice \
  -H "Content-Type: application/json" \
  -d '{"invoiceId":1,"amount":1000}'

# Copy qpayInvoiceId from response, then check status:
curl -X POST http://localhost:8080/api/qpay/check \
  -H "Content-Type: application/json" \
  -d '{"qpayInvoiceId":"INVOICE_ID_HERE"}'
```

### 2. Frontend Tests (Manual)
1. Start frontend: `cd frontend && npm run dev`
2. Navigate to billing page for an invoice
3. Check QPAY payment method
4. Enter amount
5. Click "QR үүсгэх" (Generate QR)
6. Modal should open with QR code
7. Scan with QPay sandbox app (or simulate payment via QPay dashboard)
8. After 3 seconds, should auto-detect payment and settle

### 3. Test Idempotency
1. Generate QPay invoice and pay
2. Try settling with same `qpayPaymentId` again
3. Should return existing invoice state (no duplicate)

## Production Checklist

- [ ] Set `QPAY_ENV=live`
- [ ] Update `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE` with live credentials
- [ ] Set `QPAY_CALLBACK_URL` to production domain
- [ ] Test end-to-end flow in staging with QPay test account
- [ ] Monitor logs for QPay API errors
- [ ] Set up alerting for failed QPay transactions

## Troubleshooting

### "Missing QPay credentials" error
- Check `.env` file has `QPAY_CLIENT_ID` and `QPAY_CLIENT_SECRET`

### "QPay auth failed"
- Verify credentials are correct for the environment (sandbox vs live)
- Check QPay merchant portal for API access

### QR code doesn't appear
- Check browser console for API errors
- Verify invoice exists and has valid amount
- Check backend logs for detailed error

### Payment not detected (polling timeout)
- Check QPay sandbox/live dashboard to see if payment was actually made
- Verify `QPAY_INVOICE_CODE` matches your QPay account
- Try manual check: `POST /api/qpay/check` with your `qpayInvoiceId`

### Duplicate settlement error
- This is expected if trying to settle twice with same QPay payment
- Frontend should prevent this, but backend has idempotency check

## Future Enhancements

- [ ] Add support for BOOKING deposits (objectType="BOOKING")
- [ ] Webhook-based payment detection (instead of polling)
- [ ] QPay refund support
- [ ] Multi-currency support
- [ ] Payment link generation (email/SMS)

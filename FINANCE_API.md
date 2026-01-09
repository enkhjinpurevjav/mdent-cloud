# Finance Staff-Income Prerequisites API

This document describes the new API features added for finance staff-income calculations.

## 1. Invoice Collection Discount

### Schema Change
- Added `collectionDiscountAmount` field to the `Invoice` model
- Type: `Float`
- Default: `0`
- Purpose: Store collection-time discount (separate from `discountPercent`)

### API Changes

#### GET `/api/billing/encounters/:id/invoice`
Returns invoice details including the new field:
```json
{
  "id": 123,
  "collectionDiscountAmount": 5000,
  "discountPercent": 10,
  "finalAmount": 95000,
  ...
}
```

#### POST `/api/billing/encounters/:id/invoice`
Create/update invoice with collection discount:
```json
{
  "items": [...],
  "discountPercent": 10,
  "collectionDiscountAmount": 5000
}
```

#### POST `/api/invoices/:id/settlement`
Settlement response includes collection discount:
```json
{
  "id": 123,
  "collectionDiscountAmount": 5000,
  ...
}
```

## 2. Payment Metadata

### Schema Change
- Added `meta` field to the `Payment` model
- Type: `Json` (nullable)
- Purpose: Store payment method-specific metadata for staff-income rules

### Usage by Payment Method

The `meta` field in the settlement request body can contain:

#### QPAY
```json
{
  "method": "QPAY",
  "meta": {
    "qpayPaymentId": "ABC123",
    "qpayInvoiceId": "INV456"
  }
}
```
Note: `qpayPaymentId` is also stored in `qpayTxnId` for backward compatibility.

#### INSURANCE / APPLICATION
```json
{
  "method": "INSURANCE",  // or "APPLICATION"
  "meta": {
    "providerId": 42,
    "providerName": "Bodi Daatgal"
  }
}
```
Both INSURANCE and APPLICATION are handled consistently with providerId.

#### VOUCHER
```json
{
  "method": "VOUCHER",
  "meta": {
    "code": "SUMMER2024",
    "type": "discount"
  }
}
```

#### BARTER
```json
{
  "method": "BARTER",
  "meta": {
    "code": "BARTER-001",
    "description": "Service exchange"
  }
}
```

#### TRANSFER
```json
{
  "method": "TRANSFER",
  "meta": {
    "note": "Khan Bank - Transfer #12345",
    "bankName": "Khan Bank"
  }
}
```

#### EMPLOYEE_BENEFIT
```json
{
  "method": "EMPLOYEE_BENEFIT",
  "meta": {
    "employeeCode": "EMP123"
  }
}
```
Note: `employeeCode` is required in meta for EMPLOYEE_BENEFIT method.

#### CASH / POS
```json
{
  "method": "CASH",
  "meta": null  // optional, can be omitted
}
```

## 3. Settings API (Global Finance Configuration)

### Schema
New `Settings` table for key-value configuration:
- `id`: Int (primary key)
- `key`: String (unique)
- `value`: String (stored as string, parse as needed)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### API Endpoints

#### GET `/api/settings/:key`
Read a setting by key:
```bash
GET /api/settings/finance.homeBleachingDeductAmountMnt
```
Response:
```json
{
  "key": "finance.homeBleachingDeductAmountMnt",
  "value": "50000",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### POST `/api/settings`
Create or update (upsert) a setting:
```bash
POST /api/settings
Content-Type: application/json

{
  "key": "finance.homeBleachingDeductAmountMnt",
  "value": "50000"
}
```
Response:
```json
{
  "key": "finance.homeBleachingDeductAmountMnt",
  "value": "50000",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

Note: The value can be any string. For numbers, parse with `Number(value)` or `parseInt(value)`. For JSON, use `JSON.parse(value)`.

#### GET `/api/settings`
List all settings (for admin UI):
```bash
GET /api/settings
```
Response:
```json
{
  "settings": [
    {
      "key": "finance.homeBleachingDeductAmountMnt",
      "value": "50000",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### DELETE `/api/settings/:key`
Delete a setting (admin only):
```bash
DELETE /api/settings/finance.homeBleachingDeductAmountMnt
```
Response:
```json
{
  "success": true,
  "message": "Setting deleted"
}
```

### Usage Example: Home Bleaching Deduction

For Service.code=151 (home bleaching), the system needs a fixed deduction amount:

1. Set the value:
```bash
POST /api/settings
{
  "key": "finance.homeBleachingDeductAmountMnt",
  "value": "50000"
}
```

2. Read the value in staff-income calculations:
```javascript
const setting = await prisma.settings.findUnique({
  where: { key: 'finance.homeBleachingDeductAmountMnt' }
});
const deductAmount = setting ? Number(setting.value) : 0;
```

## Migration

To apply the database changes:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

The migration file is located at:
`backend/prisma/migrations/20260109120541_add_finance_prerequisites/migration.sql`

## Backward Compatibility

- All changes are backward compatible
- `collectionDiscountAmount` defaults to 0
- `Payment.meta` is nullable (existing payments have null)
- `Payment.qpayTxnId` is preserved for QPAY payments
- Existing billing flows continue to work without modification

# Testing Guide: Finance Staff-Income Prerequisites

This guide explains how to test and verify the new finance prerequisites features.

## Prerequisites

1. Apply the database migration:
   ```bash
   cd backend
   npx prisma migrate deploy
   npx prisma generate
   ```

2. Restart the backend server

## 1. Testing Invoice Collection Discount

### Test GET /api/billing/encounters/:id/invoice

Create or use an existing encounter, then fetch its invoice:

```bash
# Replace {encounterId} with actual ID
GET /api/billing/encounters/{encounterId}/invoice
```

**Expected Response:**
```json
{
  "id": 123,
  "collectionDiscountAmount": 0,  // ← New field, defaults to 0
  "discountPercent": 0,
  "finalAmount": 100000,
  ...
}
```

### Test POST /api/billing/encounters/:id/invoice

Create/update an invoice with collection discount:

```bash
POST /api/billing/encounters/{encounterId}/invoice
Content-Type: application/json

{
  "discountPercent": 10,
  "collectionDiscountAmount": 5000,  // ← New field
  "items": [
    {
      "itemType": "SERVICE",
      "serviceId": 1,
      "name": "Cleaning",
      "unitPrice": 50000,
      "quantity": 1
    }
  ]
}
```

**Expected Response:**
```json
{
  "id": 123,
  "collectionDiscountAmount": 5000,  // ← Saved correctly
  "discountPercent": 10,
  "finalAmount": 45000,
  ...
}
```

### Test Settlement Response

When settling an invoice, the response should include collection discount:

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 45000,
  "method": "CASH"
}
```

**Expected Response:**
```json
{
  "id": 123,
  "collectionDiscountAmount": 5000,  // ← Included in response
  "finalAmount": 45000,
  "paidTotal": 45000,
  ...
}
```

## 2. Testing Payment Metadata

### Test QPAY with Meta

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "QPAY",
  "meta": {
    "qpayPaymentId": "PAY123ABC",
    "qpayInvoiceId": "INV456DEF"
  }
}
```

**Verification:**
- Payment should be created with `meta` field populated
- `qpayTxnId` should also contain "PAY123ABC" for backward compatibility

### Test INSURANCE with Meta

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "INSURANCE",
  "meta": {
    "providerId": 42,
    "providerName": "Bodi Daatgal"
  }
}
```

**Verification:**
- Payment.meta should contain the providerId
- Same structure should work for APPLICATION method

### Test APPLICATION with Meta

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "APPLICATION",
  "meta": {
    "providerId": 15,
    "providerName": "Storepay"
  }
}
```

**Verification:**
- APPLICATION and INSURANCE should be handled consistently
- Both should store providerId in meta

### Test VOUCHER with Meta

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "VOUCHER",
  "meta": {
    "code": "SUMMER2024",
    "type": "discount",
    "description": "Summer promotion"
  }
}
```

### Test BARTER with Meta

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "BARTER",
  "meta": {
    "code": "BARTER-001",
    "description": "Service exchange with partner clinic"
  }
}
```

### Test TRANSFER with Meta

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "TRANSFER",
  "meta": {
    "note": "Khan Bank - Transfer #12345",
    "bankName": "Khan Bank"
  }
}
```

### Test EMPLOYEE_BENEFIT with Meta

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "EMPLOYEE_BENEFIT",
  "meta": {
    "employeeCode": "EMP123"
  }
}
```

**Note:** employeeCode is required and must exist in the EmployeeBenefit table.

### Test CASH without Meta (optional)

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "CASH"
}
```

**Verification:**
- Payment.meta should be null (no error)
- Payment should be created successfully

## 3. Testing Settings API

### Test Creating a Setting

```bash
POST /api/settings
Content-Type: application/json

{
  "key": "finance.homeBleachingDeductAmountMnt",
  "value": "50000"
}
```

**Expected Response:**
```json
{
  "key": "finance.homeBleachingDeductAmountMnt",
  "value": "50000",
  "createdAt": "2024-01-09T12:00:00.000Z",
  "updatedAt": "2024-01-09T12:00:00.000Z"
}
```

### Test Reading a Setting

```bash
GET /api/settings/finance.homeBleachingDeductAmountMnt
```

**Expected Response:**
```json
{
  "key": "finance.homeBleachingDeductAmountMnt",
  "value": "50000",
  "createdAt": "2024-01-09T12:00:00.000Z",
  "updatedAt": "2024-01-09T12:00:00.000Z"
}
```

### Test Updating a Setting (Upsert)

```bash
POST /api/settings
Content-Type: application/json

{
  "key": "finance.homeBleachingDeductAmountMnt",
  "value": "60000"
}
```

**Expected Response:**
```json
{
  "key": "finance.homeBleachingDeductAmountMnt",
  "value": "60000",  // ← Updated value
  "createdAt": "2024-01-09T12:00:00.000Z",
  "updatedAt": "2024-01-09T12:05:00.000Z"  // ← Updated timestamp
}
```

### Test Listing All Settings

```bash
GET /api/settings
```

**Expected Response:**
```json
{
  "settings": [
    {
      "key": "finance.homeBleachingDeductAmountMnt",
      "value": "60000",
      "createdAt": "2024-01-09T12:00:00.000Z",
      "updatedAt": "2024-01-09T12:05:00.000Z"
    }
  ]
}
```

### Test Deleting a Setting

```bash
DELETE /api/settings/finance.homeBleachingDeductAmountMnt
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Setting deleted"
}
```

### Test Non-Existent Setting

```bash
GET /api/settings/nonexistent.key
```

**Expected Response:**
```json
{
  "error": "Setting not found"
}
```
Status: 404

## 4. Database Verification

### Check Invoice Table

```sql
-- Verify collectionDiscountAmount column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'Invoice' AND column_name = 'collectionDiscountAmount';

-- Check existing invoices have default value
SELECT id, "collectionDiscountAmount", "finalAmount" 
FROM "Invoice" 
LIMIT 5;
```

### Check Payment Table

```sql
-- Verify meta column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Payment' AND column_name = 'meta';

-- Check payments with meta
SELECT id, method, meta, "qpayTxnId"
FROM "Payment" 
WHERE meta IS NOT NULL
LIMIT 5;
```

### Check Settings Table

```sql
-- Verify Settings table exists
SELECT * FROM "Settings";

-- Test inserting a setting directly
INSERT INTO "Settings" (key, value, "createdAt", "updatedAt")
VALUES ('test.setting', '12345', NOW(), NOW());

-- Verify unique constraint on key
-- This should fail:
INSERT INTO "Settings" (key, value, "createdAt", "updatedAt")
VALUES ('test.setting', '67890', NOW(), NOW());
```

## 5. Backward Compatibility Tests

### Test Existing Invoice Creation (without new fields)

Old clients that don't send `collectionDiscountAmount` should still work:

```bash
POST /api/billing/encounters/{encounterId}/invoice
Content-Type: application/json

{
  "discountPercent": 5,
  "items": [...]
}
```

**Expected:** Should work fine, `collectionDiscountAmount` defaults to 0

### Test Existing Payment Settlement (without meta)

Old payment flows without meta should continue working:

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "CASH"
}
```

**Expected:** Should work fine, `meta` is null

### Test QPAY Legacy Format

QPAY payments should work with just qpayTxnId (backward compatible):

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "QPAY",
  "meta": {
    "qpayPaymentId": "LEGACY123"
  }
}
```

**Expected:** Both `qpayTxnId` and `meta` should be populated

## 6. Error Handling Tests

### Test Invalid Setting Key

```bash
POST /api/settings
Content-Type: application/json

{
  "value": "12345"
}
```

**Expected:** 400 error with message "key is required and must be a string"

### Test Invalid Setting Value

```bash
POST /api/settings
Content-Type: application/json

{
  "key": "test.key"
}
```

**Expected:** 400 error with message "value is required"

### Test EMPLOYEE_BENEFIT without Code

```bash
POST /api/invoices/{invoiceId}/settlement
Content-Type: application/json

{
  "amount": 50000,
  "method": "EMPLOYEE_BENEFIT"
}
```

**Expected:** 400 error with message "employeeCode is required for EMPLOYEE_BENEFIT."

## Success Criteria

✅ All invoice endpoints return `collectionDiscountAmount`  
✅ Collection discount can be set and saved  
✅ Payment meta is stored for all payment methods  
✅ Settings can be created, read, updated, and deleted  
✅ Backward compatibility maintained (existing flows work)  
✅ No syntax errors in any file  
✅ No security vulnerabilities detected  
✅ Migration applies successfully  

## Troubleshooting

### Issue: Migration fails
**Solution:** Check that DATABASE_URL is set correctly and database is accessible

### Issue: Settings routes return 404
**Solution:** Verify backend server restarted after adding routes

### Issue: collectionDiscountAmount not in response
**Solution:** Regenerate Prisma client: `npx prisma generate`

### Issue: Payment.meta not saving
**Solution:** Verify migration applied: check if `meta` column exists in Payment table

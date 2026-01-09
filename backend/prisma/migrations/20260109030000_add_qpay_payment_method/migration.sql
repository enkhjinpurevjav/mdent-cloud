-- Add QPAY payment method if it doesn't exist
-- This is an idempotent migration that can be run multiple times

-- Insert QPAY payment method (will skip if already exists due to unique constraint)
INSERT INTO "PaymentMethodConfig" (key, label, "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES ('QPAY', 'QPay', true, 100, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

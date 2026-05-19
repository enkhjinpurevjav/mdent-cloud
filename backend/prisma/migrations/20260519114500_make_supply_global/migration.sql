ALTER TABLE "SupplyProduct" DROP CONSTRAINT IF EXISTS "SupplyProduct_branchId_fkey";
ALTER TABLE "SupplyCategory" DROP CONSTRAINT IF EXISTS "SupplyCategory_branchId_fkey";

DROP INDEX IF EXISTS "SupplyProduct_branchId_isActive_idx";
DROP INDEX IF EXISTS "SupplyCategory_branchId_idx";
DROP INDEX IF EXISTS "SupplyCategory_branchId_name_key";

ALTER TABLE "SupplyProduct" DROP COLUMN IF EXISTS "branchId";
ALTER TABLE "SupplyCategory" DROP COLUMN IF EXISTS "branchId";

CREATE UNIQUE INDEX IF NOT EXISTS "SupplyCategory_name_key" ON "SupplyCategory"("name");
CREATE INDEX IF NOT EXISTS "SupplyProduct_isActive_idx" ON "SupplyProduct"("isActive");

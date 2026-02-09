-- Step 1: Rename quantity to baselineAmount
ALTER TABLE "SterilizationItem" RENAME COLUMN "quantity" TO "baselineAmount";

-- Step 2: Drop the foreign key constraint and index on categoryId
ALTER TABLE "SterilizationItem" DROP CONSTRAINT "SterilizationItem_categoryId_fkey";
DROP INDEX "SterilizationItem_categoryId_idx";

-- Step 3: Drop the categoryId column
ALTER TABLE "SterilizationItem" DROP COLUMN "categoryId";

-- Step 4: Drop the SterilizationCategory table
DROP TABLE "SterilizationCategory";

CREATE TABLE "SupplyCategory" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplyProduct" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "imagePaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplyCategory_branchId_name_key" ON "SupplyCategory"("branchId", "name");
CREATE INDEX "SupplyCategory_branchId_idx" ON "SupplyCategory"("branchId");
CREATE INDEX "SupplyProduct_branchId_isActive_idx" ON "SupplyProduct"("branchId", "isActive");
CREATE INDEX "SupplyProduct_categoryId_idx" ON "SupplyProduct"("categoryId");

ALTER TABLE "SupplyCategory" ADD CONSTRAINT "SupplyCategory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyProduct" ADD CONSTRAINT "SupplyProduct_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyProduct" ADD CONSTRAINT "SupplyProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SupplyCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

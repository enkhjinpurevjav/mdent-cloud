-- CreateTable
CREATE TABLE "ServiceCategoryConfig" (
    "id" SERIAL NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategoryConfig_category_key" ON "ServiceCategoryConfig"("category");

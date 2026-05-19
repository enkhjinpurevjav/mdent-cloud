-- CreateTable
CREATE TABLE "QPayAuthToken" (
    "id" SERIAL NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QPayAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QPayAuthToken_cacheKey_key" ON "QPayAuthToken"("cacheKey");

-- CreateIndex
CREATE INDEX "QPayAuthToken_environment_clientId_idx" ON "QPayAuthToken"("environment", "clientId");

-- CreateIndex
CREATE INDEX "QPayAuthToken_expiresAt_idx" ON "QPayAuthToken"("expiresAt");

-- CreateTable
CREATE TABLE "PaymentMethodConfig" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderConfig" (
    "id" SERIAL NOT NULL,
    "methodKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodConfig_key_key" ON "PaymentMethodConfig"("key");

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_isActive_sortOrder_idx" ON "PaymentMethodConfig"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PaymentProviderConfig_methodKey_isActive_sortOrder_idx" ON "PaymentProviderConfig"("methodKey", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "PaymentProviderConfig" ADD CONSTRAINT "PaymentProviderConfig_methodKey_fkey" FOREIGN KEY ("methodKey") REFERENCES "PaymentMethodConfig"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default payment methods
INSERT INTO "PaymentMethodConfig" ("key", "label", "isActive", "sortOrder") VALUES
    ('CASH', 'Бэлэн мөнгө', true, 1),
    ('POS', 'Карт (POS)', true, 2),
    ('TRANSFER', 'Дансны шилжүүлэг', true, 3),
    ('INSURANCE', 'Даатгал', true, 4),
    ('APPLICATION', 'Аппликэйшнээр төлбөр', true, 5),
    ('VOUCHER', 'Купон / Ваучер', true, 6),
    ('EMPLOYEE_BENEFIT', 'Ажилтны хөнгөлөлт', true, 7),
    ('WALLET', 'Хэтэвч (урьдчилгаа / илүү төлөлтөөс)', true, 8),
    ('BARTER', 'Бартер', true, 9),
    ('OTHER', 'Бусад', true, 10);

-- Seed default insurance providers
INSERT INTO "PaymentProviderConfig" ("methodKey", "name", "isActive", "sortOrder") VALUES
    ('INSURANCE', 'Bodi Daatgal', true, 1),
    ('INSURANCE', 'National Life', true, 2),
    ('INSURANCE', 'Mandal Daatgal', true, 3);

-- Seed default application providers
INSERT INTO "PaymentProviderConfig" ("methodKey", "name", "isActive", "sortOrder") VALUES
    ('APPLICATION', 'Storepay', true, 1),
    ('APPLICATION', 'PocketPay', true, 2),
    ('APPLICATION', 'CarePay', true, 3),
    ('APPLICATION', 'ArdPay', true, 4),
    ('APPLICATION', 'Toki', true, 5),
    ('APPLICATION', 'payOn', true, 6),
    ('APPLICATION', 'Sono', true, 7);

-- Seed default bank providers for TRANSFER (common Mongolian banks)
INSERT INTO "PaymentProviderConfig" ("methodKey", "name", "isActive", "sortOrder") VALUES
    ('TRANSFER', 'Хаан банк', true, 1),
    ('TRANSFER', 'Голомт банк', true, 2),
    ('TRANSFER', 'Төрийн банк', true, 3),
    ('TRANSFER', 'Худалдаа хөгжлийн банк', true, 4);

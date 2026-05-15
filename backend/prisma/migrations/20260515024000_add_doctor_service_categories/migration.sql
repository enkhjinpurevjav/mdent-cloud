-- CreateTable
CREATE TABLE "DoctorServiceCategory" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorServiceCategory_doctorId_category_key" ON "DoctorServiceCategory"("doctorId", "category");

-- CreateIndex
CREATE INDEX "DoctorServiceCategory_category_isActive_idx" ON "DoctorServiceCategory"("category", "isActive");

-- AddForeignKey
ALTER TABLE "DoctorServiceCategory" ADD CONSTRAINT "DoctorServiceCategory_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing doctors with all bookable categories
INSERT INTO "DoctorServiceCategory" ("doctorId", "category", "isActive", "createdAt", "updatedAt")
SELECT
  u."id",
  c."category"::"ServiceCategory",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN (
  VALUES
    ('ORTHODONTIC_TREATMENT'),
    ('IMAGING'),
    ('DEFECT_CORRECTION'),
    ('ADULT_TREATMENT'),
    ('WHITENING'),
    ('CHILD_TREATMENT'),
    ('SURGERY')
) AS c("category")
WHERE u."role" = 'doctor'
ON CONFLICT ("doctorId", "category") DO NOTHING;

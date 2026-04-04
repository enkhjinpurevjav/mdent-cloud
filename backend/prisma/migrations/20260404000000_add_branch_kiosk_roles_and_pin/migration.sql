-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'branch_kiosk';
ALTER TYPE "UserRole" ADD VALUE 'doctor_kiosk';

-- AlterTable: add PIN fields to User
ALTER TABLE "User" ADD COLUMN "pinHash" TEXT,
                   ADD COLUMN "pinUpdatedAt" TIMESTAMP(3);

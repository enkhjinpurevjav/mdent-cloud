-- Phase 1 attendance foundations:
-- 1) migrate AttendanceAttempt timestamp column from createdAt -> attemptAt
-- 2) add AttendanceSession review flags
-- 3) add AttendanceSessionEdit audit table
-- 4) add AttendancePolicy table

ALTER TABLE "AttendanceAttempt" ADD COLUMN "attemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "AttendanceAttempt" SET "attemptAt" = "createdAt";
ALTER TABLE "AttendanceAttempt" DROP COLUMN "createdAt";

DROP INDEX IF EXISTS "AttendanceAttempt_userId_createdAt_idx";
DROP INDEX IF EXISTS "AttendanceAttempt_branchId_createdAt_idx";
DROP INDEX IF EXISTS "AttendanceAttempt_attemptType_result_createdAt_idx";
CREATE INDEX "AttendanceAttempt_userId_attemptAt_idx" ON "AttendanceAttempt"("userId", "attemptAt");
CREATE INDEX "AttendanceAttempt_branchId_attemptAt_idx" ON "AttendanceAttempt"("branchId", "attemptAt");
CREATE INDEX "AttendanceAttempt_attemptType_result_attemptAt_idx" ON "AttendanceAttempt"("attemptType", "result", "attemptAt");

ALTER TABLE "AttendanceSession"
ADD COLUMN "requiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewReason" TEXT;

CREATE TABLE "AttendanceSessionEdit" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "editedByUserId" INTEGER NOT NULL,
  "approvedByUserId" INTEGER,
  "oldCheckInAt" TIMESTAMP(3) NOT NULL,
  "oldCheckOutAt" TIMESTAMP(3),
  "newCheckInAt" TIMESTAMP(3) NOT NULL,
  "newCheckOutAt" TIMESTAMP(3),
  "reasonCode" TEXT NOT NULL,
  "reasonText" TEXT,
  "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceSessionEdit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AttendanceSessionEdit"
ADD CONSTRAINT "AttendanceSessionEdit_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceSessionEdit"
ADD CONSTRAINT "AttendanceSessionEdit_editedByUserId_fkey"
FOREIGN KEY ("editedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceSessionEdit"
ADD CONSTRAINT "AttendanceSessionEdit_approvedByUserId_fkey"
FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AttendanceSessionEdit_sessionId_editedAt_idx" ON "AttendanceSessionEdit"("sessionId", "editedAt");
CREATE INDEX "AttendanceSessionEdit_editedByUserId_editedAt_idx" ON "AttendanceSessionEdit"("editedByUserId", "editedAt");
CREATE INDEX "AttendanceSessionEdit_approvedByUserId_editedAt_idx" ON "AttendanceSessionEdit"("approvedByUserId", "editedAt");

CREATE TABLE "AttendancePolicy" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER,
  "role" "UserRole",
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "earlyCheckInMinutes" INTEGER NOT NULL DEFAULT 120,
  "lateGraceMinutes" INTEGER NOT NULL DEFAULT 0,
  "earlyLeaveGraceMinutes" INTEGER NOT NULL DEFAULT 0,
  "autoCloseAfterMinutes" INTEGER NOT NULL DEFAULT 720,
  "minAccuracyM" INTEGER NOT NULL DEFAULT 100,
  "enforceGeofence" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AttendancePolicy"
ADD CONSTRAINT "AttendancePolicy_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AttendancePolicy_isActive_priority_idx" ON "AttendancePolicy"("isActive", "priority");
CREATE INDEX "AttendancePolicy_branchId_role_isActive_idx" ON "AttendancePolicy"("branchId", "role", "isActive");

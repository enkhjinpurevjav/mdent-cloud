-- Attendance attempt audit logs (successful and failed check-in/check-out attempts)
CREATE TYPE "AttendanceAttemptType" AS ENUM ('CHECK_IN', 'CHECK_OUT');
CREATE TYPE "AttendanceAttemptResult" AS ENUM ('SUCCESS', 'FAIL');

CREATE TABLE "AttendanceAttempt" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "branchId" INTEGER,
  "attemptType" "AttendanceAttemptType" NOT NULL,
  "result" "AttendanceAttemptResult" NOT NULL,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "accuracyM" INTEGER,
  "distanceM" INTEGER,
  "radiusM" INTEGER,

  CONSTRAINT "AttendanceAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AttendanceAttempt"
ADD CONSTRAINT "AttendanceAttempt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceAttempt"
ADD CONSTRAINT "AttendanceAttempt_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AttendanceAttempt_userId_createdAt_idx" ON "AttendanceAttempt"("userId", "createdAt");
CREATE INDEX "AttendanceAttempt_branchId_createdAt_idx" ON "AttendanceAttempt"("branchId", "createdAt");
CREATE INDEX "AttendanceAttempt_attemptType_result_createdAt_idx" ON "AttendanceAttempt"("attemptType", "result", "createdAt");

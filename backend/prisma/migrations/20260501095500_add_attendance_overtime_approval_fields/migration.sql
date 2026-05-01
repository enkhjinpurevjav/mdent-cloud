ALTER TABLE "AttendanceSession"
ADD COLUMN "overtimeApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "overtimeApprovedAt" TIMESTAMP(3),
ADD COLUMN "overtimeApprovedByUserId" INTEGER;

ALTER TABLE "AttendanceSession"
ADD CONSTRAINT "AttendanceSession_overtimeApprovedByUserId_fkey"
FOREIGN KEY ("overtimeApprovedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AttendanceSession_overtimeApprovedByUserId_idx"
ON "AttendanceSession"("overtimeApprovedByUserId");

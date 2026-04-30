export const ATTENDANCE_ATTEMPT_TYPE = {
  CHECK_IN: "CHECK_IN",
  CHECK_OUT: "CHECK_OUT",
};

export const ATTENDANCE_ATTEMPT_RESULT = {
  SUCCESS: "SUCCESS",
  FAIL: "FAIL",
};

export const ATTENDANCE_FAILURE_CODE = {
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  LOW_ACCURACY: "LOW_ACCURACY",
  OUTSIDE_GEOFENCE: "OUTSIDE_GEOFENCE",
  MISSING_BRANCH_GEO: "MISSING_BRANCH_GEO",
  SCHEDULE_WINDOW_CLOSED: "SCHEDULE_WINDOW_CLOSED",
  SCHEDULE_NOT_FOUND: "SCHEDULE_NOT_FOUND",
  OPEN_SESSION_EXISTS: "OPEN_SESSION_EXISTS",
  OPEN_SESSION_NOT_FOUND: "OPEN_SESSION_NOT_FOUND",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
};

export function withErrMeta(err, failureCode, status) {
  if (failureCode && !err.failureCode) err.failureCode = failureCode;
  if (status && !err.status) err.status = status;
  return err;
}

export function hasErrorStatus(err) {
  return !!(err && typeof err.status === "number");
}

export function getAttemptFailureCode(err) {
  if (err?.failureCode) return err.failureCode;
  const message = getErrorMessage(err).toLowerCase();
  if (message.includes("ажлын хуваарь олдсонгүй")) return ATTENDANCE_FAILURE_CODE.SCHEDULE_NOT_FOUND;
  if (message.includes("ирц бүртгэх цаг болоогүй")) return ATTENDANCE_FAILURE_CODE.SCHEDULE_WINDOW_CLOSED;
  if (message.includes("lat, lng, accuracym")) return ATTENDANCE_FAILURE_CODE.INVALID_PAYLOAD;
  if (message.includes("lat/lng")) return ATTENDANCE_FAILURE_CODE.INVALID_PAYLOAD;
  if (message.includes("accuracym эерэг")) return ATTENDANCE_FAILURE_CODE.INVALID_PAYLOAD;
  if (message.includes("gps дохио сайжрах")) return ATTENDANCE_FAILURE_CODE.LOW_ACCURACY;
  if (message.includes("салбарын ойролцоо орж ир")) return ATTENDANCE_FAILURE_CODE.OUTSIDE_GEOFENCE;
  if (message.includes("салбарын байршил тохируулаагүй")) return ATTENDANCE_FAILURE_CODE.MISSING_BRANCH_GEO;
  if (message.includes("аль хэдийн ирц бүртгэсэн")) return ATTENDANCE_FAILURE_CODE.OPEN_SESSION_EXISTS;
  if (message.includes("ирц бүртгэл олдсонгүй")) return ATTENDANCE_FAILURE_CODE.OPEN_SESSION_NOT_FOUND;
  return ATTENDANCE_FAILURE_CODE.UNKNOWN_ERROR;
}

export function getErrorStatus(err) {
  return hasErrorStatus(err) ? err.status : 500;
}

export function getErrorMessage(err) {
  if (err && typeof err.message === "string" && err.message.trim()) {
    return err.message;
  }
  return "Серверийн алдаа гарлаа.";
}

export function buildAttemptMeta({ distanceM, radiusM }) {
  if (typeof distanceM === "number" && typeof radiusM === "number") {
    return { distanceM, radiusM };
  }
  return null;
}

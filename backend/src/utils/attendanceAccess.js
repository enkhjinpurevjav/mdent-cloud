const ATTENDANCE_ADMIN_ROLES = new Set(["admin", "super_admin", "hr"]);

export function canAccessAttendanceAdminFeatures({ requesterRole, authBypassed = false }) {
  if (authBypassed) return true;
  return ATTENDANCE_ADMIN_ROLES.has(requesterRole || "");
}


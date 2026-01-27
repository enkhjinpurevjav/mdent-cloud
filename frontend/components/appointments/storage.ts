// localStorage helpers and key constants

export const STORAGE_KEYS = {
  BRANCH_LOCK_ENABLED: "appointmentsBranchLockEnabled",
  BRANCH_LOCK_ID: "appointmentsBranchLockId",
} as const;

export function getBranchLock(): { enabled: boolean; branchId: string | null } {
  if (typeof window === "undefined") {
    return { enabled: false, branchId: null };
  }

  const enabled = localStorage.getItem(STORAGE_KEYS.BRANCH_LOCK_ENABLED) === "true";
  const branchId = localStorage.getItem(STORAGE_KEYS.BRANCH_LOCK_ID);

  return { enabled, branchId };
}

export function setBranchLock(branchId: string) {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEYS.BRANCH_LOCK_ENABLED, "true");
  localStorage.setItem(STORAGE_KEYS.BRANCH_LOCK_ID, branchId);
}

export function clearBranchLock() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEYS.BRANCH_LOCK_ENABLED);
  localStorage.removeItem(STORAGE_KEYS.BRANCH_LOCK_ID);
}

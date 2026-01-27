import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { getBranchLock, clearBranchLock } from "./storage";

export function useBranchLock() {
  const router = useRouter();
  const [lockState, setLockState] = useState<{
    enabled: boolean;
    lockedBranchId: string | null;
  }>({ enabled: false, lockedBranchId: null });

  // Read lock from localStorage on mount
  useEffect(() => {
    const lock = getBranchLock();
    setLockState({
      enabled: lock.enabled,
      lockedBranchId: lock.branchId,
    });
  }, []);

  // Get effective branchId (from lock or URL query)
  const queryBranchId =
    typeof router.query.branchId === "string" ? router.query.branchId : "";
  
  const effectiveBranchId = lockState.enabled && lockState.lockedBranchId
    ? lockState.lockedBranchId
    : queryBranchId;

  // Memoized function to update URL
  const updateUrl = useCallback(() => {
    if (!lockState.enabled || !lockState.lockedBranchId) return;
    
    // If lock is active but URL doesn't match, update URL
    if (queryBranchId !== lockState.lockedBranchId) {
      router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, branchId: lockState.lockedBranchId },
        },
        undefined,
        { shallow: true }
      );
    }
  }, [lockState.enabled, lockState.lockedBranchId, queryBranchId, router.pathname, router.query, router.replace]);

  // Update URL to match locked branchId when lock is active
  useEffect(() => {
    updateUrl();
  }, [updateUrl]);

  const unlock = () => {
    clearBranchLock();
    setLockState({ enabled: false, lockedBranchId: null });
  };

  return {
    isLocked: lockState.enabled,
    lockedBranchId: lockState.lockedBranchId,
    effectiveBranchId,
    unlock,
  };
}

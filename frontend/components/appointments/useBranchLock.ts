import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { getBranchLock, clearBranchLock } from "./storage";

export function useBranchLock() {
  const router = useRouter();
  const [lockState, setLockState] = useState<{
    enabled: boolean;
    lockedBranchId: string | null;
  }>({ enabled: false, lockedBranchId: null });

  // Track if URL sync has been done
  const hasInitializedRef = useRef(false);

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

  // Update URL to match locked branchId when lock is active (only once per lock state change)
  useEffect(() => {
    if (!lockState.enabled || !lockState.lockedBranchId) {
      hasInitializedRef.current = false;
      return;
    }
    
    // Only sync URL if it doesn't match and we haven't done it yet for this lock state
    if (queryBranchId !== lockState.lockedBranchId && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, branchId: lockState.lockedBranchId },
        },
        undefined,
        { shallow: true }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Justification: Only react to lock state and queryBranchId changes, not router object.
  // Including router in deps would cause infinite loops since router.replace updates router.
  // We explicitly include router.pathname to detect route changes while avoiding loops.
  }, [lockState.enabled, lockState.lockedBranchId, queryBranchId, router.pathname]);

  const unlock = () => {
    clearBranchLock();
    setLockState({ enabled: false, lockedBranchId: null });
    hasInitializedRef.current = false;
  };

  return {
    isLocked: lockState.enabled,
    lockedBranchId: lockState.lockedBranchId,
    effectiveBranchId,
    unlock,
  };
}

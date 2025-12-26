import type {
  InternalTooth,
  ToothBaseStatus,
  ToothRegionState,
} from "../types/orthoTooth";

export type ExternalTooth = {
  code: string;
  status: string; // we interpret this as baseStatus for now
};

function emptyRegion(): ToothRegionState {
  return { caries: false, filled: false };
}

function emptyInternalTooth(code: string): InternalTooth {
  return {
    code,
    baseStatus: "none",
    regions: {
      top: emptyRegion(),
      bottom: emptyRegion(),
      left: emptyRegion(),
      right: emptyRegion(),
      center: emptyRegion(),
    },
    note: undefined,
  };
}

/**
 * Convert external simple list from backend/frontend state into richer internal format.
 * For now we only map `status` -> `baseStatus` and leave regions empty.
 */
export function externalToInternal(list: ExternalTooth[]): InternalTooth[] {
  if (!Array.isArray(list)) return [];

  return list.map((t) => {
    const baseStatus = (t.status || "none") as ToothBaseStatus;
    const base = emptyInternalTooth(t.code);
    base.baseStatus = baseStatus;
    return base;
  });
}

/**
 * Convert internal rich structure back to external simple format to send to backend
 * (or to keep compatibility with existing OrthoCard JSON).
 */
export function internalToExternal(list: InternalTooth[]): ExternalTooth[] {
  if (!Array.isArray(list)) return [];

  return list.map((t) => ({
    code: t.code,
    status: t.baseStatus,
  }));
}

/**
 * Utility to locate a tooth by code.
 */
export function findInternalTooth(
  list: InternalTooth[],
  code: string
): InternalTooth | undefined {
  return list.find((t) => t.code === code);
}

/**
 * Ensure that a tooth exists in the list; if not, create an empty one.
 */
export function ensureInternalTooth(
  list: InternalTooth[],
  code: string
): InternalTooth {
  const existing = findInternalTooth(list, code);
  if (existing) return existing;
  return emptyInternalTooth(code);
}

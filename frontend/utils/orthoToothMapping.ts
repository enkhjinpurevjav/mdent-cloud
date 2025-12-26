import type { InternalTooth, ToothBaseStatus } from "../types/orthoTooth";

type ExternalTooth = {
  code: string;
  status: string;
};

function emptyRegions() {
  return {
    top: { caries: false, filled: false },
    bottom: { caries: false, filled: false },
    left: { caries: false, filled: false },
    right: { caries: false, filled: false },
    center: { caries: false, filled: false },
  };
}

export function externalToInternal(list: ExternalTooth[]): InternalTooth[] {
  return (list || []).map((t) => {
    const baseStatus = (t.status || "none") as ToothBaseStatus;
    return {
      code: t.code,
      baseStatus,
      regions: emptyRegions(),
      note: undefined,
    };
  });
}

export function internalToExternal(list: InternalTooth[]): ExternalTooth[] {
  return (list || []).map((t) => ({
    code: t.code,
    status: t.baseStatus,
  }));
}

import {
  type BaseStatus,
  type ToothState,
  type OrthoChartState,
  type FDIToothCode,
  type OverlayMode,
  type Surface,
  ALL_FDI_TEETH,
} from "../types/orthoChart";

export function isOverlayAllowed(baseStatus: BaseStatus): boolean {
  return baseStatus === "NONE" || baseStatus === "SHAPE_ANOMALY";
}

export function applyStatusWithRules(
  prev: ToothState,
  newStatus: BaseStatus
): ToothState {
  if (newStatus === "SHAPE_ANOMALY") {
    return { ...prev, baseStatus: "SHAPE_ANOMALY" };
  }
  if (newStatus === "NONE") {
    return { ...prev, baseStatus: "NONE" };
  }
  // full statuses clear overlays
  return {
    ...prev,
    baseStatus: newStatus,
    caries: [],
    filled: [],
  };
}

export function toggleSurfaceWithRules(
  prev: ToothState,
  mode: OverlayMode,
  surface: Surface
): ToothState {
  if (mode === "NONE") return prev;
  if (!isOverlayAllowed(prev.baseStatus)) return prev;

  const targetKey = mode === "CARIES" ? "caries" : "filled";
  const otherKey = mode === "CARIES" ? "filled" : "caries";

  const current = prev[targetKey];
  const exists = current.includes(surface);
  const nextArr = exists
    ? current.filter((s) => s !== surface)
    : [...current, surface];

  return {
    ...prev,
    [targetKey]: nextArr,
    [otherKey]: [],
  };
}

export function clearToothState(_prev: ToothState): ToothState {
  return {
    baseStatus: "NONE",
    caries: [],
    filled: [],
    note: "",
  };
}

export function createEmptyToothState(): ToothState {
  return {
    baseStatus: "NONE",
    caries: [],
    filled: [],
    note: "",
  };
}

export function createEmptyChartState(): OrthoChartState {
  const teeth: OrthoChartState["teeth"] = {} as any;
  for (const code of ALL_FDI_TEETH) {
    teeth[code] = createEmptyToothState();
  }
  return {
    teeth,
    supernumeraryNote: "",
  };
}

export type OrthoAction =
  | {
      type: "OPEN_POPOVER";
      toothCode: FDIToothCode;
      anchorRect: DOMRect;
    }
  | { type: "CLOSE_POPOVER" }
  | {
      type: "SET_BASE_STATUS";
      toothCode: FDIToothCode;
      status: BaseStatus;
    }
  | {
      type: "SET_ACTIVE_OVERLAY_MODE";
      overlayMode: OverlayMode;
    }
  | {
      type: "TOGGLE_SURFACE";
      toothCode: FDIToothCode;
      mode: OverlayMode;
      surface: Surface;
    }
  | {
      type: "SET_TOOTH_NOTE";
      toothCode: FDIToothCode;
      note: string;
    }
  | {
      type: "CLEAR_TOOTH";
      toothCode: FDIToothCode;
    }
  | {
      type: "SET_SUPERNUMERARY_NOTE";
      text: string;
    };

export interface OrthoReducerState extends OrthoChartState {
  popover: {
    open: boolean;
    toothCode: FDIToothCode | null;
    anchorRect: DOMRect | null;
    overlayMode: OverlayMode;
  };
}

export function createInitialReducerState(
  initial?: OrthoChartState
): OrthoReducerState {
  const base = initial ?? createEmptyChartState();
  return {
    ...base,
    popover: {
      open: false,
      toothCode: null,
      anchorRect: null,
      overlayMode: "NONE",
    },
  };
}

export function orthoReducer(
  state: OrthoReducerState,
  action: OrthoAction
): OrthoReducerState {
  switch (action.type) {
    case "OPEN_POPOVER":
      return {
        ...state,
        popover: {
          open: true,
          toothCode: action.toothCode,
          anchorRect: action.anchorRect,
          overlayMode: "NONE",
        },
      };
    case "CLOSE_POPOVER":
      return {
        ...state,
        popover: {
          open: false,
          toothCode: null,
          anchorRect: null,
          overlayMode: "NONE",
        },
      };
    case "SET_BASE_STATUS": {
      const prevTooth = state.teeth[action.toothCode];
      const nextTooth = applyStatusWithRules(prevTooth, action.status);
      return {
        ...state,
        teeth: { ...state.teeth, [action.toothCode]: nextTooth },
      };
    }
    case "SET_ACTIVE_OVERLAY_MODE":
      return {
        ...state,
        popover: { ...state.popover, overlayMode: action.overlayMode },
      };
    case "TOGGLE_SURFACE": {
      if (action.mode === "NONE") return state;
      const prevTooth = state.teeth[action.toothCode];
      const nextTooth = toggleSurfaceWithRules(
        prevTooth,
        action.mode,
        action.surface
      );
      return {
        ...state,
        teeth: { ...state.teeth, [action.toothCode]: nextTooth },
      };
    }
    case "SET_TOOTH_NOTE": {
      const prevTooth = state.teeth[action.toothCode];
      return {
        ...state,
        teeth: {
          ...state.teeth,
          [action.toothCode]: { ...prevTooth, note: action.note },
        },
      };
    }
    case "CLEAR_TOOTH":
      return {
        ...state,
        teeth: {
          ...state.teeth,
          [action.toothCode]: clearToothState(state.teeth[action.toothCode]),
        },
      };
    case "SET_SUPERNUMERARY_NOTE":
      return {
        ...state,
        supernumeraryNote: action.text,
      };
    default:
      return state;
  }
}

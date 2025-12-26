export type ToothRegion = "top" | "bottom" | "left" | "right" | "center";

export type ToothBaseStatus =
  | "none"
  | "extracted"
  | "prosthesis"
  | "delay"        // Саатал
  | "apodontia"
  | "shapeAnomaly";

export type ToothPartialStatus = "caries" | "filled";

export type ToothRegionState = {
  caries: boolean;
  filled: boolean;
};

export type InternalTooth = {
  code: string;
  baseStatus: ToothBaseStatus;
  regions: {
    top: ToothRegionState;
    bottom: ToothRegionState;
    left: ToothRegionState;
    right: ToothRegionState;
    center: ToothRegionState;
  };
  note?: string;
};

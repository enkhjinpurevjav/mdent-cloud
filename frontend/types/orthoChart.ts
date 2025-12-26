// Shared types for the orthodontic odontogram

export type BaseStatus =
  | "NONE"
  | "EXTRACTED"
  | "PROSTHESIS"
  | "SAATAL"
  | "APODONTIA"
  | "SHAPE_ANOMALY";

export type Surface = "TOP" | "BOTTOM" | "LEFT" | "RIGHT" | "CENTER";

// FDI tooth codes for 28 teeth (no wisdom teeth)
export type FDIToothCode =
  | "11" | "12" | "13" | "14" | "15" | "16" | "17"
  | "21" | "22" | "23" | "24" | "25" | "26" | "27"
  | "31" | "32" | "33" | "34" | "35" | "36" | "37"
  | "41" | "42" | "43" | "44" | "45" | "46" | "47";

export const ALL_FDI_TEETH: FDIToothCode[] = [
  "11","12","13","14","15","16","17",
  "21","22","23","24","25","26","27",
  "31","32","33","34","35","36","37",
  "41","42","43","44","45","46","47",
];

export interface ToothState {
  baseStatus: BaseStatus;
  caries: Surface[];
  filled: Surface[];
  note?: string;
}

export type OrthoTeethState = Record<FDIToothCode, ToothState>;

export interface OrthoChartState {
  teeth: OrthoTeethState;
  supernumeraryNote: string;
}

export type OverlayMode = "CARIES" | "FILLED" | "NONE";

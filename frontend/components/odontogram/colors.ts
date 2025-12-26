import type { BaseStatus } from "../../types/orthoChart";

export const baseStatusColors: Record<BaseStatus, string> = {
  NONE: "transparent",
  EXTRACTED: "#ef4444",
  PROSTHESIS: "#3b82f6",
  SAATAL: "#f97316",
  APODONTIA: "#6b7280",
  SHAPE_ANOMALY: "#a855f7",
};

export const overlayColors = {
  caries: "#dc2626",
  filled: "#22c55e",
};

export const borderColor = "#111827";
export const backgroundPopover = "#ffffff";
export const popoverBorder = "#e5e7eb";
export const popoverShadow =
  "0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)";

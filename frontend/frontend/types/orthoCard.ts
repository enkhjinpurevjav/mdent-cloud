export type ToothStatus =
  | "none"          // no specific status
  | "to_extract"
  | "extracted"
  | "caries"
  | "filled"
  | "implant"
  | "bracket"
  | "other";

/**
 * One tooth in the ortho chart.
 * You can extend this later (e.g. add notes, surfaces, etc.).
 */
export type OrthoTooth = {
  /** FDI code, e.g. "11", "26", "55" */
  code: string;
  status: ToothStatus;
};

/**
 * The full orthodontic card data stored as JSON in the backend.
 * Keep it intentionally generic and flexible.
 */
export type OrthoCardData = {
  /** Optional display name for patient on this card */
  patientName?: string;
  /** Free text notes for doctor */
  notes?: string;

  /**
   * Tooth chart state:
   * - typically a fixed set of codes from "18".."48" and "55".."85"
   * - but we keep it as an array for flexibility
   */
  toothChart: OrthoTooth[];

  /**
   * High level problem list / checklist (optional).
   * e.g. [{ id: 1, label: "Crowding upper", checked: true }]
   */
  problemList?: Array<{
    id: number;
    label: string;
    checked?: boolean;
  }>;
};

/**
 * Factory helper for an empty chart: caller can decide
 * which tooth codes to include.
 */
export function createEmptyChartState(): OrthoCardData["toothChart"] {
  // Minimal default: no teeth. You can later pre‑fill with all FDI codes.
  return [];
}

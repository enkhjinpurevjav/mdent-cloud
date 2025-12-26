import type { OrthoChartState } from "./orthoChart";

export type OrthoCardData = {
  // Basic header fields from your paper form (simplified, extend as needed)
  patientName?: string;
  age?: string;
  sex?: string;
  birthDate?: string;
  regNo?: string;
  phone?: string;
  chiefComplaint?: string;
  // ...

  // Main tooth-circle chart:
  toothChart: OrthoChartState;

  // Discrepancy / problem list / treatment plan (page 2)
  discrepancy?: {
    ald?: string;
    midline?: string;
    curveOfSpee?: string;
    expansion?: string;
    totalDiscrepancy?: string;
  };

  problemList?: string[]; // ["1. ....", "2. ....", etc.]

  treatmentGoal?: string;
  treatmentPlan?: {
    phase1?: string;
    phase2?: string;
    phase3?: string;
  };
};

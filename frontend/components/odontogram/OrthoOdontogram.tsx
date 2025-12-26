import React from "react";
import type { OrthoCardData, OrthoTooth, ToothStatus } from "../../types/orthoCard";

type Props = {
  value: OrthoCardData["toothChart"];
  onChange: (next: OrthoCardData["toothChart"]) => void;
};

/**
 * Minimal orthodontic odontogram for now:
 * - Renders basic FDI teeth codes in rows
 * - Clicking cycles through a small set of statuses
 * - Purely client-side; real design can be added later.
 */
export function OrthoOdontogram({ value, onChange }: Props) {
  // simple status cycle
  const cycleOrder: ToothStatus[] = ["none", "to_extract", "extracted", "caries"];
  const statusLabel: Record<ToothStatus, string> = {
    none: "",
    to_extract: "×",
    extracted: "Ø",
    caries: "C",
    filled: "F",
    implant: "I",
    bracket: "B",
    other: "?",
  };

  const findTooth = (code: string): OrthoTooth | undefined =>
    value.find((t) => t.code === code);

  const setToothStatus = (code: string) => {
    const existing = findTooth(code);
    let nextStatus: ToothStatus = "none";

    if (!existing) {
      nextStatus = "to_extract";
    } else {
      const idx = cycleOrder.indexOf(existing.status);
      const nextIdx = (idx + 1) % cycleOrder.length;
      nextStatus = cycleOrder[nextIdx];
    }

    const nextArray = [...value];
    const idxExisting = nextArray.findIndex((t) => t.code === code);

    if (nextStatus === "none") {
      // remove tooth entry when back to "none"
      if (idxExisting >= 0) {
        nextArray.splice(idxExisting, 1);
      }
    } else if (idxExisting >= 0) {
      nextArray[idxExisting] = { ...nextArray[idxExisting], status: nextStatus };
    } else {
      nextArray.push({ code, status: nextStatus });
    }

    onChange(nextArray);
  };

  // basic FDI layout – you can tune this later
  const upperRight = ["18", "17", "16", "15", "14", "13", "12", "11"];
  const upperLeft = ["21", "22", "23", "24", "25", "26", "27", "28"];
  const lowerRight = ["48", "47", "46", "45", "44", "43", "42", "41"];
  const lowerLeft = ["31", "32", "33", "34", "35", "36", "37", "38"];

  const renderRow = (codes: string[]) => (
    <div
      style={{
        display: "flex",
        gap: 6,
        justifyContent: "center",
        marginBottom: 4,
      }}
    >
      {codes.map((code) => {
        const tooth = findTooth(code);
        const label = statusLabel[tooth?.status ?? "none"];
        const isActive = !!label;

        return (
          <button
            key={code}
            type="button"
            onClick={() => setToothStatus(code)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "1px solid #d1d5db",
              background: isActive ? "#fee2e2" : "#ffffff",
              fontSize: 11,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 9, color: "#6b7280" }}>{code}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        padding: 12,
        background: "#f9fafb",
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 8, color: "#6b7280" }}>
        Шүд дээр дарж төлөвийг сольж болно (хоосон → × → Ø → C → хоосон).
      </div>

      {/* Upper arch */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>Дээд эрүү</div>
        {renderRow(upperRight)}
        {renderRow(upperLeft)}
      </div>

      {/* Lower arch */}
      <div>
        <div style={{ textAlign: "center", marginBottom: 4 }}>Доод эрүү</div>
        {renderRow(lowerRight)}
        {renderRow(lowerLeft)}
      </div>
    </div>
  );
}

export default OrthoOdontogram;

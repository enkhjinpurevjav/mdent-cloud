import React from "react";
import type { OrthoCardData, OrthoTooth } from "../../types/orthoCard";

type Props = {
  value: OrthoCardData["toothChart"];
  onChange: (next: OrthoCardData["toothChart"]) => void;
};

const STATUS_ORDER = ["none", "to_extract", "extracted", "caries"] as const;
type SimpleStatus = (typeof STATUS_ORDER)[number];

const STATUS_LABEL: Record<SimpleStatus, string> = {
  none: "",
  to_extract: "×",
  extracted: "Ø",
  caries: "C",
};

/**
 * Minimal orthodontic odontogram:
 * - Only adult FDI codes
 * - Click to cycle a simple status
 * - No dependencies on the rest of the app
 */
export function OrthoOdontogram({ value, onChange }: Props) {
  const findTooth = (code: string): OrthoTooth | undefined =>
    value.find((t) => t.code === code);

  const cycleStatus = (current: SimpleStatus): SimpleStatus => {
    const idx = STATUS_ORDER.indexOf(current);
    const nextIdx = (idx + 1) % STATUS_ORDER.length;
    return STATUS_ORDER[nextIdx];
  };

  const handleClickTooth = (code: string) => {
    const existing = findTooth(code);
    const currentStatus: SimpleStatus = existing
      ? (existing.status as SimpleStatus)
      : "none";

    const nextStatus = cycleStatus(currentStatus);
    const nextArray = [...value];
    const idxExisting = nextArray.findIndex((t) => t.code === code);

    if (nextStatus === "none") {
      // revert back to "none" => remove from array
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

  // Simple adult quadrants; you can extend later for kids
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
        const status = (tooth?.status as SimpleStatus) || "none";
        const label = STATUS_LABEL[status];
        const isActive = status !== "none";

        return (
          <button
            key={code}
            type="button"
            onClick={() => handleClickTooth(code)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
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

      {/* Upper jaw */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>Дээд эрүү</div>
        {renderRow(upperRight)}
        {renderRow(upperLeft)}
      </div>

      {/* Lower jaw */}
      <div>
        <div style={{ textAlign: "center", marginBottom: 4 }}>Доод эрүү</div>
        {renderRow(lowerRight)}
        {renderRow(lowerLeft)}
      </div>
    </div>
  );
}

export default OrthoOdontogram;

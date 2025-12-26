import React from "react";
import type { OrthoCardData, OrthoTooth, ToothStatus } from "../../types/orthoCard";

type OrthoOdontogramProps = {
  value: OrthoCardData["toothChart"];
  onChange: (next: OrthoCardData["toothChart"]) => void;
};

const STATUS_ORDER: ToothStatus[] = ["none", "to_extract", "extracted", "caries"];

const STATUS_LABEL: Record<ToothStatus, string> = {
  none: "",
  to_extract: "×",
  extracted: "Ø",
  caries: "C",
};

function cycleStatus(current: ToothStatus): ToothStatus {
  const idx = STATUS_ORDER.indexOf(current);
  const nextIdx = (idx + 1) % STATUS_ORDER.length;
  return STATUS_ORDER[nextIdx];
}

function findTooth(list: OrthoTooth[], code: string): OrthoTooth | undefined {
  return list.find((t) => t.code === code);
}

/**
 * Very simple orthodontic odontogram:
 * - Renders adult FDI teeth as buttons
 * - Clicking cycles status: none → to_extract → extracted → caries → none
 */
export function OrthoOdontogram(props: OrthoOdontogramProps) {
  const { value, onChange } = props;

  const handleToothClick = (code: string) => {
    const list = value || [];
    const existing = findTooth(list, code);
    const currentStatus: ToothStatus = existing ? existing.status : "none";
    const nextStatus: ToothStatus = cycleStatus(currentStatus);

    const nextList: OrthoTooth[] = [...list];
    const idx = nextList.findIndex((t) => t.code === code);

    if (nextStatus === "none") {
      if (idx >= 0) {
        nextList.splice(idx, 1);
      }
    } else if (idx >= 0) {
      nextList[idx] = { ...nextList[idx], status: nextStatus };
    } else {
      nextList.push({ code, status: nextStatus });
    }

    onChange(nextList);
  };

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
        const tooth = findTooth(value || [], code);
        const status: ToothStatus = tooth ? tooth.status : "none";
        const label = STATUS_LABEL[status];
        const isActive = status !== "none";

        return (
          <button
            key={code}
            type="button"
            onClick={() => handleToothClick(code)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid #d1d5db",
              backgroundColor: isActive ? "#fee2e2" : "#ffffff",
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
        backgroundColor: "#f9fafb",
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 8, color: "#6b7280" }}>
        Шүд дээр дарж төлөвийг сольж болно (хоосон → × → Ø → C → хоосон).
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>Дээд эрүү</div>
        {renderRow(upperRight)}
        {renderRow(upperLeft)}
      </div>

      <div>
        <div style={{ textAlign: "center", marginBottom: 4 }}>Доод эрүү</div>
        {renderRow(lowerRight)}
        {renderRow(lowerLeft)}
      </div>
    </div>
  );
}

export default OrthoOdontogram;

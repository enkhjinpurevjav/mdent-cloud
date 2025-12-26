import React from "react";

type OrthoTooth = {
  code: string;   // FDI code, e.g. "11", "85"
  status: string; // "none" | "to_extract" | "extracted" | "caries"
};

type Props = {
  value: OrthoTooth[];
  onChange: (next: OrthoTooth[]) => void;
};

// status cycle and labels
const STATUS_ORDER = ["none", "to_extract", "extracted", "caries"] as const;
type SimpleStatus = (typeof STATUS_ORDER)[number];

const STATUS_LABEL: Record<SimpleStatus, string> = {
  none: "",
  to_extract: "×",
  extracted: "Ø",
  caries: "C",
};

function cycleStatus(current: SimpleStatus): SimpleStatus {
  const idx = STATUS_ORDER.indexOf(current);
  const nextIdx = (idx + 1) % STATUS_ORDER.length;
  return STATUS_ORDER[nextIdx];
}

function findTooth(list: OrthoTooth[], code: string): OrthoTooth | undefined {
  return list.find((t) => t.code === code);
}

/**
 * Full FDI odontogram (adult + primary):
 * - Upper jaw: adult 18–11, 21–28; primary 55–51, 61–65
 * - Lower jaw: adult 48–41, 31–38; primary 85–81, 71–75
 * 
 * Clicking a tooth cycles status: none → × → Ø → C → none.
 */
export function OrthoOdontogram({ value, onChange }: Props) {
  const list = value || [];

  const handleClick = (code: string) => {
    const current = findTooth(list, code);
    const currentStatus: SimpleStatus =
      (current?.status as SimpleStatus) || "none";
    const nextStatus = cycleStatus(currentStatus);

    const nextList = [...list];
    const idx = nextList.findIndex((t) => t.code === code);

    if (nextStatus === "none") {
      if (idx >= 0) nextList.splice(idx, 1);
    } else if (idx >= 0) {
      nextList[idx] = { ...nextList[idx], status: nextStatus };
    } else {
      nextList.push({ code, status: nextStatus });
    }

    onChange(nextList);
  };

  // Adult permanent teeth (FDI)
  const adultUpperRight = ["18", "17", "16", "15", "14", "13", "12", "11"];
  const adultUpperLeft = ["21", "22", "23", "24", "25", "26", "27", "28"];
  const adultLowerRight = ["48", "47", "46", "45", "44", "43", "42", "41"];
  const adultLowerLeft = ["31", "32", "33", "34", "35", "36", "37", "38"];

  // Primary (deciduous) teeth
  const primaryUpperRight = ["55", "54", "53", "52", "51"];
  const primaryUpperLeft = ["61", "62", "63", "64", "65"];
  const primaryLowerRight = ["85", "84", "83", "82", "81"];
  const primaryLowerLeft = ["71", "72", "73", "74", "75"];

  const renderRow = (codes: string[]) => (
    <div
      style={{
        display: "flex",
        gap: 4,
        justifyContent: "center",
        marginBottom: 4,
        flexWrap: "wrap",
      }}
    >
      {codes.map((code) => {
        const tooth = findTooth(list, code);
        const status = (tooth?.status as SimpleStatus) || "none";
        const label = STATUS_LABEL[status];
        const isActive = status !== "none";

        return (
          <button
            key={code}
            type="button"
            onClick={() => handleClick(code)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid #d1d5db",
              backgroundColor: isActive ? "#fee2e2" : "#ffffff",
              fontSize: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 8, color: "#6b7280" }}>{code}</span>
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

      {/* ADULT PERMANENT TEETH */}
      <div
        style={{
          marginBottom: 12,
          padding: 8,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 4,
            fontWeight: 500,
          }}
        >
          Насанд хүрэгчдийн шүд (байнгын)
        </div>

        {/* Upper jaw - adult */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ textAlign: "center", marginBottom: 2 }}>Дээд эрүү</div>
          {renderRow(adultUpperRight)}
          {renderRow(adultUpperLeft)}
        </div>

        {/* Lower jaw - adult */}
        <div>
          <div style={{ textAlign: "center", marginBottom: 2 }}>Доод эрүү</div>
          {renderRow(adultLowerRight)}
          {renderRow(adultLowerLeft)}
        </div>
      </div>

      {/* PRIMARY TEETH */}
      <div
        style={{
          padding: 8,
          borderRadius: 8,
          border: "1px dashed #e5e7eb",
          background: "#f3f4f6",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 4,
            fontWeight: 500,
          }}
        >
          Сүүн шүд
        </div>

        {/* Upper jaw - primary */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ textAlign: "center", marginBottom: 2 }}>Дээд эрүү</div>
          {renderRow(primaryUpperRight)}
          {renderRow(primaryUpperLeft)}
        </div>

        {/* Lower jaw - primary */}
        <div>
          <div style={{ textAlign: "center", marginBottom: 2 }}>Доод эрүү</div>
          {renderRow(primaryLowerRight)}
          {renderRow(primaryLowerLeft)}
        </div>
      </div>
    </div>
  );
}

export default OrthoOdontogram;

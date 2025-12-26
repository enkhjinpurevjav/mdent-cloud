import React from "react";

type OrthoTooth = {
  code: string;
  status: string;
};

type Props = {
  value: OrthoTooth[];
  onChange: (next: OrthoTooth[]) => void;
};

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
 * SUPER MINIMAL odontogram:
 * - No external type imports
 * - Just a few tooth buttons, no fancy layout
 */
export function OrthoOdontogram({ value, onChange }: Props) {
  const list = value || [];

  const handleClick = (code: string) => {
    const current = findTooth(list, code);
    const currentStatus: SimpleStatus = current?.status as SimpleStatus || "none";
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

  // Keep just a few teeth to minimize code
  const sampleTeeth = ["11", "12", "13", "21", "22", "23", "31", "32", "33"];

  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        padding: 12,
        background: "#f9fafb",
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 8, color: "#6b7280" }}>
        Туршилтын одонтограм: шүдэнд дарж төлөвийг сольж болно.
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {sampleTeeth.map((code) => {
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
                width: 36,
                height: 36,
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
    </div>
  );
}

export default OrthoOdontogram;

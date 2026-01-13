import React from "react";
import { ADULT_TEETH, CHILD_TEETH } from "../../utils/tooth-helpers";

type ToothChartSelectorProps = {
  toothMode: "ADULT" | "CHILD";
  selectedTeeth: string[];
  customToothRange: string;
  chartError: string;
  onToggleToothMode: (mode: "ADULT" | "CHILD") => void;
  onToggleToothSelection: (code: string) => void;
  onCustomToothRangeChange: (value: string) => void;
  isToothSelected: (code: string) => boolean;
  areAllModeTeethSelected: () => boolean;
};

export default function ToothChartSelector({
  toothMode,
  selectedTeeth,
  customToothRange,
  chartError,
  onToggleToothMode,
  onToggleToothSelection,
  onCustomToothRangeChange,
  isToothSelected,
  areAllModeTeethSelected,
}: ToothChartSelectorProps) {
  return (
    <section
      style={{
        marginTop: 0,
        padding: 16,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>Шүдний диаграм</h2>

        <div
          style={{
            display: "inline-flex",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            overflow: "hidden",
            fontSize: 13,
          }}
        >
          <button
            type="button"
            onClick={() => onToggleToothMode("ADULT")}
            style={{
              padding: "4px 10px",
              border: "none",
              background:
                toothMode === "ADULT" ? "#2563eb" : "white",
              color:
                toothMode === "ADULT" ? "white" : "#111827",
              cursor: "pointer",
            }}
          >
            Байнгын шүд
          </button>
          <button
            type="button"
            onClick={() => onToggleToothMode("CHILD")}
            style={{
              padding: "4px 10px",
              border: "none",
              background:
                toothMode === "CHILD" ? "#2563eb" : "white",
              color:
                toothMode === "CHILD" ? "white" : "#111827",
              cursor: "pointer",
            }}
          >
            Сүүн шүд
          </button>
        </div>
      </div>

      {chartError && (
        <div style={{ color: "red", marginBottom: 8 }}>
          {chartError}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 8,
        }}
      >
        {(toothMode === "ADULT" ? ADULT_TEETH : CHILD_TEETH).map(
          (code) => {
            const selected = isToothSelected(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => onToggleToothSelection(code)}
                style={{
                  minWidth: 34,
                  padding: "4px 6px",
                  borderRadius: 999,
                  border: selected
                    ? "1px solid #16a34a"
                    : "1px solid #d1d5db",
                  background: selected ? "#dcfce7" : "white",
                  color: selected ? "#166534" : "#111827",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {code}
              </button>
            );
          }
        )}

        <input
          key="RANGE"
          type="text"
          placeholder="ж: 21-24, 25-26, 11,21,22"
          value={customToothRange}
          onChange={(e) => onCustomToothRangeChange(e.target.value)}
          style={{
            minWidth: 140,
            padding: "4px 8px",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            fontSize: 12,
          }}
        />

        <button
          key="ALL"
          type="button"
          onClick={() => onToggleToothSelection("ALL")}
          style={{
            minWidth: 60,
            padding: "4px 10px",
            borderRadius: 999,
            border: areAllModeTeethSelected()
              ? "1px solid #16a34a"
              : "1px solid #d1d5db",
            background: areAllModeTeethSelected()
              ? "#dcfce7"
              : "white",
            color: areAllModeTeethSelected()
              ? "#166534"
              : "#111827",
            fontSize: 12,
            cursor: "pointer",
            marginLeft: 8,
          }}
        >
          Бүх шүд
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
        Шүдийг дарж сонгох үед тухайн шүднүүдэд зориулсан нэг оношийн мөр
        доорх хэсэгт үүснэ. Нэг онош нь олон шүдэнд (эсвэл Бүх шүд)
        хамаарч болно.
      </div>
    </section>
  );
}

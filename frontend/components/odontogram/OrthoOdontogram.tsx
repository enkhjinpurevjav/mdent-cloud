import React, { useMemo, useState } from "react";
import ToothSvg5Region, {
  ToothRegion,
  ToothBaseStatus,
  ToothRegionState,
} from "./ToothSvg5Region";
import type { InternalTooth } from "../../types/orthoTooth";
import {
  externalToInternal,
  internalToExternal,
  ensureInternalTooth,
} from "../../utils/orthoToothMapping";

type ExternalTooth = {
  code: string;
  status: string;
};

type Props = {
  value: ExternalTooth[];
  onChange: (next: ExternalTooth[]) => void;
};

const BASE_STATUS_LABELS: { key: ToothBaseStatus; label: string }[] = [
  { key: "none", label: "—" },
  { key: "extracted", label: "Шүд авсан" },
  { key: "prosthesis", label: "Протез" },
  { key: "delay", label: "Саатал" },
  { key: "apodontia", label: "Аподонт" },
  { key: "shapeAnomaly", label: "Хэлбэрийн гажиг" },
];

const regionOrder: ToothRegion[] = [
  "top",
  "bottom",
  "left",
  "right",
  "center",
];
const regionLabels: Record<ToothRegion, string> = {
  top: "Дээд",
  bottom: "Доод",
  left: "Зүүн",
  right: "Баруун",
  center: "Төв",
};

function emptyRegion(): ToothRegionState {
  return { caries: false, filled: false };
}

function cloneTooth(t: InternalTooth): InternalTooth {
  return {
    ...t,
    regions: {
      top: { ...t.regions.top },
      bottom: { ...t.regions.bottom },
      left: { ...t.regions.left },
      right: { ...t.regions.right },
      center: { ...t.regions.center },
    },
  };
}

export default function OrthoOdontogram({ value, onChange }: Props) {
  const [activeCode, setActiveCode] = useState<string | null>(null);

  const internalList = useMemo(
    () => externalToInternal(value || []),
    [value]
  );

  const adultUpperRight = ["18", "17", "16", "15", "14", "13", "12", "11"];
  const adultUpperLeft = ["21", "22", "23", "24", "25", "26", "27", "28"];
  const adultLowerRight = ["48", "47", "46", "45", "44", "43", "42", "41"];
  const adultLowerLeft = ["31", "32", "33", "34", "35", "36", "37", "38"];

  const primaryUpperRight = ["55", "54", "53", "52", "51"];
  const primaryUpperLeft = ["61", "62", "63", "64", "65"];
  const primaryLowerRight = ["85", "84", "83", "82", "81"];
  const primaryLowerLeft = ["71", "72", "73", "74", "75"];

  const findIndex = (code: string) =>
    internalList.findIndex((t) => t.code === code);

  const getTooth = (code: string): InternalTooth | null => {
    const existing = internalList.find((t) => t.code === code);
    return existing || null;
  };

  const applyUpdate = (updated: InternalTooth) => {
    const idx = findIndex(updated.code);
    const next = [...internalList];
    if (idx === -1) {
      next.push(updated);
    } else {
      next[idx] = updated;
    }
    onChange(internalToExternal(next));
  };

  const ensureTooth = (code: string): InternalTooth => {
    return ensureInternalTooth(internalList, code);
  };

  const toggleRegion = (
    code: string,
    region: ToothRegion,
    field: "caries" | "filled"
  ) => {
    const base = ensureTooth(code);
    const copy = cloneTooth(base);
    const current = copy.regions[region][field];
    copy.regions[region][field] = !current;
    applyUpdate(copy);
  };

  const changeBaseStatus = (code: string, status: ToothBaseStatus) => {
    const base = ensureTooth(code);
    const copy = cloneTooth(base);
    copy.baseStatus = status;
    applyUpdate(copy);
  };

  const changeNote = (code: string, note: string) => {
    const base = ensureTooth(code);
    const copy = cloneTooth(base);
    copy.note = note || undefined;
    applyUpdate(copy);
  };

  const clearTooth = (code: string) => {
    const base = ensureTooth(code);
    const cleared: InternalTooth = {
      code,
      baseStatus: "none",
      regions: {
        top: emptyRegion(),
        bottom: emptyRegion(),
        left: emptyRegion(),
        right: emptyRegion(),
        center: emptyRegion(),
      },
      note: undefined,
    };
    applyUpdate(cleared);
  };

  const renderTooth = (code: string) => {
    const t = getTooth(code);
    const baseStatus: ToothBaseStatus = (t?.baseStatus || "none") as ToothBaseStatus;

    const regions = t
      ? t.regions
      : {
          top: emptyRegion(),
          bottom: emptyRegion(),
          left: emptyRegion(),
          right: emptyRegion(),
          center: emptyRegion(),
        };

    return (
      <ToothSvg5Region
        key={code}
        code={code}
        baseStatus={baseStatus}
        regions={regions}
        isActive={activeCode === code}
        onClickTooth={() => setActiveCode(code)}
        onClickRegion={(region) => {
          // For now: clicking region toggles "caries".
          // Later we can add shift+click for "filled", etc.
          toggleRegion(code, region, "caries");
        }}
      />
    );
  };

  const renderRow = (codes: string[]) => (
    <div
      style={{
        display: "flex",
        gap: 6,
        justifyContent: "center",
        marginBottom: 4,
        flexWrap: "wrap",
      }}
    >
      {codes.map((code) => renderTooth(code))}
    </div>
  );

  const activeTooth = activeCode ? getTooth(activeCode) : null;

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        padding: 16,
        background: "#f3f4f6",
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 8, color: "#6b7280" }}>
        Шүд дээр дарж дэлгэрэнгүй тохиргоог засна. Хэсэг тус бүрт caries / filled
        тэмдэглэж болно. Clear нь тухайн шүдний бүх мэдээллийг цэвэрлэнэ.
      </div>

      {/* Adult teeth */}
      <section
        style={{
          marginBottom: 12,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          Насанд хүрэгчдийн шүд (байнгын)
        </div>

        <div style={{ marginBottom: 6 }}>
          <div style={{ textAlign: "center", marginBottom: 2 }}>Дээд эрүү</div>
          {renderRow(adultUpperRight)}
          {renderRow(adultUpperLeft)}
        </div>

        <div>
          <div style={{ textAlign: "center", marginBottom: 2 }}>Доод эрүү</div>
          {renderRow(adultLowerRight)}
          {renderRow(adultLowerLeft)}
        </div>
      </section>

      {/* Primary teeth */}
      <section
        style={{
          padding: 12,
          borderRadius: 8,
          border: "1px dashed #e5e7eb",
          background: "#f9fafb",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          Сүүн шүд
        </div>

        <div style={{ marginBottom: 6 }}>
          <div style={{ textAlign: "center", marginBottom: 2 }}>Дээд эрүү</div>
          {renderRow(primaryUpperRight)}
          {renderRow(primaryUpperLeft)}
        </div>

        <div>
          <div style={{ textAlign: "center", marginBottom: 2 }}>Доод эрүү</div>
          {renderRow(primaryLowerRight)}
          {renderRow(primaryLowerLeft)}
        </div>
      </section>

      {/* Bottom editor panel for currently selected tooth */}
      {activeCode && (
        <section
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              marginBottom: 4,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 500 }}>
              Шүд {activeCode} – дэлгэрэнгүй тохиргоо
            </span>
            <button
              type="button"
              onClick={() => setActiveCode(null)}
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                cursor: "pointer",
              }}
            >
              Хаах
            </button>
          </div>

          {/* Base status */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Үндсэн статус</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BASE_STATUS_LABELS.map(({ key, label }) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                  }}
                >
                  <input
                    type="radio"
                    name="baseStatus"
                    value={key}
                    checked={(activeTooth?.baseStatus ?? "none") === key}
                    onChange={() => changeBaseStatus(activeCode, key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Region caries / filled */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              Хэсэг тус бүрийн байдал
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 4,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Хэсэг
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: 4,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Caries
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: 4,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Filled
                  </th>
                </tr>
              </thead>
              <tbody>
                {regionOrder.map((r) => {
                  const state = activeTooth?.regions[r] || emptyRegion();
                  return (
                    <tr key={r}>
                      <td
                        style={{
                          padding: 4,
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        {regionLabels[r]}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: 4,
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={state.caries}
                          onChange={() =>
                            toggleRegion(activeCode, r, "caries")
                          }
                        />
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: 4,
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={state.filled}
                          onChange={() =>
                            toggleRegion(activeCode, r, "filled")
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Note */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, marginBottom: 2 }}>Тэмдэглэл</div>
            <textarea
              value={activeTooth?.note || ""}
              onChange={(e) => changeNote(activeCode, e.target.value)}
              rows={2}
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
                resize: "vertical",
              }}
            />
          </div>

          {/* Clear */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => clearTooth(activeCode)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #dc2626",
                background: "#fee2e2",
                color: "#b91c1c",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Бүх мэдээллийг цэвэрлэх (Clear)
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

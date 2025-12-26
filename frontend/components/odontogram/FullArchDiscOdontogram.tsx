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

// For now we just use a simple numeric ID per disc instead of FDI code.
// Later we can map each disc to a real tooth code if needed.
const DISC_IDS_TOP_UPPER = Array.from({ length: 16 }, (_v, i) => `U1-${i}`);
const DISC_IDS_BOTTOM_UPPER = Array.from({ length: 16 }, (_v, i) => `U2-${i}`);
const DISC_IDS_TOP_LOWER = Array.from({ length: 16 }, (_v, i) => `L1-${i}`);
const DISC_IDS_BOTTOM_LOWER = Array.from({ length: 16 }, (_v, i) => `L2-${i}`);

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

export default function FullArchDiscOdontogram({ value, onChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Use externalToInternal mapping but treat "code" as our disc id
  const internalList = useMemo(
    () => externalToInternal(value || []),
    [value]
  );

  const findIndex = (code: string) =>
    internalList.findIndex((t) => t.code === code);

  const getDisc = (code: string): InternalTooth | null => {
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

  const ensureDisc = (code: string): InternalTooth => {
    return ensureInternalTooth(internalList, code);
  };

  const toggleRegion = (
    code: string,
    region: ToothRegion,
    field: "caries" | "filled"
  ) => {
    const base = ensureDisc(code);
    const copy = cloneTooth(base);
    copy.regions[region][field] = !copy.regions[region][field];
    applyUpdate(copy);
  };

  const renderDisc = (id: string) => {
    const disc = getDisc(id);
    const baseStatus: ToothBaseStatus = (disc?.baseStatus ||
      "none") as ToothBaseStatus;

    const regions = disc
      ? disc.regions
      : {
          top: emptyRegion(),
          bottom: emptyRegion(),
          left: emptyRegion(),
          right: emptyRegion(),
          center: emptyRegion(),
        };

    return (
      <ToothSvg5Region
        key={id}
        code="" // no visible label
        baseStatus={baseStatus}
        regions={regions}
        isActive={activeId === id}
        size={32}
        onClickTooth={() => setActiveId(id)}
        onClickRegion={(region) => toggleRegion(id, region, "caries")}
      />
    );
  };

  const renderRow = (ids: string[]) => (
    <div
      style={{
        display: "flex",
        gap: 4,
        justifyContent: "center",
        marginBottom: 4,
        flexWrap: "nowrap",
      }}
    >
      {ids.map((id) => renderDisc(id))}
    </div>
  );

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        padding: 16,
        background: "#f9fafb",
        fontSize: 12,
      }}
    >
      {/* Top ( хоншоор ) */}
      <div style={{ textAlign: "center", marginBottom: 8, fontWeight: 500 }}>
        Хоншоор
      </div>

      {/* Upper jaw discs */}
      <div style={{ marginBottom: 8 }}>
        {renderRow(DISC_IDS_TOP_UPPER)}
        {renderRow(DISC_IDS_BOTTOM_UPPER)}
      </div>

      {/* Horizontal separator with Баруун / Зүүн and center Хэлэн тал */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          margin: "6px 0 10px",
        }}
      >
        <span
          style={{
            fontSize: 11,
            marginRight: 4,
          }}
        >
          Баруун
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            backgroundColor: "#d1d5db",
          }}
        />
        <span
          style={{
            fontSize: 11,
            margin: "0 8px",
          }}
        >
          Хэлэн тал
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            backgroundColor: "#d1d5db",
          }}
        />
        <span
          style={{
            fontSize: 11,
            marginLeft: 4,
          }}
        >
          Зүүн
        </span>
      </div>

      {/* Lower jaw discs */}
      <div style={{ marginBottom: 4 }}>
        {renderRow(DISC_IDS_TOP_LOWER)}
        {renderRow(DISC_IDS_BOTTOM_LOWER)}
      </div>

      {/* Bottom label Эрүү */}
      <div style={{ textAlign: "center", marginTop: 4, fontWeight: 500 }}>
        Эрүү
      </div>
    </div>
  );
}

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

/**
 * Active status keys must match the buttons on /ortho/[bookNumber].tsx
 */
export type ActiveStatusKey =
  | "caries"          // Цоорсон – partial, per region
  | "filled"          // Ломбодсон – partial, per region
  | "extracted"       // Авахуулсан – full circle, exclusive
  | "prosthesis"      // Шүдэлбэр – full circle, exclusive
  | "delay"           // Саатсан – full circle, can overlap with caries/filled
  | "anodontia"       // Anodontia – full circle, exclusive
  | "supernumerary"   // Илүү шүд – handled by text, no visual change yet
  | "shapeAnomaly";   // Хэлбэрийн гажиг – full circle, can overlap with caries/filled

export type ExternalDisc = {
  code: string;   // disc id
  status: string; // baseStatus stored externally
};

type Props = {
  value: ExternalDisc[];
  onChange: (next: ExternalDisc[]) => void;
  activeStatus: ActiveStatusKey | null;
};

// Layout:
//   Row 1: 16 discs
//   Row 2: 10 discs
//   Row 3: 10 discs
//   Row 4: 16 discs
const DISC_IDS_ROW1 = Array.from({ length: 16 }, (_v, i) => `R1-${i}`);
const DISC_IDS_ROW2 = Array.from({ length: 10 }, (_v, i) => `R2-${i}`);
const DISC_IDS_ROW3 = Array.from({ length: 10 }, (_v, i) => `R3-${i}`);
const DISC_IDS_ROW4 = Array.from({ length: 16 }, (_v, i) => `R4-${i}`);

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

export default function FullArchDiscOdontogram({
  value,
  onChange,
  activeStatus,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Convert external simple list to richer internal structure
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

  /**
   * For Цоорсон / Ломбодсон – per‑region toggles.
   */
  const toggleRegionPartial = (
  code: string,
  region: ToothRegion,
  field: "caries" | "filled"
) => {
  const base = ensureDisc(code);
  const copy = cloneTooth(base);
  copy.regions[region][field] = !copy.regions[region][field];
  applyUpdate(copy);
};

  /**
   * For full‑circle statuses.
   * - extracted / prosthesis / apodontia: exclusive, clear all partials
   * - delay / shapeAnomaly: can overlap with caries/filled, so partials kept
   */
  const setFullCircleStatus = (code: string, status: ToothBaseStatus) => {
    const base = ensureDisc(code);
    const copy = cloneTooth(base);
    copy.baseStatus = status;

    if (
      status === "extracted" ||
      status === "prosthesis" ||
      status === "apodontia"
    ) {
      // Exclusive: clear all region overlays
      copy.regions = {
        top: emptyRegion(),
        bottom: emptyRegion(),
        left: emptyRegion(),
        right: emptyRegion(),
        center: emptyRegion(),
      };
    }

    // For delay / shapeAnomaly we keep partials so they overlap visually
    applyUpdate(copy);
  };

  /**
   * High‑level click behavior according to activeStatus.
   */
  const handleDiscClick = (id: string, clickedRegion: ToothRegion) => {
  console.log("DISC CLICK", { id, clickedRegion, activeStatus });

  if (!activeStatus) {
    toggleRegionPartial(id, clickedRegion, "caries");
    return;
  }

  switch (activeStatus) {
    case "caries":
      toggleRegionPartial(id, clickedRegion, "caries");
      break;
    case "filled":
      toggleRegionPartial(id, clickedRegion, "filled");
      break;
    case "extracted":
      setFullCircleStatus(id, "extracted");
      break;
    case "prosthesis":
      setFullCircleStatus(id, "prosthesis");
      break;
    case "anodontia":
      setFullCircleStatus(id, "apodontia");
      break;
    case "delay":
      setFullCircleStatus(id, "delay");
      break;
    case "shapeAnomaly":
      setFullCircleStatus(id, "shapeAnomaly");
      break;
    case "supernumerary":
      break;
  }
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
      code=""
      baseStatus={baseStatus}
      regions={regions}
      isActive={activeId === id}
      size={28}
      onClickTooth={() => setActiveId(id)}
      onClickRegion={(region) => handleDiscClick(id, region)}
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
      {/* Top label: upper jaw */}
      <div style={{ textAlign: "center", marginBottom: 8, fontWeight: 500 }}>
        Хоншоор
      </div>

      {/* Upper rows container: 16 + 10, with vertical midline */}
      <div
        style={{
          marginBottom: 8,
          position: "relative",
        }}
      >
        {/* Vertical line splitting left/right halves */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: 1,
            backgroundColor: "#4b5563",
            transform: "translateX(-0.5px)",
          }}
        />

        {renderRow(DISC_IDS_ROW1)}
        {renderRow(DISC_IDS_ROW2)}
      </div>

      {/* Middle line: Баруун | Хэлэн тал | Зүүн */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          margin: "6px 0 10px",
        }}
      >
        <span style={{ fontSize: 11, marginRight: 4 }}>Баруун</span>
        <div
          style={{
            flex: 1,
            height: 1,
            backgroundColor: "#d1d5db",
          }}
        />
        <span style={{ fontSize: 11, margin: "0 8px" }}>Хэлэн тал</span>
        <div
          style={{
            flex: 1,
            height: 1,
            backgroundColor: "#d1d5db",
          }}
        />
        <span style={{ fontSize: 11, marginLeft: 4 }}>Зүүн</span>
      </div>

      {/* Lower rows container: 10 + 16, with same vertical midline */}
      <div
        style={{
          marginBottom: 4,
          position: "relative",
        }}
      >
        {/* Vertical line splitting left/right halves for bottom rows */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: 1,
            backgroundColor: "#4b5563",
            transform: "translateX(-0.5px)",
          }}
        />

        {renderRow(DISC_IDS_ROW3)}
        {renderRow(DISC_IDS_ROW4)}
      </div>

      {/* Bottom label: lower jaw */}
      <div style={{ textAlign: "center", marginTop: 4, fontWeight: 500 }}>
        Эрүү
      </div>
    </div>
  );
}

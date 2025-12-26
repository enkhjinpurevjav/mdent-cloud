import React, { useEffect, useState } from "react";
import ToothSvg5Region, {
  ToothRegion,
  ToothBaseStatus,
  ToothRegionState,
} from "./ToothSvg5Region";

/**
 * Active status keys must match the buttons on /ortho/[bookNumber].tsx
 */
export type ActiveStatusKey =
  | "caries" // Цоорсон – partial, per region
  | "filled" // Ломбодсон – partial, per region
  | "extracted" // Авахуулсан – full circle, exclusive
  | "prosthesis" // Шүдэлбэр – full circle, exclusive
  | "delay" // Саатсан – full circle, can overlap with caries/filled
  | "anodontia" // Anodontia – full circle, exclusive
  | "supernumerary" // Илүү шүд – handled by text, no visual change yet
  | "shapeAnomaly"; // Хэлбэрийн гажиг – full circle, can overlap with caries/filled

export type ExternalDisc = {
  code: string; // disc id
  status: string; // baseStatus stored externally
};

type InternalDisc = {
  code: string;
  baseStatus: ToothBaseStatus;
  regions: {
    top: ToothRegionState;
    bottom: ToothRegionState;
    left: ToothRegionState;
    right: ToothRegionState;
    center: ToothRegionState;
  };
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
const ALL_IDS = [
  ...DISC_IDS_ROW1,
  ...DISC_IDS_ROW2,
  ...DISC_IDS_ROW3,
  ...DISC_IDS_ROW4,
];

function emptyRegion(): ToothRegionState {
  return { caries: false, filled: false };
}

function createEmptyDisc(code: string): InternalDisc {
  return {
    code,
    baseStatus: "none",
    regions: {
      top: emptyRegion(),
      bottom: emptyRegion(),
      left: emptyRegion(),
      right: emptyRegion(),
      center: emptyRegion(),
    },
  };
}

function cloneDisc(d: InternalDisc): InternalDisc {
  return {
    code: d.code,
    baseStatus: d.baseStatus,
    regions: {
      top: { ...d.regions.top },
      bottom: { ...d.regions.bottom },
      left: { ...d.regions.left },
      right: { ...d.regions.right },
      center: { ...d.regions.center },
    },
  };
}

export default function FullArchDiscOdontogram({
  value,
  onChange,
  activeStatus,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Single source of truth for what we draw
  const [internalDiscs, setInternalDiscs] = useState<InternalDisc[]>([]);

  // Initialize internalDiscs once from value (for baseStatus only)
  useEffect(() => {
    const map: Record<string, InternalDisc> = {};

    // create an entry for every known disc
    for (const id of ALL_IDS) {
      map[id] = createEmptyDisc(id);
    }

    // apply baseStatus from external value if present
    if (value && value.length > 0) {
      for (const ext of value) {
        const target = map[ext.code];
        if (!target) continue;
        const s = (ext.status || "none") as ToothBaseStatus;
        target.baseStatus = s;
      }
    }

    setInternalDiscs(Object.values(map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  const getDisc = (code: string): InternalDisc => {
    const found = internalDiscs.find((d) => d.code === code);
    return found || createEmptyDisc(code);
  };

  const updateDisc = (updated: InternalDisc) => {
    // 1) update local state used for rendering
    setInternalDiscs((prev) => {
      const idx = prev.findIndex((d) => d.code === updated.code);
      if (idx === -1) return [...prev, updated];
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });

    // 2) update simplified external array (only baseStatus)
    const externalMap: Record<string, ExternalDisc> = {};

    // start from existing value so we don't lose other discs
    for (const e of value || []) {
      externalMap[e.code] = { ...e };
    }

    externalMap[updated.code] = {
      code: updated.code,
      status: updated.baseStatus,
    };

    const nextExternal = Object.values(externalMap);
    onChange(nextExternal);
  };

  /**
   * Helper: which base statuses allow Цоорсон/Ломбодсон overlays?
   * Allowed: none, delay, shapeAnomaly
   */
  const baseAllowsPartial = (status: ToothBaseStatus): boolean => {
    return (
      status === "none" ||
      status === "delay" ||
      status === "shapeAnomaly"
    );
  };

  /**
   * For Цоорсон / Ломбодсон – per‑region toggles, with rules:
   * - Only allowed when baseStatus is none / delay / shapeAnomaly.
   * - A region can have either caries OR filled, not both.
   */
  const toggleRegionPartial = (
    code: string,
    region: ToothRegion,
    field: "caries" | "filled"
  ) => {
    const base = getDisc(code);

    // If the baseStatus does NOT allow partial overlays, ignore the click.
    if (!baseAllowsPartial(base.baseStatus)) {
      return;
    }

    const copy = cloneDisc(base);
    const reg = copy.regions[region];

    if (field === "caries") {
      // Turn off filled in this region (cannot have both)
      reg.filled = false;
      reg.caries = !reg.caries;
    } else {
      // field === "filled"
      reg.caries = false;
      reg.filled = !reg.filled;
    }

    updateDisc(copy);
  };

  /**
   * For full‑circle statuses.
   * - extracted / prosthesis / apodontia: exclusive, clear all partials
   * - delay / shapeAnomaly: can overlap with caries/filled, so partials kept
   */
  const setFullCircleStatus = (code: string, status: ToothBaseStatus) => {
    const base = getDisc(code);
    const copy = cloneDisc(base);
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

    updateDisc(copy);
  };

  /**
   * High‑level click behavior according to activeStatus.
   */
  const handleDiscClick = (id: string, clickedRegion: ToothRegion) => {
    if (!activeStatus) {
      // No status selected: default = toggle caries on the clicked region
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
        // Илүү шүд – no visual on disc for now
        break;
    }
  };

  const renderDisc = (id: string) => {
    const disc = getDisc(id);
    const baseStatus: ToothBaseStatus = disc.baseStatus || "none";
    const regions = disc.regions;

    return (
      <ToothSvg5Region
        key={id}
        code="" // no numeric label for this full-arch layout
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

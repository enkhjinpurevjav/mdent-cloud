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
  | "extracted" // Авахуулсан – full circle
  | "prosthesis" // Шүдэлбэр – full circle
  | "delay" // Саатсан – full circle (can overlap with partial)
  | "anodontia" // Anodontia – full circle
  | "supernumerary" // Илүү шүд – no disc visual yet
  | "shapeAnomaly"; // Хэлбэрийн гажиг – full circle (can overlap with partial)

/**
 * External model saved in orthoCard.data.toothChart.
 * Includes persisted per‑region data.
 */
export type ExternalDisc = {
  code: string;
  status: string; // baseStatus
  regions?: {
    top?: "none" | "caries" | "filled";
    bottom?: "none" | "caries" | "filled";
    left?: "none" | "caries" | "filled";
    right?: "none" | "caries" | "filled";
    center?: "none" | "caries" | "filled";
  };
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
  onChange: (next: ExternalDisc[]) => void; // called on every click
  activeStatus: ActiveStatusKey | null;
};

// Layout IDs
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

  // Source of truth for what we draw
  const [internalDiscs, setInternalDiscs] = useState<InternalDisc[]>([]);

  /**
   * Initialize internalDiscs from external baseStatus + regions.
   * Runs on mount and whenever value changes from outside (e.g. different card).
   */
  useEffect(() => {
    const map: Record<string, InternalDisc> = {};

    for (const id of ALL_IDS) {
      map[id] = createEmptyDisc(id);
    }

    if (value && value.length > 0) {
      for (const ext of value) {
        const target = map[ext.code];
        if (!target) continue;

        // Base status
        const s = (ext.status || "none") as ToothBaseStatus;
        target.baseStatus = s;

        // Regions (optional, backward‑compatible)
        if (ext.regions) {
          const r = ext.regions;
          const conv = (
            v?: "none" | "caries" | "filled"
          ): ToothRegionState => ({
            caries: v === "caries",
            filled: v === "filled",
          });

          target.regions = {
            top: conv(r.top),
            bottom: conv(r.bottom),
            left: conv(r.left),
            right: conv(r.right),
            center: conv(r.center),
          };
        }
      }
    }

    setInternalDiscs(Object.values(map));
  }, [value]);

  const getDisc = (code: string): InternalDisc => {
    const found = internalDiscs.find((d) => d.code === code);
    return found || createEmptyDisc(code);
  };

  const buildExternalSnapshot = (discs: InternalDisc[]): ExternalDisc[] =>
    discs.map((d) => {
      const encodeRegion = (
        reg: ToothRegionState
      ): "none" | "caries" | "filled" => {
        if (reg.caries) return "caries";
        if (reg.filled) return "filled";
        return "none";
      };

      return {
        code: d.code,
        status: d.baseStatus,
        regions: {
          top: encodeRegion(d.regions.top),
          bottom: encodeRegion(d.regions.bottom),
          left: encodeRegion(d.regions.left),
          right: encodeRegion(d.regions.right),
          center: encodeRegion(d.regions.center),
        },
      };
    });

  const updateDisc = (updated: InternalDisc) => {
    setInternalDiscs((prev) => {
      const idx = prev.findIndex((d) => d.code === updated.code);
      let next: InternalDisc[];
      if (idx === -1) next = [...prev, updated];
      else {
        next = [...prev];
        next[idx] = updated;
      }
      // Immediately sync to parent so "Карт хадгалах" can persist
      const snapshot = buildExternalSnapshot(next);
      onChange(snapshot);
      return next;
    });
  };

  const baseAllowsPartial = (status: ToothBaseStatus): boolean =>
    status === "none" || status === "delay" || status === "shapeAnomaly";

  const toggleRegionPartial = (
    code: string,
    region: ToothRegion,
    field: "caries" | "filled"
  ) => {
    const base = getDisc(code);

    if (!baseAllowsPartial(base.baseStatus)) {
      return;
    }

    const copy = cloneDisc(base);
    const reg = copy.regions[region];

    if (field === "caries") {
      // region can have caries OR filled, not both
      reg.filled = false;
      reg.caries = !reg.caries;
    } else {
      reg.caries = false;
      reg.filled = !reg.filled;
    }

    updateDisc(copy);
  };

  const setFullCircleStatus = (code: string, status: ToothBaseStatus) => {
    const base = getDisc(code);

    // Toggle off when same status clicked again
    if (base.baseStatus === status) {
      const cleared = cloneDisc(base);
      cleared.baseStatus = "none";
      // Regions remain unchanged
      updateDisc(cleared);
      return;
    }

    const copy = cloneDisc(base);
    copy.baseStatus = status;

    if (
      status === "extracted" ||
      status === "prosthesis" ||
      status === "apodontia"
    ) {
      // Exclusive: clear all partial overlays
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

  const handleDiscClick = (id: string, clickedRegion: ToothRegion) => {
    if (!activeStatus) {
      // default tool = caries
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
        // Илүү шүд – no disc visual yet
        break;
    }
  };

  const renderDisc = (id: string) => {
    const disc = getDisc(id);
    return (
      <ToothSvg5Region
        key={id}
        code=""
        baseStatus={disc.baseStatus}
        regions={disc.regions}
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

      {/* Upper rows: 16 + 10, with vertical midline */}
      <div style={{ marginBottom: 8, position: "relative" }}>
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
        <div style={{ flex: 1, height: 1, backgroundColor: "#d1d5db" }} />
        <span style={{ fontSize: 11, margin: "0 8px" }}>Хэлэн тал</span>
        <div style={{ flex: 1, height: 1, backgroundColor: "#d1d5db" }} />
        <span style={{ fontSize: 11, marginLeft: 4 }}>Зүүн</span>
      </div>

      {/* Lower rows: 10 + 16 */}
      <div style={{ marginBottom: 4, position: "relative" }}>
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

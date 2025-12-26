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
  | "supernumerary" // Илүү шүд – no visual yet
  | "shapeAnomaly"; // Хэлбэрийн гажиг – full circle (can overlap with partial)

/**
 * External model saved in orthoCard.data.toothChart.
 * Now supports persisted per‑region data.
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
  onChange: (next: ExternalDisc[]) => void; // called only on "Өөрчлөлт хадгалах"
  activeStatus: ActiveStatusKey | null;
  onSavePainted?: (snapshot: ExternalDisc[]) => void; // optional UX hook
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
  onSavePainted,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Single source of truth for what we draw (includes unsaved paints)
  const [internalDiscs, setInternalDiscs] = useState<InternalDisc[]>([]);

  /**
   * Initialize internalDiscs ONCE from external baseStatus + regions.
   * We intentionally ignore later value changes to avoid wiping live paints.
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

        // Hydrate regions if present
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only once on mount

  const getDisc = (code: string): InternalDisc => {
    const found = internalDiscs.find((d) => d.code === code);
    return found || createEmptyDisc(code);
  };

  const updateDisc = (updated: InternalDisc) => {
    setInternalDiscs((prev) => {
      const idx = prev.findIndex((d) => d.code === updated.code);
      if (idx === -1) return [...prev, updated];
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });
    // Do NOT call onChange here: only "Өөрчлөлт хадгалах" triggers save.
  };

  /**
   * Base statuses that ALLOW partial overlays (цоорсон/ломбодсон):
   *  - none
   *  - delay (Саатсан)
   *  - shapeAnomaly (Хэлбэрийн гажиг)
   * Others (extracted, prosthesis, apodontia) disallow partial.
   */
  const baseAllowsPartial = (status: ToothBaseStatus): boolean =>
    status === "none" || status === "delay" || status === "shapeAnomaly";

  /**
   * Per‑region toggle logic for Цоорсон / Ломбодсон.
   * Rules:
   *  - Only allowed when baseStatus is none / delay / shapeAnomaly.
   *  - A region can have either caries OR filled, not both.
   *  - Clicking same one twice toggles it off.
   */
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
      reg.filled = false;
      reg.caries = !reg.caries;
    } else {
      reg.caries = false;
      reg.filled = !reg.filled;
    }

    updateDisc(copy);
  };

  /**
   * Full‑circle status logic.
   *  - Clicking a status sets it.
   *  - Clicking SAME status again toggles back to "none".
   *  - extracted / prosthesis / apodontia clear all partial regions.
   *  - delay / shapeAnomaly keep partial overlays.
   */
  const setFullCircleStatus = (code: string, status: ToothBaseStatus) => {
    const base = getDisc(code);

    // Toggle off when same status is clicked again
    if (base.baseStatus === status) {
      const cleared = cloneDisc(base);
      cleared.baseStatus = "none";
      // Regions remain as they are
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
      // Exclusive statuses: clear all partial overlays
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
   * Entry point for clicks from ToothSvg5Region.
   */
  const handleDiscClick = (id: string, clickedRegion: ToothRegion) => {
    if (!activeStatus) {
      // Default tool when nothing selected = Цоорсон
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

  /**
   * Build external snapshot including regions for persistence.
   */
  const buildExternalSnapshot = (): ExternalDisc[] =>
    internalDiscs.map((d) => {
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

  /**
   * “Өөрчлөлт хадгалах” – push current internal state to parent.
   * Parent then persists via its own save button / API.
   */
  const handleSavePainted = () => {
    const snapshot = buildExternalSnapshot();
    onChange(snapshot);
    if (onSavePainted) onSavePainted(snapshot);
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
      <div
        style={{
          marginBottom: 8,
          position: "relative",
        }}
      >
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
      <div
        style={{
          marginBottom: 8,
          position: "relative",
        }}
      >
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

      {/* Save painting button */}
      <div
        style={{
          marginTop: 4,
          display: "flex",
          justifyContent: "flex-start",
        }}
      >
        <button
          type="button"
          onClick={handleSavePainted}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #2563eb",
            background: "#2563eb",
            color: "#ffffff",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Өөрчлөлт хадгалах
        </button>
      </div>

      {/* Bottom label: lower jaw */}
      <div style={{ textAlign: "center", marginTop: 4, fontWeight: 500 }}>
        Эрүү
      </div>
    </div>
  );
}

import React from "react";

export type ToothRegion = "top" | "bottom" | "left" | "right" | "center";

export type ToothBaseStatus =
  | "none"
  | "extracted"
  | "prosthesis"
  | "delay"        // Саатал
  | "apodontia"
  | "shapeAnomaly";

export type ToothRegionState = {
  caries: boolean;
  filled: boolean;
};

export type ToothSvg5RegionProps = {
  code: string;

  baseStatus: ToothBaseStatus;

  regions: {
    top: ToothRegionState;
    bottom: ToothRegionState;
    left: ToothRegionState;
    right: ToothRegionState;
    center: ToothRegionState;
  };

  /** Fired when user clicks a specific region (for toggling caries/filled later) */
  onClickRegion?: (region: ToothRegion) => void;

  /** Optional: click the middle area to open a popover/editor */
  onClickTooth?: () => void;

  /** Draw a highlight ring when this tooth is selected in the UI */
  isActive?: boolean;

  /** Optional size in px (default 40) */
  size?: number;
};

/**
 * Single tooth SVG with 5 regions:
 * - 4 outer wedges: top, right, bottom, left
 * - 1 center circle
 *
 * Colors:
 * - baseStatus controls the background (full tooth) color
 * - region caries/filled can later be drawn as overlays
 *
 * For now we just:
 * - fill whole tooth with baseStatus color
 * - tint each region slightly differently when clicked (for debugging)
 * You can refine colors in OrthoOdontogram once behaviour is correct.
 */
export default function ToothSvg5Region(props: ToothSvg5RegionProps) {
  const {
    code,
    baseStatus,
    regions,
    onClickRegion,
    onClickTooth,
    isActive = false,
    size = 40,
  } = props;

  const S = size;
  const center = S / 2;
  const outerR = (S / 2) * 0.95; // outer radius
  const innerR = outerR * 0.55;  // ring inner radius
  const coreR = innerR * 0.65;   // center circle radius

  // --- Base status full‑tooth color ---
  const baseFill =
    baseStatus === "none"
      ? "#ffffff"
      : baseStatus === "extracted"
      ? "#fee2e2" // light red
      : baseStatus === "prosthesis"
      ? "#e0f2fe" // light blue
      : baseStatus === "delay"
      ? "#fef3c7" // light amber
      : baseStatus === "apodontia"
      ? "#e5e7eb" // gray
      : baseStatus === "shapeAnomaly"
      ? "#bfdbfe" // stronger blue
      : "#ffffff";

  const borderColor = isActive ? "#2563eb" : "#111827";

  // Helper to create an annular sector (ring wedge)
  function annularSectorPath(
    cx: number,
    cy: number,
    rOuter: number,
    rInner: number,
    startAngleDeg: number,
    endAngleDeg: number
  ): string {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const largeArc =
      Math.abs(endAngleDeg - startAngleDeg) > 180 ? 1 : 0;

    const startOuterX = cx + rOuter * Math.cos(toRad(startAngleDeg));
    const startOuterY = cy + rOuter * Math.sin(toRad(startAngleDeg));
    const endOuterX = cx + rOuter * Math.cos(toRad(endAngleDeg));
    const endOuterY = cy + rOuter * Math.sin(toRad(endAngleDeg));

    const startInnerX = cx + rInner * Math.cos(toRad(endAngleDeg));
    const startInnerY = cy + rInner * Math.sin(toRad(endAngleDeg));
    const endInnerX = cx + rInner * Math.cos(toRad(startAngleDeg));
    const endInnerY = cy + rInner * Math.sin(toRad(startAngleDeg));

    return [
      `M ${startOuterX} ${startOuterY}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${endOuterX} ${endOuterY}`,
      `L ${startInnerX} ${startInnerY}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${endInnerX} ${endInnerY}`,
      "Z",
    ].join(" ");
  }

  // Region overlay color (for now simple)
  const regionFill = (region: ToothRegionState): string => {
    if (region.caries && region.filled) {
      return "#a855f7"; // purple when both
    }
    if (region.caries) return "#f97373"; // red-ish
    if (region.filled) return "#60a5fa"; // blue-ish
    return "transparent";
  };

  // Slightly tint the region over base fill
  const regionOverlayOpacity = 0.9;

  const handleRegionClick = (region: ToothRegion) => {
    if (onClickRegion) onClickRegion(region);
  };

  const handleCenterClick = () => {
    if (onClickTooth) onClickTooth();
    else if (onClickRegion) onClickRegion("center");
  };

  // Precompute wedge paths for 4 directions
  const topPath = annularSectorPath(center, center, outerR, innerR, -135, -45);
  const rightPath = annularSectorPath(center, center, outerR, innerR, -45, 45);
  const bottomPath = annularSectorPath(center, center, outerR, innerR, 45, 135);
  const leftPath = annularSectorPath(
    center,
    center,
    outerR,
    innerR,
    135,
    225
  );

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        fontSize: 10,
      }}
    >
      <svg
        width={S}
        height={S}
        viewBox={`0 0 ${S} ${S}`}
        style={{ display: "block", cursor: "pointer" }}
      >
        {/* Outer circle (tooth outline + base fill) */}
        <circle
          cx={center}
          cy={center}
          r={outerR}
          fill={baseFill}
          stroke={borderColor}
          strokeWidth={isActive ? 2 : 1.5}
        />

        {/* 4 ring segments */}
        <g>
          {/* TOP */}
          <path
            d={topPath}
            fill={regionFill(regions.top)}
            fillOpacity={regionOverlayOpacity}
            stroke="#6b7280"
            strokeWidth={0.5}
            onClick={() => handleRegionClick("top")}
          />
          {/* RIGHT */}
          <path
            d={rightPath}
            fill={regionFill(regions.right)}
            fillOpacity={regionOverlayOpacity}
            stroke="#6b7280"
            strokeWidth={0.5}
            onClick={() => handleRegionClick("right")}
          />
          {/* BOTTOM */}
          <path
            d={bottomPath}
            fill={regionFill(regions.bottom)}
            fillOpacity={regionOverlayOpacity}
            stroke="#6b7280"
            strokeWidth={0.5}
            onClick={() => handleRegionClick("bottom")}
          />
          {/* LEFT */}
          <path
            d={leftPath}
            fill={regionFill(regions.left)}
            fillOpacity={regionOverlayOpacity}
            stroke="#6b7280"
            strokeWidth={0.5}
            onClick={() => handleRegionClick("left")}
          />
        </g>

        {/* Center circle */}
        <circle
          cx={center}
          cy={center}
          r={coreR}
          fill={regionFill(regions.center) || "#ffffff"}
          fillOpacity={regionFill(regions.center) ? regionOverlayOpacity : 1}
          stroke="#6b7280"
          strokeWidth={0.7}
          onClick={handleCenterClick}
        />
      </svg>

      {/* FDI code label under the tooth */}
      <span style={{ fontSize: 9, color: "#374151" }}>{code}</span>
    </div>
  );
}

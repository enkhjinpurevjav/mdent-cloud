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

  onClickRegion?: (region: ToothRegion) => void;
  onClickTooth?: () => void;

  isActive?: boolean;
  size?: number;
};

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
  const cx = S / 2;
  const cy = S / 2;
  const outerR = (S / 2) * 0.95;
  const innerR = outerR * 0.55;
  const coreR = innerR * 0.65;

  const baseFill =
    baseStatus === "none"
      ? "#ffffff"
      : baseStatus === "extracted"
      ? "#fecaca"
      : baseStatus === "prosthesis"
      ? "#bae6fd"
      : baseStatus === "delay"
      ? "#fde68a"
      : baseStatus === "apodontia"
      ? "#e5e7eb"
      : baseStatus === "shapeAnomaly"
      ? "#bfdbfe"
      : "#ffffff";

  const borderColor = isActive ? "#2563eb" : "#111827";

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  function annularSectorPath(
    rOuter: number,
    rInner: number,
    startAngleDeg: number,
    endAngleDeg: number
  ): string {
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

  // Цоорсон (caries) = red, Ломбодсон (filled) = blue, both = purple.
  const regionFill = (region: ToothRegionState): string => {
    if (region.caries && region.filled) return "#a855f7";
    if (region.caries) return "#f97373";
    if (region.filled) return "#60a5fa";
    return "transparent";
  };

  const overlayOpacity = 0.9;

  const handleRegionClick = (region: ToothRegion) => {
    if (onClickRegion) onClickRegion(region);
  };

  const handleCenterClick = () => {
    if (onClickTooth) onClickTooth();
    if (onClickRegion) onClickRegion("center");
  };

  const topPath = annularSectorPath(outerR, innerR, -135, -45);
  const rightPath = annularSectorPath(outerR, innerR, -45, 45);
  const bottomPath = annularSectorPath(outerR, innerR, 45, 135);
  const leftPath = annularSectorPath(outerR, innerR, 135, 225);

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
        {/* Full-circle background for baseStatus */}
        <circle
          cx={cx}
          cy={cy}
          r={outerR}
          fill={baseFill}
          stroke={borderColor}
          strokeWidth={isActive ? 2 : 1.5}
        />

        {/* 4 wedge regions */}
        <g>
          <path
            d={topPath}
            fill={regionFill(regions.top)}
            fillOpacity={overlayOpacity}
            stroke="#6b7280"
            strokeWidth={0.5}
            onClick={() => handleRegionClick("top")}
          />
          <path
            d={rightPath}
            fill={regionFill(regions.right)}
            fillOpacity={overlayOpacity}
            stroke="#6b7280"
            strokeWidth={0.5}
            onClick={() => handleRegionClick("right")}
          />
          <path
            d={bottomPath}
            fill={regionFill(regions.bottom)}
            fillOpacity={overlayOpacity}
            stroke="#6b7280"
            strokeWidth={0.5}
            onClick={() => handleRegionClick("bottom")}
          />
          <path
            d={leftPath}
            fill={regionFill(regions.left)}
            fillOpacity={overlayOpacity}
            stroke="#6b7280"
            strokeWidth={0.5}
            onClick={() => handleRegionClick("left")}
          />
        </g>

        {/* Center region */}
        <circle
          cx={cx}
          cy={cy}
          r={coreR}
          fill={regionFill(regions.center) || "#ffffff"}
          fillOpacity={regionFill(regions.center) ? overlayOpacity : 1}
          stroke="#6b7280"
          strokeWidth={0.7}
          onClick={handleCenterClick}
        />
      </svg>

      {/* Code label (not shown for your full arch, but kept for reuse) */}
      <span style={{ fontSize: 9, color: "#374151" }}>{code}</span>
    </div>
  );
}

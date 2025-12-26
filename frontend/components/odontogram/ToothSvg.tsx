"use client";

import React from "react";
import type { BaseStatus, Surface } from "../../types/orthoChart";
import { baseStatusColors, borderColor, overlayColors } from "./colors";

export interface ToothSvgProps {
  baseStatus: BaseStatus;
  caries: Surface[];
  filled: Surface[];
  onToothClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const surfaces: Surface[] = ["TOP", "RIGHT", "BOTTOM", "LEFT", "CENTER"];

export function ToothSvg({ baseStatus, caries, filled, onToothClick }: ToothSvgProps) {
  const baseFill =
    baseStatus === "NONE" ? "transparent" : baseStatusColors[baseStatus];

  const size = 40;
  const r = 16;
  const cx = 20;
  const cy = 20;

  const quadrantFill = (surface: Surface): string | undefined => {
    if (caries.includes(surface)) return overlayColors.caries;
    if (filled.includes(surface)) return overlayColors.filled;
    return undefined;
  };

  return (
    <div
      style={{ width: size, height: size, position: "relative", cursor: "pointer" }}
      onClick={onToothClick}
    >
      <svg width={size} height={size}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={baseFill}
          stroke={borderColor}
          strokeWidth={1.5}
        />

        {/* TOP */}
        {quadrantFill("TOP") && (
          <rect
            x={cx - r}
            y={cy - r}
            width={2 * r}
            height={r}
            fill={quadrantFill("TOP")}
          />
        )}
        {/* BOTTOM */}
        {quadrantFill("BOTTOM") && (
          <rect
            x={cx - r}
            y={cy}
            width={2 * r}
            height={r}
            fill={quadrantFill("BOTTOM")}
          />
        )}
        {/* LEFT */}
        {quadrantFill("LEFT") && (
          <rect
            x={cx - r}
            y={cy - r}
            width={r}
            height={2 * r}
            fill={quadrantFill("LEFT")}
          />
        )}
        {/* RIGHT */}
        {quadrantFill("RIGHT") && (
          <rect
            x={cx}
            y={cy - r}
            width={r}
            height={2 * r}
            fill={quadrantFill("RIGHT")}
          />
        )}
        {/* CENTER */}
        {quadrantFill("CENTER") && (
          <circle
            cx={cx}
            cy={cy}
            r={r / 3}
            fill={quadrantFill("CENTER")}
          />
        )}

        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={borderColor}
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}

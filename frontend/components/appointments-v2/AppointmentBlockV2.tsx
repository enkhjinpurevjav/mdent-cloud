import React from "react";
import type { Appointment } from "../appointments/types";
import { formatGridShortLabel, formatStatus } from "../appointments/formatters";
import { naiveTimestampToHm } from "../../utils/businessTime";

const LANE_GAP_PX = 4;
const BLOCK_INSET_PX = 4;

export type AppointmentBlockGeometry = {
  appointment: Appointment;
  top: number;
  height: number;
  lane: 0 | 1;
  split: boolean;
};

type AppointmentBlockV2Props = {
  block: AppointmentBlockGeometry;
  onClick: (appointment: Appointment) => void;
};

function statusColor(status: string) {
  switch (status) {
    case "completed":
      return "#22c55e";
    case "confirmed":
      return "#3b82f6";
    case "online":
      return "#6366f1";
    case "ongoing":
      return "#16a34a";
    case "imaging":
      return "#8b5cf6";
    case "ready_to_pay":
      return "#fbbf24";
    case "partial_paid":
      return "#eab308";
    case "other":
      return "#94a3b8";
    case "cancelled":
      return "#b91c1c";
    case "no_show":
      return "#ef4444";
    default:
      return "#cbd5f5";
  }
}

function AppointmentBlockV2({ block, onClick }: AppointmentBlockV2Props) {
  const { appointment, top, height, lane, split } = block;
  const bg = statusColor(appointment.status);
  const whiteText =
    appointment.status === "completed" || appointment.status === "cancelled";
  const laneInsetPx = BLOCK_INSET_PX + LANE_GAP_PX / 2;
  const width = split ? `calc(50% - ${laneInsetPx}px)` : `calc(100% - ${BLOCK_INSET_PX * 2}px)`;
  const left = split ? (lane === 0 ? BLOCK_INSET_PX : `calc(50% + ${LANE_GAP_PX / 2}px)`) : BLOCK_INSET_PX;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(appointment);
      }}
      style={{
        position: "absolute",
        top,
        left,
        width,
        minHeight: height,
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 8,
        background: bg,
        color: whiteText ? "#ffffff" : "#1F2937",
        padding: "2px 4px",
        textAlign: "left",
        cursor: "pointer",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        lineHeight: 1.2,
      }}
      title={`${formatStatus(appointment.status)} · ${naiveTimestampToHm(appointment.scheduledAt)}`}
    >
      <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {naiveTimestampToHm(appointment.scheduledAt)} · {formatStatus(appointment.status)}
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {formatGridShortLabel(appointment) || `#${appointment.id}`}
      </div>
    </button>
  );
}

export default React.memo(AppointmentBlockV2);

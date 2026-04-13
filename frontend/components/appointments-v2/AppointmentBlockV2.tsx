import React from "react";
import type { Appointment } from "../appointments/types";
import { formatGridShortLabel, formatStatus } from "../appointments/formatters";
import { naiveTimestampToHm } from "../../utils/businessTime";

export type AppointmentBlockGeometry = {
  appointment: Appointment;
  top: number;
  height: number;
  offsetX: number;
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
  const { appointment, top, height, offsetX } = block;
  const bg = statusColor(appointment.status);
  const whiteText =
    appointment.status === "completed" || appointment.status === "cancelled";

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
        left: 4 + offsetX,
        right: 4,
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

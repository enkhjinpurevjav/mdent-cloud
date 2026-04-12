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
    case "confirmed":
      return "#2563eb";
    case "ongoing":
      return "#0f766e";
    case "ready_to_pay":
      return "#7c3aed";
    case "completed":
      return "#4b5563";
    case "cancelled":
    case "no_show":
      return "#b91c1c";
    default:
      return "#334155";
  }
}

export default function AppointmentBlockV2({ block, onClick }: AppointmentBlockV2Props) {
  const { appointment, top, height, offsetX } = block;
  const bg = statusColor(appointment.status);

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
        border: "none",
        borderRadius: 8,
        background: bg,
        color: "#fff",
        padding: "6px 8px",
        textAlign: "left",
        cursor: "pointer",
        overflow: "hidden",
      }}
      title={`${formatStatus(appointment.status)} · ${naiveTimestampToHm(appointment.scheduledAt)}`}
    >
      <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>
        {naiveTimestampToHm(appointment.scheduledAt)} · {formatStatus(appointment.status)}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.2, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {formatGridShortLabel(appointment) || `#${appointment.id}`}
      </div>
    </button>
  );
}

import React from "react";
import type { ScheduledDoctor, Appointment, TimeSlot } from "../appointments/types";
import type { AppointmentBlockGeometry } from "./AppointmentBlockV2";
import AppointmentBlockV2 from "./AppointmentBlockV2";
import { formatDoctorName } from "../appointments/formatters";

type DoctorColumnV2Props = {
  doctor: ScheduledDoctor;
  timeSlots: TimeSlot[];
  slotHeightPx: number;
  columnHeightPx: number;
  blocks: AppointmentBlockGeometry[];
  onCellClick: (doctor: ScheduledDoctor, slotLabel: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
};

export default function DoctorColumnV2({
  doctor,
  timeSlots,
  slotHeightPx,
  columnHeightPx,
  blocks,
  onCellClick,
  onAppointmentClick,
}: DoctorColumnV2Props) {
  return (
    <div style={{ minWidth: 220, borderLeft: "1px solid #e5e7eb", background: "#fff" }}>
      <div
        style={{
          height: 54,
          borderBottom: "1px solid #e5e7eb",
          padding: "8px 10px",
          fontSize: 13,
          fontWeight: 700,
          background: "#f8fafc",
          position: "sticky",
          top: 0,
          zIndex: 3,
        }}
      >
        {formatDoctorName(doctor) || doctor.name || `Эмч #${doctor.id}`}
      </div>

      <div style={{ position: "relative", height: columnHeightPx }}>
        {timeSlots.map((slot, idx) => (
          <button
            key={`${doctor.id}-${slot.label}-${idx}`}
            type="button"
            onClick={() => onCellClick(doctor, slot.label)}
            style={{
              position: "absolute",
              top: idx * slotHeightPx,
              left: 0,
              right: 0,
              height: slotHeightPx,
              border: "none",
              borderTop: "1px solid #f1f5f9",
              background: idx % 2 === 0 ? "#ffffff" : "#fcfcfd",
              cursor: "pointer",
            }}
          />
        ))}

        {blocks.map((block) => (
          <AppointmentBlockV2 key={block.appointment.id} block={block} onClick={onAppointmentClick} />
        ))}
      </div>
    </div>
  );
}

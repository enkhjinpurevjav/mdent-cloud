import React from "react";
import type { Appointment, ScheduledDoctor, TimeSlot } from "../appointments/types";
import DoctorColumnV2 from "./DoctorColumnV2";
import type { AppointmentBlockGeometry } from "./AppointmentBlockV2";

const EMPTY_BLOCKS: AppointmentBlockGeometry[] = [];

type AppointmentsV2GridProps = {
  doctors: ScheduledDoctor[];
  timeSlots: TimeSlot[];
  slotHeightPx: number;
  columnHeightPx: number;
  blocksByDoctorId: Record<number, AppointmentBlockGeometry[]>;
  onCellClick: (doctor: ScheduledDoctor, slotLabel: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
};

function AppointmentsV2Grid({
  doctors,
  timeSlots,
  slotHeightPx,
  columnHeightPx,
  blocksByDoctorId,
  onCellClick,
  onAppointmentClick,
}: AppointmentsV2GridProps) {
  if (doctors.length === 0) {
    return (
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          background: "#fff",
          padding: 20,
          fontSize: 13,
          color: "#64748b",
        }}
      >
        Сонгосон өдөрт ажиллах эмчийн хуваарь алга.
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", minWidth: 840 }}>
          <div style={{ minWidth: 70, borderRight: "1px solid #e5e7eb", background: "#f8fafc" }}>
            <div style={{ height: 54, borderBottom: "1px solid #e5e7eb" }} />
            <div style={{ position: "relative", height: columnHeightPx }}>
              {timeSlots.map((slot, idx) => (
                <div
                  key={`time-${slot.label}-${idx}`}
                  style={{
                    position: "absolute",
                    top: idx * slotHeightPx,
                    left: 0,
                    right: 0,
                    height: slotHeightPx,
                    borderTop: "1px solid #f1f5f9",
                    fontSize: 11,
                    color: "#64748b",
                    paddingTop: 4,
                    textAlign: "center",
                  }}
                >
                  {slot.label}
                </div>
              ))}
            </div>
          </div>

          {doctors.map((doctor) => (
            <DoctorColumnV2
              key={doctor.id}
              doctor={doctor}
              timeSlots={timeSlots}
              slotHeightPx={slotHeightPx}
              columnHeightPx={columnHeightPx}
              blocks={blocksByDoctorId[doctor.id] || EMPTY_BLOCKS}
              onCellClick={onCellClick}
              onAppointmentClick={onAppointmentClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default React.memo(AppointmentsV2Grid, (prev, next) => {
  return (
    prev.doctors === next.doctors &&
    prev.timeSlots === next.timeSlots &&
    prev.slotHeightPx === next.slotHeightPx &&
    prev.columnHeightPx === next.columnHeightPx &&
    prev.blocksByDoctorId === next.blocksByDoctorId &&
    prev.onCellClick === next.onCellClick &&
    prev.onAppointmentClick === next.onAppointmentClick
  );
});

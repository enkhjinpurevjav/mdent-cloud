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
  fullSlotLabelsByDoctorId: Record<number, Record<string, true>>;
  onCellClick: (doctor: ScheduledDoctor, slotLabel: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
};

function AppointmentsV2Grid({
  doctors,
  timeSlots,
  slotHeightPx,
  columnHeightPx,
  blocksByDoctorId,
  fullSlotLabelsByDoctorId,
  onCellClick,
  onAppointmentClick,
}: AppointmentsV2GridProps) {
  if (doctors.length === 0) {
    return (
      <div
        style={{
          border: "1px solid #ddd",
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
    <div style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", minWidth: 840 }}>
          <div style={{ minWidth: 80, borderRight: "1px solid #ddd", background: "#fafafa" }}>
            <div
              style={{
                height: 41,
                borderBottom: "1px solid #ddd",
                padding: "8px",
                fontWeight: 700,
                fontSize: 12,
                background: "#f5f5f5",
                position: "sticky",
                left: 0,
                zIndex: 25,
              }}
            >
              Цаг
            </div>
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
                    borderBottom: "1px solid #f0f0f0",
                    fontSize: 11,
                    color: "#4b5563",
                    paddingLeft: 6,
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: idx % 2 === 0 ? "#fafafa" : "#ffffff",
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
              fullSlotLabels={fullSlotLabelsByDoctorId[doctor.id]}
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
    prev.fullSlotLabelsByDoctorId === next.fullSlotLabelsByDoctorId &&
    prev.onCellClick === next.onCellClick &&
    prev.onAppointmentClick === next.onAppointmentClick
  );
});

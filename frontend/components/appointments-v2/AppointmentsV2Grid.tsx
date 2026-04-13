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
  slotOccupancyByDoctorId: Record<number, Record<string, number>>;
  onCellClick: (doctor: ScheduledDoctor, slotLabel: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  canDragAppointment: (appointment: Appointment) => boolean;
  pendingSaveId: number | null;
  activeDragAppointmentId: number | null;
  invalidDragAppointmentId: number | null;
  dragPreviewDoctorId: number | null;
  dragPreviewSlotLabels: string[];
  onAppointmentMouseDown: (
    event: React.MouseEvent<HTMLButtonElement | HTMLDivElement>,
    appointment: Appointment,
    mode: "move" | "resize"
  ) => void;
  disableAppointmentClicks: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
};

function AppointmentsV2Grid({
  doctors,
  timeSlots,
  slotHeightPx,
  columnHeightPx,
  blocksByDoctorId,
  slotOccupancyByDoctorId,
  onCellClick,
  onAppointmentClick,
  canDragAppointment,
  pendingSaveId,
  activeDragAppointmentId,
  invalidDragAppointmentId,
  dragPreviewDoctorId,
  dragPreviewSlotLabels,
  onAppointmentMouseDown,
  disableAppointmentClicks,
  scrollContainerRef,
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
      <div
        ref={scrollContainerRef}
        style={{
          overflow: "auto",
          maxHeight: "calc(100vh - 240px)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ display: "flex", minWidth: 840 }}>
          <div
            style={{
              minWidth: 80,
              borderRight: "1px solid #ddd",
              background: "#fafafa",
              position: "sticky",
              left: 0,
              zIndex: 20,
            }}
          >
            <div
              style={{
                height: 41,
                borderBottom: "1px solid #ddd",
                padding: "8px",
                fontWeight: 700,
                fontSize: 12,
                background: "#f5f5f5",
                position: "sticky",
                top: 0,
                left: 0,
                zIndex: 40,
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
              slotOccupancyByLabel={slotOccupancyByDoctorId[doctor.id]}
              onCellClick={onCellClick}
              onAppointmentClick={onAppointmentClick}
              canDragAppointment={canDragAppointment}
              pendingSaveId={pendingSaveId}
              activeDragAppointmentId={activeDragAppointmentId}
              invalidDragAppointmentId={invalidDragAppointmentId}
              dragPreviewDoctorId={dragPreviewDoctorId}
              dragPreviewSlotLabels={dragPreviewSlotLabels}
              onAppointmentMouseDown={onAppointmentMouseDown}
              disableAppointmentClicks={disableAppointmentClicks}
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
    prev.slotOccupancyByDoctorId === next.slotOccupancyByDoctorId &&
    prev.onCellClick === next.onCellClick &&
    prev.onAppointmentClick === next.onAppointmentClick &&
    prev.canDragAppointment === next.canDragAppointment &&
    prev.pendingSaveId === next.pendingSaveId &&
    prev.activeDragAppointmentId === next.activeDragAppointmentId &&
    prev.invalidDragAppointmentId === next.invalidDragAppointmentId &&
    prev.dragPreviewDoctorId === next.dragPreviewDoctorId &&
    prev.dragPreviewSlotLabels === next.dragPreviewSlotLabels &&
    prev.onAppointmentMouseDown === next.onAppointmentMouseDown &&
    prev.disableAppointmentClicks === next.disableAppointmentClicks &&
    prev.scrollContainerRef === next.scrollContainerRef
  );
});

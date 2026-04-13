import React from "react";
import type { ScheduledDoctor, Appointment, TimeSlot } from "../appointments/types";
import type { AppointmentBlockGeometry } from "./AppointmentBlockV2";
import AppointmentBlockV2 from "./AppointmentBlockV2";
import { formatDoctorName } from "../appointments/formatters";
import { isTimeWithinRange } from "../appointments/time";

const SLOT_HIGHLIGHT_INSET_PX = 999;

type DoctorColumnV2Props = {
  doctor: ScheduledDoctor;
  timeSlots: TimeSlot[];
  slotHeightPx: number;
  columnHeightPx: number;
  blocks: AppointmentBlockGeometry[];
  slotOccupancyByLabel?: Record<string, number>;
  onCellClick: (doctor: ScheduledDoctor, slotLabel: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
};

function DoctorColumnV2({
  doctor,
  timeSlots,
  slotHeightPx,
  columnHeightPx,
  blocks,
  slotOccupancyByLabel,
  onCellClick,
  onAppointmentClick,
}: DoctorColumnV2Props) {
  const isNonWorkingSlot = React.useCallback(
    (slot: TimeSlot) => {
      const schedules = doctor.schedules || [];
      const slotTimeStr = slot.label;
      const isWorkingHour = schedules.some((s) =>
        isTimeWithinRange(slotTimeStr, s.startTime, s.endTime)
      );
      const weekdayIndex = slot.start.getUTCDay();
      const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;
      const isWeekendLunch = isWeekend && isTimeWithinRange(slotTimeStr, "14:00", "15:00");
      return !isWorkingHour || isWeekendLunch;
    },
    [doctor]
  );

  const handleGridClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const clampedY = Math.max(0, Math.min(y, columnHeightPx - 1));
      const slotIndex = Math.floor(clampedY / slotHeightPx);
      const slot = timeSlots[slotIndex];
      if (!slot) return;
      if (isNonWorkingSlot(slot)) return;
      onCellClick(doctor, slot.label);
    },
    [doctor, timeSlots, slotHeightPx, columnHeightPx, onCellClick, isNonWorkingSlot]
  );

  return (
    <div style={{ minWidth: 180, borderLeft: "1px solid #f0f0f0", background: "#fff" }}>
      <div
        style={{
          height: 41,
          borderBottom: "1px solid #ddd",
          padding: "8px",
          fontSize: 12,
          fontWeight: 700,
          background: "#f5f5f5",
          position: "sticky",
          top: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {formatDoctorName(doctor) || doctor.name || `Эмч #${doctor.id}`}
      </div>

      <div style={{ position: "relative", height: columnHeightPx }} onClick={handleGridClick}>
        {timeSlots.map((slot, idx) => {
          const occupancy = slotOccupancyByLabel?.[slot.label] ?? 0;
          const isFull = occupancy >= 2;
          const isOverCapacity = occupancy > 2;
          const nonWorking = isNonWorkingSlot(slot);
          return (
            <div
              key={`${doctor.id}-${slot.label}`}
              style={{
                position: "absolute",
                top: idx * slotHeightPx,
                left: 0,
                right: 0,
                height: slotHeightPx,
                borderBottom: "1px solid #f0f0f0",
                background: nonWorking
                  ? "#ffc26b"
                  : idx % 2 === 0
                    ? "#ffffff"
                    : "#fafafa",
                cursor: nonWorking || isFull ? "not-allowed" : "pointer",
                boxShadow: isOverCapacity
                  ? `inset 0 0 0 ${SLOT_HIGHLIGHT_INSET_PX}px rgba(220, 38, 38, 0.24)`
                  : isFull
                    ? `inset 0 0 0 ${SLOT_HIGHLIGHT_INSET_PX}px rgba(100, 116, 139, 0.14)`
                    : undefined,
              }}
            >
              {isOverCapacity ? (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#991b1b",
                  }}
                >
                  3+
                </span>
              ) : isFull ? (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#334155",
                  }}
                >
                  2/2
                </span>
              ) : null}
            </div>
          );
        })}

        {blocks.map((block) => (
          <AppointmentBlockV2 key={block.appointment.id} block={block} onClick={onAppointmentClick} />
        ))}
      </div>
    </div>
  );
}

export default React.memo(DoctorColumnV2, (prev, next) => {
  return (
    prev.doctor === next.doctor &&
    prev.timeSlots === next.timeSlots &&
    prev.slotHeightPx === next.slotHeightPx &&
    prev.columnHeightPx === next.columnHeightPx &&
    prev.blocks === next.blocks &&
    prev.slotOccupancyByLabel === next.slotOccupancyByLabel &&
    prev.onCellClick === next.onCellClick &&
    prev.onAppointmentClick === next.onAppointmentClick
  );
});

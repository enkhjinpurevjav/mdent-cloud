import { useMemo } from "react";
import type { Appointment, ScheduledDoctor, TimeSlot } from "../types";
import { naiveToFakeUtcDate } from "../../../utils/businessTime";

export type DraftAppointmentChange = {
  scheduledAt: string;
  endAt: string | null;
  doctorId: number | null;
};

export type TimeSlotLayout = {
  top: number;
  slotStartMin: number;
  slotStart: Date;
  slotEnd: Date;
  label: string;
};

export type AppointmentBlockLayout = {
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
  hasOverlap: boolean;
  lane: 0 | 1;
};

export type GridColumnRenderData = {
  doctorAppointments: Appointment[];
  appointmentsBySlotIndex: Record<number, Appointment[]>;
  blockLayoutByAppointmentId: Record<number, AppointmentBlockLayout>;
};

type UseAppointmentsGridDerivedParams = {
  gridDoctors: ScheduledDoctor[];
  visibleAppointments: Appointment[];
  draftEdits: Record<number, DraftAppointmentChange>;
  timeSlots: TimeSlot[];
  firstSlot: Date;
  lastSlot: Date;
  totalMinutes: number;
  columnHeightPx: number;
  laneById: Record<number, 0 | 1>;
  slotMinutes: number;
};

export function useAppointmentsGridDerived({
  gridDoctors,
  visibleAppointments,
  draftEdits,
  timeSlots,
  firstSlot,
  lastSlot,
  totalMinutes,
  columnHeightPx,
  laneById,
  slotMinutes,
}: UseAppointmentsGridDerivedParams) {
  const safeTotalMinutes = Math.max(1, totalMinutes);

  const slotHeightPx = useMemo(
    () => (slotMinutes / safeTotalMinutes) * columnHeightPx,
    [slotMinutes, safeTotalMinutes, columnHeightPx]
  );

  const timeSlotLayouts = useMemo<TimeSlotLayout[]>(() => {
    return timeSlots.map((slot) => {
      const slotStartMin = (slot.start.getTime() - firstSlot.getTime()) / 60000;
      return {
        top: (slotStartMin / safeTotalMinutes) * columnHeightPx,
        slotStartMin,
        slotStart: slot.start,
        slotEnd: slot.end,
        label: slot.label,
      };
    });
  }, [timeSlots, firstSlot, safeTotalMinutes, columnHeightPx]);

  const appointmentsByDoctorId = useMemo(() => {
    const grouped = new Map<number, Appointment[]>();
    for (const appointment of visibleAppointments) {
      if (appointment.doctorId == null) continue;
      const current = grouped.get(appointment.doctorId) ?? [];
      current.push(appointment);
      grouped.set(appointment.doctorId, current);
    }
    return grouped;
  }, [visibleAppointments]);

  const gridColumnRenderData = useMemo<Record<number, GridColumnRenderData>>(() => {
    const byDoctor: Record<number, GridColumnRenderData> = {};
    const dayStartMs = firstSlot.getTime();
    const dayEndMs = lastSlot.getTime();

    for (const doctor of gridDoctors) {
      const baseAppointments = appointmentsByDoctorId.get(doctor.id) ?? [];
      const draggedInAppointments = visibleAppointments.filter((appointment) => {
        if (appointment.doctorId === doctor.id) return false;
        return draftEdits[appointment.id]?.doctorId === doctor.id;
      });

      const doctorAppointments = [...baseAppointments, ...draggedInAppointments];
      const appointmentsBySlotIndex: Record<number, Appointment[]> = {};
      const blockLayoutByAppointmentId: Record<number, AppointmentBlockLayout> = {};

      const effectiveIntervals = new Map<
        number,
        {
          start: Date;
          end: Date;
        }
      >();
      const originalIntervals = new Map<
        number,
        {
          startMs: number;
          endMs: number;
        }
      >();

      for (const appointment of doctorAppointments) {
        const originalStartMs = naiveToFakeUtcDate(appointment.scheduledAt).getTime();
        const originalEndMs = appointment.endAt
          ? naiveToFakeUtcDate(appointment.endAt).getTime()
          : originalStartMs + slotMinutes * 60_000;
        originalIntervals.set(appointment.id, { startMs: originalStartMs, endMs: originalEndMs });
      }

      for (const appointment of doctorAppointments) {
        const draft = draftEdits[appointment.id];
        const effectiveDoctorId =
          draft && draft.doctorId !== undefined ? draft.doctorId : appointment.doctorId;
        if (effectiveDoctorId !== doctor.id) continue;

        const start = draft
          ? naiveToFakeUtcDate(draft.scheduledAt)
          : naiveToFakeUtcDate(appointment.scheduledAt);
        if (Number.isNaN(start.getTime())) continue;

        const end = draft && draft.endAt
          ? naiveToFakeUtcDate(draft.endAt)
          : appointment.endAt
            ? naiveToFakeUtcDate(appointment.endAt)
            : new Date(start.getTime() + slotMinutes * 60_000);

        effectiveIntervals.set(appointment.id, { start, end });
      }

      const overlapById: Record<number, boolean> = {};
      for (const appointment of doctorAppointments) {
        const interval = originalIntervals.get(appointment.id);
        if (!interval) continue;

        const startMs = interval.startMs;
        const endMs = interval.endMs;
        let hasOverlap = false;

        for (const other of doctorAppointments) {
          if (other.id === appointment.id) continue;
          const otherInterval = originalIntervals.get(other.id);
          if (!otherInterval) continue;
          const otherStartMs = otherInterval.startMs;
          const otherEndMs = otherInterval.endMs;
          if (startMs < otherEndMs && endMs > otherStartMs) {
            hasOverlap = true;
            break;
          }
        }

        overlapById[appointment.id] = hasOverlap;
      }

      for (const appointment of doctorAppointments) {
        const interval = effectiveIntervals.get(appointment.id);
        if (!interval) continue;

        const startMs = interval.start.getTime();
        const endMs = interval.end.getTime();

        const clampedStartMs = Math.max(startMs, dayStartMs);
        const clampedEndMs = Math.min(endMs, dayEndMs);
        const startMin = (clampedStartMs - dayStartMs) / 60000;
        const endMin = (clampedEndMs - dayStartMs) / 60000;
        if (endMin <= 0 || startMin >= safeTotalMinutes) continue;

        const lane = laneById[appointment.id] ?? 0;
        const hasOverlap = overlapById[appointment.id] ?? false;
        const widthPercent = hasOverlap ? 50 : 100;
        const leftPercent = hasOverlap ? (lane === 0 ? 0 : 50) : 0;

        blockLayoutByAppointmentId[appointment.id] = {
          top: (startMin / safeTotalMinutes) * columnHeightPx,
          height: ((endMin - startMin) / safeTotalMinutes) * columnHeightPx,
          leftPercent,
          widthPercent,
          hasOverlap,
          lane,
        };
      }

      for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex += 1) {
        const slot = timeSlots[slotIndex];
        const slotStartMs = slot.start.getTime();
        const slotEndMs = slot.end.getTime();
        appointmentsBySlotIndex[slotIndex] = doctorAppointments.filter((appointment) => {
          const interval = originalIntervals.get(appointment.id);
          if (!interval) return false;
          return interval.startMs < slotEndMs && interval.endMs > slotStartMs;
        });
      }

      byDoctor[doctor.id] = {
        doctorAppointments,
        appointmentsBySlotIndex,
        blockLayoutByAppointmentId,
      };
    }

    return byDoctor;
  }, [
    firstSlot,
    lastSlot,
    gridDoctors,
    appointmentsByDoctorId,
    visibleAppointments,
    draftEdits,
    timeSlots,
    laneById,
    slotMinutes,
    safeTotalMinutes,
    columnHeightPx,
  ]);

  return {
    slotHeightPx,
    timeSlotLayouts,
    appointmentsByDoctorId,
    gridColumnRenderData,
  };
}

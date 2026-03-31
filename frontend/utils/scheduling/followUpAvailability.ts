import { naiveToFakeUtcDate, fakeUtcDateToNaive, toNaiveTimestamp } from "../../utils/businessTime";
import { getDayLabelMn, ymdRangeInclusive } from "./localDate";
import { buildFixedHeaderTimeLabels, getClinicWindowForDay, isTimeWithinRange } from "./timeLabels";

export type FollowUpSlotStatus = "available" | "booked" | "off";

export type FollowUpAvailability = {
  timeLabels: string[];
  days: Array<{
    date: string;
    dayLabel: string;
    slots: Array<{
      start: string;
      end: string;
      status: FollowUpSlotStatus;
      appointmentIds?: number[];
      branchId?: number;
      branchName?: string;
    }>;
  }>;
};

export type DoctorScheduleWindow = {
  id?: number;
  doctorId: number;
  branchId: number;
  branch?: { id: number; name: string } | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  note?: string | null;
};

export type AppointmentLite = {
  id: number;
  scheduledAt: string; // ISO or naive wall-clock ("YYYY-MM-DD HH:mm:ss")
  endAt: string | null;
  status: string;
};

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

export function buildFollowUpAvailability(opts: {
  dateFrom: string;
  dateTo: string;
  schedules: DoctorScheduleWindow[];
  appointments: AppointmentLite[];
  slotMinutes?: number; // default 30
  capacityPerSlot?: number; // default 2
}): FollowUpAvailability {
  const slotMinutes = opts.slotMinutes ?? 30;
  const capacityPerSlot = opts.capacityPerSlot ?? 2;

  // Fixed header for all days (09:00–21:00)
  const timeLabels = buildFixedHeaderTimeLabels(slotMinutes);

  const dates = ymdRangeInclusive(opts.dateFrom, opts.dateTo);

  // Pre-group schedules by date
  const schedulesByDate = new Map<string, DoctorScheduleWindow[]>();
  for (const s of opts.schedules || []) {
    if (!s?.date) continue;
    const list = schedulesByDate.get(s.date) || [];
    list.push(s);
    schedulesByDate.set(s.date, list);
  }

  // Pre-parse appointments once using fake-UTC dates so overlap arithmetic is
  // timezone-independent (browser TZ does not affect the result).
  const parsedAppointments = (opts.appointments || [])
    .filter((a) => a && a.status !== "cancelled")
    .map((a) => {
      const start = naiveToFakeUtcDate(a.scheduledAt);
      const end =
        a.endAt && !Number.isNaN(naiveToFakeUtcDate(a.endAt).getTime())
          ? naiveToFakeUtcDate(a.endAt)
          : new Date(start.getTime() + slotMinutes * 60_000);

      return {
        id: a.id,
        status: a.status,
        start,
        end,
      };
    })
    .filter((x) => !Number.isNaN(x.start.getTime()) && !Number.isNaN(x.end.getTime()) && x.end > x.start);

  const days = dates.map((ymd) => {
    const dayLabel = getDayLabelMn(ymd);
    const daySchedules = schedulesByDate.get(ymd) || [];

    const clinicWindow = getClinicWindowForDay(ymd);

    // Doctor cannot work at multiple branches on the same day;
    // derive the day's branch from the first schedule (if any).
    const dayBranchId: number | undefined = daySchedules[0]?.branchId;
    const dayBranchName: string | undefined = daySchedules[0]?.branch?.name;

    const slots = timeLabels.map((hm) => {
      // Use "hm" as slot start label.
      // Note: last header label is 21:00; treat that as a display label but it should not be bookable as a start.
      // We'll still generate a slot for it; UI can render it and it will naturally be OFF because end goes beyond window.
      // Build naive timestamp strings for this slot so the UI and backend agree
      // on wall-clock time without any timezone shift.
      const slotStart = toNaiveTimestamp(ymd, hm);
      const slotStartFake = naiveToFakeUtcDate(slotStart);
      const slotEndFake   = new Date(slotStartFake.getTime() + slotMinutes * 60_000);
      const slotEnd = fakeUtcDateToNaive(slotEndFake);

      const slotStartStr = slotStart;
      const slotEndStr   = slotEnd;

      // If no schedules for that day => whole day OFF (Option 3A behavior)
      if (daySchedules.length === 0) {
        return { start: slotStartStr, end: slotEndStr, status: "off" as const };
      }

      // Outside clinic window => OFF (weekend 10–19 rule)
      // Use hm label for comparisons: start inclusive, end exclusive
      if (!isTimeWithinRange(hm, clinicWindow.start, clinicWindow.end)) {
        return { start: slotStartStr, end: slotEndStr, status: "off" as const };
      }

      // Must be within at least one schedule window
      const withinAnySchedule = daySchedules.some((s) =>
        isTimeWithinRange(hm, s.startTime, s.endTime)
      );
      if (!withinAnySchedule) {
        return { start: slotStartStr, end: slotEndStr, status: "off" as const };
      }

    

      // Count overlaps using fake-UTC dates (timezone-independent arithmetic)
      const ids: number[] = [];
      for (const a of parsedAppointments) {
        if (overlaps(a.start, a.end, slotStartFake, slotEndFake)) {
          ids.push(a.id);
        }
      }

      // ✅ NEW RULE:
      // Any overlap means the slot is booked.
      // Keep up to capacityPerSlot ids so UI can split when 2.
      if (ids.length > 0) {
        return {
          start: slotStartStr,
          end: slotEndStr,
          status: "booked" as const,
          appointmentIds: ids.slice(0, capacityPerSlot),
          branchId: dayBranchId,
          branchName: dayBranchName,
        };
      }

      return {
        start: slotStartStr,
        end: slotEndStr,
        status: "available" as const,
        branchId: dayBranchId,
        branchName: dayBranchName,
      };
    });

    return { date: ymd, dayLabel, slots };
  });

  return { timeLabels, days };
}

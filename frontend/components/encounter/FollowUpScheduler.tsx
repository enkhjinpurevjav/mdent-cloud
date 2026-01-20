import React, { useMemo, useState, useEffect } from "react";
import { formatGridShortLabel } from "../../utils/scheduling";

type FollowUpAvailability = {
  days: Array<{
    date: string;
    dayLabel: string;
    slots: Array<{
      start: string;
      end: string;
      status: "available" | "booked" | "off";
      appointmentIds?: number[];
      appointmentId?: number; // backward compat (unused)
    }>;
  }>;
  timeLabels: string[];
};

type AppointmentLiteForDetails = {
  id: number;
  status: string;
  scheduledAt: string;
  endAt: string | null;
  patientName: string | null;
  patientOvog?: string | null;
  patient?: {
    name: string;
    ovog?: string | null;
    patientBook?: { bookNumber?: string | null } | null;
  } | null;
};

type FollowUpSchedulerProps = {
  showFollowUpScheduler: boolean;
  followUpDateFrom: string;
  followUpDateTo: string;
  followUpSlotMinutes: number;

  followUpAvailability: FollowUpAvailability | null;
  followUpLoading: boolean;
  followUpError: string;
  followUpSuccess: string;
  followUpBooking: boolean;

  followUpAppointments?: AppointmentLiteForDetails[];
  followUpNoSchedule?: boolean;

  onToggleScheduler: (checked: boolean) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onSlotMinutesChange: (minutes: number) => void;
  onBookAppointment: (slotStart: string, durationMinutes?: number) => void;
  onQuickCreate?: (params: { date: string; time: string; durationMinutes: number }) => void;
  refreshGrid?: () => void;
  onUpdateFollowUpAvailability?: (updated: FollowUpAvailability) => void;
};

function getHmFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toTimeString().substring(0, 5);
}

export default function FollowUpScheduler({
  showFollowUpScheduler,
  followUpDateFrom,
  followUpDateTo,
  followUpSlotMinutes,
  followUpAvailability,
  followUpLoading,
  followUpError,
  followUpSuccess,
  followUpBooking,
  followUpAppointments = [],
  followUpNoSchedule = false,
  onToggleScheduler,
  onDateFromChange,
  onDateToChange,
  onSlotMinutesChange,
  onBookAppointment,
  onQuickCreate,
  refreshGrid,
  onUpdateFollowUpAvailability,
}: FollowUpSchedulerProps) {
  const [localFollowUpAvailability, setLocalFollowUpAvailability] = useState<FollowUpAvailability | null>(
    followUpAvailability
  );

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsDate, setDetailsDate] = useState<string>("");
  const [detailsTime, setDetailsTime] = useState<string>("");
  const [detailsAppointmentIds, setDetailsAppointmentIds] = useState<number[]>([]);

  const [quickDate, setQuickDate] = useState<string>(followUpDateFrom);
  const [quickTime, setQuickTime] = useState<string>("09:00");
  const [quickDuration, setQuickDuration] = useState<number>(30);

  const [slotModalOpen, setSlotModalOpen] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  useEffect(() => {
    setLocalFollowUpAvailability(followUpAvailability);
  }, [followUpAvailability]);

  const apptById = useMemo(() => {
    const map = new Map<number, AppointmentLiteForDetails>();
    for (const a of followUpAppointments) {
      map.set(a.id, a);
    }
    return map;
  }, [followUpAppointments]);

  const detailsAppointments = useMemo(() => {
    return detailsAppointmentIds.map((id) => apptById.get(id)).filter(Boolean) as AppointmentLiteForDetails[];
  }, [detailsAppointmentIds, apptById]);

  const handleSlotSelection = (slotStart: string) => {
    setSlotModalOpen(true);
    setSelectedSlot(slotStart);
  };

  const handleBookedSlotClick = (appointmentIds: number[], date: string, time: string) => {
    setDetailsAppointmentIds(appointmentIds);
    setDetailsDate(date);
    setDetailsTime(time);
    setDetailsOpen(true);
  };

  const handleDurationSelect = (durationMinutes: number) => {
    if (!selectedSlot || !localFollowUpAvailability) return;

    const updatedDays = localFollowUpAvailability.days.map((day) => ({
      ...day,
      slots: day.slots.map((slot) =>
        slot.start === selectedSlot
          ? { ...slot, status: "booked" }
          : slot
      ),
    }));

    const updatedAvailability = { ...localFollowUpAvailability, days: updatedDays };

    setLocalFollowUpAvailability(updatedAvailability);
    onUpdateFollowUpAvailability?.(updatedAvailability);

    setSlotModalOpen(false);
    setSelectedSlot("");
    onBookAppointment(selectedSlot, durationMinutes);
  };

  const renderGrid = () => {
    if (!localFollowUpAvailability || !localFollowUpAvailability.days?.length) return null;

    const { days, timeLabels } = localFollowUpAvailability;
    return (
      <div style={{ overflowX: "auto", marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "white" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "center", background: "#f9fafb", padding: 8, borderBottom: "2px solid #d1d5db", borderRight: "1px solid #e5e7eb", fontWeight: "bold" }}>
                Огноо
              </th>
              {timeLabels.map((timeLabel) => (
                <th key={timeLabel} style={{ textAlign: "center", background: "#f9fafb", borderBottom: "1px solid #d1d5db", borderRight: "1px solid #e5e7eb", padding: 8, fontWeight: "bold" }}>
                  {timeLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <td style={{ textAlign: "center", background: "#f9fafb", padding: 8, fontWeight: 500, borderBottom: "1px solid #e5e7eb" }}>
                  <div>{day.dayLabel}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>
                    {new Date(day.date).toLocaleDateString("mn-MN", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  </div>
                </td>
                {timeLabels.map((timeLabel) => {
                  const slot = day.slots?.find((s) => getHmFromIso(s.start) === timeLabel);
                  if (!slot) {
                    return <td key={`${day.date}-${timeLabel}`} style={{ textAlign: "center", background: "#f9fafb", padding: 8, borderBottom: "1px solid #e5e7eb" }}>–</td>;
                  }
                  if (slot.status === "off") {
                    return <td key={`${day.date}-${timeLabel}`} style={{ textAlign: "center", background: "#f3f4f6", color: "#9ca3af", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Хаалттай</td>;
                  }
                  if (slot.status === "booked") {
                    return (
                      <td key={`${day.date}-${timeLabel}`} style={{ textAlign: "center", background: "#fee2e2", cursor: "pointer", fontWeight: 600, padding: 8, borderBottom: "1px solid #e5e7eb" }} onClick={() =>
                        handleBookedSlotClick(slot.appointmentIds || [], day.date, timeLabel)
                      }>
                        Захиалгатай
                      </td>
                    );
                  }
                  return (
                    <td key={`${day.date}-${timeLabel}`} style={{ textAlign: "center", background: "#ccffcc", cursor: followUpBooking ? "not-allowed" : "pointer", padding: 8, borderBottom: "1px solid #e5e7eb" }} onClick={() => handleSlotSelection(slot.start)}>
                      Чөлөөтэй
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 16, padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <label>
          <input type="checkbox" checked={showFollowUpScheduler} disabled={followUpLoading} onChange={(e) => onToggleScheduler(e.target.checked)} />
          <span>Давтан үзлэгийн цаг авах</span>
        </label>
        {followUpLoading && <span style={{ fontSize: 12, color: "#6b7280" }}>(ачаалж байна...)</span>}
        {followUpError && <span style={{ fontSize: 12, color: "#b91c1c" }}>{followUpError}</span>}
        {followUpSuccess && <span style={{ fontSize: 12, color: "#16a34a" }}>{followUpSuccess}</span>}
      </div>
      {showFollowUpScheduler && renderGrid()}
    </div>
  );
}

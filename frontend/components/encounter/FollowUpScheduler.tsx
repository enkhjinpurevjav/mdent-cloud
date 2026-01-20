import React, { useMemo, useState, useEffect } from "react";

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
  const [detailsDate, setDetailsDate] = useState("");
  const [detailsTime, setDetailsTime] = useState("");
  const [detailsAppointmentIds, setDetailsAppointmentIds] = useState<number[]>([]);

  const [quickDate, setQuickDate] = useState(followUpDateFrom);
  const [quickTime, setQuickTime] = useState("09:00");
  const [quickDuration, setQuickDuration] = useState(30);

  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");

  useEffect(() => {
    setLocalFollowUpAvailability(followUpAvailability);
  }, [followUpAvailability]);

  const apptById = useMemo(() => {
    const map = new Map<number, AppointmentLiteForDetails>();
    followUpAppointments.forEach((a) => {
      if (a) map.set(a.id, a);
    });
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
    if (!localFollowUpAvailability) return null;

    const { days, timeLabels } = localFollowUpAvailability;

    return (
      <div style={{ overflowX: "auto", marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "white" }}>
          <thead>
            <tr>
              <th style={{ padding: 8 }}>Огноо</th>
              {timeLabels.map((timeLabel) => (
                <th key={timeLabel} style={{ textAlign: "center", padding: 8 }}>
                  {timeLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <td style={{ padding: 8 }}>
                  {day.dayLabel} — {day.date}
                </td>
                {timeLabels.map((timeLabel) => {
                  const slot = day.slots.find((s) => getHmFromIso(s.start) === timeLabel);
                  if (!slot) return <td key={timeLabel} style={{ background: "#eee" }}>—</td>;
                  if (slot.status === "off") return <td key={timeLabel} style={{ background: "#eee" }}>Хаалттай</td>;
                  if (slot.status === "booked") return <td key={timeLabel} style={{ background: "#feb2b2", cursor: "pointer" }} onClick={() => handleBookedSlotClick(slot.appointmentIds || [], day.date, timeLabel)}>Захиалгатай</td>;
                  return <td key={timeLabel} style={{ background: "#c6f6d5", cursor: "pointer" }} onClick={() => handleSlotSelection(slot.start)}>Чөлөөтэй</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <input type="checkbox" checked={showFollowUpScheduler} onChange={(e) => onToggleScheduler(e.target.checked)} />
        <span>Давтан үзлэгийн цаг авах</span>
      </div>
      {followUpError && <p style={{ color: "red" }}>Error: {followUpError}</p>}
      {showFollowUpScheduler && renderGrid()}
      {/* Slot Modal */}
      {slotModalOpen && (
        <div>
          <div>
            <h3>Choose Slot Duration for {selectedSlot}</h3>
            {[30, 60, 90].map((duration) => (
              <button key={duration} onClick={() => handleDurationSelect(duration)}>
                {duration} minutes
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from "react";
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

  // Booking handlers (required)
  onBookAppointment: (slotStart: string, durationMinutes: number) => void;

  // Optional handler for manual (quick) booking
  onQuickCreate?: (params: { date: string; time: string; durationMinutes: number }) => void;

  // Refresh the grid availability (Optional depending on parent implementation)
  refreshGrid?: () => void;
};

// Utility to convert ISO to HH:mm
function getHmFromIso(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toTimeString().substring(0, 5);
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
}: FollowUpSchedulerProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsDate, setDetailsDate] = useState("");
  const [detailsTime, setDetailsTime] = useState("");
  const [detailsAppointmentIds, setDetailsAppointmentIds] = useState<number[]>(
    []
  );

  const [durationModalOpen, setDurationModalOpen] = useState(false);
  const [durationModalSlotStart, setDurationModalSlotStart] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(30);

  const [quickDate, setQuickDate] = useState<string>(followUpDateFrom);
  const [quickTime, setQuickTime] = useState<string>("09:00");
  const [quickDuration, setQuickDuration] = useState<number>(30);

  const apptById = useMemo(() => {
    const map = new Map<number, AppointmentLiteForDetails>();
    for (const a of followUpAppointments) map.set(a.id, a);
    return map;
  }, [followUpAppointments]);

  const detailsAppointments = useMemo(() => {
    return detailsAppointmentIds
      .map((id) => apptById.get(id))
      .filter(Boolean);
  }, [detailsAppointmentIds, apptById]);

  const handleSlotClick = (slotStart: string) => {
    setDurationModalOpen(true);
    setDurationModalSlotStart(slotStart);
    setSelectedDuration(followUpSlotMinutes); // Default to the configured slot duration
  };

  const renderDurationModal = () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(0,0,0,0.3)",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "white",
          padding: 20,
          borderRadius: 10,
          boxShadow: "0px 8px 16px rgba(0,0,0,0.25)",
        }}
      >
        <h3>Давтан үзлэгийн үргэлжлэх хугацаа сонгоно уу</h3>
        <p>Эхлэх цаг: {getHmFromIso(durationModalSlotStart)}</p>
        <p>
          Дуусах цаг:{" "}
          {new Date(
            new Date(durationModalSlotStart).getTime() +
              selectedDuration * 60_000
          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>

        <select
          onChange={(e) => setSelectedDuration(Number(e.target.value))}
          value={selectedDuration}
        >
          <option value={30}>30 минут</option>
          <option value={60}>1 цаг</option>
          <option value={90}>1 цаг 30 минут</option>
        </select>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button
            onClick={() => {
              onBookAppointment(durationModalSlotStart, selectedDuration);
              setDurationModalOpen(false);
              if (refreshGrid) refreshGrid(); // Ensure the parent refreshes the grid
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 4,
              background: "#2563eb",
              color: "white",
            }}
          >
            Батлах
          </button>
          <button
            onClick={() => setDurationModalOpen(false)}
            style={{
              padding: "8px 12px",
              borderRadius: 4,
              background: "#d1d5db",
              color: "#111827",
            }}
          >
            Цуцлах
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
      {/* Follow-up Scheduler Toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showFollowUpScheduler}
            disabled={followUpLoading}
            onChange={(e) => onToggleScheduler(e.target.checked)}
          />
          Давтан үзлэгийн цаг авах
        </label>
        {followUpLoading && <span style={{ fontSize: 12, color: "#6b7280" }}>(ачаалж байна...)</span>}
        {followUpError && <span style={{ fontSize: 12, color: "#b91c1c" }}>{followUpError}</span>}
        {followUpSuccess && <span style={{ fontSize: 12, color: "#16a34a" }}>{followUpSuccess}</span>}
      </div>

      {/* Grid and Modals */}
      {showFollowUpScheduler && followUpAvailability && (
        <>
          {/* Availability grid */}
          <div style={{ border: "1px solid #d1d5db", borderRadius: 6, overflow: "auto", maxHeight: 400 }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Огноо</th>
                  {followUpAvailability.timeLabels.map((time) => (
                    <th key={time}>{time}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {followUpAvailability.days.map((day) => (
                  <tr key={day.date}>
                    <td>{day.date}</td>
                    {day.slots.map((slot) => (
                      <td
                        key={slot.start}
                        style={{
                          backgroundColor: slot.status === "available" ? "#ccffcc" : slot.status === "booked" ? "#ffcccc" : "#f9f9f9",
                        }}
                      >
                        {slot.status === "available" ? (
                          <button onClick={() => handleSlotClick(slot.start)}>Сонгох</button>
                        ) : (
                          <span>{slot.status === "booked" ? "Дүүрсэн" : "Хаалттай"}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Duration Modal */}
          {durationModalOpen && renderDurationModal()}
        </>
      )}

      {/* Quick-create UI if no schedule */}
      {followUpNoSchedule && (
        <div style={{ padding: 12, border: "1px solid #fde68a", borderRadius: 6, background: "#fffbe6" }}>
          <h4>Цагийн хуваарь алга</h4>
          <p>Гараар цаг оруулахыг хүсэж байна уу?</p>
          <div>
            <input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} />
            <input type="time" value={quickTime} onChange={(e) => setQuickTime(e.target.value)} />
            <select value={quickDuration} onChange={(e) => setQuickDuration(Number(e.target.value))}>
              <option value={15}>15 минут</option>
              <option value={30}>30 минут</option>
              <option value={45}>45 минут</option>
              <option value={60}>60 минут</option>
            </select>
            <button
              disabled={followUpBooking || !onQuickCreate}
              onClick={() => {
                onQuickCreate?.({ date: quickDate, time: quickTime, durationMinutes: quickDuration });
              }}
            >
              Гараар цаг үүсгэх
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

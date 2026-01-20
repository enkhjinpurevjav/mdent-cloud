import React, { useEffect, useMemo, useState } from "react";
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
}: FollowUpSchedulerProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsDate, setDetailsDate] = useState<string>("");
  const [detailsTime, setDetailsTime] = useState<string>("");
  const [detailsAppointmentIds, setDetailsAppointmentIds] = useState<number[]>([]);

  // Quick create UI (Option 3A)
  const [quickDate, setQuickDate] = useState<string>(followUpDateFrom);
  const [quickTime, setQuickTime] = useState<string>("09:00");
  const [quickDuration, setQuickDuration] = useState<number>(30);

  const [slotModalOpen, setSlotModalOpen] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

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


  const [localAvailability, setLocalAvailability] = useState<FollowUpAvailability | null>(followUpAvailability);

useEffect(() => {
  setLocalAvailability(followUpAvailability);
}, [followUpAvailability]);
  
  const handleDurationSelect = (durationMinutes: number) => {
  if (!selectedSlot || !localAvailability) return;

  // 1) Optimistically mark selected slot as booked in local state
  const updatedDays = localAvailability.days.map((day) => ({
    ...day,
    slots: day.slots.map((slot) =>
      slot.start === selectedSlot
        ? { ...slot, status: "booked" as const }
        : slot
    ),
  }));

  setLocalAvailability({ ...localAvailability, days: updatedDays });

  // 2) Call backend
  onBookAppointment(selectedSlot, durationMinutes);

  // 3) Close modal
  setSlotModalOpen(false);
  setSelectedSlot("");
};

  const renderGrid = () => {
    if (!localAvailability) return null;
const { days, timeLabels } = localAvailability;

    return (
      <div
        style={{
          overflowX: "auto",
          marginTop: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            background: "white",
          }}
        >
          <thead>
  <tr>
    <th
      style={{
        textAlign: "center",
        background: "#f9fafb",
        padding: 8,
        borderBottom: "2px solid #d1d5db",
        borderRight: "1px solid #e5e7eb",
        fontWeight: "bold",
      }}
    >
      Огноо
    </th>
    {/* Add Time Column Headers */}
    {timeLabels.map((timeLabel) => (
      <th
        key={timeLabel}
        style={{
          textAlign: "center",
          background: "#f9fafb",
          borderBottom: "1px solid #d1d5db",
          borderRight: "1px solid #e5e7eb",
          padding: 8,
          fontWeight: "bold",
        }}
      >
        {timeLabel}
      </th>
    ))}
  </tr>
</thead>
          <tbody>
  {days.map((day) => (
    <tr key={day.date}>
      {/* Date as the first column */}
      <td
        style={{
          padding: 8,
          textAlign: "center",
          background: "#f9fafb",
          fontWeight: 500,
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div>{day.dayLabel}</div>
        <div style={{ fontSize: 10, color: "#6b7280" }}>
          {new Date(day.date).toLocaleDateString("mn-MN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })}
        </div>
      </td>
      {/* Time slots as columns */}
      {timeLabels.map((timeLabel) => {
        const slot = day.slots.find((s) => getHmFromIso(s.start) === timeLabel);

        if (!slot) {
          return (
            <td
              key={`${day.date}-${timeLabel}`}
              style={{
                padding: 8,
                background: "#f9fafb",
                textAlign: "center",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              –
            </td>
          );
        }

        if (slot.status === "off") {
          return (
            <td
              key={`${day.date}-${timeLabel}`}
              style={{
                padding: 8,
                background: "#f3f4f6",
                color: "#9ca3af",
                textAlign: "center",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              -
            </td>
          );
        }

                if (slot.status === "booked") {
          const count = (slot.appointmentIds || []).length;

          return (
            <td
              key={`${day.date}-${timeLabel}`}
              style={{
                padding: 6,
                background: "#fee2e2",
                textAlign: "center",
                cursor: "pointer",
                fontWeight: 600,
                borderBottom: "1px solid #e5e7eb",
              }}
              onClick={() =>
                handleBookedSlotClick(slot.appointmentIds || [], day.date, timeLabel)
              }
            >
              {count <= 1 ? (
                // ✅ 1 appointment: show normal status text
                "Захиалгатай"
              ) : (
                // ✅ 2 appointments: split into 2 mini blocks, status text only
                <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 4 }}>
                  <div
                    style={{
                      padding: "4px 6px",
                      borderRadius: 6,
                      background: "#fecaca",
                      border: "1px solid #fca5a5",
                      fontSize: 11,
                    }}
                  >
                    Захиалгатай
                  </div>
                  <div
                    style={{
                      padding: "4px 6px",
                      borderRadius: 6,
                      background: "#fecaca",
                      border: "1px solid #fca5a5",
                      fontSize: 11,
                    }}
                  >
                    Захиалгатай
                  </div>
                </div>
              )}
            </td>
          );
        }

        return (
          <td
            key={`${day.date}-${timeLabel}`}
            style={{
              padding: 8,
              background: "#ccffcc",
              textAlign: "center",
              cursor: followUpBooking ? "not-allowed" : "pointer",
              borderBottom: "1px solid #e5e7eb",
            }}
            onClick={() => handleSlotSelection(slot.start)}
          >
            Сул
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
    <div
      style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <label>
          <input
            type="checkbox"
            checked={showFollowUpScheduler}
            disabled={followUpLoading}
            onChange={(e) => onToggleScheduler(e.target.checked)}
          />
          <span>Давтан үзлэгийн цаг авах</span>
        </label>

        {followUpLoading && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            (ачаалж байна...)
          </span>
        )}

        {followUpError && (
          <span style={{ fontSize: 12, color: "#b91c1c" }}>
            {followUpError}
          </span>
        )}

        {followUpSuccess && (
          <span style={{ fontSize: 12, color: "#16a34a" }}>
            {followUpSuccess}
          </span>
        )}
      </div>

      {showFollowUpScheduler && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 12,
              fontSize: 13,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <label>Эхлэх:</label>
              <input
                type="date"
                value={followUpDateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <label>Дуусах:</label>
              <input
                type="date"
                value={followUpDateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <label>Нэг цагийн үргэлжлэх хугацаа:</label>
              <select
                value={followUpSlotMinutes}
                onChange={(e) => onSlotMinutesChange(Number(e.target.value))}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              >
                <option value={30}>30 минут</option>
                <option value={60}>60 минут</option>
                <option value={90}>90 минут</option>
                <option value={120}>120 минут</option>
              </select>
            </div>
          </div>

          {followUpNoSchedule && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid #fde68a",
                background: "#fffbeb",
                color: "#92400e",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Эмчийн цагийн хуваарь тохируулаагүй байна
              </div>
              <div style={{ fontSize: 12 }}>Давтан үзлэгийн цагийг гарын авлагаар оруулна уу.</div>

              {/* Quick Create */}
              <div
                style={{ display: "flex", gap: 10, marginTop: 10, justifyContent: "space-between" }}
              >
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  style={{
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                  }}
                />
                <input
                  type="time"
                  value={quickTime}
                  onChange={(e) => setQuickTime(e.target.value)}
                  style={{
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                  }}
                />
                <select
                  value={quickDuration}
                  onChange={(e) => setQuickDuration(Number(e.target.value))}
                  style={{
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                  }}
                >
                  <option value={30}>30 минут</option>
                  <option value={60}>60 минут</option>
                  <option value={90}>90 минут</option>
                  <option value={120}>120 минут</option>
                </select>
                <button
                  type="button"
                  disabled={followUpBooking || !onQuickCreate}
                  onClick={() =>
                    onQuickCreate?.({ date: quickDate, time: quickTime, durationMinutes: quickDuration })
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "#2563eb",
                    border: "1px solid #2563eb",
                    color: "white",
                    cursor: followUpBooking ? "not-allowed" : "pointer",
                    fontWeight: 500,
                  }}
                >
                  Гараар цаг үүсгэх
                </button>
              </div>
            </div>
          )}

          {localAvailability && localAvailability.days.length > 0 && renderGrid()}
        </>
      )}
      {/* Render Details Modal */}
      {detailsOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
    onClick={() => setDetailsOpen(false)}
  >
    <div
      style={{
        minWidth: "400px",
        padding: 20,
        background: "white",
        borderRadius: 8,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h3>Батлагдсан цаг - {detailsDate} {detailsTime}</h3>
      <div>
        {detailsAppointments.length === 0 ? (
          <div>(Мэдээлэл олдсонгүй)</div>
        ) : (
          detailsAppointments.map((a) => (
            <div key={a.id}>
              <h4>{a.patientName}</h4>
              <p>Үеийн цаг: {new Date(a.scheduledAt).toLocaleTimeString()}</p>
            </div>
          ))
        )}
      </div>
      <button onClick={() => setDetailsOpen(false)}>Хаах</button>
    </div>
  </div>
)}

      {/* Duration Selection Modal */}
      {slotModalOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}
    onClick={() => {
      setSlotModalOpen(false);
      setSelectedSlot("");
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        minWidth: "400px",
        padding: "24px",
        background: "white",
        borderRadius: "12px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
        Цагийн үргэлжлэх хугацаа сонгох
      </h3>
      <p style={{ fontSize: 14 }}>Цаг: {selectedSlot ? getHmFromIso(selectedSlot) : ""}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "16px 0" }}>
        {[30, 60, 90, 120].map((duration) => (
          <button
            key={duration}
            onClick={() => handleDurationSelect(duration)}
            disabled={followUpBooking}
            style={{
              padding: "12px",
              borderRadius: 6,
              background: "#ecfdf3",
              border: "1px solid #16a34a",
              color: "#166534",
              cursor: followUpBooking ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {duration} минут
          </button>
        ))}
      </div>
      <button
        style={{
          padding: "8px 16px",
          borderRadius: 6,
          background: "#e5e7eb",
          color: "#374151",
          border: "1px solid #d1d5db",
          cursor: "pointer",
          fontWeight: 500,
        }}
        onClick={() => {
          setSlotModalOpen(false);
          setSelectedSlot("");
        }}
      >
        Болих
      </button>
    </div>
  </div>
)}
    </div>
  );
}

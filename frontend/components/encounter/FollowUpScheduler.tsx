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

  const handleDurationSelect = (durationMinutes: number) => {
    if (selectedSlot) {
      onBookAppointment(selectedSlot, durationMinutes);
      setSlotModalOpen(false);
      setSelectedSlot("");
    }
  };

  const renderGrid = () => {
    if (!followUpAvailability) return null;

    const { days, timeLabels } = followUpAvailability;

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
                  padding: 8,
                  borderBottom: "2px solid #d1d5db",
                  borderRight: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  fontWeight: 600,
                  textAlign: "center",
                  minWidth: 60,
                }}
              >
                Цаг
              </th>
              {days.map((day) => (
                <th
                  key={day.date}
                  style={{
                    padding: 8,
                    borderBottom: "2px solid #d1d5db",
                    borderRight: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    fontWeight: 600,
                    textAlign: "center",
                    minWidth: 80,
                  }}
                >
                  <div>{day.dayLabel}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, color: "#6b7280" }}>
                    {day.date}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeLabels.map((timeLabel, rowIndex) => (
              <tr key={timeLabel}>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #e5e7eb",
                    borderRight: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    fontWeight: 500,
                    textAlign: "center",
                  }}
                >
                  {timeLabel}
                </td>
                {days.map((day, dayIndex) => {
                  const slot = day.slots[rowIndex];
                  if (!slot) {
                    return (
                      <td
                        key={`${day.date}-${timeLabel}`}
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          borderRight: "1px solid #e5e7eb",
                          textAlign: "center",
                          background: "#f3f4f6",
                        }}
                      >
                        -
                      </td>
                    );
                  }

                  if (slot.status === "off") {
                    return (
                      <td
                        key={`${day.date}-${timeLabel}`}
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          borderRight: "1px solid #e5e7eb",
                          textAlign: "center",
                          background: "#f3f4f6",
                          color: "#9ca3af",
                        }}
                      >
                        -
                      </td>
                    );
                  }

                  if (slot.status === "booked") {
                    return (
                      <td
                        key={`${day.date}-${timeLabel}`}
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          borderRight: "1px solid #e5e7eb",
                          textAlign: "center",
                          background: "#fef3c7",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                        onClick={() =>
                          handleBookedSlotClick(
                            slot.appointmentIds || [],
                            day.date,
                            getHmFromIso(slot.start)
                          )
                        }
                      >
                        Дүүрсэн
                      </td>
                    );
                  }

                  // available slot
                  return (
                    <td
                      key={`${day.date}-${timeLabel}`}
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #e5e7eb",
                        borderRight: "1px solid #e5e7eb",
                        textAlign: "center",
                        background: "#dcfce7",
                        cursor: followUpBooking ? "not-allowed" : "pointer",
                        fontWeight: 500,
                      }}
                      onClick={() => {
                        if (!followUpBooking) {
                          handleSlotSelection(slot.start);
                        }
                      }}
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
                <option value={15}>15 минут</option>
                <option value={30}>30 минут</option>
                <option value={45}>45 минут</option>
                <option value={60}>60 минут</option>
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
                  <option value={15}>15 минут</option>
                  <option value={30}>30 минут</option>
                  <option value={45}>45 минут</option>
                  <option value={60}>60 минут</option>
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

          {followUpAvailability && followUpAvailability.days.length > 0 && renderGrid()}
        </>
      )}
      {/* Render Details Modal */}
      {detailsOpen && (
        <div
          onClick={() => setDetailsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              minWidth: "400px",
              maxWidth: "600px",
              padding: "24px",
              background: "white",
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
              Батлагдсан цаг - {detailsDate} {detailsTime}
            </h3>
            <div style={{ marginBottom: 16 }}>
              {detailsAppointments.length === 0 ? (
                <p style={{ color: "#6b7280", fontSize: 14 }}>
                  Мэдээлэл олдсонгүй
                </p>
              ) : (
                detailsAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    style={{
                      padding: 12,
                      marginBottom: 8,
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      background: "#f9fafb",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 500 }}>
                      {formatGridShortLabel(appt)}
                    </p>
                    <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#6b7280" }}>
                      Статус: {appt.status}
                    </p>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setDetailsOpen(false)}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                background: "#2563eb",
                border: "1px solid #2563eb",
                color: "white",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Хаах
            </button>
          </div>
        </div>
      )}

      {/* Duration Selection Modal */}
      {slotModalOpen && (
        <div
          onClick={() => {
            setSlotModalOpen(false);
            setSelectedSlot("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
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
            <p style={{ marginBottom: 16, fontSize: 14, color: "#6b7280" }}>
              Цаг: {selectedSlot ? getHmFromIso(selectedSlot) : ""}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              {[15, 30, 45, 60].map((duration) => (
                <button
                  key={duration}
                  onClick={() => handleDurationSelect(duration)}
                  disabled={followUpBooking}
                  style={{
                    padding: "16px",
                    borderRadius: 8,
                    background: "#f0f9ff",
                    border: "2px solid #0284c7",
                    color: "#0c4a6e",
                    cursor: followUpBooking ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 16,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!followUpBooking) {
                      e.currentTarget.style.background = "#0284c7";
                      e.currentTarget.style.color = "white";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f0f9ff";
                    e.currentTarget.style.color = "#0c4a6e";
                  }}
                >
                  {duration} минут
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setSlotModalOpen(false);
                setSelectedSlot("");
              }}
              style={{
                width: "100%",
                padding: "8px 16px",
                borderRadius: 6,
                background: "#e5e7eb",
                border: "1px solid #d1d5db",
                color: "#374151",
                cursor: "pointer",
                fontWeight: 500,
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

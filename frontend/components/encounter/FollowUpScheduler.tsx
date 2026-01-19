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

  // NEW: to show details list for booked slots (already loaded by page)
  followUpAppointments?: AppointmentLiteForDetails[];

  // NEW: Option 3A indicator (no schedules across range)
  followUpNoSchedule?: boolean;

  onToggleScheduler: (checked: boolean) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onSlotMinutesChange: (minutes: number) => void;
  onBookAppointment: (slotStart: string) => void;

  // NEW: Quick create when no schedule
  onQuickCreate?: (params: { date: string; time: string; durationMinutes: number }) => void;
};

function getHmFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toTimeString().substring(0, 5);
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

  const apptById = useMemo(() => {
    const m = new Map<number, AppointmentLiteForDetails>();
    for (const a of followUpAppointments) m.set(a.id, a);
    return m;
  }, [followUpAppointments]);

  const detailsAppointments = useMemo(() => {
    return detailsAppointmentIds
      .map((id) => apptById.get(id))
      .filter(Boolean) as AppointmentLiteForDetails[];
  }, [detailsAppointmentIds, apptById]);

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
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
          }}
        >
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
              <label style={{ fontWeight: 500 }}>Эхлэх:</label>
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
              <label style={{ fontWeight: 500 }}>Дуусах:</label>
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
              <label style={{ fontWeight: 500 }}>
                Нэг цагийн үргэлжлэх хугацаа:
              </label>
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

          {/* Option 3A: no schedule message + quick create */}
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
              <div style={{ marginBottom: 10 }}>
                Давтан үзлэгийн цагийг зөвхөн гараар (шууд цаг оруулах) үүсгэнэ.
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <label style={{ fontWeight: 600 }}>Огноо:</label>
                  <input
                    type="date"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    style={{
                      padding: "4px 6px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      fontSize: 12,
                      background: "white",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <label style={{ fontWeight: 600 }}>Эхлэх цаг:</label>
                  <input
                    type="time"
                    value={quickTime}
                    onChange={(e) => setQuickTime(e.target.value)}
                    style={{
                      padding: "4px 6px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      fontSize: 12,
                      background: "white",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <label style={{ fontWeight: 600 }}>Үргэлжлэх:</label>
                  <select
                    value={quickDuration}
                    onChange={(e) => setQuickDuration(Number(e.target.value))}
                    style={{
                      padding: "4px 6px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      fontSize: 12,
                      background: "white",
                    }}
                  >
                    <option value={15}>15 минут</option>
                    <option value={30}>30 минут</option>
                    <option value={45}>45 минут</option>
                    <option value={60}>60 минут</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={followUpBooking || !onQuickCreate}
                  onClick={() => onQuickCreate?.({ date: quickDate, time: quickTime, durationMinutes: quickDuration })}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    cursor: followUpBooking ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {followUpBooking ? "Захиалж байна..." : "Гараар цаг үүсгэх"}
                </button>
              </div>
            </div>
          )}

          {followUpAvailability && followUpAvailability.days.length > 0 && (
            <div
              style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: "400px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        position: "sticky",
                        left: 0,
                        top: 0,
                        background: "#f3f4f6",
                        padding: "8px",
                        border: "1px solid #d1d5db",
                        fontWeight: 600,
                        textAlign: "left",
                        zIndex: 3,
                        minWidth: "140px",
                      }}
                    >
                      Огноо
                    </th>
                    {followUpAvailability.timeLabels.map((time) => (
                      <th
                        key={time}
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "#f3f4f6",
                          padding: "8px",
                          border: "1px solid #d1d5db",
                          fontWeight: 600,
                          textAlign: "center",
                          zIndex: 2,
                          minWidth: "70px",
                        }}
                      >
                        {time}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {followUpAvailability.days.map((day) => {
                    const slotsByTime = new Map<string, any>();
                    day.slots.forEach((slot) => {
                      const slotTime = getHmFromIso(slot.start);
                      slotsByTime.set(slotTime, slot);
                    });

                    return (
                      <tr key={day.date}>
                        <td
                          style={{
                            position: "sticky",
                            left: 0,
                            background: "#ffffff",
                            padding: "8px",
                            border: "1px solid #d1d5db",
                            fontWeight: 500,
                            zIndex: 1,
                          }}
                        >
                          {day.date} {day.dayLabel}
                        </td>

                        {followUpAvailability.timeLabels.map((time) => {
                          const slot = slotsByTime.get(time);

                          if (!slot) {
                            return (
                              <td
                                key={time}
                                style={{
                                  padding: "8px",
                                  border: "1px solid #d1d5db",
                                  background: "#f9fafb",
                                  textAlign: "center",
                                }}
                              >
                                -
                              </td>
                            );
                          }

                          const isAvailable = slot.status === "available";
                          const isBooked = slot.status === "booked";

                          return (
                            <td
                              key={time}
                              style={{
                                padding: "4px",
                                border: "1px solid #d1d5db",
                                textAlign: "center",
                              }}
                            >
                              <button
                                type="button"
                                disabled={(!isAvailable && !isBooked) || followUpBooking}
                                onClick={() => {
                                  if (isAvailable) {
                                    onBookAppointment(slot.start);
                                    return;
                                  }
                                  if (isBooked) {
                                    setDetailsOpen(true);
                                    setDetailsDate(day.date);
                                    setDetailsTime(time);
                                    setDetailsAppointmentIds(slot.appointmentIds || []);
                                  }
                                }}
                                style={{
                                  width: "100%",
                                  padding: "6px 4px",
                                  borderRadius: 4,
                                  border: isAvailable
                                    ? "1px solid #16a34a"
                                    : "1px solid #d1d5db",
                                  background: isAvailable
                                    ? "#ecfdf3"
                                    : isBooked
                                    ? "#fee2e2"
                                    : "#f3f4f6",
                                  color: isAvailable
                                    ? "#166534"
                                    : isBooked
                                    ? "#991b1b"
                                    : "#6b7280",
                                  cursor:
                                    (isAvailable || isBooked) && !followUpBooking
                                      ? "pointer"
                                      : "not-allowed",
                                  fontSize: 11,
                                  fontWeight: 500,
                                }}
                              >
                                {isAvailable
                                  ? "Сонгох"
                                  : isBooked
                                  ? "Дүүрсэн"
                                  : "Хаалттай"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {followUpAvailability && followUpAvailability.days.length === 0 && (
            <div
              style={{
                padding: 12,
                textAlign: "center",
                color: "#6b7280",
                fontSize: 13,
              }}
            >
              Сонгосон хугацаанд боломжтой цаг байхгүй байна
            </div>
          )}

          {/* Booked slot details modal */}
          {detailsOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 80,
              }}
              onClick={() => setDetailsOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 420,
                  maxWidth: "90vw",
                  background: "#ffffff",
                  borderRadius: 8,
                  boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
                  padding: 16,
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: 15 }}>Дүүрсэн цаг</h3>
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 18,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
                  {detailsDate} {detailsTime}
                </div>

                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {detailsAppointments.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>Энэ цагийн дэлгэрэнгүй олдсонгүй.</div>
                  ) : (
                    detailsAppointments.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                          background: "#f9fafb",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {formatGridShortLabel({
                            patient: a.patient as any,
                            patientName: a.patientName,
                            patientOvog: a.patientOvog,
                          }) || `#${a.id}`}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                          Төлөв: {a.status}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(false)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      background: "#f9fafb",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Хаах
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import React from "react";

type FollowUpAvailability = {
  days: Array<{
    date: string;
    dayLabel: string;
    slots: Array<{
      start: string;
      end: string;
      status: "available" | "booked" | "off";
      appointmentId?: number;
    }>;
  }>;
  timeLabels: string[];
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
  onToggleScheduler: (checked: boolean) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onSlotMinutesChange: (minutes: number) => void;
  onBookAppointment: (slotStart: string) => void;
};

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
  onToggleScheduler,
  onDateFromChange,
  onDateToChange,
  onSlotMinutesChange,
  onBookAppointment,
}: FollowUpSchedulerProps) {
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
              <label style={{ fontWeight: 500 }}>Нэг цагийн үргэлжлэх хугацаа:</label>
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
                    // Create a map for quick lookup
                    const slotsByTime = new Map();
                    day.slots.forEach((slot) => {
                      const slotTime = new Date(slot.start)
                        .toTimeString()
                        .substring(0, 5);
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
                                disabled={!isAvailable || followUpBooking}
                                onClick={() =>
                                  isAvailable && onBookAppointment(slot.start)
                                }
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
                                  cursor: isAvailable && !followUpBooking
                                    ? "pointer"
                                    : "not-allowed",
                                  fontSize: 11,
                                  fontWeight: 500,
                                }}
                              >
                                {isAvailable
                                  ? "Сонгох"
                                  : isBooked
                                  ? "Захиалсан"
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
        </>
      )}
    </div>
  );
}

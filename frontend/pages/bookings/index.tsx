// frontend/pages/bookings/index.tsx
import React, { useEffect, useMemo, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  name?: string | null;
  email: string;
};

type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "ONLINE_HELD"
  | "ONLINE_CONFIRMED"
  | "ONLINE_EXPIRED";

type Booking = {
  id: number;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  status: BookingStatus;
  note?: string | null;
  doctor: { id: number; name?: string | null; email: string };
  branch: Branch;
  patient: {
    id: number;
    name?: string | null;
    regNo?: string | null;
    phone?: string | null;
  };
};

type DoctorScheduleDay = {
  id: number;
  date: string; // "YYYY-MM-DD"
  branch: Branch;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  note?: string | null;
};

type WorkingDoctor = {
  doctor: Doctor;
  schedule: DoctorScheduleDay;
};

// ==== shared time-slot logic (copied from appointments.tsx) ====

const START_HOUR = 9; // 09:00
const END_HOUR = 21; // 21:00
const WEEKEND_START_HOUR = 10; // 10:00
const WEEKEND_END_HOUR = 19; // 19:00
const SLOT_MINUTES = 30;

type TimeSlot = {
  label: string; // "09:00"
  start: Date;
  end: Date;
};

function generateTimeSlotsForDay(day: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const weekdayIndex = day.getDay(); // 0=Sun, 6=Sat
  const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;

  const startHour = isWeekend ? WEEKEND_START_HOUR : START_HOUR;
  const endHour = isWeekend ? WEEKEND_END_HOUR : END_HOUR;

  for (let hour = startHour; hour < endHour; hour++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const start = new Date(day);
      start.setHours(hour, m, 0, 0);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
      const label = start.toLocaleTimeString("mn-MN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      slots.push({ label, start, end });
    }
  }
  return slots;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function getSlotTimeString(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function isTimeWithinRange(time: string, startTime: string, endTime: string) {
  // inclusive of start, exclusive of end
  return time >= startTime && time < endTime;
}

// ==== helpers ====

function formatDoctorName(d: Doctor): string {
  if (d.name && d.name.trim().length > 0) return d.name;
  return d.email;
}

function formatPatientLabel(p?: Booking["patient"]): string {
  if (!p) return "Тодорхойгүй";
  const pieces: string[] = [];
  if (p.name) pieces.push(p.name);
  if (p.regNo) pieces.push(`РД: ${p.regNo}`);
  if (p.phone) pieces.push(`Утас: ${p.phone}`);
  return pieces.join(" • ") || `ID ${p.id}`;
}

function formatDateYmdDots(date: Date): string {
  return date.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ==== page ====

export default function BookingsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const [workingDoctors, setWorkingDoctors] = useState<WorkingDoctor[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [globalError, setGlobalError] = useState<string | null>(null);

  // meta
  useEffect(() => {
    async function loadInitial() {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch("/api/branches"),
          fetch("/api/users?role=doctor"),
        ]);

        const bData = await bRes.json().catch(() => []);
        const dData = await dRes.json().catch(() => []);

        if (Array.isArray(bData)) {
          setBranches(bData);
          if (!selectedBranchId && bData.length > 0) {
            setSelectedBranchId(String(bData[0].id));
          }
        }
        if (Array.isArray(dData)) {
          setDoctors(dData);
        }
      } catch (e) {
        console.error(e);
        setGlobalError("Сүлжээгээ шалгана уу.");
      }
    }

    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load bookings
  useEffect(() => {
    if (!selectedBranchId || !selectedDate) return;

    async function loadBookings() {
      setLoadingBookings(true);
      setBookingsError(null);
      try {
        const url = `/api/bookings?branchId=${selectedBranchId}&date=${selectedDate}&includeOnlineAll=true`;
        const res = await fetch(url);
        const data = await res.json().catch(() => []);

        if (!res.ok || !Array.isArray(data)) {
          setBookings([]);
          setBookingsError("Цаг захиалга ачаалж чадсангүй.");
          return;
        }
        setBookings(data);
      } catch (e) {
        console.error(e);
        setBookingsError("Сүлжээгээ шалгана уу.");
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    }

    loadBookings();
  }, [selectedBranchId, selectedDate]);

  // load working doctors (DoctorSchedule) for branch+date
  useEffect(() => {
    if (!selectedBranchId || !selectedDate || doctors.length === 0) return;

    async function loadWorkingDoctors() {
      setLoadingSchedule(true);
      setScheduleError(null);
      try {
        const branchIdNum = Number(selectedBranchId);
        if (Number.isNaN(branchIdNum)) {
          setScheduleError("Салбарын ID буруу байна");
          setWorkingDoctors([]);
          return;
        }

        const from = selectedDate;
        const to = selectedDate;
        const results: WorkingDoctor[] = [];

        for (const doc of doctors) {
          const res = await fetch(
            `/api/users/${doc.id}/schedule?from=${from}&to=${to}&branchId=${branchIdNum}`
          );
          const data = await res.json().catch(() => []);

          if (!res.ok || !Array.isArray(data) || data.length === 0) continue;

          const schedule: DoctorScheduleDay = data[0];
          results.push({ doctor: doc, schedule });
        }

        // sort by name
        results.sort((a, b) =>
          formatDoctorName(a.doctor)
            .toLowerCase()
            .localeCompare(formatDoctorName(b.doctor).toLowerCase())
        );

        setWorkingDoctors(results);
      } catch (e) {
        console.error(e);
        setScheduleError("Ажлын хуваарь ачаалж чадсангүй.");
        setWorkingDoctors([]);
      } finally {
        setLoadingSchedule(false);
      }
    }

    loadWorkingDoctors();
  }, [selectedBranchId, selectedDate, doctors]);

  const selectedDay = useMemo(
    () => new Date(selectedDate),
    [selectedDate]
  );
  const timeSlots = useMemo(
    () => generateTimeSlotsForDay(selectedDay),
    [selectedDay]
  );

  // ================== RENDER ==================

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Шинэ цаг захиалга (Bookings)</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Эмч, салбар, өдрөөр цаг захиалгуудыг харах хүснэгт.
      </p>

      {globalError && (
        <div style={{ color: "#b91c1c", marginBottom: 12 }}>{globalError}</div>
      )}

      {/* Filters */}
      <section
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
          fontSize: 13,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
          Шүүлтүүр
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Огноо</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Салбар</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="">Салбар сонгох</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Time grid by doctor */}
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>
          Өдрийн цагийн хүснэгт (эмчээр)
        </h2>
        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>
          {formatDateYmdDots(selectedDay)}
        </div>

        {loadingSchedule && (
          <div style={{ marginBottom: 8 }}>Ажлын хуваарь ачааллаж байна...</div>
        )}
        {scheduleError && (
          <div style={{ color: "#b91c1c", marginBottom: 8 }}>
            {scheduleError}
          </div>
        )}

        {workingDoctors.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Энэ өдөр, энэ салбарт ажлын хуваарьтай эмч алга.
          </div>
        ) : (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
              fontSize: 12,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `80px repeat(${workingDoctors.length}, 1fr)`,
                backgroundColor: "#f3f4f6",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  padding: 8,
                  fontWeight: 600,
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                Цаг
              </div>
              {workingDoctors.map((wd) => (
                <div
                  key={wd.doctor.id}
                  style={{
                    padding: 8,
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #e5e7eb",
                  }}
                >
                  {formatDoctorName(wd.doctor)}
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      marginTop: 2,
                    }}
                  >
                    {wd.schedule.startTime}–{wd.schedule.endTime}
                  </div>
                </div>
              ))}
            </div>

            {/* Rows */}
            <div>
              {timeSlots.map((slot, rowIndex) => (
                <div
                  key={rowIndex}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${workingDoctors.length}, 1fr)`,
                    borderBottom: "1px solid #f3f4f6",
                    minHeight: 40,
                  }}
                >
                  {/* time label */}
                  <div
                    style={{
                      padding: 6,
                      borderRight: "1px solid #e5e7eb",
                      backgroundColor:
                        rowIndex % 2 === 0 ? "#fafafa" : "#ffffff",
                    }}
                  >
                    {slot.label}
                  </div>

                  {/* doctor cells */}
                  {workingDoctors.map((wd) => {
                    const slotTimeStr = getSlotTimeString(slot.start);

                    const isWorkingHour = isTimeWithinRange(
                      slotTimeStr,
                      wd.schedule.startTime,
                      wd.schedule.endTime
                    );

                    const appsForCell = bookings.filter((b) => {
                      if (b.doctor.id !== wd.doctor.id) return false;

                      const [y, m, d] = b.date.split("-").map(Number);
                      const [sh, sm] = b.startTime.split(":").map(Number);
                      const [eh, em] = b.endTime.split(":").map(Number);

                      const start = new Date(
                        y,
                        (m || 1) - 1,
                        d || 1,
                        sh || 0,
                        sm || 0,
                        0,
                        0
                      );
                      const end = new Date(
                        y,
                        (m || 1) - 1,
                        d || 1,
                        eh || 0,
                        em || 0,
                        0,
                        0
                      );

                      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
                        return false;

                      return start < slot.end && end > slot.start;
                    });

                    // base background
                    let baseBg = "#ffffff";
                    if (!isWorkingHour) {
                      baseBg = "#f3f4f6"; // non-working (grey)
                    } else if (appsForCell.length === 0) {
                      baseBg =
                        rowIndex % 2 === 0 ? "#ffffff" : "#f9fafb";
                    }

                    // colour rules
                    const bgForStatus = (s: BookingStatus): string => {
                      switch (s) {
                        case "COMPLETED":
                          return "#fb6190";
                        case "CONFIRMED":
                        case "ONLINE_CONFIRMED":
                          return "#bbf7d0";
                        case "IN_PROGRESS":
                          return "#f9d89b";
                        case "CANCELLED":
                        case "ONLINE_EXPIRED":
                          return "#9d9d9d";
                        case "ONLINE_HELD":
                          return "#e0e7ff"; // light indigo – temporary block
                        default:
                          return "#67e8f9";
                      }
                    };

                    const displayLabel = (b: Booking): string => {
                      if (b.status === "ONLINE_HELD") return "Онлайн (Төлбөр хүлээж буй)";
                      return formatPatientLabel(b.patient);
                    };

                    // no booking
                    if (appsForCell.length === 0) {
                      return (
                        <div
                          key={wd.doctor.id}
                          style={{
                            borderLeft: "1px solid #f3f4f6",
                            backgroundColor: baseBg,
                            minHeight: 40,
                          }}
                        />
                      );
                    }

                    // one booking
                    if (appsForCell.length === 1) {
                      const b = appsForCell[0];
                      return (
                        <div
                          key={wd.doctor.id}
                          style={{
                            borderLeft: "1px solid #f3f4f6",
                            backgroundColor: baseBg,
                            minHeight: 40,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "1px 3px",
                          }}
                          title={`${displayLabel(b)} • ${b.startTime}–${b.endTime}`}
                        >
                          <span
                            style={{
                              backgroundColor: bgForStatus(b.status),
                              borderRadius: 4,
                              padding: "2px 4px",
                              maxWidth: "100%",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                              fontSize: 11,
                              lineHeight: 1.2,
                              textAlign: "center",
                              color:
                                b.status === "COMPLETED" ||
                                b.status === "CANCELLED"
                                  ? "#ffffff"
                                  : "#111827",
                            }}
                          >
                            {displayLabel(b)}
                          </span>
                        </div>
                      );
                    }

                    // two or more bookings in this slot -> two lanes
                    const overlapping = appsForCell.slice(0, 2);

                    return (
                      <div
                        key={wd.doctor.id}
                        style={{
                          borderLeft: "1px solid #f3f4f6",
                          backgroundColor: baseBg,
                          minHeight: 40,
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "stretch",
                          padding: 0,
                        }}
                      >
                        {overlapping.map((b, idx) => (
                          <div
                            key={b.id}
                            style={{
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "1px 3px",
                              backgroundColor: bgForStatus(b.status),
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                              fontSize: 11,
                              lineHeight: 1.2,
                              textAlign: "center",
                              color:
                                b.status === "COMPLETED" ||
                                b.status === "CANCELLED"
                                  ? "#ffffff"
                                  : "#111827",
                              borderLeft:
                                idx === 1
                                  ? "1px solid rgba(255,255,255,0.5)"
                                  : undefined,
                            }}
                            title={`${displayLabel(b)} • ${b.startTime}–${b.endTime}`}
                          >
                            {displayLabel(b)}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* debug bookings JSON */}
        <section style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, marginBottom: 4 }}>
            Debug: тухайн өдрийн bookings JSON
          </h3>
          {loadingBookings && <div>Ачааллаж байна...</div>}
          {bookingsError && (
            <div style={{ color: "#b91c1c" }}>{bookingsError}</div>
          )}
          {!loadingBookings && !bookingsError && bookings.length === 0 && (
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              Энэ өдөрт цаг захиалга алга.
            </div>
          )}
          {!loadingBookings && !bookingsError && bookings.length > 0 && (
            <pre
              style={{
                marginTop: 8,
                padding: 8,
                background: "#111827",
                color: "#e5e7eb",
                borderRadius: 6,
                maxHeight: 260,
                overflow: "auto",
                fontSize: 11,
              }}
            >
              {JSON.stringify(bookings, null, 2)}
            </pre>
          )}
        </section>
      </section>
    </main>
  );
}

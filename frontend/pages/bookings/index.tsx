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
  branches?: Branch[];
  branch?: Branch | null;
};

type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

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

const SLOT_MINUTES = 30;
const ROW_HEIGHT = 40; // px per 30-min slot

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatDoctorName(d: Doctor): string {
  if (d.name && d.name.trim().length > 0) return d.name;
  return d.email;
}

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

  // Load branches & doctors once
  useEffect(() => {
    async function loadInitial() {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch("/api/branches"),
          fetch("/api/users?role=doctor"),
        ]);

        const bData = await bRes.json();
        if (bRes.ok && Array.isArray(bData)) {
          setBranches(bData);
          if (!selectedBranchId && bData.length > 0) {
            setSelectedBranchId(String(bData[0].id));
          }
        }

        const dData = await dRes.json();
        if (dRes.ok && Array.isArray(dData)) {
          setDoctors(dData);
        }
      } catch (e) {
        console.error(e);
        setGlobalError("Сүлжээгээ шалгана уу");
      }
    }

    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load bookings whenever branch/date change
  useEffect(() => {
    if (!selectedBranchId || !selectedDate) return;

    async function loadBookings() {
      setLoadingBookings(true);
      setBookingsError(null);
      try {
        const url = `/api/bookings?branchId=${selectedBranchId}&date=${selectedDate}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          setBookingsError(data?.error || "Цаг захиалга ачаалж чадсангүй");
          setBookings([]);
          return;
        }

        if (!Array.isArray(data)) {
          setBookingsError("Алдаатай өгөгдөл ирлээ");
          setBookings([]);
          return;
        }

        setBookings(data);
      } catch (e) {
        console.error(e);
        setBookingsError("Сүлжээгээ шалгана уу");
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    }

    loadBookings();
  }, [selectedBranchId, selectedDate]);

  // Load working doctors (schedule) for branch+date
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
          const data = await res.json();

          if (!res.ok || !Array.isArray(data) || data.length === 0) {
            continue;
          }

          const schedule: DoctorScheduleDay = data[0];
          results.push({ doctor: doc, schedule });
        }

        setWorkingDoctors(results);
      } catch (e) {
        console.error(e);
        setScheduleError("Ажлын хуваарь ачаалж чадсангүй");
        setWorkingDoctors([]);
      } finally {
        setLoadingSchedule(false);
      }
    }

    loadWorkingDoctors();
  }, [selectedBranchId, selectedDate, doctors]);

  // Determine clinic open/close for selected date (same rules as backend)
const { clinicOpen, clinicClose } = useMemo(() => {
  if (!selectedDate) {
    return { clinicOpen: "09:00", clinicClose: "21:00" };
  }
  const d = new Date(selectedDate);
  const weekday = d.getDay(); // 0 Sun .. 6 Sat
  const isWeekend = weekday === 0 || weekday === 6;
  if (isWeekend) {
    return { clinicOpen: "10:00", clinicClose: "19:00" };
  }
  return { clinicOpen: "09:00", clinicClose: "21:00" };
}, [selectedDate]);

const timeSlots = useMemo(() => {
  const start = timeToMinutes(clinicOpen);
  const end = timeToMinutes(clinicClose);
  const slots: string[] = [];
  for (let m = start; m <= end; m += SLOT_MINUTES) {
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(`${h}:${mm}`);
  }
  return slots;
}, [clinicOpen, clinicClose]);

const dayStartMinutes = useMemo(
  () => timeToMinutes(clinicOpen),
  [clinicOpen]
);

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Цаг захиалга (шинэ Bookings)</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Эмч, салбар, өдрөөр цаг захиалгуудыг харах шинэ систем.
      </p>

      {globalError && (
        <div style={{ color: "red", marginBottom: 12 }}>{globalError}</div>
      )}

      {/* Filters */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 8,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Шүүлтүүр</h2>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Огноо
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Салбар
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              <option value="">Салбар сонгох</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Day grid by doctor (no booking blocks yet) */}
      <section style={{ marginTop: 24 }}>
        <h2>Өдрийн цагийн хүснэгт (эмчээр)</h2>

        {loadingSchedule && <div>Ажлын хуваарь ачааллаж байна...</div>}
        {scheduleError && (
          <div style={{ color: "red", marginBottom: 8 }}>{scheduleError}</div>
        )}

        {!loadingSchedule && workingDoctors.length === 0 && (
          <div style={{ color: "#888", marginTop: 8 }}>
            Энэ өдөр, энэ салбарт ажлын хуваарьтай эмч алга.
          </div>
        )}

        {workingDoctors.length > 0 && (
          <div
            style={{
              marginTop: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `120px repeat(${workingDoctors.length}, 1fr)`,
                background: "#f3f4f6",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
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
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #e5e7eb",
                  }}
                >
                  {formatDoctorName(wd.doctor)}
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      marginTop: 2,
                    }}
                  >
                    {wd.schedule.startTime}–{wd.schedule.endTime}
                  </div>
                </div>
              ))}
            </div>

            {/* Body: time axis + empty doctor columns with schedule background */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `120px repeat(${workingDoctors.length}, 1fr)`,
              }}
            >
              {/* Time column */}
              <div
                style={{
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                {timeSlots.map((t, idx) => (
                  <div
                    key={t}
                    style={{
                      height: ROW_HEIGHT,
                      borderBottom:
                        idx === timeSlots.length - 1
                          ? "none"
                          : "1px solid #f3f4f6",
                      padding: "4px 8px",
                      fontSize: 13,
                      color: "#4b5563",
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>

              {/* Doctor columns */}
              {workingDoctors.map((wd) => {
                const schedStartMin = timeToMinutes(wd.schedule.startTime);
const schedEndMin = timeToMinutes(wd.schedule.endTime);

// snap to 30‑min slot indices
const slotHeight = ROW_HEIGHT; // one slot = one row
const slotIndexStart =
  (schedStartMin - dayStartMinutes) / SLOT_MINUTES;
const slotIndexEnd =
  (schedEndMin - dayStartMinutes) / SLOT_MINUTES;

const topPx = slotIndexStart * slotHeight;
const heightPx = (slotIndexEnd - slotIndexStart) * slotHeight;

                return (
                  <div
                    key={wd.doctor.id}
                    style={{
                      position: "relative",
                      borderRight: "1px solid #f3f4f6",
                    }}
                  >
                    {/* schedule background */}
<div
  style={{
    position: "absolute",
    left: 0,
    right: 0,
    top: topPx,
    height: heightPx,
    background: "#ecfeff",
    opacity: 0.5,
    pointerEvents: "none",
  }}
/>

{/* booking blocks (simple version, full-width) */}
{bookings
  .filter((b) => b.doctor.id === wd.doctor.id)
  .map((b) => {
    const startMin = timeToMinutes(b.startTime);
    const endMin = timeToMinutes(b.endTime);
    const offsetMin = startMin - dayStartMinutes;
    const durationMin = endMin - startMin;

    const top = offsetMin * (ROW_HEIGHT / SLOT_MINUTES);
    const height = Math.max(
      durationMin * (ROW_HEIGHT / SLOT_MINUTES),
      16
    );

    // simple color per status
    let bg = "#67e8f9"; // PENDING
    if (b.status === "CONFIRMED") bg = "#bbf7d0";
    if (b.status === "IN_PROGRESS") bg = "#fed7aa";
    if (b.status === "COMPLETED") bg = "#f9a8d4";
    if (b.status === "CANCELLED") bg = "#e5e7eb";

    const patientLabel =
      b.patient?.name ||
      b.patient?.regNo ||
      b.patient?.phone ||
      `ID ${b.patient?.id}`;

    return (
      <div
        key={b.id}
        style={{
          position: "absolute",
          left: 4,
          right: 4,
          top,
          height,
          background: bg,
          borderRadius: 4,
          padding: "4px 6px",
          fontSize: 12,
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(15,23,42,0.15)",
        }}
        title={`${b.startTime}–${b.endTime} • ${b.status}`}
      >
        <div style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
          {patientLabel}
        </div>
        <div style={{ fontSize: 11 }}>
          {b.startTime}–{b.endTime}
        </div>
      </div>
    );
  })}

{/* rows to match height */}
{timeSlots.map((t, idx) => (
  <div
    key={t}
    style={{
      height: ROW_HEIGHT,
      borderBottom:
        idx === timeSlots.length - 1
          ? "none"
          : "1px solid #f9fafb",
    }}
  />
))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Debug bookings list */}
      <section style={{ marginTop: 32 }}>
        <h2>Тухайн өдрийн цаг захиалгууд (debug list)</h2>
        {loadingBookings && <div>Ачааллаж байна...</div>}
        {bookingsError && (
          <div style={{ color: "red" }}>{bookingsError}</div>
        )}
        {!loadingBookings && !bookingsError && bookings.length === 0 && (
          <div style={{ color: "#888" }}>Энэ өдөрт цаг захиалга алга.</div>
        )}
        {!loadingBookings && !bookingsError && bookings.length > 0 && (
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 8,
              maxHeight: 400,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {JSON.stringify(bookings, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}

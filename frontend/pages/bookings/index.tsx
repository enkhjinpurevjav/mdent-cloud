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
  endTime: string;   // "HH:MM"
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
  endTime: string;   // "HH:MM"
  note?: string | null;
};

type WorkingDoctor = {
  doctor: Doctor;
  schedule: DoctorScheduleDay;
};

const SLOT_MINUTES = 30;
const ROW_HEIGHT = 40; // px per slot row

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

        // Sequential fetch per doctor — number is small, OK for now
        for (const doc of doctors) {
          const res = await fetch(
            `/api/users/${doc.id}/schedule?from=${from}&to=${to}&branchId=${branchIdNum}`
          );
          const data = await res.json();

          if (!res.ok) {
            console.warn("Schedule load failed for doctor", doc.id, data);
            continue;
          }
          if (!Array.isArray(data) || data.length === 0) {
            continue; // no schedule for this doctor on that day/branch
          }

          // For this date we expect max 1 row per branch; take first
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

  // Compute time grid (09:00–21:00 from all schedules, or default)
  const timeSlots = useMemo(() => {
    if (workingDoctors.length === 0) {
      // default 09:00–18:00
      const start = 9 * 60;
      const end = 18 * 60;
      const slots: string[] = [];
      for (let m = start; m <= end; m += SLOT_MINUTES) {
        const h = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        slots.push(`${h}:${mm}`);
      }
      return slots;
    }

    let minStart = Infinity;
    let maxEnd = -Infinity;

    for (const wd of workingDoctors) {
      const s = timeToMinutes(wd.schedule.startTime);
      const e = timeToMinutes(wd.schedule.endTime);
      if (s < minStart) minStart = s;
      if (e > maxEnd) maxEnd = e;
    }

    // snap to 30-min grid
    minStart = Math.floor(minStart / SLOT_MINUTES) * SLOT_MINUTES;
    maxEnd = Math.ceil(maxEnd / SLOT_MINUTES) * SLOT_MINUTES;

    const slots: string[] = [];
    for (let m = minStart; m <= maxEnd; m += SLOT_MINUTES) {
      const h = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      slots.push(`${h}:${mm}`);
    }
    return slots;
  }, [workingDoctors]);

  const dayStartMinutes = useMemo(() => {
    const first = timeSlots[0] || "09:00";
    return timeToMinutes(first);
  }, [timeSlots]);

  // Later we'll add booking blocks; for now just grid + headers
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

      {/* Day grid by doctor (no bookings yet) */}
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

            {/* Body: time axis + empty columns for now */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `120px repeat(${workingDoctors.length}, 1fr)`,
                position: "relative",
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

              {/* One column per doctor (empty containers for now) */}
              {workingDoctors.map((wd) => (
                <div
                  key={wd.doctor.id}
                  style={{
                    position: "relative",
                    borderRight: "1px solid #f3f4f6",
                 *


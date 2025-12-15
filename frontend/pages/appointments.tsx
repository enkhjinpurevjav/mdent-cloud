import React, { useEffect, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  name: string | null;
  ovog: string | null;
};

type ScheduledDoctor = Doctor & {
  schedules?: {
    id: number;
    branchId: number;
    date: string;
    startTime: string; // "HH:MM"
    endTime: string; // "HH:MM"
    note: string | null;
  }[];
};

type PatientLite = {
  id: number;
  name: string;
  regNo: string;
  patientBook?: { bookNumber: string } | null;
};

type Appointment = {
  id: number;
  patientId: number;
  doctorId: number | null;
  branchId: number;
  scheduledAt: string;
  status: string;
  notes: string | null;
  patient?: PatientLite;
  doctor?: Doctor | null;
  branch?: Branch | null;
};

function groupByDate(appointments: Appointment[]) {
  const map: Record<string, Appointment[]> = {};
  for (const a of appointments) {
    const d = new Date(a.scheduledAt);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!map[day]) map[day] = [];
    map[day].push(a);
  }
  const entries = Object.entries(map).sort(([d1], [d2]) =>
    d1 < d2 ? -1 : d1 > d2 ? 1 : 0
  );
  return entries;
}

const START_HOUR = 9; // 09:00
const END_HOUR = 21; // 21:00
const SLOT_MINUTES = 30;

type TimeSlot = {
  label: string; // "09:00"
  start: Date;
  end: Date;
};

function generateTimeSlotsForDay(day: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const start = new Date(day);
      start.setHours(hour, m, 0, 0);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
      const label = start.toLocaleTimeString("mn-MN", {
        hour: "2-digit",
        minute: "2-digit",
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
  // "HH:MM" (24h) in local time
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// Returns true if "time" is within [startTime, endTime)
function isTimeWithinRange(time: string, startTime: string, endTime: string) {
  return time >= startTime && time < endTime;
}

function formatDoctorName(d?: Doctor | null) {
  if (!d) return "Тодорхойгүй";
  const name = d.name || "";
  const ovog = (d.ovog || "").trim();
  if (name && ovog) {
    return `${ovog.charAt(0).toUpperCase()}.${name}`;
  }
  return name || "Тодорхойгүй";
}

function formatPatientLabel(p?: PatientLite, id?: number) {
  if (!p) return `Patient #${id ?? "-"}`;
  const book = p.patientBook?.bookNumber
    ? ` • Карт: ${p.patientBook.bookNumber}`
    : "";
  return `${p.name}${book}`;
}

function getDateFromYMD(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

type AppointmentFormProps = {
  branches: Branch[];
  doctors: Doctor[];
  onCreated: (a: Appointment) => void;
};

function AppointmentForm({ branches, doctors, onCreated }: AppointmentFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    branchId: branches.length ? String(branches[0].id) : "",
    date: todayStr,
    time: "",
    status: "booked",
    notes: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!form.branchId && branches.length > 0) {
      setForm((prev) => ({ ...prev, branchId: String(branches[0].id) }));
    }
  }, [branches, form.branchId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.patientId || !form.branchId || !form.date || !form.time) {
      setError("Өвчтөн, салбар, огноо, цаг талбаруудыг бөглөнө үү.");
      return;
    }

    const scheduledAt = `${form.date}T${form.time}`;

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: Number(form.patientId),
          doctorId: form.doctorId ? Number(form.doctorId) : null,
          branchId: Number(form.branchId),
          scheduledAt,
          status: form.status,
          notes: form.notes || null,
        }),
      });
      let data: Appointment | { error?: string };
      try {
        data = await res.json();
      } catch {
        data = { error: "Unknown error" };
      }
      if (res.ok) {
        onCreated(data as Appointment);
        setForm((prev) => ({
          ...prev,
          patientId: "",
          time: "",
          notes: "",
          status: "booked",
        }));
      } else {
        setError((data as any).error || "Алдаа гарлаа");
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginBottom: 24,
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Өвчтөн ID</label>
        <input
          name="patientId"
          placeholder="Ж: 123"
          value={form.patientId}
          onChange={handleChange}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Эмч</label>
        <select
          name="doctorId"
          value={form.doctorId}
          onChange={handleChange}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Эмч сонгоогүй</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {formatDoctorName(d)}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Салбар</label>
        <select
          name="branchId"
          value={form.branchId}
          onChange={handleChange}
          required
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

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Огноо</label>
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Цаг</label>
        <input
          type="time"
          name="time"
          value={form.time}
          onChange={handleChange}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Төлөв</label>
        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="booked">Захиалсан</option>
          <option value="ongoing">Явагдаж байна</option>
          <option value="completed">Дууссан</option>
          <option value="cancelled">Цуцлагдсан</option>
        </select>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          gridColumn: "1 / -1",
        }}
      >
        <label>Тэмдэглэл</label>
        <input
          name="notes"
          placeholder="Ж: Эмчилгээний товч тэмдэглэл"
          value={form.notes}
          onChange={handleChange}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Цаг захиалах
        </button>
        {error && (
          <div style={{ color: "#b91c1c", fontSize: 12, alignSelf: "center" }}>
            {error}
          </div>
        )}
      </div>
    </form>
  );
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [scheduledDoctors, setScheduledDoctors] = useState<ScheduledDoctor[]>(
    []
  );
  const [error, setError] = useState("");

  // Filters
  const todayStr = new Date().toISOString().slice(0, 10);
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterBranchId, setFilterBranchId] = useState<string>("");
  const [filterDoctorId, setFilterDoctorId] = useState<string>("");

  // Branch tab ("" = all branches)
  const [activeBranchTab, setActiveBranchTab] = useState<string>("");

  const groupedAppointments = groupByDate(appointments);
  const selectedDay = getDateFromYMD(filterDate);
  const timeSlots = generateTimeSlotsForDay(selectedDay);

  const loadAppointments = async () => {
    try {
      setError("");
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterBranchId) params.set("branchId", filterBranchId);
      if (filterDoctorId) params.set("doctorId", filterDoctorId);

      const res = await fetch(`/api/appointments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        throw new Error("failed");
      }
      setAppointments(data);
    } catch {
      setError("Цаг захиалгуудыг ачаалах үед алдаа гарлаа.");
    }
  };

  const loadScheduledDoctors = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterBranchId) params.set("branchId", filterBranchId);

      const res = await fetch(`/api/doctors/scheduled?${params.toString()}`);
      const data = await res.json();
      console.log("scheduled doctors response", {
        params: params.toString(),
        data,
      });

      if (!res.ok || !Array.isArray(data)) {
        throw new Error("failed");
      }

      const sorted = data
        .slice()
        .sort((a: ScheduledDoctor, b: ScheduledDoctor) => {
          const an = (a.name || "").toLowerCase();
          const bn = (b.name || "").toLowerCase();
          return an.localeCompare(bn);
        });

      setScheduledDoctors(sorted);
    } catch (e) {
      console.error("Failed to load scheduled doctors", e);
      setScheduledDoctors([]);
    }
  };

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch("/api/branches"),
          fetch("/api/users?role=doctor"),
        ]);

        const [bData, dData] = await Promise.all([
          bRes.json().catch(() => []),
          dRes.json().catch(() => []),
        ]);

        if (Array.isArray(bData)) setBranches(bData);
        if (Array.isArray(dData)) setDoctors(dData);
      } catch (e) {
        console.error(e);
      }
    };

    loadMeta();
  }, []);

  useEffect(() => {
    loadAppointments();
    loadScheduledDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, filterBranchId, filterDoctorId]);

  const handleBranchTabClick = (branchId: string) => {
    setActiveBranchTab(branchId);
    setFilterBranchId(branchId);
  };

  // For the grid: ONLY show scheduled doctors
  const gridDoctors: ScheduledDoctor[] = scheduledDoctors;

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Цаг захиалга</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Өвчтөн, эмч, салбарын цаг захиалгуудыг харах, нэмэх, удирдах.
      </p>

      {/* Branch view tabs */}
      <section
        style={{
          marginBottom: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 8,
        }}
      >
        <button
          type="button"
          onClick={() => handleBranchTabClick("")}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid transparent",
            backgroundColor: activeBranchTab === "" ? "#2563eb" : "transparent",
            color: activeBranchTab === "" ? "#ffffff" : "#374151",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Бүх салбар
        </button>
        {branches.map((b) => {
          const idStr = String(b.id);
          const isActive = activeBranchTab === idStr;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => handleBranchTabClick(idStr)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: isActive ? "1px solid #2563eb" : "1px solid #d1d5db",
                backgroundColor: isActive ? "#eff6ff" : "#ffffff",
                color: isActive ? "#1d4ed8" : "#374151",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {b.name}
            </button>
          );
        })}
      </section>

      {/* Filters card */}
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
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
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
              value={filterBranchId}
              onChange={(e) => {
                const value = e.target.value;
                setFilterBranchId(value);
                setActiveBranchTab(value);
              }}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="">Бүх салбар</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Эмч</label>
            <select
              value={filterDoctorId}
              onChange={(e) => setFilterDoctorId(e.target.value)}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="">Бүх эмч</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDoctorName(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Create form card */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "white",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
          Шинэ цаг захиалах
        </h2>
        <AppointmentForm
          branches={branches}
          doctors={doctors}
          onCreated={(a) => setAppointments((prev) => [a, ...prev])}
        />
      </section>

      {error && (
        <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Day-grouped mini calendar */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Календарь (өдрөөр)</h2>
        {groupedAppointments.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Цаг захиалга алга.
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 16,
            overflowX: "auto",
            paddingBottom: 8,
            justifyContent: "flex-start",
          }}
        >
          {groupedAppointments.map(([date, apps]) => (
            <div
              key={date}
              style={{
                minWidth: 260,
                maxWidth: 320,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 10,
                backgroundColor: "#ffffff",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 8,
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                {new Date(date).toLocaleDateString("mn-MN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  weekday: "short",
                })}
              </div>
              {apps
                .slice()
                .sort(
                  (a, b) =>
                    new Date(a.scheduledAt).getTime() -
                    new Date(b.scheduledAt).getTime()
                )
                .map((a) => (
                  <div
                    key={a.id}
                    style={{
                      marginBottom: 6,
                      padding: 6,
                      borderRadius: 4,
                      backgroundColor:
                        a.status === "completed"
                          ? "#e0f7e9"
                          : a.status === "ongoing"
                          ? "#fff4e0"
                          : a.status === "cancelled"
                          ? "#fde0e0"
                          : "#e6f0ff",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>
                      {new Date(a.scheduledAt).toLocaleTimeString("mn-MN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      — {formatPatientLabel(a.patient, a.patientId)}
                    </div>
                    <div>
                      Эмч: {formatDoctorName(a.doctor)} | Салбар:{" "}
                      {a.branch?.name ?? a.branchId}
                    </div>
                    <div>Тайлбар: {a.notes || "-"}</div>
                    <div>Төлөв: {a.status}</div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      {/* Time grid by doctor – using scheduled doctors and coloring non-working hours */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>
          Өдрийн цагийн хүснэгт (эмчээр)
        </h2>
        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>
          {selectedDay.toLocaleDateString("mn-MN", {
            year: "numeric",
            month: "short",
            day: "numeric",
            weekday: "long",
          })}
        </div>
        {gridDoctors.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Энэ өдөр ажиллах эмчийн хуваарь алга.
          </div>
        )}
        {gridDoctors.length > 0 && (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
              fontSize: 12,
            }}
          >
            {/* Header row: doctor names + appointment counts */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `80px repeat(${gridDoctors.length}, 1fr)`,
                backgroundColor: "#f5f5f5",
                borderBottom: "1px solid #ddd",
              }}
            >
              <div style={{ padding: 8, fontWeight: "bold" }}>Цаг</div>
              {gridDoctors.map((doc) => {
                const count = appointments.filter(
                  (a) => a.doctorId === doc.id
                ).length;
                return (
                  <div
                    key={doc.id}
                    style={{
                      padding: 8,
                      fontWeight: "bold",
                      textAlign: "center",
                      borderLeft: "1px solid #ddd",
                    }}
                  >
                    <div>{formatDoctorName(doc)}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                        marginTop: 2,
                      }}
                    >
                      {count} захиалга
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time rows */}
            <div>
              {timeSlots.map((slot, rowIndex) => (
                <div
                  key={rowIndex}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${gridDoctors.length}, 1fr)`,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  {/* Time label */}
                  <div
                    style={{
                      padding: 6,
                      borderRight: "1px solid #ddd",
                      backgroundColor:
                        rowIndex % 2 === 0 ? "#fafafa" : "#ffffff",
                    }}
                  >
                    {slot.label}
                  </div>

                  {/* Cell per doctor */}
                  {gridDoctors.map((doc) => {
                    const appsForCell = appointments.filter((a) => {
                      if (a.doctorId !== doc.id) return false;
                      const t = new Date(a.scheduledAt);
                      if (Number.isNaN(t.getTime())) return false;
                      return t >= slot.start && t < slot.end;
                    });

                    const slotTimeStr = getSlotTimeString(slot.start); // "HH:MM"
                    const schedules = (doc as any).schedules || [];

                    // Working hour = inside any DoctorSchedule for this doctor
                    const isWorkingHour = schedules.some((s: any) =>
                      isTimeWithinRange(
                        slotTimeStr,
                        s.startTime,
                        s.endTime
                      )
                    );

                    let bg: string;

                    if (!isWorkingHour) {
                      // Non-working hour → orange
                      bg = "#ee7148";
                    } else if (appsForCell.length === 0) {
                      // Working hour, free
                      bg = "#ffffff";
                    } else {
                      // Working hour, booked: status-based color
                      const status = appsForCell[0].status;
                      bg =
                        status === "completed"
                          ? "#e0f7e9"
                          : status === "ongoing"
                          ? "#fff4e0"
                          : status === "cancelled"
                          ? "#fde0e0"
                          : "#e6f0ff";
                    }

                    return (
                      <div
                        key={doc.id}
                        style={{
                          padding: 4,
                          borderLeft: "1px solid #f0f0f0",
                          backgroundColor: bg,
                          minHeight: 28,
                        }}
                      >
                        {appsForCell.map((a) => (
                          <div key={a.id}>
                            {formatPatientLabel(a.patient, a.patientId)} (
                            {a.status})
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
      </section>

      {/* Raw table */}
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>
          Бүгдийг жагсаалтаар харах
        </h2>
        {appointments.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Цаг захиалга алга.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 4,
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  ID
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Өвчтөн
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Салбар
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Эмч
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Огноо / цаг
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Төлөв
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Тэмдэглэл
                </th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {a.id}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {formatPatientLabel(a.patient, a.patientId)}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {a.branch?.name ?? a.branchId}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {formatDoctorName(a.doctor ?? null)}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {new Date(a.scheduledAt).toLocaleString("mn-MN")}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {a.status}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {a.notes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

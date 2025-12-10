import React, { useEffect, useState } from "react";

type Appointment = {
  id: number;
  patientId: number;
  doctorId: number | null;
  branchId: number;
  scheduledAt: string;
  status: string;
  notes: string | null;
  patient?: { id: number; name: string; regNo: string };
};

function groupByDate(appointments: Appointment[]) {
  const map: Record<string, Appointment[]> = {};
  for (const a of appointments) {
    const day = new Date(a.scheduledAt).toISOString().slice(0, 10); // YYYY-MM-DD
    if (!map[day]) map[day] = [];
    map[day].push(a);
  }
  // sort dates ascending
  const entries = Object.entries(map).sort(([d1], [d2]) =>
    d1 < d2 ? -1 : d1 > d2 ? 1 : 0
  );
  return entries;
}

// ---- time-grid helpers (top-level, OUTSIDE groupByDate) ----
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
  const d = new Date(day);
  d.setMinutes(0, 0, 0);
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

function getUniqueDoctorIds(appointments: Appointment[]): (number | null)[] {
  const set = new Set<number | null>();
  for (const a of appointments) set.add(a.doctorId);
  return Array.from(set).sort((a, b) => {
    if (a === null) return -1;
    if (b === null) return 1;
    return a - b;
  });
}
// ------------------------------------------------------------

function AppointmentForm({ onCreated }: { onCreated: (a: Appointment) => void }) {
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    branchId: "",
    scheduledAt: "",
    status: "booked",
    notes: "",
  });
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: Number(form.patientId),
          doctorId: form.doctorId ? Number(form.doctorId) : null,
          branchId: Number(form.branchId),
          scheduledAt: form.scheduledAt, // e.g. 2025-12-04T10:00
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
        setForm({
          patientId: "",
          doctorId: "",
          branchId: "",
          scheduledAt: "",
          status: "booked",
          notes: "",
        });
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
        gap: 8,
        gridTemplateColumns: "repeat(6, 1fr)",
      }}
    >
      <input
        name="patientId"
        placeholder="Patient ID"
        value={form.patientId}
        onChange={handleChange}
        required
      />
      <input
        name="doctorId"
        placeholder="Doctor ID (optional)"
        value={form.doctorId}
        onChange={handleChange}
      />
      <input
        name="branchId"
        placeholder="Branch ID"
        value={form.branchId}
        onChange={handleChange}
        required
      />
      <input
        name="scheduledAt"
        placeholder="2025-12-04T10:00"
        value={form.scheduledAt}
        onChange={handleChange}
        required
      />
      <select name="status" value={form.status} onChange={handleChange}>
        <option value="booked">Захиалсан</option>
        <option value="ongoing">Явагдаж байна</option>
        <option value="completed">Дууссан</option>
        <option value="cancelled">Цуцлагдсан</option>
      </select>
      <input
        name="notes"
        placeholder="Тэмдэглэл"
        value={form.notes}
        onChange={handleChange}
      />
      <button type="submit" style={{ gridColumn: "span 6" }}>
        Цаг захиалах
      </button>
    </form>
  );
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState("");

  const groupedAppointments = groupByDate(appointments);

  // Simple: show today as the reference day for the time grid
  const today = new Date();
  const timeSlots = generateTimeSlotsForDay(today);
  const doctorIds = getUniqueDoctorIds(appointments);

  useEffect(() => {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then(setAppointments)
      .catch(() => setError("Сүлжээгээ шалгана уу"));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Цаг захиалга</h1>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <AppointmentForm
        onCreated={(a) => setAppointments((as) => [a, ...as])}
      />

      {/* Day-grouped mini calendar */}
      <div style={{ marginTop: 24 }}>
        <h2>Календарь (өдрөөр)</h2>
        {groupedAppointments.length === 0 && (
          <div>Цаг захиалга алга</div>
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
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 10,
                backgroundColor: "#fafafa",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 8 }}>
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
                          : "#e6f0ff", // booked
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>
                      {new Date(a.scheduledAt).toLocaleTimeString("mn-MN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      —{" "}
                      {a.patient
                        ? `${a.patient.name}`
                        : `Patient #${a.patientId}`}
                    </div>
                    <div>
                      Эмч: {a.doctorId ?? "-"} | Салбар: {a.branchId}
                    </div>
                    <div>Тайлбар: {a.notes || "-"}</div>
                    <div>Статус: {a.status}</div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Time grid by doctor */}
      <div style={{ marginTop: 32 }}>
        <h2>Өдрийн цагийн хүснэгт (эмчээр)</h2>
        {appointments.length === 0 && <div>Цаг захиалга алга</div>}
        {appointments.length > 0 && (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
              fontSize: 12,
            }}
          >
            {/* Header row: empty corner + doctor names */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `80px repeat(${doctorIds.length}, 1fr)`,
                backgroundColor: "#f5f5f5",
                borderBottom: "1px solid #ddd",
              }}
            >
              <div style={{ padding: 8, fontWeight: "bold" }}>Цаг</div>
              {doctorIds.map((docId, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 8,
                    fontWeight: "bold",
                    textAlign: "center",
                    borderLeft: "1px solid #ddd",
                  }}
                >
                  Эмч: {docId ?? "Тодорхойгүй"}
                </div>
              ))}
            </div>

            {/* Time rows */}
            <div>
              {timeSlots.map((slot, rowIndex) => (
                <div
                  key={rowIndex}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${doctorIds.length}, 1fr)`,
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

                  {/* One cell per doctor for this time slot */}
                  {doctorIds.map((docId, colIndex) => {
                    const appsForCell = appointments.filter((a) => {
                      const t = new Date(a.scheduledAt);
                      return (
                        (a.doctorId === docId ||
                          (a.doctorId === null && docId === null)) &&
                        t >= slot.start &&
                        t < slot.end
                      );
                    });

                    const bg =
                      appsForCell.length === 0
                        ? "#ffffff"
                        : appsForCell[0].status === "completed"
                        ? "#e0f7e9"
                        : appsForCell[0].status === "ongoing"
                        ? "#fff4e0"
                        : appsForCell[0].status === "cancelled"
                        ? "#fde0e0"
                        : "#e6f0ff"; // booked

                    return (
                      <div
                        key={colIndex}
                        style={{
                          padding: 4,
                          borderLeft: "1px solid #f0f0f0",
                          backgroundColor: bg,
                          minHeight: 28,
                        }}
                      >
                        {appsForCell.map((a) => (
                          <div key={a.id}>
                            {a.patient
                              ? a.patient.name
                              : `Patient #${a.patientId}`}{" "}
                            ({a.status})
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
      </div>

      {/* Original table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 20,
        }}
      >
        <thead>
          <tr>
            <th>ID</th>
            <th>Patient</th>
            <th>Branch</th>
            <th>Doctor</th>
            <th>Scheduled</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>
                {a.patient
                  ? `${a.patient.name} (${a.patientId})`
                  : a.patientId}
              </td>
              <td>{a.branchId}</td>
              <td>{a.doctorId ?? "-"}</td>
              <td>{new Date(a.scheduledAt).toLocaleString()}</td>
              <td>{a.status}</td>
              <td>{a.notes || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

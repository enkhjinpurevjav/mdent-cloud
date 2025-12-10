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
  const entries = Object.entries(map).sort(([d1], [d2]) => (d1 < d2 ? -1 : d1 > d2 ? 1 : 0));
  return entries;
}

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

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
    <form onSubmit={handleSubmit} style={{ marginBottom: 24, display: "grid", gap: 8, gridTemplateColumns: "repeat(6, 1fr)" }}>
      <input name="patientId" placeholder="Patient ID" value={form.patientId} onChange={handleChange} required />
      <input name="doctorId" placeholder="Doctor ID (optional)" value={form.doctorId} onChange={handleChange} />
      <input name="branchId" placeholder="Branch ID" value={form.branchId} onChange={handleChange} required />
      <input name="scheduledAt" placeholder="2025-12-04T10:00" value={form.scheduledAt} onChange={handleChange} required />
      <select name="status" value={form.status} onChange={handleChange}>
        <option value="booked">Захиалсан</option>
        <option value="ongoing">Явагдаж байна</option>
        <option value="completed">Дууссан</option>
        <option value="cancelled">Цуцлагдсан</option>
      </select>
      <input name="notes" placeholder="Тэмдэглэл" value={form.notes} onChange={handleChange} />
      <button type="submit" style={{ gridColumn: "span 6" }}>Цаг захиалах</button>
    </form>
  );
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState("");

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
      <AppointmentForm onCreated={(a) => setAppointments((as) => [a, ...as])} />

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
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
              <td>{a.patient ? `${a.patient.name} (${a.patientId})` : a.patientId}</td>
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

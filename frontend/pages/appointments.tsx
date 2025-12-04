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
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: Number(form.patientId),
          doctorId: form.doctorId ? Number(form.doctorId) : null,
          branchId: Number(form.branchId),
          scheduledAt: form.scheduledAt, // e.g., 2025-12-04T10:00:00Z
          status: form.status,
          notes: form.notes || null,
        }),
      });
      let data: any = null;
      try { data = await res.json(); } catch {}
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
        setError((data && data.error) || "Бүртгэл амжилтгүй боллоо");
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24, display: "grid", gap: 8, gridTemplateColumns: "repeat(6, 1fr)" }}>
      <input name="patientId" placeholder="Patient ID" value={form.patientId} onChange={handleChange} required />
      <input name="doctorId" placeholder="Doctor ID (optional)" value={form.doctorId} onChange={handleChange} />
      <input name="branchId" placeholder="Branch ID" value={form.branchId} onChange={handleChange} required />
      <input name="scheduledAt" placeholder="2025-12-04T10:00:00Z" value={form.scheduledAt} onChange={handleChange} required />
      <select name="status" value={form.status} onChange={handleChange}>
        <option value="booked">Захиалсан</option>
        <option value="ongoing">Явагдаж байна</option>
        <option value="completed">Дууссан</option>
        <option value="cancelled">Цуцлагдсан</option>
      </select>
      <input name="notes" placeholder="Тэмдэглэл" value={form.notes} onChange={handleChange} />

      {/* Visible submit button */}
      <button type="submit" disabled={submitting} style={{ gridColumn: "span 6" }}>
        {submitting ? "Хадгалж байна..." : "Цаг захиалах"}
      </button>

      {error && <div style={{ color: "red", gridColumn: "span 6" }}>{error}</div>}
    </form>
  );
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/appointments");
        let data: any = null;
        try { data = await res.json(); } catch {}
        if (res.ok) setAppointments(data as Appointment[]);
        else setError((data && data.error) || "Цагийн жагсаалтыг ачааллаж чадсангүй");
      } catch {
        setError("Сүлжээгээ шалгана уу");
      }
    })();
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
          {appointments.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", color: "#888" }}>Одоогоор цаг захиалга алга</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

import React, { useState, useEffect } from "react";

function PatientRegisterForm({ onSuccess }) {
  const [form, setForm] = useState({
    ovog: "",
    name: "",
    regNo: "",
    phone: "",
    branchId: "",
    bookNumber: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, branchId: Number(form.branchId) }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null; // non-JSON (e.g., HTML 404)
      }

      if (res.ok) {
        onSuccess && onSuccess(data);
        setForm({
          ovog: "",
          name: "",
          regNo: "",
          phone: "",
          branchId: "",
          bookNumber: "",
        });
      } else {
        setError((data && data.error) || "Алдаа гарлаа"); // generic message
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <h2>Шинэ үйлчлүүлэгч бүртгэх</h2>
      <input name="ovog" placeholder="Овог" value={form.ovog} onChange={handleChange} required />
      <input name="name" placeholder="Нэр" value={form.name} onChange={handleChange} required />
      <input name="regNo" placeholder="Регистрийн дугаар" value={form.regNo} onChange={handleChange} required />
      <input name="phone" placeholder="Утасны дугаар" value={form.phone} onChange={handleChange} required />
      <input name="branchId" placeholder="Салбарын ID" value={form.branchId} onChange={handleChange} required />
      <input name="bookNumber" placeholder="Картын дугаар" value={form.bookNumber} onChange={handleChange} required />
      <button type="submit" disabled={submitting}>{submitting ? "Бүртгэж байна..." : "Бүртгэх"}</button>
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
    </form>
  );
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPatients = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/patients");
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (res.ok && Array.isArray(data)) {
        setPatients(data);
      } else {
        setError((data && data.error) || "Пациентын жагсаалтыг ачааллаж чадсангүй");
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Үйлчлүүлэгчийн бүртгэл</h1>

      <PatientRegisterForm
        onSuccess={(p) => {
          // Optimistically add; also refetch to stay in sync if needed
          setPatients((ps) => [p, ...ps]);
          // Optionally re-fetch from server:
          // loadPatients();
        }}
      />

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Овог</th>
              <th>Нэр</th>
              <th>Регистрийн дугаар</th>
              <th>Утас</th>
              <th>Картын дугаар</th>
              <th>Салбар</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.ovog}</td>
                <td>{p.name}</td>
                <td>{p.regNo}</td>
                <td>{p.phone}</td>
                <td>{p.patientBook?.bookNumber}</td>
                <td>{p.branchId}</td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#888" }}>
                  Өгөгдөл алга
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

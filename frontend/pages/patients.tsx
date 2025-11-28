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

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
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
        setError(data.error || "Алдаа гарлаа");
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
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
      <input name="bookNumber" placeholder="Номын дугаар" value={form.bookNumber} onChange={handleChange} required />
      <button type="submit">Бүртгэх</button>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </form>
  );
}

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  useEffect(() => {
    fetch("/api/patients")
      .then(res => res.json())
      .then(setPatients)
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Үйлчлүүлэгчийн бүртгэл</h1>
      <PatientRegisterForm onSuccess={p => setPatients(ps => [p, ...ps])} />
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
          {patients.map(p => (
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
        </tbody>
      </table>
    </div>
  );
}

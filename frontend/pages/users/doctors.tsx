// frontend/pages/users/doctors.tsx
import React, { useEffect, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  email: string;
  name?: string;
  role: string;
  branchId?: number | null;
  branch?: Branch | null;
  regNo?: string | null;
  licenseNumber?: string | null;
  licenseExpiryDate?: string | null;
  createdAt?: string;
};

function DoctorForm({
  branches,
  onSuccess,
}: {
  branches: Branch[];
  onSuccess: (d: Doctor) => void;
}) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    branchId: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload = {
        email: form.email,
        password: form.password,
        name: form.name || undefined,
        role: "doctor",
        branchId: form.branchId ? Number(form.branchId) : undefined,
      };

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok) {
        onSuccess(data);
        setForm({
          email: "",
          password: "",
          name: "",
          branchId: "",
        });
      } else {
        setError((data && data.error) || "Алдаа гарлаа");
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <h2>Шинэ эмч бүртгэх</h2>
      <input
        name="email"
        type="email"
        placeholder="И-мэйл"
        value={form.email}
        onChange={handleChange}
        required
      />
      <input
        name="password"
        type="password"
        placeholder="Нууц үг"
        value={form.password}
        onChange={handleChange}
        required
      />
      <input
        name="name"
        placeholder="Нэр"
        value={form.name}
        onChange={handleChange}
      />
      <select
        name="branchId"
        value={form.branchId}
        onChange={handleChange}
        required
      >
        <option value="">Салбар сонгох</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <button type="submit" disabled={submitting}>
        {submitting ? "Бүртгэж байна..." : "Бүртгэх"}
      </button>

      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
    </form>
  );
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBranches = async () => {
    const res = await fetch("/api/branches");
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      setBranches(data);
    }
  };

  const loadDoctors = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users?role=doctor");
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok && Array.isArray(data)) {
        setDoctors(data);
      } else {
        setError(
          (data && data.error) || "Эмч нарын жагсаалтыг ачааллаж чадсангүй"
        );
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
    loadDoctors();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Эмч нар</h1>

      <DoctorForm
        branches={branches}
        onSuccess={(d) => {
          setDoctors((ds) => [d, ...ds]);
        }}
      />

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && (
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}
        >
          <thead>
            <tr>
              <th>ID</th>
              <th>Нэр</th>
              <th>И-мэйл</th>
              <th>Салбар</th>
              <th>Бүртгэгдсэн</th>
              <th>Дэлгэрэнгүй</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.name || "-"}</td>
                <td>{d.email}</td>
                <td>{d.branch ? d.branch.name : "-"}</td>
                <td>
                  {d.createdAt
                    ? new Date(d.createdAt).toLocaleString("mn-MN")
                    : ""}
                </td>
                <td>
  <a href={`/users/doctors/${d.id}`}>Профайл</a>
</td>
              </tr>
            ))}
            {doctors.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "#888" }}>
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

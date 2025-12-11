import React, { useEffect, useState } from "react";
import UsersTabs from "../../components/UsersTabs";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
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
    ovog: "",
    regNo: "",
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
      const payload: any = {
        email: form.email,
        password: form.password,
        name: form.name || undefined,
        ovog: form.ovog || undefined,
        role: "doctor",
        branchId: form.branchId ? Number(form.branchId) : undefined,
      };

      // only send regNo if filled in
      if (form.regNo.trim()) {
        payload.regNo = form.regNo.trim();
      }

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
          ovog: "",
          regNo: "",
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 8,
          marginBottom: 8,
        }}
      >
        {/* 1. Овог */}
        <input
          name="ovog"
          placeholder="Овог"
          value={form.ovog}
          onChange={handleChange}
          required
        />
        {/* 2. Нэр */}
        <input
          name="name"
          placeholder="Нэр"
          value={form.name}
          onChange={handleChange}
          required
        />
        {/* 3. РД */}
        <input
          name="regNo"
          placeholder="РД"
          value={form.regNo}
          onChange={handleChange}
        />
        {/* 4. И-мэйл */}
        <input
          name="email"
          type="email"
          placeholder="И-мэйл"
          value={form.email}
          onChange={handleChange}
          required
        />
        {/* 5. Нууц үг */}
        <input
          name="password"
          type="password"
          placeholder="Нууц үг"
          value={form.password}
          onChange={handleChange}
          required
        />
        {/* 6. Салбар сонгох */}
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
      </div>

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
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setBranches(data);
      }
    } catch {
      // ignore here, main error handling is in doctors load
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
    <main
      style={{
        maxWidth: 700,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Эмч нар</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Эмч нарыг бүртгэх, салбарт хуваарилах, профайлыг харах.
      </p>

      <UsersTabs />

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
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 20,
            fontSize: 14,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                ID
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Овог
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Нэр
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                РД
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                И-мэйл
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Салбар
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Бүртгэгдсэн
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Дэлгэрэнгүй
              </th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((d) => (
              <tr key={d.id}>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.id}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.ovog || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.name || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.regNo || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.email}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.branch ? d.branch.name : "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.createdAt
                    ? new Date(d.createdAt).toLocaleString("mn-MN")
                    : ""}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  <a href={`/users/doctors/${d.id}`}>Профайл</a>
                </td>
              </tr>
            ))}
            {doctors.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: "center",
                    color: "#888",
                    padding: 12,
                  }}
                >
                  Өгөгдөл алга
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}

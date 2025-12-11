import React, { useEffect, useState } from "react";
import UsersTabs from "../../components/UsersTabs";

type Branch = {
  id: number;
  name: string;
};

type Nurse = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
  role: string;
  branchId?: number | null;
  branch?: Branch | null;
  createdAt?: string;
};

function NurseForm({
  branches,
  onSuccess,
}: {
  branches: Branch[];
  onSuccess: (u: Nurse) => void;
}) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    ovog: "",
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
        ovog: form.ovog || undefined,
        role: "nurse", // IMPORTANT: matches enum UserRole
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
          ovog: "",
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
      <h2>Шинэ сувилагч бүртгэх</h2>
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
      <input
        name="ovog"
        placeholder="Овог"
        value={form.ovog}
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

export default function NursesPage() {
  const [users, setUsers] = useState<Nurse[]>([]);
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
      // ignore here
    }
  };

  const loadNurses = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users?role=nurse");
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok && Array.isArray(data)) {
        setUsers(data);
      } else {
        setError(
          (data && data.error) ||
            "Сувилагч хэрэглэгчдийн жагсаалтыг ачааллаж чадсангүй"
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
    loadNurses();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Сувилагч</h1>

      <UsersTabs />

      <NurseForm
        branches={branches}
        onSuccess={(u) => {
          setUsers((prev) => [u, ...prev]);
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
              <th>Овог</th>
              <th>И-мэйл</th>
              <th>Салбар</th>
              <th>Бүртгэгдсэн</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.name || "-"}</td>
                <td>{u.ovog || "-"}</td>
                <td>{u.email}</td>
                <td>{u.branch ? u.branch.name : "-"}</td>
                <td>
                  {u.createdAt
                    ? new Date(u.createdAt).toLocaleString("mn-MN")
                    : ""}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
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

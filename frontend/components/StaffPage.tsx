import React, { useEffect, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type User = {
  id: number;
  email: string;
  name?: string | null;
  role: string;
  branchId?: number | null;
  branch?: Branch | null;
  createdAt?: string;
};

type StaffPageProps = {
  role: "doctor" | "receptionist" | "nurse" | "accountant" | "manager";
  title: string; // e.g. "Doctors", "Receptionists"
};

function StaffForm({
  role,
  branches,
  onSuccess,
}: {
  role: StaffPageProps["role"];
  branches: Branch[];
  onSuccess: (u: User) => void;
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
        role, // doctor / receptionist / nurse / ...
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
        setError((data && data.error) || "Error occurred");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <h2>Create new {role}</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
        />
        <input
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={handleChange}
        />
        <select
          name="branchId"
          value={form.branchId}
          onChange={handleChange}
          required
        >
          <option value="">Select branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
      {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}
    </form>
  );
}

export default function StaffPage({ role, title }: StaffPageProps) {
  const [users, setUsers] = useState<User[]>([]);
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
    } catch (e) {
      console.error("Error loading branches", e);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/users?role=${encodeURIComponent(role)}`);
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
          (data && data.error) || `Failed to load ${title.toLowerCase()}`
        );
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
    loadUsers();
  }, [role]);

  return (
    <div style={{ padding: 24 }}>
      <h1>{title}</h1>

      <StaffForm
        role={role}
        branches={branches}
        onSuccess={(u) => setUsers((list) => [u, ...list])}
      />

      {loading && <div>Loading...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 20,
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>ID</th>
              <th style={{ textAlign: "left" }}>Name</th>
              <th style={{ textAlign: "left" }}>Email</th>
              <th style={{ textAlign: "left" }}>Role</th>
              <th style={{ textAlign: "left" }}>Branch</th>
              <th style={{ textAlign: "left" }}>Created at</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.name || "-"}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
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
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

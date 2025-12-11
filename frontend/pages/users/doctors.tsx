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
  branches?: Branch[]; // all assigned branches (via DoctorBranch)
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
    branchIds: [] as number[],
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBranchToggle = (branchId: number) => {
    setForm((prev) => {
      const exists = prev.branchIds.includes(branchId);
      if (exists) {
        return {
          ...prev,
          branchIds: prev.branchIds.filter((id) => id !== branchId),
        };
      }
      return {
        ...prev,
        branchIds: [...prev.branchIds, branchId],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const primaryBranchId =
        form.branchIds.length > 0 ? form.branchIds[0] : undefined;

      const payload: any = {
        email: form.email,
        password: form.password,
        name: form.name || undefined,
        ovog: form.ovog || undefined,
        role: "doctor",
        branchId: primaryBranchId,
      };

      if (form.regNo.trim()) {
        payload.regNo = form.regNo.trim();
      }

      // 1) create doctor
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

      if (!res.ok || !data || !data.id) {
        setError((data && data.error) || "Алдаа гарлаа");
        setSubmitting(false);
        return;
      }

      const createdDoctor = data as Doctor;

      // 2) assign multiple branches via /api/users/:id/branches
      if (form.branchIds.length > 0) {
        try {
          const resBranches = await fetch(
            `/api/users/${createdDoctor.id}/branches`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ branchIds: form.branchIds }),
            }
          );
          let branchesData: any = null;
          try {
            branchesData = await resBranches.json();
          } catch {
            branchesData = null;
          }

          if (
            resBranches.ok &&
            branchesData &&
            Array.isArray(branchesData.branches)
          ) {
            createdDoctor.branches = branchesData.branches;
          }
        } catch (e) {
          console.error("Failed to assign multiple branches", e);
        }
      }

      onSuccess(createdDoctor);

      setForm({
        email: "",
        password: "",
        name: "",
        ovog: "",
        regNo: "",
        branchIds: [],
      });
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
        {/* Овог */}
        <input
          name="ovog"
          placeholder="Овог"
          value={form.ovog}
          onChange={handleChange}
          required
        />
        {/* Нэр */}
        <input
          name="name"
          placeholder="Нэр"
          value={form.name}
          onChange={handleChange}
          required
        />
        {/* РД */}
        <input
          name="regNo"
          placeholder="РД"
          value={form.regNo}
          onChange={handleChange}
        />
        {/* И-мэйл */}
        <input
          name="email"
          type="email"
          placeholder="И-мэйл"
          value={form.email}
          onChange={handleChange}
          required
        />
        {/* Нууц үг */}
        <input
          name="password"
          type="password"
          placeholder="Нууц үг"
          value={form.password}
          onChange={handleChange}
          required
        />
      </div>

      {/* Multi-branch selection */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ marginBottom: 4, fontWeight: 500 }}>Салбар сонгох</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {branches.map((b) => (
            <label
              key={b.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                border: "1px solid #ddd",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={form.branchIds.includes(b.id)}
                onChange={() => handleBranchToggle(b.id)}
              />
              {b.name}
            </label>
          ))}
        </div>
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
        {/* main (legacy) branch */}
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
          whiteSpace: "nowrap",
        }}
      >
        {/* Профайл button */}
        <a
          href={`/users/doctors/${d.id}`}
          style={{
            display: "inline-block",
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid #2563eb",
            color: "#2563eb",
            textDecoration: "none",
            fontSize: 12,
            marginRight: 8,
          }}
        >
          Профайл
        </a>

        {/* optional: show count of branches */}
        {Array.isArray(d.branches) && d.branches.length > 0 && (
          <span style={{ fontSize: 12, color: "#555" }}>
            {d.branches.length} салбар
          </span>
        )}
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

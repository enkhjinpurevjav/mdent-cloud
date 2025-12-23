import React, { useEffect, useState } from "react";
import UsersTabs from "../../components/UsersTabs";

type Branch = {
  id: number;
  name: string;
};

type Receptionist = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
  role: string;
  regNo?: string | null;
  phone?: string | null;
  branchId?: number | null;
  branch?: Branch | null;
  branches?: Branch[];
  createdAt?: string;
};

function ReceptionForm({
  branches,
  onSuccess,
}: {
  branches: Branch[];
  onSuccess: (u: Receptionist) => void;
}) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    ovog: "",
    regNo: "",
    phone: "",
    branchIds: [] as number[],
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBranchToggle = (branchId: number) => {
    setForm((prev) => {
      const exists = prev.branchIds.includes(branchId);
      return {
        ...prev,
        branchIds: exists
          ? prev.branchIds.filter((id) => id !== branchId)
          : [...prev.branchIds, branchId],
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
        role: "receptionist",
        branchId: primaryBranchId,
        phone: form.phone || undefined,
      };

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

      if (!res.ok || !data || !data.id) {
        setError((data && data.error) || "Алдаа гарлаа");
        setSubmitting(false);
        return;
      }

      const createdUser = data as Receptionist;

      if (form.branchIds.length > 0) {
        try {
          const resBranches = await fetch(
            `/api/users/${createdUser.id}/branches`,
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
            createdUser.branches = branchesData.branches;
          }
        } catch (e) {
          console.error("Failed to assign multiple branches", e);
        }
      }

      onSuccess(createdUser);

      setForm({
        email: "",
        password: "",
        name: "",
        ovog: "",
        regNo: "",
        phone: "",
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
      <h2>Шинэ ресепшн бүртгэх</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <input
          name="ovog"
          placeholder="Овог"
          value={form.ovog}
          onChange={handleChange}
          required
        />
        <input
          name="name"
          placeholder="Нэр"
          value={form.name}
          onChange={handleChange}
          required
        />
        <input
          name="regNo"
          placeholder="РД"
          value={form.regNo}
          onChange={handleChange}
        />
        <input
          name="phone"
          placeholder="Утас"
          value={form.phone}
          onChange={handleChange}
        />
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

export default function ReceptionPage() {
  const [users, setUsers] = useState<Receptionist[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // NEW: summary state (same as doctors)
  const [summary, setSummary] = useState<{
    total: number;
    workingToday: number;
  } | null>(null);

  // editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    ovog: string;
    regNo: string;
    phone: string;
    branchId: number | null;
    editBranchIds: number[];
  }>({
    name: "",
    ovog: "",
    regNo: "",
    phone: "",
    branchId: null,
    editBranchIds: [],
  });

  const loadBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setBranches(data);
      }
    } catch {
      // ignore; main error handling below
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users?role=receptionist");
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !Array.isArray(data)) {
        throw new Error((data && data.error) || "Алдаа гарлаа");
      }

      setUsers(
        [...data].sort((a, b) => {
          const aName = (a.name || "").toString();
          const bName = (b.name || "").toString();
          return aName.localeCompare(bName, "mn");
        })
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Сүлжээгээ шалгана уу");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // NEW: load summary for reception
  const loadSummary = async () => {
    try {
      const res = await fetch("/api/staff/summary?role=receptionist");
      const data = await res.json().catch(() => null);
      if (res.ok && data && typeof data.total === "number") {
        setSummary({
          total: data.total,
          workingToday: data.workingToday || 0,
        });
      } else {
        setSummary(null);
      }
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => {
    loadBranches();
    loadUsers();
    loadSummary();
  }, []);

  const startEdit = (u: Receptionist) => {
    setEditingId(u.id);

    const currentBranchIds =
      Array.isArray(u.branches) && u.branches.length > 0
        ? u.branches.map((b) => b.id)
        : u.branch
        ? [u.branch.id]
        : [];

    setEditForm({
      name: u.name || "",
      ovog: u.ovog || "",
      regNo: u.regNo || "",
      phone: u.phone || "",
      branchId: u.branchId ?? (u.branch ? u.branch.id : null),
      editBranchIds: currentBranchIds,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]:
        name === "branchId"
          ? value
            ? Number(value)
            : null
          : value,
    }));
  };

  const handleEditBranchToggle = (branchId: number) => {
    setEditForm((prev) => {
      const exists = prev.editBranchIds.includes(branchId);
      const next = exists
        ? prev.editBranchIds.filter((id) => id !== branchId)
        : [...prev.editBranchIds, branchId];

      const nextPrimary = next.length > 0 ? next[0] : null;

      return {
        ...prev,
        editBranchIds: next,
        branchId: nextPrimary,
      };
    });
  };

  const saveEdit = async (id: number) => {
    try {
      const payload: any = {
        name: editForm.name || null,
        ovog: editForm.ovog || null,
        regNo: editForm.regNo || null,
        phone: editForm.phone || null,
        branchId: editForm.branchId || null,
      };

      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let userData: any = null;
      try {
        userData = await res.json();
      } catch {
        userData = null;
      }

      if (!res.ok || !userData || !userData.id) {
        alert((userData && userData.error) || "Хадгалах үед алдаа гарлаа");
        return;
      }

      const branchesPayload = { branchIds: editForm.editBranchIds };

      const resBranches = await fetch(`/api/users/${id}/branches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchesPayload),
      });

      let branchesResult: any = null;
      try {
        branchesResult = await resBranches.json();
      } catch {
        branchesResult = null;
      }

      if (!resBranches.ok) {
        alert(
          (branchesResult && branchesResult.error) ||
            "Салбар хадгалах үед алдаа гарлаа"
        );
        return;
      }

      const updatedBranches =
        branchesResult && Array.isArray(branchesResult.branches)
          ? branchesResult.branches
          : userData.branches || [];

      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                name: userData.name,
                ovog: userData.ovog,
                regNo: userData.regNo,
                phone: userData.phone,
                branchId: userData.branchId,
                branch: userData.branch,
                branches: updatedBranches,
              }
            : u
        )
      );
      setEditingId(null);
    } catch (err) {
      console.error(err);
      alert("Сүлжээгээ шалгана уу");
    }
  };

  const deleteUser = async (id: number) => {
    const ok = window.confirm(
      "Та энэхүү ресепшн ажилтныг устгахдаа итгэлтэй байна уу?"
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        alert((data && data.error) || "Устгах үед алдаа гарлаа");
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== id));
      loadSummary(); // update totals if you allow delete
    } catch (err) {
      console.error(err);
      alert("Сүлжээгээ шалгана уу");
    }
  };

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Ресепшн</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Ресепшн ажилчдыг бүртгэх, салбарт хуваарьлах, жагсаалтаар харах.
      </p>

      <UsersTabs />

      {/* summary cards, same design as doctors/patients */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: "linear-gradient(90deg,#eff6ff,#ffffff)",
            borderRadius: 12,
            border: "1px solid #dbeafe",
            padding: 12,
            boxShadow: "0 4px 10px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              color: "#1d4ed8",
              fontWeight: 700,
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            Нийт ресепшн
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 4,
            }}
          >
            {summary ? summary.total : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>
            Системд бүртгэлтэй нийт ресепшн ажилчдын тоо.
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(90deg,#dcfce7,#ffffff)",
            borderRadius: 12,
            border: "1px solid #bbf7d0",
            padding: 12,
            boxShadow: "0 4px 10px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              color: "#15803d",
              fontWeight: 700,
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            Өнөөдөр ажиллаж буй ресепшн
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 4,
            }}
          >
            {summary ? summary.workingToday : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>
            Өнөөдрийн ажлын хуваарьт орсон ресепшнүүдийн тоо.
          </div>
        </div>
      </section>

      <ReceptionForm
        branches={branches}
        onSuccess={(u) => {
          setUsers((prev) => [u, ...prev]);
          loadSummary();
        }}
      />

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 8,
            fontSize: 14,
          }}
        >
          {/* ... rest of your table and inline edit logic stays the same ... */}
          {/* (no need to change below this point except where you already removed Устгах from Doctors page) */}

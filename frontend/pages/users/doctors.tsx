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
  branches?: Branch[];
  regNo?: string | null;
  licenseNumber?: string | null;
  licenseExpiryDate?: string | null;
  phone?: string | null;
  createdAt?: string;
  calendarOrder?: number | null;
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
        role: "doctor",
        branchId: primaryBranchId,
      };

      if (form.regNo.trim()) {
        payload.regNo = form.regNo.trim();
      }
      if (form.phone.trim()) {
        payload.phone = form.phone.trim();
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

      const createdDoctor = data as Doctor;

      // assign multiple branches
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
        } catch (err) {
          console.error("Failed to assign multiple branches", err);
        }
      }

      onSuccess(createdDoctor);

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
      <h2>Шинэ эмч бүртгэх</h2>
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

// Stable comparator: null/undefined calendarOrder sorts to the bottom, then tie-break by name
function doctorComparator(a: Doctor, b: Doctor): number {
  const ao = a.calendarOrder != null ? a.calendarOrder : Number.MAX_SAFE_INTEGER;
  const bo = b.calendarOrder != null ? b.calendarOrder : Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return (a.name || "").localeCompare(b.name || "", "mn");
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reorderSaving, setReorderSaving] = useState(false);

  const [summary, setSummary] = useState<{
    total: number;
    workingToday: number;
  } | null>(null);

  const loadBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setBranches(data);
      }
    } catch {
      // ignore
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
        const sorted = [...data].sort(doctorComparator);
        setDoctors(sorted);
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

  const loadSummary = async () => {
    try {
      const res = await fetch("/api/staff/summary?role=doctor");
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
    loadDoctors();
    loadSummary();
  }, []);

  const moveDoctor = async (doctorId: number, direction: "up" | "down") => {
    if (reorderSaving) return;
    const idx = doctors.findIndex((d) => d.id === doctorId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === doctors.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;

    // Snapshot previous state for rollback on failure
    const prevDoctors = doctors;

    // Swap the two entries by index and renumber to eliminate duplicates
    const reordered = [...doctors];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const renumbered = reordered.map((d, i) => ({ ...d, calendarOrder: i * 10 }));

    // Only persist doctors whose calendarOrder actually changed
    const changedDoctors = renumbered.filter((d) => {
      const old = prevDoctors.find((p) => p.id === d.id);
      return old?.calendarOrder !== d.calendarOrder;
    });

    setDoctors(renumbered);
    setReorderSaving(true);
    try {
      const results = await Promise.all(
        changedDoctors.map((d) =>
          fetch(`/api/users/${d.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ calendarOrder: d.calendarOrder }),
          })
        )
      );
      if (results.some((r) => !r.ok)) {
        throw new Error("Failed to update calendarOrder");
      }
    } catch (err) {
      console.error("Failed to update calendarOrder", err);
      setDoctors(prevDoctors);
      setError("Дараалал хадгалахад алдаа гарлаа");
    } finally {
      setReorderSaving(false);
    }
  };

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Эмч нар</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Эмч нарыг бүртгэх, салбарт хуваарьлах, профайлыг харах.
      </p>

      <UsersTabs />

      {/* summary cards */}
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
            Нийт эмч
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
            Системд бүртгэлтэй нийт эмчийн тоо.
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
            Өнөөдөр ажиллаж буй эмч
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
            Өнөөдрийн ажлын хуваарьт орсон эмч нарын тоо.
          </div>
        </div>
      </section>

      <DoctorForm
        branches={branches}
        onSuccess={(d) => {
          setDoctors((prev) => {
            // Assign calendarOrder after all explicitly-ordered doctors (ignore nulls)
            const maxOrder = prev.reduce(
              (max, doc) => (doc.calendarOrder != null ? Math.max(max, doc.calendarOrder) : max),
              -10
            );
            const newDoctor = { ...d, calendarOrder: maxOrder + 10 };
            return [...prev, newDoctor].sort(doctorComparator);
          });
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
            marginTop: 20,
            fontSize: 14,
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                #
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Овог
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Нэр
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                РД
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Утас
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Салбар
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Дараалал
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Дэлгэрэнгүй
              </th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((d, index) => (
              <tr key={d.id}>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                  {index + 1}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                  {d.ovog || "-"}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                  {d.name || "-"}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                  {d.regNo || "-"}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                  {d.phone || "-"}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                  {Array.isArray(d.branches) && d.branches.length > 0
                    ? d.branches.map((b) => b.name).join(", ")
                    : d.branch
                    ? d.branch.name
                    : "-"}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                  {(() => {
                    const isUpDisabled = index === 0 || reorderSaving;
                    const isDownDisabled = index === doctors.length - 1 || reorderSaving;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button
                          type="button"
                          onClick={() => moveDoctor(d.id, "up")}
                          disabled={isUpDisabled}
                          style={{
                            fontSize: 11,
                            padding: "1px 6px",
                            cursor: isUpDisabled ? "default" : "pointer",
                            opacity: isUpDisabled ? 0.3 : 1,
                          }}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDoctor(d.id, "down")}
                          disabled={isDownDisabled}
                          style={{
                            fontSize: 11,
                            padding: "1px 6px",
                            cursor: isDownDisabled ? "default" : "pointer",
                            opacity: isDownDisabled ? 0.3 : 1,
                          }}
                        >
                          ▼
                        </button>
                      </div>
                    );
                  })()}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                    whiteSpace: "nowrap",
                  }}
                >
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
                    }}
                  >
                    Профайл
                  </a>
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

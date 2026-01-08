import React, { useEffect, useMemo, useState } from "react";

type EmployeeBenefitRow = {
  userId: number;
  ovog?: string;
  name?: string;
  email: string;
  role: string;

  // Option A: one active benefit per employee
  benefitId: number;
  code: string;
  initialAmount: number;
  remainingAmount: number;
  fromDate?: string | null;
  toDate?: string | null;
  isActive: boolean;

  // summary
  totalAmount: number;
  usedAmount: number;

  createdAt?: string;
  updatedAt?: string;
};

function formatEmployeeName(r: EmployeeBenefitRow) {
  const ovog = (r.ovog || "").trim();
  const name = (r.name || "").trim();
  if (!ovog) return name || r.email || String(r.userId);
  return `${ovog.charAt(0)}. ${name || r.email || String(r.userId)}`;
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("mn-MN").format(Number(v || 0));
}

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("mn-MN");
  } catch {
    return iso;
  }
}

function formatDateInputValue(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    doctor: "Эмч",
    nurse: "Сувилагч",
    accountant: "Нягтлан",
    receptionist: "Ресепшн",
    manager: "Менежер",
    admin: "Админ",
  };
  return map[role] || role;
}

export default function EmployeeVouchersPage() {
  const [rows, setRows] = useState<EmployeeBenefitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // add modal
  const [addOpen, setAddOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [code, setCode] = useState("");
  const [initialAmount, setInitialAmount] = useState("");

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeBenefitRow | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editInitialAmount, setEditInitialAmount] = useState("");
  const [editRemainingAmount, setEditRemainingAmount] = useState("");
  const [editFromDate, setEditFromDate] = useState("");
  const [editToDate, setEditToDate] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/employee-benefits");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to load employee benefits");
      setRows((data?.employees || []) as EmployeeBenefitRow[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load employee benefits");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRemove = async (userId: number) => {
    if (!confirm("Ажилтны ваучер эрхийг идэвхгүй болгож жагсаалтаас хасах уу?")) return;
    try {
      const res = await fetch(`/api/admin/employee-benefits/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to remove");
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to remove");
    }
  };

  const openEdit = (row: EmployeeBenefitRow) => {
    setEditing(row);
    setEditCode(row.code || "");
    setEditInitialAmount(String(row.initialAmount ?? ""));
    setEditRemainingAmount(String(row.remainingAmount ?? ""));
    setEditFromDate(formatDateInputValue(row.fromDate));
    setEditToDate(formatDateInputValue(row.toDate));
    setEditIsActive(!!row.isActive);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;

    const initNum = Number(editInitialAmount);
    const remNum = Number(editRemainingAmount);

    if (!editCode.trim()) {
      alert("Код хоосон байж болохгүй.");
      return;
    }
    if (!Number.isFinite(initNum) || initNum <= 0) {
      alert("Нийт эрхийн дүн зөв оруулна уу.");
      return;
    }
    if (!Number.isFinite(remNum) || remNum < 0) {
      alert("Үлдэгдэл зөв оруулна уу.");
      return;
    }
    if (remNum > initNum) {
      alert("Үлдэгдэл нь нийт эрхээс их байж болохгүй.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/employee-benefits/${editing.benefitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editCode.trim(),
          initialAmount: initNum,
          remainingAmount: remNum,
          fromDate: editFromDate ? editFromDate : null,
          toDate: editToDate ? editToDate : null,
          isActive: editIsActive,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to update benefit");

      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update benefit");
    }
  };

  const handleAdd = async () => {
    const idNum = Number(employeeId);
    const amtNum = Number(initialAmount);

    if (!idNum || Number.isNaN(idNum)) {
      alert("Employee ID зөв оруулна уу.");
      return;
    }
    if (!code.trim()) {
      alert("Код оруулна уу.");
      return;
    }
    if (!amtNum || Number.isNaN(amtNum) || amtNum <= 0) {
      alert("Нийт эрхийн дүн зөв оруулна уу.");
      return;
    }

    try {
      const res = await fetch("/api/admin/employee-benefits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: idNum,
          code: code.trim(),
          initialAmount: amtNum,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to add benefit");

      setAddOpen(false);
      setEmployeeId("");
      setCode("");
      setInitialAmount("");
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to add benefit");
    }
  };

  const sorted = useMemo(() => rows, [rows]);

  return (
    <main style={{ maxWidth: 1400, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Ажилчдын ваучер</h1>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            Зөвхөн ваучер/эрх (EmployeeBenefit) олгосон ажилтнууд энд харагдана.
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #16a34a",
            background: "#f0fdf4",
            color: "#166534",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          + Ажилтан нэмэх
        </button>
      </div>

      {loading && <div style={{ marginTop: 14 }}>Ачаалж байна...</div>}
      {!loading && error && <div style={{ marginTop: 14, color: "#b91c1c" }}>{error}</div>}

      {!loading && !error && (
        <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 140px 140px 140px 140px 170px 170px 160px 170px",
              gap: 10,
              padding: "10px 12px",
              background: "#f9fafb",
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
            }}
          >
            <div>Нэр</div>
            <div>Албан тушаал</div>
            <div style={{ textAlign: "right" }}>Нийт эрх</div>
            <div style={{ textAlign: "right" }}>Хэрэглэсэн</div>
            <div style={{ textAlign: "right" }}>Үлдэгдэл</div>
            <div>Created</div>
            <div>Updated</div>
            <div>Код</div>
            <div />
          </div>

          {sorted.map((r) => (
            <div
              key={r.userId}
              style={{
                display: "grid",
                gridTemplateColumns: "220px 140px 140px 140px 140px 170px 170px 160px 240px",
                gap: 10,
                padding: "10px 12px",
                borderTop: "1px solid #f3f4f6",
                fontSize: 13,
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 600 }}>{formatEmployeeName(r)}</div>
              <div style={{ color: "#374151" }}>{roleLabel(r.role)}</div>
              <div style={{ textAlign: "right" }}>{formatMoney(r.totalAmount)} ₮</div>
              <div style={{ textAlign: "right" }}>{formatMoney(r.usedAmount)} ₮</div>
              <div style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(r.remainingAmount)} ₮</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{formatDateTime(r.createdAt)}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{formatDateTime(r.updatedAt)}</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#374151" }}>{r.code}</div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "nowrap" }}>
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#2563eb",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Засах
                </button>

                <button
                  type="button"
                  onClick={() => handleRemove(r.userId)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #dc2626",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Устгах
                </button>
              </div>
            </div>
          ))}

          {sorted.length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: "#6b7280" }}>
              Одоогоор ямар ч ажилтанд ваучер эрх олгоогүй байна.
            </div>
          )}
        </div>
      )}

      {/* Add modal */}
      {addOpen && (
        <div
          onClick={() => setAddOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 560,
              maxWidth: "95vw",
              background: "#ffffff",
              borderRadius: 10,
              padding: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              fontSize: 13,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Ажилтанд ваучер эрх олгох</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#374151" }}>Employee ID</div>
                <input
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Жишээ: 6"
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#374151" }}>Код (EmployeeBenefit.code)</div>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Жишээ: EMPBAT001"
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#374151" }}>Нийт эрхийн дүн</div>
                <input
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  type="number"
                  min={0}
                  placeholder="Жишээ: 300000"
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #16a34a",
                    background: "#16a34a",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Хадгалах
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
              Түр хугацаанд Employee ID-г гараар оруулж байна. Дараа нь хайлтын dropdown болгоно.
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editOpen && editing && (
        <div
          onClick={() => {
            setEditOpen(false);
            setEditing(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 600,
              maxWidth: "95vw",
              background: "#ffffff",
              borderRadius: 10,
              padding: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              fontSize: 13,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Ваучер эрх засах: {formatEmployeeName(editing)}</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#374151" }}>Код</div>
                <input
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "#374151" }}>Нийт эрхийн дүн</div>
                  <input
                    value={editInitialAmount}
                    onChange={(e) => setEditInitialAmount(e.target.value)}
                    type="number"
                    min={0}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "#374151" }}>Үлдэгдэл</div>
                  <input
                    value={editRemainingAmount}
                    onChange={(e) => setEditRemainingAmount(e.target.value)}
                    type="number"
                    min={0}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "#374151" }}>From date</div>
                  <input
                    value={editFromDate}
                    onChange={(e) => setEditFromDate(e.target.value)}
                    type="date"
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "#374151" }}>To date</div>
                  <input
                    value={editToDate}
                    onChange={(e) => setEditToDate(e.target.value)}
                    type="date"
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                  />
                </label>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
                <span>Идэвхтэй</span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditing(null);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #2563eb",
                    background: "#2563eb",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Хадгалах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

import React, { useEffect, useMemo, useState } from "react";

type Branch = { id: number; name: string };

type ReportCard = {
  branchId: number;
  branchName: string;
  usedTotal: number;
};

type Staff = { id: number; name: string | null; ovog: string | null; email: string };

type ReportRow = {
  indicatorId: number;
  branchId: number;
  branchName: string;
  packageName: string;
  code: string;
  indicatorDate: string;
  createdAt: string;
  createdQuantity: number;
  usedQuantity: number;
  specialist: Staff | null;
};

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function staffLabel(u?: Staff | null) {
  if (!u) return "-";
  const full = `${u.name || ""}${u.ovog ? ` ${u.ovog}` : ""}`.trim();
  return full || u.email || "-";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export default function SterilizationReportsPage() {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState<string>(ymd(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState<string>(ymd(today));

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");

  const [cards, setCards] = useState<ReportCard[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const json = await res.json().catch(() => []);
      if (res.ok) setBranches(Array.isArray(json) ? json : []);
    } catch {
      // ignore
    }
  };

  const search = async () => {
    if (!from || !to) {
      setError("Огнооны муж сонгоно уу.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", to);
      if (branchId) params.set("branchId", String(branchId));

      const res = await fetch(`/api/sterilization/reports?${params.toString()}`);
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.error || "Тайлан ачааллах үед алдаа гарлаа");

      setCards(Array.isArray(json?.cards) ? json.cards : []);
      setRows(Array.isArray(json?.rows) ? json.rows : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 18, marginBottom: 6 }}>Ариутгалын тайлан</h1>
      <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
        Салбар тус бүрээр ашигласан (opened/used) индикаторын нийт тоо болон дэлгэрэнгүй жагсаалт.
      </div>

      {error && <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>{error}</div>}

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
        {cards.map((c, idx) => {
          const bg = idx % 4 === 0 ? "#dbeafe" : idx % 4 === 1 ? "#fef9c3" : idx % 4 === 2 ? "#fee2e2" : "#dcfce7";
          const color = idx % 4 === 0 ? "#1d4ed8" : idx % 4 === 1 ? "#a16207" : idx % 4 === 2 ? "#b91c1c" : "#15803d";
          return (
            <div
              key={c.branchId}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 14,
                background: bg,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: 0.3 }}>
                {c.branchName}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginTop: 6 }}>
                {c.usedTotal}
              </div>
              <div style={{ fontSize: 12, color: "#374151", marginTop: 4 }}>
                Сонгосон хугацаанд ашигласан багцын тоо
              </div>
            </div>
          );
        })}
        {cards.length === 0 && !loading && (
          <div style={{ fontSize: 13, color: "#6b7280" }}>Картын мэдээлэл олдсонгүй.</div>
        )}
      </div>

      {/* Search/Filter */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Хайлт</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Эхлэх огноо</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Дуусах огноо</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Салбар</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
              style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
            >
              <option value="">Бүх салбар</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="button"
              onClick={() => void search()}
              disabled={loading}
              style={{
                width: "100%",
                border: "none",
                background: "#2563eb",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 12px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {loading ? "Ачаалж байна..." : "Хайх"}
            </button>
          </div>
        </div>
      </div>

      {/* Result list */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#6b7280", borderBottom: "1px solid #f3f4f6" }}>
              <th style={{ padding: "10px 12px" }}>Салбар</th>
              <th style={{ padding: "10px 12px" }}>Нэр</th>
              <th style={{ padding: "10px 12px", width: 110 }}>Код</th>
              <th style={{ padding: "10px 12px", width: 130 }}>Үүсгэсэн огноо</th>
              <th style={{ padding: "10px 12px", width: 120 }}>Үүссэн тоо</th>
              <th style={{ padding: "10px 12px", width: 110 }}>Ашигласан</th>
              <th style={{ padding: "10px 12px", width: 220 }}>Сувилагч</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.indicatorId} style={{ borderTop: "1px solid #f3f4f6" }}>
                <td style={{ padding: "10px 12px" }}>{r.branchName}</td>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.packageName}</td>
                <td style={{ padding: "10px 12px" }}>{r.code}</td>
                <td style={{ padding: "10px 12px" }}>{formatDate(r.indicatorDate)}</td>
                <td style={{ padding: "10px 12px" }}>{r.createdQuantity}</td>
                <td style={{ padding: "10px 12px", fontWeight: 700 }}>{r.usedQuantity}</td>
                <td style={{ padding: "10px 12px" }}>{staffLabel(r.specialist)}</td>
              </tr>
            ))}

            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ padding: 14, color: "#6b7280" }}>
                  Сонгосон хугацаанд ашигласан индикатор олдсонгүй.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

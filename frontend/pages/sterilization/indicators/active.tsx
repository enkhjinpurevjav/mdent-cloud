import React, { useEffect, useMemo, useState } from "react";


type Branch = { id: number; name: string };

type Row = {
  id: number;
  branchId: number;
  branch?: Branch;
  packageName: string;
  code: string;
  indicatorDate: string;
  produced: number;
  used: number;
  current: number;
  specialist?: { id: number; name: string | null; ovog: string | null; email: string };
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function specialistLabel(u?: Row["specialist"]) {
  if (!u) return "-";
  const full = `${u.name || ""}${u.ovog ? ` ${u.ovog}` : ""}`.trim();
  return full || u.email || "-";
}

export default function SterilizationActiveIndicatorsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      if (q.trim()) params.set("q", q.trim());

      const [res, brRes] = await Promise.all([
        fetch(`/api/sterilization/indicators/active?${params.toString()}`),
        fetch("/api/branches"),
      ]);

      const json = await res.json().catch(() => null);
      const br = await brRes.json().catch(() => []);

      if (!res.ok) throw new Error(json?.error || "Failed to load indicators");

      setRows(Array.isArray(json) ? json : []);
      setBranches(Array.isArray(br) ? br : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    // server already filters; this is just a safety net
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => `${r.packageName} ${r.code}`.toLowerCase().includes(t));
  }, [rows, q]);

  return (

      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ fontSize: 18, marginBottom: 6 }}>Ариутгал → Идэвхитэй индикатор</h1>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
          Үлдэгдэлтэй (current &gt; 0) индикаторын жагсаалт.
        </div>

        {error && <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>{error}</div>}

        {/* filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
            style={{ flex: "0 0 220px", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
          >
            <option value="">Бүх салбар</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Нэр эсвэл кодоор хайх..."
            style={{ flex: "1 1 280px", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
          />

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              border: "1px solid #d1d5db",
              background: "#fff",
              borderRadius: 8,
              padding: "8px 10px",
              cursor: loading ? "default" : "pointer",
              fontSize: 13,
            }}
          >
            {loading ? "Ачаалж байна..." : "Шүүх/Шинэчлэх"}
          </button>
        </div>

        {/* table */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b7280", borderBottom: "1px solid #f3f4f6" }}>
                <th style={{ padding: "10px 12px" }}>Нэр</th>
                <th style={{ padding: "10px 12px", width: 120 }}>Код</th>
                <th style={{ padding: "10px 12px", width: 120 }}>Үүсгэсэн</th>
                <th style={{ padding: "10px 12px", width: 110 }}>Нийт</th>
                <th style={{ padding: "10px 12px", width: 110 }}>Ашигласан</th>
                <th style={{ padding: "10px 12px", width: 110 }}>Үлдэгдэл</th>
                <th style={{ padding: "10px 12px", width: 220 }}>Сувилагч</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                    {r.packageName}
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {r.branch?.name || `Branch #${r.branchId}`}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{r.code}</td>
                  <td style={{ padding: "10px 12px" }}>{formatDate(r.indicatorDate)}</td>
                  <td style={{ padding: "10px 12px" }}>{r.produced}</td>
                  <td style={{ padding: "10px 12px" }}>{r.used}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{r.current}</td>
                  <td style={{ padding: "10px 12px" }}>{specialistLabel(r.specialist)}</td>
                </tr>
              ))}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} style={{ padding: 14, color: "#6b7280" }}>
                    Идэвхитэй индикатор олдсонгүй.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

  );
}

import React, { useEffect, useMemo, useState } from "react";

type Branch = { id: number; name: string };

type DisposalLine = {
  id: number;
  quantity: number;
  toolLine: {
    id: number;
    tool: { id: number; name: string };
    cycle: { id: number; code: string; machineNumber: string };
  };
};

type Disposal = {
  id: number;
  branchId: number;
  disposedAt: string;
  disposedByName: string;
  reason: string | null;
  notes: string | null;
  totalQuantity: number;
  branch: { id: number; name: string };
  lines: DisposalLine[];
};

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function DisposalsPage() {
  const today = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => ymd(today), [today]);

  // default range: this month to today
  const [from, setFrom] = useState<string>(ymd(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState<string>(todayYmd);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");

  const [disposals, setDisposals] = useState<Disposal[]>([]);
  const [expandedDisposals, setExpandedDisposals] = useState<Set<number>>(new Set());

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

  const loadDisposals = async () => {
    if (!branchId) {
      setError("Салбар сонгоно уу.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("branchId", String(branchId));
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/sterilization/disposals?${params.toString()}`);
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.error || "Хаягдлын түүх ачааллах үед алдаа гарлаа");

      setDisposals(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (disposalId: number) => {
    setExpandedDisposals((prev) => {
      const next = new Set(prev);
      if (next.has(disposalId)) {
        next.delete(disposalId);
      } else {
        next.add(disposalId);
      }
      return next;
    });
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  useEffect(() => {
    if (branchId) {
      void loadDisposals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  return (
    <div style={{ maxWidth: 1200 }}>
      <h1 style={{ fontSize: 18, marginBottom: 6 }}>🗑️ Хаягдлын түүх (Устгал)</h1>
      <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
        Багаж хаягдсан бүртгэлүүдийн дэлгэрэнгүй мэдээлэл.
      </div>

      {error && <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>{error}</div>}

      {/* Filter panel */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Хайлт</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Салбар (заавал)</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
              style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
            >
              <option value="">-- Салбар сонгох --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

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

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="button"
              onClick={() => void loadDisposals()}
              disabled={loading || !branchId}
              style={{
                width: "100%",
                border: "none",
                background: branchId ? "#2563eb" : "#9ca3af",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 12px",
                cursor: branchId ? "pointer" : "not-allowed",
                fontWeight: 700,
              }}
            >
              {loading ? "Ачаалж байна..." : "Хайх"}
            </button>
          </div>
        </div>
      </div>

      {/* Disposals list */}
      {branchId && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", fontWeight: 700 }}>
            Хаягдлын бүртгэл ({disposals.length})
          </div>

          {disposals.length === 0 && !loading && (
            <div style={{ padding: 20, color: "#6b7280", textAlign: "center" }}>
              Сонгосон хугацаанд хаягдлын бүртгэл олдсонгүй.
            </div>
          )}

          {disposals.map((disposal) => {
            const isExpanded = expandedDisposals.has(disposal.id);
            return (
              <div key={disposal.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                {/* Disposal header row */}
                <div
                  onClick={() => toggleExpanded(disposal.id)}
                  style={{
                    padding: "12px 16px",
                    display: "grid",
                    gridTemplateColumns: "40px 180px 1fr 150px 100px",
                    gap: 10,
                    alignItems: "center",
                    cursor: "pointer",
                    background: isExpanded ? "#f9fafb" : "#fff",
                  }}
                >
                  <div style={{ fontSize: 18 }}>{isExpanded ? "🔽" : "▶️"}</div>
                  <div style={{ fontSize: 13 }}>{formatDateTime(disposal.disposedAt)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{disposal.disposedByName}</div>
                    {disposal.reason && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>Шалтгаан: {disposal.reason}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>{disposal.lines.length} мөр</div>
                  <div style={{ fontSize: 14, textAlign: "right", fontWeight: 700, color: "#dc2626" }}>
                    {disposal.totalQuantity} ширхэг
                  </div>
                </div>

                {/* Expanded disposal lines */}
                {isExpanded && (
                  <div style={{ background: "#f9fafb", padding: "12px 16px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                          <th style={{ padding: "8px 12px" }}>Цикл</th>
                          <th style={{ padding: "8px 12px" }}>Машин</th>
                          <th style={{ padding: "8px 12px" }}>Багаж</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Тоо ширхэг</th>
                        </tr>
                      </thead>
                      <tbody>
                        {disposal.lines.map((line) => (
                          <tr key={line.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600 }}>{line.toolLine.cycle.code}</td>
                            <td style={{ padding: "8px 12px" }}>{line.toolLine.cycle.machineNumber}</td>
                            <td style={{ padding: "8px 12px" }}>{line.toolLine.tool.name}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>
                              {line.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {disposal.notes && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                        <b>Тэмдэглэл:</b> {disposal.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

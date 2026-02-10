import React, { useEffect, useMemo, useState } from "react";

type Branch = { id: number; name: string };

type TodayCard = {
  branchId: number;
  branchName: string;
  usedTotal: number;
};

type ToolLine = {
  toolLineId: number;
  toolId: number;
  toolName: string;
  produced: number;
  used: number;
  disposed: number;
  remaining: number;
};

type ActiveCycle = {
  cycleId: number;
  branchId: number;
  branchName: string;
  code: string;
  machineNumber: string;
  completedAt: string;
  operator: string;
  result: string;
  notes: string | null;
  totals: {
    produced: number;
    used: number;
    disposed: number;
    remaining: number;
  };
  toolLines: ToolLine[];
};

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function SterilizationReportsPage() {
  const today = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => ymd(today), [today]);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");

  const [todayCards, setTodayCards] = useState<TodayCard[]>([]);
  const [activeCycles, setActiveCycles] = useState<ActiveCycle[]>([]);
  const [expandedCycles, setExpandedCycles] = useState<Set<number>>(new Set());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Disposal modal state
  const [disposalModalOpen, setDisposalModalOpen] = useState(false);
  const [disposalToolLine, setDisposalToolLine] = useState<ToolLine | null>(null);
  const [disposalCycle, setDisposalCycle] = useState<ActiveCycle | null>(null);

  const loadBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const json = await res.json().catch(() => []);
      if (res.ok) setBranches(Array.isArray(json) ? json : []);
    } catch {
      // ignore
    }
  };

  const loadActiveCycles = async () => {
    if (!branchId) {
      setError("Салбар сонгоно уу.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("branchId", String(branchId));

      const res = await fetch(`/api/sterilization/active-cycles?${params.toString()}`);
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.error || "Тайлан ачааллах үед алдаа гарлаа");

      setTodayCards(Array.isArray(json?.todayCards) ? json.todayCards : []);
      setActiveCycles(Array.isArray(json?.activeCycles) ? json.activeCycles : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (cycleId: number) => {
    setExpandedCycles((prev) => {
      const next = new Set(prev);
      if (next.has(cycleId)) {
        next.delete(cycleId);
      } else {
        next.add(cycleId);
      }
      return next;
    });
  };

  const openDisposalModal = (cycle: ActiveCycle, toolLine: ToolLine) => {
    setDisposalCycle(cycle);
    setDisposalToolLine(toolLine);
    setDisposalModalOpen(true);
  };

  const closeDisposalModal = () => {
    setDisposalModalOpen(false);
    setDisposalCycle(null);
    setDisposalToolLine(null);
  };

  const handleDisposalSubmit = async (data: {
    disposedAt: string;
    disposedByName: string;
    quantity: number;
    reason: string;
    notes: string;
  }) => {
    if (!branchId || !disposalToolLine) return;

    try {
      const res = await fetch("/api/sterilization/disposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          disposedAt: data.disposedAt,
          disposedByName: data.disposedByName,
          reason: data.reason || null,
          notes: data.notes || null,
          lines: [
            {
              toolLineId: disposalToolLine.toolLineId,
              quantity: data.quantity,
            },
          ],
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.error || "Хаягдал бүртгэхэд алдаа гарлаа");

      // Reload active cycles
      closeDisposalModal();
      await loadActiveCycles();
    } catch (e: any) {
      alert(e?.message || "Алдаа гарлаа");
    }
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  useEffect(() => {
    if (branchId) {
      void loadActiveCycles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  return (
    <div style={{ maxWidth: 1200 }}>
      <h1 style={{ fontSize: 18, marginBottom: 6 }}>📊 Ариутгалын тайлан (Идэвхитэй циклууд)</h1>
      <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
        Дээрх картууд: <b>өнөөдрийн</b> ашиглалт ({todayYmd}). Доорх жагсаалт: идэвхитэй циклүүд (үлдэгдэл &gt; 0).
      </div>

      {error && <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>{error}</div>}

      {/* Today cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
        {todayCards.map((c, idx) => {
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
                Өнөөдөр ашигласан багажийн тоо
              </div>
            </div>
          );
        })}
        {todayCards.length === 0 && !loading && (
          <div style={{ fontSize: 13, color: "#6b7280" }}>Өнөөдрийн ашиглалт байхгүй байна.</div>
        )}
      </div>

      {/* Branch filter */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Салбар сонгох (заавал)</div>

        <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Салбар</label>
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

          <div>
            <button
              type="button"
              onClick={() => void loadActiveCycles()}
              disabled={loading || !branchId}
              style={{
                border: "none",
                background: branchId ? "#2563eb" : "#9ca3af",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 20px",
                cursor: branchId ? "pointer" : "not-allowed",
                fontWeight: 700,
              }}
            >
              {loading ? "Ачаалж байна..." : "Харах"}
            </button>
          </div>
        </div>
      </div>

      {/* Active cycles list */}
      {branchId && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", fontWeight: 700 }}>
            Идэвхитэй циклүүд ({activeCycles.length})
          </div>

          {activeCycles.length === 0 && !loading && (
            <div style={{ padding: 20, color: "#6b7280", textAlign: "center" }}>
              Идэвхитэй цикл олдсонгүй (үлдэгдэл багаж байхгүй байна).
            </div>
          )}

          {activeCycles.map((cycle) => {
            const isExpanded = expandedCycles.has(cycle.cycleId);
            return (
              <div key={cycle.cycleId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                {/* Cycle header row */}
                <div
                  onClick={() => toggleExpanded(cycle.cycleId)}
                  style={{
                    padding: "12px 16px",
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 100px 120px 100px 100px 100px",
                    gap: 10,
                    alignItems: "center",
                    cursor: "pointer",
                    background: isExpanded ? "#f9fafb" : "#fff",
                  }}
                >
                  <div style={{ fontSize: 18 }}>{isExpanded ? "🔽" : "▶️"}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{cycle.code}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Машин: {cycle.machineNumber} | {cycle.operator}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, textAlign: "right" }}>
                    <div style={{ color: "#6b7280", fontSize: 11 }}>Үүссэн</div>
                    <div style={{ fontWeight: 600 }}>{cycle.totals.produced}</div>
                  </div>
                  <div style={{ fontSize: 13, textAlign: "right" }}>
                    <div style={{ color: "#6b7280", fontSize: 11 }}>Ашигласан</div>
                    <div style={{ fontWeight: 600 }}>{cycle.totals.used}</div>
                  </div>
                  <div style={{ fontSize: 13, textAlign: "right" }}>
                    <div style={{ color: "#6b7280", fontSize: 11 }}>Хаягдал</div>
                    <div style={{ fontWeight: 600 }}>{cycle.totals.disposed}</div>
                  </div>
                  <div style={{ fontSize: 13, textAlign: "right" }}>
                    <div style={{ color: "#6b7280", fontSize: 11 }}>Үлдэгдэл</div>
                    <div style={{ fontWeight: 700, color: "#15803d" }}>{cycle.totals.remaining}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{formatDateTime(cycle.completedAt)}</div>
                </div>

                {/* Expanded tool lines */}
                {isExpanded && (
                  <div style={{ background: "#f9fafb", padding: "12px 16px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                          <th style={{ padding: "8px 12px" }}>Багаж</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Үүссэн</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Ашигласан</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Хаягдал</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Үлдэгдэл</th>
                          <th style={{ padding: "8px 12px" }}>Үйлдэл</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cycle.toolLines.map((line) => (
                          <tr key={line.toolLineId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600 }}>{line.toolName}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right" }}>{line.produced}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right" }}>{line.used}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right" }}>{line.disposed}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#15803d" }}>
                              {line.remaining}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              {line.remaining > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openDisposalModal(cycle, line)}
                                  style={{
                                    border: "1px solid #dc2626",
                                    background: "#fff",
                                    color: "#dc2626",
                                    borderRadius: 6,
                                    padding: "4px 12px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                    fontWeight: 600,
                                  }}
                                >
                                  Хаягдал
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {cycle.notes && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                        <b>Тэмдэглэл:</b> {cycle.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Disposal modal */}
      {disposalModalOpen && disposalToolLine && disposalCycle && (
        <DisposalModal
          toolLine={disposalToolLine}
          cycle={disposalCycle}
          onClose={closeDisposalModal}
          onSubmit={handleDisposalSubmit}
        />
      )}
    </div>
  );
}

// Disposal Modal Component
function DisposalModal({
  toolLine,
  cycle,
  onClose,
  onSubmit,
}: {
  toolLine: ToolLine;
  cycle: ActiveCycle;
  onClose: () => void;
  onSubmit: (data: {
    disposedAt: string;
    disposedByName: string;
    quantity: number;
    reason: string;
    notes: string;
  }) => Promise<void>;
}) {
  const [disposedAt, setDisposedAt] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  });
  const [disposedByName, setDisposedByName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!disposedByName.trim()) {
      alert("Хаягдал бүртгэсэн хүний нэр оруулна уу.");
      return;
    }

    if (quantity <= 0 || quantity > toolLine.remaining) {
      alert(`Тоо ширхэг 1-с ${toolLine.remaining} хооронд байх ёстой.`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        disposedAt,
        disposedByName: disposedByName.trim(),
        quantity,
        reason: reason.trim(),
        notes: notes.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          maxWidth: 500,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Хаягдал бүртгэх</h2>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          <div>
            <b>Цикл:</b> {cycle.code}
          </div>
          <div>
            <b>Багаж:</b> {toolLine.toolName}
          </div>
          <div>
            <b>Үлдэгдэл:</b> {toolLine.remaining}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                Огноо, цаг *
              </label>
              <input
                type="datetime-local"
                value={disposedAt}
                onChange={(e) => setDisposedAt(e.target.value)}
                required
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                Хаягдал бүртгэсэн хүн *
              </label>
              <input
                type="text"
                value={disposedByName}
                onChange={(e) => setDisposedByName(e.target.value)}
                required
                placeholder="Нэр оруулах"
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                Тоо ширхэг * (1 - {toolLine.remaining})
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
                min={1}
                max={toolLine.remaining}
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Шалтгаан</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Жишээ: Хугацаа дууссан, Гэмтсэн"
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Тэмдэглэл</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#374151",
                  borderRadius: 8,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Болих
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "8px 16px",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {submitting ? "Бүртгэж байна..." : "Бүртгэх"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

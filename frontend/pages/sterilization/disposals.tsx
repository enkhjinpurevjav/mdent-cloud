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

type DisposalLineInput = {
  id: string; // temporary ID for UI management
  cycleId: number | "";
  toolLineId: number | "";
  quantity: number;
  maxQuantity: number;
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

  // Disposal creation modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeCycles, setActiveCycles] = useState<ActiveCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(false);

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

  const loadActiveCycles = async () => {
    if (!branchId) return;

    setLoadingCycles(true);
    try {
      const params = new URLSearchParams();
      params.set("branchId", String(branchId));

      const res = await fetch(`/api/sterilization/active-cycles?${params.toString()}`);
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.error || "Active cycles ачааллах үед алдаа гарлаа");

      setActiveCycles(Array.isArray(json?.activeCycles) ? json.activeCycles : []);
    } catch (e: any) {
      alert(e?.message || "Алдаа гарлаа");
      setActiveCycles([]);
    } finally {
      setLoadingCycles(false);
    }
  };

  const openCreateModal = async () => {
    setCreateModalOpen(true);
    await loadActiveCycles();
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setActiveCycles([]);
  };

  const handleCreateDisposal = async (data: {
    disposedAt: string;
    disposedByName: string;
    reason: string;
    notes: string;
    lines: { toolLineId: number; quantity: number }[];
  }) => {
    if (!branchId) return;

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
          lines: data.lines,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.error || "Устгал үүсгэхэд алдаа гарлаа");

      // Success: close modal and reload disposals
      closeCreateModal();
      await loadDisposals();
      alert("Устгал амжилттай бүртгэгдлээ.");
    } catch (e: any) {
      throw new Error(e?.message || "Алдаа гарлаа");
    }
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Хайлт</div>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!branchId}
            style={{
              border: "none",
              background: branchId ? "#16a34a" : "#9ca3af",
              color: "#fff",
              borderRadius: 10,
              padding: "8px 16px",
              cursor: branchId ? "pointer" : "not-allowed",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            + Устгал нэмэх
          </button>
        </div>

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

      {/* Create Disposal Modal */}
      {createModalOpen && (
        <CreateDisposalModal
          activeCycles={activeCycles}
          loadingCycles={loadingCycles}
          onClose={closeCreateModal}
          onSubmit={handleCreateDisposal}
        />
      )}
    </div>
  );
}

// Create Disposal Modal Component
function CreateDisposalModal({
  activeCycles,
  loadingCycles,
  onClose,
  onSubmit,
}: {
  activeCycles: ActiveCycle[];
  loadingCycles: boolean;
  onClose: () => void;
  onSubmit: (data: {
    disposedAt: string;
    disposedByName: string;
    reason: string;
    notes: string;
    lines: { toolLineId: number; quantity: number }[];
  }) => Promise<void>;
}) {
  const [disposedAt, setDisposedAt] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  });
  const [disposedByName, setDisposedByName] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Multiple disposal lines
  const [disposalLines, setDisposalLines] = useState<DisposalLineInput[]>([
    { id: crypto.randomUUID(), cycleId: "", toolLineId: "", quantity: 1, maxQuantity: 0 },
  ]);

  const addLine = () => {
    setDisposalLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), cycleId: "", toolLineId: "", quantity: 1, maxQuantity: 0 },
    ]);
  };

  const removeLine = (id: string) => {
    setDisposalLines((prev) => prev.filter((line) => line.id !== id));
  };

  const updateLine = (id: string, updates: Partial<DisposalLineInput>) => {
    setDisposalLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        const updated = { ...line, ...updates };

        // If cycle changed, reset toolLine and update maxQuantity
        if (updates.cycleId !== undefined && updates.cycleId !== line.cycleId) {
          updated.toolLineId = "";
          updated.maxQuantity = 0;
        }

        // If toolLine changed, update maxQuantity
        if (updates.toolLineId !== undefined && updates.toolLineId !== line.toolLineId) {
          const cycle = activeCycles.find((c) => c.cycleId === updated.cycleId);
          const toolLine = cycle?.toolLines.find((tl) => tl.toolLineId === updates.toolLineId);
          updated.maxQuantity = toolLine?.remaining || 0;
        }

        return updated;
      })
    );
  };

  const getAvailableToolLines = (cycleId: number | "") => {
    if (!cycleId) return [];
    const cycle = activeCycles.find((c) => c.cycleId === cycleId);
    return cycle?.toolLines.filter((tl) => tl.remaining > 0) || [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!disposedByName.trim()) {
      alert("Устгал бүртгэсэн хүний нэр оруулна уу.");
      return;
    }

    if (disposalLines.length === 0) {
      alert("Хамгийн багадаа 1 мөр оруулна уу.");
      return;
    }

    // Validate lines
    for (const line of disposalLines) {
      if (!line.cycleId || !line.toolLineId) {
        alert("Бүх мөрүүдийн цикл болон багажийг сонгоно уу.");
        return;
      }
      if (line.quantity <= 0 || line.quantity > line.maxQuantity) {
        alert(`Тоо ширхэг 1-с ${line.maxQuantity} хооронд байх ёстой.`);
        return;
      }
    }

    // Merge duplicates by toolLineId
    const mergedMap = new Map<number, number>();
    for (const line of disposalLines) {
      const toolLineId = Number(line.toolLineId);
      mergedMap.set(toolLineId, (mergedMap.get(toolLineId) || 0) + line.quantity);
    }

    // Validate merged quantities
    for (const [toolLineId, totalQty] of mergedMap.entries()) {
      const cycle = activeCycles.find((c) => c.toolLines.some((tl) => tl.toolLineId === toolLineId));
      const toolLine = cycle?.toolLines.find((tl) => tl.toolLineId === toolLineId);
      if (toolLine && totalQty > toolLine.remaining) {
        alert(
          `Багаж "${toolLine.toolName}" (${cycle?.code}): нийт тоо ширхэг ${totalQty} нь үлдэгдэл ${toolLine.remaining}-с их байна.`
        );
        return;
      }
    }

    const lines = Array.from(mergedMap.entries()).map(([toolLineId, quantity]) => ({
      toolLineId,
      quantity,
    }));

    setSubmitting(true);
    try {
      await onSubmit({
        disposedAt,
        disposedByName: disposedByName.trim(),
        reason: reason.trim(),
        notes: notes.trim(),
        lines,
      });
    } catch (e: any) {
      alert(e?.message || "Алдаа гарлаа");
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
          maxWidth: 700,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Устгал нэмэх</h2>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Багаж хаягдсан бүртгэл үүсгэх. Та олон мөр нэмж болно, давхардлууд нэгтгэгдэнэ.
        </div>

        {loadingCycles && (
          <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>
            Идэвхитэй циклүүдийг ачаалж байна...
          </div>
        )}

        {!loadingCycles && activeCycles.length === 0 && (
          <div style={{ textAlign: "center", padding: 20, color: "#b91c1c" }}>
            Идэвхитэй цикл олдсонгүй (үлдэгдэл багаж байхгүй байна).
          </div>
        )}

        {!loadingCycles && activeCycles.length > 0 && (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Disposal metadata */}
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                  Устгасан огноо/цаг <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={disposedAt}
                  onChange={(e) => setDisposedAt(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                  Устгасан хүний нэр <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={disposedByName}
                  onChange={(e) => setDisposedByName(e.target.value)}
                  required
                  placeholder="Жишээ: Б.Дорж"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                  Шалтгаан (заавал биш)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Жишээ: Гэмтсэн, хуучирсан"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                  Тэмдэглэл (заавал биш)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Нэмэлт тайлбар..."
                  rows={2}
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Disposal lines */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
                    Устгах багажууд <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addLine}
                    style={{
                      border: "1px solid #16a34a",
                      background: "#fff",
                      color: "#16a34a",
                      borderRadius: 6,
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    + Мөр нэмэх
                  </button>
                </div>

                {disposalLines.map((line, idx) => {
                  const availableToolLines = getAvailableToolLines(line.cycleId);
                  return (
                    <div
                      key={line.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 8,
                        background: "#f9fafb",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Мөр #{idx + 1}</div>
                        {disposalLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            style={{
                              border: "1px solid #dc2626",
                              background: "#fff",
                              color: "#dc2626",
                              borderRadius: 6,
                              padding: "2px 8px",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            Устгах
                          </button>
                        )}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
                            Цикл
                          </label>
                          <select
                            value={line.cycleId}
                            onChange={(e) =>
                              updateLine(line.id, { cycleId: e.target.value ? Number(e.target.value) : "" })
                            }
                            style={{
                              width: "100%",
                              border: "1px solid #d1d5db",
                              borderRadius: 6,
                              padding: "6px 8px",
                              fontSize: 13,
                            }}
                          >
                            <option value="">-- Цикл сонгох --</option>
                            {activeCycles.map((cycle) => (
                              <option key={cycle.cycleId} value={cycle.cycleId}>
                                {cycle.code} (Машин: {cycle.machineNumber})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
                            Багаж
                          </label>
                          <select
                            value={line.toolLineId}
                            onChange={(e) =>
                              updateLine(line.id, { toolLineId: e.target.value ? Number(e.target.value) : "" })
                            }
                            disabled={!line.cycleId}
                            style={{
                              width: "100%",
                              border: "1px solid #d1d5db",
                              borderRadius: 6,
                              padding: "6px 8px",
                              fontSize: 13,
                              background: !line.cycleId ? "#f3f4f6" : "#fff",
                            }}
                          >
                            <option value="">-- Багаж сонгох --</option>
                            {availableToolLines.map((tl) => (
                              <option key={tl.toolLineId} value={tl.toolLineId}>
                                {tl.toolName} (үлдэгдэл: {tl.remaining})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
                            Тоо
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={line.maxQuantity || 999}
                            value={line.quantity}
                            onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) || 1 })}
                            disabled={!line.toolLineId}
                            style={{
                              width: "100%",
                              border: "1px solid #d1d5db",
                              borderRadius: 6,
                              padding: "6px 8px",
                              fontSize: 13,
                              background: !line.toolLineId ? "#f3f4f6" : "#fff",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    color: "#374151",
                    borderRadius: 8,
                    padding: "10px 12px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  Цуцлах
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1,
                    border: "none",
                    background: submitting ? "#9ca3af" : "#16a34a",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "10px 12px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {submitting ? "Бүртгэж байна..." : "Устгал бүртгэх"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

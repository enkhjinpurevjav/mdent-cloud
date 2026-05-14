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

const CLINIC_TIME_ZONE = "Asia/Ulaanbaatar";

// Build-safe ID generator (works in Node and browsers)
function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("mn-MN", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function formatDateTimeInputLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function toNaiveTimestampFromLocal(datetimeLocal: string) {
  if (!datetimeLocal) return "";
  const normalized = datetimeLocal.replace("T", " ");
  return normalized.length === 16 ? `${normalized}:00` : normalized;
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
    <div className="max-w-[1200px]">
      <h1 className="mb-1.5 text-[18px]">🗑️ Хаягдлын түүх (Устгал)</h1>
      <div className="mb-3 text-[13px] text-gray-500">
        Багаж хаягдсан бүртгэлүүдийн дэлгэрэнгүй мэдээлэл.
      </div>

      {error && <div className="mb-2.5 text-[13px] text-red-700">{error}</div>}

      {/* Filter panel */}
      <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="font-bold">Хайлт</div>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!branchId}
            className={`rounded-[10px] px-4 py-2 text-sm font-bold text-white ${
              branchId ? "cursor-pointer bg-green-600" : "cursor-not-allowed bg-gray-400"
            }`}
          >
            + Устгал нэмэх
          </button>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Салбар (заавал)</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
              className="rounded-lg border border-gray-300 px-2.5 py-2"
            >
              <option value="">-- Салбар сонгох --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Эхлэх огноо</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-2.5 py-2"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Дуусах огноо</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-2.5 py-2"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadDisposals()}
              disabled={loading || !branchId}
              className={`w-full rounded-[10px] px-3 py-2.5 font-bold text-white ${
                branchId ? "cursor-pointer bg-blue-600" : "cursor-not-allowed bg-gray-400"
              }`}
            >
              {loading ? "Ачаалж байна..." : "Хайх"}
            </button>
          </div>
        </div>
      </div>

      {/* Disposals list */}
      {branchId && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 font-bold">
            Хаягдлын бүртгэл ({disposals.length})
          </div>

          {disposals.length === 0 && !loading && (
            <div className="p-5 text-center text-gray-500">
              Сонгосон хугацаанд хаягдлын бүртгэл олдсонгүй.
            </div>
          )}

          {disposals.map((disposal) => {
            const isExpanded = expandedDisposals.has(disposal.id);
            return (
              <div key={disposal.id} className="border-b border-gray-100">
                {/* Disposal header row */}
                <div
                  onClick={() => toggleExpanded(disposal.id)}
                  className={`grid grid-cols-[40px_180px_1fr_150px_100px] items-center gap-2.5 px-4 py-3 ${
                    isExpanded ? "bg-gray-50" : "bg-white"
                  } cursor-pointer`}
                >
                  <div className="text-[18px]">{isExpanded ? "🔽" : "▶️"}</div>
                  <div className="text-[13px]">{formatDateTime(disposal.disposedAt)}</div>
                  <div>
                    <div className="text-sm font-semibold">{disposal.disposedByName}</div>
                    {disposal.reason && (
                      <div className="text-xs text-gray-500">Шалтгаан: {disposal.reason}</div>
                    )}
                  </div>
                  <div className="text-[13px] text-gray-500">{disposal.lines.length} мөр</div>
                  <div className="text-right text-sm font-bold text-red-600">
                    {disposal.totalQuantity} ширхэг
                  </div>
                </div>

                {/* Expanded disposal lines */}
                {isExpanded && (
                  <div className="bg-gray-50 px-4 py-3">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="px-3 py-2">Цикл</th>
                          <th className="px-3 py-2">Машин</th>
                          <th className="px-3 py-2">Багаж</th>
                          <th className="px-3 py-2 text-right">Тоо ширхэг</th>
                        </tr>
                      </thead>
                      <tbody>
                        {disposal.lines.map((line) => (
                          <tr key={line.id} className="border-b border-gray-100">
                            <td className="px-3 py-2 font-semibold">{line.toolLine.cycle.code}</td>
                            <td className="px-3 py-2">{line.toolLine.cycle.machineNumber}</td>
                            <td className="px-3 py-2">{line.toolLine.tool.name}</td>
                            <td className="px-3 py-2 text-right font-bold">
                              {line.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {disposal.notes && (
                      <div className="mt-2.5 text-xs text-gray-500">
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
  const [disposedAt, setDisposedAt] = useState(() => formatDateTimeInputLocal(new Date()));
  const [disposedByName, setDisposedByName] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Multiple disposal lines
  const [disposalLines, setDisposalLines] = useState<DisposalLineInput[]>([
    { id: makeId(), cycleId: "", toolLineId: "", quantity: 0, maxQuantity: 0 },
  ]);

  const addLine = () => {
    setDisposalLines((prev) => [
      ...prev,
      { id: makeId(), cycleId: "", toolLineId: "", quantity: 0, maxQuantity: 0 },
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
          // Set quantity to 1 when a valid tool line is selected (with remaining > 0)
          if (updated.maxQuantity > 0) {
            updated.quantity = 1;
          }
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
        const cycle = activeCycles.find((c) => c.cycleId === line.cycleId);
        const toolLine = cycle?.toolLines.find((tl) => tl.toolLineId === line.toolLineId);
        alert(
          `Багаж "${toolLine?.toolName}" (Цикл: ${cycle?.code}): Тоо ширхэг 1-с ${line.maxQuantity} хооронд байх ёстой.`
        );
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
    const mergedArray = Array.from(mergedMap.entries());
    for (const [toolLineId, totalQty] of mergedArray) {
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
        disposedAt: toNaiveTimestampFromLocal(disposedAt),
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
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[700px] overflow-auto rounded-xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2.5 text-[18px]">Устгал нэмэх</h2>
        <div className="mb-4 text-[13px] text-gray-500">
          Багаж хаягдсан бүртгэл үүсгэх. Та олон мөр нэмж болно, давхардлууд нэгтгэгдэнэ.
        </div>

        {loadingCycles && (
          <div className="p-5 text-center text-gray-500">
            Идэвхитэй циклүүдийг ачаалж байна...
          </div>
        )}

        {!loadingCycles && activeCycles.length === 0 && (
          <div className="p-5 text-center text-red-700">
            Идэвхитэй цикл олдсонгүй (үлдэгдэл багаж байхгүй байна).
          </div>
        )}

        {!loadingCycles && activeCycles.length > 0 && (
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3">
              {/* Disposal metadata */}
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Устгасан огноо/цаг <span className="text-red-600">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={disposedAt}
                  onChange={(e) => setDisposedAt(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Устгасан хүний нэр <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={disposedByName}
                  onChange={(e) => setDisposedByName(e.target.value)}
                  required
                  placeholder="Жишээ: Б.Дорж"
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Шалтгаан (заавал биш)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Жишээ: Гэмтсэн, хуучирсан"
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Тэмдэглэл (заавал биш)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Нэмэлт тайлбар..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                />
              </div>

              {/* Disposal lines */}
              <div className="mt-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-500">
                    Устгах багажууд <span className="text-red-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addLine}
                    className="cursor-pointer rounded-md border border-green-600 bg-white px-3 py-1 text-xs font-semibold text-green-600"
                  >
                    + Мөр нэмэх
                  </button>
                </div>

                {disposalLines.map((line, idx) => {
                  const availableToolLines = getAvailableToolLines(line.cycleId);
                  return (
                    <div
                      key={line.id}
                      className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[13px] font-semibold">Мөр #{idx + 1}</div>
                        {disposalLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="cursor-pointer rounded-md border border-red-600 bg-white px-2 py-0.5 text-[11px] text-red-600"
                          >
                            Устгах
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-[1fr_1fr_100px] gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] text-gray-500">
                            Цикл
                          </label>
                          <select
                            value={line.cycleId}
                            onChange={(e) =>
                              updateLine(line.id, { cycleId: e.target.value ? Number(e.target.value) : "" })
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-[13px]"
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
                          <label className="mb-1 block text-[11px] text-gray-500">
                            Багаж
                          </label>
                          <select
                            value={line.toolLineId}
                            onChange={(e) =>
                              updateLine(line.id, { toolLineId: e.target.value ? Number(e.target.value) : "" })
                            }
                            disabled={!line.cycleId}
                            className={`w-full rounded-md border border-gray-300 px-2 py-1.5 text-[13px] ${
                              !line.cycleId ? "bg-gray-100" : "bg-white"
                            }`}
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
                          <label className="mb-1 block text-[11px] text-gray-500">
                            Тоо
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={line.maxQuantity || undefined}
                            value={line.quantity || ""}
                            onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) || 0 })}
                            disabled={!line.toolLineId}
                            className={`w-full rounded-md border border-gray-300 px-2 py-1.5 text-[13px] ${
                              !line.toolLineId ? "bg-gray-100" : "bg-white"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="mt-2.5 flex gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className={`flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-semibold text-gray-700 ${
                    submitting ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  Цуцлах
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 rounded-lg px-3 py-2.5 font-bold text-white ${
                    submitting ? "cursor-not-allowed bg-gray-400" : "cursor-pointer bg-green-600"
                  }`}
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

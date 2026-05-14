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

const CLINIC_TIME_ZONE = "Asia/Ulaanbaatar";

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
    if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
      alert("Тоо ширхэг нь бүхэл эерэг тоо байх ёстой.");
      return;
    }

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
    <div className="max-w-[1200px]">
      <h1 className="mb-1.5 text-lg font-semibold">📊 Ариутгалын тайлан (Идэвхитэй циклууд)</h1>
      <div className="mb-3 text-sm text-gray-500">
        Дээрх картууд: <b>өнөөдрийн</b> ашиглалт ({todayYmd}). Доорх жагсаалт: идэвхитэй циклүүд (үлдэгдэл &gt; 0).
      </div>

      {error && <div className="mb-2.5 text-sm text-red-700">{error}</div>}

      {/* Today cards */}
      <div className="mb-3.5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {todayCards.map((c, idx) => {
          const cardBgClass =
            idx % 4 === 0 ? "bg-blue-100" : idx % 4 === 1 ? "bg-yellow-100" : idx % 4 === 2 ? "bg-red-100" : "bg-green-100";
          const labelColorClass =
            idx % 4 === 0 ? "text-blue-700" : idx % 4 === 1 ? "text-yellow-700" : idx % 4 === 2 ? "text-red-700" : "text-green-700";
          return (
            <div
              key={c.branchId}
              className={`rounded-2xl border border-gray-200 p-3.5 ${cardBgClass}`}
            >
              <div className={`text-xs font-bold tracking-[0.3px] ${labelColorClass}`}>
                {c.branchName}
              </div>
              <div className="mt-1.5 text-[28px] font-extrabold text-gray-900">
                {c.usedTotal}
              </div>
              <div className="mt-1 text-xs text-gray-700">
                Өнөөдөр ашигласан багажийн тоо
              </div>
            </div>
          );
        })}
        {todayCards.length === 0 && !loading && (
          <div className="text-sm text-gray-500">Өнөөдрийн ашиглалт байхгүй байна.</div>
        )}
      </div>

      {/* Branch filter */}
      <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="mb-2.5 font-bold">Салбар сонгох (заавал)</div>

        <div className="flex flex-wrap items-end gap-2.5">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <label className="text-xs text-gray-500">Салбар</label>
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

          <div className="w-full sm:w-auto">
            <button
              type="button"
              onClick={() => void loadActiveCycles()}
              disabled={loading || !branchId}
              className="w-full rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-400 sm:w-auto"
            >
              {loading ? "Ачаалж байна..." : "Харах"}
            </button>
          </div>
        </div>
      </div>

      {/* Active cycles list */}
      {branchId && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 font-bold">
            Идэвхитэй циклүүд ({activeCycles.length})
          </div>

          {activeCycles.length === 0 && !loading && (
            <div className="p-5 text-center text-gray-500">
              Идэвхитэй цикл олдсонгүй (үлдэгдэл багаж байхгүй байна).
            </div>
          )}

          {activeCycles.map((cycle) => {
            const isExpanded = expandedCycles.has(cycle.cycleId);
            return (
              <div key={cycle.cycleId} className="border-b border-gray-100">
                {/* Cycle header row */}
                <div
                  onClick={() => toggleExpanded(cycle.cycleId)}
                  className={`grid cursor-pointer grid-cols-[40px_1fr_100px_120px_100px_100px_100px] items-center gap-2.5 px-4 py-3 ${
                    isExpanded ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <div className="text-lg">{isExpanded ? "🔽" : "▶️"}</div>
                  <div>
                    <div className="text-sm font-bold">{cycle.code}</div>
                    <div className="text-xs text-gray-500">
                      Машин: {cycle.machineNumber} | {cycle.operator}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-xs text-gray-500">Үүссэн</div>
                    <div className="font-semibold">{cycle.totals.produced}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-xs text-gray-500">Ашигласан</div>
                    <div className="font-semibold">{cycle.totals.used}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-xs text-gray-500">Хаягдал</div>
                    <div className="font-semibold">{cycle.totals.disposed}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-xs text-gray-500">Үлдэгдэл</div>
                    <div className="font-bold text-emerald-700">{cycle.totals.remaining}</div>
                  </div>
                  <div className="text-xs text-gray-500">{formatDateTime(cycle.completedAt)}</div>
                </div>

                {/* Expanded tool lines */}
                {isExpanded && (
                  <div className="bg-gray-50 px-4 py-3">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="px-3 py-2">Багаж</th>
                          <th className="px-3 py-2 text-right">Үүссэн</th>
                          <th className="px-3 py-2 text-right">Ашигласан</th>
                          <th className="px-3 py-2 text-right">Хаягдал</th>
                          <th className="px-3 py-2 text-right">Үлдэгдэл</th>
                          <th className="px-3 py-2">Үйлдэл</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cycle.toolLines.map((line) => (
                          <tr key={line.toolLineId} className="border-b border-gray-100">
                            <td className="px-3 py-2 font-semibold">{line.toolName}</td>
                            <td className="px-3 py-2 text-right">{line.produced}</td>
                            <td className="px-3 py-2 text-right">{line.used}</td>
                            <td className="px-3 py-2 text-right">{line.disposed}</td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">
                              {line.remaining}
                            </td>
                            <td className="px-3 py-2">
                              {line.remaining > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openDisposalModal(cycle, line)}
                                  className="rounded-md border border-red-600 bg-white px-3 py-1 text-xs font-semibold text-red-600"
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
                      <div className="mt-2.5 text-xs text-gray-500">
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
  const [disposedAt, setDisposedAt] = useState(() => formatDateTimeInputLocal(new Date()));
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

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > toolLine.remaining) {
      alert(`Тоо ширхэг 1-с ${toolLine.remaining} хооронд байх ёстой.`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        disposedAt: toNaiveTimestampFromLocal(disposedAt),
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
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[500px] overflow-auto rounded-xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2.5 text-lg">Хаягдал бүртгэх</h2>
        <div className="mb-4 text-sm text-gray-500">
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
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Огноо, цаг *
              </label>
              <input
                type="datetime-local"
                value={disposedAt}
                onChange={(e) => setDisposedAt(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Хаягдал бүртгэсэн хүн *
              </label>
              <input
                type="text"
                value={disposedByName}
                onChange={(e) => setDisposedByName(e.target.value)}
                required
                placeholder="Нэр оруулах"
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Тоо ширхэг * (1 - {toolLine.remaining})
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  setQuantity(Number.isNaN(parsed) ? 0 : parsed);
                }}
                required
                min={1}
                max={toolLine.remaining}
                step={1}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-500">Шалтгаан</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Жишээ: Хугацаа дууссан, Гэмтсэн"
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-500">Тэмдэглэл</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2"
              />
            </div>

            <div className="mt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700"
              >
                Болих
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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

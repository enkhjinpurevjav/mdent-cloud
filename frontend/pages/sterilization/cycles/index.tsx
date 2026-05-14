import React, { useEffect, useState } from "react";

type Branch = { id: number; name: string };

type AutoclaveCycle = {
  id: number;
  branchId: number;
  code: string;
  sterilizationRunNumber: string | null;
  machineNumber: string;
  startedAt: string | null;
  pressure: string | null;
  temperature: number | null;
  finishedAt: string | null;
  removedFromAutoclaveAt: string | null;
  completedAt: string;
  result: "PASS" | "FAIL";
  operator: string;
  notes: string | null;
  branch?: Branch;
  toolLines?: {
    id: number;
    toolId: number;
    producedQty: number;
    tool?: { id: number; name: string };
  }[];
};

export default function CyclesListPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cycles, setCycles] = useState<AutoclaveCycle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [selectedResult, setSelectedResult] = useState<"" | "PASS" | "FAIL">("");
  const [expandedCycleId, setExpandedCycleId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/branches");
        const data = await res.json().catch(() => []);
        if (res.ok) setBranches(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      }
    })();
  }, []);

  const loadCycles = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append("branchId", String(selectedBranchId));
      if (selectedResult) params.append("result", selectedResult);

      const res = await fetch(`/api/sterilization/cycles?${params.toString()}`);
      const data = await res.json().catch(() => []);
      
      if (!res.ok) throw new Error(data?.error || "Failed to load cycles");
      
      setCycles(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
      setCycles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCycles();
  }, [selectedBranchId, selectedResult]);

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      const h = String(date.getHours()).padStart(2, "0");
      const min = String(date.getMinutes()).padStart(2, "0");
      return `${y}-${m}-${d} ${h}:${min}`;
    } catch {
      return isoString;
    }
  };

  const toggleExpand = (cycleId: number) => {
    setExpandedCycleId(expandedCycleId === cycleId ? null : cycleId);
  };

  return (
    <div className="max-w-[1400px]">
      <h1 className="mb-1.5 text-lg font-semibold">Ариутгал → Циклийн жагсаалт</h1>
      <p className="mb-3 text-sm text-gray-500">Автоклавын циклүүдийг харах, шүүх.</p>

      {error && <div className="mb-2.5 text-sm text-red-700">{error}</div>}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
          className="min-w-[220px] flex-none rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
        >
          <option value="">Бүх салбар</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={selectedResult}
          onChange={(e) => setSelectedResult(e.target.value as "" | "PASS" | "FAIL")}
          className="min-w-[180px] flex-none rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
        >
          <option value="">Бүх үр дүн</option>
          <option value="PASS">✓ PASS</option>
          <option value="FAIL">✗ FAIL</option>
        </select>

        <button
          type="button"
          onClick={() => void loadCycles()}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:cursor-default disabled:opacity-60"
        >
          {loading ? "Ачаалж байна..." : "Шинэчлэх"}
        </button>
      </div>

      {/* Cycles Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading && (
          <div className="p-6 text-center text-sm text-gray-500">
            Ачаалж байна...
          </div>
        )}

        {!loading && cycles.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-500">
            Цикл олдсонгүй.
          </div>
        )}

        {!loading && cycles.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="w-[50px] px-4 py-3"></th>
                <th className="px-4 py-3">Код</th>
                <th className="px-4 py-3">Салбар</th>
                <th className="px-4 py-3">Машин</th>
                <th className="px-4 py-3">Дууссан огноо</th>
                <th className="w-[100px] px-4 py-3">Үр дүн</th>
                <th className="px-4 py-3">Ажилтан</th>
                <th className="w-[100px] px-4 py-3 text-center">Багажийн тоо</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => {
                const isExpanded = expandedCycleId === cycle.id;
                const toolCount = cycle.toolLines?.length || 0;
                const totalProducedQty =cycle.toolLines?.reduce((sum, line) => sum + (Number(line.producedQty) || 0), 0) || 0;

                return (
                  <React.Fragment key={cycle.id}>
                    <tr
                      className={`cursor-pointer border-b border-gray-100 ${isExpanded ? "bg-gray-50" : "bg-white"}`}
                      onClick={() => toggleExpand(cycle.id)}
                    >
                      <td className="px-4 py-3 text-center">
                        <span className="text-base">{isExpanded ? "▼" : "▶"}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">{cycle.code}</td>
                      <td className="px-4 py-3">{cycle.branch?.name || "—"}</td>
                      <td className="px-4 py-3">{cycle.machineNumber}</td>
                      <td className="px-4 py-3">{formatDateTime(cycle.completedAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${
                            cycle.result === "PASS"
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-red-100 text-red-900"
                          }`}
                        >
                          {cycle.result === "PASS" ? "✓ PASS" : "✗ FAIL"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{cycle.operator}</td>
                      <td className="px-4 py-3 text-center">{toolCount}</td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="p-4">
                          {/* Cycle Details */}
                          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                            {cycle.sterilizationRunNumber && (
                              <div>
                                <div className="mb-0.5 text-xs text-gray-500">Ариутгалын дугаар:</div>
                                <div className="text-sm font-medium">{cycle.sterilizationRunNumber}</div>
                              </div>
                            )}
                            {cycle.startedAt && (
                              <div>
                                <div className="mb-0.5 text-xs text-gray-500">Эхэлсэн цаг:</div>
                                <div className="text-sm">{formatDateTime(cycle.startedAt)}</div>
                              </div>
                            )}
                            {cycle.finishedAt && (
                              <div>
                                <div className="mb-0.5 text-xs text-gray-500">Дууссан цаг:</div>
                                <div className="text-sm">{formatDateTime(cycle.finishedAt)}</div>
                              </div>
                            )}
                            {cycle.removedFromAutoclaveAt && (
                              <div>
                                <div className="mb-0.5 text-xs text-gray-500">Автоклаваас гаргасан:</div>
                                <div className="text-sm">{formatDateTime(cycle.removedFromAutoclaveAt)}</div>
                              </div>
                            )}
                            {cycle.pressure !== null && cycle.pressure !== undefined && (
                              <div>
                                <div className="mb-0.5 text-xs text-gray-500">Даралт:</div>
                                <div className="text-sm">{cycle.pressure} kPa</div>
                              </div>
                            )}
                            {cycle.temperature !== null && cycle.temperature !== undefined && (
                              <div>
                                <div className="mb-0.5 text-xs text-gray-500">Температур:</div>
                                <div className="text-sm">{cycle.temperature}°C</div>
                              </div>
                            )}
                          </div>

                          <div className="mb-3">
                            <div className="mb-1 text-xs text-gray-500">Тэмдэглэл:</div>
                            <div className="text-sm">
                              {cycle.notes || <span className="text-gray-400">Тэмдэглэл байхгүй</span>}
                            </div>
                          </div>

                          {toolCount > 0 && (
                            <div>
                              <div className="mb-2 text-xs text-gray-500">Багажийн жагсаалт:</div>
                              <table className="w-full border-collapse text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 text-left text-gray-500">
                                    <th className="px-2 py-1.5">Багаж</th>
                                    <th className="w-[140px] px-2 py-1.5">Үйлдвэрлэсэн тоо</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cycle.toolLines?.map((line) => (
                                    <tr key={line.id} className="border-b border-gray-100">
                                      <td className="px-2 py-1.5">{line.tool?.name || `Tool #${line.toolId}`}</td>
                                      <td className="px-2 py-1.5">{line.producedQty}</td>
                                    </tr>
                                  ))}

                                  <tr className="border-t-2 border-gray-200">
                                    <td className="px-2 py-1.5 font-semibold">Бүгд</td>
                                    <td className="px-2 py-1.5 font-semibold">{totalProducedQty}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

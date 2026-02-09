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
    <div style={{ maxWidth: 1400 }}>
      <h1 style={{ fontSize: 18, marginBottom: 6 }}>Ариутгал → Циклийн жагсаалт</h1>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
        Автоклавын циклүүдийг харах, шүүх.
      </div>

      {error && <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>{error}</div>}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
          style={{ flex: "0 1 220px", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
        >
          <option value="">Бүх салбар</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={selectedResult}
          onChange={(e) => setSelectedResult(e.target.value as "" | "PASS" | "FAIL")}
          style={{ flex: "0 1 180px", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
        >
          <option value="">Бүх үр дүн</option>
          <option value="PASS">✓ PASS</option>
          <option value="FAIL">✗ FAIL</option>
        </select>

        <button
          type="button"
          onClick={() => void loadCycles()}
          disabled={loading}
          style={{
            border: "1px solid #d1d5db",
            background: "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: loading ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          {loading ? "Ачаалж байна..." : "Шинэчлэх"}
        </button>
      </div>

      {/* Cycles Table */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        {loading && (
          <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
            Ачаалж байна...
          </div>
        )}

        {!loading && cycles.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
            Цикл олдсонгүй.
          </div>
        )}

        {!loading && cycles.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#6b7280", textAlign: "left" }}>
                <th style={{ padding: "12px 16px", width: 50 }}></th>
                <th style={{ padding: "12px 16px" }}>Код</th>
                <th style={{ padding: "12px 16px" }}>Салбар</th>
                <th style={{ padding: "12px 16px" }}>Машин</th>
                <th style={{ padding: "12px 16px" }}>Дууссан огноо</th>
                <th style={{ padding: "12px 16px", width: 100 }}>Үр дүн</th>
                <th style={{ padding: "12px 16px" }}>Ажилтан</th>
                <th style={{ padding: "12px 16px", width: 100, textAlign: "center" }}>Багажийн тоо</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => {
                const isExpanded = expandedCycleId === cycle.id;
                const toolCount = cycle.toolLines?.length || 0;

                return (
                  <React.Fragment key={cycle.id}>
                    <tr
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        cursor: "pointer",
                        background: isExpanded ? "#f9fafb" : "#fff",
                      }}
                      onClick={() => toggleExpand(cycle.id)}
                    >
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 16 }}>{isExpanded ? "▼" : "▶"}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 500 }}>{cycle.code}</td>
                      <td style={{ padding: "12px 16px" }}>{cycle.branch?.name || "—"}</td>
                      <td style={{ padding: "12px 16px" }}>{cycle.machineNumber}</td>
                      <td style={{ padding: "12px 16px" }}>{formatDateTime(cycle.completedAt)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            background: cycle.result === "PASS" ? "#d1fae5" : "#fee2e2",
                            color: cycle.result === "PASS" ? "#065f46" : "#991b1b",
                          }}
                        >
                          {cycle.result === "PASS" ? "✓ PASS" : "✗ FAIL"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>{cycle.operator}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>{toolCount}</td>
                    </tr>

                    {isExpanded && (
                      <tr style={{ background: "#f9fafb" }}>
                        <td colSpan={8} style={{ padding: 16 }}>
                          {/* Cycle Details */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                            {cycle.sterilizationRunNumber && (
                              <div>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Ариутгалын дугаар:</div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{cycle.sterilizationRunNumber}</div>
                              </div>
                            )}
                            {cycle.startedAt && (
                              <div>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Эхэлсэн цаг:</div>
                                <div style={{ fontSize: 13 }}>{formatDateTime(cycle.startedAt)}</div>
                              </div>
                            )}
                            {cycle.finishedAt && (
                              <div>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Дууссан цаг:</div>
                                <div style={{ fontSize: 13 }}>{formatDateTime(cycle.finishedAt)}</div>
                              </div>
                            )}
                            {cycle.removedFromAutoclaveAt && (
                              <div>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Автоклаваас гаргасан:</div>
                                <div style={{ fontSize: 13 }}>{formatDateTime(cycle.removedFromAutoclaveAt)}</div>
                              </div>
                            )}
                            {cycle.pressure !== null && cycle.pressure !== undefined && (
                              <div>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Даралт:</div>
                                <div style={{ fontSize: 13 }}>{cycle.pressure} kPa</div>
                              </div>
                            )}
                            {cycle.temperature !== null && cycle.temperature !== undefined && (
                              <div>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Температур:</div>
                                <div style={{ fontSize: 13 }}>{cycle.temperature}°C</div>
                              </div>
                            )}
                          </div>

                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Тэмдэглэл:</div>
                            <div style={{ fontSize: 13 }}>
                              {cycle.notes || <span style={{ color: "#9ca3af" }}>Тэмдэглэл байхгүй</span>}
                            </div>
                          </div>

                          {toolCount > 0 && (
                            <div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Багажийн жагсаалт:</div>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", textAlign: "left" }}>
                                    <th style={{ padding: "6px 8px" }}>Багаж</th>
                                    <th style={{ padding: "6px 8px", width: 140 }}>Үйлдвэрлэсэн тоо</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cycle.toolLines?.map((line) => (
                                    <tr key={line.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                      <td style={{ padding: "6px 8px" }}>{line.tool?.name || `Tool #${line.toolId}`}</td>
                                      <td style={{ padding: "6px 8px" }}>{line.producedQty}</td>
                                    </tr>
                                  ))}
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

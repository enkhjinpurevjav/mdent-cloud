import React, { useEffect, useState } from "react";

type Branch = { id: number; name: string };

type SterilizationItem = {
  id: number;
  name: string;
  branchId: number;
};

type ToolLine = {
  toolId: number | "";
  producedQty: number;
};

function formatDateTime(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

export default function CycleCreatePage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tools, setTools] = useState<SterilizationItem[]>([]);
  
  const [branchId, setBranchId] = useState<number | "">("");
  const [code, setCode] = useState("");
  const [machineNumber, setMachineNumber] = useState("");
  const [completedAt, setCompletedAt] = useState(formatDateTime(new Date()));
  const [result, setResult] = useState<"PASS" | "FAIL">("PASS");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");
  const [toolLines, setToolLines] = useState<ToolLine[]>([{ toolId: "", producedQty: 1 }]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

  useEffect(() => {
    if (!branchId) {
      setTools([]);
      return;
    }
    
    (async () => {
      try {
        const res = await fetch(`/api/sterilization/items?branchId=${branchId}`);
        const data = await res.json().catch(() => []);
        if (res.ok) setTools(Array.isArray(data) ? data : []);
      } catch {
        setTools([]);
      }
    })();
  }, [branchId]);

  const addToolLine = () => {
    setToolLines([...toolLines, { toolId: "", producedQty: 1 }]);
  };

  const removeToolLine = (index: number) => {
    setToolLines(toolLines.filter((_, i) => i !== index));
  };

  const updateToolLine = (index: number, field: keyof ToolLine, value: any) => {
    const updated = [...toolLines];
    updated[index] = { ...updated[index], [field]: value };
    setToolLines(updated);
  };

  const submit = async () => {
    setError("");
    setSuccessMsg("");

    if (!branchId) return setError("Салбар сонгоно уу.");
    if (!code.trim()) return setError("Циклын код оруулна уу.");
    if (!machineNumber.trim()) return setError("Машины дугаар оруулна уу.");
    if (!completedAt) return setError("Огноо цаг оруулна уу.");
    if (!operator.trim()) return setError("Ажилтны нэр оруулна уу.");

    const validLines = toolLines.filter((line) => line.toolId && line.producedQty >= 1);
    if (validLines.length === 0) {
      return setError("Дор хаяж 1 багаж нэмнэ үү.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sterilization/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: Number(branchId),
          code: code.trim(),
          machineNumber: machineNumber.trim(),
          completedAt: new Date(completedAt).toISOString(),
          result,
          operator: operator.trim(),
          notes: notes.trim() || undefined,
          toolLines: validLines.map((line) => ({
            toolId: Number(line.toolId),
            producedQty: Math.floor(line.producedQty),
          })),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Цикл үүсгэхэд алдаа гарлаа");

      setSuccessMsg(`Цикл үүсгэлээ: ${code.trim()}`);
      
      // Reset form
      setCode("");
      setMachineNumber("");
      setCompletedAt(formatDateTime(new Date()));
      setOperator("");
      setNotes("");
      setToolLines([{ toolId: "", producedQty: 1 }]);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      <h1 style={{ fontSize: 18, marginBottom: 6 }}>Ариутгал → Цикл үүсгэх</h1>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
        Автоклавын цикл үүсгэх. Багажуудын үйлдвэрлэгдсэн тоог бүртгэнэ.
      </div>

      {error && <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>{error}</div>}
      {successMsg && <div style={{ color: "#15803d", marginBottom: 10, fontSize: 13 }}>{successMsg}</div>}

      {/* Header Information */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Циклын мэдээлэл</div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, display: "block" }}>
              Салбар <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
            >
              <option value="">Сонгох...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, display: "block" }}>
              Циклын код <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ж: T-2024-001"
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, display: "block" }}>
              Машины дугаар <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              value={machineNumber}
              onChange={(e) => setMachineNumber(e.target.value)}
              placeholder="Ж: AC-01"
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, display: "block" }}>
              Дууссан огноо цаг <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="datetime-local"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, display: "block" }}>
              Үр дүн <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 16, alignItems: "center", paddingTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="result"
                  value="PASS"
                  checked={result === "PASS"}
                  onChange={() => setResult("PASS")}
                />
                <span style={{ fontSize: 13, color: "#15803d", fontWeight: 500 }}>✓ PASS</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="result"
                  value="FAIL"
                  checked={result === "FAIL"}
                  onChange={() => setResult("FAIL")}
                />
                <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>✗ FAIL</span>
              </label>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, display: "block" }}>
              Ажилтан <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="Ажилтны нэр"
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, display: "block" }}>
              Тэмдэглэл
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Нэмэлт мэдээлэл..."
              rows={2}
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit" }}
            />
          </div>
        </div>
      </div>

      {/* Tool Lines */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>Багажийн жагсаалт</div>
          <button
            type="button"
            onClick={addToolLine}
            disabled={!branchId}
            style={{
              border: "none",
              background: "#16a34a",
              color: "#fff",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: branchId ? "pointer" : "not-allowed",
              fontSize: 13,
            }}
          >
            + Багаж нэмэх
          </button>
        </div>

        {!branchId && (
          <div style={{ fontSize: 13, color: "#6b7280", padding: "12px 0" }}>
            Эхлээд салбар сонгоно уу.
          </div>
        )}

        {branchId && toolLines.length === 0 && (
          <div style={{ fontSize: 13, color: "#6b7280", padding: "12px 0" }}>
            Багаж нэмээгүй байна.
          </div>
        )}

        {branchId && toolLines.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", textAlign: "left" }}>
                <th style={{ padding: "8px 4px" }}>№</th>
                <th style={{ padding: "8px 4px" }}>Багаж</th>
                <th style={{ padding: "8px 4px", width: 140 }}>Үйлдвэрлэсэн тоо</th>
                <th style={{ padding: "8px 4px", width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {toolLines.map((line, index) => (
                <tr key={index} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 4px" }}>{index + 1}</td>
                  <td style={{ padding: "8px 4px" }}>
                    <select
                      value={line.toolId}
                      onChange={(e) => updateToolLine(index, "toolId", e.target.value ? Number(e.target.value) : "")}
                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}
                    >
                      <option value="">Багаж сонгох...</option>
                      {tools.map((tool) => (
                        <option key={tool.id} value={tool.id}>{tool.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "8px 4px" }}>
                    <input
                      type="number"
                      min={1}
                      value={line.producedQty}
                      onChange={(e) => updateToolLine(index, "producedQty", Math.max(1, Number(e.target.value) || 1))}
                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}
                    />
                  </td>
                  <td style={{ padding: "8px 4px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => removeToolLine(index)}
                      disabled={toolLines.length === 1}
                      style={{
                        border: "1px solid #dc2626",
                        background: "#fff",
                        color: "#b91c1c",
                        borderRadius: 8,
                        padding: "6px 10px",
                        cursor: toolLines.length > 1 ? "pointer" : "not-allowed",
                        fontSize: 12,
                      }}
                    >
                      Устгах
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            style={{
              border: "none",
              background: "#2563eb",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 16px",
              cursor: loading ? "default" : "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {loading ? "Үүсгэж байна..." : "Цикл үүсгэх"}
          </button>
        </div>
      </div>
    </div>
  );
}

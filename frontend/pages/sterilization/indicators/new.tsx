import React, { useEffect, useMemo, useState } from "react";


type Branch = { id: number; name: string };
type Specialist = { id: number; name: string | null; ovog: string | null; email: string; branchId: number | null };
type SterilizationItem = { id: number; categoryId: number; name: string; quantity: number };

type Line = { itemId: number; quantity: number };

function yyyyMmDd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function SterilizationIndicatorNewPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [prefixes, setPrefixes] = useState<Record<number, string>>({});
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [items, setItems] = useState<SterilizationItem[]>([]);

  const [branchId, setBranchId] = useState<number | "">("");
  const [specialistUserId, setSpecialistUserId] = useState<number | "">("");

  const [indicatorDate, setIndicatorDate] = useState<string>(yyyyMmDd(new Date()));
  const [packageQuantity, setPackageQuantity] = useState<number>(1);

  const [code, setCode] = useState<string>("");

  // item add controls
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<number | "">("");
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [lines, setLines] = useState<Line[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const branchPrefix = branchId ? prefixes[Number(branchId)] || "" : "";

  useEffect(() => {
    (async () => {
      try {
        const [bRes, pRes, sRes, iRes] = await Promise.all([
          fetch("/api/branches"),
          fetch("/api/sterilization/branch-prefixes"),
          fetch("/api/sterilization/specialists"),
          fetch("/api/sterilization/items"),
        ]);

        const b = await bRes.json();
        const p = await pRes.json();
        const s = await sRes.json();
        const i = await iRes.json();

        setBranches(Array.isArray(b) ? b : []);
        setPrefixes(p && typeof p === "object" ? p : {});
        setSpecialists(Array.isArray(s) ? s : []);
        setItems(Array.isArray(i) ? i : []);
      } catch {
        // ignore
      }
    })();
  }, []);

  // whenever branch changes, auto-start code with prefix if code empty or previously auto
  useEffect(() => {
    if (!branchPrefix) return;
    setCode((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return `${branchPrefix}-`;
      // if user already typed something not matching, don't overwrite
      if (trimmed.startsWith(branchPrefix + "-")) return trimmed;
      // if user had old prefix auto, replace it
      const idx = trimmed.indexOf("-");
      if (idx > 0) return `${branchPrefix}-${trimmed.slice(idx + 1)}`;
      return `${branchPrefix}-`;
    });
  }, [branchPrefix]);

  const filteredItemOptions = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const used = new Set(lines.map((l) => l.itemId));
    return items
      .filter((it) => !used.has(it.id))
      .filter((it) => (q ? it.name.toLowerCase().includes(q) : true))
      .slice(0, 50);
  }, [items, itemSearch, lines]);

  const addLine = () => {
    const id = Number(selectedItemId);
    if (!id) return;
    const qty = Math.max(1, Number(selectedQty) || 1);
    setLines((prev) => [...prev, { itemId: id, quantity: qty }]);
    setSelectedItemId("");
    setSelectedQty(1);
    setItemSearch("");
  };

  const removeLine = (itemId: number) => {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const updateLineQty = (itemId: number, qty: number) => {
    const safe = Math.max(1, Math.floor(Number(qty) || 1));
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, quantity: safe } : l)));
  };

  const submit = async () => {
    setError("");
    setSuccessMsg("");

    if (!branchId) return setError("Салбар сонгоно уу.");
    if (!specialistUserId) return setError("Сувилагч (мэргэжилтэн) сонгоно уу.");
    if (!code.trim()) return setError("Индикатор код оруулна уу.");
    if (!indicatorDate) return setError("Огноо сонгоно уу.");
    if (!Number.isFinite(packageQuantity) || packageQuantity < 1) return setError("Багцын тоо 1-с бага байж болохгүй.");
    if (lines.length === 0) return setError("Дор хаяж 1 багаж нэмнэ үү.");

    setLoading(true);
    try {
      const res = await fetch("/api/sterilization/indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: Number(branchId),
          code: code.trim(),
          indicatorDate: new Date(indicatorDate).toISOString(),
          specialistUserId: Number(specialistUserId),
          packageQuantity: Math.floor(packageQuantity),
          items: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to create indicator");

      setSuccessMsg(`Индикатор үүсгэлээ: ${json?.code || code.trim()}`);
      setLines([]);
      setPackageQuantity(1);
      // keep branch + specialist + date for rapid entry
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  return (
 
      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ fontSize: 18, marginBottom: 6 }}>Ариутгал → Индикатор үүсгэх</h1>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
          Салбарт харьяалах индикатор үүсгэж, багажийн багцыг бүртгэнэ.
        </div>

        {error && <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>{error}</div>}
        {successMsg && <div style={{ color: "#15803d", marginBottom: 10, fontSize: 13 }}>{successMsg}</div>}

        {/* Header form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Ерөнхий мэдээлэл</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Салбар</div>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                >
                  <option value="">Сонгох...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {branchPrefix && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    Prefix: <b>{branchPrefix}</b>
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Огноо</div>
                <input
                  type="date"
                  value={indicatorDate}
                  onChange={(e) => setIndicatorDate(e.target.value)}
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Сувилагч (мэргэжилтэн)</div>
                <select
                  value={specialistUserId}
                  onChange={(e) => setSpecialistUserId(e.target.value ? Number(e.target.value) : "")}
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                >
                  <option value="">Сонгох...</option>
                  {specialists.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.name || "") + (u.ovog ? ` ${u.ovog}` : "") || u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Багцын тоо</div>
                <input
                  type="number"
                  min={1}
                  value={packageQuantity}
                  onChange={(e) => setPackageQuantity(Math.max(1, Number(e.target.value) || 1))}
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Индикатор код</div>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ж: M-000123"
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                />
              </div>
            </div>
          </div>

          {/* Add items */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Багцад багаж нэмэх</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Хайх..."
                style={{ flex: "1 1 220px", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
              />

              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value ? Number(e.target.value) : "")}
                style={{ flex: "1 1 260px", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
              >
                <option value="">Багаж сонгох...</option>
                {filteredItemOptions.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                value={selectedQty}
                onChange={(e) => setSelectedQty(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 110, border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
              />

              <button
                type="button"
                onClick={addLine}
                disabled={!selectedItemId}
                style={{ border: "none", background: "#16a34a", color: "#fff", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}
              >
                + Нэмэх
              </button>
            </div>

            <div style={{ fontSize: 12, color: "#6b7280" }}>
              * Энд оруулсан “тоо” нь <b>1 багц дахь</b> тухайн багажийн тоо.
            </div>
          </div>
        </div>

        {/* Lines preview */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Багцын бүрэлдэхүүн</div>

          {lines.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>Одоогоор багаж нэмээгүй байна.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#6b7280", textAlign: "left" }}>
                  <th style={{ padding: "6px 4px" }}>Багаж</th>
                  <th style={{ padding: "6px 4px", width: 160 }}>1 багц дахь тоо</th>
                  <th style={{ padding: "6px 4px", width: 140 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const it = items.find((x) => x.id === l.itemId);
                  return (
                    <tr key={l.itemId} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 4px" }}>{it?.name || `#${l.itemId}`}</td>
                      <td style={{ padding: "8px 4px" }}>
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => updateLineQty(l.itemId, Number(e.target.value))}
                          style={{ width: 120, border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 8px" }}
                        />
                      </td>
                      <td style={{ padding: "8px 4px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => removeLine(l.itemId)}
                          style={{ border: "1px solid #dc2626", background: "#fff", color: "#b91c1c", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                        >
                          Устгах
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={loading}
              style={{ border: "none", background: "#2563eb", color: "#fff", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}
            >
              {loading ? "Үүсгэж байна..." : "Индикатор үүсгэх"}
            </button>
          </div>
        </div>
      </div>
   
  );
}

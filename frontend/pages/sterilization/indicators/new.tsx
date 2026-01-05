import React, { useEffect, useMemo, useState } from "react";


type Branch = { id: number; name: string };

type Specialist = {
  id: number;
  name: string | null;
  ovog: string | null;
  email: string;
  branchId: number | null;
};

type SterilizationItem = {
  id: number;
  categoryId: number;
  name: string;
  quantity: number; // inventory count from settings (not used for indicator)
};

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

  const [packageName, setPackageName] = useState<string>("");
  const [code, setCode] = useState<string>("");

  // item add controls
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<number | "">("");
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

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

        const b = await bRes.json().catch(() => []);
        const p = await pRes.json().catch(() => ({}));
        const s = await sRes.json().catch(() => []);
        const i = await iRes.json().catch(() => []);

        if (bRes.ok) setBranches(Array.isArray(b) ? b : []);
        if (pRes.ok && p && typeof p === "object") setPrefixes(p);
        if (sRes.ok) setSpecialists(Array.isArray(s) ? s : []);
        if (iRes.ok) setItems(Array.isArray(i) ? i : []);
      } catch {
        // ignore; error will show on submit if needed
      }
    })();
  }, []);

  // Auto-apply prefix when branch changes (do not overwrite user custom text too aggressively)
  useEffect(() => {
    if (!branchPrefix) return;

    setCode((prev) => {
      const t = prev.trim();
      if (!t) return `${branchPrefix}-`;

      // If it already starts with correct prefix, keep
      if (t.startsWith(`${branchPrefix}-`)) return t;

      // If code had old prefix like X-..., replace prefix part
      const dashIdx = t.indexOf("-");
      if (dashIdx > 0) return `${branchPrefix}-${t.slice(dashIdx + 1)}`;

      // If no dash, just prepend
      return `${branchPrefix}-${t}`;
    });
  }, [branchPrefix]);

  const filteredItemOptions = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const used = new Set(selectedItemIds);
    return items
      .filter((it) => !used.has(it.id))
      .filter((it) => (q ? it.name.toLowerCase().includes(q) : true))
      .slice(0, 50);
  }, [items, itemSearch, selectedItemIds]);

  const addItem = () => {
    const id = Number(selectedItemId);
    if (!id) return;
    setSelectedItemIds((prev) => [...prev, id]);
    setSelectedItemId("");
    setItemSearch("");
  };

  const removeItem = (id: number) => {
    setSelectedItemIds((prev) => prev.filter((x) => x !== id));
  };

  const submit = async () => {
    setError("");
    setSuccessMsg("");

    if (!branchId) return setError("Салбар сонгоно уу.");
    if (!specialistUserId) return setError("Сувилагч (мэргэжилтэн) сонгоно уу.");
    if (!indicatorDate) return setError("Огноо сонгоно уу.");
    if (!packageName.trim()) return setError("Багцын нэр оруулна уу. Ж: Үзлэгийн бахь");
    if (!code.trim()) return setError("Индикатор код оруулна уу. Ж: T-920");
    if (!Number.isFinite(packageQuantity) || packageQuantity < 1) {
      return setError("Багцын тоо 1-с бага байж болохгүй.");
    }
    if (selectedItemIds.length === 0) return setError("Дор хаяж 1 багаж нэмнэ үү.");

    setLoading(true);
    try {
      const res = await fetch("/api/sterilization/indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: Number(branchId),
          packageName: packageName.trim(),
          code: code.trim(),
          indicatorDate: new Date(indicatorDate).toISOString(),
          specialistUserId: Number(specialistUserId),
          packageQuantity: Math.floor(packageQuantity),
          items: selectedItemIds, // number[]
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to create indicator");

      setSuccessMsg(`Индикатор үүсгэлээ: ${json?.packageName || packageName.trim()} ${json?.code || code.trim()}`);
      setSelectedItemIds([]);
      setPackageQuantity(1);
      // Keep branch/date/specialist for quick next entry
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
          Ариутгалын багц үүсгэж (нэр + код), хэдэн ширхэг багц гарсныг бүртгэнэ.
        </div>

        {error && <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>{error}</div>}
        {successMsg && <div style={{ color: "#15803d", marginBottom: 10, fontSize: 13 }}>{successMsg}</div>}

        {/* Header */}
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
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Сувилагч</div>
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
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Багцын нэр</div>
                <input
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="Ж: Үзлэгийн бахь"
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Индикатор код</div>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ж: T-920"
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                />
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  Encounter дээр: <b>{packageName?.trim() || "Багц"}</b> <b>{code?.trim() || ""}</b> гэж харагдана.
                </div>
              </div>
            </div>
          </div>

          {/* Add items */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Багцад багаж нэмэх</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
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

              <button
                type="button"
                onClick={addItem}
                disabled={!selectedItemId}
                style={{ border: "none", background: "#16a34a", color: "#fff", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}
              >
                + Нэмэх
              </button>
            </div>

            <div style={{ fontSize: 12, color: "#6b7280" }}>
              * Багцын бүрэлдэхүүнд оруулах багажуудыг жагсаана (тоо оруулахгүй).
            </div>
          </div>
        </div>

        {/* Selected items */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Багцын бүрэлдэхүүн</div>

          {selectedItemIds.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>Одоогоор багаж нэмээгүй байна.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#6b7280", textAlign: "left" }}>
                  <th style={{ padding: "6px 4px" }}>Багаж</th>
                  <th style={{ padding: "6px 4px", width: 140 }} />
                </tr>
              </thead>
              <tbody>
                {selectedItemIds.map((id) => {
                  const it = items.find((x) => x.id === id);
                  return (
                    <tr key={id} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 4px" }}>{it?.name || `#${id}`}</td>
                      <td style={{ padding: "8px 4px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => removeItem(id)}
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

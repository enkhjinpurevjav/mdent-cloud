import React, { useEffect, useMemo, useState } from "react";


type SterilizationCategory = {
  id: number;
  name: string;
  createdAt?: string;
};

type SterilizationItem = {
  id: number;
  categoryId: number;
  name: string;
  createdAt?: string;
};

export default function SterilizationSettingsPage() {
  const [categories, setCategories] = useState<SterilizationCategory[]>([]);
  const [items, setItems] = useState<SterilizationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">("");

  const [filterText, setFilterText] = useState("");

  const filteredCategories = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, filterText]);

  const filteredItems = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, filterText]);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [catRes, itemRes] = await Promise.all([
        fetch("/api/sterilization/categories"),
        fetch("/api/sterilization/items"),
      ]);

      const cats = await catRes.json().catch(() => []);
      const its = await itemRes.json().catch(() => []);

      if (!catRes.ok) throw new Error(cats?.error || "Failed to load categories");
      if (!itemRes.ok) throw new Error(its?.error || "Failed to load items");

      setCategories(Array.isArray(cats) ? cats : []);
      setItems(Array.isArray(its) ? its : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const createCategory = async () => {
    const name = categoryName.trim();
    if (!name) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sterilization/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to create category");
      setCategoryName("");
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm("Ангиллыг устгах уу? (Доторх багажууд хамт устаж болно)")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sterilization/categories/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to delete category");
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const createItem = async () => {
    const name = itemName.trim();
    if (!name || !selectedCategoryId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sterilization/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, categoryId: Number(selectedCategoryId) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to create item");
      setItemName("");
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Багаж устгах уу?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sterilization/items/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to delete item");
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const itemsByCategory = useMemo(() => {
    const map: Record<number, SterilizationItem[]> = {};
    for (const it of filteredItems) {
      map[it.categoryId] = map[it.categoryId] || [];
      map[it.categoryId].push(it);
    }
    return map;
  }, [filteredItems]);

  return (
 
      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ fontSize: 18, marginBottom: 6 }}>Ариутгал → Тохиргоо</h1>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
          Ариутгалд орох багажийн ангилал болон багажийн жагсаалтыг удирдана.
        </div>

        {error && (
          <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Хайх (ангилал эсвэл багаж)..."
            style={{
              flex: "1 1 260px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 13,
            }}
          />
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            style={{
              border: "1px solid #d1d5db",
              background: "#fff",
              borderRadius: 8,
              padding: "8px 10px",
              cursor: loading ? "default" : "pointer",
              fontSize: 13,
            }}
          >
            {loading ? "Ачаалж байна..." : "Шинэчлэх"}
          </button>
        </div>

        {/* Create forms */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Ангилал нэмэх</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ж: Үзлэгийн багаж"
                style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => void createCategory()}
                disabled={loading || !categoryName.trim()}
                style={{ border: "none", background: "#2563eb", color: "#fff", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}
              >
                Нэмэх
              </button>
            </div>
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Багаж нэмэх</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : "")}
                style={{ flex: "1 1 220px", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              >
                <option value="">Ангилал сонгох</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Ж: Толин тусгал"
                style={{ flex: "1 1 220px", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => void createItem()}
                disabled={loading || !itemName.trim() || !selectedCategoryId}
                style={{ border: "none", background: "#16a34a", color: "#fff", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}
              >
                Нэмэх
              </button>
            </div>
          </div>
        </div>

        {/* Lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredCategories.map((cat) => (
            <div key={cat.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontWeight: 700 }}>{cat.name}</div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => void deleteCategory(cat.id)}
                    disabled={loading}
                    style={{ border: "1px solid #dc2626", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                  >
                    Устгах
                  </button>
                </div>
              </div>

              <div style={{ padding: 12 }}>
                {(itemsByCategory[cat.id] || []).length === 0 ? (
                  <div style={{ fontSize: 13, color: "#6b7280" }}>Энэ ангилалд багаж бүртгэгдээгүй байна.</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: "#6b7280", textAlign: "left" }}>
                        <th style={{ padding: "6px 4px" }}>Багаж</th>
                        <th style={{ padding: "6px 4px", width: 120 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(itemsByCategory[cat.id] || []).map((it) => (
                        <tr key={it.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "8px 4px" }}>{it.name}</td>
                          <td style={{ padding: "8px 4px", textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => void deleteItem(it.id)}
                              disabled={loading}
                              style={{ border: "1px solid #dc2626", background: "#fff", color: "#b91c1c", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                            >
                              Устгах
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredCategories.length === 0 && !loading && (
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Ангилал олдсонгүй.
          </div>
        )}
      </div>

  );
}

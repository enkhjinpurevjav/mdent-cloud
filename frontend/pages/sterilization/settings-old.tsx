import React, { useEffect, useMemo, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type SterilizationCategory = {
  id: number;
  name: string;
  createdAt?: string;
};

type SterilizationItem = {
  id: number;
  categoryId: number;
  branchId: number;
  name: string;
  quantity: number;
  createdAt?: string;
  branch?: Branch;
  category?: { id: number; name: string };
};

export default function SterilizationSettingsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<SterilizationCategory[]>([]);
  const [items, setItems] = useState<SterilizationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState<number>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">("");

  const [filterText, setFilterText] = useState("");

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");

  // inline edit state for items
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQty, setEditItemQty] = useState<number>(1);

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
      const itemUrl = selectedBranchId 
        ? `/api/sterilization/items?branchId=${selectedBranchId}`
        : `/api/sterilization/items`;
      
      const [branchRes, catRes, itemRes] = await Promise.all([
        fetch("/api/branches"),
        fetch("/api/sterilization/categories"),
        fetch(itemUrl),
      ]);

      const br = await branchRes.json().catch(() => []);
      const cats = await catRes.json().catch(() => []);
      const its = await itemRes.json().catch(() => []);

      if (branchRes.ok) setBranches(Array.isArray(br) ? br : []);
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

  useEffect(() => {
    void loadAll();
  }, [selectedBranchId]);

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

  const startEditCategory = (cat: SterilizationCategory) => {
  setEditingCategoryId(cat.id);
  setEditCategoryName(cat.name);
};

const cancelEditCategory = () => {
  setEditingCategoryId(null);
  setEditCategoryName("");
};

const saveEditCategory = async () => {
  if (editingCategoryId === null) return;

  const name = editCategoryName.trim();
  if (!name) {
    setError("Ангиллын нэр хоосон байж болохгүй.");
    return;
  }

  setLoading(true);
  setError("");
  try {
    const res = await fetch(`/api/sterilization/categories/${editingCategoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || "Failed to update category");

    cancelEditCategory();
    await loadAll();
  } catch (e: any) {
    setError(e?.message || "Алдаа гарлаа");
  } finally {
    setLoading(false);
  }
};

  const createItem = async () => {
    const name = itemName.trim();
    const qty = Number(itemQty);
    if (!name || !selectedCategoryId || !selectedBranchId) {
      setError("Салбар, ангилал, нэр бүгдийг бөглөнө үү.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Тоо ширхэг 1-с бага байж болохгүй.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sterilization/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          branchId: Number(selectedBranchId),
          categoryId: Number(selectedCategoryId), 
          quantity: qty 
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to create item");
      setItemName("");
      setItemQty(1);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const startEditItem = (it: SterilizationItem) => {
    setEditingItemId(it.id);
    setEditItemName(it.name);
    setEditItemQty(it.quantity ?? 1);
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditItemName("");
    setEditItemQty(1);
  };

  const saveEditItem = async () => {
    if (editingItemId === null) return;
    const name = editItemName.trim();
    const qty = Number(editItemQty);

    if (!name) {
      setError("Нэр хоосон байж болохгүй.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Тоо ширхэг 1-с бага байж болохгүй.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sterilization/items/${editingItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity: qty }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to update item");

      cancelEditItem();
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
 
      <div className="max-w-[1100px]">
        <h1 className="mb-1.5 text-[18px]">Ариутгал → Тохиргоо</h1>
        <div className="mb-3 text-[13px] text-gray-500">
          Ариутгалд орох багажийн ангилал болон багажийн жагсаалтыг удирдана.
        </div>

        {error && <div className="mb-2.5 text-[13px] text-red-700">{error}</div>}

        <div className="mb-3 flex flex-wrap gap-3">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
            className="basis-[220px] grow-0 shrink border border-gray-300 rounded-lg px-2.5 py-2 text-[13px]"
          >
            <option value="">Бүх салбар</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Хайх (ангилал эсвэл багаж)..."
            className="basis-[260px] grow shrink border border-gray-300 rounded-lg px-2.5 py-2 text-[13px]"
          />
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className={`border border-gray-300 bg-white rounded-lg px-2.5 py-2 text-[13px] ${loading ? "cursor-default" : "cursor-pointer"}`}
          >
            {loading ? "Ачаалж байна..." : "Шинэчлэх"}
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded-[10px] bg-white p-3">
            <div className="mb-2 font-semibold">Ангилал нэмэх</div>
            <div className="flex gap-2">
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ж: Үзлэгийн багаж"
                className="flex-1 border border-gray-300 rounded-lg px-2.5 py-2 text-[13px]"
              />
              <button
                type="button"
                onClick={() => void createCategory()}
                disabled={loading || !categoryName.trim()}
                className="border-0 bg-blue-600 text-white rounded-lg px-3 py-2 cursor-pointer"
              >
                Нэмэх
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-[10px] bg-white p-3">
            <div className="mb-2 font-semibold">Багаж нэмэх</div>
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
                className="basis-[180px] grow shrink border border-gray-300 rounded-lg px-2.5 py-2 text-[13px]"
              >
                <option value="">Салбар сонгох</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : "")}
                className="basis-[180px] grow shrink border border-gray-300 rounded-lg px-2.5 py-2 text-[13px]"
              >
                <option value="">Ангилал сонгох</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Багажийн нэр"
                className="basis-[200px] grow shrink border border-gray-300 rounded-lg px-2.5 py-2 text-[13px]"
              />

              <input
                type="number"
                min={1}
                value={itemQty}
                onChange={(e) => setItemQty(Math.max(1, Number(e.target.value) || 1))}
                placeholder="Тоо"
                className="w-[110px] border border-gray-300 rounded-lg px-2.5 py-2 text-[13px]"
              />

              <button
                type="button"
                onClick={() => void createItem()}
                disabled={loading || !itemName.trim() || !selectedCategoryId || !selectedBranchId}
                className="border-0 bg-green-600 text-white rounded-lg px-3 py-2 cursor-pointer"
              >
                Нэмэх
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
  {filteredCategories.map((cat) => {
    const isEditingCategory = editingCategoryId === cat.id;

    return (
      <div
        key={cat.id}
        className="border border-gray-200 rounded-[10px] bg-white"
      >
        {/* Category header */}
        <div className="flex items-center gap-2 border-b border-gray-100 p-3">
          <div className="flex-1 font-bold">
            {isEditingCategory ? (
              <input
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                className="w-full max-w-[420px] border border-gray-300 rounded-lg px-2 py-1.5 text-[13px]"
              />
            ) : (
              cat.name
            )}
          </div>

          <div className="ml-auto flex gap-2">
            {isEditingCategory ? (
              <>
                <button
                  type="button"
                  onClick={() => void saveEditCategory()}
                  disabled={loading}
                  className="border-0 bg-blue-600 text-white rounded-lg px-2.5 py-1.5 cursor-pointer text-xs"
                >
                  Хадгалах
                </button>
                <button
                  type="button"
                  onClick={cancelEditCategory}
                  disabled={loading}
                  className="border border-gray-300 bg-white rounded-lg px-2.5 py-1.5 cursor-pointer text-xs"
                >
                  Болих
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => startEditCategory(cat)}
                  disabled={loading}
                  className="border border-blue-600 bg-blue-50 text-blue-600 rounded-lg px-2.5 py-1.5 cursor-pointer text-xs"
                >
                  Засах
                </button>

                <button
                  type="button"
                  onClick={() => void deleteCategory(cat.id)}
                  disabled={loading}
                  className="border border-red-600 bg-red-50 text-red-700 rounded-lg px-2.5 py-1.5 cursor-pointer text-xs"
                >
                  Устгах
                </button>
              </>
            )}
          </div>
        </div>

        {/* Items table */}
        <div className="p-3">
          {(itemsByCategory[cat.id] || []).length === 0 ? (
            <div className="text-[13px] text-gray-500">
              Энэ ангилалд багаж бүртгэгдээгүй байна.
            </div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-1 py-1.5">Багаж</th>
                  <th className="w-[140px] px-1 py-1.5">Салбар</th>
                  <th className="w-[90px] px-1 py-1.5">Тоо</th>
                  <th className="w-[220px] px-1 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {(itemsByCategory[cat.id] || []).map((it) => {
                  const isEditing = editingItemId === it.id;

                  return (
                    <tr key={it.id} className="border-t border-gray-100">
                      <td className="px-1 py-2">
                        {isEditing ? (
                          <input
                            value={editItemName}
                            onChange={(e) => setEditItemName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5"
                          />
                        ) : (
                          it.name
                        )}
                      </td>

                      <td className="px-1 py-2">
                        <span className="text-xs text-gray-500">
                          {it.branch?.name || "—"}
                        </span>
                      </td>

                      <td className="px-1 py-2">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            value={editItemQty}
                            onChange={(e) =>
                              setEditItemQty(Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-20 border border-gray-300 rounded-lg px-2 py-1.5"
                          />
                        ) : (
                          it.quantity
                        )}
                      </td>

                      <td className="px-1 py-2 text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => void saveEditItem()}
                              disabled={loading}
                              className="border-0 bg-blue-600 text-white rounded-lg px-2.5 py-1.5 cursor-pointer text-xs"
                            >
                              Хадгалах
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditItem}
                              disabled={loading}
                              className="border border-gray-300 bg-white rounded-lg px-2.5 py-1.5 cursor-pointer text-xs"
                            >
                              Болих
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditItem(it)}
                              disabled={loading}
                              className="border border-blue-600 bg-blue-50 text-blue-600 rounded-lg px-2.5 py-1.5 cursor-pointer text-xs"
                            >
                              Засах
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteItem(it.id)}
                              disabled={loading}
                              className="border border-red-600 bg-white text-red-700 rounded-lg px-2.5 py-1.5 cursor-pointer text-xs"
                            >
                              Устгах
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  })}
</div>

        {filteredCategories.length === 0 && !loading && (
          <div className="text-[13px] text-gray-500">Ангилал олдсонгүй.</div>
        )}
      </div>
   
  );
}

import React, { useEffect, useState, useMemo } from "react";

type Branch = {
  id: number;
  name: string;
};

type SterilizationItem = {
  id: number;
  branchId: number;
  name: string;
  baselineAmount: number;
  branch?: Branch;
};

export default function SterilizationSettingsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [items, setItems] = useState<SterilizationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState<number>(1);

  const [filterText, setFilterText] = useState("");

  // Inline edit state for items
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQty, setEditItemQty] = useState<number>(1);

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
      
      const [branchRes, itemRes] = await Promise.all([
        fetch("/api/branches"),
        fetch(itemUrl),
      ]);

      const br = await branchRes.json().catch(() => []);
      const its = await itemRes.json().catch(() => []);

      if (branchRes.ok) setBranches(Array.isArray(br) ? br : []);
      if (!itemRes.ok) throw new Error(its?.error || "Failed to load items");

      setItems(Array.isArray(its) ? its : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [selectedBranchId]);

  const createItem = async () => {
    const name = itemName.trim();
    const qty = Number(itemQty);
    if (!name || !selectedBranchId) {
      setError("Салбар, нэр бүгдийг бөглөнө үү.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Тоо ширхэг 1-с бага байж болохгүй.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/sterilization/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          branchId: Number(selectedBranchId),
          baselineAmount: qty 
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to create item");

      setSuccessMsg(`Багаж үүслээ: ${name}`);
      setItemName("");
      setItemQty(1);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Багажийг устгах уу?")) return;

    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/sterilization/items/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to delete item");
      }
      setSuccessMsg("Багаж устгагдлаа");
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const startEditItem = (item: SterilizationItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemQty(item.baselineAmount);
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
      setError("Багажийн нэр хоосон байж болохгүй.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Тоо ширхэг 1-с бага байж болохгүй.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/sterilization/items/${editingItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, baselineAmount: qty }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to update item");

      setSuccessMsg("Багаж шинэчлэгдлээ");
      cancelEditItem();
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <h1 className="mb-2 text-2xl font-bold">Ариутгалын багажийн тохиргоо</h1>
      <p className="mb-4 text-sm text-gray-500">Салбар бүрт харгалзах ариутгалын багажуудыг бүртгэж удирдана.</p>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-3 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}

      {/* Branch selector and filter */}
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="w-full md:w-[300px] md:flex-none">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Салбар</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
          >
            <option value="">Бүгд</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[280px] flex-1">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Хайлт</label>
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Багажийн нэрээр хайх..."
            className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
          />
        </div>
      </div>

      {/* Create item form */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 text-base font-semibold">Шинэ багаж нэмэх</div>
        <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-[250px_1fr_100px_140px]">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Салбар *</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            >
              <option value="">Сонгох...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Багажийн нэр *</label>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Ж: Үзлэгийн багаж"
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Үндсэн тоо *</label>
            <input
              type="number"
              min={1}
              value={itemQty}
              onChange={(e) => setItemQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={createItem}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "..." : "Нэмэх"}
          </button>
        </div>
      </div>

      {/* Items list */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3 text-base font-semibold">
          Багажуудын жагсаалт ({filteredItems.length})
        </div>
        
        {filteredItems.length === 0 ? (
          <div className="p-5 text-center text-sm text-gray-500">
            {loading ? "Ачаалж байна..." : "Багаж олдсонгүй"}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 font-semibold">Салбар</th>
                <th className="px-4 py-2.5 font-semibold">Багажийн нэр</th>
                <th className="w-[120px] px-4 py-2.5 font-semibold">Үндсэн тоо</th>
                <th className="w-[200px] px-4 py-2.5 font-semibold">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isEditing = editingItemId === item.id;
                return (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      {item.branch?.name || `Branch #${item.branchId}`}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input
                          value={editItemName}
                          onChange={(e) => setEditItemName(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                        />
                      ) : (
                        <span className="font-semibold">{item.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          value={editItemQty}
                          onChange={(e) => setEditItemQty(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                        />
                      ) : (
                        <span>{item.baselineAmount}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={saveEditItem}
                            className="rounded-md bg-green-600 px-3 py-1.5 text-xs text-white"
                          >
                            Хадгалах
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditItem}
                            className="rounded-md bg-gray-500 px-3 py-1.5 text-xs text-white"
                          >
                            Болих
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditItem(item)}
                            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs text-white"
                          >
                            Засах
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs text-white"
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
}

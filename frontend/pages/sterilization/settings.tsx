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
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8, fontWeight: 700 }}>
        Ариутгалын багажийн тохиргоо
      </h1>
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
        Салбар бүрт харгалзах ариутгалын багажуудыг бүртгэж удирдана.
      </div>

      {error && (
        <div
          style={{
            background: "#fee",
            color: "#b91c1c",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
      {successMsg && (
        <div
          style={{
            background: "#d1fae5",
            color: "#065f46",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Branch selector and filter */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 300px" }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Салбар
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 14,
            }}
          >
            <option value="">Бүгд</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 300px" }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Хайлт
          </label>
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Багажийн нэрээр хайх..."
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 14,
            }}
          />
        </div>
      </div>

      {/* Create item form */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Шинэ багаж нэмэх
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr 100px 140px", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              Салбар *
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 14,
              }}
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
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              Багажийн нэр *
            </label>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Ж: Үзлэгийн багаж"
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 14,
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              Үндсэн тоо *
            </label>
            <input
              type="number"
              min={1}
              value={itemQty}
              onChange={(e) => setItemQty(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 14,
              }}
            />
          </div>
          <button
            type="button"
            onClick={createItem}
            disabled={loading}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : "Нэмэх"}
          </button>
        </div>
      </div>

      {/* Items list */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e5e7eb",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Багажуудын жагсаалт ({filteredItems.length})
        </div>
        
        {filteredItems.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
            {loading ? "Ачаалж байна..." : "Багаж олдсонгүй"}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Салбар</th>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Багажийн нэр</th>
                <th style={{ padding: "10px 16px", fontWeight: 600, width: 120 }}>Үндсэн тоо</th>
                <th style={{ padding: "10px 16px", fontWeight: 600, width: 200 }}>Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isEditing = editingItemId === item.id;
                return (
                  <tr key={item.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 16px" }}>
                      {item.branch?.name || `Branch #${item.branchId}`}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {isEditing ? (
                        <input
                          value={editItemName}
                          onChange={(e) => setEditItemName(e.target.value)}
                          style={{
                            width: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 13,
                          }}
                        />
                      ) : (
                        <span style={{ fontWeight: 600 }}>{item.name}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          value={editItemQty}
                          onChange={(e) => setEditItemQty(Math.max(1, Number(e.target.value) || 1))}
                          style={{
                            width: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 13,
                          }}
                        />
                      ) : (
                        <span>{item.baselineAmount}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={saveEditItem}
                            style={{
                              background: "#16a34a",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Хадгалах
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditItem}
                            style={{
                              background: "#6b7280",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Болих
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => startEditItem(item)}
                            style={{
                              background: "#f59e0b",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Засах
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            style={{
                              background: "#dc2626",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
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

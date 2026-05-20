import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

type InventoryProductRow = {
  id: number;
  name: string;
  code: string | null;
  isActive: boolean;
  openingBalance: number;
  additionalOrdered: number;
  totalBalance: number;
  consumed: number;
  currentBalance: number;
  updatedAt: string | null;
};

type InventoryCategoryGroup = {
  id: number;
  name: string;
  isActive: boolean;
  products: InventoryProductRow[];
};

type EditableStock = {
  openingBalance: string;
  consumed: string;
};

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("mn-MN");
}

function formatNumber(value: number) {
  return Number(value).toLocaleString("mn-MN");
}

export default function SupplyInventoryPage() {
  const { me, loading: authLoading } = useAuth();
  const canManage = me?.role === "admin" || me?.role === "super_admin";

  const [categories, setCategories] = useState<InventoryCategoryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<Record<number, EditableStock>>({});
  const [savingById, setSavingById] = useState<Record<number, boolean>>({});
  const [rowMessageById, setRowMessageById] = useState<Record<number, string>>({});

  const loadInventory = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set("includeInactive", "true");
      const res = await fetch(`/api/supply/inventory?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Нөөцийн жагсаалт ачаалж чадсангүй.");
      }
      const list = Array.isArray(data?.categories) ? data.categories : [];
      setCategories(list);

      const nextEditing: Record<number, EditableStock> = {};
      for (const category of list) {
        for (const product of category.products || []) {
          nextEditing[product.id] = {
            openingBalance: String(Number(product.openingBalance || 0)),
            consumed: String(Number(product.consumed || 0)),
          };
        }
      }
      setEditing(nextEditing);
    } catch (e: any) {
      setCategories([]);
      setError(e.message || "Нөөцийн жагсаалт ачаалж чадсангүй.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    void loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, showInactive]);

  const flatProducts = useMemo(
    () => categories.flatMap((category) => category.products || []),
    [categories]
  );

  const getAdditionalOrdered = (productId: number) =>
    Number(flatProducts.find((p) => p.id === productId)?.additionalOrdered || 0);

  const getUpdatedAt = (productId: number) =>
    flatProducts.find((p) => p.id === productId)?.updatedAt || null;

  const handleFieldChange = (
    productId: number,
    field: keyof EditableStock,
    value: string
  ) => {
    setEditing((prev) => ({
      ...prev,
      [productId]: {
        openingBalance: prev[productId]?.openingBalance ?? "0",
        consumed: prev[productId]?.consumed ?? "0",
        [field]: value,
      },
    }));
    setRowMessageById((prev) => ({ ...prev, [productId]: "" }));
  };

  const saveRow = async (productId: number) => {
    const draft = editing[productId] || { openingBalance: "0", consumed: "0" };
    const openingBalance = Number(draft.openingBalance);
    const consumed = Number(draft.consumed);

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setRowMessageById((prev) => ({
        ...prev,
        [productId]: "Эхний үлдэгдэл 0 эсвэл түүнээс дээш тоо байна.",
      }));
      return;
    }
    if (!Number.isFinite(consumed) || consumed < 0) {
      setRowMessageById((prev) => ({
        ...prev,
        [productId]: "Хэрэглэсэн 0 эсвэл түүнээс дээш тоо байна.",
      }));
      return;
    }

    setSavingById((prev) => ({ ...prev, [productId]: true }));
    setRowMessageById((prev) => ({ ...prev, [productId]: "" }));
    try {
      const res = await fetch(`/api/supply/inventory/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingBalance,
          consumed,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Мөр хадгалах үед алдаа гарлаа.");
      }
      setRowMessageById((prev) => ({ ...prev, [productId]: "Амжилттай хадгаллаа." }));
      await loadInventory();
    } catch (e: any) {
      setRowMessageById((prev) => ({
        ...prev,
        [productId]: e.message || "Мөр хадгалах үед алдаа гарлаа.",
      }));
    } finally {
      setSavingById((prev) => ({ ...prev, [productId]: false }));
    }
  };

  if (authLoading) {
    return (
      <main className="mx-auto my-4 max-w-[1320px] p-6">
        <div className="text-sm text-slate-600">Ачааллаж байна...</div>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="mx-auto my-4 max-w-[1320px] p-6">
        <h1 className="mb-3 text-2xl font-semibold">Бараа материалын нөөц</h1>
        <div className="text-sm text-red-700">Хандах эрхгүй.</div>
      </main>
    );
  }

  return (
    <main className="mx-auto my-4 max-w-[1320px] p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Бараа материалын нөөц</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ангиллаар бүлэглэсэн нөөц: эхний үлдэгдэл, нэмэлт захиалга, нийт, хэрэглэсэн, одоогийн.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Архивтай нь
          </label>
          <button
            type="button"
            onClick={() => void loadInventory()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Шинэчлэх
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-slate-600">Ачааллаж байна...</div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Нөөцийн мэдээлэл алга.
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <section key={category.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-lg font-semibold">{category.name}</h2>
                {!category.isActive && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                    архив
                  </span>
                )}
              </div>

              {category.products.length === 0 ? (
                <div className="text-sm text-slate-600">Энэ ангилалд бараа байхгүй.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="px-2 py-2">Бараа</th>
                        <th className="px-2 py-2 text-right">Эхний үлдэгдэл</th>
                        <th className="px-2 py-2 text-right">Нэмэлт захиалга</th>
                        <th className="px-2 py-2 text-right">Нийт үлдэгдэл</th>
                        <th className="px-2 py-2 text-right">Хэрэглэсэн</th>
                        <th className="px-2 py-2 text-right">Одоогийн</th>
                        <th className="px-2 py-2">Updated time</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {category.products.map((product) => {
                        const draft = editing[product.id] || {
                          openingBalance: String(Number(product.openingBalance || 0)),
                          consumed: String(Number(product.consumed || 0)),
                        };
                        const opening = Number(draft.openingBalance || "0");
                        const consumed = Number(draft.consumed || "0");
                        const additionalOrdered = getAdditionalOrdered(product.id);
                        const total = Number(
                          (Number.isFinite(opening) ? opening : 0) + additionalOrdered
                        );
                        const current = Number((total - (Number.isFinite(consumed) ? consumed : 0)).toFixed(2));
                        const rowMessage = rowMessageById[product.id] || "";

                        return (
                          <tr key={product.id} className="border-b border-slate-100 align-top">
                            <td className="px-2 py-2">
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-slate-500">
                                {product.code || `ID: ${product.id}`}
                              </div>
                              {!product.isActive && (
                                <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                                  архив
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={draft.openingBalance}
                                onChange={(e) =>
                                  handleFieldChange(product.id, "openingBalance", e.target.value)
                                }
                                className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                              />
                            </td>
                            <td className="px-2 py-2 text-right font-semibold text-blue-700">
                              {formatNumber(additionalOrdered)}
                            </td>
                            <td className="px-2 py-2 text-right font-semibold">
                              {formatNumber(total)}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={draft.consumed}
                                onChange={(e) =>
                                  handleFieldChange(product.id, "consumed", e.target.value)
                                }
                                className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                              />
                            </td>
                            <td className="px-2 py-2 text-right font-semibold text-emerald-700">
                              {formatNumber(current)}
                            </td>
                            <td className="px-2 py-2 text-xs text-slate-500">
                              {formatDateTime(getUpdatedAt(product.id))}
                              {rowMessage && (
                                <div
                                  className={`mt-1 ${
                                    rowMessage.includes("Амжилттай")
                                      ? "text-emerald-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  {rowMessage}
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => void saveRow(product.id)}
                                disabled={!!savingById[product.id]}
                                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-70"
                              >
                                {savingById[product.id] ? "Хадгалж байна..." : "Хадгалах"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

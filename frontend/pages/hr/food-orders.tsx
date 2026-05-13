import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

type Branch = { id: number; name: string };

type FoodOrderItem = {
  id: number;
  orderDate: string;
  submitTimestamp: string;
  quantity: number;
};

type FoodOrderRow = {
  userId: number;
  name: string | null;
  ovog: string | null;
  role: string;
  branchId: number | null;
  branchName: string;
  totalCount: number;
  orders: FoodOrderItem[];
};

type FoodOrderAdminResponse = {
  fromDate: string;
  toDate: string;
  totalOrders: number;
  totalQuantity?: number;
  items: FoodOrderRow[];
};

function todayUlaanbaatarStr() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return `${map.year}-${map.month}-${map.day}`;
}

function formatDisplayName(ovog: string | null, name: string | null) {
  if (!name) return "(нэргүй)";
  if (ovog && ovog.trim()) return `${ovog.trim()[0]}.${name}`;
  return name;
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    admin: "Админ",
    super_admin: "Супер админ",
    hr: "Хүний нөөц",
    doctor: "Эмч",
    nurse: "Сувилагч",
    receptionist: "Ресепшн",
    marketing: "Маркетинг",
    accountant: "Нягтлан",
    manager: "Менежер",
    xray: "Рентген",
    sterilization: "Ариутгал",
    other: "Бусад",
    branch_kiosk: "Салбар киоск",
    doctor_kiosk: "Эмч киоск",
  };
  return map[role] || role;
}

function formatSubmitTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function HrFoodOrdersPage() {
  const { me, loading } = useAuth();
  const canManage = me?.role === "hr" || me?.role === "super_admin" || me?.role === "admin";

  const [fromDate, setFromDate] = useState<string>(todayUlaanbaatarStr);
  const [toDate, setToDate] = useState<string>(todayUlaanbaatarStr);
  const [branchId, setBranchId] = useState<string>("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<FoodOrderRow[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailRow, setDetailRow] = useState<FoodOrderRow | null>(null);
  const [editRow, setEditRow] = useState<FoodOrderRow | null>(null);
  const [editQuantities, setEditQuantities] = useState<Record<number, string>>({});
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);

  const selectedRangeLabel = useMemo(() => {
    if (fromDate === toDate) return fromDate;
    return `${fromDate} → ${toDate}`;
  }, [fromDate, toDate]);

  const loadData = useCallback(async () => {
    if (!canManage) return;
    setListLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ fromDate, toDate });
      if (branchId) params.set("branchId", branchId);
      const res = await fetch(`/api/food-orders/admin?${params.toString()}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as FoodOrderAdminResponse | null;
      if (!res.ok) {
        throw new Error((data as any)?.error || "Хоол захиалгын мэдээлэл ачаалж чадсангүй.");
      }
      setRows(Array.isArray(data?.items) ? data?.items : []);
      setTotalOrders(typeof data?.totalOrders === "number" ? data.totalOrders : 0);
      setTotalQuantity(
        typeof data?.totalQuantity === "number" ? data.totalQuantity : 0
      );
    } catch (err: unknown) {
      setRows([]);
      setTotalOrders(0);
      setTotalQuantity(0);
      setError(err instanceof Error ? err.message : "Хоол захиалгын мэдээлэл ачаалж чадсангүй.");
    } finally {
      setListLoading(false);
    }
  }, [branchId, canManage, fromDate, toDate]);

  useEffect(() => {
    if (!canManage) return;
    fetch("/api/branches", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => setBranches([]));
  }, [canManage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openEditModal(row: FoodOrderRow) {
    const next: Record<number, string> = {};
    for (const item of row.orders) {
      next[item.id] = String(item.quantity ?? 1);
    }
    setEditQuantities(next);
    setEditRow(row);
  }

  async function saveOrderQuantity(orderId: number) {
    const quantity = Number(editQuantities[orderId]);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setError("Хоолны тоо 0-с их эсвэл тэнцүү бүхэл тоо байх ёстой.");
      return;
    }
    setSavingOrderId(orderId);
    setError("");
    try {
      const res = await fetch(`/api/food-orders/admin/${orderId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any).error || "Хоолны тоо шинэчлэхэд алдаа гарлаа.");
      }
      setEditRow(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Хоолны тоо шинэчлэхэд алдаа гарлаа.");
    } finally {
      setSavingOrderId(null);
    }
  }

  async function cancelOrder(orderId: number) {
    if (!window.confirm("Энэ хоол захиалгыг цуцлах уу?")) return;
    setDeletingOrderId(orderId);
    setError("");
    try {
      const res = await fetch(`/api/food-orders/admin/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any).error || "Хоол захиалга цуцлахад алдаа гарлаа.");
      }
      setEditRow(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Хоол захиалга цуцлахад алдаа гарлаа.");
    } finally {
      setDeletingOrderId(null);
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">ачаалж байна...</div>;
  }

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Энэ хуудсыг зөвхөн Хүний нөөц, Админ, Супер админ ашиглах боломжтой.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Хүний нөөц — Хоол захиалга</h1>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Эхлэх огноо</span>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Дуусах огноо</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Салбар</span>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Бүх салбар</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={listLoading}
            className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {listLoading ? "Ачаалж байна..." : "Шүүх"}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-3 font-semibold text-gray-700">Нэр</th>
              <th className="px-3 py-3 font-semibold text-gray-700">Үүрэг</th>
              <th className="px-3 py-3 font-semibold text-gray-700">Салбар</th>
              <th className="px-3 py-3 font-semibold text-gray-700 text-right">Нийт</th>
              <th className="px-3 py-3 font-semibold text-gray-700 text-center">Дэлгэрэнгүй</th>
              <th className="px-3 py-3 font-semibold text-gray-700 text-center">Засах</th>
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Ачаалж байна...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  Сонгосон хугацаанд хоол захиалга алга.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.userId} className="border-t border-gray-100">
                  <td className="px-3 py-2">{formatDisplayName(row.ovog, row.name)}</td>
                  <td className="px-3 py-2">{roleLabel(row.role)}</td>
                  <td className="px-3 py-2">{row.branchName}</td>
                  <td className="px-3 py-2 text-right font-semibold">{row.totalCount}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setDetailRow(row)}
                      className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100"
                    >
                      Дэлгэрэнгүй
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => openEditModal(row)}
                      className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100"
                    >
                      Засах
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800">
        Нийт хоолны тоо ({selectedRangeLabel}): {totalQuantity}
      </div>

      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Дэлгэрэнгүй — {formatDisplayName(detailRow.ovog, detailRow.name)}
              </h2>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
              >
                Хаах
              </button>
            </div>

            <div className="overflow-auto max-h-[420px] rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-gray-700">Order date</th>
                    <th className="px-3 py-2 font-semibold text-gray-700">Submit timestamp</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 text-right">Хоолны тоо</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRow.orders.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{item.orderDate}</td>
                      <td className="px-3 py-2">{formatSubmitTimestamp(item.submitTimestamp)}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Хоол захиалга засах — {formatDisplayName(editRow.ovog, editRow.name)}
              </h2>
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
              >
                Хаах
              </button>
            </div>

            <div className="space-y-2 max-h-[440px] overflow-auto">
              {editRow.orders.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]"
                >
                  <div className="text-sm">
                    <div className="text-xs text-gray-500">Order date</div>
                    <div>{item.orderDate}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-xs text-gray-500">Submit timestamp</div>
                    <div>{formatSubmitTimestamp(item.submitTimestamp)}</div>
                  </div>
                  <label className="text-sm">
                    <span className="block text-xs text-gray-500 mb-1">Хоолны тоо</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={editQuantities[item.id] || String(item.quantity ?? 1)}
                      onChange={(e) =>
                        setEditQuantities((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="rounded-md border border-gray-300 px-2 py-1.5 w-full"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingOrderId === item.id || deletingOrderId === item.id}
                    onClick={() => void saveOrderQuantity(item.id)}
                    className="self-end rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {savingOrderId === item.id ? "Хадгалж..." : "Хадгалах"}
                  </button>
                  <button
                    type="button"
                    disabled={savingOrderId === item.id || deletingOrderId === item.id}
                    onClick={() => void cancelOrder(item.id)}
                    className="self-end rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    {deletingOrderId === item.id ? "Цуцалж..." : "Цуцлах"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

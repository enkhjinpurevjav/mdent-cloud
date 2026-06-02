import React, { useEffect, useMemo, useState } from "react";

type EmployeeBenefitRow = {
  userId: number;
  ovog?: string;
  name?: string;
  email: string;
  role: string;

  // Option A: one active benefit per employee
  benefitId: number;
  code: string;
  initialAmount: number;
  remainingAmount: number;
  fromDate?: string | null;
  toDate?: string | null;
  isActive: boolean;

  // summary
  totalAmount: number;
  usedAmount: number;

  createdAt?: string;
  updatedAt?: string;
};

function formatEmployeeName(r: EmployeeBenefitRow) {
  const ovog = (r.ovog || "").trim();
  const name = (r.name || "").trim();
  if (!ovog) return name || r.email || String(r.userId);
  return `${ovog.charAt(0)}. ${name || r.email || String(r.userId)}`;
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("mn-MN").format(Number(v || 0));
}

// ✅ Date only (no time)
function formatDateOnly(iso?: string) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("mn-MN");
  } catch {
    return iso;
  }
}

function formatDateInputValue(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    doctor: "Эмч",
    nurse: "Сувилагч",
    accountant: "Нягтлан",
    receptionist: "Ресепшн",
    manager: "Менежер",
    admin: "Админ",
  };
  return map[role] || role;
}

export default function EmployeeVouchersPage() {
  const [rows, setRows] = useState<EmployeeBenefitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // add modal
  const [addOpen, setAddOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [code, setCode] = useState("");
  const [initialAmount, setInitialAmount] = useState("");

  // user search for add modal
  type UserOption = { id: number; name?: string; ovog?: string; email: string; role: string };
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeBenefitRow | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editInitialAmount, setEditInitialAmount] = useState("");
  const [editRemainingAmount, setEditRemainingAmount] = useState("");
  const [editFromDate, setEditFromDate] = useState("");
  const [editToDate, setEditToDate] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/employee-benefits");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load employee benefits");
      }
      setRows((data?.employees || []) as EmployeeBenefitRow[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load employee benefits");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        setUsers(data);
      }
    } catch {
      // silently fail; user search will just show no results
    }
  };

  const openAdd = () => {
    setSelectedUser(null);
    setUserSearch("");
    setEmployeeId("");
    setCode("");
    setInitialAmount("");
    setShowUserDropdown(false);
    setAddOpen(true);
    void loadUsers();
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRemove = async (userId: number) => {
    if (!confirm("Ажилтны ваучер эрхийг идэвхгүй болгож жагсаалтаас хасах уу?")) return;
    try {
      const res = await fetch(`/api/admin/employee-benefits/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to remove");
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to remove");
    }
  };

  const openEdit = (row: EmployeeBenefitRow) => {
    setEditing(row);
    setEditCode(row.code || "");
    setEditInitialAmount(String(row.initialAmount ?? ""));
    setEditRemainingAmount(String(row.remainingAmount ?? ""));
    setEditFromDate(formatDateInputValue(row.fromDate));
    setEditToDate(formatDateInputValue(row.toDate));
    setEditIsActive(!!row.isActive);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;

    const initNum = Number(editInitialAmount);
    const remNum = Number(editRemainingAmount);

    if (!editCode.trim()) {
      alert("Код хоосон байж болохгүй.");
      return;
    }
    if (!Number.isFinite(initNum) || initNum <= 0) {
      alert("Нийт эрхийн дүн зөв оруулна уу.");
      return;
    }
    if (!Number.isFinite(remNum) || remNum < 0) {
      alert("Үлдэгдэл зөв оруулна уу.");
      return;
    }
    if (remNum > initNum) {
      alert("Үлдэгдэл нь нийт эрхээс их байж болохгүй.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/employee-benefits/${editing.benefitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editCode.trim(),
          initialAmount: initNum,
          remainingAmount: remNum,
          fromDate: editFromDate ? editFromDate : null,
          toDate: editToDate ? editToDate : null,
          isActive: editIsActive,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to update benefit");

      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update benefit");
    }
  };

  const handleAdd = async () => {
    const idNum = selectedUser ? selectedUser.id : Number(employeeId);
    const amtNum = Number(initialAmount);

    if (!idNum || Number.isNaN(idNum)) {
      alert("Ажилтан сонгоно уу.");
      return;
    }
    if (!code.trim()) {
      alert("Код оруулна уу.");
      return;
    }
    if (!amtNum || Number.isNaN(amtNum) || amtNum <= 0) {
      alert("Нийт эрхийн дүн зөв оруулна уу.");
      return;
    }

    try {
      const res = await fetch("/api/admin/employee-benefits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: idNum, code: code.trim(), initialAmount: amtNum }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to add benefit");

      setAddOpen(false);
      setSelectedUser(null);
      setUserSearch("");
      setEmployeeId("");
      setCode("");
      setInitialAmount("");
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to add benefit");
    }
  };

  const sorted = useMemo(() => rows, [rows]);

  // Fit columns (no horizontal scroll); header + rows MUST match.
  const gridColsClass =
    "grid grid-cols-[200px_110px_120px_120px_120px_120px_120px_120px_190px] items-center gap-2.5 px-3 py-2.5";
  const inputClass =
    "w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300";
  const secondaryButtonClass =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50";

  return (
    <main className="mx-auto my-10 max-w-[1400px] p-6 font-sans">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-semibold text-gray-900">Ажилчдын ваучер</h1>
          <div className="mt-1 text-xs text-gray-500">
            Зөвхөн ваучер/эрх (EmployeeBenefit) олгосон ажилтнууд энд харагдана.
          </div>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="cursor-pointer rounded-md border border-green-600 bg-green-50 px-3 py-2 text-[13px] text-green-800 hover:bg-green-100"
        >
          + Ажилтан нэмэх
        </button>
      </div>

      {loading && <div className="mt-3.5">Ачаалж байна...</div>}
      {!loading && error && <div className="mt-3.5 text-red-700">{error}</div>}

      {!loading && !error && (
        <div className="mt-3.5 overflow-hidden rounded-[10px] border border-gray-200">
          {/* Header */}
          <div className={`${gridColsClass} bg-gray-50 text-xs font-bold text-gray-700`}>
            <div>Нэр</div>
            <div>Албан тушаал</div>
            <div className="text-right">Нийт эрх</div>
            <div className="text-right">Хэрэглэсэн</div>
            <div className="text-right">Үлдэгдэл</div>
            <div>Created</div>
            <div>Updated</div>
            <div>Код</div>
            <div />
          </div>

          {/* Rows */}
          {sorted.map((r) => (
            <div key={r.userId} className={`${gridColsClass} border-t border-gray-100 text-[13px]`}>
              <div className="truncate font-semibold text-gray-900">{formatEmployeeName(r)}</div>
              <div className="truncate text-gray-700">{roleLabel(r.role)}</div>

              <div className="text-right">{formatMoney(r.totalAmount)} ₮</div>
              <div className="text-right">{formatMoney(r.usedAmount)} ₮</div>
              <div className="text-right font-bold">{formatMoney(r.remainingAmount)} ₮</div>

              {/* Date only */}
              <div className="text-xs text-gray-500">{formatDateOnly(r.createdAt)}</div>
              <div className="text-xs text-gray-500">{formatDateOnly(r.updatedAt)}</div>

              <div className="truncate font-mono text-xs text-gray-700" title={r.code}>
                {r.code}
              </div>

              <div className="flex justify-end gap-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="cursor-pointer rounded-md border border-blue-600 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-600 hover:bg-blue-100"
                >
                  Засах
                </button>

                <button
                  type="button"
                  onClick={() => handleRemove(r.userId)}
                  className="cursor-pointer rounded-md border border-red-600 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-100"
                >
                  Устгах
                </button>
              </div>
            </div>
          ))}

          {sorted.length === 0 && (
            <div className="p-3 text-[13px] text-gray-500">
              Одоогоор ямар ч ажилтанд ваучер эрх олгоогүй байна.
            </div>
          )}
        </div>
      )}

      {/* Add modal */}
      {addOpen && (
        <div
          onClick={() => setAddOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[560px] max-w-[95vw] rounded-[10px] bg-white p-4 text-[13px] shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          >
            <h3 className="mb-2.5 mt-0 text-lg font-semibold text-gray-900">
              Ажилтанд ваучер эрх олгох
            </h3>

            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-1.5">
                <div className="text-xs text-gray-700">Ажилтан хайх</div>
                <div className="relative">
                  <input
                    value={selectedUser
                      ? `${selectedUser.ovog ? selectedUser.ovog.charAt(0) + ". " : ""}${selectedUser.name || selectedUser.email} (${roleLabel(selectedUser.role)})`
                      : userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setSelectedUser(null);
                      setShowUserDropdown(true);
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder="Нэрээр хайх..."
                    autoComplete="off"
                    className={`${inputClass} box-border`}
                  />
                  {showUserDropdown && !selectedUser && (
                    <div className="absolute left-0 right-0 top-full z-[200] max-h-[220px] overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
                      {(() => {
                        const q = userSearch.toLowerCase();
                        const filtered = users.filter((u) => {
                          if (!q) return true;
                          const fullName = `${u.ovog || ""} ${u.name || ""}`.toLowerCase();
                          return fullName.includes(q) || (u.email || "").toLowerCase().includes(q);
                        });
                        if (filtered.length === 0) {
                          return <div className="px-3 py-2 text-xs text-gray-500">Олдсонгүй</div>;
                        }
                        return filtered.map((u) => (
                          <div
                            key={u.id}
                            onClick={() => {
                              setSelectedUser(u);
                              setUserSearch("");
                              setShowUserDropdown(false);
                            }}
                            className="flex cursor-pointer items-center justify-between border-b border-gray-100 px-3 py-2 hover:bg-gray-50"
                          >
                            <div>
                              <span className="font-medium">
                                {u.ovog ? `${u.ovog.charAt(0)}. ` : ""}{u.name || u.email}
                              </span>
                              <span className="ml-1.5 text-[11px] text-gray-500">{u.email}</span>
                            </div>
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-600">
                              {roleLabel(u.role)}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
                {selectedUser && (
                  <div className="text-[11px] text-green-600">
                    Сонгогдсон: ID {selectedUser.id} — {selectedUser.email}
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-1.5">
                <div className="text-xs text-gray-700">Код</div>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Жишээ: EMPBAT001"
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <div className="text-xs text-gray-700">Нийт эрхийн дүн</div>
                <input
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  type="number"
                  min={0}
                  placeholder="Жишээ: 300000"
                  className={inputClass}
                />
              </label>

              <div className="mt-1 flex justify-end gap-2">
                <button type="button" onClick={() => setAddOpen(false)} className={secondaryButtonClass}>
                  Болих
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="rounded-lg border border-green-600 bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Хадгалах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editOpen && editing && (
        <div
          onClick={() => {
            setEditOpen(false);
            setEditing(null);
          }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[600px] max-w-[95vw] rounded-[10px] bg-white p-4 text-[13px] shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          >
            <h3 className="mb-2.5 mt-0 text-lg font-semibold text-gray-900">
              Ваучер эрх засах: {formatEmployeeName(editing)}
            </h3>

            <div className="flex flex-col gap-2.5">
              <label className="flex flex-col gap-1.5">
                <div className="text-xs text-gray-700">Код</div>
                <input value={editCode} onChange={(e) => setEditCode(e.target.value)} className={inputClass} />
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1.5">
                  <div className="text-xs text-gray-700">Нийт эрхийн дүн</div>
                  <input
                    value={editInitialAmount}
                    onChange={(e) => setEditInitialAmount(e.target.value)}
                    type="number"
                    min={0}
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <div className="text-xs text-gray-700">Үлдэгдэл</div>
                  <input
                    value={editRemainingAmount}
                    onChange={(e) => setEditRemainingAmount(e.target.value)}
                    type="number"
                    min={0}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1.5">
                  <div className="text-xs text-gray-700">From date</div>
                  <input
                    value={editFromDate}
                    onChange={(e) => setEditFromDate(e.target.value)}
                    type="date"
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <div className="text-xs text-gray-700">To date</div>
                  <input
                    value={editToDate}
                    onChange={(e) => setEditToDate(e.target.value)}
                    type="date"
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="mt-0.5 flex items-center gap-2">
                <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
                <span>Идэвхтэй</span>
              </label>

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditing(null);
                  }}
                  className={secondaryButtonClass}
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Хадгалах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function todayLocalStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build an ISO timestamp for the local start-of-day of a YYYY-MM-DD string */
function localStartOfDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

/** Build an ISO timestamp for the local end-of-day of a YYYY-MM-DD string */
function localEndOfDay(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999`).toISOString();
}

function formatDisplayName(ovog: string | null, name: string | null): string {
  if (!name) return "(нэргүй)";
  if (ovog && ovog.trim()) return `${ovog.trim()[0]}.${name}`;
  return name;
}

function formatTime(isoStr: string | null): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(isoStr: string | null): string {
  if (!isoStr) return "—";
  // dateStr is already YYYY-MM-DD
  return isoStr;
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    doctor: "Эмч",
    nurse: "Сувилагч",
    receptionist: "Ресепшн",
    admin: "Админ",
    super_admin: "Супер Админ",
    staff: "Ажилтан",
  };
  return map[role] || role;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    present: "Ирсэн",
    open: "Нээлттэй",
    absent: "Ирээгүй",
    unscheduled: "Хуваарьгүй",
  };
  return map[status] || status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    present: "#16a34a",
    open: "#d97706",
    absent: "#dc2626",
    unscheduled: "#6b7280",
  };
  return map[status] || "#374151";
}

function statusBg(status: string): string {
  const map: Record<string, string> = {
    present: "#f0fdf4",
    open: "#fffbeb",
    absent: "#fef2f2",
    unscheduled: "#f9fafb",
  };
  return map[status] || "#f9fafb";
}

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type AttendanceRow = {
  sessionId?: number | null;
  rowType: "scheduled" | "unscheduled";
  userId: number;
  userName: string | null;
  userOvog: string | null;
  userEmail: string | null;
  userRole: string;
  branchId: number;
  branchName: string;
  scheduledDate: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduleNote: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  durationMinutes: number | null;
  sessionCount?: number;
  requiredMinutes?: number | null;
  attendanceRatePercent?: number | null;
  isAutoClosed?: boolean;
  autoCloseReason?: string | null;
  reviewReason?: string | null;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;
  status: "present" | "open" | "absent" | "unscheduled";
};

type AttendanceSummary = {
  totalRows: number;
  presentCount: number;
  openCount: number;
  absentCount: number;
  unscheduledCount: number;
  avgLateMinutes: number;
  attendanceRatePercent: number;
};

type AttendancePolicyRow = {
  id: number;
  branchId: number | null;
  role: string | null;
  priority: number;
  isActive: boolean;
  earlyCheckInMinutes: number;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  autoCloseAfterMinutes: number;
  minAccuracyM: number;
  enforceGeofence: boolean;
};

type ApiResponse = {
  items: AttendanceRow[];
  summary?: AttendanceSummary;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// ──────────────────────────────────────────────────────────────────────────────
// Page component
// ──────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE_DEFAULT = 50;

export default function AdminAttendancePage() {
  const router = useRouter();

  const [fromDate, setFromDate] = useState<string>(todayLocalStr);
  const [toDate, setToDate] = useState<string>(todayLocalStr);
  const [branchId, setBranchId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(1);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [users, setUsers] = useState<
    { id: number; name: string | null; ovog: string | null; role: string }[]
  >([]);
  const [exporting, setExporting] = useState(false);
  const [editingRow, setEditingRow] = useState<AttendanceRow | null>(null);
  const [editCheckInAt, setEditCheckInAt] = useState("");
  const [editCheckOutAt, setEditCheckOutAt] = useState("");
  const [editReasonCode, setEditReasonCode] = useState("MANUAL_CORRECTION");
  const [editReasonText, setEditReasonText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [autoCloseLoading, setAutoCloseLoading] = useState(false);
  const [policies, setPolicies] = useState<AttendancePolicyRow[]>([]);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [newPolicyBranchId, setNewPolicyBranchId] = useState("");
  const [newPolicyRole, setNewPolicyRole] = useState("");
  const [newPolicyPriority, setNewPolicyPriority] = useState("0");
  const [newPolicyEarlyCheckIn, setNewPolicyEarlyCheckIn] = useState("120");
  const [newPolicyLateGrace, setNewPolicyLateGrace] = useState("0");
  const [newPolicyEarlyLeaveGrace, setNewPolicyEarlyLeaveGrace] = useState("0");
  const [newPolicyAutoClose, setNewPolicyAutoClose] = useState("720");
  const [newPolicyMinAccuracy, setNewPolicyMinAccuracy] = useState("100");
  const [newPolicyEnforceGeofence, setNewPolicyEnforceGeofence] = useState(true);

  // Load branch list for filter dropdown
  useEffect(() => {
    fetch("/api/branches", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => setBranches([]));

    fetch("/api/users", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  }, []);

  async function fetchPolicies() {
    setPolicyLoading(true);
    try {
      const res = await fetch("/api/admin/attendance/policies", {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Бодлого татахад алдаа гарлаа.");
      setPolicies(Array.isArray((json as any).items) ? (json as any).items : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Бодлого татахад алдаа гарлаа.");
    } finally {
      setPolicyLoading(false);
    }
  }

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchData = useCallback(
    async (p: number) => {
      setLoading(true);
      setError("");

      const fromTs = localStartOfDay(fromDate);
      const toTs = localEndOfDay(toDate);

      const params = new URLSearchParams({
        fromTs,
        toTs,
        page: String(p),
        pageSize: String(PAGE_SIZE_DEFAULT),
      });
      if (branchId) params.set("branchId", branchId);
      if (userId) params.set("userId", userId);
      if (statusFilter !== "all") params.set("status", statusFilter);

      try {
        const res = await fetch(`/api/admin/attendance?${params}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Алдаа гарлаа.");
        setData(json as ApiResponse);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Алдаа гарлаа.";
        setError(msg);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [fromDate, toDate, branchId, userId, statusFilter]
  );

  // Re-fetch when filters change (reset to page 1)
  useEffect(() => {
    setPage(1);
    fetchData(1);
  }, [fromDate, toDate, branchId, userId, statusFilter, fetchData]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchData(newPage);
  }

  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      const fromTs = localStartOfDay(fromDate);
      const toTs = localEndOfDay(toDate);
      const params = new URLSearchParams({ fromTs, toTs });
      if (branchId) params.set("branchId", branchId);
      if (userId) params.set("userId", userId);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/attendance/export?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any).error || "Экспорт хийхэд алдаа гарлаа.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-export-${fromDate}-${toDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Экспортын алдаа.");
    } finally {
      setExporting(false);
    }
  }

  function openEdit(row: AttendanceRow) {
    setEditingRow(row);
    setEditCheckInAt(row.checkInAt ? row.checkInAt.slice(0, 16) : "");
    setEditCheckOutAt(row.checkOutAt ? row.checkOutAt.slice(0, 16) : "");
    setEditReasonCode("MANUAL_CORRECTION");
    setEditReasonText("");
  }

  function closeEdit() {
    setEditingRow(null);
    setEditSaving(false);
  }

  async function saveEdit() {
    if (!editingRow) return;
    setEditSaving(true);
    setError("");
    try {
      if (!editCheckInAt) throw new Error("Шинэ ирсэн цаг оруулна уу.");
      const body = {
        newCheckInAt: new Date(editCheckInAt).toISOString(),
        newCheckOutAt: editCheckOutAt ? new Date(editCheckOutAt).toISOString() : null,
        reasonCode: editReasonCode || "MANUAL_CORRECTION",
        reasonText: editReasonText || null,
      };
      const res = await fetch(`/api/attendance/session/${editingRow.sessionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Засвар хадгалахад алдаа гарлаа.");
      closeEdit();
      fetchData(page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Засвар хадгалахад алдаа гарлаа.");
    } finally {
      setEditSaving(false);
    }
  }

  async function runAutoClose() {
    setAutoCloseLoading(true);
    setError("");
    try {
      const res = await fetch("/api/attendance/auto-close", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Нээлттэй сешн хаахад алдаа гарлаа.");
      fetchData(page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Нээлттэй сешн хаахад алдаа гарлаа.");
    } finally {
      setAutoCloseLoading(false);
    }
  }

  async function createPolicy() {
    setSavingPolicy(true);
    setError("");
    try {
      const body = {
        branchId: newPolicyBranchId ? Number(newPolicyBranchId) : null,
        role: newPolicyRole || null,
        priority: Number(newPolicyPriority) || 0,
        earlyCheckInMinutes: Number(newPolicyEarlyCheckIn) || 120,
        lateGraceMinutes: Number(newPolicyLateGrace) || 0,
        earlyLeaveGraceMinutes: Number(newPolicyEarlyLeaveGrace) || 0,
        autoCloseAfterMinutes: Number(newPolicyAutoClose) || 720,
        minAccuracyM: Number(newPolicyMinAccuracy) || 100,
        enforceGeofence: !!newPolicyEnforceGeofence,
        isActive: true,
      };
      const res = await fetch("/api/admin/attendance/policies", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Бодлого үүсгэхэд алдаа гарлаа.");
      await fetchPolicies();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Бодлого үүсгэхэд алдаа гарлаа.");
    } finally {
      setSavingPolicy(false);
    }
  }

  return (
    <main className="w-full px-4 py-6 font-sans">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Ирцийн тайлан</h1>

      {data?.summary && (
        <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
            Ирцийн хувь: <strong>{data.summary.attendanceRatePercent}%</strong>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm">
            Ирсэн: <strong>{data.summary.presentCount}</strong>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            Нээлттэй: <strong>{data.summary.openCount}</strong>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
            Хуваарьгүй: <strong>{data.summary.unscheduledCount}</strong>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
            Дундаж хоцролт: <strong>{data.summary.avgLateMinutes} мин</strong>
          </div>
        </section>
      )}

      {/* ── Filters ── */}
      <section className="mb-6 flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Эхлэх огноо</label>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Дуусах огноо</label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Салбар</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">Бүх салбар</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Ажилтан</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">Бүх ажилтан</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {formatDisplayName(u.ovog, u.name)} ({roleLabel(u.role)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Төлөв</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="all">Бүгд</option>
            <option value="present">Ирсэн</option>
            <option value="open">Нээлттэй</option>
            <option value="absent">Ирээгүй</option>
            <option value="unscheduled">Хуваарьгүй</option>
          </select>
        </div>

        <div className="ml-auto flex gap-2 self-end">
          <button
            type="button"
            onClick={runAutoClose}
            disabled={autoCloseLoading}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100 disabled:opacity-40"
          >
            {autoCloseLoading ? "Хааж байна..." : "Нээлттэй сешн хаах"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-40"
          >
            {exporting ? "Экспорт..." : "CSV экспорт"}
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Ирцийн бодлого</h2>
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-5">
          <select
            value={newPolicyBranchId}
            onChange={(e) => setNewPolicyBranchId(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Бүх салбарт</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={newPolicyRole}
            onChange={(e) => setNewPolicyRole(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Бүх үүрэг</option>
            <option value="doctor">Эмч</option>
            <option value="nurse">Сувилагч</option>
            <option value="receptionist">Ресепшн</option>
            <option value="admin">Админ</option>
            <option value="super_admin">Супер админ</option>
            <option value="other">Бусад</option>
          </select>
          <input
            value={newPolicyPriority}
            onChange={(e) => setNewPolicyPriority(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="Эрэмбэ"
          />
          <input
            value={newPolicyEarlyCheckIn}
            onChange={(e) => setNewPolicyEarlyCheckIn(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="Эрт ирц (мин)"
          />
          <input
            value={newPolicyMinAccuracy}
            onChange={(e) => setNewPolicyMinAccuracy(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="GPS нарийвчлал (м)"
          />
          <input
            value={newPolicyLateGrace}
            onChange={(e) => setNewPolicyLateGrace(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="Хоцролтын чөлөө (мин)"
          />
          <input
            value={newPolicyEarlyLeaveGrace}
            onChange={(e) => setNewPolicyEarlyLeaveGrace(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="Эрт гаралтын чөлөө (мин)"
          />
          <input
            value={newPolicyAutoClose}
            onChange={(e) => setNewPolicyAutoClose(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="Авто хаалт (мин)"
          />
          <label className="flex items-center gap-2 rounded border border-gray-300 px-2 py-1 text-sm">
            <input
              type="checkbox"
              checked={newPolicyEnforceGeofence}
              onChange={(e) => setNewPolicyEnforceGeofence(e.target.checked)}
            />
            Гео бүс заавал мөрдөх
          </label>
          <button
            type="button"
            onClick={createPolicy}
            disabled={savingPolicy}
            className="rounded border border-blue-300 bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-40"
          >
            {savingPolicy ? "Хадгалж байна..." : "Бодлого нэмэх"}
          </button>
        </div>
        {policyLoading ? (
          <p className="text-xs text-gray-500">Бодлого ачаалж байна...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-1 text-left">ID</th>
                  <th className="px-2 py-1 text-left">Салбар</th>
                  <th className="px-2 py-1 text-left">Үүрэг</th>
                  <th className="px-2 py-1 text-right">Эрэмбэ</th>
                  <th className="px-2 py-1 text-right">Эрт ирц</th>
                  <th className="px-2 py-1 text-right">Хоцролтын чөлөө</th>
                  <th className="px-2 py-1 text-right">Эрт гаралтын чөлөө</th>
                  <th className="px-2 py-1 text-right">Авто хаалт</th>
                  <th className="px-2 py-1 text-right">Нарийвчлал</th>
                  <th className="px-2 py-1 text-left">Гео бүс</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-2 py-1">{p.id}</td>
                    <td className="px-2 py-1">
                      {p.branchId == null
                        ? "Бүх салбар"
                        : branches.find((b) => b.id === p.branchId)?.name || p.branchId}
                    </td>
                    <td className="px-2 py-1">{p.role ? roleLabel(p.role) : "Бүгд"}</td>
                    <td className="px-2 py-1 text-right">{p.priority}</td>
                    <td className="px-2 py-1 text-right">{p.earlyCheckInMinutes}</td>
                    <td className="px-2 py-1 text-right">{p.lateGraceMinutes}</td>
                    <td className="px-2 py-1 text-right">{p.earlyLeaveGraceMinutes}</td>
                    <td className="px-2 py-1 text-right">{p.autoCloseAfterMinutes}</td>
                    <td className="px-2 py-1 text-right">{p.minAccuracyM}</td>
                    <td className="px-2 py-1">{p.enforceGeofence ? "Тийм" : "Үгүй"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Summary ── */}
      {data && !loading && (
        <p className="mb-2 text-sm text-gray-500">
          Нийт: <strong>{data.total}</strong> бичлэг
        </p>
      )}

      {/* ── Table ── */}
      <section>
        {loading ? (
          <p className="text-sm text-gray-600">Ачаалж байна...</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">
                      Огноо
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">
                      Нэр
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">
                      Үүрэг
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">
                      Салбар
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">
                      Хуваарийн эхлэл
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">
                      Хуваарийн төгсгөл
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">
                      Ирсэн цаг
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">
                      Явсан цаг
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-700">
                      Хугацаа
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-700">
                      Сешн
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">
                      Төлөв
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-700">
                      Хангалт %
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-700">
                      Шаардлагатай мин
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-700">
                      Хоцролт (мин)
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-700">
                      Эрт явсан (мин)
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-700">
                      Үйлдэл
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!data || data.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={17}
                        className="px-3 py-6 text-center text-sm text-gray-400"
                      >
                        Мэдээлэл олдсонгүй
                      </td>
                    </tr>
                  ) : (
                    data.items.map((row, i) => (
                      <tr
                        key={`${row.userId}-${row.scheduledDate}-${i}`}
                        className="border-t border-gray-100"
                        style={{ background: statusBg(row.status) }}
                      >
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatDate(row.scheduledDate)}
                        </td>
                        <td className="px-3 py-2">
                          {formatDisplayName(row.userOvog, row.userName)}
                          {row.userEmail && (
                            <div className="text-xs text-gray-400">
                              {row.userEmail}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                          {roleLabel(row.userRole)}
                        </td>
                        <td className="px-3 py-2">{row.branchName}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {row.scheduledStart || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {row.scheduledEnd || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatTime(row.checkInAt)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatTime(row.checkOutAt)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {row.durationMinutes != null
                            ? `${row.durationMinutes} мин`
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {row.sessionCount != null ? row.sessionCount : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span
                            style={{
                              color: statusColor(row.status),
                              fontWeight: 600,
                            }}
                          >
                            {statusLabel(row.status)}
                          </span>
                          {row.reviewReason ? (
                            <div className="text-[11px] text-amber-700">{row.reviewReason}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {row.attendanceRatePercent != null ? `${row.attendanceRatePercent}%` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {row.requiredMinutes != null ? `${row.requiredMinutes}` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {row.lateMinutes != null ? (
                            <span className="font-medium text-red-600">
                              +{row.lateMinutes}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {row.earlyLeaveMinutes != null ? (
                            <span className="font-medium text-orange-600">
                              -{row.earlyLeaveMinutes}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {row.sessionId ? (
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              Засах
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {data && data.totalPages > 1 && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Өмнөх
                </button>
                <span className="text-sm text-gray-600">
                  {data.page} / {data.totalPages}
                </span>
                <button
                  onClick={() =>
                    handlePageChange(Math.min(data.totalPages, page + 1))
                  }
                  disabled={page >= data.totalPages}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Дараах →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Ирцийн сешн засах</h2>
            <div className="mb-3 space-y-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Шинэ ирсэн цаг</label>
                <input
                  type="datetime-local"
                  value={editCheckInAt}
                  onChange={(e) => setEditCheckInAt(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Шинэ гарсан цаг</label>
                <input
                  type="datetime-local"
                  value={editCheckOutAt}
                  onChange={(e) => setEditCheckOutAt(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Шалтгаан код</label>
                <input
                  type="text"
                  value={editReasonCode}
                  onChange={(e) => setEditReasonCode(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Тайлбар</label>
                <textarea
                  value={editReasonText}
                  onChange={(e) => setEditReasonText(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving}
                className="rounded-lg border border-blue-300 bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {editSaving ? "Хадгалж байна..." : "Хадгалах"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

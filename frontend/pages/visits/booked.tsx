import React, { useEffect, useMemo, useState } from "react";
import AppointmentFiltersBar from "../../components/AppointmentFiltersBar";
import type {
  AppointmentFilters,
  AppointmentRow,
  AppointmentStatus,
} from "../../types/appointments";

function formatHm(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatYmdDot(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function formatYmdHmRange(startIso: string | null | undefined, endIso: string | null | undefined) {
  const date = formatYmdDot(startIso);
  const start = formatHm(startIso);
  const end = formatHm(endIso);

  if (!date && !start && !end) return "-";
  if (date && start && end) return `${date} ${start}–${end}`;
  if (date && start) return `${date} ${start}`;
  if (date) return date;
  return start || "-";
}

function statusLabel(statusRaw: AppointmentStatus | string | null | undefined): string {
  const s = String(statusRaw || "")
    .trim()
    .toLowerCase();
  switch (s) {
    case "booked":
      return "Захиалсан";
    case "confirmed":
      return "Баталгаажсан";
    case "online":
      return "Онлайн";
    case "ongoing":
      return "Явж байна";
    case "ready_to_pay":
      return "Төлбөр төлөх";
    case "completed":
      return "Дууссан";
    case "no_show":
      return "Ирээгүй";
    case "cancelled":
      return "Цуцалсан";
    case "other":
      return "Бусад";
    default:
      return s || "-";
  }
}

function statusBadgeStyle(statusRaw: AppointmentStatus | string | null | undefined): React.CSSProperties {
  const s = String(statusRaw || "")
    .trim()
    .toLowerCase();

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };

  switch (s) {
    case "booked":
      return { ...base, background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" };
    case "confirmed":
      return { ...base, background: "#ecfeff", borderColor: "#67e8f9", color: "#0e7490" };
    case "online":
      return { ...base, background: "#fdf4ff", borderColor: "#e9d5ff", color: "#7e22ce" };
    case "ongoing":
      return { ...base, background: "#fffbeb", borderColor: "#fcd34d", color: "#92400e" };
    case "ready_to_pay":
      return { ...base, background: "#f5f3ff", borderColor: "#c4b5fd", color: "#5b21b6" };
    case "completed":
      return { ...base, background: "#ecfdf3", borderColor: "#86efac", color: "#166534" };
    case "no_show":
      return { ...base, background: "#fff7ed", borderColor: "#fdba74", color: "#9a3412" };
    case "cancelled":
      return { ...base, background: "#fef2f2", borderColor: "#fca5a5", color: "#b91c1c" };
    default:
      return { ...base, background: "#f3f4f6", borderColor: "#d1d5db", color: "#374151" };
  }
}

function formatPatientShort(row: AppointmentRow): string {
  const name = (row.patientName || "").trim();
  const ovog = ((row as any).patientOvog || "").trim();
  const firstLetter = typeof ovog === "string" && ovog ? ovog[0] : "";
  const prefix = firstLetter ? `${firstLetter}. ` : "";
  return (prefix + name).trim() || "-";
}

const STATUS_ACTIONS: Array<{ s: AppointmentStatus; label: string }> = [
  { s: "booked", label: "Захиалсан" },
  { s: "confirmed", label: "Баталгаажсан" },
  { s: "online", label: "Онлайн" },
  { s: "ongoing", label: "Явж байна" },
  { s: "ready_to_pay", label: "Төлбөр төлөх" },
  { s: "completed", label: "Дууссан" },
  { s: "no_show", label: "Ирээгүй" },
  { s: "cancelled", label: "Цуцалсан" },
  { s: "other", label: "Бусад" },
];

export default function BookedVisitsPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [filters, setFilters] = useState<AppointmentFilters>({
    dateFrom: today,
    dateTo: today,
    status: "BOOKED",
    includeCancelled: true,
  });

  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<AppointmentRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string>("");

  const getStartIso = (row: AppointmentRow) =>
    row.startTime ?? (row as any).scheduledAt ?? null;

  const getEndIso = (row: AppointmentRow) =>
    row.endTime ?? (row as any).endAt ?? null;

  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data) => {
        const mapped = (data || []).map((b: any) => ({
          id: String(b.id),
          name: b.name as string,
        }));
        setBranches(mapped);
      })
      .catch(() => setBranches([]));
  }, []);

  const buildQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("dateFrom", filters.dateFrom);
    params.set("dateTo", filters.dateTo);
    params.set("status", (filters.status ?? "BOOKED") as string);
    if (filters.includeCancelled) params.set("includeCancelled", "true");
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.search) params.set("search", filters.search);
    return params.toString();
  }, [filters]);

  const loadRows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments?${buildQuery}`);
      const data = await res.json().catch(() => []);
      setRows(Array.isArray(data) ? (data as AppointmentRow[]) : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildQuery]);

  const handleOpenDetails = (row: AppointmentRow) => {
    setSelectedRow(row);
    setDetailsOpen(true);
    setActionError("");
  };

  const patchStatus = async (row: AppointmentRow, nextStatus: AppointmentStatus) => {
    if (!row?.id) return;
    setActionLoading(true);
    setActionError("");

    try {
      const res = await fetch(`/api/appointments/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Төлөв өөрчлөхөд алдаа гарлаа");

      await loadRows();
      setSelectedRow((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    } catch (e: any) {
      setActionError(e?.message || "Төлөв өөрчлөхөд алдаа гарлаа");
    } finally {
      setActionLoading(false);
    }
  };

  const closeModal = () => {
    setDetailsOpen(false);
    setSelectedRow(null);
    setActionError("");
  };

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        Цаг захиалсан
      </h1>

      <AppointmentFiltersBar
        value={filters}
        onChange={setFilters}
        showStatusFilter={true}
        statuses={[
          { value: "BOOKED", label: "Захиалсан" },
          { value: "CANCELLED", label: "Цуцалсан" },
        ]}
        branches={branches}
      />

      {loading ? (
        <div>Уншиж байна…</div>
      ) : rows.length === 0 ? (
        <div>Өгөгдөл алга эсвэл API холболт хийгдээгүй байна.</div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "white",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={{ textAlign: "left", padding: 10 }}>Огноо</th>
              <th style={{ textAlign: "left", padding: 10 }}>Цаг</th>
              <th style={{ textAlign: "left", padding: 10 }}>Өвчтөн</th>
              <th style={{ textAlign: "left", padding: 10 }}>РД</th>
              <th style={{ textAlign: "left", padding: 10 }}>Салбар</th>
              <th style={{ textAlign: "left", padding: 10 }}>Эмч</th>
              <th style={{ textAlign: "left", padding: 10 }}>Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const startIso = getStartIso(row);
              return (
                <tr
                  key={row.id}
                  onClick={() => handleOpenDetails(row)}
                  style={{ cursor: "pointer", borderTop: "1px solid #e5e7eb" }}
                >
                  <td style={{ padding: 10 }}>{formatYmdDot(startIso || undefined)}</td>
                  <td style={{ padding: 10 }}>{formatHm(startIso || undefined)}</td>
                  <td style={{ padding: 10 }}>{formatPatientShort(row)}</td>
                  <td style={{ padding: 10 }}>{row.regNo || (row as any).patientRegNo || "-"}</td>
                  <td style={{ padding: 10 }}>{row.branchName || (row as any).branch?.name || "-"}</td>
                  <td style={{ padding: 10 }}>{row.doctorName || "-"}</td>
                  <td style={{ padding: 10 }}>
                    <span style={statusBadgeStyle(row.status)}>{statusLabel(row.status)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Details modal */}
      {detailsOpen && selectedRow && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(680px, 100%)",
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  {formatPatientShort(selectedRow)}
                </h3>

                {/* ✅ requested format: 2026.01.23 14:30–15:00 */}
                <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>
                  {formatYmdHmRange(getStartIso(selectedRow), getEndIso(selectedRow))}
                </div>
              </div>

              <div>
                <span style={statusBadgeStyle(selectedRow.status)}>
                  {statusLabel(selectedRow.status)}
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 13 }}>
                <div style={{ color: "#6b7280", fontSize: 12 }}>РД</div>
                <div>{selectedRow.regNo || (selectedRow as any).patientRegNo || "-"}</div>
              </div>

              <div style={{ fontSize: 13 }}>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Утас</div>
                <div>{(selectedRow as any).patientPhone || "-"}</div>
              </div>

              <div style={{ fontSize: 13 }}>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Салбар</div>
                <div>{selectedRow.branchName || (selectedRow as any).branch?.name || "-"}</div>
              </div>

              <div style={{ fontSize: 13 }}>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Эмч</div>
                <div>{selectedRow.doctorName || "-"}</div>
              </div>
            </div>

            {actionError && (
              <div style={{ marginTop: 10, color: "#b91c1c", fontSize: 13 }}>
                {actionError}
              </div>
            )}

            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STATUS_ACTIONS.map((x) => (
                <button
                  key={x.s}
                  type="button"
                  disabled={actionLoading}
                  onClick={() => patchStatus(selectedRow, x.s)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: actionLoading ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  {x.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#f3f4f6",
                  cursor: "pointer",
                }}
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

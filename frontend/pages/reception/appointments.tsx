// frontend/pages/reception/appointments.tsx
// Reception portal — tablet-first appointment calendar with branch switching.
// Rules:
//   - Own branch: full edit (except cannot start encounter / set status to "ongoing")
//   - Other branches: view only; can only create new appointments with status "booked"
//   - ready_to_pay (own branch only): show billing link
//   - Hide "Борлуулалтын орлого" card
//   - Show "Ирсэн үйлчлүүлэгчид" queue block

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import type { AuthUser } from "../../utils/auth";
import { getMe } from "../../utils/auth";
import ReceptionLayout from "../../components/ReceptionLayout";
import QuickAppointmentModal from "../../components/appointments/QuickAppointmentModal";
import AppointmentDetailsModal from "../../components/appointments/AppointmentDetailsModal";
import type {
  Branch,
  Doctor,
  ScheduledDoctor,
  Appointment,
} from "../../components/appointments/types";
import {
  formatStatus,
} from "../../components/appointments/formatters";
import { pad2 } from "../../components/appointments/time";

// ---- helpers ----

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatYmdDots(ymd: string): string {
  return ymd.replace(/-/g, ".");
}

function groupByDoctor(appointments: Appointment[]): Record<number, Appointment[]> {
  const map: Record<number, Appointment[]> = {};
  for (const a of appointments) {
    const key = a.doctorId ?? 0;
    if (!map[key]) map[key] = [];
    map[key].push(a);
  }
  return map;
}

const STATUS_COLOR: Record<string, string> = {
  booked: "#3b82f6",
  confirmed: "#8b5cf6",
  online: "#06b6d4",
  ongoing: "#f59e0b",
  imaging: "#6366f1",
  ready_to_pay: "#22c55e",
  partial_paid: "#84cc16",
  completed: "#6b7280",
  cancelled: "#ef4444",
  no_show: "#f97316",
  other: "#94a3b8",
};

function statusColor(status: string): string {
  return STATUS_COLOR[String(status || "").toLowerCase()] ?? "#94a3b8";
}

function formatApptTime(scheduledAt: string, endAt: string | null | undefined): string {
  const d = new Date(scheduledAt);
  const start = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  if (!endAt) return start;
  const e = new Date(endAt);
  const end = `${e.getHours().toString().padStart(2, "0")}:${e.getMinutes().toString().padStart(2, "0")}`;
  return `${start}–${end}`;
}

export default function ReceptionAppointmentsPage() {
  const router = useRouter();

  // ---- auth ----
  const [me, setMe] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((u) => {
        if (!u) { router.replace("/login"); return; }
        if (u.role !== "receptionist" && u.role !== "admin" && u.role !== "super_admin") {
          router.replace("/login");
          return;
        }
        setMe(u);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setAuthLoading(false));
  }, [router]);

  // ---- date ----
  const [selectedDay, setSelectedDay] = useState<string>(todayYmd());

  // ---- branch ----
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // Derived: is user viewing their own branch?
  const isOwnBranch = useMemo(() => {
    if (!me?.branchId) return true;
    if (!selectedBranchId) return true;
    return String(me.branchId) === String(selectedBranchId);
  }, [me, selectedBranchId]);

  // Set default branch once me loads
  useEffect(() => {
    if (me?.branchId && !selectedBranchId) {
      setSelectedBranchId(String(me.branchId));
    }
  }, [me, selectedBranchId]);

  // ---- data ----
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [scheduledDoctors, setScheduledDoctors] = useState<ScheduledDoctor[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Request-id guard to discard stale responses
  const reqIdRef = useRef(0);

  // ---- load meta ----
  useEffect(() => {
    Promise.all([fetch("/api/branches"), fetch("/api/users?role=doctor")])
      .then(async ([b, d]) => {
        const bd = await b.json().catch(() => []);
        const dd = await d.json().catch(() => []);
        setBranches(Array.isArray(bd) ? bd : []);
        setDoctors(Array.isArray(dd) ? dd : []);
      })
      .catch(() => {});
  }, []);

  // ---- load appointments ----
  const loadAppointments = useCallback(async () => {
    if (!selectedDay) return;
    setLoading(true);
    setError("");
    reqIdRef.current += 1;
    const currentReqId = reqIdRef.current;

    try {
      const params = new URLSearchParams({ date: selectedDay });
      if (selectedBranchId) params.set("branchId", selectedBranchId);
      const res = await fetch(`/api/appointments?${params.toString()}`);
      const data = await res.json().catch(() => []);

      if (currentReqId !== reqIdRef.current) return;
      if (!res.ok || !Array.isArray(data)) throw new Error("failed");
      setAppointments(data);
    } catch {
      if (currentReqId !== reqIdRef.current) return;
      setError("Цаг захиалгуудыг ачаалах үед алдаа гарлаа.");
    } finally {
      if (currentReqId === reqIdRef.current) setLoading(false);
    }
  }, [selectedDay, selectedBranchId]);

  useEffect(() => {
    setAppointments([]);
    setScheduledDoctors([]);
  }, [selectedDay, selectedBranchId]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // ---- load scheduled doctors ----
  useEffect(() => {
    if (!selectedDay || !selectedBranchId) return;
    const params = new URLSearchParams({ date: selectedDay, branchId: selectedBranchId });
    fetch(`/api/users/scheduled-doctors?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setScheduledDoctors(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [selectedDay, selectedBranchId]);

  // ---- SSE real-time ----
  useEffect(() => {
    if (!selectedDay) return;
    const params = new URLSearchParams({ date: selectedDay });
    if (selectedBranchId) params.set("branchId", selectedBranchId);

    let es: EventSource | null = null;
    let closed = false;

    function connect() {
      if (closed) return;
      es = new EventSource(`/api/appointments/stream?${params.toString()}`);

      es.addEventListener("appointment_created", (e: MessageEvent) => {
        try {
          const a = JSON.parse(e.data) as Appointment;
          setAppointments((prev) =>
            prev.some((x) => x.id === a.id) ? prev : [a, ...prev]
          );
        } catch {}
      });

      es.addEventListener("appointment_updated", (e: MessageEvent) => {
        try {
          const a = JSON.parse(e.data) as Appointment;
          setAppointments((prev) => prev.map((x) => (x.id === a.id ? a : x)));
        } catch {}
      });

      es.addEventListener("appointment_deleted", (e: MessageEvent) => {
        try {
          const { id } = JSON.parse(e.data) as { id: number };
          setAppointments((prev) => prev.filter((x) => x.id !== id));
        } catch {}
      });

      es.onerror = () => {
        es?.close();
        if (!closed) setTimeout(connect, 5000);
      };
    }

    connect();
    return () => {
      closed = true;
      es?.close();
    };
  }, [selectedDay, selectedBranchId]);

  // ---- filter to selected day ----
  const dayAppointments = useMemo(
    () =>
      appointments.filter(
        (a) => a.scheduledAt && a.scheduledAt.slice(0, 10) === selectedDay
      ),
    [appointments, selectedDay]
  );

  // ---- checked-in queue ----
  const checkedInQueue = useMemo(
    () =>
      dayAppointments
        .filter((a) => {
          if (!a.checkedInAt) return false;
          const s = String(a.status || "").toLowerCase();
          return s !== "ongoing" && s !== "completed";
        })
        .sort((a, b) => {
          const ta = a.checkedInAt ? new Date(a.checkedInAt).getTime() : 0;
          const tb = b.checkedInAt ? new Date(b.checkedInAt).getTime() : 0;
          return ta - tb;
        }),
    [dayAppointments]
  );

  // ---- summary stats ----
  const totalAppointments = dayAppointments.length;

  const totalScheduledDoctors = useMemo(() => {
    const ids = new Set<number>();
    scheduledDoctors.forEach((d) => ids.add(d.id));
    if (ids.size === 0) {
      dayAppointments.forEach((a) => { if (a.doctorId) ids.add(a.doctorId); });
    }
    return ids.size;
  }, [scheduledDoctors, dayAppointments]);

  const totalCompleted = useMemo(() => {
    const ids = new Set<number>();
    dayAppointments.forEach((a) => {
      if (a.status === "completed" && a.patientId) ids.add(a.patientId);
    });
    return ids.size;
  }, [dayAppointments]);

  // ---- modals ----
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const [detailsModal, setDetailsModal] = useState<{
    open: boolean;
    appointments: Appointment[];
    doctor?: Doctor | null;
    slotLabel?: string;
    slotTime?: string;
    date?: string;
  }>({ open: false, appointments: [] });

  // ---- billing navigation ----
  const openBilling = useCallback(async (appointmentId: number) => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/encounter`);
      if (!res.ok) { alert("Үзлэгийн мэдээлэл олдсонгүй."); return; }
      const data = await res.json();
      if (data?.encounterId) {
        router.push(`/billing/${data.encounterId}`);
      } else {
        alert("Үзлэгийн ID олдсонгүй.");
      }
    } catch {
      alert("Алдаа гарлаа. Дахин оролдоно уу.");
    }
  }, [router]);

  // ---- group appointments by doctor ----
  const byDoctor = useMemo(() => groupByDoctor(dayAppointments), [dayAppointments]);

  // Grid doctors: use scheduled doctors if available, fallback to doctors in appointments
  const gridDoctors = useMemo<Doctor[]>(() => {
    if (scheduledDoctors.length > 0) {
      return scheduledDoctors.map((sd) => ({
        id: sd.id,
        name: sd.name ?? null,
        ovog: sd.ovog ?? null,
        regNo: sd.regNo ?? null,
        phone: sd.phone ?? null,
        calendarOrder: sd.calendarOrder ?? null,
        branches: sd.branches ?? [],
        schedules: sd.schedules ?? [],
      }));
    }
    const ids = new Set<number>();
    const result: Doctor[] = [];
    dayAppointments.forEach((a) => {
      if (a.doctorId && !ids.has(a.doctorId)) {
        ids.add(a.doctorId);
        result.push({
          id: a.doctorId,
          name: a.doctorName ?? null,
          ovog: a.doctorOvog ?? null,
          regNo: null,
          phone: null,
        });
      }
    });
    return result;
  }, [scheduledDoctors, dayAppointments]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Ачаалж байна...</div>
      </div>
    );
  }

  // Render an appointment card row
  const renderApptCard = (a: Appointment, doc: Doctor | null) => {
    const timeStr = a.scheduledAt ? formatApptTime(a.scheduledAt, a.endAt) : null;
    const patientDisplay =
      [a.patientOvog ? a.patientOvog.charAt(0) + "." : null, a.patientName]
        .filter(Boolean)
        .join("") || "—";
    const isReadyToPay = a.status === "ready_to_pay";
    const canOpenBillingForAppt = isReadyToPay && isOwnBranch;

    return (
      <div
        key={a.id}
        onClick={() => {
          if (!isOwnBranch) return;
          const slotTime = a.scheduledAt
            ? `${new Date(a.scheduledAt).getHours().toString().padStart(2, "0")}:${new Date(a.scheduledAt).getMinutes().toString().padStart(2, "0")}`
            : "";
          setDetailsModal({
            open: true,
            appointments: [a],
            doctor: doc,
            slotLabel: timeStr ?? "",
            slotTime,
            date: selectedDay,
          });
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: isReadyToPay ? "linear-gradient(90deg,#dcfce7,#fff)" : "#fff",
          border: `1px solid ${statusColor(a.status)}40`,
          borderLeft: `4px solid ${statusColor(a.status)}`,
          borderRadius: 8,
          padding: "8px 12px",
          cursor: isOwnBranch ? "pointer" : "default",
          animation: isReadyToPay ? "readyToPayPulse 1.4s ease-in-out infinite" : undefined,
        }}
      >
        {timeStr && (
          <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, minWidth: 70, flexShrink: 0 }}>
            {timeStr}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {patientDisplay}
          </div>
          {a.notes && (
            <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.notes}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, background: statusColor(a.status), color: "#fff", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
            {formatStatus(a.status)}
          </span>
          {canOpenBillingForAppt && (
            <button
              onClick={(e) => { e.stopPropagation(); openBilling(a.id); }}
              style={{ fontSize: 11, background: "#15803d", color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontWeight: 600 }}
            >
              💳 Төлбөр
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <ReceptionLayout>
      <style>{`
        @keyframes readyToPayPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* ---- Header controls ---- */}
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Date picker */}
          <input
            type="date"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            style={{
              borderRadius: 8,
              border: "1px solid #d1d5db",
              padding: "6px 10px",
              fontSize: 14,
              background: "#fff",
            }}
          />

          {/* Branch selector */}
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            style={{
              borderRadius: 8,
              border: "1px solid #d1d5db",
              padding: "6px 10px",
              fontSize: 14,
              background: "#fff",
              minWidth: 130,
            }}
          >
            <option value="">Бүх салбар</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Create button */}
          <button
            onClick={() => {
              setEditingAppointment(null);
              setQuickModalOpen(true);
            }}
            style={{
              borderRadius: 8,
              background: "#131a29",
              color: "#fff",
              border: "none",
              padding: "7px 16px",
              fontSize: 14,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + Цаг захиалах
          </button>

          {!isOwnBranch && (
            <span
              style={{
                fontSize: 12,
                color: "#92400e",
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: 6,
                padding: "4px 10px",
              }}
            >
              ⚠️ Өөр салбар — зөвхөн &quot;захиалсан&quot; төлөвтэй цаг үүсгэнэ
            </span>
          )}
        </div>
      </div>

      {/* ---- Checked-in queue ---- */}
      {checkedInQueue.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#1d4ed8",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            🚪 Ирсэн үйлчлүүлэгчид ({checkedInQueue.length})
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {checkedInQueue.map((a) => {
              const patientDisplay = [
                a.patientOvog ? a.patientOvog.charAt(0) + "." : null,
                a.patientName,
              ].filter(Boolean).join("") || "—";
              const timeStr = a.scheduledAt
                ? `${new Date(a.scheduledAt).getHours().toString().padStart(2, "0")}:${new Date(a.scheduledAt).getMinutes().toString().padStart(2, "0")}`
                : null;
              return (
                <div
                  key={a.id}
                  style={{
                    flexShrink: 0,
                    minWidth: 160,
                    maxWidth: 200,
                    background: "linear-gradient(135deg,#eff6ff,#fff)",
                    border: "1px solid #bfdbfe",
                    borderRadius: 12,
                    padding: "10px 14px",
                    boxShadow: "0 2px 8px rgba(30,58,138,0.07)",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e3a8a", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {patientDisplay}
                  </div>
                  {timeStr && (
                    <div style={{ fontSize: 12, color: "#475569" }}>🕐 {timeStr}</div>
                  )}
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 11, background: statusColor(a.status), color: "#fff", borderRadius: 6, padding: "1px 6px" }}>
                      {formatStatus(a.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- Summary cards (no sales income card) ---- */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={{ background: "linear-gradient(90deg,#eff6ff,#fff)", borderRadius: 12, border: "1px solid #dbeafe", padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase" }}>Нийт цаг</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>{totalAppointments}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{formatYmdDots(selectedDay)} өдөр</div>
        </div>

        <div style={{ background: "linear-gradient(90deg,#fef9c3,#fff)", borderRadius: 12, border: "1px solid #facc15", padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: "#b45309", fontWeight: 700, textTransform: "uppercase" }}>Хуваарьт эмч</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>{totalScheduledDoctors}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Ажиллаж буй эмч</div>
        </div>

        <div style={{ background: "linear-gradient(90deg,#fee2e2,#fff)", borderRadius: 12, border: "1px solid #fecaca", padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: "#b91c1c", fontWeight: 700, textTransform: "uppercase" }}>Үйлчлүүлэгч</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>{totalCompleted}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Дууссан үйлчлүүлэгч</div>
        </div>
      </section>

      {/* ---- Error / Loading ---- */}
      {error && (
        <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}
      {loading && (
        <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>Ачаалж байна...</div>
      )}

      {/* ---- Appointment list grouped by doctor ---- */}
      {!loading && dayAppointments.length === 0 && (
        <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: 32 }}>
          Сонгосон өдөрт цаг захиалга байхгүй.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {gridDoctors.map((doc) => {
          const docAppts = (byDoctor[doc.id] ?? []).sort(
            (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
          );
          if (docAppts.length === 0) return null;

          const doctorLabel =
            [doc.ovog ? doc.ovog.charAt(0) + "." : null, doc.name]
              .filter(Boolean)
              .join("") || `Эмч #${doc.id}`;

          return (
            <div key={doc.id}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #e5e7eb" }}>
                👨‍⚕️ {doctorLabel}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {docAppts.map((a) => renderApptCard(a, doc))}
              </div>
            </div>
          );
        })}

        {/* No-doctor appointments */}
        {(byDoctor[0] ?? []).length > 0 && !gridDoctors.find((d) => d.id === 0) && (
          <div key="no-doctor">
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #e5e7eb" }}>
              🏥 Эмч тогтоогдоогүй
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(byDoctor[0] ?? []).map((a) => renderApptCard(a, null))}
            </div>
          </div>
        )}
      </div>

      {/* ---- Quick create/edit modal ---- */}
      {quickModalOpen && (
        <QuickAppointmentModal
          open={quickModalOpen}
          onClose={() => { setQuickModalOpen(false); setEditingAppointment(null); }}
          defaultDate={selectedDay}
          defaultTime=""
          branches={branches}
          doctors={doctors}
          scheduledDoctors={scheduledDoctors}
          appointments={appointments}
          selectedBranchId={selectedBranchId}
          onCreated={(a) => {
            setAppointments((prev) => [a, ...prev]);
            setQuickModalOpen(false);
            setEditingAppointment(null);
          }}
          editingAppointment={editingAppointment}
          onUpdated={(a) => {
            setAppointments((prev) => prev.map((x) => (x.id === a.id ? a : x)));
            setQuickModalOpen(false);
            setEditingAppointment(null);
          }}
        />
      )}

      {/* ---- Details modal (own branch only) ---- */}
      {detailsModal.open && (
        <AppointmentDetailsModal
          open={detailsModal.open}
          onClose={() => setDetailsModal((s) => ({ ...s, open: false }))}
          doctor={detailsModal.doctor}
          slotLabel={detailsModal.slotLabel}
          slotTime={detailsModal.slotTime}
          date={detailsModal.date}
          appointments={detailsModal.appointments}
          currentUserRole={me?.role ?? null}
          onStatusUpdated={(updated) => {
            setAppointments((prev) =>
              prev.map((x) => (x.id === updated.id ? updated : x))
            );
          }}
          onEditAppointment={(a) => {
            setDetailsModal((s) => ({ ...s, open: false }));
            setEditingAppointment(a);
            setQuickModalOpen(true);
          }}
          // Receptionist cannot start encounters
          onStartEncounter={async () => {
            alert("Рецепшн үзлэг эхлүүлэх эрхгүй.");
          }}
        />
      )}
    </ReceptionLayout>
  );
}


import React, { useEffect, useRef, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  name: string | null;
  ovog: string | null;
};

type ScheduledDoctor = Doctor & {
  schedules?: {
    id: number;
    branchId: number;
    date: string;
    startTime: string; // "HH:MM"
    endTime: string; // "HH:MM"
    note: string | null;
  }[];
};

type PatientLite = {
  id: number;
  name: string;
  ovog?: string | null;
  regNo: string;
  phone?: string | null;
  patientBook?: { bookNumber: string } | null;
};

type Appointment = {
  id: number;
  patientId: number;
  doctorId: number | null;
  branchId: number;
  scheduledAt: string; // start
  endAt?: string | null; // end
  status: string;
  notes: string | null;
  patient?: PatientLite;
  doctor?: Doctor | null;
  branch?: Branch | null;
};

function groupByDate(appointments: Appointment[]) {
  const map: Record<string, Appointment[]> = {};
  for (const a of appointments) {
    const d = new Date(a.scheduledAt);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!map[day]) map[day] = [];
    map[day].push(a);
  }
  const entries = Object.entries(map).sort(([d1], [d2]) =>
    d1 < d2 ? -1 : d1 > d2 ? 1 : 0
  );
  return entries;
}

// Default weekday hours
const START_HOUR = 9; // 09:00
const END_HOUR = 21; // 21:00
const SLOT_MINUTES = 30;

// Weekend clinic hours
const WEEKEND_START_HOUR = 10; // 10:00
const WEEKEND_END_HOUR = 19; // 19:00

type TimeSlot = {
  label: string; // "09:00"
  start: Date;
  end: Date;
};

function generateTimeSlotsForDay(day: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const weekdayIndex = day.getDay(); // 0=Sun, 6=Sat
  const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;

  const startHour = isWeekend ? WEEKEND_START_HOUR : START_HOUR;
  const endHour = isWeekend ? WEEKEND_END_HOUR : END_HOUR;

  for (let hour = startHour; hour < endHour; hour++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const start = new Date(day);
      start.setHours(hour, m, 0, 0);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
      const label = start.toLocaleTimeString("mn-MN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      slots.push({ label, start, end });
    }
  }
  return slots;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function getSlotTimeString(date: Date): string {
  // "HH:MM" in local time
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// Kept for possible reuse; NOT used in grid rendering anymore
function isFirstSlotForAppointment(
  a: Appointment,
  slotStart: Date,
  slotMinutes = SLOT_MINUTES
): boolean {
  const start = new Date(a.scheduledAt);
  if (Number.isNaN(start.getTime())) return false;

  const diffMinutes = Math.floor(
    (slotStart.getTime() - start.getTime()) / 60000
  );
  return diffMinutes >= 0 && diffMinutes < slotMinutes;
}

// Kept for possible reuse; NOT used in grid rendering anymore
function isMiddleSlotForAppointment(
  a: Appointment,
  slotStart: Date,
  slotMinutes = SLOT_MINUTES
): boolean {
  const start = new Date(a.scheduledAt);
  const end = a.endAt ? new Date(a.endAt) : null;
  if (Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
    return false;
  }

  const durationMinutes = Math.floor(
    (end.getTime() - start.getTime()) / 60000
  );
  if (durationMinutes <= 0) return false;

  const slotsPerHour = 60 / slotMinutes; // 2 when 30‑min slots
  const apptStartIndex =
    start.getHours() * slotsPerHour +
    Math.floor(start.getMinutes() / slotMinutes);
  const slotIndex =
    slotStart.getHours() * slotsPerHour +
    Math.floor(slotStart.getMinutes() / slotMinutes);

  const slotCount = Math.max(1, Math.ceil(durationMinutes / slotMinutes));
  const middleOffset = Math.floor((slotCount - 1) / 2);
  const middleIndex = apptStartIndex + middleOffset;

  return slotIndex === middleIndex;
}

function addMinutesToTimeString(time: string, minutesToAdd: number): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;

  let total = h * 60 + m + minutesToAdd;
  if (total < 0) total = 0;
  if (total > 23 * 60 + 59) total = 23 * 60 + 59;

  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${newH.toString().padStart(2, "0")}:${newM
    .toString()
    .padStart(2, "0")}`;
}

function isTimeWithinRange(time: string, startTime: string, endTime: string) {
  // inclusive of start, exclusive of end
  return time >= startTime && time < endTime;
}

function formatDoctorName(d?: Doctor | null) {
  if (!d) return "Тодорхойгүй";
  const name = d.name || "";
  const ovog = (d.ovog || "").trim();
  if (name && ovog) {
    return `${ovog.charAt(0).toUpperCase()}.${name}`;
  }
  return name || "Тодорхойгүй";
}

function formatPatientLabel(p?: PatientLite, id?: number) {
  if (!p) return `Patient #${id ?? "-"}`;

  const ovog = (p.ovog || "").trim();
  const name = (p.name || "").trim();

  let displayName = name;
  if (ovog && name) {
    displayName = `${ovog.charAt(0).toUpperCase()}.${name}`;
  }

  const book = p.patientBook?.bookNumber
    ? ` • Карт: ${p.patientBook.bookNumber}`
    : "";

  return `${displayName}${book}`;
}

function formatPatientSearchLabel(p: PatientLite): string {
  const ovog = (p.ovog || "").trim();
  const name = (p.name || "").trim();
  const phone = (p.phone || "").trim();
  const regNo = (p.regNo || "").trim();
  const parts: string[] = [];

  if (ovog || name) {
    parts.push([ovog, name].filter(Boolean).join(" "));
  }
  if (phone) {
    parts.push(`Утас: ${phone}`);
  }
  if (regNo) {
    parts.push(`РД: ${regNo}`);
  }
  if (p.patientBook?.bookNumber) {
    parts.push(`Карт #${p.patientBook.bookNumber}`);
  }

  return parts.join(" • ");
}

function getDateFromYMD(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function formatDateYmdDots(date: Date): string {
  // outputs: "2025.12.16"
  return date.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Map internal status codes to Mongolian labels
function formatStatus(status: string): string {
  switch (status) {
    case "booked":
      return "Захиалсан";
    case "confirmed":
      return "Баталгаажсан";
    case "ongoing":
      return "Явагдаж байна";
    case "completed":
      return "Дууссан";
    case "cancelled":
      return "Цуцалсан";
    default:
      return status || "-";
  }
}

// ==== Appointment Details Modal ====
// (this is exactly your current implementation)
type AppointmentDetailsModalProps = {
  open: boolean;
  onClose: () => void;
  doctor?: Doctor | null;
  slotLabel?: string;
  slotTime?: string; // HH:MM
  date?: string; // YYYY-MM-DD
  appointments: Appointment[];
  onStatusUpdated?: (updated: Appointment) => void;
};

function formatDetailedTimeRange(start: Date, end: Date | null): string {
  if (Number.isNaN(start.getTime())) return "-";

  const datePart = formatDateYmdDots(start);
  const startTime = start.toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (!end || Number.isNaN(end.getTime())) {
    return `${datePart} ${startTime}`;
  }

  const endTime = end.toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${datePart} ${startTime} – ${endTime}`;
}

function AppointmentDetailsModal({
  open,
  onClose,
  doctor,
  slotLabel,
  slotTime,
  date,
  appointments,
  onStatusUpdated,
}: AppointmentDetailsModalProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleStartEdit = (a: Appointment) => {
    setEditingId(a.id);
    setEditingStatus(a.status);
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingStatus("");
    setError("");
  };

  const handleSaveStatus = async (a: Appointment) => {
    if (!editingStatus || editingStatus === a.status) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/appointments/${a.id}`, {
        method: "PATCH", // MUST match backend
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editingStatus }),
      });

      let text: string | null = null;
      let data: any = null;
      try {
        text = await res.text();
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        console.error("Update status failed", res.status, text);
        setError(
          (data && data.error) ||
            `Төлөв шинэчлэхэд алдаа гарлаа (код ${res.status})`
        );
        setSaving(false);
        return;
      }

      const updated = data as Appointment;
      if (onStatusUpdated) onStatusUpdated(updated);

      setEditingId(null);
      setEditingStatus("");
    } catch (e) {
      console.error("Update status network error", e);
      setError("Сүлжээгээ шалгана уу.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: 8,
          boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
          padding: 16,
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 15,
            }}
          >
            Цагийн дэлгэрэнгүй
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 8, color: "#4b5563" }}>
          <div>
            <strong>Огноо:</strong>{" "}
            {date ? formatDateYmdDots(new Date(date)) : "-"}
          </div>
          <div>
            <strong>Цаг:</strong> {slotLabel || slotTime || "-"}
          </div>
          <div>
            <strong>Эмч:</strong> {formatDoctorName(doctor ?? null)}
          </div>
        </div>

        {appointments.length === 0 ? (
          <div style={{ color: "#6b7280" }}>Энэ цагт захиалга алга.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {appointments.map((a) => {
              const start = new Date(a.scheduledAt);
              const end =
                a.endAt && !Number.isNaN(new Date(a.endAt).getTime())
                  ? new Date(a.endAt)
                  : null;

              const isEditing = editingId === a.id;

              return (
                <div
                  key={a.id}
                  style={{
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    padding: 8,
                    background: "#f9fafb",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>
                      {formatPatientLabel(a.patient, a.patientId)}
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(a)}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid #2563eb",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          cursor: "pointer",
                        }}
                      >
                        Засах
                      </button>
                    )}
                  </div>

                  {!isEditing ? (
                    <div style={{ color: "#4b5563" }}>
                      <div>
                        <strong>Төлөв:</strong> {formatStatus(a.status)}
                      </div>
                      <div>
                        <strong>Утас:</strong> {a.patient?.phone || "-"}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      <label style={{ fontSize: 12 }}>
                        Төлөв:
                        <select
                          value={editingStatus}
                          onChange={(e) =>
                            setEditingStatus(e.target.value)
                          }
                          style={{
                            marginLeft: 4,
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "2px 6px",
                            fontSize: 12,
                          }}
                        >
                          <option value="booked">Захиалсан</option>
                          <option value="confirmed">Баталгаажсан</option>
                          <option value="ongoing">Явагдаж байна</option>
                          <option value="completed">Дууссан</option>
                          <option value="cancelled">Цуцалсан</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSaveStatus(a)}
                        disabled={saving}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 6,
                          border: "none",
                          background: "#16a34a",
                          color: "white",
                          cursor: saving ? "default" : "pointer",
                        }}
                      >
                        {saving ? "Хадгалж байна..." : "Хадгалах"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={saving}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          background: "#f9fafb",
                          cursor: saving ? "default" : "pointer",
                        }}
                      >
                        Болих
                      </button>
                    </div>
                  )}

                  <div style={{ color: "#4b5563" }}>
                    <strong>Салбар:</strong> {a.branch?.name ?? a.branchId}
                  </div>
                  <div style={{ color: "#4b5563" }}>
                    <strong>Цаг захиалга:</strong>{" "}
                    {formatDetailedTimeRange(start, end)}
                  </div>
                  <div style={{ color: "#4b5563" }}>
                    <strong>Тэмдэглэл:</strong> {a.notes || "-"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 8,
              color: "#b91c1c",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
}

// ==== QuickAppointmentModal ====
// (this is your implementation from the file – unchanged)
// ... keep exactly as in your current file ...

// ==== AppointmentForm ====
// (unchanged – use your existing implementation)
// ... keep exactly as in your current file ...

// ==== Page ====

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [scheduledDoctors, setScheduledDoctors] = useState<ScheduledDoctor[]>(
    []
  );
  const [error, setError] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterBranchId, setFilterBranchId] = useState<string>("");
  const [filterDoctorId, setFilterDoctorId] = useState<string>("");

  const [activeBranchTab, setActiveBranchTab] = useState<string>("");

  const groupedAppointments = groupByDate(appointments);
  const selectedDay = getDateFromYMD(filterDate);
  const timeSlots = generateTimeSlotsForDay(selectedDay);

  const [detailsModalState, setDetailsModalState] = useState<{
    open: boolean;
    doctor?: Doctor | null;
    slotLabel?: string;
    slotTime?: string;
    date?: string;
    appointments: Appointment[];
  }>({
    open: false,
    appointments: [],
  });

  const [quickModalState, setQuickModalState] = useState<{
    open: boolean;
    doctorId?: number;
    date: string;
    time: string;
  }>({
    open: false,
    date: todayStr,
    time: "09:00",
  });

  const formSectionRef = useRef<HTMLElement | null>(null);

  const loadAppointments = async () => {
    try {
      setError("");
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterBranchId) params.set("branchId", filterBranchId);
      if (filterDoctorId) params.set("doctorId", filterDoctorId);

      const res = await fetch(`/api/appointments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        throw new Error("failed");
      }
      setAppointments(data);
    } catch {
      setError("Цаг захиалгуудыг ачаалах үед алдаа гарлаа.");
    }
  };

  const loadScheduledDoctors = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterBranchId) params.set("branchId", filterBranchId);

      const res = await fetch(`/api/doctors/scheduled?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !Array.isArray(data)) {
        throw new Error("failed");
      }

      const sorted = data
        .slice()
        .sort((a: ScheduledDoctor, b: ScheduledDoctor) => {
          const an = (a.name || "").toLowerCase();
          const bn = (b.name || "").toLowerCase();
          return an.localeCompare(bn);
        });

      setScheduledDoctors(sorted);
    } catch (e) {
      console.error("Failed to load scheduled doctors", e);
      setScheduledDoctors([]);
    }
  };

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch("/api/branches"),
          fetch("/api/users?role=doctor"),
        ]);

        const [bData, dData] = await Promise.all([
          bRes.json().catch(() => []),
          dRes.json().catch(() => []),
        ]);

        if (Array.isArray(bData)) setBranches(bData);
        if (Array.isArray(dData)) setDoctors(dData);
      } catch (e) {
        console.error(e);
      }
    };

    loadMeta();
  }, []);

  useEffect(() => {
    loadAppointments();
    loadScheduledDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, filterBranchId, filterDoctorId]);

  const handleBranchTabClick = (branchId: string) => {
    setActiveBranchTab(branchId);
    setFilterBranchId(branchId);
  };

  const gridDoctors: ScheduledDoctor[] = scheduledDoctors;

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      {/* header, branch tabs, filters, AppointmentForm – all as in your current file */}

      {/* ... keep your header, tabs, filters, create form, and error display here ... */}

      {/* Time grid by doctor – COLOR FOR DURATION + side‑by‑side text */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>
          Өдрийн цагийн хүснэгт (эмчээр)
        </h2>
        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>
          {formatDateYmdDots(selectedDay)}
        </div>

        {gridDoctors.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Энэ өдөр ажиллах эмчийн хуваарь алга.
          </div>
        )}

        {gridDoctors.length > 0 && (
          <div
            style={{
              border: "1px солид #ddd",
              borderRadius: 8,
              overflow: "hidden",
              fontSize: 12,
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `80px repeat(${gridDoctors.length}, 1fr)`,
                backgroundColor: "#f5f5f5",
                borderBottom: "1px солид #ddd",
              }}
            >
              <div style={{ padding: 8, fontWeight: "bold" }}>Цаг</div>
              {gridDoctors.map((doc) => {
                const count = appointments.filter(
                  (a) => a.doctorId === doc.id
                ).length;
                return (
                  <div
                    key={doc.id}
                    style={{
                      padding: 8,
                      fontWeight: "bold",
                      textAlign: "center",
                      borderLeft: "1px солид #ddd",
                    }}
                  >
                    <div>{formatDoctorName(doc)}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                        marginTop: 2,
                      }}
                    >
                      {count} захиалга
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time rows */}
            <div>
              {timeSlots.map((slot, rowIndex) => (
                <div
                  key={rowIndex}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${gridDoctors.length}, 1fr)`,
                    borderBottom: "1px солид #f0f0f0",
                  }}
                >
                  {/* Time label column */}
                  <div
                    style={{
                      padding: 6,
                      borderRight: "1px солид #ddd",
                      backgroundColor:
                        rowIndex % 2 === 0 ? "#fafafa" : "#ffffff",
                    }}
                  >
                    {slot.label}
                  </div>

                  {/* Doctor columns */}
                  {gridDoctors.map((doc) => {
                    const appsForCell = appointments.filter((a) => {
                      if (a.doctorId !== doc.id) return false;

                      const start = new Date(a.scheduledAt);
                      if (Number.isNaN(start.getTime())) return false;

                      const end =
                        a.endAt &&
                        !Number.isNaN(new Date(a.endAt).getTime())
                          ? new Date(a.endAt)
                          : new Date(
                              start.getTime() +
                                SLOT_MINUTES * 60 * 1000
                            );

                      const slotStart = slot.start;
                      const slotEnd = slot.end;

                      // overlap: start < slotEnd && end > slotStart
                      return start < slotEnd && end > slotStart;
                    });

                    const slotTimeStr = getSlotTimeString(slot.start);
                    const schedules = (doc as any).schedules || [];

                    const isWorkingHour = schedules.some((s: any) =>
                      isTimeWithinRange(
                        slotTimeStr,
                        s.startTime,
                        s.endTime
                      )
                    );

                    const weekdayIndex = slot.start.getDay();
                    const isWeekend =
                      weekdayIndex === 0 || weekdayIndex === 6;

                    const isWeekendLunch =
                      isWeekend &&
                      isTimeWithinRange(slotTimeStr, "14:00", "15:00");

                    let bg: string;
                    if (!isWorkingHour || isWeekendLunch) {
                      bg = "#ee7148";
                    } else if (appsForCell.length === 0) {
                      bg = "#ffffff";
                    } else {
                      // COLOR FOR DURATION – first overlapping app
                      const status = appsForCell[0].status;
                      bg =
                        status === "completed"
                          ? "#fb6190"
                          : status === "confirmed"
                          ? "#bbf7d0"
                          : status === "ongoing"
                          ? "#f9d89b"
                          : status === "cancelled"
                          ? "#9d9d9d"
                          : "#77f9fe";
                    }

                    const isNonWorking = !isWorkingHour || isWeekendLunch;

                    const handleCellClick = () => {
                      if (isNonWorking) return;

                      if (appsForCell.length === 0) {
                        setQuickModalState({
                          open: true,
                          doctorId: doc.id,
                          date: filterDate,
                          time: slotTimeStr,
                        });
                      } else {
                        setDetailsModalState({
                          open: true,
                          doctor: doc,
                          slotLabel: slot.label,
                          slotTime: slotTimeStr,
                          date: filterDate,
                          appointments: appsForCell,
                        });
                      }
                    };

                    return (
                      <div
                        key={doc.id}
                        onClick={handleCellClick}
                        style={{
                          padding: 4,
                          borderLeft: "1px солид #f0f0f0",
                          backgroundColor: bg,
                          minHeight: 28,
                          cursor: isNonWorking ? "not-allowed" : "pointer",
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          gap: 4,
                          textAlign: "left",
                        }}
                      >
                        {appsForCell.map((a) => (
                          <div
                            key={a.id}
                            style={{
                              fontSize: 12,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth:
                                appsForCell.length > 1 ? "48%" : "100%",
                            }}
                            title={`${formatPatientLabel(
                              a.patient,
                              a.patientId
                            )} (${formatStatus(a.status)})`}
                          >
                            {formatPatientLabel(a.patient, a.patientId)} (
                            {formatStatus(a.status)})
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Day‑grouped calendar, raw table, modals – keep exactly as in your file */}

      {/* ... copy the rest of your existing AppointmentsPage (calendar, table, modals) here ... */}
    </main>
  );
}

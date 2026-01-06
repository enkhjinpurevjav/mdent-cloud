import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/router";

const SLOT_MINUTES = 30;

// API base URL configuration
// In production on mdent.cloud, use api.mdent.cloud; in dev, use relative path
const API_BASE_URL = 
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : "";

// ========== TYPES ==========
type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  name: string | null;
  ovog: string | null;
  regNo: string | null;
  phone: string | null;
  calendarOrder?: number | null; // NEW
};

type ScheduledDoctor = Doctor & {
  schedules?: DoctorScheduleDay[];
};

type PatientLite = {
  id: number;
  regNo: string | null;
  name: string;
  phone: string | null;
  // allow optional extra fields we attach
  ovog?: string | null;
  patientBook?: any;
};

type Appointment = {
  id: number;
  branchId: number;
  doctorId: number | null;
  patientId: number | null;
  patientName: string | null;
  patientOvog?: string | null;  
  patientRegNo: string | null;
  patientPhone: string | null;
  doctorName: string | null;
  doctorOvog: string | null;
  scheduledAt: string;
  endAt: string | null;
  status: string;
  notes: string | null;
  patient?: {
    id: number;
    name: string;
    ovog?: string | null;
    regNo?: string | null;
    phone?: string | null;
    patientBook?: { bookNumber?: string | null } | null;
    [key: string]: any;
  } | null;
  branch?: { id: number; name: string } | null;
};

function groupByDate(appointments: Appointment[]) {
  const map: Record<string, Appointment[]> = {};
  for (const a of appointments) {
    const scheduled = a.scheduledAt;
    if (!scheduled) continue;
    const key = clinicYmdFromIso(scheduled);
    if (!map[key]) map[key] = [];
    map[key].push(a);
  }
  return map;
}

function clinicDayFromClinicIso(iso: string): string {
  // backend returns YYYY-MM-DDTHH:mm:ss+08:00
  return typeof iso === "string" && iso.length >= 10 ? iso.slice(0, 10) : "";
}

function clinicHHMMFromClinicIso(iso: string): string {
  if (typeof iso !== "string") return "";
  // supports both:
  // "YYYY-MM-DDTHH:mm:ss+08:00"
  // "YYYY-MM-DD HH:mm:ss"
  // "YYYY-MM-DDTHH:mm:ss"
  const m = iso.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}

function minutesFromHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesFromClinicIso(iso: string): number {
  // backend returns "YYYY-MM-DDTHH:mm:ss+08:00"
  const hhmm = clinicHHMMFromClinicIso(iso);
  return minutesFromHHMM(hhmm);
}

function getAppointmentDayKey(a: Appointment): string {
  const scheduled = a.scheduledAt;
  if (!scheduled || typeof scheduled !== "string") return "";
  return clinicDayFromClinicIso(scheduled);
}

type DoctorScheduleDay = {
  doctorId: number;
  branchId: number;
  date: string; // yyyy-mm-dd
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
};

type TimeSlot = {
  start: Date;
  end: Date;
  label: string; // add label
};

function generateTimeSlotsForDay(day: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const weekday = day.getDay(); // 0 = Sun, 6 = Sat

  // Visual working window
  // Weekdays: 09:00–21:00
  // Weekends: 10:00–19:00
  const startHour = weekday === 0 || weekday === 6 ? 10 : 9;
  const endHour = weekday === 0 || weekday === 6 ? 19 : 21;

  const d = new Date(day);
  d.setHours(startHour, 0, 0, 0);

  while (d.getHours() < endHour) {
    const start = new Date(d);
    d.setMinutes(d.getMinutes() + SLOT_MINUTES);
    const end = new Date(d);
    slots.push({
      start,
      end,
      label: getSlotTimeString(start),
    });
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

function addMinutesToTimeString(time: string, minutesToAdd: number): string {
  const [hh, mm] = time.split(":").map(Number);
  const base = new Date();
  base.setHours(hh, mm, 0, 0);
  base.setMinutes(base.getMinutes() + minutesToAdd);
  return getSlotTimeString(base);
}

function isTimeWithinRange(time: string, startTime: string, endTime: string) {
  // inclusive of start, exclusive of end
  return time >= startTime && time < endTime;
}

function formatDoctorName(d?: Doctor | null) {
  if (!d) return "";
  const name = (d.name || "").trim();
  const ovog = (d.ovog || "").trim();
  if (!name && !ovog) return "";

  if (ovog) {
    const first = ovog.charAt(0).toUpperCase();
    return `${first}.${name}`;
  }
  return name;
}

function formatPatientLabel(
  p?: { name: string; regNo?: string | null; phone?: string | null } | null,
  id?: number
) {
  if (!p) return id ? `#${id}` : "";
  const parts = [p.name];
  if (p.regNo) parts.push(`(${p.regNo})`);
  if (p.phone) parts.push(`📞 ${p.phone}`);
  return parts.join(" ");
}

// Add helper near other helpers
function clinicYmdFromIso(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
}

// Helper to normalize schedule day keys for robust date comparison
// Backend may return ISO dates like "2024-01-15T00:00:00.000Z" or "YYYY-MM-DD"
function scheduleDayKey(dateStr: string): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  // If already in YYYY-MM-DD format (10 chars), return as-is
  if (dateStr.length === 10 && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  // Otherwise, try to parse as ISO and extract YYYY-MM-DD
  return dateStr.slice(0, 10);
}


// frontend helper (already in your file)
function formatGridShortLabel(a: Appointment): string {
  const p = a.patient as any;

  const rawName = (p?.name ?? a.patientName ?? "").toString().trim();
  const rawOvog = (p?.ovog ?? a.patientOvog ?? "").toString().trim();

  const rawBookNumber =
    p?.patientBook?.bookNumber != null
      ? String(p.patientBook.bookNumber).trim()
      : "";

  let displayName = rawName;
  if (rawOvog) {
    const first = rawOvog.charAt(0).toUpperCase();
    displayName = `${first}.${rawName}`;
  }

  if (!displayName) return "";

  if (rawBookNumber) {
    return `${displayName} (${rawBookNumber})`;
  }

  return displayName;
}

function formatPatientSearchLabel(p: PatientLite): string {
  const parts: string[] = [];

  // Ovog + name
  const name = (p.name || "").toString().trim();
  const ovog = (p.ovog || "").toString().trim();

  if (ovog && name) {
    parts.push(`${ovog} ${name}`); // or `${ovog}.${name}` if you prefer
  } else if (name) {
    parts.push(name);
  } else if (ovog) {
    parts.push(ovog);
  }

  // RegNo
  if (p.regNo) parts.push(`(${p.regNo})`);

  // Phone
  if (p.phone) parts.push(`📞 ${p.phone}`);

  // Patient book number, if present
  const bookNumber =
    p.patientBook && p.patientBook.bookNumber != null
      ? String(p.patientBook.bookNumber)
      : "";
  if (bookNumber) parts.push(`#${bookNumber}`);

  return parts.join(" ");
}

function getDateFromYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return new Date(); // fallback to today
  return new Date(y, m - 1, d);
}

function formatDateYmdDots(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}.${m}.${d}`;
}

function formatStatus(status: string): string {
  switch (status) {
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
      return status;
  }
}

// ✅ Helper: is this appointment in “Явагдаж байна” state?
function isOngoing(status: string) {
  return status === "ongoing";
}



/**
 * Compute stable lanes (0 or 1) for all appointments for a doctor on a given day.
 * Ensures that overlapping appointments never share the same lane.
 */
function computeAppointmentLanesForDayAndDoctor(
  list: Appointment[]
): Record<number, 0 | 1> {
  const result: Record<number, 0 | 1> = {};

  // Sort by start time, then by (end - start) duration DESC (longer first)
  const sorted = list
    .slice()
    .filter((a) => !Number.isNaN(new Date(a.scheduledAt).getTime()))
    .sort((a, b) => {
      const sa = new Date(a.scheduledAt).getTime();
      const sb = new Date(b.scheduledAt).getTime();
      if (sa !== sb) return sa - sb;

      const ea =
        a.endAt && !Number.isNaN(new Date(a.endAt).getTime())
          ? new Date(a.endAt).getTime()
          : sa;
      const eb =
        b.endAt && !Number.isNaN(new Date(b.endAt).getTime())
          ? new Date(b.endAt).getTime()
          : sb;

      // longer first if same start
      return eb - ea;
    });

  const laneLastEnd: (number | null)[] = [null, null];

  for (const a of sorted) {
    const start = new Date(a.scheduledAt).getTime();
    const end =
      a.endAt && !Number.isNaN(new Date(a.endAt).getTime())
        ? new Date(a.endAt).getTime()
        : start + SLOT_MINUTES * 60 * 1000;

    let assignedLane: 0 | 1 | null = null;

    for (let lane = 0; lane < 2; lane++) {
      const lastEnd = laneLastEnd[lane];
      if (lastEnd == null || start >= lastEnd) {
        assignedLane = lane as 0 | 1;
        laneLastEnd[lane] = end;
        break;
      }
    }

    // If still null, both lanes overlap → force lane 0 visually (will stack)
    if (assignedLane === null) {
      assignedLane = 0;
      laneLastEnd[0] = Math.max(laneLastEnd[0] ?? 0, end);
    }

    result[a.id] = assignedLane;
  }

  return result;
}


// ==== Appointment Details Modal ====


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

  const fmtDate = new Intl.DateTimeFormat("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const fmtTime = new Intl.DateTimeFormat("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const datePart = fmtDate.format(start).replaceAll("-", "."); // if mn-MN returns with dashes
  const startTime = fmtTime.format(start);

  if (!end || Number.isNaN(end.getTime())) {
    return `${datePart} ${startTime}`;
  }

  const endTime = fmtTime.format(end);
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
  const router = useRouter();

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
      const res = await fetch(`${API_BASE_URL}/api/appointments/${a.id}`, {
        method: "PATCH",
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

  const handleStartEncounter = async (a: Appointment) => {
    try {
      setError("");
      const res = await fetch(`${API_BASE_URL}/api/appointments/${a.id}/start-encounter`, {
        method: "POST",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || typeof data.encounterId !== "number") {
        console.error("start-encounter failed", res.status, data);
        setError(
          (data && data.error) ||
            "Үзлэг эхлүүлэх үед алдаа гарлаа. Төлөв нь 'Явагдаж байна' эсэхийг шалгана уу."
        );
        return;
      }

      router.push(`/encounters/${data.encounterId}`);
    } catch (e) {
      console.error("start-encounter network error", e);
      setError("Үзлэг эхлүүлэхэд сүлжээний алдаа гарлаа.");
    }
  };

  const handleViewEncounterForPayment = async (a: Appointment) => {
    try {
      setError("");
      const res = await fetch(`${API_BASE_URL}/api/appointments/${a.id}/encounter`, {
        method: "GET",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || typeof data.encounterId !== "number") {
        console.error("get encounter for payment failed", res.status, data);
        setError(
          (data && data.error) ||
            "Үзлэгийн мэдээлэл авах үед алдаа гарлаа."
        );
        return;
      }

      // Go to billing page for this encounter
      router.push(`/billing/${data.encounterId}`);
    } catch (e) {
      console.error("view-encounter-for-payment network error", e);
      setError("Үзлэгийн мэдээлэл авах үед сүлжээний алдаа гарлаа.");
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

                {/* Patient summary header */}
        <div
          style={{
            marginBottom: 8,
            color: "#4b5563",
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {appointments.length > 0 ? (() => {
            const a = appointments[0];
            const p = a.patient as any;

            const name = (p?.name ?? a.patientName ?? "").toString().trim();
            const ovog = (p?.ovog ?? a.patientOvog ?? "").toString().trim();
            const phone = (p?.phone ?? a.patientPhone ?? "").toString().trim();
            const bookNumber =
              p?.patientBook?.bookNumber != null
                ? String(p.patientBook.bookNumber).trim()
                : "";

            let displayName = name;
            if (ovog) {
              const first = ovog.charAt(0).toUpperCase();
              displayName = `${first}.${name}`;
            }

            return (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div>
                    <strong>Үйлчлүүлэгч:</strong>{" "}
                    {displayName || "-"}
                  </div>
                  <div>
                    <span>📞 {phone || "-"}</span>
                  </div>
                  <div>
                    <strong>Картын дугаар:</strong>{" "}
                    {bookNumber || "-"}
                  </div>
                </div>

                                <div style={{ alignSelf: "flex-start" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const p = a.patient as any;
                      const bookNumber =
                        p?.patientBook?.bookNumber != null
                          ? String(p.patientBook.bookNumber).trim()
                          : "";

                      if (bookNumber) {
                        router.push(
                          `/patients/${encodeURIComponent(bookNumber)}`
                        );
                      }
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #2563eb",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Дэлгэрэнгүй
                  </button>
                </div>
              </>
            );
          })() : (
            <div>Үйлчлүүлэгчийн мэдээлэл алга.</div>
          )}
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
              const canStartEncounter = isOngoing(a.status);

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
                        Төлөв засах
                      </button>
                    )}
                  </div>

                                    {!isEditing ? (
                    <>
                      <div style={{ color: "#4b5563" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <strong>Төлөв:</strong> {formatStatus(a.status)}
                          {a.status === "ready_to_pay" && (
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: "#f97316",
                                color: "white",
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              Төлбөр авах
                            </span>
                          )}
                        </div>
                       
                      </div>

                      {/* Doctor + appointment branch */}
                      <div style={{ color: "#4b5563", marginTop: 4 }}>
  <div>
    <strong>Эмч:</strong>{" "}
    {(() => {
      const rawName = (a.doctorName ?? "").toString().trim();
      const rawOvog = (a.doctorOvog ?? "").toString().trim();

      // doctorName = "Test Amaraa" → нэр хэсгийг авах
      let pureName = rawName;
      if (rawName && rawOvog) {
        const lowerName = rawName.toLowerCase();
        const lowerOvog = rawOvog.toLowerCase();

        if (lowerName.startsWith(lowerOvog + " ")) {
          pureName = rawName.slice(rawOvog.length).trim();
        }
      }

      if (!pureName && !rawOvog) return "-";

      if (rawOvog) {
        const first = rawOvog.charAt(0).toUpperCase();
        return `${first}.${pureName || rawOvog}`;
      }

      return pureName;
    })()}
  </div>
  <div>
                          <strong>Салбар:</strong>{" "}
                          {a.branch?.name ?? a.branchId}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {canStartEncounter && (
                          <button
                            type="button"
                            onClick={() => handleStartEncounter(a)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: "1px solid #16a34a",
                              background: "#dcfce7",
                              color: "#166534",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Үзлэг эхлүүлэх / үргэлжлүүлэх
                          </button>
                        )}

                        {a.status === "ready_to_pay" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleViewEncounterForPayment(a)
                            }
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: "1px solid #f59e0b",
                              background: "#fef3c7",
                              color: "#92400e",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Төлбөр авах / Үзлэг харах
                          </button>
                        )}

                        {!canStartEncounter &&
                          a.status !== "ready_to_pay" && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                              }}
                            >
                              Үзлэгийг зөвхөн “Явагдаж байна” төлөвтэй үед
                              эхлүүлнэ.
                            </span>
                          )}
                      </div>
                    </>
                  ) : (
                    // editing branch stays as-is
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
                          <option value="online">Онлайн</option>
                          <option value="ongoing">Явагдаж байна</option>
                          <option value="ready_to_pay">Төлбөр төлөх</option>
                          <option value="completed">Дууссан</option>
                          <option value="no_show">Ирээгүй</option>
                          <option value="cancelled">Цуцалсан</option>
                          <option value="other">Бусад</option>
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
// ==== Quick Appointment Modal (with start/end, default 30min) ====

type QuickAppointmentModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDoctorId?: number;
  defaultDate: string; // YYYY-MM-DD
  defaultTime: string; // HH:MM
  branches: Branch[];
  doctors: Doctor[];
  scheduledDoctors: ScheduledDoctor[];
  appointments: Appointment[];
  selectedBranchId: string;        // NEW
  onCreated: (a: Appointment) => void;
};

function QuickAppointmentModal({
  open,
  onClose,
  defaultDoctorId,
  defaultDate,
  defaultTime,
  branches,
  doctors,
  scheduledDoctors,
  appointments,
  selectedBranchId,  // NEW
  onCreated,
}: QuickAppointmentModalProps) {
  const [form, setForm] = useState({
  patientQuery: "",
  patientId: null as number | null,
  doctorId: defaultDoctorId ? String(defaultDoctorId) : "",
  branchId: selectedBranchId || (branches.length ? String(branches[0].id) : ""),
  date: defaultDate,
  startTime: defaultTime,
  endTime: addMinutesToTimeString(defaultTime, SLOT_MINUTES),
  status: "booked",
  notes: "",
});
  const [error, setError] = useState("");

const workingDoctors = scheduledDoctors.length
  ? scheduledDoctors
  : doctors;
  
  const [patientResults, setPatientResults] = useState<PatientLite[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);

  // time slot options
  const [popupStartSlots, setPopupStartSlots] = useState<
    { label: string; value: string }[]
  >([]);
  const [popupEndSlots, setPopupEndSlots] = useState<
    { label: string; value: string }[]
  >([]);

  // quick new patient (same as inline form but local to this modal)
  const [showQuickPatientModal, setShowQuickPatientModal] = useState(false);
  const [quickPatientForm, setQuickPatientForm] = useState<{
  ovog: string;
  name: string;
  phone: string;
  branchId: string;
  regNo: string;
  gender: string;
}>({
  ovog: "",
  name: "",
  phone: "",
  branchId: "",
  regNo: "",
  gender: "",
});
  const [quickPatientError, setQuickPatientError] = useState("");
  const [quickPatientSaving, setQuickPatientSaving] = useState(false);
  

  useEffect(() => {
  if (!open) return;
  setForm((prev) => ({
    ...prev,
    doctorId: defaultDoctorId ? String(defaultDoctorId) : "",
    branchId: selectedBranchId || prev.branchId,
    date: defaultDate,
    startTime: defaultTime,
    endTime: addMinutesToTimeString(defaultTime, SLOT_MINUTES),
    patientId: null,
    patientQuery: "",
  }));
  setError("");
  setPatientResults([]);
}, [open, defaultDoctorId, defaultDate, defaultTime, selectedBranchId]);

  useEffect(() => {
  if (!form.date) {
    setPopupStartSlots([]);
    setPopupEndSlots([]);
    return;
  }

  const [y, m, d] = form.date.split("-").map(Number);
  if (!y || !m || !d) {
    setPopupStartSlots([]);
    setPopupEndSlots([]);
    return;
  }

  const day = new Date(y, (m || 1) - 1, d || 1);

  // Build raw 30-min slots
  let slots = generateTimeSlotsForDay(day).map((s) => ({
    label: s.label,
    start: s.start,
    end: s.end,
    value: getSlotTimeString(s.start),
  }));

  // Filter by doctor schedule if doctorId is selected
  if (form.doctorId) {
    const doctorIdNum = Number(form.doctorId);
    const doc = scheduledDoctors.find((sd) => sd.id === doctorIdNum);
    const schedules = doc?.schedules || [];

    if (schedules.length > 0) {
      slots = slots.filter((slot) => {
        const tStr = getSlotTimeString(slot.start);
        return schedules.some((s: any) =>
          isTimeWithinRange(tStr, s.startTime, s.endTime)
        );
      });
    }
  }

  const startOptions = slots.map(({ label, value }) => ({ label, value }));
  const endOptions = Array.from(
    new Set(slots.map((s) => getSlotTimeString(s.end)))
  ).map((t) => ({ label: t, value: t }));

  setPopupStartSlots(startOptions);
  setPopupEndSlots(endOptions);

  if (
    form.startTime &&
    !startOptions.some((s) => s.value === form.startTime)
  ) {
    setForm((prev) => ({ ...prev, startTime: "" }));
  }
  if (form.endTime && !endOptions.some((s) => s.value === form.endTime)) {
    setForm((prev) => ({ ...prev, endTime: "" }));
  }
}, [form.date, form.doctorId, scheduledDoctors]);

  useEffect(() => {
    if (!form.branchId && branches.length > 0) {
      setForm((prev) => ({
        ...prev,
        branchId: String(branches[0].id),
      }));
    }
  }, [branches, form.branchId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "patientQuery") {
      setForm((prev) => ({ ...prev, patientQuery: value }));
      const trimmed = value.trim();
      if (!trimmed) {
        setForm((prev) => ({ ...prev, patientId: null }));
        setPatientResults([]);
        return;
      }
      triggerPatientSearch(value);
      return;
    }

    setForm((prev) => {
      if (name === "startTime") {
        const newStart = value;
        let newEnd = prev.endTime;

        if (!newEnd || newEnd <= newStart) {
          newEnd = addMinutesToTimeString(newStart, SLOT_MINUTES);
        }

        return { ...prev, startTime: newStart, endTime: newEnd };
      }

      if (name === "endTime") {
        return { ...prev, endTime: value };
      }

      return { ...prev, [name]: value };
    });
  };

  const triggerPatientSearch = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (!query) {
      setPatientResults([]);
      return;
    }

    const lower = query.toLowerCase();

    const t = setTimeout(async () => {
      try {
        setPatientSearchLoading(true);
        const url = `${API_BASE_URL}/api/patients?query=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json().catch(() => []);

        if (!res.ok) {
          setPatientResults([]);
          return;
        }

        const rawList = Array.isArray(data)
          ? data
          : Array.isArray((data as any).patients)
          ? (data as any).patients
          : [];

        const isNumeric = /^[0-9]+$/.test(lower);

        const filtered = rawList.filter((p: any) => {
          const regNo = (p.regNo ?? p.regno ?? "").toString().toLowerCase();
          const phone = (p.phone ?? "").toString().toLowerCase();
          const name = (p.name ?? "").toString().toLowerCase();
          const ovog = (p.ovog ?? "").toString().toLowerCase();
          const bookNumber = (p.patientBook?.bookNumber ?? "")
            .toString()
            .toLowerCase();

          if (isNumeric) {
            return (
              regNo.includes(lower) ||
              phone.includes(lower) ||
              bookNumber.includes(lower)
            );
          }

          return (
            regNo.includes(lower) ||
            phone.includes(lower) ||
            name.includes(lower) ||
            ovog.includes(lower) ||
            bookNumber.includes(lower)
          );
        });

        setPatientResults(
          filtered.map((p: any) => ({
            id: p.id,
            ovog: p.ovog ?? null,
            name: p.name,
            regNo: p.regNo ?? p.regno ?? "",
            phone: p.phone,
            patientBook: p.patientBook || null,
          }))
        );
      } catch (e) {
        console.error("patient search failed", e);
        setPatientResults([]);
      } finally {
        setPatientSearchLoading(false);
      }
    }, 300);

    setSearchDebounceTimer(t);
  };

  const handleSelectPatient = (p: PatientLite) => {
    setForm((prev) => ({
      ...prev,
      patientId: p.id,
      patientQuery: formatPatientSearchLabel(p),
    }));
    setPatientResults([]);
    setError("");
  };

  const handleQuickPatientChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setQuickPatientForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuickPatientSave = async () => {
    setQuickPatientError("");

    if (!quickPatientForm.name.trim() || !quickPatientForm.phone.trim()) {
      setQuickPatientError("Нэр болон утас заавал бөглөнө үү.");
      return;
    }

    const branchIdFromModal = quickPatientForm.branchId
      ? Number(quickPatientForm.branchId)
      : null;
    const branchIdFromForm = form.branchId
      ? Number(form.branchId)
      : null;

    const branchIdForPatient = !Number.isNaN(branchIdFromModal ?? NaN)
      ? branchIdFromModal
      : branchIdFromForm;

    if (!branchIdForPatient || Number.isNaN(branchIdForPatient)) {
      setQuickPatientError(
        "Шинэ үйлчлүүлэгч бүртгэхийн өмнө салбар сонгоно уу."
      );
      return;
    }

    setQuickPatientSaving(true);

    try {
      const payload: any = {
  name: quickPatientForm.name.trim(),
  phone: quickPatientForm.phone.trim(),
  branchId: branchIdForPatient,
  bookNumber: "",
};

if (quickPatientForm.ovog.trim()) {
  payload.ovog = quickPatientForm.ovog.trim();
}
if (quickPatientForm.regNo.trim()) {
  payload.regNo = quickPatientForm.regNo.trim();
}
if (quickPatientForm.gender) {
  payload.gender = quickPatientForm.gender;
}

      const res = await fetch(`${API_BASE_URL}/api/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || typeof data.id !== "number") {
        setQuickPatientError(
          (data && (data as any).error) ||
            "Шинэ үйлчлүүлэгч бүртгэх үед алдаа гарлаа."
        );
        setQuickPatientSaving(false);
        return;
      }

      const p: PatientLite = {
        id: data.id,
        name: data.name,
        ovog: data.ovog ?? null,
        regNo: data.regNo ?? "",
        phone: data.phone ?? null,
        patientBook: data.patientBook || null,
      };

      // fill into this modal's form
      setForm((prev) => ({
        ...prev,
        patientId: p.id,
        patientQuery: formatPatientSearchLabel(p),
      }));

      setQuickPatientForm({
  ovog: "",
  name: "",
  phone: "",
  branchId: "",
  regNo: "",
  gender: "",
});
      setShowQuickPatientModal(false);
    } catch (e) {
      console.error(e);
      setQuickPatientError("Сүлжээгээ шалгана уу.");
    } finally {
      setQuickPatientSaving(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (
      !form.branchId ||
      !form.date ||
      !form.startTime ||
      !form.endTime
    ) {
      setError("Салбар, огноо, эхлэх/дуусах цаг талбаруудыг бөглөнө үү.");
      return;
    }

    if (!form.patientId) {
      setError("Үйлчлүүлэгчийг жагсаалтаас сонгоно уу.");
      return;
    }

    if (!form.doctorId) {
      setError("Цаг захиалахын өмнө эмчийг заавал сонгоно уу.");
      return;
    }

    const [year, month, day] = form.date.split("-").map(Number);
    const [startHour, startMinute] = form.startTime.split(":").map(Number);
    const [endHour, endMinute] = form.endTime.split(":").map(Number);

    const start = new Date(
      year,
      (month || 1) - 1,
      day || 1,
      startHour || 0,
      startMinute || 0,
      0,
      0
    );
    const end = new Date(
      year,
      (month || 1) - 1,
      day || 1,
      endHour || 0,
      endMinute || 0,
      0,
      0
    );

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Огноо/цаг буруу байна.");
      return;
    }

    if (end <= start) {
      setError("Дуусах цаг нь эхлэх цагаас хойш байх ёстой.");
      return;
    }

    const scheduledAtStr = `${form.date}T${form.startTime}:00+08:00`;
const endAtStr = `${form.date}T${form.endTime}:00+08:00`;

    try {
      const res = await fetch(`${API_BASE_URL}/api/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          doctorId: Number(form.doctorId),
          branchId: Number(form.branchId),
          scheduledAt: scheduledAtStr,
          endAt: endAtStr,
          status: form.status,
          notes: form.notes || null,
        }),
      });
      let data: Appointment | { error?: string };
      try {
        data = await res.json();
      } catch {
        data = { error: "Unknown error" };
      }

      if (!res.ok) {
        setError((data as any).error || "Алдаа гарлаа");
        return;
      }

      onCreated(data as Appointment);
      onClose();
    } catch {
      setError("Сүлжээгээ шалгана уу");
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 55,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "95vw",
          maxHeight: "90vh",
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
          <h3 style={{ margin: 0, fontSize: 15 }}>Шинэ цаг захиалах</h3>
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

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          {/* Patient */}
<div
  style={{
    gridColumn: "1 / -1",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  }}
>
  <label>Үйлчлүүлэгч</label>
  <div style={{ display: "flex", gap: 6 }}>
    <input
      name="patientQuery"
      placeholder="РД, овог, нэр эсвэл утас..."
      value={form.patientQuery}
      onChange={handleChange}
      autoComplete="off"
      style={{
        flex: 1,
        borderRadius: 6,
        border: "1px solid #d1d5db",
        padding: "6px 8px",
      }}
    />
    <button
      type="button"
      onClick={() => {
        setShowQuickPatientModal(true);
        setQuickPatientError("");
        setQuickPatientForm((prev) => ({
          ...prev,
          branchId: prev.branchId || form.branchId,
        }));
      }}
      style={{
        padding: "0 10px",
        borderRadius: 6,
        border: "1px solid #16a34a",
        background: "#dcfce7",
        color: "#166534",
        fontWeight: 600,
        cursor: "pointer",
      }}
      title="Шинэ үйлчлэгч хурдан бүртгэх"
    >
      +
    </button>
  </div>
  {patientSearchLoading && (
    <span style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
      Үйлчлүүлэгч хайж байна...
    </span>
  )}
</div>

          {patientResults.length > 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {patientResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPatient(p)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 8px",
                    border: "none",
                    borderBottom: "1px solid #f3f4f6",
                    background: "white",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {formatPatientSearchLabel(p)}
                </button>
              ))}
            </div>
          )}

          {/* Date */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Огноо</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
          </div>

          {/* Branch */}
          

          {/* Start time */}
<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
  <label>Эхлэх цаг</label>
  <select
    name="startTime"
    value={form.startTime}
    onChange={handleChange}
    required
    style={{
      borderRadius: 6,
      border: "1px solid #d1d5db",
      padding: "6px 8px",
    }}
  >
    <option value="">Эхлэх цаг сонгох</option>
    {popupStartSlots.map((slot) => (
      <option key={slot.value} value={slot.value}>
        {slot.label}
      </option>
    ))}
  </select>
</div>

{/* End time */}
<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
  <label>Дуусах цаг</label>
  <select
    name="endTime"
    value={form.endTime}
    onChange={handleChange}
    required
    style={{
      borderRadius: 6,
      border: "1px solid #d1d5db",
      padding: "6px 8px",
    }}
  >
    <option value="">Дуусах цаг сонгох</option>
    {popupEndSlots.map((slot) => (
      <option key={slot.value} value={slot.value}>
        {slot.label}
      </option>
    ))}
  </select>
</div>

          {/* Status */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Төлөв</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="booked">Захиалсан</option>
<option value="confirmed">Баталгаажсан</option>
<option value="online">Онлайн</option>
<option value="ongoing">Явагдаж байна</option>
<option value="ready_to_pay">Төлбөр төлөх</option>
<option value="completed">Дууссан</option>
<option value="no_show">Ирээгүй</option>
<option value="cancelled">Цуцалсан</option>
<option value="other">Бусад</option>
            </select>
          </div>

          {/* Notes */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              gridColumn: "1 / -1",
            }}
          >
            <label>Тэмдэглэл</label>
            <input
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Ж: Эмчилгээний товч тэмдэглэл"
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
          </div>

          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 4,
            }}
          >
            {error && (
              <div
                style={{
                  color: "#b91c1c",
                  fontSize: 12,
                  alignSelf: "center",
                  marginRight: "auto",
                }}
              >
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                cursor: "pointer",
              }}
            >
              Болих
            </button>
            <button
              type="submit"
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: "#2563eb",
                color: "white",
                cursor: "pointer",
              }}
            >
              Хадгалах
            </button>
          </div>

                        {/* Quick new patient modal */}
      {showQuickPatientModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: 16,
              width: 340,
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              fontSize: 13,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
              Шинэ үйлчлүүлэгч хурдан бүртгэх
            </h3>
            <p
              style={{
                marginTop: 0,
                marginBottom: 12,
                color: "#6b7280",
              }}
            >
              Нэр, утас болон салбар талбарууд заавал бөглөнө. Овог, РД, хүйс
              талбаруудыг бөглөж өгвөл дараа нь &quot;Үйлчлүүлэгчийн бүртгэл&quot;
              хэсэгт дахин оруулах шаардлагагүй.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* Овог (optional) */}
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                Овог
                <input
                  name="ovog"
                  value={quickPatientForm.ovog}
                  onChange={handleQuickPatientChange}
                  placeholder="Ж: Бат"
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                />
              </label>

              {/* Нэр (required) */}
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                Нэр
                <input
                  name="name"
                  value={quickPatientForm.name}
                  onChange={handleQuickPatientChange}
                  placeholder="Ж: Болд"
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                />
              </label>

              {/* Утас (required) */}
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                Утас
                <input
                  name="phone"
                  value={quickPatientForm.phone}
                  onChange={handleQuickPatientChange}
                  placeholder="Ж: 99112233"
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                />
              </label>

              {/* Салбар */}
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                Салбар
                <select
                  name="branchId"
                  value={quickPatientForm.branchId}
                  onChange={handleQuickPatientChange}
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                >
                  <option value="">Сонгох</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* РД (optional) */}
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                РД
                <input
                  name="regNo"
                  value={quickPatientForm.regNo}
                  onChange={handleQuickPatientChange}
                  placeholder="Ж: УБ99112233"
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                />
              </label>

              {/* Хүйс (optional) */}
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                Хүйс
                <select
                  name="gender"
                  value={quickPatientForm.gender}
                  onChange={handleQuickPatientChange}
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                >
                  <option value="">Сонгохгүй</option>
                  <option value="эр">Эр</option>
                  <option value="эм">Эм</option>
                </select>
              </label>

              {quickPatientError && (
                <div
                  style={{
                    color: "#b91c1c",
                    fontSize: 12,
                  }}
                >
                  {quickPatientError}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!quickPatientSaving) {
                      setShowQuickPatientModal(false);
                      setQuickPatientError("");
                    }
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#f9fafb",
                    cursor: quickPatientSaving ? "default" : "pointer",
                  }}
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={handleQuickPatientSave}
                  disabled={quickPatientSaving}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "#16a34a",
                    color: "white",
                    cursor: quickPatientSaving ? "default" : "pointer",
                  }}
                >
                  {quickPatientSaving ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        
        </form>
      </div>
    </div>
  );
}

// ===== Inline AppointmentForm with start/end time =====

type AppointmentFormProps = {
  branches: Branch[];
  doctors: Doctor[];
  scheduledDoctors: ScheduledDoctor[];
  appointments: Appointment[];
  selectedDate: string;
  selectedBranchId: string;
  onCreated: (a: Appointment) => void;
  onBranchChange: (branchId: string) => void; // NEW
};

function AppointmentForm({
  branches,
  doctors,
  scheduledDoctors,
  appointments,
  selectedDate,
  selectedBranchId,
  onCreated,
  onBranchChange, // NEW
}: AppointmentFormProps) {
const todayStr = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ulaanbaatar",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

  const [form, setForm] = useState({
    patientQuery: "",
    doctorId: "",
    branchId: branches.length ? String(branches[0].id) : "",
    date: selectedDate || todayStr,
    startTime: "",
    endTime: "",
    status: "booked",
    notes: "",
  });
  const [error, setError] = useState("");

  const [patientResults, setPatientResults] = useState<PatientLite[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    null
  );
  const [searchDebounceTimer, setSearchDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);

  const [showQuickPatientModal, setShowQuickPatientModal] = useState(false);
  const [quickPatientForm, setQuickPatientForm] = useState<{
  ovog: string;
  name: string;
  phone: string;
  branchId: string;
  regNo: string;
  gender: string;
}>({
  ovog: "",
  name: "",
  phone: "",
  branchId: "",
  regNo: "",
  gender: "",
});
  const [quickPatientError, setQuickPatientError] = useState("");
  const [quickPatientSaving, setQuickPatientSaving] = useState(false);

  const [dayStartSlots, setDayStartSlots] = useState<
    { label: string; value: string }[]
  >([]);
  const [dayEndSlots, setDayEndSlots] = useState<
    { label: string; value: string }[]
  >([]);

  // keep branch in form in sync
  useEffect(() => {
    if (!form.branchId && branches.length > 0) {
      setForm((prev) => ({ ...prev, branchId: String(branches[0].id) }));
    }
  }, [branches, form.branchId]);

  useEffect(() => {
    if (selectedDate) {
      setForm((prev) => ({ ...prev, date: selectedDate }));
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedBranchId) {
      setForm((prev) => ({ ...prev, branchId: selectedBranchId }));
    }
  }, [selectedBranchId]);

  // time slots for selected date + doctor schedule
  useEffect(() => {
    if (!form.date) {
      setDayStartSlots([]);
      setDayEndSlots([]);
      return;
    }
    const [year, month, day] = form.date.split("-").map(Number);
    if (!year || !month || !day) {
      setDayStartSlots([]);
      setDayEndSlots([]);
      return;
    }
    const d = new Date(year, (month || 1) - 1, day || 1);

    let slots = generateTimeSlotsForDay(d).map((s) => ({
      label: s.label,
      start: s.start,
      end: s.end,
      value: getSlotTimeString(s.start),
    }));

    // Filter by doctor schedule if a doctor is selected
    if (form.doctorId) {
      const doctorIdNum = Number(form.doctorId);
      const doc = scheduledDoctors.find((sd) => sd.id === doctorIdNum);
      const schedules = doc?.schedules || [];
      if (schedules.length > 0) {
        slots = slots.filter((slot) => {
          const tStr = getSlotTimeString(slot.start);
          return schedules.some((s: any) =>
            isTimeWithinRange(tStr, s.startTime, s.endTime)
          );
        });
      }
    }

    const startOptions = slots.map(({ label, value }) => ({ label, value }));
    const endOptions = Array.from(
      new Set(slots.map((s) => getSlotTimeString(s.end)))
    ).map((t) => ({ label: t, value: t }));

    setDayStartSlots(startOptions);
    setDayEndSlots(endOptions);

    if (
      form.startTime &&
      !startOptions.some((s) => s.value === form.startTime)
    ) {
      setForm((prev) => ({ ...prev, startTime: "" }));
    }
    if (form.endTime && !endOptions.some((s) => s.value === form.endTime)) {
      setForm((prev) => ({ ...prev, endTime: "" }));
    }
  }, [form.date, form.doctorId, scheduledDoctors]);
// When branch changes in the form, reset dependent fields
  useEffect(() => {
    if (!form.branchId) return;

    setForm((prev) => ({
      ...prev,
      doctorId: "",
      startTime: "",
      endTime: "",
      patientQuery: "",
      notes: "",
      // keep date & status as is
    }));
    setSelectedPatientId(null);
    setPatientResults([]);
    setError("");
  }, [form.branchId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "patientQuery") {
      setForm((prev) => ({ ...prev, patientQuery: value }));

      const trimmed = value.trim();
      if (!trimmed) {
        setSelectedPatientId(null);
        setPatientResults([]);
        return;
      }
      if (trimmed === form.patientQuery.trim()) {
        return;
      }
      triggerPatientSearch(value);
      return;
    }

    setForm((prev) => {
      if (name === "startTime") {
        const newStart = value;
        let newEnd = prev.endTime;

        if (!newEnd || newEnd <= newStart) {
          newEnd = addMinutesToTimeString(newStart, SLOT_MINUTES);
        }

        return {
          ...prev,
          startTime: newStart,
          endTime: newEnd,
        };
      }

      if (name === "endTime") {
        return { ...prev, endTime: value };
      }

      return { ...prev, [name]: value };
    });
  };

  const triggerPatientSearch = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    if (!query) {
      setPatientResults([]);
      return;
    }

    const qAtSchedule = query.toLowerCase();

    const t = setTimeout(async () => {
      try {
        setPatientSearchLoading(true);

        const url = `${API_BASE_URL}/api/patients?query=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json().catch(() => []);

        if (!res.ok) {
          setPatientResults([]);
          return;
        }

        const rawList = Array.isArray(data)
          ? data
          : Array.isArray((data as any).patients)
          ? (data as any).patients
          : [];

        const isNumeric = /^[0-9]+$/.test(qAtSchedule);

        const filtered = rawList.filter((p: any) => {
          const regNo = (p.regNo ?? p.regno ?? "")
            .toString()
            .toLowerCase();
          const phone = (p.phone ?? "").toString().toLowerCase();
          const name = (p.name ?? "").toString().toLowerCase();
          const ovog = (p.ovog ?? "").toString().toLowerCase();
          const bookNumber = (p.patientBook?.bookNumber ?? "")
            .toString()
            .toLowerCase();

          if (isNumeric) {
            return (
              regNo.includes(qAtSchedule) ||
              phone.includes(qAtSchedule) ||
              bookNumber.includes(qAtSchedule)
            );
          }

          return (
            regNo.includes(qAtSchedule) ||
            phone.includes(qAtSchedule) ||
            name.includes(qAtSchedule) ||
            ovog.includes(qAtSchedule) ||
            bookNumber.includes(qAtSchedule)
          );
        });

        setPatientResults(
          filtered.map((p: any) => ({
            id: p.id,
            name: p.name,
            ovog: p.ovog ?? null,
            regNo: p.regNo ?? p.regno ?? "",
            phone: p.phone,
            patientBook: p.patientBook || null,
          }))
        );
      } catch (e) {
        console.error("patient search failed", e);
        setPatientResults([]);
      } finally {
        setPatientSearchLoading(false);
      }
    }, 300);

    setSearchDebounceTimer(t);
  };

  const handleSelectPatient = (p: PatientLite) => {
    setSelectedPatientId(p.id);
    setForm((prev) => ({
      ...prev,
      patientQuery: formatPatientSearchLabel(p),
    }));
    setPatientResults([]);
    setError("");
  };

  const getDoctorSchedulesForDate = () => {
    if (!form.doctorId) return [];
    const doctorIdNum = Number(form.doctorId);
    const doc = scheduledDoctors.find((d) => d.id === doctorIdNum);
    if (!doc || !doc.schedules) return [];
    return doc.schedules;
  };

  const isWithinDoctorSchedule = (scheduledAt: Date) => {
    const schedules = getDoctorSchedulesForDate();
    if (schedules.length === 0) return true;
    const timeStr = getSlotTimeString(scheduledAt);
    return schedules.some((s: any) =>
      isTimeWithinRange(timeStr, s.startTime, s.endTime)
    );
  };

  const countAppointmentsInSlot = (slotStartDate: Date) => {
    if (!form.doctorId) return 0;
    const doctorIdNum = Number(form.doctorId);

    const slotStart = new Date(slotStartDate);
    const slotEnd = new Date(
      slotStart.getTime() + SLOT_MINUTES * 60 * 1000
    );

    return appointments.filter((a) => {
      if (a.doctorId !== doctorIdNum) return false;
      if (selectedBranchId && String(a.branchId) !== selectedBranchId)
        return false;

      // Ignore cancelled appointments in capacity calculation
      if (a.status === "cancelled") return false;

      const start = new Date(a.scheduledAt);
      if (Number.isNaN(start.getTime())) return false;

      const end =
        a.endAt && !Number.isNaN(new Date(a.endAt).getTime())
          ? new Date(a.endAt)
          : new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);

     const dayStr = getAppointmentDayKey(a);
if (dayStr !== form.date) return false;

      return start < slotEnd && end > slotStart;
    }).length;
  };

  const handleQuickPatientChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setQuickPatientForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuickPatientSave = async () => {
    setQuickPatientError("");

    if (!quickPatientForm.name.trim() || !quickPatientForm.phone.trim()) {
      setQuickPatientError("Нэр болон утас заавал бөглөнө үү.");
      return;
    }

    const branchIdFromModal = quickPatientForm.branchId
      ? Number(quickPatientForm.branchId)
      : null;
    const branchIdFromForm = form.branchId
      ? Number(form.branchId)
      : selectedBranchId
      ? Number(selectedBranchId)
      : null;

    const branchIdForPatient = !Number.isNaN(branchIdFromModal ?? NaN)
      ? branchIdFromModal
      : branchIdFromForm;

    if (!branchIdForPatient || Number.isNaN(branchIdForPatient)) {
      setQuickPatientError(
        "Шинэ үйлчлүүлэгч бүртгэхийн өмнө салбар сонгоно уу."
      );
      return;
    }

    setQuickPatientSaving(true);

    try {
      const payload: any = {
  name: quickPatientForm.name.trim(),
  phone: quickPatientForm.phone.trim(),
  branchId: branchIdForPatient,
  bookNumber: "",
};

if (quickPatientForm.ovog.trim()) {
  payload.ovog = quickPatientForm.ovog.trim();
}
if (quickPatientForm.regNo.trim()) {
  payload.regNo = quickPatientForm.regNo.trim();
}
if (quickPatientForm.gender) {
  payload.gender = quickPatientForm.gender;
}

      const res = await fetch(`${API_BASE_URL}/api/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || typeof data.id !== "number") {
        setQuickPatientError(
          (data && (data as any).error) ||
            "Шинэ үйлчлүүлэгч бүртгэх үед алдаа гарлаа."
        );
        setQuickPatientSaving(false);
        return;
      }

      const p: PatientLite = {
        id: data.id,
        name: data.name,
        ovog: data.ovog ?? null,
        regNo: data.regNo ?? "",
        phone: data.phone ?? null,
        patientBook: data.patientBook || null,
      };

      setSelectedPatientId(p.id);
      setForm((prev) => ({
        ...prev,
        patientQuery: formatPatientSearchLabel(p),
      }));

      setQuickPatientForm({
  ovog: "",
  name: "",
  phone: "",
  branchId: "",
  regNo: "",
  gender: "",
});
      setShowQuickPatientModal(false);
    } catch (e) {
      console.error(e);
      setQuickPatientError("Сүлжээгээ шалгана уу.");
    } finally {
      setQuickPatientSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.branchId || !form.date || !form.startTime || !form.endTime) {
      setError("Салбар, огноо, эхлэх/дуусах цаг талбаруудыг бөглөнө үү.");
      return;
    }

    if (!selectedPatientId) {
      setError(
        "Үйлчлүүлэгчийг жагсаалтаас сонгох эсвэл + товчоор шинээр бүртгэнэ үү."
      );
      return;
    }

    if (!form.doctorId) {
      setError("Цаг захиалахын өмнө эмчийг заавал сонгоно уу.");
      return;
    }

    const [year, month, day] = form.date.split("-").map(Number);
    const [startHour, startMinute] = form.startTime.split(":").map(Number);
    const [endHour, endMinute] = form.endTime.split(":").map(Number);

    const start = new Date(
      year,
      (month || 1) - 1,
      day || 1,
      startHour || 0,
      startMinute || 0,
      0,
      0
    );
    const end = new Date(
      year,
      (month || 1) - 1,
      day || 1,
      endHour || 0,
      endMinute || 0,
      0,
      0
    );

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Огноо/цаг буруу байна.");
      return;
    }

    if (end <= start) {
      setError("Дуусах цаг нь эхлэх цагаас хойш байх ёстой.");
      return;
    }

   const scheduledAtStr = `${form.date}T${form.startTime}:00+08:00`;
const endAtStr = `${form.date}T${form.endTime}:00+08:00`;
    const scheduledAt = start;

    const patientId = selectedPatientId;

    if (!isWithinDoctorSchedule(scheduledAt)) {
      setError("Сонгосон цагт эмчийн ажлын хуваарь байхгүй байна.");
      return;
    }

    let currentBlockStart = new Date(scheduledAt);
    while (currentBlockStart < end) {
      const existingCount = countAppointmentsInSlot(currentBlockStart);
      if (existingCount >= 2) {
        setError(
          "Сонгосон хугацааны зарим 30 минутын блок дээр аль хэдийн 2 захиалга байна."
        );
        return;
      }
      currentBlockStart = new Date(
        currentBlockStart.getTime() + SLOT_MINUTES * 60 * 1000
      );
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          doctorId: Number(form.doctorId),
          branchId: Number(form.branchId),
          scheduledAt: scheduledAtStr,
          endAt: endAtStr,
          status: form.status,
          notes: form.notes || null,
        }),
      });
      let data: Appointment | { error?: string };
      try {
        data = await res.json();
      } catch {
        data = { error: "Unknown error" };
      }

      if (res.ok) {
        onCreated(data as Appointment);
        setForm((prev) => ({
          ...prev,
          patientQuery: "",
          startTime: "",
          endTime: "",
          notes: "",
          status: "booked",
          doctorId: "",
        }));
        setSelectedPatientId(null);
        setPatientResults([]);
      } else {
        setError((data as any).error || "Алдаа гарлаа");
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    }
  };

  // BRANCH + DATE AWARE DOCTOR LIST
  const workingDoctors = useMemo(() => {
    if (scheduledDoctors.length > 0) {
      const branchIdForFilter = form.branchId || selectedBranchId || "";
      const dateForFilter = form.date;

      if (!branchIdForFilter || !dateForFilter) return scheduledDoctors;

      const branchNum = Number(branchIdForFilter);
      if (Number.isNaN(branchNum)) return scheduledDoctors;

      const filtered = scheduledDoctors.filter((sd) =>
        (sd.schedules || []).some(
          (s) => s.branchId === branchNum && scheduleDayKey(s.date) === dateForFilter
        )
      );

      return filtered.length ? filtered : scheduledDoctors;
    }

    // fallback – no schedule data
    return doctors;
  }, [scheduledDoctors, doctors, form.branchId, form.date, selectedBranchId]);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginBottom: 24,
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        fontSize: 13,
      }}
    >
      {/* Branch – FIRST */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Салбар</label>
        <select
          name="branchId"
          value={form.branchId}
          onChange={(e) => {
            handleChange(e);
            setError("");
            onBranchChange(e.target.value);
          }}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Салбар сонгох</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Patient */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          gridColumn: "1 / -1",
        }}
      >
        <label>Үйлчлүүлэгч</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            name="patientQuery"
            placeholder="РД, овог, нэр эсвэл утас..."
            value={form.patientQuery}
            onChange={handleChange}
            autoComplete="off"
            style={{
              flex: 1,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "6px 8px",
            }}
          />
          <button
            type="button"
            onClick={() => {
              setShowQuickPatientModal(true);
              setQuickPatientError("");
              setQuickPatientForm((prev) => ({
                ...prev,
                branchId: prev.branchId || form.branchId || selectedBranchId,
              }));
            }}
            style={{
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid #16a34a",
              background: "#dcfce7",
              color: "#166534",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Шинэ үйлчлэгч хурдан бүртгэх"
          >
            +
          </button>
        </div>
        {patientSearchLoading && (
          <span style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            Үйлчлүүлэгч хайж байна...
          </span>
        )}
      </div>

      {patientResults.length > 0 && (
        <div
          style={{
            gridColumn: "1 / -1",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {patientResults.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPatient(p)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 8px",
                border: "none",
                borderBottom: "1px solid #f3f4f6",
                background: "white",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {formatPatientSearchLabel(p)}
            </button>
          ))}
        </div>
      )}

      {/* Doctor */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Эмч (заавал)</label>
        <select
          name="doctorId"
          value={form.doctorId}
          onChange={(e) => {
            handleChange(e);
            setError("");
          }}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Ажиллах эмч сонгох</option>
          {workingDoctors.map((d) => (
            <option key={d.id} value={d.id}>
              {formatDoctorName(d)}
            </option>
          ))}
        </select>
        {scheduledDoctors.length === 0 && (
          <span style={{ fontSize: 11, color: "#b91c1c", marginTop: 2 }}>
            Энэ өдөр сонгосон салбарт эмчийн ажлын хуваарь олдсонгүй.
          </span>
        )}
      </div>

      {/* Date */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Огноо</label>
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={(e) => {
            handleChange(e);
            setError("");
          }}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      {/* Start time */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Эхлэх цаг</label>
        <select
          name="startTime"
          value={form.startTime}
          onChange={(e) => {
            handleChange(e);
            setError("");
          }}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Эхлэх цаг сонгох</option>
          {dayStartSlots.map((slot) => (
            <option key={slot.value} value={slot.value}>
              {slot.label}
            </option>
          ))}
        </select>
      </div>

      {/* End time */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Дуусах цаг</label>
        <select
          name="endTime"
          value={form.endTime}
          onChange={(e) => {
            handleChange(e);
            setError("");
          }}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Дуусах цаг сонгох</option>
          {dayEndSlots.map((slot) => (
            <option key={slot.value} value={slot.value}>
              {slot.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Төлөв</label>
        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="booked">Захиалсан</option>
<option value="confirmed">Баталгаажсан</option>
<option value="online">Онлайн</option>
<option value="ongoing">Явагдаж байна</option>
<option value="ready_to_pay">Төлбөр төлөх</option>
<option value="completed">Дууссан</option>
<option value="no_show">Ирээгүй</option>
<option value="cancelled">Цуцалсан</option>
<option value="other">Бусад</option>
        </select>
      </div>

      {/* Notes */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          gridColumn: "1 / -1",
        }}
      >
        <label>Тэмдэглэл</label>
        <input
          name="notes"
          placeholder="Ж: Эмчилгээний товч тэмдэглэл"
          value={form.notes}
          onChange={handleChange}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      {/* Submit + error */}
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Цаг захиалах
        </button>
        {error && (
          <div style={{ color: "#b91c1c", fontSize: 12, alignSelf: "center" }}>
            {error}
          </div>
        )}
      </div>

      {/* Quick new patient modal */}
      {showQuickPatientModal && (
        /* ... keep your existing quick patient modal as-is ... */
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: 16,
              width: 340,
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              fontSize: 13,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
              Шинэ үйлчлүүлэгч хурдан бүртгэх
            </h3>
            <p
              style={{
                marginTop: 0,
                marginBottom: 12,
                color: "#6b7280",
              }}
            >
              Зөвхөн нэр, утас болон салбарыг бүртгэнэ. Дэлгэрэнгүй мэдээллийг
              дараа нь &quot;Үйлчлүүлэгчийн бүртгэл&quot; хэсгээс засварлана.
            </p>
            <div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 8,
  }}
>
  {/* Овог (optional) */}
  <label
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}
  >
    Овог
    <input
      name="ovog"
      value={quickPatientForm.ovog}
      onChange={handleQuickPatientChange}
      placeholder="Ж: Бат"
      style={{
        borderRadius: 6,
        border: "1px solid #d1d5db",
        padding: "6px 8px",
      }}
    />
  </label>

  {/* Нэр (required) */}
  <label
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}
  >
    Нэр
    <input
      name="name"
      value={quickPatientForm.name}
      onChange={handleQuickPatientChange}
      placeholder="Ж: Болд"
      style={{
        borderRadius: 6,
        border: "1px solid #d1d5db",
        padding: "6px 8px",
      }}
    />
  </label>

  {/* Утас (required) */}
  <label
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}
  >
    Утас
    <input
      name="phone"
      value={quickPatientForm.phone}
      onChange={handleQuickPatientChange}
      placeholder="Ж: 99112233"
      style={{
        borderRadius: 6,
        border: "1px solid #d1d5db",
        padding: "6px 8px",
      }}
    />
  </label>

  {/* Салбар (required – already enforced in logic) */}
  <label
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}
  >
    Салбар
    <select
      name="branchId"
      value={quickPatientForm.branchId}
      onChange={handleQuickPatientChange}
      style={{
        borderRadius: 6,
        border: "1px solid #d1d5db",
        padding: "6px 8px",
      }}
    >
      <option value="">Сонгох</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  </label>

  {/* РД (optional) */}
  <label
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}
  >
    РД
    <input
      name="regNo"
      value={quickPatientForm.regNo}
      onChange={handleQuickPatientChange}
      placeholder="Ж: УБ99112233"
      style={{
        borderRadius: 6,
        border: "1px solid #d1d5db",
        padding: "6px 8px",
      }}
    />
  </label>

  {/* Хүйс (optional) */}
  <label
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}
  >
    Хүйс
    <select
      name="gender"
      value={quickPatientForm.gender}
      onChange={handleQuickPatientChange}
      style={{
        borderRadius: 6,
        border: "1px solid #d1d5db",
        padding: "6px 8px",
      }}
    >
      <option value="">Сонгохгүй</option>
      <option value="эр">Эр</option>
      <option value="эм">Эм</option>
    </select>
  </label>

  {quickPatientError && (
    <div
      style={{
        color: "#b91c1c",
        fontSize: 12,
      }}
    >
      {quickPatientError}
    </div>
  )}

       
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!quickPatientSaving) {
                      setShowQuickPatientModal(false);
                      setQuickPatientError("");
                    }
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#f9fafb",
                    cursor: quickPatientSaving ? "default" : "pointer",
                  }}
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={handleQuickPatientSave}
                  disabled={quickPatientSaving}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "#16a34a",
                    color: "white",
                    cursor: quickPatientSaving ? "default" : "pointer",
                  }}
                >
                  {quickPatientSaving ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

// ==== Page ====

export default function AppointmentsPage() {
  const router = useRouter();

  // branchId from URL: /appointments?branchId=1
  const branchIdFromQuery =
    typeof router.query.branchId === "string" ? router.query.branchId : "";

  const todayStr = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ulaanbaatar",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

  const [branches, setBranches] = useState<Branch[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [scheduledDoctors, setScheduledDoctors] = useState<ScheduledDoctor[]>(
    []
  );
  const [error, setError] = useState("");
const [nowPosition, setNowPosition] = useState<number | null>(null);
const [hasMounted, setHasMounted] = useState(false);

// NEW: per‑day revenue
const [dailyRevenue, setDailyRevenue] = useState<number | null>(null);

  // filters
const workingDoctorsForFilter = scheduledDoctors.length
  ? scheduledDoctors
  : doctors;
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterBranchId, setFilterBranchId] = useState<string>(
    branchIdFromQuery || ""
  );
  const [filterDoctorId, setFilterDoctorId] = useState<string>("");

  // top pills
  const [activeBranchTab, setActiveBranchTab] = useState<string>(
    branchIdFromQuery || ""
  );

  const formSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // keep state in sync when URL branchId changes (from left menu)
  useEffect(() => {
    if (branchIdFromQuery && branchIdFromQuery !== filterBranchId) {
      setFilterBranchId(branchIdFromQuery);
      setActiveBranchTab(branchIdFromQuery);
    }
    if (!branchIdFromQuery && filterBranchId !== "") {
      setFilterBranchId("");
      setActiveBranchTab("");
    }
  }, [branchIdFromQuery, filterBranchId]);

  // ---- load meta (branches, doctors) ----
  useEffect(() => {
    async function loadMeta() {
      try {
        setError("");
        const [branchesRes, doctorsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/branches`),
          fetch(`${API_BASE_URL}/api/doctors`),
        ]);
        const branchesData = await branchesRes.json().catch(() => []);
        const doctorsData = await doctorsRes.json().catch(() => []);
        setBranches(branchesData || []);
        setDoctors(doctorsData || []);
      } catch (e) {
        console.error(e);
        setError("Мета мэдээлэл ачаалж чадсангүй.");
      }
    }
    loadMeta();
  }, []);

  // ---- load appointments ----
  const loadAppointments = useCallback(async () => {
    try {
      setError("");
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterBranchId) params.set("branchId", filterBranchId);
      if (filterDoctorId) params.set("doctorId", filterDoctorId);

      const res = await fetch(`${API_BASE_URL}/api/appointments?${params.toString()}`);
      const data = await res.json().catch(() => []);
      if (!res.ok || !Array.isArray(data)) {
        throw new Error("failed");
      }
      setAppointments(data);
    } catch (e) {
      console.error(e);
      setError("Цаг захиалгуудыг ачаалах үед алдаа гарлаа.");
    }
  }, [filterDate, filterBranchId, filterDoctorId]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // ---- load scheduled doctors ----
  const loadScheduledDoctors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterBranchId) params.set("branchId", filterBranchId);
      if (filterDate) params.set("date", filterDate);

      const res = await fetch(`${API_BASE_URL}/api/doctors/scheduled?${params.toString()}`);
      const data = await res.json().catch(() => []);
      if (!res.ok || !Array.isArray(data)) return;
      setScheduledDoctors(data);
    } catch (e) {
      console.error(e);
    }
  }, [filterBranchId, filterDate]);

  useEffect(() => {
    loadScheduledDoctors();
  }, [loadScheduledDoctors]);

  // grid helpers
  const selectedDay = useMemo(() => getDateFromYMD(filterDate), [filterDate]);
  const timeSlots = useMemo(
    () => generateTimeSlotsForDay(selectedDay),
    [selectedDay]
  );
const gridStartMinutes = minutesFromHHMM(timeSlots[0]?.label || "09:00");
const gridEndMinutes =
  minutesFromHHMM(timeSlots[timeSlots.length - 1]?.label || "21:00") +
  SLOT_MINUTES;
const gridTotalMinutes = Math.max(1, gridEndMinutes - gridStartMinutes);
  
  const firstSlot = timeSlots[0]?.start ?? selectedDay;
  const lastSlot = timeSlots[timeSlots.length - 1]?.end ?? selectedDay;
  const totalMinutes =
    (lastSlot.getTime() - firstSlot.getTime()) / 60000 || 1;
  const columnHeightPx = 60 * (totalMinutes / 60);

// ---- Load daily revenue for selected date + branch ----
useEffect(() => {
  const loadRevenue = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterBranchId) params.set("branchId", filterBranchId);

      const res = await fetch(`${API_BASE_URL}/api/reports/daily-revenue?${params.toString()}`);
      if (!res.ok) {
        setDailyRevenue(null);
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data || typeof data.total !== "number") {
        setDailyRevenue(null);
        return;
      }
      setDailyRevenue(data.total);
    } catch {
      setDailyRevenue(null);
    }
  };

  loadRevenue();
}, [filterDate, filterBranchId]);
  
  // current time line - Mongolia time aware, minute-based positioning
  useEffect(() => {
    const updateNow = () => {
      const now = new Date();
      const todayInMongolia = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ulaanbaatar",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      
      // Only show red line if filterDate is today in Mongolia
      if (todayInMongolia !== filterDate) {
        setNowPosition(null);
        return;
      }

      // Get current time in Mongolia as minutes since midnight
      const nowFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ulaanbaatar",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const nowTimeStr = nowFormatter.format(now); // "HH:MM"
      const nowMinutes = minutesFromHHMM(nowTimeStr);

      // Check if current time is within the visible grid
      if (nowMinutes < gridStartMinutes || nowMinutes >= gridEndMinutes) {
        setNowPosition(null);
        return;
      }

      // Calculate position based on minute-based grid
      const minutesFromGridStart = nowMinutes - gridStartMinutes;
      const pos = (minutesFromGridStart / gridTotalMinutes) * columnHeightPx;
      setNowPosition(pos);
    };

    updateNow();
    const id = setInterval(updateNow, 60_000);
    return () => clearInterval(id);
  }, [filterDate, gridStartMinutes, gridEndMinutes, gridTotalMinutes, columnHeightPx]);

  // gridDoctors with fallback
  const gridDoctors: ScheduledDoctor[] = useMemo(() => {
  const sortFn = (a: ScheduledDoctor, b: ScheduledDoctor) => {
    const ao = a.calendarOrder ?? 0;
    const bo = b.calendarOrder ?? 0;
    if (ao !== bo) return ao - bo;
    return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
  };

  if (scheduledDoctors.length > 0) {
    return [...scheduledDoctors].sort(sortFn);
  }

  const dayKey = filterDate;
  const byDoctor: Record<number, ScheduledDoctor> = {};

  for (const a of appointments) {
    if (!a.doctorId) continue;
    if (getAppointmentDayKey(a) !== dayKey) continue;

    if (!byDoctor[a.doctorId]) {
      const baseDoc = doctors.find((d) => d.id === a.doctorId);
      if (!baseDoc) continue;
      byDoctor[a.doctorId] = { ...baseDoc, schedules: [] };
    }
  }

  return Object.values(byDoctor).sort(sortFn);
}, [scheduledDoctors, appointments, doctors, filterDate]);

  // lane map
  const laneById: Record<number, 0 | 1> = useMemo(() => {
    const map: Record<number, 0 | 1> = {};
    const dayKey = filterDate;

    const byDoctor: Record<number, Appointment[]> = {};
    for (const a of appointments) {
      if (!a.doctorId) continue;
      if (getAppointmentDayKey(a) !== dayKey) continue;
      if (!byDoctor[a.doctorId]) byDoctor[a.doctorId] = [];
      byDoctor[a.doctorId].push(a);
    }

    for (const list of Object.values(byDoctor)) {
      const lanes = computeAppointmentLanesForDayAndDoctor(list);
      for (const [idStr, lane] of Object.entries(lanes)) {
        map[Number(idStr)] = lane;
      }
    }

    return map;
  }, [appointments, filterDate]);

// ---- Daily stats (for selected date & branch) ----
const dayKey = filterDate;

// All appointments for this day (and branch, if selected)
const dayAppointments = useMemo(
  () =>
    appointments.filter((a) => {
      const scheduled = a.scheduledAt;
      if (!scheduled) return false;
      const key = scheduled.slice(0, 10);
      if (key !== dayKey) return false;
      if (filterBranchId && String(a.branchId) !== filterBranchId) return false;
      return true;
    }),
  [appointments, dayKey, filterBranchId]
);

// 1) Нийт цаг захиалга – all appointments for the day
const totalAppointmentsForDay = dayAppointments.length;

// 2) Хуваарьт эмчийн тоо – unique doctors who have schedule or appointments that day
const totalScheduledDoctorsForDay = useMemo(() => {
  const ids = new Set<number>();

  // from scheduledDoctors list (already filtered by date & branch in your loader)
  scheduledDoctors.forEach((d) => ids.add(d.id));

  // fallback: if no scheduledDoctors were loaded, derive from appointments
  if (ids.size === 0) {
    dayAppointments.forEach((a) => {
      if (a.doctorId != null) ids.add(a.doctorId);
    });
  }

  return ids.size;
}, [scheduledDoctors, dayAppointments]);

// 3) Үйлчлүүлэгчдийн тоо – unique patients with completed appointments that day
const totalCompletedPatientsForDay = useMemo(() => {
  const ids = new Set<number>();
  dayAppointments.forEach((a) => {
    if (a.status === "completed" && a.patientId != null) {
      ids.add(a.patientId);
    }
  });
  return ids.size;
}, [dayAppointments]);
  
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
    date: filterDate,
    time: "09:00",
  });

  const handleBranchTabClick = (branchId: string) => {
    setActiveBranchTab(branchId);
    setFilterBranchId(branchId);

    const query = branchId ? { branchId } : {};
    router.push(
      { pathname: "/appointments", query },
      undefined,
      { shallow: true }
    );
  };

  const getStatusColor = (status: string): string => {
  switch (status) {
    case "completed":
      return "#fb6190";
    case "confirmed":
      return "#bbf7d0";
    case "online":
      return "#a78bfa"; // purple-ish
    case "ongoing":
      return "#9d9d9d";
    case "ready_to_pay":
      return "#facc15";
    case "no_show":
      return "#ef4444"; // red
    case "cancelled":
      return "#1889fc";
    case "other":
      return "#94a3b8"; // slate
    default:
      return "#77f9fe";
  }
};

 return (
  <main
    style={{
      maxWidth: 1100,
      margin: "16px auto",
      padding: 24,
      fontFamily: "sans-serif",
    }}
  >
<h1 style={{ fontSize: 20, margin: "4px 0 8px" }}>Цаг захиалга</h1>
<p style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
  Эмч, үйлчлүүлэгч, салбарын цаг захиалгыг харах болон удирдах хэсэг
</p>

{/* NEW: Daily stats cards (colored) */}
<section
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
    marginBottom: 16,
  }}
>
  {/* Нийт цаг захиалга */}
  <div
    style={{
      background: "linear-gradient(90deg,#eff6ff,#ffffff)",
      borderRadius: 12,
      border: "1px solid #dbeafe",
      boxShadow: "0 8px 16px rgba(15,23,42,0.06)",
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          color: "#1d4ed8",
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        Нийт цаг захиалга
      </div>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "999px",
          background:
            "radial-gradient(circle at 30% 30%,#bfdbfe,#1d4ed8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 16,
        }}
      >
        📅
      </div>
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color: "#111827" }}>
      {totalAppointmentsForDay}
    </div>
    <div style={{ fontSize: 11, color: "#6b7280" }}>
      {formatDateYmdDots(selectedDay)} өдрийн нийт цаг захиалга
    </div>
  </div>

  {/* Хуваарьт эмчийн тоо */}
  <div
    style={{
      background: "linear-gradient(90deg,#fef9c3,#ffffff)",
      borderRadius: 12,
      border: "1px solid #facc15",
      boxShadow: "0 8px 16px rgba(15,23,42,0.06)",
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          color: "#b45309",
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        Хуваарьт эмчийн тоо
      </div>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "999px",
          background:
            "radial-gradient(circle at 30% 30%,#fde68a,#f59e0b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 16,
        }}
      >
        🩺
      </div>
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color: "#111827" }}>
      {totalScheduledDoctorsForDay}
    </div>
    <div style={{ fontSize: 11, color: "#6b7280" }}>
      Сонгосон өдөрт ажиллаж буй эмч
    </div>
  </div>

  {/* Үйлчлүүлэгчдийн тоо (completed) */}
  <div
    style={{
      background: "linear-gradient(90deg,#fee2e2,#ffffff)",
      borderRadius: 12,
      border: "1px solid #fecaca",
      boxShadow: "0 8px 16px rgba(15,23,42,0.06)",
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          color: "#b91c1c",
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        Үйлчлүүлэгчдийн тоо
      </div>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "999px",
          background:
            "radial-gradient(circle at 30% 30%,#fecaca,#ef4444)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 16,
        }}
      >
        🧍
      </div>
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color: "#111827" }}>
      {totalCompletedPatientsForDay}
    </div>
    <div style={{ fontSize: 11, color: "#6b7280" }}>
      {formatDateYmdDots(selectedDay)} өдөр &quot;Дууссан&quot; төлөвтэй
      үйлчлүүлэгч
    </div>
  </div>

  {/* Борлуулалтын орлого */}
  <div
    style={{
      background: "linear-gradient(90deg,#dcfce7,#ffffff)",
      borderRadius: 12,
      border: "1px solid #bbf7d0",
      boxShadow: "0 8px 16px rgba(15,23,42,0.06)",
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          color: "#15803d",
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        Борлуулалтын орлого
      </div>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "999px",
          background:
            "radial-gradient(circle at 30% 30%,#bbf7d0,#22c55e)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 16,
        }}
      >
        💰
      </div>
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color: "#111827" }}>
      {dailyRevenue == null
        ? "—"
        : dailyRevenue.toLocaleString("mn-MN") + " ₮"}
    </div>
    <div style={{ fontSize: 11, color: "#6b7280" }}>
      Сонгосон өдрийн нийт борлуулалтын орлого
    </div>
  </div>
</section>
     

      {/* Filters card */}
      <section
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
          fontSize: 13,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
          Шүүлт
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Огноо</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Салбар</label>
            <select
  value={filterBranchId}
  onChange={(e) => {
    const value = e.target.value;
    setFilterBranchId(value);
    setActiveBranchTab(value);

    const query = value ? { branchId: value } : {};
    router.push(
      { pathname: "/appointments", query },
      undefined,
      { shallow: true }
    );
  }}
  style={{
    borderRadius: 6,
    border: "1px solid #d1d5db",
    padding: "6px 8px",
  }}
>
  <option value="">Бүх салбар</option>
  {branches.map((b) => (
    <option key={b.id} value={b.id}>
      {b.name}
    </option>
  ))}
</select>
          </div>
        </div>
      </section>

     

            {/* Time grid by doctor */}
     <section style={{ marginBottom: 24 }}>
  <h2 style={{ fontSize: 16, marginBottom: 4 }}>
    Өдрийн цагийн хүснэгт
  </h2>
  <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>
    {formatDateYmdDots(selectedDay)}
  </div>

  {!hasMounted ? (
    <div style={{ color: "#6b7280", fontSize: 13 }}>
      Цагийн хүснэгтийг ачаалж байна...
    </div>
  ) : timeSlots.length === 0 ? (
    <div style={{ color: "#6b7280", fontSize: 13 }}>
      Энэ өдөрт цагийн интервал тодорхойлогдоогүй байна.
    </div>
  ) : gridDoctors.length === 0 ? (
    <div style={{ color: "#6b7280", fontSize: 13 }}>
      Энэ өдөр ажиллах эмчийн хуваарь алга.
    </div>
  ) : (
        <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        fontSize: 12,
        overflowX: "auto",   // allow horizontal scroll when many doctors
        overflowY: "visible", // full vertical view, no scrolling/clipping
      }}
    >
            {/* Header row */}
                        <div
              style={{
                display: "grid",
                gridTemplateColumns: `80px repeat(${gridDoctors.length}, 180px)`,
                backgroundColor: "#f5f5f5",
                borderBottom: "1px solid #ddd",
                minWidth: 80 + gridDoctors.length * 180, // ensure horizontal scroll
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
                      borderLeft: "1px solid #ddd",
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

            {/* Body: time labels + doctor columns */}
                       <div
              style={{
                display: "grid",
                gridTemplateColumns: `80px repeat(${gridDoctors.length}, 180px)`,
              }}
            >
              {/* CURRENT TIME LINE */}
              {nowPosition !== null && (
                <div
                  style={{
                    gridColumn: `1 / span ${gridDoctors.length + 1}`,
                    position: "relative",
                    height: 0,
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: nowPosition,
                      borderTop: "2px dashed #ef4444",
                      zIndex: 5,
                    }}
                  />
                </div>
              )}

{/* Time labels / background grid */}
<div
  style={{
    borderRight: "1px solid #ddd",
    position: "relative",
    height: columnHeightPx,
  }}
>
  {timeSlots.map((slot, index) => {
    const slotStartMin = minutesFromHHMM(slot.label) - gridStartMinutes; // 0, 30, 60...
    const slotHeight = (SLOT_MINUTES / gridTotalMinutes) * columnHeightPx;

    return (
      <div
        key={index}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: (slotStartMin / gridTotalMinutes) * columnHeightPx,
          height: slotHeight,
          borderBottom: "1px solid #f0f0f0",
          paddingLeft: 6,
          display: "flex",
          alignItems: "center",
          fontSize: 11,
          backgroundColor: index % 2 === 0 ? "#fafafa" : "#ffffff",
        }}
      >
        {slot.label}
      </div>
    );
  })}
</div>

              {/* Doctor columns */}
{gridDoctors.map((doc) => {
  const doctorAppointments = appointments.filter(
    (a) =>
      a.doctorId === doc.id &&
      getAppointmentDayKey(a) === filterDate &&
      a.status !== "cancelled"
  );

  const handleCellClick = (clickedMinutesFromGridStart: number, existingApps: Appointment[]) => {
    // clickedMinutesFromGridStart is 0,30,60...
    const slotMinutesAbs = gridStartMinutes + clickedMinutesFromGridStart;
    const slotHH = Math.floor(slotMinutesAbs / 60);
    const slotMM = slotMinutesAbs % 60;
    const slotTimeStr = `${pad2(slotHH)}:${pad2(slotMM)}`;

    const validApps = existingApps.filter(
      (a) => a.doctorId === doc.id && getAppointmentDayKey(a) === filterDate
    );

    if (validApps.length === 2) {
      setDetailsModalState({
        open: true,
        doctor: doc,
        slotLabel: slotTimeStr,
        slotTime: slotTimeStr,
        date: filterDate,
        appointments: validApps,
      });
    } else {
      setQuickModalState({
        open: true,
        doctorId: doc.id,
        date: filterDate,
        time: slotTimeStr,
      });
    }
  };

  // Overlap detection should be based on clinic minutes (not Date)
  const overlapsWithOther: Record<number, boolean> = {};
  for (let i = 0; i < doctorAppointments.length; i++) {
    const a = doctorAppointments[i];
    const aStart = minutesFromClinicIso(a.scheduledAt);
    const aEnd = a.endAt ? minutesFromClinicIso(a.endAt) : aStart + SLOT_MINUTES;

    overlapsWithOther[a.id] = false;

    for (let j = 0; j < doctorAppointments.length; j++) {
      if (i === j) continue;
      const b = doctorAppointments[j];
      const bStart = minutesFromClinicIso(b.scheduledAt);
      const bEnd = b.endAt ? minutesFromClinicIso(b.endAt) : bStart + SLOT_MINUTES;

      if (aStart < bEnd && aEnd > bStart) {
        overlapsWithOther[a.id] = true;
        break;
      }
    }
  }

  return (
    <div
      key={doc.id}
      style={{
        borderLeft: "1px solid #f0f0f0",
        position: "relative",
        height: columnHeightPx,
        backgroundColor: "#ffffff",
      }}
    >
      {/* background stripes & click areas */}
      {timeSlots.map((slot, index) => {
        // minutes from grid start: 0,30,60...
        const clickedMinutesFromGridStart = minutesFromHHMM(slot.label) - gridStartMinutes;

        const slotHeight = (SLOT_MINUTES / gridTotalMinutes) * columnHeightPx;

        // Use slot.label (HH:MM) which is deterministic in your generator
        const slotTimeStr = slot.label;

        const schedules = (doc as any).schedules || [];
        const isWorkingHour = schedules.some((s: any) =>
          isTimeWithinRange(slotTimeStr, s.startTime, s.endTime)
        );

        const weekdayIndex = slot.start.getDay();
        const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;
        const isWeekendLunch =
          isWeekend && isTimeWithinRange(slotTimeStr, "14:00", "15:00");

        const isNonWorking = !isWorkingHour || isWeekendLunch;

        // find apps overlapping this 30-min cell using minutes
        const cellStartAbs = gridStartMinutes + clickedMinutesFromGridStart;
        const cellEndAbs = cellStartAbs + SLOT_MINUTES;

        const appsInThisSlot = doctorAppointments.filter((a) => {
          const aStart = minutesFromClinicIso(a.scheduledAt);
          const aEnd = a.endAt ? minutesFromClinicIso(a.endAt) : aStart + SLOT_MINUTES;
          return aStart < cellEndAbs && aEnd > cellStartAbs;
        });

        return (
          <div
            key={index}
            onClick={() =>
              isNonWorking ? undefined : handleCellClick(clickedMinutesFromGridStart, appsInThisSlot)
            }
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: (clickedMinutesFromGridStart / gridTotalMinutes) * columnHeightPx,
              height: slotHeight,
              borderBottom: "1px solid #f0f0f0",
              backgroundColor: isNonWorking
                ? "#ffc26b"
                : index % 2 === 0
                ? "#ffffff"
                : "#fafafa",
              cursor: isNonWorking ? "not-allowed" : "pointer",
            }}
          />
        );
      })}

      {/* Appointment blocks */}
      {doctorAppointments.map((a) => {
        const startMinAbs = minutesFromClinicIso(a.scheduledAt);
        const endMinAbs = a.endAt ? minutesFromClinicIso(a.endAt) : startMinAbs + SLOT_MINUTES;

        // clamp to visible grid window
        const clampedStartAbs = Math.max(startMinAbs, gridStartMinutes);
        const clampedEndAbs = Math.min(endMinAbs, gridEndMinutes);

        // outside visible grid -> don't render
        if (clampedEndAbs <= gridStartMinutes || clampedStartAbs >= gridEndMinutes) {
          return null;
        }

        const top =
          ((clampedStartAbs - gridStartMinutes) / gridTotalMinutes) * columnHeightPx;
        const height =
          ((clampedEndAbs - clampedStartAbs) / gridTotalMinutes) * columnHeightPx;

        const lane = laneById[a.id] ?? 0;
        const hasOverlap = overlapsWithOther[a.id];

        const widthPercent = hasOverlap ? 50 : 100;
        const leftPercent = hasOverlap ? (lane === 0 ? 0 : 50) : 0;

        return (
          <div
            key={a.id}
            onClick={(e) => {
              e.stopPropagation();
              setDetailsModalState({
                open: true,
                doctor: doc,
                slotLabel: "",
                slotTime: "",
                date: filterDate,
                appointments: [a],
              });
            }}
            style={{
              position: "absolute",
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              top,
              height: Math.max(height, 18),
              padding: "1px 3px",
              boxSizing: "border-box",
              backgroundColor: getStatusColor(a.status),
              borderRadius: 4,
              border: "1px solid rgba(0,0,0,0.08)",
              fontSize: 11,
              lineHeight: 1.2,
              color:
                a.status === "completed" || a.status === "cancelled"
                  ? "#ffffff"
                  : "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              overflow: "hidden",
              wordBreak: "break-word",
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              cursor: "pointer",
            }}
            title={`${formatPatientLabel(a.patient, a.patientId)} (${formatStatus(a.status)})`}
          >
            {`${formatGridShortLabel(a)} (${formatStatus(a.status)})`}
          </div>
        );
      })}
    </div>
  );
})}
            </div>
          </div>
        )}
      </section>

     {/* Create form card */}
      <section
        ref={formSectionRef as any}
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "white",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
          Шинэ цаг захиалах
        </h2>
        <AppointmentForm
          branches={branches}
          doctors={doctors}
          scheduledDoctors={scheduledDoctors}
          appointments={appointments}
          selectedDate={filterDate}
          selectedBranchId={filterBranchId}
          onCreated={(a) => setAppointments((prev) => [a, ...prev])}
        onBranchChange={(branchId) => {
      // mirror to top filter + grid
      setFilterBranchId(branchId);
      setActiveBranchTab(branchId);

      const query = branchId ? { branchId } : {};
      router.push(
        { pathname: "/appointments", query },
        undefined,
        { shallow: true }
      );
    }}
  />
      </section>

      {error && (
        <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}
      {/* Day-grouped calendar (unchanged from your original) */}
      {/* ... and the raw table + modals, same as before ... */}
      {/* Keep your existing bottom sections exactly as they were. */}

     <AppointmentDetailsModal
        open={detailsModalState.open}
        onClose={() =>
          setDetailsModalState((prev) => ({ ...prev, open: false }))
        }
        doctor={detailsModalState.doctor}
        slotLabel={detailsModalState.slotLabel}
        slotTime={detailsModalState.slotTime}
        date={detailsModalState.date}
        appointments={detailsModalState.appointments}
        onStatusUpdated={(updated) => {
          setAppointments((prev) =>
            prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
          );
          setDetailsModalState((prev) => ({
            ...prev,
            appointments: prev.appointments.map((a) =>
              a.id === updated.id ? { ...a, ...updated } : a
            ),
          }));
        }}
      />

      <QuickAppointmentModal
        open={quickModalState.open}
        onClose={() =>
          setQuickModalState((prev) => ({ ...prev, open: false }))
        }
        defaultDoctorId={quickModalState.doctorId}
        defaultDate={quickModalState.date}
        defaultTime={quickModalState.time}
        branches={branches}
        doctors={doctors}
        scheduledDoctors={scheduledDoctors}
        appointments={appointments}
        selectedBranchId={filterBranchId}
        onCreated={(a) => setAppointments((prev) => [a, ...prev])}
      />
    </main>
  
  );
}

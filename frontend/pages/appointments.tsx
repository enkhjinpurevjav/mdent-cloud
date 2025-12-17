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

// Only show text in the first 30‑min slot of an appointment
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
  // first slot that starts at or after scheduledAt, within one slot
  return diffMinutes >= 0 && diffMinutes < slotMinutes;
}
// Show text in the "middle" 30‑minute slot of the appointment
// Show text in the "middle" 30‑minute slot of the appointment,
// based on slot indices instead of exact time rounding.
// Show text in the "middle" 30‑minute slot of the appointment,
// but for even slot counts (like 60min = 2 slots) use the LOWER middle,
// so the text is not visually hugging the bottom.
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

  // slot index for appointment start and current slot
  const slotsPerHour = 60 / slotMinutes; // 2 when slotMinutes = 30
  const apptStartIndex =
    start.getHours() * slotsPerHour + Math.floor(start.getMinutes() / slotMinutes);
  const slotIndex =
    slotStart.getHours() * slotsPerHour + Math.floor(slotStart.getMinutes() / slotMinutes);

  const slotCount = Math.max(1, Math.ceil(durationMinutes / slotMinutes));

  // Middle slot index:
  //  - For odd slotCount (1,3,5) → exact middle
  //  - For even slotCount (2,4,6) → LOWER middle
  //
  // Examples with 30min slots:
  //  - 60min (2 slots): offsets 0,1 → lower-middle offset = 0 → first slot
  //  - 90min (3 slots): offsets 0,1,2 → middle offset = 1 → middle slot
  //  - 120min (4 slots): offsets 0,1,2,3 → lower-middle offset = 1
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

  // Build display name like "Э.Маргад" if ovog exists, otherwise just name
  let displayName = name;
  if (ovog && name) {
    displayName = `${ovog.charAt(0).toUpperCase()}.${name}`;
  }

  const book = p.patientBook?.bookNumber
    ? ` • Карт: ${p.patientBook.bookNumber}`
    : "";

  return `${displayName}${book}`;
}

function formatGridShortLabel(a: Appointment): string {
  const p = a.patient;
  const ovog = (p?.ovog || "").trim();
  const name = (p?.name || "").trim();

  let displayName = name || `#${a.patientId}`;
  if (ovog && name) {
    displayName = `${ovog.charAt(0).toUpperCase()}.${name}`;
  }

  return displayName;
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

// ==== Quick Appointment Modal (with start/end, default 30min) ====

type QuickAppointmentModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDoctorId?: number;
  defaultDate: string; // YYYY-MM-DD
  defaultTime: string; // HH:MM
  branches: Branch[];
  doctors: Doctor[];
  appointments: Appointment[];
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
  appointments,
  onCreated,
}: QuickAppointmentModalProps) {
  const [form, setForm] = useState({
    patientQuery: "",
    patientId: null as number | null,
    doctorId: defaultDoctorId ? String(defaultDoctorId) : "",
    branchId: branches.length ? String(branches[0].id) : "",
    date: defaultDate,
    startTime: defaultTime,
    endTime: addMinutesToTimeString(defaultTime, SLOT_MINUTES), // default +30min
    status: "booked",
    notes: "",
  });
  const [error, setError] = useState("");
  const [patientResults, setPatientResults] = useState<PatientLite[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);

  // 30-min slots for popup date
  const [popupSlots, setPopupSlots] = useState<
    { label: string; value: string }[]
  >([]);

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      doctorId: defaultDoctorId ? String(defaultDoctorId) : "",
      date: defaultDate,
      startTime: defaultTime,
      endTime: addMinutesToTimeString(defaultTime, SLOT_MINUTES),
      patientId: null,
      patientQuery: "",
    }));
    setError("");
    setPatientResults([]);
  }, [open, defaultDoctorId, defaultDate, defaultTime]);

  useEffect(() => {
    if (!form.date) {
      setPopupSlots([]);
      return;
    }
    const [y, m, d] = form.date.split("-").map(Number);
    if (!y || !m || !d) {
      setPopupSlots([]);
      return;
    }
    const day = new Date(y, (m || 1) - 1, d || 1);
    const slots = generateTimeSlotsForDay(day).map((s) => ({
      label: s.label,
      value: getSlotTimeString(s.start),
    }));
    setPopupSlots(slots);
  }, [form.date]);

  useEffect(() => {
    // Prefer currently selected branch if exists; otherwise default to first branch
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

        // if no end yet, or end <= start → auto 30min
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
        const url = `/api/patients?query=${encodeURIComponent(query)}`;
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
    setForm((prev) => ({
      ...prev,
      patientId: p.id,
      patientQuery: formatPatientSearchLabel(p),
    }));
    setPatientResults([]);
    setError("");
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

    const scheduledAtStr = start.toISOString();
    const endAtStr = end.toISOString();

    try {
      const res = await fetch("/api/appointments", {
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
            <input
              name="patientQuery"
              placeholder="РД, овог, нэр эсвэл утас..."
              value={form.patientQuery}
              onChange={handleChange}
              autoComplete="off"
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
            {patientSearchLoading && (
              <span
                style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}
              >
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
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Салбар</label>
            <select
              name="branchId"
              value={form.branchId}
              onChange={handleChange}
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
              {popupSlots.map((slot) => (
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
              {popupSlots.map((slot) => (
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
              <option value="ongoing">Явагдаж байна</option>
              <option value="completed">Дууссан</option>
              <option value="cancelled">Цуцалсан</option>
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
};

function AppointmentForm({
  branches,
  doctors,
  scheduledDoctors,
  appointments,
  selectedDate,
  selectedBranchId,
  onCreated,
}: AppointmentFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

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
    name: string;
    phone: string;
    branchId: string;
  }>({
    name: "",
    phone: "",
    branchId: "",
  });
  const [quickPatientError, setQuickPatientError] = useState("");
  const [quickPatientSaving, setQuickPatientSaving] = useState(false);

  const [daySlots, setDaySlots] = useState<{ label: string; value: string }[]>(
    []
  );

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

  useEffect(() => {
    if (!form.date) {
      setDaySlots([]);
      return;
    }
    const [year, month, day] = form.date.split("-").map(Number);
    if (!year || !month || !day) {
      setDaySlots([]);
      return;
    }
    const d = new Date(year, (month || 1) - 1, day || 1);
    let slots = generateTimeSlotsForDay(d).map((s) => ({
      label: s.label,
      value: getSlotTimeString(s.start),
      start: s.start,
    }));

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

    setDaySlots(slots.map(({ label, value }) => ({ label, value })));

    if (form.startTime && !slots.some((s) => s.value === form.startTime)) {
      setForm((prev) => ({ ...prev, startTime: "" }));
    }
    if (form.endTime && !slots.some((s) => s.value === form.endTime)) {
      setForm((prev) => ({ ...prev, endTime: "" }));
    }
  }, [form.date, form.doctorId, scheduledDoctors]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Patient search
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

    // Other fields
    setForm((prev) => {
      if (name === "startTime") {
        const newStart = value;
        let newEnd = prev.endTime;

        // If no end yet or end <= start → auto 30 min
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

        const url = `/api/patients?query=${encodeURIComponent(query)}`;
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
    console.log("DEBUG handleSelectPatient clicked id =", p.id);
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

  // Count existing appointments overlapping a 30min slot
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

      const start = new Date(a.scheduledAt);
      if (Number.isNaN(start.getTime())) return false;

      const end =
        a.endAt && !Number.isNaN(new Date(a.endAt).getTime())
          ? new Date(a.endAt)
          : new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);

      const dayStr = start.toISOString().slice(0, 10);
      if (dayStr !== form.date) return false;

      // overlap: start < slotEnd && end > slotStart
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
      const payload = {
        name: quickPatientForm.name.trim(),
        phone: quickPatientForm.phone.trim(),
        branchId: branchIdForPatient,
        bookNumber: "",
      };

      const res = await fetch("/api/patients", {
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

      setQuickPatientForm({ name: "", phone: "", branchId: "" });
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

    console.log("DEBUG inline selectedPatientId =", selectedPatientId);
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
    const [startHour, startMinute] = form.startTime
      .split(":")
      .map(Number);
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

    const scheduledAtStr = start.toISOString();
    const endAtStr = end.toISOString();
    const scheduledAt = start;

    const patientId = selectedPatientId;

    if (!isWithinDoctorSchedule(scheduledAt)) {
      setError("Сонгосон цагт эмчийн ажлын хуваарь байхгүй байна.");
      return;
    }

    // Check each 30-min block for max 2 appointments
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
      const res = await fetch("/api/appointments", {
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

  const availableDoctors = scheduledDoctors.length
    ? doctors.filter((d) => scheduledDoctors.some((s) => s.id === d.id))
    : doctors;

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
            border: "1px солид #e5e7eb",
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
          {availableDoctors.map((d) => (
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

      {/* Branch */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Салбар</label>
        <select
          name="branchId"
          value={form.branchId}
          onChange={handleChange}
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
            border: "1px солид #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Эхлэх цаг сонгох</option>
          {daySlots.map((slot) => (
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
            border: "1px солид #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Дуусах цаг сонгох</option>
          {daySlots.map((slot) => (
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
            border: "1px солид #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="booked">Захиалсан</option>
          <option value="confirmed">Баталгаажсан</option>
          <option value="ongoing">Явагдаж байна</option>
          <option value="completed">Дууссан</option>
          <option value="cancelled">Цуцалсан</option>
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
            border: "1px солид #d1d5db",
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
                  placeholder="Ж: Батболд"
                  style={{
                    borderRadius: 6,
                    border: "1px солид #d1d5db",
                    padding: "6px 8px",
                  }}
                />
              </label>
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
                    border: "1px солид #d1d5db",
                    padding: "6px 8px",
                  }}
                />
              </label>
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
                    border: "1px солид #d1d5db",
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
                    border: "1px солид #d1d5db",
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
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Цаг захиалга</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Өвчтөн, эмч, салбарын цаг захиалгуудыг харах, нэмэх, удирдах.
      </p>

      {/* Branch view tabs */}
      <section
        style={{
          marginBottom: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 8,
        }}
      >
        <button
          type="button"
          onClick={() => handleBranchTabClick("")}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid transparent",
            backgroundColor: activeBranchTab === "" ? "#2563eb" : "transparent",
            color: activeBranchTab === "" ? "#ffffff" : "#374151",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Бүх салбар
        </button>
        {branches.map((b) => {
          const idStr = String(b.id);
          const isActive = activeBranchTab === idStr;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => handleBranchTabClick(idStr)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: isActive ? "1px solid #2563eb" : "1px solid #d1d5db",
                backgroundColor: isActive ? "#eff6ff" : "#ffffff",
                color: isActive ? "#1d4ed8" : "#374151",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {b.name}
            </button>
          );
        })}
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
          Шүүлтүүр
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

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Эмч</label>
            <select
              value={filterDoctorId}
              onChange={(e) => setFilterDoctorId(e.target.value)}
              style={{
                borderRadius: 6,
                border: "1px солид #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="">Бүх эмч</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDoctorName(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Create form card */}
      <section
        ref={formSectionRef as any}
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 8,
          border: "1px солид #e5e7eb",
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
        />
      </section>

      {error && (
        <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Time grid by doctor with “first-slot-only” labels (text not repeated on lower cells) */}
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
      minHeight: 48, // was implicit ~28 via cell; now taller rows
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
                      bg = "#ee7148"; // non-working
                    } else if (appsForCell.length === 0) {
                      bg = "#ffffff"; // empty working slot
                    } else {
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

                    // Helper: does appointment overlap this slot?
                    const slotStart = slot.start;
                    const slotEnd = slot.end;
                    const appCoversSlot = (a: Appointment | null) => {
                      if (!a) return false;
                      const start = new Date(a.scheduledAt);
                      if (Number.isNaN(start.getTime())) return false;
                      const end =
                        a.endAt &&
                        !Number.isNaN(new Date(a.endAt).getTime())
                          ? new Date(a.endAt)
                          : new Date(
                              start.getTime() + SLOT_MINUTES * 60 * 1000
                            );
                      return start < slotEnd && end > slotStart;
                    };

                    const laneBg = (a: Appointment | null): string => {
                      if (!a) return "transparent";
                      switch (a.status) {
                        case "completed":
                          return "#fb6190";
                        case "confirmed":
                          return "#bbf7d0";
                        case "ongoing":
                          return "#f9d89b";
                        case "cancelled":
                          return "#9d9d9d";
                        default:
                          return "#77f9fe";
                      }
                    };

                    // 0 or 1 app: render full cell
                    if (appsForCell.length <= 1) {
                      const a = appsForCell[0] || null;
                      const visible = appCoversSlot(a);

                      return (
                        <div
                          key={doc.id}
                          onClick={handleCellClick}
                          style={{
                            borderLeft: "1px солид #f0f0f0",
                            backgroundColor: bg,
                            cursor: isNonWorking ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 28,
                            padding: visible ? "1px 3px" : 0,
                          }}
                          title={
                            visible && a
                              ? `${formatPatientLabel(
                                  a.patient,
                                  a.patientId
                                )} (${formatStatus(a.status)})`
                              : ""
                          }
                        >
                          {visible && a && (
                            <span
  style={{
    backgroundColor: laneBg(a),
    borderRadius: 4,
    padding: "1px 4px",
    maxWidth: "100%",
    whiteSpace: "normal",          // allow wrapping
    wordBreak: "break-word",       // break long words if needed
    overflowWrap: "anywhere",
    fontSize: 11,
    lineHeight: 1.2,
    textAlign: "center",
  }}
>
  {`${formatGridShortLabel(a)} (${formatStatus(a.status)})`}
</span>
                          )}
                        </div>
                      );
                    }

                    // 2+ apps: use first 2 as left/right lanes
                    const leftApp = appsForCell[0] || null;
                    const rightApp = appsForCell[1] || null;
                    const leftVisible = appCoversSlot(leftApp);
                    const rightVisible = appCoversSlot(rightApp);

                    return (
                      <div
                        key={doc.id}
                        onClick={handleCellClick}
                        style={{
                          borderLeft: "1px солид #f0f0f0",
                          backgroundColor: bg,
                          cursor: isNonWorking ? "not-allowed" : "pointer",
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "stretch",
                          minHeight: 28,
                          padding: 0,
                        }}
                      >
                        {/* LEFT HALF */}
                        <div
  style={{
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: leftVisible ? "1px 3px" : 0,
    backgroundColor: leftVisible ? laneBg(leftApp) : "transparent",
    whiteSpace: "normal",        // allow wrapping
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    fontSize: 11,
    lineHeight: 1.2,
    textAlign: "center",
  }}
>
  {leftVisible && leftApp &&
    `${formatGridShortLabel(leftApp)} (${formatStatus(
      leftApp.status
    )})`}
</div>

                        {/* RIGHT HALF */}
<div
  style={{
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: rightVisible ? "1px 3px" : 0,
    backgroundColor: rightVisible ? laneBg(rightApp) : "transparent",
    whiteSpace: "normal",        // allow wrapping
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    fontSize: 11,
    lineHeight: 1.2,
    textAlign: "center",
  }}
>
  {rightVisible && rightApp &&
    `${formatGridShortLabel(rightApp)} (${formatStatus(
      rightApp.status
    )})`}
</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Day-grouped calendar */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Календарь (өдрөөр)</h2>
        {groupedAppointments.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Цаг захиалга алга.
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 16,
            overflowX: "auto",
            paddingBottom: 8,
            justifyContent: "flex-start",
          }}
        >
          {groupedAppointments.map(([date, apps]) => (
            <div
              key={date}
              style={{
                minWidth: 260,
                maxWidth: 320,
                border: "1px солид #e5e7eb",
                borderRadius: 8,
                padding: 10,
                backgroundColor: "#ffffff",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 8,
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                {formatDateYmdDots(new Date(date))}
              </div>
              {apps
                .slice()
                .sort(
                  (a, b) =>
                    new Date(a.scheduledAt).getTime() -
                    new Date(b.scheduledAt).getTime()
                )
                .map((a) => {
                  const start = new Date(a.scheduledAt);
                  const end =
                    a.endAt &&
                    !Number.isNaN(new Date(a.endAt).getTime())
                      ? new Date(a.endAt)
                      : null;

                  return (
                    <div
                      key={a.id}
                      style={{
                        marginBottom: 6,
                        padding: 6,
                        borderRadius: 4,
                        backgroundColor:
                          a.status === "completed"
                            ? "#e0f7e9"
                            : a.status === "ongoing"
                            ? "#fff4e0"
                            : a.status === "cancelled"
                            ? "#fde0e0"
                            : "#e6f0ff",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>
                        {start.toLocaleTimeString("mn-MN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                        {end
                          ? ` – ${end.toLocaleTimeString("mn-MN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}`
                          : ""}
                        {" — "}
                        {formatPatientLabel(a.patient, a.patientId)}
                      </div>
                      <div>
                        Эмч: {formatDoctorName(a.doctor)} | Салбар:{" "}
                        {a.branch?.name ?? a.branchId}
                      </div>
                      <div>Тайлбар: {a.notes || "-"}</div>
                      <div>Төлөв: {formatStatus(a.status)}</div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </section>

      {/* Raw table */}
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>
          Бүгдийг жагсаалтаар харах
        </h2>
        {appointments.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Цаг захиалга алга.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 4,
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px солид #ddd",
                    padding: 6,
                  }}
                >
                  ID
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px солид #ddd",
                    padding: 6,
                  }}
                >
                  Өвчтөн
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px солид #ddd",
                    padding: 6,
                  }}
                >
                  Салбар
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px солид #ddd",
                    padding: 6,
                  }}
                >
                  Эмч
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px солид #ddd",
                    padding: 6,
                  }}
                >
                  Огноо / цаг
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px солид #ddd",
                    padding: 6,
                  }}
                >
                  Төлөв
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px солид #ddd",
                    padding: 6,
                  }}
                >
                  Тэмдэглэл
                </th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => {
                const start = new Date(a.scheduledAt);
                const end =
                  a.endAt && !Number.isNaN(new Date(a.endAt).getTime())
                    ? new Date(a.endAt)
                    : null;

                return (
                  <tr key={a.id}>
                    <td
                      style={{
                        borderBottom: "1px солид #f0f0f0",
                        padding: 6,
                      }}
                    >
                      {a.id}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px солид #f0f0f0",
                        padding: 6,
                      }}
                    >
                      {formatPatientLabel(a.patient, a.patientId)}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px солид #f0f0f0",
                        padding: 6,
                      }}
                    >
                      {a.branch?.name ?? a.branchId}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px солид #f0f0f0",
                        padding: 6,
                      }}
                    >
                      {formatDoctorName(a.doctor ?? null)}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px солид #f0f0f0",
                        padding: 6,
                      }}
                    >
                      {formatDateYmdDots(start)}{" "}
                      {start.toLocaleTimeString("mn-MN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                      {end
                        ? ` – ${end.toLocaleTimeString("mn-MN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}`
                        : ""}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px солид #f0f0f0",
                        padding: 6,
                      }}
                    >
                      {formatStatus(a.status)}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px солид #f0f0f0",
                        padding: 6,
                      }}
                    >
                      {a.notes || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Modals */}
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
        appointments={appointments}
        onCreated={(a) => setAppointments((prev) => [a, ...prev])}
      />
    </main>
  );
}

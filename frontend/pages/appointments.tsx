// Clean, stable version: inline form works like before, quick popup always requires choosing patient inside the popup.
// No shared patient state between inline form and popup → avoids "Үйлчлүүлэгчийг жагсаалтаас сонгоно уу." bugs.

import React, { useEffect, useState } from "react";

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
    startTime: string;
    endTime: string;
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
  scheduledAt: string;
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
    const day = d.toISOString().slice(0, 10);
    if (!map[day]) map[day] = [];
    map[day].push(a);
  }
  const entries = Object.entries(map).sort(([d1], [d2]) =>
    d1 < d2 ? -1 : d1 > d2 ? 1 : 0
  );
  return entries;
}

const START_HOUR = 9;
const END_HOUR = 21;
const SLOT_MINUTES = 30;

const WEEKEND_START_HOUR = 10;
const WEEKEND_END_HOUR = 19;

type TimeSlot = {
  label: string;
  start: Date;
  end: Date;
};

function generateTimeSlotsForDay(day: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const weekdayIndex = day.getDay();
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
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function isTimeWithinRange(time: string, startTime: string, endTime: string) {
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
  const book = p.patientBook?.bookNumber
    ? ` • Карт: ${p.patientBook.bookNumber}`
    : "";
  return `${p.name}${book}`;
}

function formatPatientSearchLabel(p: PatientLite): string {
  const ovog = (p.ovog || "").trim();
  const name = (p.name || "").trim();
  const phone = (p.phone || "").trim();
  const regNo = (p.regNo || "").trim();
  const parts: string[] = [];

  if (ovог || name) {
    parts.push([ovог, name].filter(Boolean).join(" "));
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
  slotTime?: string;
  date?: string;
  appointments: Appointment[];
};

function AppointmentDetailsModal({
  open,
  onClose,
  doctor,
  slotLabel,
  slotTime,
  date,
  appointments,
}: AppointmentDetailsModalProps) {
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
          <h3 style={{ margin: 0, fontSize: 15 }}>Цагийн дэлгэрэнгүй</h3>
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
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 8, color: "#4b5563" }}>
          <div>
            <strong>Огноо:</strong>{" "}
            {date
              ? new Date(date).toLocaleDateString("mn-MN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  weekday: "short",
                })
              : "-"}
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
            {appointments.map((a) => (
              <div
                key={a.id}
                style={{
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  padding: 8,
                  background: "#f9fafb",
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: 2 }}>
                  {formatPatientLabel(a.patient, a.patientId)}
                </div>
                <div style={{ color: "#4b5563" }}>
                  <strong>Төлөв:</strong> {formatStatus(a.status)}
                </div>
                <div style={{ color: "#4b5563" }}>
                  <strong>Салбар:</strong> {a.branch?.name ?? a.branchId}
                </div>
                <div style={{ color: "#4b5563" }}>
                  <strong>Цаг (нарийвчилсан):</strong>{" "}
                  {new Date(a.scheduledAt).toLocaleString("mn-MN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </div>
                <div style={{ color: "#4b5563" }}>
                  <strong>Тэмдэглэл:</strong> {a.notes || "-"}
                </div>
                <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>
                  ID: {a.id}
                </div>
              </div>
            ))}
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

// ==== Quick Appointment Modal (independent patient selection) ====

type QuickAppointmentModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDoctorId?: number;
  defaultDate: string;
  defaultTime: string;
  branches: Branch[];
  doctors: Doctor[];
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
  onCreated,
}: QuickAppointmentModalProps) {
  const [form, setForm] = useState({
    patientQuery: "",
    patientId: null as number | null,
    doctorId: defaultDoctorId ? String(defaultDoctorId) : "",
    branchId: branches.length ? String(branches[0].id) : "",
    date: defaultDate,
    time: defaultTime,
    status: "booked",
    notes: "",
  });
  const [error, setError] = useState("");
  const [patientResults, setPatientResults] = useState<PatientLite[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      doctorId: defaultDoctorId ? String(defaultDoctorId) : "",
      date: defaultDate,
      time: defaultTime,
      patientId: null,
      patientQuery: "",
    }));
    setError("");
    setPatientResults([]);
  }, [open, defaultDoctorId, defaultDate, defaultTime]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === "patientQuery") {
      // clear local selection if field is cleared
      if (!value.trim()) {
        setForm((prev) => ({ ...prev, patientId: null }));
        setPatientResults([]);
        return;
      }
      triggerPatientSearch(value);
    }
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

    if (!form.branchId || !form.date || !form.time) {
      setError("Салбар, огноо, цаг талбаруудыг бөглөнө үү.");
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
    const [hour, minute] = form.time.split(":").map(Number);

    const local = new Date(
      year,
      (month || 1) - 1,
      day || 1,
      hour || 0,
      minute || 0,
      0,
      0
    );
    if (Number.isNaN(local.getTime())) {
      setError("Огноо/цаг буруу байна.");
      return;
    }
    const scheduledAtStr = local.toISOString();

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          doctorId: Number(form.doctorId),
          branchId: Number(form.branchId),
          scheduledAt: scheduledAtStr,
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

          {/* Doctor */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Эмч</label>
            <select
              name="doctorId"
              value={form.doctorId}
              onChange={handleChange}
              required
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="">Эмч сонгох</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDoctorName(d)}
                </option>
              ))}
            </select>
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

          {/* Time */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Цаг</label>
            <input
              type="time"
              name="time"
              value={form.time}
              onChange={handleChange}
              required
              step={SLOT_MINUTES * 60}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
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

// ==== Inline AppointmentForm (original-style) ====
// (unchanged from your latest version, it already compiles)

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
  // ... keep your existing AppointmentForm implementation from your last message ...
  // (no syntax errors there; only QuickAppointmentModal needed fixing)
  // To keep this answer short, do NOT duplicate that section again.
  // Just keep exactly what you pasted for AppointmentForm and below.
  return null as any;
}

// ==== Page ====

export default function AppointmentsPage() {
  // ... keep your existing AppointmentsPage implementation from your last message ...
  return null as any;
}

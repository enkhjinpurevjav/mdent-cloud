"use client";

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
};

type Appointment = {
  id: number;
  patientId: number;
  doctorId: number | null;
  branchId: number;
  scheduledAt: string; // "YYYY-MM-DD HH:MM:SS" local
  endAt?: string | null; // same format or null
  status: string;
  notes: string | null;
  patient?: PatientLite;
  doctor?: Doctor | null;
  branch?: Branch | null;
};

// ========= time helpers =========

const START_HOUR = 9;
const END_HOUR = 21;
const SLOT_MINUTES = 30;

type TimeSlot = {
  label: string; // "09:00"
  start: Date;
  end: Date;
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function getSlotTimeString(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function generateTimeSlotsForDay(day: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const weekdayIndex = day.getDay(); // 0=Sun,6=Sat
  const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;

  const startHour = isWeekend ? 10 : START_HOUR;
  const endHour = isWeekend ? 19 : END_HOUR;

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

function getAppointmentStartIndex(
  daySlots: TimeSlot[],
  a: Appointment
): number | null {
  const start = new Date(a.scheduledAt);
  if (Number.isNaN(start.getTime())) return null;
  for (let i = 0; i < daySlots.length; i++) {
    const s = daySlots[i];
    if (start >= s.start && start < s.end) return i;
  }
  return null;
}

// ========= formatting helpers =========

function formatDateYmdDots(date: Date): string {
  return date.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

function formatGridShortLabel(a: Appointment): string {
  const p = a.patient;
  const ovog = (p?.ovog || "").trim();
  const name = (p?.name || "").trim();
  let displayName = name || `#${a.patientId}`;
  if (ovog && name) displayName = `${ovog.charAt(0).toUpperCase()}.${name}`;
  return displayName;
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

function laneBg(a: Appointment): string {
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
}

// ========= local datetime helper (OPTION A) =========

// dateStr: "2025-12-18", timeStr: "15:30" -> "2025-12-18 15:30:00"
function buildLocalDateTimeString(dateStr: string, timeStr: string): string {
  return `${dateStr} ${timeStr}:00`;
}

// ========= AppointmentForm (inline) =========

type AppointmentFormProps = {
  branches: Branch[];
  doctors: Doctor[];
  selectedDate: string;
  selectedBranchId: string;
  onCreated: (a: Appointment) => void;
};

function AppointmentForm({
  branches,
  doctors,
  selectedDate,
  selectedBranchId,
  onCreated,
}: AppointmentFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    branchId: selectedBranchId || (branches[0]?.id?.toString() ?? ""),
    date: selectedDate || todayStr,
    startTime: "",
    endTime: "",
    status: "booked",
    notes: "",
  });

  const [error, setError] = useState("");

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (
      !form.patientId ||
      !form.doctorId ||
      !form.branchId ||
      !form.date ||
      !form.startTime ||
      !form.endTime
    ) {
      setError("Бүх шаардлагатай талбаруудыг бөглөнө үү.");
      return;
    }

    // build Date objects only for validation
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

    // OPTION A: build local strings, no timezone conversion
    const scheduledAt = buildLocalDateTimeString(form.date, form.startTime);
    const endAt = buildLocalDateTimeString(form.date, form.endTime);

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: Number(form.patientId),
          doctorId: Number(form.doctorId),
          branchId: Number(form.branchId),
          scheduledAt, // "YYYY-MM-DD HH:MM:SS" local
          endAt,
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

      // reset some fields
      setForm((prev) => ({
        ...prev,
        patientId: "",
        startTime: "",
        endTime: "",
        notes: "",
        status: "booked",
      }));
    } catch (err) {
      console.error(err);
      setError("Сүлжээгээ шалгана уу.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginBottom: 16,
        display: "grid",
        gap: 10,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Өвчтөний ID</label>
        <input
          name="patientId"
          value={form.patientId}
          onChange={handleChange}
          placeholder="Ж: 123"
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Эмч</label>
        <select
          name="doctorId"
          value={form.doctorId}
          onChange={handleChange}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Сонгох</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {formatDoctorName(d)}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Салбар</label>
        <select
          name="branchId"
          value={form.branchId}
          onChange={handleChange}
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
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Огноо</label>
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Эхлэх цаг</label>
        <input
          type="time"
          name="startTime"
          value={form.startTime}
          onChange={handleChange}
          step={SLOT_MINUTES * 60}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Дуусах цаг</label>
        <input
          type="time"
          name="endTime"
          value={form.endTime}
          onChange={handleChange}
          step={SLOT_MINUTES * 60}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

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
          gap: 8,
          alignItems: "center",
        }}
      >
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
          <span style={{ color: "#b91c1c", fontSize: 12 }}>{error}</span>
        )}
      </div>
    </form>
  );
}

// ========= PAGE =========

export default function AppointmentsPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterBranchId, setFilterBranchId] = useState<string>("");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [scheduledDoctors, setScheduledDoctors] =
    useState<ScheduledDoctor[]>([]);
  const [error, setError] = useState("");

  const selectedDay = new Date(
    Number(filterDate.slice(0, 4)),
    Number(filterDate.slice(5, 7)) - 1,
    Number(filterDate.slice(8, 10))
  );
  const timeSlots = generateTimeSlotsForDay(selectedDay);

  // load branches + doctors
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

  // load scheduled doctors
  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const params = new URLSearchParams();
        params.set("date", filterDate);
        if (filterBranchId) params.set("branchId", filterBranchId);
        const res = await fetch(`/api/doctors/scheduled?${params.toString()}`);
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          data.sort((a: ScheduledDoctor, b: ScheduledDoctor) =>
            (a.name || "").localeCompare(b.name || "", "mn")
          );
          setScheduledDoctors(data);
        } else {
          setScheduledDoctors([]);
        }
      } catch (e) {
        console.error(e);
        setScheduledDoctors([]);
      }
    };
    loadDoctors();
  }, [filterDate, filterBranchId]);

  // load appointments
  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setError("");
        const params = new URLSearchParams();
        params.set("date", filterDate);
        if (filterBranchId) params.set("branchId", filterBranchId);
        const res = await fetch(`/api/appointments?${params.toString()}`);
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          throw new Error("failed");
        }
        setAppointments(data);
      } catch (e) {
        console.error(e);
        setError("Цаг захиалгуудыг ачаалах үед алдаа гарлаа.");
      }
    };
    loadAppointments();
  }, [filterDate, filterBranchId]);

  const gridDoctors = scheduledDoctors;

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>
        Өдрийн цагийн хүснэгт (эмчээр)
      </h1>

      {/* Filters */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          gap: 12,
          alignItems: "center",
          fontSize: 13,
          flexWrap: "wrap",
        }}
      >
        <label>
          Огноо:{" "}
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{
              marginLeft: 4,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "4px 6px",
            }}
          />
        </label>
        <label>
          Салбар:{" "}
          <select
            value={filterBranchId}
            onChange={(e) => setFilterBranchId(e.target.value)}
            style={{
              marginLeft: 4,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "4px 6px",
            }}
          >
            <option value="">Бүх салбар</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <span style={{ color: "#6b7280" }}>
          {formatDateYmdDots(selectedDay)}
        </span>
      </div>

      {/* Inline form (uses OPTION A local time strings) */}
      <section
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 8 }}>
          Шинэ цаг захиалах
        </h2>
        <AppointmentForm
          branches={branches}
          doctors={doctors}
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

      {/* Calendar grid */}
      {gridDoctors.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          Энэ өдөр ажиллах эмчийн хуваарь алга.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            overflow: "hidden",
            fontSize: 12,
          }}
        >
          {/* header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `80px repeat(${gridDoctors.length}, 1fr)`,
              backgroundColor: "#f5f5f5",
              borderBottom: "1px solid #ddd",
            }}
          >
            <div style={{ padding: 8, fontWeight: 600 }}>Цаг</div>
            {gridDoctors.map((doc) => {
              const count = appointments.filter(
                (a) => a.doctorId === doc.id
              ).length;
              return (
                <div
                  key={doc.id}
                  style={{
                    padding: 8,
                    borderLeft: "1px solid #ddd",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {formatDoctorName(doc)}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    {count} захиалга
                  </div>
                </div>
              );
            })}
          </div>

          {/* rows */}
          <div>
            {timeSlots.map((slot, rowIndex) => (
              <div
                key={rowIndex}
                style={{
                  display: "grid",
                  gridTemplateColumns: `80px repeat(${gridDoctors.length}, 1fr)`,
                  borderBottom: "1px solid #f0f0f0",
                  minHeight: 40,
                }}
              >
                {/* time label */}
                <div
                  style={{
                    padding: 6,
                    borderRight: "1px solid #ddd",
                    backgroundColor:
                      rowIndex % 2 === 0 ? "#fafafa" : "#ffffff",
                  }}
                >
                  {slot.label}
                </div>

                {/* doctor columns */}
                {gridDoctors.map((doc) => {
                  const docApps = appointments.filter(
                    (a) => a.doctorId === doc.id
                  );

                  const overlapping = docApps.filter((a) => {
                    const start = new Date(a.scheduledAt);
                    if (Number.isNaN(start.getTime())) return false;
                    const end =
                      a.endAt &&
                      !Number.isNaN(new Date(a.endAt).getTime())
                        ? new Date(a.endAt)
                        : new Date(
                            start.getTime() + SLOT_MINUTES * 60 * 1000
                          );
                    return start < slot.end && end > slot.start;
                  });

                  const slotKey = `${doc.id}-${rowIndex}`;

                  if (overlapping.length === 0) {
                    return (
                      <div
                        key={slotKey}
                        style={{
                          borderLeft: "1px solid #f0f0f0",
                          backgroundColor: "#ffffff",
                          minHeight: 40,
                        }}
                      />
                    );
                  }

                  const isStartRow = (a: Appointment) => {
                    const idx = getAppointmentStartIndex(timeSlots, a);
                    return idx === rowIndex;
                  };

                  if (overlapping.length === 1) {
                    const a = overlapping[0];
                    return (
                      <div
                        key={slotKey}
                        style={{
                          borderLeft: "1px solid #f0f0f0",
                          backgroundColor: laneBg(a),
                          minHeight: 40,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "1px 4px",
                        }}
                      >
                        {isStartRow(a) && (
                          <span
                            style={{
                              fontSize: 11,
                              lineHeight: 1.2,
                              textAlign: "center",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                            }}
                          >
                            {`${formatGridShortLabel(a)} (${formatStatus(
                              a.status
                            )})`}
                          </span>
                        )}
                      </div>
                    );
                  }

                  const perWidth = 100 / overlapping.length;

                  return (
                    <div
                      key={slotKey}
                      style={{
                        borderLeft: "1px solid #f0f0f0",
                        backgroundColor: "#ffffff",
                        minHeight: 40,
                        display: "flex",
                        flexDirection: "row",
                        padding: 0,
                      }}
                    >
                      {overlapping.map((a, idx) => (
                        <div
                          key={a.id}
                          style={{
                            width: `${perWidth}%`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "1px 3px",
                            backgroundColor: laneBg(a),
                            boxSizing: "border-box",
                            borderLeft:
                              idx === 0 ? "none" : "2px solid #ffffff",
                          }}
                        >
                          {isStartRow(a) && (
                            <span
                              style={{
                                fontSize: 11,
                                lineHeight: 1.2,
                                textAlign: "center",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}
                            >
                              {`${formatGridShortLabel(
                                a
                              )} (${formatStatus(a.status)})`}
                            </span>
                          )}
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
    </main>
  );
}

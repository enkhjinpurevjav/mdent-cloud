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

// ========= lane layout helpers =========

type TimedAppointment = Appointment & {
  startIndex: number;
  endIndex: number;
  lane: number;
};

type DoctorLayout = {
  doctorId: number;
  lanes: number; // always 2
  items: TimedAppointment[];
};

// Build at most 2 lanes per doctor, long appointments span downward
function buildDoctorLayouts(
  timeSlots: TimeSlot[],
  appointments: Appointment[]
): Map<number, DoctorLayout> {
  const byDoctor = new Map<number, Appointment[]>();

  for (const a of appointments) {
    if (a.doctorId == null) continue;
    const list = byDoctor.get(a.doctorId) || [];
    list.push(a);
    byDoctor.set(a.doctorId, list);
  }

  const layouts = new Map<number, DoctorLayout>();

  for (const [doctorId, docApps] of byDoctor.entries()) {
    const timed: TimedAppointment[] = [];

    for (const a of docApps) {
      const startIdx = getAppointmentStartIndex(timeSlots, a);
      if (startIdx == null) continue;

      // compute end datetime
      let end: Date;
      if (a.endAt) {
        const d = new Date(a.endAt);
        end = Number.isNaN(d.getTime())
          ? new Date(
              new Date(a.scheduledAt).getTime() + SLOT_MINUTES * 60 * 1000
            )
          : d;
      } else {
        end = new Date(
          new Date(a.scheduledAt).getTime() + SLOT_MINUTES * 60 * 1000
        );
      }

      // find the first slot index where end <= slot.start
      let endIdx = timeSlots.length;
      for (let i = startIdx; i < timeSlots.length; i++) {
        if (end <= timeSlots[i].start) {
          endIdx = i;
          break;
        }
      }

      timed.push({
        ...a,
        startIndex: startIdx,
        endIndex: endIdx,
        lane: 0,
      });
    }

    // Sort by start time
    timed.sort((a, b) => {
      const ta = new Date(a.scheduledAt).getTime();
      const tb = new Date(b.scheduledAt).getTime();
      return ta - tb;
    });

    // Assign lanes, capped at 2
    const laneEndByLane: (number | undefined)[] = [undefined, undefined];
    const placed: TimedAppointment[] = [];

    for (const appt of timed) {
      let assignedLane: number | null = null;

      for (let lane = 0; lane < 2; lane++) {
        const lastEnd = laneEndByLane[lane];
        if (lastEnd === undefined || lastEnd <= appt.startIndex) {
          assignedLane = lane;
          laneEndByLane[lane] = appt.endIndex;
          break;
        }
      }

      // Should not happen if creation enforces <=2 overlaps, but guard anyway
      if (assignedLane === null) continue;

      appt.lane = assignedLane;
      placed.push(appt);
    }

    layouts.set(doctorId, {
      doctorId,
      lanes: 2,
      items: placed,
    });
  }

  return layouts;
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

// ========= local datetime helper =========

function buildLocalDateTimeString(dateStr: string, timeStr: string): string {
  return `${dateStr} ${timeStr}:00`;
}

// ========= AppointmentForm (inline) =========
// (unchanged – keep your current form)

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
          scheduledAt,
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

  // JSX form body unchanged...
  // (Keep exactly what you already have here)
  // ...
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
  const doctorLayouts = buildDoctorLayouts(timeSlots, appointments);

  // load branches + doctors (unchanged)
  // load scheduled doctors (unchanged)
  // load appointments (unchanged)

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
      {/* filters + form + error (unchanged) */}

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

                {/* doctor columns with 2 lanes each */}
                {gridDoctors.map((doc) => {
                  const layout =
                    doc.id != null ? doctorLayouts.get(doc.id) : undefined;
                  const slotKey = `${doc.id}-${rowIndex}`;

                  if (!layout || layout.lanes === 0) {
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

                  const laneWidth = 100 / layout.lanes; // 2 lanes -> 50% each

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
                      {Array.from({ length: layout.lanes }).map(
                        (_, laneIndex) => {
                          const appt = layout.items.find(
                            (a) =>
                              a.lane === laneIndex &&
                              rowIndex >= a.startIndex &&
                              rowIndex < a.endIndex
                          );

                          if (!appt) {
                            // empty lane at this row
                            return (
                              <div
                                key={laneIndex}
                                style={{
                                  width: `${laneWidth}%`,
                                  minHeight: 40,
                                  boxSizing: "border-box",
                                  borderLeft:
                                    laneIndex === 0
                                      ? "none"
                                      : "2px solid #ffffff",
                                }}
                              />
                            );
                          }

                          const showLabel = rowIndex === appt.startIndex;

                          return (
                            <div
                              key={laneIndex}
                              style={{
                                width: `${laneWidth}%`,
                                minHeight: 40,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "1px 3px",
                                backgroundColor: laneBg(appt),
                                boxSizing: "border-box",
                                borderLeft:
                                  laneIndex === 0
                                    ? "none"
                                    : "2px solid #ffffff",
                              }}
                            >
                              {showLabel && (
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
                                    appt
                                  )} (${formatStatus(appt.status)})`}
                                </span>
                              )}
                            </div>
                          );
                        }
                      )}
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

"use client";

import React, { useEffect, useMemo, useState } from "react";

// ========= Types =========

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
  endAt?: string | null;
  status: string;
  notes: string | null;
  patient?: PatientLite;
  doctor?: Doctor | null;
  branch?: Branch | null;
};

// ========= Time helpers =========

const START_HOUR = 9;
const END_HOUR = 21; // exclusive
const SLOT_MINUTES = 30;

type TimeSlot = {
  label: string; // "09:00"
  start: Date;
  end: Date;
};

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

// ========= Lane layout helpers =========

type TimedAppointment = Appointment & {
  startIndex: number;
  endIndex: number;
  lane: number;
};

type DoctorLayout = {
  doctorId: number;
  lanes: number;
  items: TimedAppointment[];
};

/**
 * Build per‑doctor lanes so that:
 * - long appointments span downward across multiple rows;
 * - overlapping appointments share horizontal lanes;
 * - empty capacity is visible.
 */
function buildDoctorLayouts(
  timeSlots: TimeSlot[],
  appointments: Appointment[]
): Map<number, DoctorLayout> {
  const byDoctor = new Map<number, Appointment[]>();

  for (const a of appointments) {
    if (a.doctorId == null) continue;
    const list = byDoctor.get(a.doctorId) ?? [];
    list.push(a);
    byDoctor.set(a.doctorId, list);
  }

  const layouts = new Map<number, DoctorLayout>();

  for (const [doctorId, docApps] of byDoctor.entries()) {
    const timed: TimedAppointment[] = [];

    for (const a of docApps) {
      const startIdx = getAppointmentStartIndex(timeSlots, a);
      if (startIdx == null) continue;

      const startDate = new Date(a.scheduledAt);
      let endDate: Date;

      if (a.endAt) {
        const parsed = new Date(a.endAt);
        endDate = Number.isNaN(parsed.getTime())
          ? new Date(startDate.getTime() + SLOT_MINUTES * 60 * 1000)
          : parsed;
      } else {
        endDate = new Date(startDate.getTime() + SLOT_MINUTES * 60 * 1000);
      }

      // find first slot where endDate <= slot.start
      let endIdx = timeSlots.length;
      for (let i = startIdx; i < timeSlots.length; i++) {
        if (endDate <= timeSlots[i].start) {
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

    // sort by start time for deterministic lane assignment
    timed.sort((a, b) => {
      const ta = new Date(a.scheduledAt).getTime();
      const tb = new Date(b.scheduledAt).getTime();
      return ta - tb;
    });

    // greedy lane assignment
    const laneEndByLane: number[] = [];
    for (const appt of timed) {
      let lane = 0;
      for (;;) {
        const lastEnd = laneEndByLane[lane];
        if (lastEnd === undefined || lastEnd <= appt.startIndex) {
          appt.lane = lane;
          laneEndByLane[lane] = appt.endIndex;
          break;
        }
        lane++;
      }
    }

    layouts.set(doctorId, {
      doctorId,
      lanes: laneEndByLane.length,
      items: timed,
    });
  }

  return layouts;
}

// ========= Formatting helpers =========

function formatDoctorName(d?: Doctor | null): string {
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

// ========= Page =========

export default function AppointmentsPage(): JSX.Element {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterBranchId, setFilterBranchId] = useState<string>("");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [scheduledDoctors, setScheduledDoctors] =
    useState<ScheduledDoctor[]>([]);
  const [error, setError] = useState<string>("");

  const selectedDay = useMemo(
    () =>
      new Date(
        Number(filterDate.slice(0, 4)),
        Number(filterDate.slice(5, 7)) - 1,
        Number(filterDate.slice(8, 10))
      ),
    [filterDate]
  );

  const timeSlots = useMemo(
    () => generateTimeSlotsForDay(selectedDay),
    [selectedDay]
  );

  const doctorLayouts = useMemo(
    () => buildDoctorLayouts(timeSlots, appointments),
    [timeSlots, appointments]
  );

  // load branches, doctors, appointments
  useEffect(() => {
    const loadAll = async () => {
      try {
        setError("");

        const params = new URLSearchParams();
        params.set("date", filterDate);
        if (filterBranchId) params.set("branchId", filterBranchId);

        const [bRes, dRes, aRes] = await Promise.all([
          fetch("/api/branches"),
          fetch(`/api/doctors/scheduled?${params.toString()}`),
          fetch(`/api/appointments?${params.toString()}`),
        ]);

        const [bData, dData, aData] = await Promise.all([
          bRes.json().catch(() => []),
          dRes.json().catch(() => []),
          aRes.json().catch(() => []),
        ]);

        if (Array.isArray(bData)) setBranches(bData);
        else setBranches([]);

        if (Array.isArray(dData)) {
          dData.sort((a: ScheduledDoctor, b: ScheduledDoctor) =>
            (a.name || "").localeCompare(b.name || "", "mn")
          );
          setScheduledDoctors(dData);
        } else {
          setScheduledDoctors([]);
        }

        if (!aRes.ok || !Array.isArray(aData)) {
          throw new Error("failed");
        }
        setAppointments(aData);
      } catch (e) {
        console.error(e);
        setError("Цаг захиалгуудыг ачаалах үед алдаа гарлаа.");
      }
    };

    loadAll();
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
      </div>

      {error && (
        <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

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
          {/* header row */}
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

          {/* time rows */}
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

                  const laneWidth = 100 / layout.lanes;

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
                        (_unused, laneIndex) => {
                          const appt = layout.items.find(
                            (a) =>
                              a.lane === laneIndex &&
                              rowIndex >= a.startIndex &&
                              rowIndex < a.endIndex
                          );

                          if (!appt) {
                            // empty lane at this time row
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

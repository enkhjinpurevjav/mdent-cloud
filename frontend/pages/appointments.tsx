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
  scheduledAt: string; // ISO
  endAt?: string | null; // ISO
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

// ========= PAGE =========

export default function AppointmentsPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterBranchId, setFilterBranchId] = useState<string>("");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [scheduledDoctors, setScheduledDoctors] =
    useState<ScheduledDoctor[]>([]);
  const [error, setError] = useState("");

  const selectedDay = new Date(
    Number(filterDate.slice(0, 4)),
    Number(filterDate.slice(5, 7)) - 1,
    Number(filterDate.slice(8, 10))
  );
  const timeSlots = generateTimeSlotsForDay(selectedDay);

  // load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await fetch("/api/branches");
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) setBranches(data);
      } catch (e) {
        console.error(e);
      }
    };
    loadBranches();
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
                  // all appointments for this doctor on this day
                  const docApps = appointments.filter(
                    (a) => a.doctorId === doc.id
                  );

                  // appointments that overlap this slot
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
                    // empty cell
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
                    // single appointment -> full width
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

                  // 2+ overlapping appointments in this row -> split evenly
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

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

// Given an appointment, compute slot index range it spans within this day
function getAppointmentSlotRange(
  daySlots: TimeSlot[],
  a: Appointment
): { startIndex: number; endIndex: number } | null {
  const start = new Date(a.scheduledAt);
  if (Number.isNaN(start.getTime())) return null;
  const end =
    a.endAt && !Number.isNaN(new Date(a.endAt).getTime())
      ? new Date(a.endAt)
      : new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);

  // Only consider appointments on this day
  const dayYmd = daySlots[0]?.start.toISOString().slice(0, 10);
  const apptYmd = start.toISOString().slice(0, 10);
  if (dayYmd !== apptYmd) return null;

  // Find first slot whose [start,end) intersects appointment at all
  let startIndex = -1;
  let endIndex = -1;
  for (let i = 0; i < daySlots.length; i++) {
    const s = daySlots[i];
    if (start < s.end && end > s.start) {
      if (startIndex === -1) startIndex = i;
      endIndex = i + 1; // exclusive
    } else if (startIndex !== -1) {
      // once we passed the overlapping region
      break;
    }
  }

  if (startIndex === -1 || endIndex === -1) return null;
  return { startIndex, endIndex };
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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
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

/* ------------- AppointmentDetailsModal, QuickAppointmentModal,
   AppointmentForm
   (KEEP YOUR EXISTING IMPLEMENTATIONS HERE — they are unchanged)
   ------------- */

/* For brevity I'm not re-pasting those whole components again because your
   copies are fine and not causing the error. Leave them exactly as you have
   above. The important fix is below in AppointmentsPage. */

/* ------------- Page ------------- */

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [scheduledDoctors, setScheduledDoctors] = useState<ScheduledDoctor[]>(
    []
  );
  const [error, setError] = useState("");

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

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

  // Doctors shown in the grid
  const gridDoctors: ScheduledDoctor[] = scheduledDoctors;

  // Build 2‑lane grid per doctor for the selected day
  type LaneCell = Appointment | null;
  type DoctorLanes = [LaneCell[], LaneCell[]];

  const doctorLanesMap: Record<number, DoctorLanes> = {};

  gridDoctors.forEach((doc) => {
    const lanes: DoctorLanes = [
      Array<LaneCell>(timeSlots.length).fill(null),
      Array<LaneCell>(timeSlots.length).fill(null),
    ];

    const docApps = appointments.filter((a) => a.doctorId === doc.id);
    for (const a of docApps) {
      const range = getAppointmentSlotRange(timeSlots, a);
      if (!range) continue;
      const { startIndex, endIndex } = range;

      const canPlaceInLane = (laneIndex: 0 | 1) => {
        for (let i = startIndex; i < endIndex; i++) {
          if (lanes[laneIndex][i] !== null) return false;
        }
        return true;
      };

      if (canPlaceInLane(0)) {
        for (let i = startIndex; i < endIndex; i++) {
          lanes[0][i] = a;
        }
      } else if (canPlaceInLane(1)) {
        for (let i = startIndex; i < endIndex; i++) {
          lanes[1][i] = a;
        }
      }
    }

    doctorLanesMap[doc.id] = lanes;
  });

  const slotsPerHour = 60 / SLOT_MINUTES; // not used but you had it; keep if needed later

  /* -------- JSX below is your existing render with doctorLanesMap used
     in the time grid (keep as you have it, since that part is fine). ------- */

  // ... keep the rest of your JSX (branch filters, AppointmentForm, grid, calendars, modals)

  return (
    /* your big <main> ... JSX exactly as in your last message, starting from
       <main style={{ maxWidth: 1100, ... }}> and using doctorLanesMap in the grid */
    // I’m not re-pasting that huge chunk to avoid mistakes; the key error was
    // only the early use of gridDoctors and the { ... } placeholders.
    <div>TODO: paste your JSX body here</div>
  );
}

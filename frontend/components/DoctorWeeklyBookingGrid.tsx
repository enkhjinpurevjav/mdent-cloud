import React, { useEffect, useMemo, useState } from "react";

type Branch = { id: number; name: string };

type DoctorScheduleDay = {
  id: number;
  date: string; // YYYY-MM-DD
  branch: Branch;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  note?: string | null;
};

type Appointment = {
  id: number;
  doctorId: number | null;
  branchId: number;
  patientId: number | null;
  status: string;
  scheduledAt: string; // ISO
  endAt: string | null;
  patientName?: string | null;
  patientOvog?: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatTimeLabel(h: number, m: number) {
  return `${pad2(h)}:${pad2(m)}`;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isTimeWithinRange(time: string, startTime: string, endTime: string) {
  // inclusive start, exclusive end
  return time >= startTime && time < endTime;
}

function getClinicDayTimeLabels(slotMinutes: number) {
  // Full clinic display range (so you can show orange non-working area)
  // Weekday clinic hours vary, but for a simple UI show 09:00-21:00
  const start = 9 * 60;
  const end = 21 * 60;
  const labels: string[] = [];
  for (let mins = start; mins < end; mins += slotMinutes) {
    labels.push(formatTimeLabel(Math.floor(mins / 60), mins % 60));
  }
  return labels;
}

function getClinicYmdFromIso(iso: string) {
  // Use ISO -> Date -> local ymd. If your server sends ISO in UTC,
  // and your browser is Mongolia time, this will display correctly.
  const d = new Date(iso);
  return formatYmd(d);
}

function getClinicTimeFromIso(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type Props = {
  doctorId: number;
  branchId?: number; // optional filter
  slotMinutes?: number; // default 30
  onSelectSlot?: (payload: {
    doctorId: number;
    branchId: number;
    ymd: string;
    time: string;
  }) => void;
};

export default function DoctorWeeklyBookingGrid({
  doctorId,
  branchId,
  slotMinutes = 30,
  onSelectSlot,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<DoctorScheduleDay[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const fromYmd = useMemo(() => formatYmd(today), [today]);
  const toYmd = useMemo(() => formatYmd(addDays(today, 6)), [today]);

  const dayColumns = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(today, i);
      return {
        date: d,
        ymd: formatYmd(d),
        label: d.toLocaleDateString("mn-MN", {
          month: "2-digit",
          day: "2-digit",
          weekday: "short",
        }),
      };
    });
  }, [today]);

  const timeLabels = useMemo(() => getClinicDayTimeLabels(slotMinutes), [slotMinutes]);

  // Index schedules by YMD
  const scheduleByDay = useMemo(() => {
    const m = new Map<string, DoctorScheduleDay[]>();
    for (const s of schedule) {
      const arr = m.get(s.date) || [];
      arr.push(s);
      m.set(s.date, arr);
    }
    // sort by start time
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      m.set(k, arr);
    }
    return m;
  }, [schedule]);

  // Index appointments by (ymd + time)
  const apptByDayTime = useMemo(() => {
    const m = new Map<string, Appointment>();
    for (const a of appointments) {
      if (!a.scheduledAt) continue;
      const ymd = getClinicYmdFromIso(a.scheduledAt);
      const time = getClinicTimeFromIso(a.scheduledAt);
      m.set(`${ymd} ${time}`, a);
    }
    return m;
  }, [appointments]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1) schedules
        const sRes = await fetch(
          `/api/users/${doctorId}/schedule?from=${fromYmd}&to=${toYmd}${
            branchId ? `&branchId=${branchId}` : ""
          }`
        );
        const sData = await sRes.json();
        if (!sRes.ok) throw new Error(sData?.error || "Failed to load schedule");
        if (!alive) return;
        setSchedule(Array.isArray(sData) ? sData : []);

        // 2) appointments
        const aRes = await fetch(
          `/api/appointments?doctorId=${doctorId}&dateFrom=${fromYmd}&dateTo=${toYmd}&status=ALL${
            branchId ? `&branchId=${branchId}` : ""
          }`
        );
        const aData = await aRes.json();
        if (!aRes.ok) throw new Error(aData?.error || "Failed to load appointments");
        if (!alive) return;

        // Optional filter: treat cancelled/completed as not blocking
        const filtered = (Array.isArray(aData) ? aData : []).filter((x: any) => {
          const st = String(x.status || "").toLowerCase();
          return st !== "cancelled" && st !== "completed";
        });
        setAppointments(filtered);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Network error");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [doctorId, branchId, fromYmd, toYmd]);

  const handleClick = (ymd: string, time: string, daySchedule: DoctorScheduleDay[]) => {
    // determine branch for booking:
    // simplest: if multiple schedules in a day, choose the one that contains time
    const s = daySchedule.find((x) => isTimeWithinRange(time, x.startTime, x.endTime));
    if (!s) return;

    onSelectSlot?.({ doctorId, branchId: s.branch.id, ymd, time });
  };

  if (loading) return <div>Ачааллаж байна...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <table style={{ borderCollapse: "collapse", minWidth: 900, width: "100%" }}>
        <thead>
          <tr>
            <th style={thStyle}>Цаг</th>
            {dayColumns.map((d) => (
              <th key={d.ymd} style={thStyle}>
                {d.ymd} {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeLabels.map((time) => (
            <tr key={time}>
              <td style={timeCellStyle}>{time}</td>

              {dayColumns.map((day) => {
                const daySchedule = scheduleByDay.get(day.ymd) || [];
                const isWorking =
                  daySchedule.length > 0 &&
                  daySchedule.some((s) => isTimeWithinRange(time, s.startTime, s.endTime));

                const appt = apptByDayTime.get(`${day.ymd} ${time}`);

                const cellBg = !isWorking ? "#fde68a" : appt ? "#fecaca" : "#dcfce7";
                const label = !isWorking ? "-" : appt ? "Захиалсан" : "Сонгох";

                return (
                  <td key={day.ymd} style={{ ...cellStyle, background: cellBg }}>
                    <button
                      type="button"
                      disabled={!isWorking || !!appt}
                      onClick={() => handleClick(day.ymd, time, daySchedule)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "rgba(255,255,255,0.85)",
                        cursor: !isWorking || appt ? "not-allowed" : "pointer",
                        fontSize: 12,
                      }}
                      title={
                        appt
                          ? `${appt.patientOvog || ""} ${appt.patientName || ""}`.trim()
                          : isWorking
                          ? "Цаг сонгох"
                          : "Ажиллахгүй цаг"
                      }
                    >
                      {label}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  background: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
  padding: 8,
  textAlign: "left",
  fontSize: 13,
  zIndex: 1,
};

const timeCellStyle: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  padding: 8,
  background: "#fff",
  position: "sticky",
  left: 0,
  zIndex: 1,
  whiteSpace: "nowrap",
  width: 70,
  fontSize: 12,
};

const cellStyle: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  borderLeft: "1px solid #f3f4f6",
  padding: 6,
  minWidth: 130,
};

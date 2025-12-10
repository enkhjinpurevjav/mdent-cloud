import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type SlotInfo,
} from "react-big-calendar";
import {
  addDays,
  addWeeks,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import mnLocale from "date-fns/locale/mn"; // optional, if installed
import "react-big-calendar/lib/css/react-big-calendar.css";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  ovog?: string | null;
  name?: string | null;
  email?: string | null;
  role: string;
  branchId?: number | null;
};

type Appointment = {
  id: number;
  patientId: number;
  doctorId: number | null;
  branchId: number;
  scheduledAt: string; // from backend
  status: string;
  notes: string | null;
  patient?: { id: number; name: string; regNo: string };
  doctor?: Doctor | null;
};

type CalendarEvent = {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resourceId: number | null;
  status: string;
  raw: Appointment;
};

const locales = {
  mn: mnLocale,
};

const localizer = dateFnsLocalizer({
  format,
  parse: (dateString, formatString) =>
    parse(dateString, formatString, new Date()),
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay: (date) => date.getDay(),
  locales,
});

function doctorLabel(d: Doctor) {
  return (d.ovog ? d.ovog + " " : "") + (d.name || d.email || "");
}

export default function AppointmentsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 1) Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await fetch("/api/branches");
        const data = await res.json();
        if (Array.isArray(data)) {
          setBranches(data);
          if (data.length && activeBranchId == null) {
            setActiveBranchId(data[0].id);
          }
        }
      } catch {
        // simple error handling
      }
    };
    loadBranches();
  }, [activeBranchId]);

  // 2) Load doctors for the active branch
  useEffect(() => {
    if (!activeBranchId) return;
    const loadDoctors = async () => {
      try {
        const res = await fetch(
          `/api/users?role=doctor&branchId=${activeBranchId}`
        );
        const data = await res.json();
        if (Array.isArray(data)) setDoctors(data);
      } catch {
        // ignore for now
      }
    };
    loadDoctors();
  }, [activeBranchId]);

  // Helpers to compute date ranges for fetching appointments
  function getRange(currentDate: Date, v: "day" | "week" | "month") {
    if (v === "day") {
      return {
        from: startOfDay(currentDate),
        to: endOfDay(currentDate),
      };
    }
    if (v === "week") {
      return {
        from: startOfWeek(currentDate, { weekStartsOn: 1 }),
        to: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    }
    return {
      from: startOfMonth(currentDate),
      to: endOfMonth(currentDate),
    };
  }

  // 3) Load appointments when branch / view / date changes
  useEffect(() => {
    if (!activeBranchId) return;

    const loadAppointments = async () => {
      setLoading(true);
      setError("");
      try {
        const { from, to } = getRange(date, view);
        const url = `/api/appointments?branchId=${activeBranchId}&from=${format(
          from,
          "yyyy-MM-dd"
        )}&to=${format(to, "yyyy-MM-dd")}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Цаг захиалга ачааллах үед алдаа гарлаа");
        } else if (Array.isArray(data)) {
          setAppointments(data);
        } else {
          setAppointments([]);
        }
      } catch {
        setError("Сүлжээгээ шалгана уу");
      } finally {
        setLoading(false);
      }
    };

    loadAppointments();
  }, [activeBranchId, view, date]);

  // 4) Map appointments -> calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return appointments.map((a) => {
      const start = new Date(a.scheduledAt);
      // temporary: 40 minutes default duration
      const end = new Date(start.getTime() + 40 * 60 * 1000);

      const patientName = a.patient?.name || `${a.patientId}`;
      const title = patientName;

      return {
        id: a.id,
        title,
        start,
        end,
        resourceId: a.doctorId,
        status: a.status,
        raw: a,
      };
    });
  }, [appointments]);

  // 5) Map doctors -> resources
  const resources = useMemo(
    () =>
      doctors.map((d) => ({
        resourceId: d.id,
        resourceTitle: doctorLabel(d),
      })),
    [doctors]
  );

  // 6) View navigation handlers
  function handlePrev() {
    if (view === "day") setDate((d) => addDays(d, -1));
    else if (view === "week") setDate((d) => addWeeks(d, -1));
    else setDate((d) => addMonths(d, -1));
  }
  function handleNext() {
    if (view === "day") setDate((d) => addDays(d, 1));
    else if (view === "week") setDate((d) => addWeeks(d, 1));
    else setDate((d) => addMonths(d, 1));
  }
  function handleToday() {
    setDate(new Date());
  }

  // 7) Slot & event interactions
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    // Here you can open your appointment form modal.
    // You already have a simple AppointmentForm. Later we can refactor to use a dialog.
    // For now, just show basic info:
    const start = slotInfo.start as Date;
    const end = slotInfo.end as Date;
    alert(
      `New appointment slot:\n${format(
        start,
        "yyyy-MM-dd HH:mm"
      )} - ${format(end, "HH:mm")}\nDoctor ID: ${
        // @ts-expect-error resourceId is available in resource slots
        (slotInfo as any).resourceId ?? "not selected"
      }`
    );
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    const a = event.raw;
    const patientName = a.patient?.name || a.patientId;
    alert(
      `Appointment #${a.id}\nPatient: ${patientName}\nDoctor: ${
        a.doctor ? doctorLabel(a.doctor) : a.doctorId ?? "-"
      }\nStatus: ${a.status}\nNotes: ${a.notes || "-"}`
    );
  };

  // 8) Render helpers
  const activeBranch = branches.find((b) => b.id === activeBranchId) || null;

  return (
    <div style={{ padding: 24 }}>
      <h1>Цаг захиалга (Календар)</h1>

      {/* Branch tabs + controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Branch tabs */}
        <div>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBranchId(b.id)}
              style={{
                padding: "6px 14px",
                marginRight: 4,
                borderRadius: 4,
                border:
                  activeBranchId === b.id
                    ? "2px solid #1976d2"
                    : "1px solid #ccc",
                background:
                  activeBranchId === b.id ? "#e3f2fd" : "rgba(0,0,0,0.02)",
                cursor: "pointer",
                fontWeight: activeBranchId === b.id ? 600 : 400,
              }}
            >
              {b.name}
            </button>
          ))}
        </div>

        {/* Add appointment button (you can wire to a real modal later) */}
        <button
          type="button"
          onClick={() => alert("TODO: open appointment create form")}
          style={{
            padding: "6px 16px",
            borderRadius: 4,
            border: "none",
            background: "#4caf50",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          + Цаг захиалах
        </button>

        {/* View toggles */}
        <div style={{ marginLeft: 12 }}>
          <button
            type="button"
            onClick={() => setView("day")}
            style={{
              marginRight: 4,
              padding: "4px 10px",
              background: view === "day" ? "#1976d2" : "#eee",
              color: view === "day" ? "#fff" : "#000",
              border: "none",
              borderRadius: 4,
            }}
          >
            Өдөр
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            style={{
              marginRight: 4,
              padding: "4px 10px",
              background: view === "week" ? "#1976d2" : "#eee",
              color: view === "week" ? "#fff" : "#000",
              border: "none",
              borderRadius: 4,
            }}
          >
            Долоо хоног
          </button>
          <button
            type="button"
            onClick={() => setView("month")}
            style={{
              padding: "4px 10px",
              background: view === "month" ? "#1976d2" : "#eee",
              color: view === "month" ? "#fff" : "#000",
              border: "none",
              borderRadius: 4,
            }}
          >
            Сар
          </button>
        </div>

        {/* Date navigation */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button type="button" onClick={handlePrev}>
            ←
          </button>
          <button type="button" onClick={handleToday}>
            Өнөөдөр
          </button>
          <button type="button" onClick={handleNext}>
            →
          </button>
          <div style={{ fontWeight: 600 }}>
            {format(
              date,
              view === "day"
                ? "yyyy-MM-dd EEEE"
                : view === "week"
                ? "yyyy 'оны' w-р долоо хоног"
                : "yyyy-MM"
            )}
          </div>
        </div>
      </div>

      {activeBranch && (
        <div style={{ marginBottom: 8, color: "#555" }}>
          Салбар: <strong>{activeBranch.name}</strong>
        </div>
      )}

      {error && (
        <div style={{ color: "red", marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Calendar */}
      <div style={{ height: "75vh", border: "1px solid #eee" }}>
        <Calendar
          localizer={localizer}
          events={events}
          view={
            view === "day"
              ? Views.DAY
              : view === "week"
              ? Views.WEEK
              : Views.MONTH
          }
          onView={(v) => {
            if (v === Views.DAY) setView("day");
            else if (v === Views.WEEK) setView("week");
            else setView("month");
          }}
          date={date}
          onNavigate={(newDate) => setDate(newDate)}
          resources={resources}
          resourceIdAccessor="resourceId"
          resourceTitleAccessor="resourceTitle"
          step={20}
          timeslots={3}
          min={new Date(0, 0, 0, 9, 0)} // 09:00
          max={new Date(0, 0, 0, 19, 0)} // 19:00
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={(event) => {
            let background = "#42a5f5";
            if (event.status === "booked") background = "#4caf50";
            else if (event.status === "ongoing") background = "#ff9800";
            else if (event.status === "completed") background = "#9e9e9e";
            else if (event.status === "cancelled") background = "#e57373";

            return {
              style: {
                backgroundColor: background,
                color: "#fff",
                borderRadius: 6,
                border: "none",
                fontSize: 12,
              },
            };
          }}
        />
      </div>

      {loading && (
        <div style={{ marginTop: 8 }}>Ачааллаж байна...</div>
      )}
    </div>
  );
}

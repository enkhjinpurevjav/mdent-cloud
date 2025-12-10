import React, { useEffect, useState, useMemo } from "react";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

// Replace with your API fetch logic
async function fetchBranches() {
  const res = await fetch("/api/branches");
  return res.json();
}

async function fetchDoctors(branchId?: number) {
  const url = branchId
    ? `/api/users?role=doctor&branchId=${branchId}`
    : "/api/users?role=doctor";
  const res = await fetch(url);
  return res.json();
}

async function fetchAppointments({
  branchId,
  from,
  to,
}: {
  branchId: number;
  from: string;
  to: string;
}) {
  const url = `/api/appointments?branchId=${branchId}&from=${from}&to=${to}`;
  const res = await fetch(url);
  return res.json();
}

// Utility: map your appointment data to react-big-calendar events
function toEvents(appointments: any[]) {
  return appointments.map((ap) => ({
    id: ap.id,
    title: ap.patient
      ? `${ap.patient.ovog || ""} ${ap.patient.name || ""}`
      : ap.notes || "Appointment",
    start: new Date(ap.startTime),
    end: new Date(ap.endTime),
    resourceId: ap.doctorId,
    status: ap.status,
    doctor: ap.doctor,
    meta: ap,
  }));
}

const localizer = momentLocalizer(moment);

export default function AppointmentsPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [activeBranch, setActiveBranch] = useState<any | null>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [date, setDate] = useState<Date>(moment().toDate());

  // --- 1. Load branch list, set active branch
  useEffect(() => {
    fetchBranches().then((list) => {
      setBranches(list);
      if (list.length) setActiveBranch(list[0]);
    });
  }, []);

  // --- 2. Load doctors for selected branch
  useEffect(() => {
    if (activeBranch) {
      fetchDoctors(activeBranch.id).then(setDoctors);
    }
  }, [activeBranch]);

  // --- 3. Load appointments when branch/date/view changes
  useEffect(() => {
    if (!activeBranch) return;

    // Calculate date range for current view and date
    let from: moment.Moment, to: moment.Moment;
    if (view === "day") {
      from = moment(date).startOf("day");
      to = moment(date).endOf("day");
    } else if (view === "week") {
      from = moment(date).startOf("week");
      to = moment(date).endOf("week");
    } else {
      // month
      from = moment(date).startOf("month");
      to = moment(date).endOf("month");
    }

    fetchAppointments({
      branchId: activeBranch.id,
      from: from.format("YYYY-MM-DD"),
      to: to.format("YYYY-MM-DD"),
    }).then(setAppointments);
  }, [activeBranch, date, view]);

  // --- 4. Map appointments to calendar events
  const events = useMemo(() => toEvents(appointments), [appointments]);

  // --- 5. Map doctors to resources for calendar columns
  const resources = useMemo(
    () =>
      doctors.map((doc: any) => ({
        resourceId: doc.id,
        resourceTitle:
          (doc.ovog ? doc.ovog + " " : "") + (doc.name || doc.email),
      })),
    [doctors]
  );

  // --- 6. Add appointment modal (TODO: implement dialog UI)
  function handleSelectSlot(slotInfo: any) {
    // Open modal to create appointment, pre-fill start/end/doctor/branch
    // After creation, reload appointments
    // Your add-appointment logic here
    alert(
      `Slot clicked: ${moment(slotInfo.start).format("HH:mm")} → ${moment(
        slotInfo.end
      ).format("HH:mm")}, doctorId: ${slotInfo.resourceId}`
    );
  }

  function handleEventClick(event: any) {
    // Show details, allow edit/cancel
    alert(`Appointment: ` + JSON.stringify(event.meta, null, 2));
  }

  // --- 7. Main render
  return (
    <div style={{ margin: "24px", maxWidth: "100%", minHeight: "80vh" }}>
      <div style={{ marginBottom: 12, display: "flex", gap: 20, alignItems: "center" }}>
        {/* Branch tabs */}
        <div>
          {branches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => setActiveBranch(branch)}
              style={{
                padding: "6px 16px",
                marginRight: 4,
                background:
                  activeBranch && activeBranch.id === branch.id
                    ? "#1976d2"
                    : "#f0f0f0",
                color:
                  activeBranch && activeBranch.id === branch.id
                    ? "#fff"
                    : "#333",
                border: "1px solid #1976d2",
                borderRadius: 4,
                fontWeight:
                  activeBranch && activeBranch.id === branch.id
                    ? 600
                    : undefined,
              }}
            >
              {branch.name}
            </button>
          ))}
        </div>
        {/* Add appt button */}
        <button
          style={{
            background: "#4caf50",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "6px 16px",
            fontWeight: 600,
          }}
          onClick={() => alert("TODO: Show new appointment dialog")}
        >
          + Add Appointment
        </button>
        {/* View switch */}
        <div>
          <button
            onClick={() => setView("day")}
            style={{
              fontWeight: view === "day" ? 700 : undefined,
              background: view === "day" ? "#eee" : undefined,
              marginRight: 2,
            }}
          >
            Day
          </button>
          <button
            onClick={() => setView("week")}
            style={{
              fontWeight: view === "week" ? 700 : undefined,
              background: view === "week" ? "#eee" : undefined,
              marginRight: 2,
            }}
          >
            Week
          </button>
          <button
            onClick={() => setView("month")}
            style={{
              fontWeight: view === "month" ? 700 : undefined,
              background: view === "month" ? "#eee" : undefined,
            }}
          >
            Month
          </button>
        </div>
        {/* Date navigation */}
        <div style={{ marginLeft: "auto" }}>
          <span style={{ fontSize: 18 }}>
            {moment(date).format(
              view === "day"
                ? "YYYY-MM-DD dddd"
                : view === "week"
                ? "[Week of] YYYY-MM-DD"
                : "YYYY-MM"
            )}
          </span>
          <button onClick={() => setDate(moment(date).subtract(1, view).toDate())}>
            ←
          </button>
          <button onClick={() => setDate(moment(date).add(1, view).toDate())}>
            →
          </button>
          <button onClick={() => setDate(moment().toDate())}>Today</button>
        </div>
      </div>

      <div>
        <Calendar
          localizer={localizer}
          events={events}
          defaultView={Views.DAY}
          views={["day", "week", "month"]}
          view={view}
          onView={(viewMode) =>
            setView(
              viewMode === "day"
                ? "day"
                : viewMode === "week"
                ? "week"
                : "month"
            )
          }
          date={date}
          onNavigate={setDate}
          min={moment().startOf("day").set("hour", 8).toDate()}
          max={moment().startOf("day").set("hour", 19).toDate()}
          step={20}
          timeslots={2}
          resources={resources}
          resourceIdAccessor="resourceId"
          resourceTitleAccessor="resourceTitle"
          defaultDate={new Date()}
          style={{ height: "70vh" }}
          onSelectSlot={handleSelectSlot}
          selectable
          onSelectEvent={handleEventClick}
          // Optionally: customize event colors by status
          eventPropGetter={(event) => ({
            style: {
              background:
                event.status === "booked"
                  ? "#4caf50"
                  : event.status === "ongoing"
                  ? "#42a5f5"
                  : event.status === "completed"
                  ? "#757575"
                  : event.status === "cancelled"
                  ? "#e57373"
                  : "#FFD700",
              color: "#fff",
              borderRadius: "6px",
              fontWeight: 600,
              border: "none",
            },
          })}
        />
      </div>
    </div>
  );
}

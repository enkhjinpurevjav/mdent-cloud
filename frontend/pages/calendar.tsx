import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false }) as any;
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";

type Appointment = {
  id: number;
  patientId: number;
  scheduledAt: string;
  status: string;
  patient?: { name: string };
};

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/appointments");
        const data = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(data)) {
          setError("Failed to load appointments");
          return;
        }
        setEvents(
          data.map((a: Appointment) => ({
            id: String(a.id),
            title: a.patient ? `${a.patient.name} • ${a.status}` : `ID ${a.patientId} • ${a.status}`,
            start: a.scheduledAt,
          }))
        );
      } catch {
        setError("Network error");
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Calendar</h1>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,timeGridDay,dayGridMonth" }}
        events={events}
        height="auto"
        allDaySlot={false}
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
      />
    </div>
  );
}

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import to disable SSR for FullCalendar
const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false }) as any;
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";

type Appointment = {
  id: number;
  patientId: number;
  branchId: number;
  scheduledAt: string; // ISO
  status: string;
  notes: string | null;
  patient?: { id: number; name: string; regNo: string };
};

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/appointments");
        let data: any = null;
        try { data = await res.json(); } catch {}
        if (!res.ok) {
          setError((data && data.error) || "Failed to load appointments");
          return;
        }
        const evs = (data as Appointment[]).map((a) => ({
          id: String(a.id),
          title: a.patient ? `${a.patient.name} • ${a.status}` : `Patient ${a.patientId} • ${a.status}`,
          start: a.scheduledAt,
        }));
        setEvents(evs);
      } catch {
        setError("Network error");
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Цаг захиалга — Calendar</h1>
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

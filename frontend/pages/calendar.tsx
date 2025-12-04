import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false }) as any;
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

type Appointment = {
  id: number;
  patientId: number;
  doctorId: number | null;
  branchId: number;
  scheduledAt: string;
  status: string;
  notes: string | null;
  patient?: { id: number; name: string; regNo: string };
};

type EventInput = {
  id?: string;
  title: string;
  start: string;
  end?: string;
  extendedProps?: any;
  color?: string;
};

export default function CalendarPage() {
  const calendarRef = useRef<any>(null);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState<string>("1");
  const [view, setView] = useState<"timeGridWeek" | "timeGridDay">("timeGridWeek");

  const [creating, setCreating] = useState(false);
  const [createSlot, setCreateSlot] = useState<{ start: string; end: string } | null>(null);
  const [createForm, setCreateForm] = useState({
    patientId: "",
    doctorId: "",
    status: "booked",
    notes: "",
  });

  const changeView = (nextView: "timeGridWeek" | "timeGridDay") => {
    setView(nextView);
    const api = calendarRef.current?.getApi();
    if (api) api.changeView(nextView);
  };

  const currentDateISO = useMemo(() => {
    const api = calendarRef.current?.getApi();
    const currentStart = api?.view?.currentStart;
    return currentStart ? currentStart.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  }, [view, calendarRef.current]);

  const fetchAppointments = async () => {
    setLoading(true);
    setError("");
    try {
      const date = currentDateISO;
      const qs = new URLSearchParams();
      if (branchId) qs.set("branchId", branchId);
      if (date) qs.set("date", date);

      const res = await fetch(`/api/appointments?${qs.toString()}`);
      let data: any = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        setError((data && data.error) || "Failed to load appointments");
        setEvents([]);
        return;
      }

      const evs: EventInput[] = (data as Appointment[]).map((a) => ({
        id: String(a.id),
        title: a.patient ? `${a.patient.name} • ${a.status}` : `Patient ${a.patientId} • ${a.status}`,
        start: a.scheduledAt,
        end: new Date(new Date(a.scheduledAt).getTime() + 30 * 60 * 1000).toISOString(),
        extendedProps: { appointment: a },
        color:
          a.status === "booked" ? "#1976d2" :
          a.status === "ongoing" ? "#f57c00" :
          a.status === "completed" ? "#2e7d32" :
          a.status === "cancelled" ? "#9e9e9e" :
          undefined,
      }));
      setEvents(evs);
    } catch {
      setError("Network error");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, view]);

  const handleDatesSet = () => {
    fetchAppointments();
  };

  const handleSelect = (info: { startStr: string; endStr: string }) => {
    setCreating(true);
    setCreateSlot({ start: info.startStr, end: info.endStr });
    setCreateForm((f) => ({ ...f, notes: "", status: "booked" }));
  };

  const handleEventClick = (info: any) => {
    const appt: Appointment | undefined = info.event?.extendedProps?.appointment;
    if (!appt) return;
    alert(
      `Appointment #${appt.id}\n` +
      `Branch: ${appt.branchId}\n` +
      `Patient: ${appt.patient?.name ?? appt.patientId}\n` +
      `Doctor: ${appt.doctorId ?? "-"}\n` +
      `Scheduled: ${new Date(appt.scheduledAt).toLocaleString()}\n` +
      `Status: ${appt.status}\n` +
      `Notes: ${appt.notes ?? "-"}`
    );
  };

  const submitCreate = async () => {
    if (!createSlot) return;
    const scheduledAt = createSlot.start;
    const payload = {
      patientId: Number(createForm.patientId),
      doctorId: createForm.doctorId ? Number(createForm.doctorId) : null,
      branchId: Number(branchId),
      scheduledAt,
      status: createForm.status,
      notes: createForm.notes || null,
    };

    if (!payload.patientId || !payload.branchId || !payload.scheduledAt) {
      alert("patientId, branchId, scheduledAt are required");
      return;
    }

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data: any = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        alert((data && data.error) || "Failed to create appointment");
        return;
      }
      setCreating(false);
      setCreateSlot(null);
      setCreateForm({ patientId: "", doctorId: "", status: "booked", notes: "" });
      await fetchAppointments();
    } catch {
      alert("Network error");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Цаг захиалга — Calendar</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="1">Branch 1</option>
          <option value="2">Branch 2</option>
        </select>
        <button onClick={() => changeView("timeGridWeek")} disabled={view === "timeGridWeek"}>Week</button>
        <button onClick={() => changeView("timeGridDay")} disabled={view === "timeGridDay"}>Day</button>
        {loading && <span style={{ color: "#555" }}>Loading...</span>}
        {error && <span style={{ color: "red" }}>{error}</span>}
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={view}
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
        allDaySlot={false}
        selectable={true}
        selectMirror={true}
        select={handleSelect}
        events={events}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        height="auto"
      />

      {creating && createSlot && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 6 }}>
          <div style={{ marginBottom: 8 }}>
            Сонгосон цаг: {new Date(createSlot.start).toLocaleString()} → {new Date(createSlot.end).toLocaleTimeString()}
          </div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(6, 1fr)" }}>
            <input
              name="patientId"
              placeholder="Patient ID"
              value={createForm.patientId}
              onChange={(e) => setCreateForm({ ...createForm, patientId: e.target.value })}
              required
            />
            <input
              name="doctorId"
              placeholder="Doctor ID (optional)"
              value={createForm.doctorId}
              onChange={(e) => setCreateForm({ ...createForm, doctorId: e.target.value })}
            />
            <select
              name="status"
              value={createForm.status}
              onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
            >
              <option value="booked">Захиалсан</option>
              <option value="ongoing">Явагдаж байна</option>
              <option value="completed">Дууссан</option>
              <option value="cancelled">Цуцлагдсан</option>
            </select>
            <input
              name="notes"
              placeholder="Тэмдэглэл"
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            />
            <button onClick={submitCreate} style={{ gridColumn: "span 2" }}>Цаг захиалах</button>
            <button onClick={() => { setCreating(false); setCreateSlot(null); }} style={{ gridColumn: "span 2" }}>Болих</button>
          </div>
        </div>
      )}
    </div>
  );
}

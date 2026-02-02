import React, { useEffect, useMemo, useState } from "react";
import { formatGridShortLabel } from "../../utils/scheduling";

type FollowUpAvailability = {
  days: Array<{
    date: string;
    dayLabel: string;
    slots: Array<{
      start: string;
      end: string;
      status: "available" | "booked" | "off";
      appointmentIds?: number[];
      appointmentId?: number; // backward compat (unused)
    }>;
  }>;
  timeLabels: string[];
};

type AppointmentLiteForDetails = {
  id: number;
  status: string;
  scheduledAt: string;
  endAt: string | null;
  patientName: string | null;
  patientOvog?: string | null;
  patient?: {
    name: string;
    ovog?: string | null;
    patientBook?: { bookNumber?: string | null } | null;
  } | null;

  // ✅ add this
  branch?: { id: number; name: string } | null;
  
  // Provenance fields for deletion permission tracking
  createdByUserId?: number | null;
  source?: string | null;
  sourceEncounterId?: number | null;
};

type FollowUpSchedulerProps = {
  showFollowUpScheduler: boolean;
  followUpDateFrom: string;
  followUpDateTo: string;
  followUpSlotMinutes: number;

  followUpAvailability: FollowUpAvailability | null;
  followUpLoading: boolean;
  followUpError: string;
  followUpSuccess: string;
  followUpBooking: boolean;

  followUpAppointments?: AppointmentLiteForDetails[];
  followUpNoSchedule?: boolean;
  doctorId?: number; // Add doctorId for QuickAppointmentModal
  encounterId?: number; // Current encounter ID for permission checks

  onToggleScheduler: (checked: boolean) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onSlotMinutesChange: (minutes: number) => void;
  onBookAppointment: (slotStart: string, durationMinutes?: number) => void;
  onDeleteAppointment?: (appointmentId: number) => Promise<void>; // Delete handler

  onQuickCreate?: (params: { date: string; time: string; durationMinutes: number }) => void;
  onReloadAvailability?: () => void; // Callback to reload availability after creating appointment
};

function getHmFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toTimeString().substring(0, 5);
}
const nameOnly = (label: string) =>
  (label || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
// Constants for grid layout
const COL_WIDTH = 80; // Width of each time slot column in pixels
const MIN_ROW_HEIGHT = 80; // Minimum height for each day row
const BLOCK_BORDER_RADIUS = 4; // Border radius for appointment blocks

export default function FollowUpScheduler({
  showFollowUpScheduler,
  followUpDateFrom,
  followUpDateTo,
  followUpSlotMinutes,
  followUpAvailability,
  followUpLoading,
  followUpError,
  followUpSuccess,
  followUpBooking,
  followUpAppointments = [],
  followUpNoSchedule = false,
  doctorId,
  encounterId,
  onToggleScheduler,
  onDateFromChange,
  onDateToChange,
  onSlotMinutesChange,
  onBookAppointment,
  onDeleteAppointment,
  onQuickCreate,
  onReloadAvailability,
}: FollowUpSchedulerProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsDate, setDetailsDate] = useState<string>("");
  const [detailsTime, setDetailsTime] = useState<string>("");
  const [detailsSlotStart, setDetailsSlotStart] = useState<string>(""); // ISO string of slot start
  const [detailsAppointmentIds, setDetailsAppointmentIds] = useState<number[]>([]);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<number | null>(null);

  // Quick create UI (Option 3A)
  const [quickDate, setQuickDate] = useState<string>(followUpDateFrom);
  const [quickTime, setQuickTime] = useState<string>("09:00");
  const [quickDuration, setQuickDuration] = useState<number>(30);

  const [slotModalOpen, setSlotModalOpen] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  const handleDeleteAppointment = async (appointmentId: number) => {
    if (!onDeleteAppointment) return;
    
    if (!confirm("Энэ цагийг устгахдаа итгэлтэй байна уу?")) {
      return;
    }

    try {
      setDeletingAppointmentId(appointmentId);
      await onDeleteAppointment(appointmentId);
      setDetailsOpen(false);
      // Reload will happen in parent
    } catch (err: any) {
      alert(err?.message || "Цаг устгахад алдаа гарлаа");
    } finally {
      setDeletingAppointmentId(null);
    }
  };

  // Check if appointment can be deleted (open mode - no auth required)
  // Only follow-up appointments from current encounter that are in the future can be deleted
  const canDeleteAppointment = (appointment: AppointmentLiteForDetails): boolean => {
    if (!encounterId) return false;
    
    // Must be from follow-up encounter source
    const isFollowUpSource = appointment.source === "FOLLOW_UP_ENCOUNTER";
    
    // Must belong to the current encounter
    const isCurrentEncounter = appointment.sourceEncounterId === encounterId;
    
    // Must be scheduled in the future
    const isFutureAppointment = new Date(appointment.scheduledAt) > new Date();
    
    return isFutureAppointment && isFollowUpSource && isCurrentEncounter;
  };

  const apptById = useMemo(() => {
    const map = new Map<number, AppointmentLiteForDetails>();
    for (const a of followUpAppointments) {
      map.set(a.id, a);
    }
    return map;
  }, [followUpAppointments]);

  const detailsAppointments = useMemo(() => {
    return detailsAppointmentIds.map((id) => apptById.get(id)).filter(Boolean) as AppointmentLiteForDetails[];
  }, [detailsAppointmentIds, apptById]);

  // Calculate how many appointments would overlap if we create a new one at detailsSlotStart
  const calculateOverlapCount = (slotStart: string, durationMinutes: number): number => {
    if (!slotStart) return 0;
    
    const newStart = new Date(slotStart);
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60_000);
    
    // Count appointments that would overlap with the new appointment
    let count = 0;
    for (const apt of followUpAppointments) {
      if (apt.status === "cancelled" || apt.status === "no_show" || apt.status === "completed") {
        continue; // Don't count cancelled/no-show/completed
      }
      
      const aptStart = new Date(apt.scheduledAt);
      const aptEnd = apt.endAt ? new Date(apt.endAt) : new Date(aptStart.getTime() + followUpSlotMinutes * 60_000);
      
      // Check if they overlap: aptStart < newEnd && aptEnd > newStart
      if (aptStart < newEnd && aptEnd > newStart) {
        count++;
      }
    }
    
    // +1 for the new appointment we're trying to add
    return count + 1;
  };

  const canAddAppointment = useMemo(() => {
    if (!detailsSlotStart) return false;
    const overlapCount = calculateOverlapCount(detailsSlotStart, followUpSlotMinutes);
    return overlapCount <= 2;
  }, [detailsSlotStart, followUpSlotMinutes, followUpAppointments]);

  const handleSlotSelection = (slotStart: string) => {
    // Extract date and time from ISO string
    const dt = new Date(slotStart);
    const date = dt.toISOString().split('T')[0];
    const hm = getHmFromIso(slotStart);
    
    // Open details modal to show occupancy and allow adding appointment
    setDetailsSlotStart(slotStart);
    setDetailsDate(date);
    setDetailsTime(hm);
    
    // Find appointments that overlap with this slot
    const slotEnd = new Date(dt.getTime() + followUpSlotMinutes * 60_000);
    const overlappingIds: number[] = [];
    
    for (const apt of followUpAppointments) {
      if (apt.status === "cancelled" || apt.status === "no_show" || apt.status === "completed") {
        continue;
      }
      
      const aptStart = new Date(apt.scheduledAt);
      const aptEnd = apt.endAt ? new Date(apt.endAt) : new Date(aptStart.getTime() + followUpSlotMinutes * 60_000);
      
      if (aptStart < slotEnd && aptEnd > dt) {
        overlappingIds.push(apt.id);
      }
    }
    
    setDetailsAppointmentIds(overlappingIds);
    setDetailsOpen(true);
  };

  const handleBookedSlotClick = (appointmentIds: number[], date: string, time: string, slotStart: string) => {
    setDetailsAppointmentIds(appointmentIds);
    setDetailsDate(date);
    setDetailsTime(time);
    setDetailsSlotStart(slotStart);
    setDetailsOpen(true);
  };


  const [localAvailability, setLocalAvailability] = useState<FollowUpAvailability | null>(followUpAvailability);

useEffect(() => {
  setLocalAvailability(followUpAvailability);
}, [followUpAvailability]);
  
  const handleDurationSelect = (durationMinutes: number) => {
  if (!selectedSlot || !localAvailability) return;

  // 1) Optimistically mark selected slot as booked in local state
  const updatedDays = localAvailability.days.map((day) => ({
    ...day,
    slots: day.slots.map((slot) =>
      slot.start === selectedSlot
        ? { ...slot, status: "booked" as const }
        : slot
    ),
  }));

  setLocalAvailability({ ...localAvailability, days: updatedDays });

  // 2) Call backend
  onBookAppointment(selectedSlot, durationMinutes);

  // 3) Close modal
  setSlotModalOpen(false);
  setSelectedSlot("");

  // 4) Trigger reload after a short delay to get fresh data
  setTimeout(() => {
    onReloadAvailability?.();
  }, 500);
};

  const renderGrid = () => {
    if (!localAvailability) return null;
    const { days, timeLabels } = localAvailability;

    // For each day, get appointments for that day
    const dayAppointments = days.map((day) => {
      const aptsThisDay = followUpAppointments.filter((apt) => {
        if (apt.status === "cancelled" || apt.status === "no_show" || apt.status === "completed") {
          return false;
        }
        const aptDate = new Date(apt.scheduledAt).toISOString().split('T')[0];
        return aptDate === day.date;
      });

      // Sort appointments by start time, then by id for consistent ordering
      aptsThisDay.sort((a, b) => {
        const timeDiff = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        return timeDiff !== 0 ? timeDiff : a.id - b.id;
      });

      return { day, appointments: aptsThisDay };
    });

    return (
      <div
        style={{
          overflowX: "auto",
          marginTop: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: 12,
            background: "white",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "center",
                  background: "#f9fafb",
                  padding: 8,
                  borderBottom: "2px solid #d1d5db",
                  borderRight: "1px solid #e5e7eb",
                  fontWeight: "bold",
                  minWidth: 100,
                }}
              >
                Огноо
              </th>
              {timeLabels.map((timeLabel) => (
                <th
                  key={timeLabel}
                  style={{
                    textAlign: "center",
                    background: "#f9fafb",
                    borderBottom: "2px solid #d1d5db",
                    borderRight: "1px solid #e5e7eb",
                    padding: 8,
                    fontWeight: "bold",
                    width: COL_WIDTH,
                    maxWidth: COL_WIDTH,
                  }}
                >
                  {timeLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dayAppointments.map(({ day, appointments }) => (
              <tr key={day.date}>
                {/* Date as the first column */}
                <td
                  style={{
                    padding: 8,
                    textAlign: "center",
                    background: "#f9fafb",
                    fontWeight: 500,
                    borderBottom: "1px solid #e5e7eb",
                    borderRight: "1px solid #e5e7eb",
                    verticalAlign: "middle",
                    minHeight: MIN_ROW_HEIGHT,
                  }}
                >
                  <div>{day.dayLabel}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>
                    {new Date(day.date).toLocaleDateString("mn-MN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </div>
                </td>
                
                {/* Time slots with inline appointment blocks */}
                <td
                  colSpan={timeLabels.length}
                  style={{
                    padding: 0,
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {/* Grid layer with inline appointment blocks */}
                  <div 
                    style={{ 
                      display: "grid",
                      gridTemplateColumns: `repeat(${timeLabels.length}, ${COL_WIDTH}px)`,
                      minHeight: MIN_ROW_HEIGHT,
                    }}
                  >
                    {timeLabels.map((timeLabel, colIndex) => {
  const slot = day.slots.find((s) => getHmFromIso(s.start) === timeLabel);

  // ✅ FIRST handle missing slot
  if (!slot) { ... }
  if (slot.status === "off") { ... }

  // ✅ THEN compute these (slot is guaranteed to exist)
  const slotAppts = (slot.appointmentIds || [])
    .map((id) => apptById.get(id))
    .filter(Boolean) as AppointmentLiteForDetails[];

  const appointmentsAtStart = slotAppts.filter(
    (apt) => getHmFromIso(apt.scheduledAt) === timeLabel
  );

  const appointmentsContinuing = slotAppts.filter((apt) => {
    const aptStartHm = getHmFromIso(apt.scheduledAt);
    if (aptStartHm === timeLabel) return false;

    const aptStart = new Date(apt.scheduledAt);
    const aptEnd = apt.endAt
      ? new Date(apt.endAt)
      : new Date(aptStart.getTime() + followUpSlotMinutes * 60_000);

    const cellStart = new Date(slot.start);
    const cellEnd = new Date(cellStart.getTime() + followUpSlotMinutes * 60_000);

    return aptStart < cellEnd && aptEnd > cellStart;
  });

  return(
                          <div
                            key={`${day.date}-${timeLabel}`}
                            style={{
                              padding: 8,
                              background: "rgba(249, 250, 251, 0.6)",
                              textAlign: "center",
                              borderRight: colIndex < timeLabels.length - 1 ? "1px solid #e5e7eb" : "none",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            –
                          </div>
                        );
                      }

                      if (slot.status === "off") {
                        return (
                          <div
                            key={`${day.date}-${timeLabel}`}
                            style={{
                              padding: 8,
                              background: "rgba(243, 244, 246, 0.7)",
                              color: "#9ca3af",
                              textAlign: "center",
                              borderRight: colIndex < timeLabels.length - 1 ? "1px solid #e5e7eb" : "none",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            -
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${day.date}-${timeLabel}`}
                          style={{
                            padding: 4,
                            background: slot.status === "booked" ? "rgba(254, 242, 242, 0.7)" : "rgba(236, 253, 243, 0.7)",
                            borderRight: colIndex < timeLabels.length - 1 ? "1px solid #e5e7eb" : "none",
                            cursor: followUpBooking ? "not-allowed" : "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            alignItems: "stretch",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                          onClick={() => {
                            if (slot.status === "booked") {
                              handleBookedSlotClick(slot.appointmentIds || [], day.date, timeLabel, slot.start);
                            } else {
                              handleSlotSelection(slot.start);
                            }
                          }}
                        >
                          {/* Show appointment blocks if any start at this time */}
                          {appointmentsAtStart.length > 0 ? (
  appointmentsAtStart.slice(0, 2).map((apt) => (
    <div key={apt.id} ...>
      {nameOnly(formatGridShortLabel(apt)) || "Захиалга"}
    </div>
  ))
) : appointmentsContinuing.length > 0 ? (
  appointmentsContinuing.slice(0, 2).map((apt) => (
    <div
      key={apt.id}
      style={{
        width: "100%",
        maxWidth: "100%",
        padding: "2px 6px",
        borderRadius: BLOCK_BORDER_RADIUS,
        border: "1px dashed rgba(153,27,27,0.45)",
        background: "rgba(254, 202, 202, 0.35)",
        color: "#991b1b",
        fontSize: 11,
        fontWeight: 700,
        textAlign: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
      title={`Үргэлжилж байна: ${nameOnly(formatGridShortLabel(apt)) || "Захиалга"}`}
      onClick={(e) => {
        e.stopPropagation();
        // Open the slot details for this time with all ids in this slot
        handleBookedSlotClick(slot.appointmentIds || [], day.date, timeLabel, slot.start);
      }}
    >
      →
    </div>
  ))
) : (
  <div style={{ fontSize: 11, color: "#166534", textAlign: "center" }}>
    Сул
  </div>
)}
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <label>
          <input
            type="checkbox"
            checked={showFollowUpScheduler}
            disabled={followUpLoading}
            onChange={(e) => onToggleScheduler(e.target.checked)}
          />
          <span>Давтан үзлэгийн цаг авах</span>
        </label>

        {followUpLoading && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            (ачаалж байна...)
          </span>
        )}

        {followUpError && (
          <span style={{ fontSize: 12, color: "#b91c1c" }}>
            {followUpError}
          </span>
        )}

        {followUpSuccess && (
          <span style={{ fontSize: 12, color: "#16a34a" }}>
            {followUpSuccess}
          </span>
        )}
      </div>

      {showFollowUpScheduler && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 12,
              fontSize: 13,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <label>Эхлэх:</label>
              <input
                type="date"
                value={followUpDateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <label>Дуусах:</label>
              <input
                type="date"
                value={followUpDateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <label>Нэг цагийн үргэлжлэх хугацаа:</label>
              <select
                value={followUpSlotMinutes}
                onChange={(e) => onSlotMinutesChange(Number(e.target.value))}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              >
                <option value={30}>30 минут</option>
                <option value={60}>60 минут</option>
                <option value={90}>90 минут</option>
                <option value={120}>120 минут</option>
              </select>
            </div>
          </div>

          {followUpNoSchedule && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid #fde68a",
                background: "#fffbeb",
                color: "#92400e",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Эмчийн цагийн хуваарь тохируулаагүй байна
              </div>
              <div style={{ fontSize: 12 }}>Давтан үзлэгийн цагийг гарын авлагаар оруулна уу.</div>

              {/* Quick Create */}
              <div
                style={{ display: "flex", gap: 10, marginTop: 10, justifyContent: "space-between" }}
              >
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  style={{
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                  }}
                />
                <input
                  type="time"
                  value={quickTime}
                  onChange={(e) => setQuickTime(e.target.value)}
                  style={{
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                  }}
                />
                <select
                  value={quickDuration}
                  onChange={(e) => setQuickDuration(Number(e.target.value))}
                  style={{
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                  }}
                >
                  <option value={30}>30 минут</option>
                  <option value={60}>60 минут</option>
                  <option value={90}>90 минут</option>
                  <option value={120}>120 минут</option>
                </select>
                <button
                  type="button"
                  disabled={followUpBooking || !onQuickCreate}
                  onClick={() =>
                    onQuickCreate?.({ date: quickDate, time: quickTime, durationMinutes: quickDuration })
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "#2563eb",
                    border: "1px solid #2563eb",
                    color: "white",
                    cursor: followUpBooking ? "not-allowed" : "pointer",
                    fontWeight: 500,
                  }}
                >
                  Гараар цаг үүсгэх
                </button>
              </div>
            </div>
          )}

          {localAvailability && localAvailability.days.length > 0 && renderGrid()}
        </>
      )}
      {/* Render Details Modal */}
      {detailsOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    }}
    onClick={() => setDetailsOpen(false)}
  >
    <div
      style={{
        minWidth: "450px",
        maxWidth: "600px",
        padding: 24,
        background: "white",
        borderRadius: 12,
        boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 600 }}>
        Захиалсан цаг - {detailsDate} {detailsTime}
      </h3>

      {/* Occupancy indicator */}
      <div style={{ 
        padding: "8px 12px", 
        background: detailsAppointments.length >= 2 ? "#fee2e2" : "#ecfdf3",
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 14,
        fontWeight: 500,
        color: detailsAppointments.length >= 2 ? "#991b1b" : "#166534",
      }}>
        Дүүргэлт: {detailsAppointments.length}/2
      </div>

      {/* List existing appointments */}
      <div style={{ marginBottom: 16 }}>
        {detailsAppointments.length === 0 ? (
          <div style={{ 
            padding: 12, 
            background: "#f9fafb", 
            borderRadius: 8,
            color: "#6b7280",
            fontSize: 14,
          }}>
            Энэ цагт захиалга байхгүй байна
          </div>
        ) : (
          detailsAppointments.map((a, idx) => (
            <div 
              key={a.id} 
              style={{ 
                marginBottom: 12,
                padding: 12,
                background: "#f9fafb",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontWeight: 600 }}>
                  Захиалга #{idx + 1}
                </div>
                {canDeleteAppointment(a) && (
                  <button
                    type="button"
                    disabled={deletingAppointmentId === a.id}
                    onClick={() => handleDeleteAppointment(a.id)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 4,
                      background: "#ef4444",
                      border: "1px solid #dc2626",
                      color: "white",
                      cursor: deletingAppointmentId === a.id ? "not-allowed" : "pointer",
                      fontWeight: 500,
                      fontSize: 12,
                      opacity: deletingAppointmentId === a.id ? 0.6 : 1,
                    }}
                  >
                    {deletingAppointmentId === a.id ? "Устгаж байна..." : "Устгах"}
                  </button>
                )}
              </div>
              <p style={{ margin: "4px 0", fontSize: 14 }}>
                Үйлчлүүлэгч: <strong>{formatGridShortLabel(a) || "-"}</strong>
              </p>
              <p style={{ margin: "4px 0", fontSize: 14, color: "#6b7280" }}>
                Салбар: <strong>{a.branch?.name || "-"}</strong>
              </p>
              <p style={{ margin: "4px 0", fontSize: 14, color: "#6b7280" }}>
                Хугацаа: {getHmFromIso(a.scheduledAt)} - {a.endAt ? getHmFromIso(a.endAt) : "—"}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {canAddAppointment && (
          <button
            type="button"
            disabled={followUpBooking}
            onClick={() => {
              setDetailsOpen(false);
              setSlotModalOpen(true);
              setSelectedSlot(detailsSlotStart);
            }}
            style={{
              padding: "10px 16px",
              borderRadius: 6,
              background: "#16a34a",
              border: "1px solid #16a34a",
              color: "white",
              cursor: followUpBooking ? "not-allowed" : "pointer",
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            + Шинэ цаг оруулах
          </button>
        )}
        <button
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            background: "#e5e7eb",
            color: "#374151",
            border: "1px solid #d1d5db",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 14,
          }}
          onClick={() => setDetailsOpen(false)}
        >
          Хаах
        </button>
      </div>
    </div>
  </div>
)}

      {/* Duration Selection Modal */}
      {slotModalOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}
    onClick={() => {
      setSlotModalOpen(false);
      setSelectedSlot("");
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        minWidth: "400px",
        padding: "24px",
        background: "white",
        borderRadius: "12px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
        Цагийн үргэлжлэх хугацаа сонгох
      </h3>
      <p style={{ fontSize: 14 }}>Цаг: {selectedSlot ? getHmFromIso(selectedSlot) : ""}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "16px 0" }}>
        {[30, 60, 90, 120].map((duration) => (
          <button
            key={duration}
            onClick={() => handleDurationSelect(duration)}
            disabled={followUpBooking}
            style={{
              padding: "12px",
              borderRadius: 6,
              background: "#ecfdf3",
              border: "1px solid #16a34a",
              color: "#166534",
              cursor: followUpBooking ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {duration} минут
          </button>
        ))}
      </div>
      <button
        style={{
          padding: "8px 16px",
          borderRadius: 6,
          background: "#e5e7eb",
          color: "#374151",
          border: "1px solid #d1d5db",
          cursor: "pointer",
          fontWeight: 500,
        }}
        onClick={() => {
          setSlotModalOpen(false);
          setSelectedSlot("");
        }}
      >
        Болих
      </button>
    </div>
  </div>
)}
    </div>
  );
}

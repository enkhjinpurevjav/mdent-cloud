import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type { Appointment, Branch, ScheduledDoctor } from "../appointments/types";
import { getBusinessYmd, naiveTimestampToYmd, naiveToFakeUtcDate } from "../../utils/businessTime";
import { SLOT_MINUTES, generateTimeSlotsForDay, getDateFromYMD } from "../appointments/time";
import AppointmentsV2Grid from "../appointments-v2/AppointmentsV2Grid";
import {
  MAX_APPOINTMENTS_PER_SLOT,
  SLOT_FULL_MESSAGE,
  getSlotOccupancyForDoctor,
} from "../appointments-v2/slotCapacity";
import {
  assignStableTwoLanes,
  computeDoctorSlotOccupancy,
  getVisibleAppointmentsV2,
} from "../appointments-v2/gridLayoutV2";
import { useScheduledDoctorsV2 } from "../appointments-v2/useScheduledDoctorsV2";
import { useAppointmentsStreamV2 } from "../appointments-v2/useAppointmentsStreamV2";
import QuickAppointmentModal from "../appointments/QuickAppointmentModal";
import AppointmentDetailsModal from "../appointments/AppointmentDetailsModal";
import type { AppointmentBlockGeometry } from "../appointments-v2/AppointmentBlockV2";

const SLOT_HEIGHT_PX = 30;
const MIN_BLOCK_HEIGHT_PX = 18;

type QuickModalState = {
  open: boolean;
  doctorId?: number;
  date: string;
  time: string;
  branchId: string;
};

type DetailsModalState = {
  open: boolean;
  date: string;
  slotTime: string;
  doctor: ScheduledDoctor | null;
  appointments: Appointment[];
};

function appointmentInCurrentView(a: Appointment, date: string, branchId: string) {
  if (naiveTimestampToYmd(a.scheduledAt) !== date) return false;
  if (branchId && String(a.branchId) !== branchId) return false;
  return true;
}

export default function AppointmentsPageV2() {
  const { me } = useAuth();
  const isAdminRole = me?.role === "admin" || me?.role === "super_admin";

  const [selectedDate, setSelectedDate] = useState(getBusinessYmd());
  const [selectedBranchId, setSelectedBranchId] = useState("");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [error, setError] = useState("");
  const [capacityMessage, setCapacityMessage] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [quickModalState, setQuickModalState] = useState<QuickModalState>({
    open: false,
    doctorId: undefined,
    date: selectedDate,
    time: "09:00",
    branchId: "",
  });
  const [detailsModalState, setDetailsModalState] = useState<DetailsModalState>({
    open: false,
    date: selectedDate,
    slotTime: "09:00",
    doctor: null,
    appointments: [],
  });
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const appointmentsRequestIdRef = useRef(0);
  const {
    scheduledDoctors,
    loading: scheduledDoctorsLoading,
    error: scheduledDoctorsError,
  } = useScheduledDoctorsV2({ date: selectedDate, branchId: selectedBranchId });

  useEffect(() => {
    const controller = new AbortController();

    async function loadBranches() {
      setBranchesLoading(true);
      try {
        const res = await fetch("/api/branches", { signal: controller.signal });
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          setBranches([]);
          return;
        }
        setBranches(data);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setBranches([]);
      } finally {
        if (!controller.signal.aborted) setBranchesLoading(false);
      }
    }

    loadBranches();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;

    const controller = new AbortController();
    appointmentsRequestIdRef.current += 1;
    const requestId = appointmentsRequestIdRef.current;

    async function loadAppointments() {
      setAppointmentsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ date: selectedDate });
        if (selectedBranchId) params.set("branchId", selectedBranchId);

        const res = await fetch(`/api/appointments?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => []);

        if (controller.signal.aborted) return;
        if (requestId !== appointmentsRequestIdRef.current) return;

        if (!res.ok || !Array.isArray(data)) {
          setAppointments([]);
          setError("Цаг захиалгуудыг ачаалах үед алдаа гарлаа.");
          return;
        }

        setAppointments(data);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (requestId !== appointmentsRequestIdRef.current) return;
        setAppointments([]);
        setError("Цаг захиалгуудыг ачаалах үед алдаа гарлаа.");
      } finally {
        if (!controller.signal.aborted && requestId === appointmentsRequestIdRef.current) {
          setAppointmentsLoading(false);
        }
      }
    }

    loadAppointments();
    return () => controller.abort();
  }, [selectedDate, selectedBranchId]);

  const upsertAppointment = useCallback(
    (appointment: Appointment) => {
      setAppointments((prev) => {
        const inView = appointmentInCurrentView(appointment, selectedDate, selectedBranchId);
        const idx = prev.findIndex((a) => a.id === appointment.id);

        if (!inView) {
          if (idx === -1) return prev;
          return prev.filter((a) => a.id !== appointment.id);
        }

        if (idx === -1) return [appointment, ...prev];

        const next = [...prev];
        next[idx] = { ...next[idx], ...appointment };
        return next;
      });
    },
    [selectedDate, selectedBranchId]
  );

  const removeAppointment = useCallback((id: number) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const { status: sseStatus, lastEventAt } = useAppointmentsStreamV2({
    date: selectedDate,
    branchId: selectedBranchId,
    onCreated: upsertAppointment,
    onUpdated: upsertAppointment,
    onDeleted: (payload) => removeAppointment(payload.id),
  });

  const timeSlots = useMemo(() => generateTimeSlotsForDay(getDateFromYMD(selectedDate)), [selectedDate]);

  const firstSlot = timeSlots[0]?.start;
  const lastSlot = timeSlots[timeSlots.length - 1]?.end;
  const totalMinutes = useMemo(() => {
    if (!firstSlot || !lastSlot) return 1;
    return Math.max(1, (lastSlot.getTime() - firstSlot.getTime()) / 60000);
  }, [firstSlot, lastSlot]);
  const columnHeightPx = timeSlots.length * SLOT_HEIGHT_PX;

  const appointmentsByDoctorId = useMemo(() => {
    const grouped: Record<number, Appointment[]> = {};
    for (const appointment of getVisibleAppointmentsV2(appointments)) {
      if (!appointment?.doctorId) continue;
      if (!grouped[appointment.doctorId]) grouped[appointment.doctorId] = [];
      grouped[appointment.doctorId].push(appointment);
    }
    return grouped;
  }, [appointments]);

  const blocksByDoctorId = useMemo(() => {
    const result: Record<number, AppointmentBlockGeometry[]> = {};
    if (!firstSlot) return result;

    const dayStartMs = firstSlot.getTime();

    for (const doctor of scheduledDoctors) {
      const doctorAppointments = appointmentsByDoctorId[doctor.id] || [];
      const { laneByAppointmentId, overlappingAppointmentIds } = assignStableTwoLanes(doctorAppointments);
      const sortedAppointments = [...doctorAppointments].sort((a, b) => {
        const sa = naiveToFakeUtcDate(a.scheduledAt).getTime();
        const sb = naiveToFakeUtcDate(b.scheduledAt).getTime();
        return sa - sb || a.id - b.id;
      });

      const blocks: AppointmentBlockGeometry[] = [];

      for (const appointment of sortedAppointments) {
        const startMs = naiveToFakeUtcDate(appointment.scheduledAt).getTime();
        const defaultEnd = startMs + SLOT_MINUTES * 60_000;
        const endMs = appointment.endAt
          ? naiveToFakeUtcDate(appointment.endAt).getTime()
          : defaultEnd;

        const clampedStartMs = Math.max(dayStartMs, startMs);
        const clampedEndMs = Math.max(clampedStartMs + 1, endMs);

        const minutesFromStart = (clampedStartMs - dayStartMs) / 60000;
        const durationMinutes = Math.max(1, (clampedEndMs - clampedStartMs) / 60000);

        blocks.push({
          appointment,
          top: (minutesFromStart / totalMinutes) * columnHeightPx,
          height: Math.max(MIN_BLOCK_HEIGHT_PX, (durationMinutes / totalMinutes) * columnHeightPx),
          lane: laneByAppointmentId[appointment.id] ?? 0,
          split: overlappingAppointmentIds.has(appointment.id),
        });
      }

      result[doctor.id] = blocks;
    }

    return result;
  }, [appointmentsByDoctorId, scheduledDoctors, firstSlot, totalMinutes, columnHeightPx]);

  const doctorsById = useMemo(() => {
    const map: Record<number, ScheduledDoctor> = {};
    for (const doctor of scheduledDoctors) map[doctor.id] = doctor;
    return map;
  }, [scheduledDoctors]);

  const resolveDoctorBranchIdForDay = useCallback(
    (doctor: ScheduledDoctor) => {
      const scheduleForDay =
        (doctor.schedules || []).find(
          (s) => s.date === selectedDate && (!selectedBranchId || String(s.branchId) === selectedBranchId)
        ) || (doctor.schedules || []).find((s) => s.date === selectedDate);
      if (scheduleForDay?.branchId != null) return String(scheduleForDay.branchId);
      return selectedBranchId;
    },
    [selectedDate, selectedBranchId]
  );

  const slotOccupancyByDoctorId = useMemo(
    () =>
      computeDoctorSlotOccupancy({
        appointments,
        scheduledDoctors,
        timeSlots,
        resolveDoctorBranchIdForDay,
      }),
    [appointments, resolveDoctorBranchIdForDay, scheduledDoctors, timeSlots]
  );

  const handleCellClick = useCallback(
    (doctor: ScheduledDoctor, slotLabel: string) => {
      const modalBranchId = resolveDoctorBranchIdForDay(doctor);
      const parsedBranchId = Number(modalBranchId);
      if (!Number.isNaN(parsedBranchId) && parsedBranchId > 0) {
        const slotStartMs = naiveToFakeUtcDate(`${selectedDate} ${slotLabel}:00`).getTime();
        const occupancy = getSlotOccupancyForDoctor({
          appointments,
          doctorId: doctor.id,
          branchId: parsedBranchId,
          slotStartMs,
        });
        if (occupancy >= MAX_APPOINTMENTS_PER_SLOT) {
          setCapacityMessage(SLOT_FULL_MESSAGE);
          return;
        }
      }

      setEditingAppointment(null);
      setCapacityMessage("");
      setQuickModalState({
        open: true,
        doctorId: doctor.id,
        date: selectedDate,
        time: slotLabel,
        branchId: modalBranchId,
      });
    },
    [appointments, resolveDoctorBranchIdForDay, selectedDate]
  );

  const handleAppointmentClick = useCallback(
    (appointment: Appointment) => {
      setDetailsModalState({
        open: true,
        date: selectedDate,
        slotTime: appointment.scheduledAt.slice(11, 16),
        doctor: appointment.doctorId ? doctorsById[appointment.doctorId] || null : null,
        appointments: [appointment],
      });
    },
    [doctorsById, selectedDate]
  );

  if (!isAdminRole) {
    return (
      <div style={{ padding: 20, color: "#b91c1c", fontWeight: 600 }}>
        Энэ хуудсанд нэвтрэх эрхгүй байна.
      </div>
    );
  }

  const loading = appointmentsLoading || scheduledDoctorsLoading || branchesLoading;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Цаг захиалга v2</h1>
        <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
          SSE: {sseStatus}
          {lastEventAt ? ` · Last: ${lastEventAt.toLocaleTimeString("mn-MN", { hour12: false })}` : ""}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
          padding: 10,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          Өдөр:
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 8px" }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          Салбар:
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 8px", minWidth: 180 }}
          >
            <option value="">Бүх салбар</option>
            {branches.map((branch) => (
              <option key={branch.id} value={String(branch.id)}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(error || scheduledDoctorsError) && (
        <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>
          {error || scheduledDoctorsError}
        </div>
      )}
      {capacityMessage && (
        <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
          {capacityMessage}
        </div>
      )}

      {loading && (
        <div style={{ marginBottom: 10, fontSize: 13, color: "#475569" }}>
          Ачаалж байна...
        </div>
      )}

      <AppointmentsV2Grid
        doctors={scheduledDoctors}
        timeSlots={timeSlots}
        slotHeightPx={SLOT_HEIGHT_PX}
        columnHeightPx={columnHeightPx}
        blocksByDoctorId={blocksByDoctorId}
        slotOccupancyByDoctorId={slotOccupancyByDoctorId}
        onCellClick={handleCellClick}
        onAppointmentClick={handleAppointmentClick}
      />

      <AppointmentDetailsModal
        open={detailsModalState.open}
        onClose={() => setDetailsModalState((prev) => ({ ...prev, open: false }))}
        doctor={detailsModalState.doctor}
        slotTime={detailsModalState.slotTime}
        slotLabel={detailsModalState.slotTime}
        date={detailsModalState.date}
        appointments={detailsModalState.appointments}
        slotAppointmentCount={detailsModalState.appointments.length}
        currentUserRole={me?.role ?? null}
        onStatusUpdated={(updated) => {
          upsertAppointment(updated);
          setDetailsModalState((prev) => ({
            ...prev,
            appointments: prev.appointments
              .map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
              .filter((a) => String(a.status || "").toLowerCase() !== "cancelled"),
          }));
        }}
        onEditAppointment={(a) => {
          setEditingAppointment(a);
          setQuickModalState({
            open: true,
            doctorId: a.doctorId ?? undefined,
            date: selectedDate,
            time: a.scheduledAt.slice(11, 16),
            branchId: String(a.branchId || selectedBranchId),
          });
          setDetailsModalState((prev) => ({ ...prev, open: false }));
        }}
      />

      <QuickAppointmentModal
        open={quickModalState.open}
        onClose={() => {
          setQuickModalState((prev) => ({ ...prev, open: false }));
          setEditingAppointment(null);
        }}
        defaultDoctorId={quickModalState.doctorId}
        defaultDate={quickModalState.date}
        defaultTime={quickModalState.time}
        branches={branches}
        doctors={scheduledDoctors}
        scheduledDoctors={scheduledDoctors}
        appointments={appointments}
        selectedBranchId={quickModalState.branchId || selectedBranchId}
        allowAutoDefaultBranch={false}
        enforceSlotCapacity
        slotFullMessage={SLOT_FULL_MESSAGE}
        editingAppointment={editingAppointment}
        currentUserRole={me?.role ?? null}
        onCreated={(appointment) => {
          upsertAppointment(appointment);
          setQuickModalState((prev) => ({ ...prev, open: false }));
        }}
        onUpdated={(appointment) => {
          upsertAppointment(appointment);
          setQuickModalState((prev) => ({ ...prev, open: false }));
          setEditingAppointment(null);
        }}
      />
    </div>
  );
}

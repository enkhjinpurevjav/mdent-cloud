import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type { Appointment, Branch, ScheduledDoctor } from "../appointments/types";
import { getBusinessYmd, naiveTimestampToYmd, naiveToFakeUtcDate } from "../../utils/businessTime";
import { isTimeWithinRange, SLOT_MINUTES, generateTimeSlotsForDay, getDateFromYMD } from "../appointments/time";
import { formatHistoryDate } from "../appointments/formatters";
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
import QuickAppointmentModal from "../appointments-v2/QuickAppointmentModalV2";
import AppointmentDetailsModal from "../appointments/AppointmentDetailsModal";
import type { AppointmentBlockGeometry } from "../appointments-v2/AppointmentBlockV2";
import SpecialBookingModalV2 from "../appointments-v2/SpecialBookingModalV2";
import {
  PATIENT_SEARCH_DEBOUNCE_MS,
  PATIENT_SEARCH_MIN_CHARS,
  type PatientSearchResult,
  formatPatientSearchDropdownRow,
  searchPatientsByRules,
} from "../appointments-v2/patientSearchRules";

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
  slotAppointmentCount?: number;
};

type PatientQuickResult = PatientSearchResult;

type RecentCompletedVisit = {
  id: number;
  scheduledAt: string;
  doctorName: string;
};

function formatPatientQuickLabel(patient: PatientQuickResult) {
  return formatPatientSearchDropdownRow(patient);
}

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
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientQuickResult[]>([]);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [highlightedPatientIndex, setHighlightedPatientIndex] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState<PatientQuickResult | null>(null);
  const [selectedPatientRecent, setSelectedPatientRecent] = useState<RecentCompletedVisit[]>([]);
  const [selectedPatientHistoryLoading, setSelectedPatientHistoryLoading] = useState(false);
  const [specialBookingOpen, setSpecialBookingOpen] = useState(false);

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
  const patientSearchRequestIdRef = useRef(0);
  const suppressPatientSearchRef = useRef(false);
  const patientSearchAreaRef = useRef<HTMLDivElement | null>(null);

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
    (doctor: ScheduledDoctor, slotLabel?: string) => {
      const scheduleForDay =
        (doctor.schedules || []).find((s) => {
          if (s.date !== selectedDate) return false;
          if (selectedBranchId && String(s.branchId) !== selectedBranchId) return false;
          if (slotLabel && !isTimeWithinRange(slotLabel, s.startTime, s.endTime)) return false;
          return true;
        }) ||
        (doctor.schedules || []).find((s) => {
          if (s.date !== selectedDate) return false;
          return slotLabel ? isTimeWithinRange(slotLabel, s.startTime, s.endTime) : true;
        }) ||
        (doctor.schedules || []).find(
          (s) => s.date === selectedDate && (!selectedBranchId || String(s.branchId) === selectedBranchId)
        ) ||
        (doctor.schedules || []).find((s) => s.date === selectedDate);
      if (scheduleForDay?.branchId != null) return String(scheduleForDay.branchId);
      if (selectedBranchId) return selectedBranchId;
      return "";
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

  useEffect(() => {
    const trimmed = patientQuery.trim();
    if (suppressPatientSearchRef.current) {
      suppressPatientSearchRef.current = false;
      return;
    }
    if (trimmed.length < PATIENT_SEARCH_MIN_CHARS) {
      setPatientResults([]);
      setPatientSearchOpen(false);
      setHighlightedPatientIndex(0);
      return;
    }

    const currentRequestId = ++patientSearchRequestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const data = await searchPatientsByRules(trimmed);
        if (currentRequestId !== patientSearchRequestIdRef.current) return;
        setPatientResults(data as PatientQuickResult[]);
        setHighlightedPatientIndex(0);
        setPatientSearchOpen(data.length > 0);
      } catch {
        if (currentRequestId !== patientSearchRequestIdRef.current) return;
        setPatientResults([]);
        setPatientSearchOpen(false);
      }
    }, PATIENT_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [patientQuery]);

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!patientSearchAreaRef.current?.contains(event.target as Node)) {
        setPatientSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, []);

  const loadSelectedPatientRecent = useCallback(async (patientId: number) => {
    try {
      setSelectedPatientHistoryLoading(true);
      const res = await fetch(`/api/patients/${patientId}/recent-completed?limit=3`);
      const data = await res.json().catch(() => []);
      if (!res.ok || !Array.isArray(data)) {
        setSelectedPatientRecent([]);
        return;
      }
      setSelectedPatientRecent(data as RecentCompletedVisit[]);
    } catch {
      setSelectedPatientRecent([]);
    } finally {
      setSelectedPatientHistoryLoading(false);
    }
  }, []);

  const handleSelectPatient = useCallback(
    (patient: PatientQuickResult) => {
      setSelectedPatient(patient);
      setSelectedPatientRecent([]);
      setPatientResults([]);
      setPatientSearchOpen(false);
      setHighlightedPatientIndex(0);
      suppressPatientSearchRef.current = true;
      setPatientQuery(formatPatientQuickLabel(patient));
      loadSelectedPatientRecent(patient.id);
    },
    [loadSelectedPatientRecent]
  );

  const clearSelectedPatient = useCallback(() => {
    setSelectedPatient(null);
    setSelectedPatientRecent([]);
    setPatientResults([]);
    setPatientSearchOpen(false);
    setHighlightedPatientIndex(0);
    setPatientQuery("");
  }, []);

  const handlePatientQueryChange = useCallback((value: string) => {
    setPatientQuery(value);
    if (selectedPatient) {
      setSelectedPatient(null);
      setSelectedPatientRecent([]);
    }
    if (value.trim().length >= PATIENT_SEARCH_MIN_CHARS) setPatientSearchOpen(true);
  }, [selectedPatient]);

  const handlePatientInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPatientSearchOpen(false);
        return;
      }
      if (!patientResults.length || !patientSearchOpen) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedPatientIndex((prev) => Math.min(prev + 1, patientResults.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedPatientIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const quickPick =
          patientResults.length === 1
            ? patientResults[0]
            : patientResults[highlightedPatientIndex];
        if (quickPick) handleSelectPatient(quickPick);
      }
    },
    [handleSelectPatient, highlightedPatientIndex, patientResults, patientSearchOpen]
  );

  const handleCellClick = useCallback(
    (doctor: ScheduledDoctor, slotLabel: string) => {
      const modalBranchId = resolveDoctorBranchIdForDay(doctor, slotLabel);
      const parsedBranchId = Number(modalBranchId);
      if (Number.isNaN(parsedBranchId) || parsedBranchId <= 0) {
        setCapacityMessage("Салбар тодорхойгүй байна. Салбар сонгоод дахин оролдоно уу.");
        return;
      }
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
      const slotBranchId =
        appointment.branchId != null && !Number.isNaN(Number(appointment.branchId))
          ? Number(appointment.branchId)
          : null;
      const slotAppointmentCount =
        appointment.doctorId != null && slotBranchId
          ? getSlotOccupancyForDoctor({
              appointments,
              doctorId: appointment.doctorId,
              branchId: slotBranchId,
              slotStartMs: naiveToFakeUtcDate(appointment.scheduledAt).getTime(),
            })
          : 0;
      setDetailsModalState({
        open: true,
        date: selectedDate,
        slotTime: appointment.scheduledAt.slice(11, 16),
        doctor: appointment.doctorId ? doctorsById[appointment.doctorId] || null : null,
        appointments: [appointment],
        slotAppointmentCount,
      });
    },
    [appointments, doctorsById, selectedDate]
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
      <style jsx global>{`
        @keyframes readyToPayPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
        @keyframes readyToPayBlink {
          0%,
          100% {
            filter: saturate(1);
            opacity: 1;
          }
          50% {
            filter: saturate(1.8);
            opacity: 0.82;
          }
        }
      `}</style>
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

        <div
          ref={patientSearchAreaRef}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            minWidth: 360,
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>Хайх</label>
          <div style={{ position: "relative", width: 320 }}>
            <input
              type="text"
              value={patientQuery}
              onChange={(e) => handlePatientQueryChange(e.target.value)}
              onKeyDown={handlePatientInputKeyDown}
              onFocus={() => {
                if (patientResults.length > 0) setPatientSearchOpen(true);
              }}
              placeholder="Үйлчлүүлэгчийн овог, нэр, утас, РД"
              autoComplete="off"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "5px 8px",
                width: "100%",
              }}
            />
            {patientSearchOpen && patientResults.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  width: "100%",
                  maxHeight: 220,
                  overflowY: "auto",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#ffffff",
                  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.12)",
                  zIndex: 30,
                }}
              >
                {patientResults.map((patient, index) => (
                  <button
                    key={`${patient.id}-${index}`}
                    type="button"
                    onClick={() => handleSelectPatient(patient)}
                    style={{
                      width: "100%",
                      border: "none",
                      textAlign: "left",
                      padding: "7px 9px",
                      background: index === highlightedPatientIndex ? "#eff6ff" : "#ffffff",
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {formatPatientQuickLabel(patient)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSpecialBookingOpen(true)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "none",
              background: "#0f172a",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Онцгой захиалга
          </button>
        </div>
      </div>

      {selectedPatient && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            background: "#f8fafc",
            maxWidth: 640,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 700 }}>
              {[selectedPatient.name, selectedPatient.ovog || ""].filter(Boolean).join(" ")}
            </div>
            <button
              type="button"
              onClick={clearSelectedPatient}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#64748b",
                fontSize: 12,
              }}
            >
              Арилгах
            </button>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#334155" }}>
            🆔 {selectedPatient.regNo || "-"} · 📞 {selectedPatient.phone || "-"}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#475569", fontWeight: 600 }}>
            Сүүлийн 3 дууссан үзлэг
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#334155" }}>
            {selectedPatientHistoryLoading ? (
              <div style={{ color: "#94a3b8" }}>Уншиж байна...</div>
            ) : selectedPatientRecent.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>Өмнөх дууссан үзлэг байхгүй</div>
            ) : (
              selectedPatientRecent.map((visit) => (
                <div key={visit.id}>
                  {formatHistoryDate(visit.scheduledAt)} — Эмч: {visit.doctorName || "-"}
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
        slotAppointmentCount={detailsModalState.slotAppointmentCount}
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
        onCreateAppointmentInSlot={() => {
          const doctor = detailsModalState.doctor;
          const slotTime = detailsModalState.slotTime;
          const fallbackAppointment = detailsModalState.appointments[0];
          const resolvedBranchId =
            fallbackAppointment?.branchId != null
              ? String(fallbackAppointment.branchId)
              : doctor
              ? resolveDoctorBranchIdForDay(doctor, slotTime)
              : selectedBranchId;
          const parsedBranchId = Number(resolvedBranchId);
          if (Number.isNaN(parsedBranchId) || parsedBranchId <= 0) {
            setCapacityMessage("Салбар тодорхойгүй байна. Салбар сонгоод дахин оролдоно уу.");
            return;
          }
          if (doctor?.id) {
            const slotStartMs = naiveToFakeUtcDate(`${detailsModalState.date} ${slotTime}:00`).getTime();
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
          setCapacityMessage("");
          setEditingAppointment(null);
          setQuickModalState({
            open: true,
            doctorId: doctor?.id,
            date: detailsModalState.date,
            time: slotTime || "09:00",
            branchId: resolvedBranchId,
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
        defaultPatientId={selectedPatient?.id ?? null}
        defaultPatientQuery={selectedPatient ? formatPatientQuickLabel(selectedPatient) : ""}
        enforceSlotCapacity
        slotFullMessage={SLOT_FULL_MESSAGE}
        editingAppointment={editingAppointment}
        currentUserRole={me?.role ?? null}
        onCreated={(appointment) => {
          upsertAppointment(appointment);
          setQuickModalState((prev) => ({ ...prev, open: false }));
          clearSelectedPatient();
        }}
        onUpdated={(appointment) => {
          upsertAppointment(appointment);
          setQuickModalState((prev) => ({ ...prev, open: false }));
          setEditingAppointment(null);
        }}
      />
      <SpecialBookingModalV2
        open={specialBookingOpen}
        onClose={() => setSpecialBookingOpen(false)}
        branches={branches}
        doctors={scheduledDoctors}
        appointments={appointments}
        defaultDate={selectedDate}
        defaultBranchId={selectedBranchId}
        onCreated={(appointment) => {
          upsertAppointment(appointment);
          clearSelectedPatient();
        }}
      />
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../contexts/AuthContext";
import type { Appointment, Branch, Doctor, ScheduledDoctor } from "../appointments/types";
import {
  BUSINESS_TIME_ZONE,
  fakeUtcDateToNaive,
  getBusinessYmd,
  naiveTimestampToYmd,
  naiveToFakeUtcDate,
} from "../../utils/businessTime";
import { isTimeWithinRange, SLOT_MINUTES, generateTimeSlotsForDay, getDateFromYMD } from "../appointments/time";
import { formatHistoryDate } from "../appointments/formatters";
import AppointmentsV2Grid from "../appointments-v2/AppointmentsV2Grid";
import {
  findFirstFullSlotForCandidate,
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
import PriceListSearch from "../reception/PriceListSearch";
import {
  PATIENT_SEARCH_DEBOUNCE_MS,
  PATIENT_SEARCH_MIN_CHARS,
  type PatientSearchResult,
  formatPatientNameOvogFirst,
  formatPatientSearchDropdownRow,
  searchPatientsByRules,
} from "../appointments-v2/patientSearchRules";

function normalizeDoctorBranches(input: any): { id: number; name: string }[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((branch: any) => {
      const id = Number(branch?.id);
      if (Number.isNaN(id) || id <= 0) return null;
      return {
        id,
        name: String(branch?.name ?? ""),
      };
    })
    .filter((branch): branch is { id: number; name: string } => Boolean(branch));
}

const SLOT_HEIGHT_PX = 30;
const MIN_BLOCK_HEIGHT_PX = 18;
const GRID_TIME_COL_WIDTH = 80;
const GRID_DOCTOR_COL_WIDTH = 180;
const GRID_STICKY_HEADER_HEIGHT = 41;

type DraftAppointmentChange = {
  scheduledAt: string;
  endAt: string | null;
  doctorId: number | null;
};

type DragMode = "move" | "resize";

type DragState = {
  appointmentId: number;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  origStart: Date;
  origEnd: Date;
  origDoctorId: number | null;
  hasMovedBeyondThreshold: boolean;
  hadExplicitEndAt: boolean;
};

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

function canEditAppointment(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed" || normalized === "ongoing") return false;
  return ["booked", "confirmed", "online", "other"].includes(normalized);
}

const ACTIVE_FALLBACK_STATUSES = new Set([
  "booked",
  "confirmed",
  "online",
  "ongoing",
  "imaging",
  "ready_to_pay",
  "partial_paid",
  "other",
]);

function keepsUnscheduledDoctorVisible(status: string) {
  return ACTIVE_FALLBACK_STATUSES.has(String(status || "").toLowerCase());
}

export default function AppointmentsPageV2() {
  const router = useRouter();
  const { me } = useAuth();
  const isReceptionRoute = router.pathname.startsWith("/reception/");
  const isMarketingRoute = router.pathname.startsWith("/marketing/");
  const isFrontdeskRoute = isReceptionRoute || isMarketingRoute;
  const appointmentsBasePath = isMarketingRoute
    ? "/marketing/appointments"
    : isReceptionRoute
      ? "/reception/appointments"
      : "/appointments-v2";
  const branchIdFromQuery =
    typeof router.query.branchId === "string" ? router.query.branchId : "";
  const isAdminRole = me?.role === "admin" || me?.role === "super_admin";
  const isReceptionist = me?.role === "receptionist";
  const isMarketing = me?.role === "marketing";
  const isAllowedRole = isAdminRole || isReceptionist || isMarketing;
  const isFrontdeskRole = isReceptionist || isMarketing;
  const ownBranchId = me?.branchId != null ? String(me.branchId) : null;

  const [selectedDate, setSelectedDate] = useState(getBusinessYmd());
  const [selectedBranchId, setSelectedBranchId] = useState(branchIdFromQuery || "");

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
  const [draftEdits, setDraftEdits] = useState<Record<number, DraftAppointmentChange>>({});
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
  const [pendingSaveId, setPendingSaveId] = useState<number | null>(null);
  const [pendingSaveError, setPendingSaveError] = useState<string | null>(null);
  const [pendingSaving, setPendingSaving] = useState(false);
  const [nowPosition, setNowPosition] = useState<number | null>(null);
  const [invalidDragAppointmentId, setInvalidDragAppointmentId] = useState<number | null>(null);
  const [dragPreviewDoctorId, setDragPreviewDoctorId] = useState<number | null>(null);
  const [dragPreviewSlotLabels, setDragPreviewSlotLabels] = useState<string[]>([]);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const lastPointerEventRef = useRef<MouseEvent | null>(null);
  const patientSearchRequestIdRef = useRef(0);
  const suppressPatientSearchRef = useRef(false);
  const patientSearchAreaRef = useRef<HTMLDivElement | null>(null);
  const receptionistRedirectedRef = useRef(false);
  useEffect(() => {
    if (branchIdFromQuery) {
      receptionistRedirectedRef.current = false;
      setSelectedBranchId((prev) => (prev === branchIdFromQuery ? prev : branchIdFromQuery));
      return;
    }
    if (isReceptionist && ownBranchId) {
      setSelectedBranchId((prev) => (prev === ownBranchId ? prev : ownBranchId));
      if (!receptionistRedirectedRef.current) {
        receptionistRedirectedRef.current = true;
        router.replace(
          { pathname: appointmentsBasePath, query: { branchId: ownBranchId } },
          undefined,
          { shallow: true }
        );
      }
      return;
    }
    receptionistRedirectedRef.current = false;
    setSelectedBranchId((prev) => (prev === "" ? prev : ""));
  }, [
    appointmentsBasePath,
    branchIdFromQuery,
    isReceptionist,
    ownBranchId,
    router,
  ]);

  const appointmentsRequestIdRef = useRef(0);
  const {
    scheduledDoctors,
    loading: scheduledDoctorsLoading,
    error: scheduledDoctorsError,
  } = useScheduledDoctorsV2({ date: selectedDate, branchId: selectedBranchId });
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [allDoctorsError, setAllDoctorsError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadAllDoctors() {
      setAllDoctorsError("");
      try {
        const res = await fetch("/api/users?role=doctor", { signal: controller.signal });
        const data = await res.json().catch(() => []);
        if (controller.signal.aborted) return;
        if (!res.ok || !Array.isArray(data)) {
          setAllDoctors([]);
          setAllDoctorsError("Эмчийн жагсаалт ачаалахад алдаа гарлаа.");
          return;
        }
        setAllDoctors(
          data.map((row: any) => ({
            id: Number(row?.id),
            name: row?.name ?? null,
            ovog: row?.ovog ?? null,
            regNo: row?.regNo ?? null,
            phone: row?.phone ?? null,
            calendarOrder:
              row?.calendarOrder == null || Number.isNaN(Number(row?.calendarOrder))
                ? null
                : Number(row.calendarOrder),
            branches: normalizeDoctorBranches(row?.branches),
          }))
          .filter((doctor: Doctor) => Number.isFinite(doctor.id) && doctor.id > 0)
        );
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setAllDoctors([]);
        setAllDoctorsError("Эмчийн жагсаалт ачаалахад алдаа гарлаа.");
      }
    }
    loadAllDoctors();
    return () => controller.abort();
  }, []);

  const doctorsForGrid = useMemo(() => {
    // Keep backend order as source-of-truth so shift-aware ordering remains intact.
    const scheduledList = [...scheduledDoctors];
    const scheduledIds = new Set<number>(scheduledList.map((doctor) => doctor.id));
    const allDoctorsById = new Map<number, Doctor>(allDoctors.map((doctor) => [doctor.id, doctor]));
    const fallbackMetaByDoctorId = new Map<
      number,
      { firstStartMs: number; name: string | null; ovog: string | null }
    >();

    for (const appointment of appointments) {
      if (!keepsUnscheduledDoctorVisible(appointment.status)) continue;
      const doctorId = Number(appointment.doctorId);
      if (!Number.isFinite(doctorId) || doctorId <= 0) continue;
      if (scheduledIds.has(doctorId)) continue;
      const startMs = naiveToFakeUtcDate(appointment.scheduledAt).getTime();
      const existing = fallbackMetaByDoctorId.get(doctorId);
      if (!existing || startMs < existing.firstStartMs) {
        fallbackMetaByDoctorId.set(doctorId, {
          firstStartMs: startMs,
          name: appointment.doctorName ?? null,
          ovog: appointment.doctorOvog ?? null,
        });
      }
    }

    const fallbackDoctors = Array.from(fallbackMetaByDoctorId.entries())
      .sort((a, b) => a[1].firstStartMs - b[1].firstStartMs || a[0] - b[0])
      .map(([doctorId, meta]) => {
        const fullDoctor = allDoctorsById.get(doctorId);
        if (fullDoctor) {
          return {
            ...fullDoctor,
            schedules: [],
          } as ScheduledDoctor;
        }
        // Fallback shape for resilience if /api/users payload is delayed.
        return {
          id: doctorId,
          name: meta.name,
          ovog: meta.ovog,
          regNo: null,
          phone: null,
          calendarOrder: null,
          branches: [],
          schedules: [],
        } as ScheduledDoctor;
      });

    return [...scheduledList, ...fallbackDoctors];
  }, [allDoctors, appointments, scheduledDoctors]);

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
  const businessNowFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: BUSINESS_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    []
  );

  const firstSlot = timeSlots[0]?.start;
  const lastSlot = timeSlots[timeSlots.length - 1]?.end;
  const totalMinutes = useMemo(() => {
    if (!firstSlot || !lastSlot) return 1;
    return Math.max(1, (lastSlot.getTime() - firstSlot.getTime()) / 60000);
  }, [firstSlot, lastSlot]);
  const columnHeightPx = timeSlots.length * SLOT_HEIGHT_PX;

  useEffect(() => {
    if (!firstSlot || !lastSlot) {
      setNowPosition(null);
      return;
    }

    const isTodayInBusinessTime = selectedDate === getBusinessYmd();
    if (!isTodayInBusinessTime) {
      setNowPosition(null);
      return;
    }

    const updateNowPosition = () => {
      const now = new Date();
      const todayInBusinessTime = getBusinessYmd(now);

      const nowHmParts = businessNowFormatter.formatToParts(now);
      const nowHour = nowHmParts.find((part) => part.type === "hour")?.value ?? "00";
      const nowMinute = nowHmParts.find((part) => part.type === "minute")?.value ?? "00";
      const nowSecond = nowHmParts.find((part) => part.type === "second")?.value ?? "00";
      const nowFakeUtc = naiveToFakeUtcDate(
        `${todayInBusinessTime} ${nowHour}:${nowMinute}:${nowSecond}`
      );

      const clampedMs = Math.min(
        Math.max(nowFakeUtc.getTime(), firstSlot.getTime()),
        lastSlot.getTime()
      );
      const minutesFromStart = (clampedMs - firstSlot.getTime()) / 60000;
      setNowPosition((minutesFromStart / totalMinutes) * columnHeightPx);
    };

    updateNowPosition();
    const intervalId = window.setInterval(updateNowPosition, 60_000);
    return () => window.clearInterval(intervalId);
  }, [selectedDate, firstSlot, lastSlot, totalMinutes, columnHeightPx, businessNowFormatter]);

  const effectiveAppointments = useMemo(
    () =>
      appointments.map((appointment) => {
        const draft = draftEdits[appointment.id];
        if (!draft) return appointment;
        return {
          ...appointment,
          scheduledAt: draft.scheduledAt,
          endAt: draft.endAt,
          doctorId: draft.doctorId,
        };
      }),
    [appointments, draftEdits]
  );

  const appointmentsByDoctorId = useMemo(() => {
    const grouped: Record<number, Appointment[]> = {};
    for (const appointment of getVisibleAppointmentsV2(effectiveAppointments)) {
      if (!appointment?.doctorId) continue;
      if (!grouped[appointment.doctorId]) grouped[appointment.doctorId] = [];
      grouped[appointment.doctorId].push(appointment);
    }
    return grouped;
  }, [effectiveAppointments]);

  const blocksByDoctorId = useMemo(() => {
    const result: Record<number, AppointmentBlockGeometry[]> = {};
    if (!firstSlot) return result;

    const dayStartMs = firstSlot.getTime();

    for (const doctor of doctorsForGrid) {
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
  }, [appointmentsByDoctorId, doctorsForGrid, firstSlot, totalMinutes, columnHeightPx]);

  const doctorsById = useMemo(() => {
    const map: Record<number, ScheduledDoctor> = {};
    for (const doctor of doctorsForGrid) map[doctor.id] = doctor;
    return map;
  }, [doctorsForGrid]);

  const resolveDoctorBranchIdForDay = useCallback(
    (doctor: ScheduledDoctor, slotTime?: string): string | null => {
      const scheduleForDay =
        (doctor.schedules || []).find((s) => {
          if (s.date !== selectedDate) return false;
          if (selectedBranchId && String(s.branchId) !== selectedBranchId) return false;
          if (slotTime && !isTimeWithinRange(slotTime, s.startTime, s.endTime)) return false;
          return true;
        }) ||
        (doctor.schedules || []).find((s) => {
          if (s.date !== selectedDate) return false;
          return slotTime ? isTimeWithinRange(slotTime, s.startTime, s.endTime) : true;
        }) ||
        (doctor.schedules || []).find(
          (s) => s.date === selectedDate && (!selectedBranchId || String(s.branchId) === selectedBranchId)
        ) ||
        (doctor.schedules || []).find((s) => s.date === selectedDate);
      if (scheduleForDay?.branchId != null) return String(scheduleForDay.branchId);
      return selectedBranchId || null;
    },
    [selectedDate, selectedBranchId]
  );

  const slotOccupancyByDoctorId = useMemo(
    () =>
      computeDoctorSlotOccupancy({
        appointments,
        scheduledDoctors: doctorsForGrid,
        timeSlots,
        resolveDoctorBranchIdForDay,
      }),
    [appointments, doctorsForGrid, resolveDoctorBranchIdForDay, timeSlots]
  );

  const appointmentsById = useMemo(() => {
    const map: Record<number, Appointment> = {};
    for (const appointment of appointments) map[appointment.id] = appointment;
    return map;
  }, [appointments]);

  const snapMinutesToSlot = useCallback((minutes: number, slotMinutes = SLOT_MINUTES) => {
    return Math.round(minutes / slotMinutes) * slotMinutes;
  }, []);

  const clamp = useCallback((value: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, value));
  }, []);

  const getSlotLabelsForRange = useCallback(
    (start: Date, end: Date) => {
      const labels: string[] = [];
      for (const slot of timeSlots) {
        if (slot.start < end && slot.end > start) labels.push(slot.label);
      }
      return labels;
    },
    [timeSlots]
  );

  const clearDragPreview = useCallback(() => {
    setInvalidDragAppointmentId(null);
    setDragPreviewDoctorId(null);
    setDragPreviewSlotLabels([]);
  }, []);

  const validateDraftCandidate = useCallback(
    (appointmentId: number, candidate: DraftAppointmentChange) => {
      const appointment = appointmentsById[appointmentId];
      if (!appointment || !candidate.doctorId) {
        return {
          valid: false,
          message: "Эмч сонгоно уу.",
          slotLabels: [] as string[],
          doctorId: candidate.doctorId,
        };
      }

      const doctor = doctorsById[candidate.doctorId];
      const start = naiveToFakeUtcDate(candidate.scheduledAt);
      const end = candidate.endAt
        ? naiveToFakeUtcDate(candidate.endAt)
        : new Date(start.getTime() + SLOT_MINUTES * 60_000);
      if (!doctor || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return {
          valid: false,
          message: "Буруу цаг сонгогдсон байна.",
          slotLabels: [] as string[],
          doctorId: candidate.doctorId,
        };
      }

      const slotLabels = getSlotLabelsForRange(start, end);
      if (!slotLabels.length) {
        return {
          valid: false,
          message: "Ажлын цагаас гадуур байна.",
          slotLabels,
          doctorId: candidate.doctorId,
        };
      }

      const appointmentBranchId = String(appointment.branchId);
      const hasNonWorkingSlot = slotLabels.some((slotLabel) =>
        !(doctor.schedules || []).some(
          (schedule) =>
            schedule.date === selectedDate &&
            String(schedule.branchId) === appointmentBranchId &&
            isTimeWithinRange(slotLabel, schedule.startTime, schedule.endTime)
        )
      );
      if (hasNonWorkingSlot) {
        return {
          valid: false,
          message: "Эмчийн ажлын бус цаг руу шилжүүлэх боломжгүй.",
          slotLabels,
          doctorId: candidate.doctorId,
        };
      }

      const fullSlot = findFirstFullSlotForCandidate({
        appointments,
        doctorId: candidate.doctorId,
        branchId: appointment.branchId,
        startNaive: candidate.scheduledAt,
        endNaive:
          candidate.endAt ??
          fakeUtcDateToNaive(new Date(start.getTime() + SLOT_MINUTES * 60_000)),
        excludeAppointmentId: appointmentId,
      });
      if (fullSlot) {
        return {
          valid: false,
          message: SLOT_FULL_MESSAGE,
          slotLabels,
          doctorId: candidate.doctorId,
        };
      }

      return {
        valid: true,
        message: null as string | null,
        slotLabels,
        doctorId: candidate.doctorId,
      };
    },
    [appointments, appointmentsById, doctorsById, getSlotLabelsForRange, selectedDate]
  );

  const handleCancelDraft = useCallback((appointmentId: number) => {
    setDraftEdits((prev) => {
      const next = { ...prev };
      delete next[appointmentId];
      return next;
    });
    setPendingSaveId(null);
    setPendingSaveError(null);
    clearDragPreview();
  }, [clearDragPreview]);

  const handleSaveDraft = useCallback(
    async (appointmentId: number) => {
      const draft = draftEdits[appointmentId];
      if (!draft) return;
      const validation = validateDraftCandidate(appointmentId, draft);
      if (!validation.valid) {
        setPendingSaveError(validation.message || "Өөрчлөлт хадгалах боломжгүй.");
        return;
      }

      setPendingSaving(true);
      setPendingSaveError(null);
      try {
        const res = await fetch(`/api/appointments/${appointmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledAt: draft.scheduledAt,
            endAt: draft.endAt,
            doctorId: draft.doctorId,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setPendingSaveError((data && data.error) || `Хадгалахад алдаа гарлаа (${res.status})`);
          if (res.status === 409) {
            handleCancelDraft(appointmentId);
          }
          return;
        }
        upsertAppointment(data as Appointment);
        handleCancelDraft(appointmentId);
      } catch {
        setPendingSaveError("Сүлжээгээ шалгана уу.");
      } finally {
        setPendingSaving(false);
      }
    },
    [draftEdits, handleCancelDraft, upsertAppointment, validateDraftCandidate]
  );

  const handleAppointmentMouseDown = useCallback(
    (
      event: React.MouseEvent<HTMLButtonElement | HTMLDivElement>,
      appointment: Appointment,
      mode: DragMode
    ) => {
      if (pendingSaving || pendingSaveId !== null) return;
      if (isReceptionist && ownBranchId && appointment.branchId !== Number(ownBranchId)) return;
      if (!canEditAppointment(appointment.status)) return;
      event.preventDefault();
      event.stopPropagation();

      const origStart = naiveToFakeUtcDate(appointment.scheduledAt);
      const hasExplicitEndAt = Boolean(appointment.endAt);
      const origEnd = appointment.endAt
        ? naiveToFakeUtcDate(appointment.endAt)
        : new Date(origStart.getTime() + SLOT_MINUTES * 60_000);

      setPendingSaveError(null);
      setActiveDrag({
        appointmentId: appointment.id,
        mode,
        startClientX: event.clientX,
        startClientY: event.clientY,
        origStart,
        origEnd,
        origDoctorId: appointment.doctorId,
        hasMovedBeyondThreshold: false,
        hadExplicitEndAt: hasExplicitEndAt,
      });
    },
    [isReceptionist, ownBranchId, pendingSaveId, pendingSaving]
  );

  useEffect(() => {
    if (!activeDrag || !firstSlot || !gridScrollRef.current) return;

    const DRAG_THRESHOLD_PX = 5;

    const processPointerMove = (pointerEvent: MouseEvent) => {
      const gridElement = gridScrollRef.current;
      if (!gridElement) return;

      const rect = gridElement.getBoundingClientRect();
      const xWithin = pointerEvent.clientX - rect.left + gridElement.scrollLeft - GRID_TIME_COL_WIDTH;
      const doctorIndex = Math.floor(xWithin / GRID_DOCTOR_COL_WIDTH);
      const moveDoctorId =
        doctorIndex >= 0 && doctorIndex < doctorsForGrid.length
          ? doctorsForGrid[doctorIndex].id
          : activeDrag.origDoctorId;

      const yWithin =
        pointerEvent.clientY - rect.top + gridElement.scrollTop - GRID_STICKY_HEADER_HEIGHT;
      const minutesFromStart = (yWithin / columnHeightPx) * totalMinutes;
      const deltaX = Math.abs(pointerEvent.clientX - activeDrag.startClientX);
      const deltaY = Math.abs(pointerEvent.clientY - activeDrag.startClientY);
      const exceededThreshold =
        deltaX * deltaX + deltaY * deltaY >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;

      if (!exceededThreshold) {
        setActiveDrag((prev) => (prev ? { ...prev, hasMovedBeyondThreshold: false } : null));
        return;
      }

      let nextStart = new Date(activeDrag.origStart);
      let nextEnd = new Date(activeDrag.origEnd);
      let nextDoctorId = activeDrag.origDoctorId;

      if (activeDrag.mode === "move") {
        const durationMinutes = (activeDrag.origEnd.getTime() - activeDrag.origStart.getTime()) / 60000;
        const snappedStart = snapMinutesToSlot(minutesFromStart);
        const clampedStart = clamp(
          snappedStart,
          0,
          Math.max(0, totalMinutes - Math.max(SLOT_MINUTES, durationMinutes))
        );
        const clampedEnd = clamp(clampedStart + durationMinutes, SLOT_MINUTES, totalMinutes);
        nextStart = new Date(firstSlot.getTime() + clampedStart * 60_000);
        nextEnd = new Date(firstSlot.getTime() + clampedEnd * 60_000);
        nextDoctorId = moveDoctorId;
      } else {
        const startMinutes = (activeDrag.origStart.getTime() - firstSlot.getTime()) / 60000;
        const resizedDuration = snapMinutesToSlot(
          ((activeDrag.origEnd.getTime() - activeDrag.origStart.getTime()) / 60000) +
            ((pointerEvent.clientY - activeDrag.startClientY) / SLOT_HEIGHT_PX) * SLOT_MINUTES
        );
        const clampedDuration = clamp(resizedDuration, SLOT_MINUTES, totalMinutes);
        const clampedEndMinutes = clamp(startMinutes + clampedDuration, SLOT_MINUTES, totalMinutes);
        nextStart = new Date(activeDrag.origStart);
        nextEnd = new Date(firstSlot.getTime() + clampedEndMinutes * 60_000);
      }

      const durationMinutes = Math.round((nextEnd.getTime() - nextStart.getTime()) / 60000);
      const draftEndAt =
        !activeDrag.hadExplicitEndAt && durationMinutes === SLOT_MINUTES
          ? null
          : fakeUtcDateToNaive(nextEnd);
      const candidate: DraftAppointmentChange = {
        scheduledAt: fakeUtcDateToNaive(nextStart),
        endAt: draftEndAt,
        doctorId: nextDoctorId,
      };

      const validation = validateDraftCandidate(activeDrag.appointmentId, candidate);
      setDragPreviewDoctorId(validation.doctorId ?? null);
      setDragPreviewSlotLabels(validation.slotLabels);
      setInvalidDragAppointmentId(validation.valid ? null : activeDrag.appointmentId);

      setDraftEdits((prev) => ({
        ...prev,
        [activeDrag.appointmentId]: candidate,
      }));
      setActiveDrag((prev) => (prev ? { ...prev, hasMovedBeyondThreshold: true } : null));
    };

    const schedulePointerMove = (pointerEvent: MouseEvent) => {
      lastPointerEventRef.current = pointerEvent;
      if (dragFrameRef.current !== null) return;
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const event = lastPointerEventRef.current;
        if (!event) return;
        processPointerMove(event);
      });
    };

    const onMouseMove = (pointerEvent: MouseEvent) => {
      schedulePointerMove(pointerEvent);
    };

    const onMouseUp = () => {
      const draft = draftEdits[activeDrag.appointmentId];
      if (!draft) {
        clearDragPreview();
        setActiveDrag(null);
        return;
      }
      const validation = validateDraftCandidate(activeDrag.appointmentId, draft);
      if (!validation.valid) {
        setPendingSaveError(validation.message || "Энэ байршилд шилжүүлэх боломжгүй.");
        setDraftEdits((prev) => {
          const next = { ...prev };
          delete next[activeDrag.appointmentId];
          return next;
        });
      } else {
        setPendingSaveId(activeDrag.appointmentId);
        setPendingSaveError(null);
      }
      clearDragPreview();
      setActiveDrag(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
    };
  }, [
    activeDrag,
    clamp,
    clearDragPreview,
    columnHeightPx,
    draftEdits,
    firstSlot,
    doctorsForGrid,
    snapMinutesToSlot,
    totalMinutes,
    validateDraftCandidate,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activeDrag) {
        event.preventDefault();
        setDraftEdits((prev) => {
          const next = { ...prev };
          delete next[activeDrag.appointmentId];
          return next;
        });
        clearDragPreview();
        setActiveDrag(null);
      } else if (pendingSaveId !== null && !pendingSaving) {
        handleCancelDraft(pendingSaveId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDrag, clearDragPreview, handleCancelDraft, pendingSaveId, pendingSaving]);

  useEffect(() => {
    setDraftEdits({});
    setPendingSaveId(null);
    setPendingSaveError(null);
    clearDragPreview();
    setActiveDrag(null);
  }, [selectedBranchId, selectedDate, clearDragPreview]);

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

  const handleBranchChange = useCallback(
    (nextBranchId: string) => {
      if (isReceptionist && !nextBranchId) return;
      setSelectedBranchId(nextBranchId);
      const query = nextBranchId ? { branchId: nextBranchId } : {};
      router.push({ pathname: appointmentsBasePath, query }, undefined, { shallow: true });
    },
    [appointmentsBasePath, isReceptionist, router]
  );

  const handleCellClick = useCallback(
    (doctor: ScheduledDoctor, slotLabel: string) => {
      const modalBranchId = resolveDoctorBranchIdForDay(doctor, slotLabel);
      if (!modalBranchId) {
        setCapacityMessage("Салбар тодорхойгүй байна. Салбар сонгоод дахин оролдоно уу.");
        return;
      }
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
      if (activeDrag || pendingSaveId !== null) return;
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
    [activeDrag, appointments, doctorsById, pendingSaveId, selectedDate]
  );

  if (!isAllowedRole) {
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
            onChange={(e) => handleBranchChange(e.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 8px", minWidth: 180 }}
          >
            {!isFrontdeskRole && <option value="">Бүх салбар</option>}
            {branches.map((branch) => (
              <option key={branch.id} value={String(branch.id)}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        {isReceptionist &&
        ownBranchId &&
        selectedBranchId &&
        selectedBranchId !== ownBranchId ? null : (
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
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>Үйлчлүүлэгч хайх</label>
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
                    zIndex: 1000,
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
        )}
        {(isReceptionist || isMarketing) && (
          (isReceptionist && ownBranchId && selectedBranchId !== ownBranchId) ? null : <PriceListSearch />
        )}
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
              {formatPatientNameOvogFirst(selectedPatient)}
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

      {(error || scheduledDoctorsError || allDoctorsError) && (
        <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>
          {error || scheduledDoctorsError || allDoctorsError}
        </div>
      )}
      {capacityMessage && (
        <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
          {capacityMessage}
        </div>
      )}
      {pendingSaveError && pendingSaveId === null && (
        <div
          style={{
            marginBottom: 10,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 12,
            maxWidth: 520,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{pendingSaveError}</span>
          <button
            type="button"
            onClick={() => setPendingSaveError(null)}
            style={{
              marginLeft: "auto",
              border: "none",
              background: "transparent",
              color: "#6b7280",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
      {pendingSaveId !== null && (
        <div
          style={{
            marginBottom: 10,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            maxWidth: 520,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>
            Цаг захиалга өөрчлөгдлөө
          </div>
          <div style={{ fontSize: 12, color: "#2563eb" }}>
            Та өөрчлөлтийг хадгалах уу эсвэл цуцлах уу?
          </div>
          {pendingSaveError && <div style={{ fontSize: 12, color: "#b91c1c" }}>{pendingSaveError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => handleSaveDraft(pendingSaveId)}
              disabled={pendingSaving}
              style={{
                padding: "7px 12px",
                border: "none",
                borderRadius: 6,
                background: "#2563eb",
                color: "#fff",
                fontWeight: 700,
                cursor: pendingSaving ? "default" : "pointer",
                opacity: pendingSaving ? 0.6 : 1,
              }}
            >
              {pendingSaving ? "Хадгалж байна..." : "Хадгалах"}
            </button>
            <button
              type="button"
              onClick={() => handleCancelDraft(pendingSaveId)}
              disabled={pendingSaving}
              style={{
                padding: "7px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                fontWeight: 700,
                cursor: pendingSaving ? "default" : "pointer",
                opacity: pendingSaving ? 0.6 : 1,
              }}
            >
              Цуцлах
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ marginBottom: 10, fontSize: 13, color: "#475569" }}>
          Ачаалж байна...
        </div>
      )}

      <AppointmentsV2Grid
        doctors={doctorsForGrid}
        timeSlots={timeSlots}
        slotHeightPx={SLOT_HEIGHT_PX}
        columnHeightPx={columnHeightPx}
        blocksByDoctorId={blocksByDoctorId}
        slotOccupancyByDoctorId={slotOccupancyByDoctorId}
        onCellClick={handleCellClick}
        onAppointmentClick={handleAppointmentClick}
        canDragAppointment={(appointment) =>
          !(
            isReceptionist &&
            ownBranchId &&
            appointment.branchId !== Number(ownBranchId)
          ) && canEditAppointment(appointment.status)
        }
        pendingSaveId={pendingSaveId}
        activeDragAppointmentId={activeDrag?.appointmentId ?? null}
        invalidDragAppointmentId={invalidDragAppointmentId}
        dragPreviewDoctorId={dragPreviewDoctorId}
        dragPreviewSlotLabels={dragPreviewSlotLabels}
        onAppointmentMouseDown={handleAppointmentMouseDown}
        disableAppointmentClicks={Boolean(activeDrag) || pendingSaveId !== null}
        scrollContainerRef={gridScrollRef}
        stickyHeaderHeightPx={GRID_STICKY_HEADER_HEIGHT}
        nowPosition={nowPosition}
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
        readOnly={false}
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
              : selectedBranchId || null;
          if (!resolvedBranchId) {
            setCapacityMessage("Салбар тодорхойгүй байна. Салбар сонгоод дахин оролдоно уу.");
            return;
          }
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
        doctors={doctorsForGrid}
        scheduledDoctors={doctorsForGrid}
        appointments={appointments}
        selectedBranchId={quickModalState.branchId || selectedBranchId}
        allowAutoDefaultBranch={false}
        defaultPatientId={selectedPatient?.id ?? null}
        defaultPatientQuery={selectedPatient ? formatPatientQuickLabel(selectedPatient) : ""}
        enforceSlotCapacity
        slotFullMessage={SLOT_FULL_MESSAGE}
        editingAppointment={editingAppointment}
        currentUserRole={me?.role ?? null}
        forceBookedStatus={false}
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
        doctors={allDoctors}
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

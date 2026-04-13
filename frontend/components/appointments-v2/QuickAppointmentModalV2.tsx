import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import type { Branch, Doctor, ScheduledDoctor, Appointment, PatientLite, CompletedHistoryItem } from "../appointments/types";
import { formatDoctorName, historyDoctorToDoctor, formatPatientSearchLabel, formatHistoryDate } from "../appointments/formatters";
import { SLOT_MINUTES, addMinutesToTimeString, generateTimeSlotsForDay, getSlotTimeString, isTimeWithinRange, getDateFromYMD } from "../appointments/time";
import { parseNaiveTimestamp, naiveTimestampToYmd, naiveTimestampToHm, toNaiveTimestamp } from "../../utils/businessTime";
import { SLOT_FULL_MESSAGE as DEFAULT_SLOT_FULL_MESSAGE, findFirstFullSlotForCandidate } from "./slotCapacity";
import {
  PATIENT_SEARCH_DEBOUNCE_MS,
  PATIENT_SEARCH_MIN_CHARS,
  type PatientSearchResult,
  formatPatientNameOvogFirst,
  formatPatientSearchDropdownRow,
  searchPatientsByRules,
} from "./patientSearchRules";

const COMPLETED_READONLY_MSG = "Дууссан цаг засварлах боломжгүй.";

type QuickAppointmentModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDoctorId?: number;
  defaultDate: string; // YYYY-MM-DD
  defaultTime: string; // HH:MM
  branches: Branch[];
  doctors: Doctor[];
  scheduledDoctors: ScheduledDoctor[];
  appointments: Appointment[];
  selectedBranchId: string;
  onCreated: (a: Appointment) => void;

  editingAppointment?: Appointment | null;
  onUpdated?: (a: Appointment) => void;

  /** When false, disables the effect that auto-fills branch to branches[0] when no branch is selected. */
  allowAutoDefaultBranch?: boolean;

  /** Pre-selected patient id (for booking intent from calendar page). */
  defaultPatientId?: number | null;
  /** Display label for the pre-selected patient. */
  defaultPatientQuery?: string;

  /** Current user role for permission checks (e.g. "super_admin") */
  currentUserRole?: string | null;
  /** When true, forces status to "booked" and hides the status selector */
  forceBookedStatus?: boolean;
  /** Enable max-2 slot-capacity checks before save (used by V2 flow). */
  enforceSlotCapacity?: boolean;
  /** Override for user-facing slot full message. */
  slotFullMessage?: string;
};

export default function QuickAppointmentModal({
  open,
  onClose,
  defaultDoctorId,
  defaultDate,
  defaultTime,
  branches,
  doctors,
  scheduledDoctors,
  appointments,
  selectedBranchId,
  onCreated,
  editingAppointment,
  onUpdated,
  allowAutoDefaultBranch = true,
  defaultPatientId,
  defaultPatientQuery,
  currentUserRole,
  forceBookedStatus = false,
  enforceSlotCapacity = false,
  slotFullMessage = DEFAULT_SLOT_FULL_MESSAGE,
}: QuickAppointmentModalProps) {
  const router = useRouter();
  const isEditMode = Boolean(editingAppointment);
  const isCompletedReadOnly =
    isEditMode &&
    editingAppointment?.status === "completed" &&
    currentUserRole !== "super_admin";

  const [form, setForm] = useState({
    patientQuery: "",
    patientId: null as number | null,

    doctorId: defaultDoctorId ? String(defaultDoctorId) : "",
    branchId: selectedBranchId || (allowAutoDefaultBranch && branches.length ? String(branches[0].id) : ""),

    date: defaultDate,
    startTime: defaultTime,
    endTime: addMinutesToTimeString(defaultTime, SLOT_MINUTES),

    status: "booked",
    notes: "",
  });

  const [error, setError] = useState("");

  // duration selector state (create mode only)
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [endTimeManuallySet, setEndTimeManuallySet] = useState(false);

  const workingDoctors = scheduledDoctors.length ? scheduledDoctors : doctors;

  const [patientResults, setPatientResults] = useState<PatientLite[]>([]);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const patientSearchRef = useRef<HTMLInputElement>(null);
  const patientSearchRequestIdRef = useRef(0);
  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressPatientSearchRef = useRef(false);
  const [selectedPatientSummary, setSelectedPatientSummary] = useState<PatientSearchResult | null>(null);

  // completed visit history for selected patient
  const [completedHistory, setCompletedHistory] = useState<CompletedHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // time slot options
  const [popupStartSlots, setPopupStartSlots] = useState<
    { label: string; value: string }[]
  >([]);
  const [popupEndSlots, setPopupEndSlots] = useState<
    { label: string; value: string }[]
  >([]);

  // quick new patient (create mode only)
  const [showQuickPatientModal, setShowQuickPatientModal] = useState(false);
  const [quickPatientForm, setQuickPatientForm] = useState<{
    ovog: string;
    name: string;
    phone: string;
    branchId: string;
    regNo: string;
  }>({
    ovog: "",
    name: "",
    phone: "",
    branchId: "",
    regNo: "",
  });
  const [quickPatientError, setQuickPatientError] = useState("");
  const [quickPatientSaving, setQuickPatientSaving] = useState(false);

  const isSlotFullApiResponse = (statusCode: number, payload: any) =>
    statusCode === 409 &&
    (payload?.code === "SLOT_FULL" ||
      String(payload?.message || "").toLowerCase().includes("slot is full") ||
      String(payload?.error || "").includes("2 захиалга"));

  // ---- helpers ----
  const parseYmd = (ymd: string) => {
    const [y, m, d] = String(ymd || "").split("-").map(Number);
    if (!y || !m || !d) return null;
    return { y, m, d };
  };

  const parseNaiveToYmdHm = (naive: string) => {
    const parsed = parseNaiveTimestamp(naive);
    if (!parsed) return null;
    return { ymd: parsed.ymd, hm: parsed.hm };
  };

  const loadPatientHistory = async (patientId: number) => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`/api/patients/${patientId}/completed-appointments?limit=3`);
      if (!res.ok) {
        setCompletedHistory([]);
        return;
      }
      const data = await res.json().catch(() => []);
      setCompletedHistory(Array.isArray(data) ? data : []);
    } catch {
      setCompletedHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPatientLiteById = async (patientId: number) => {
    try {
      const res = await fetch(`/api/patients/${patientId}/lite`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || typeof data.id !== "number") {
        setSelectedPatientSummary(null);
        return;
      }
      setSelectedPatientSummary({
        id: data.id,
        name: data.name || "",
        ovog: data.ovog ?? null,
        phone: data.phone ?? null,
        regNo: data.regNo ?? null,
      });
    } catch {
      setSelectedPatientSummary(null);
    }
  };

  // initialize modal state on open
  useEffect(() => {
    if (!open) return;

    // EDIT MODE: preload from appointment
    if (editingAppointment) {
      const startParsed = parseNaiveToYmdHm(editingAppointment.scheduledAt);
      const endParsed = editingAppointment.endAt
        ? parseNaiveToYmdHm(editingAppointment.endAt)
        : null;

      const ymd = startParsed?.ymd || defaultDate;
      const startTime = startParsed?.hm || defaultTime;
      const endTime =
        endParsed?.hm || addMinutesToTimeString(startTime, SLOT_MINUTES);

      setForm((prev) => ({
        ...prev,
        patientId: editingAppointment.patientId ?? null,
        patientQuery: editingAppointment.patient
          ? formatPatientSearchLabel(editingAppointment.patient as any)
          : prev.patientQuery,

        doctorId:
          editingAppointment.doctorId !== null && editingAppointment.doctorId !== undefined
            ? String(editingAppointment.doctorId)
            : "",

        branchId: String(editingAppointment.branchId),
        date: ymd,
        startTime,
        endTime,

        status: editingAppointment.status || "booked",
        notes: editingAppointment.notes || "",
      }));

      setError("");
      setPatientResults([]);
      setPatientSearchOpen(false);
      setCompletedHistory([]);
      setSelectedPatientSummary(
        editingAppointment.patient
          ? {
              id: editingAppointment.patient.id,
              name: editingAppointment.patient.name,
              ovog: editingAppointment.patient.ovog ?? null,
              regNo: editingAppointment.patient.regNo ?? null,
              phone: editingAppointment.patient.phone ?? null,
            }
          : null
      );
      if (editingAppointment.patientId) {
        loadPatientHistory(editingAppointment.patientId);
        if (!editingAppointment.patient) {
          loadPatientLiteById(editingAppointment.patientId);
        }
      }
      return;
    }

    // CREATE MODE: reset to defaults
    const prePatientId = defaultPatientId ?? null;
    const prePatientQuery = defaultPatientQuery || "";
    setForm((prev) => ({
      ...prev,
      doctorId: defaultDoctorId ? String(defaultDoctorId) : "",
      branchId: selectedBranchId || (allowAutoDefaultBranch ? prev.branchId : ""),
      date: defaultDate,
      startTime: defaultTime,
      endTime: addMinutesToTimeString(defaultTime, SLOT_MINUTES),
      patientId: prePatientId,
      patientQuery: prePatientQuery,
      status: "booked",
      notes: "",
    }));
    setDurationMinutes(30);
    setEndTimeManuallySet(false);
    setError("");
    setPatientResults([]);
    setPatientSearchOpen(false);
    setCompletedHistory([]);
    setSelectedPatientSummary(null);
    if (prePatientId) {
      loadPatientHistory(prePatientId);
      loadPatientLiteById(prePatientId);
    }
  }, [open, defaultDoctorId, defaultDate, defaultTime, selectedBranchId, editingAppointment, defaultPatientId, defaultPatientQuery]);

  // Autofocus patient search input when modal opens
  useEffect(() => {
    if (open && !isCompletedReadOnly) {
      patientSearchRef.current?.focus();
    }
  }, [open, isCompletedReadOnly]);

  // Reset highlighted index whenever results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [patientResults]);

  useEffect(() => {
    return () => {
      if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current);
    };
  }, []);

  // slots calculation (same as your current, but in edit mode: filter by selected doctor schedule still ok)
  useEffect(() => {
    if (!form.date) {
      setPopupStartSlots([]);
      setPopupEndSlots([]);
      return;
    }

    const parsed = parseYmd(form.date);
    if (!parsed) {
      setPopupStartSlots([]);
      setPopupEndSlots([]);
      return;
    }

    const day = getDateFromYMD(form.date);

    let slots = generateTimeSlotsForDay(day).map((s) => ({
      label: s.label,
      start: s.start,
      end: s.end,
      value: getSlotTimeString(s.start),
    }));

    // Filter by doctor schedule if doctorId is selected
    if (form.doctorId) {
      const doctorIdNum = Number(form.doctorId);
      const doc = scheduledDoctors.find((sd) => sd.id === doctorIdNum);
      const schedules = doc?.schedules || [];

      if (schedules.length > 0) {
        slots = slots.filter((slot) => {
          const tStr = getSlotTimeString(slot.start);
          return schedules.some((s: any) =>
            isTimeWithinRange(tStr, s.startTime, s.endTime)
          );
        });
      }
    }

    const startOptions = slots.map(({ label, value }) => ({ label, value }));
    const endOptions = Array.from(
      new Set(slots.map((s) => getSlotTimeString(s.end)))
    ).map((t) => ({ label: t, value: t }));

    setPopupStartSlots(startOptions);
    setPopupEndSlots(endOptions);

    if (form.startTime && !startOptions.some((s) => s.value === form.startTime)) {
      setForm((prev) => ({ ...prev, startTime: "" }));
    }
    if (form.endTime && !endOptions.some((s) => s.value === form.endTime)) {
      setForm((prev) => ({ ...prev, endTime: "" }));
    }
  }, [form.date, form.doctorId, scheduledDoctors]);

  useEffect(() => {
    if (!allowAutoDefaultBranch) return;
    if (!form.branchId && branches.length > 0) {
      setForm((prev) => ({
        ...prev,
        branchId: String(branches[0].id),
      }));
    }
  }, [branches, form.branchId, allowAutoDefaultBranch]);

  const triggerPatientSearch = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current);
    if (query.length < PATIENT_SEARCH_MIN_CHARS) {
      setPatientResults([]);
      setPatientSearchOpen(false);
      setHighlightedIndex(0);
      return;
    }
    const currentRequestId = ++patientSearchRequestIdRef.current;
    searchDebounceTimerRef.current = setTimeout(async () => {
      try {
        const rows = await searchPatientsByRules(query);
        if (currentRequestId !== patientSearchRequestIdRef.current) return;
        setPatientResults(
          rows.map((p) => ({
            id: p.id,
            name: p.name,
            ovog: p.ovog ?? null,
            regNo: p.regNo ?? "",
            phone: p.phone ?? null,
            patientBook: null,
          }))
        );
        setPatientSearchOpen(rows.length > 0);
        setHighlightedIndex(0);
      } catch {
        if (currentRequestId !== patientSearchRequestIdRef.current) return;
        setPatientResults([]);
        setPatientSearchOpen(false);
      }
    }, PATIENT_SEARCH_DEBOUNCE_MS);
  };

  const handleSelectPatient = (p: PatientLite) => {
    suppressPatientSearchRef.current = true;
    setForm((prev) => ({
      ...prev,
      patientId: p.id,
      patientQuery: formatPatientSearchDropdownRow({
        id: p.id,
        name: p.name,
        ovog: p.ovog ?? null,
        regNo: p.regNo ?? "",
        phone: p.phone ?? null,
      }),
    }));
    setPatientResults([]);
    setPatientSearchOpen(false);
    setHighlightedIndex(0);
    setError("");
    setCompletedHistory([]);
    setSelectedPatientSummary({
      id: p.id,
      name: p.name,
      ovog: p.ovog ?? null,
      regNo: p.regNo ?? "",
      phone: p.phone ?? null,
    });
    loadPatientHistory(p.id);
  };

  const handlePatientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setPatientSearchOpen(false);
      return;
    }
    if (!patientSearchOpen || patientResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, patientResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected =
        patientResults.length === 1 ? patientResults[0] : patientResults[highlightedIndex];
      if (selected) handleSelectPatient(selected);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "patientQuery") {
      setForm((prev) => ({ ...prev, patientQuery: value }));
      if (suppressPatientSearchRef.current) {
        suppressPatientSearchRef.current = false;
        return;
      }
      if (form.patientId) {
        setForm((prev) => ({ ...prev, patientId: null }));
        setCompletedHistory([]);
        setSelectedPatientSummary(null);
      }
      const trimmed = value.trim();
      if (!trimmed) {
        setPatientResults([]);
        setPatientSearchOpen(false);
        return;
      }
      if (trimmed.length >= PATIENT_SEARCH_MIN_CHARS) setPatientSearchOpen(true);
      triggerPatientSearch(value);
      return;
    }

    setForm((prev) => {
      if (name === "startTime") {
        const newStart = value;
        let newEnd: string;
        if (!isEditMode && !endTimeManuallySet) {
          newEnd = addMinutesToTimeString(newStart, durationMinutes);
        } else {
          newEnd = prev.endTime && prev.endTime > newStart
            ? prev.endTime
            : addMinutesToTimeString(newStart, SLOT_MINUTES);
        }
        return { ...prev, startTime: newStart, endTime: newEnd };
      }

      if (name === "endTime") {
        if (!isEditMode) {
          setEndTimeManuallySet(true);
        }
        return { ...prev, endTime: value };
      }

      // lock branchId in edit mode
      if (isEditMode && name === "branchId") {
        return prev;
      }

      return { ...prev, [name]: value };
    });
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mins = Number(e.target.value);
    setDurationMinutes(mins);
    setEndTimeManuallySet(false);
    setForm((prev) => ({
      ...prev,
      endTime: prev.startTime ? addMinutesToTimeString(prev.startTime, mins) : prev.endTime,
    }));
  };

  const handleQuickPatientChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setQuickPatientForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuickPatientSave = async () => {
    setQuickPatientError("");

    if (!quickPatientForm.name.trim() || !quickPatientForm.phone.trim()) {
      setQuickPatientError("Нэр болон утас заавал бөглөнө үү.");
      return;
    }

    const branchIdFromModal = quickPatientForm.branchId
      ? Number(quickPatientForm.branchId)
      : null;
    const branchIdFromForm = form.branchId ? Number(form.branchId) : null;

    const branchIdForPatient = !Number.isNaN(branchIdFromModal ?? NaN)
      ? branchIdFromModal
      : branchIdFromForm;

    if (!branchIdForPatient || Number.isNaN(branchIdForPatient)) {
      setQuickPatientError("Шинэ үйлчлүүлэгч бүртгэхийн өмнө салбар сонгоно уу.");
      return;
    }

    setQuickPatientSaving(true);

    try {
      const payload: any = {
        name: quickPatientForm.name.trim(),
        phone: quickPatientForm.phone.trim(),
        branchId: branchIdForPatient,
        bookNumber: "",
      };

      if (quickPatientForm.ovog.trim()) payload.ovog = quickPatientForm.ovog.trim();
      if (quickPatientForm.regNo.trim()) payload.regNo = quickPatientForm.regNo.trim();

      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || typeof data.id !== "number") {
        setQuickPatientError((data && (data as any).error) || "Шинэ үйлчлүүлэгч бүртгэх үед алдаа гарлаа.");
        setQuickPatientSaving(false);
        return;
      }

      const p: PatientLite = {
        id: data.id,
        name: data.name,
        ovog: data.ovog ?? null,
        regNo: data.regNo ?? "",
        phone: data.phone ?? null,
        patientBook: data.patientBook || null,
      };

      setForm((prev) => ({
        ...prev,
        patientId: p.id,
        patientQuery: formatPatientSearchDropdownRow({
          id: p.id,
          name: p.name,
          ovog: p.ovog ?? null,
          regNo: p.regNo ?? "",
          phone: p.phone ?? null,
        }),
      }));
      setSelectedPatientSummary({
        id: p.id,
        name: p.name,
        ovog: p.ovog ?? null,
        regNo: p.regNo ?? "",
        phone: p.phone ?? null,
      });
      loadPatientHistory(p.id);

      setQuickPatientForm({ ovog: "", name: "", phone: "", branchId: "", regNo: "" });
      setShowQuickPatientModal(false);
    } catch (e) {
      console.error(e);
      setQuickPatientError("Сүлжээгээ шалгана уу.");
    } finally {
      setQuickPatientSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Block submit for completed appointments when non-super_admin
    if (isCompletedReadOnly) {
      setError(COMPLETED_READONLY_MSG);
      return;
    }

    // --- validations ---
    if (!form.date || !form.startTime || !form.endTime) {
      setError("Огноо, эхлэх/дуусах цаг талбаруудыг бөглөнө үү.");
      return;
    }

    if (!form.branchId && !isEditMode) {
      setError("Салбар сонгоно уу.");
      return;
    }
    if (!form.patientId) {
      setError("Үйлчлүүлэгчийг жагсаалтаас сонгоно уу.");
      return;
    }

    const parsed = parseYmd(form.date);
    if (!parsed) {
      setError("Огноо буруу байна.");
      return;
    }
    const [startHour, startMinute] = form.startTime.split(":").map(Number);
    const [endHour, endMinute] = form.endTime.split(":").map(Number);

    // Validate time ordering without creating timezone-dependent Date objects
    const startMinutes = (startHour || 0) * 60 + (startMinute || 0);
    const endMinutes = (endHour || 0) * 60 + (endMinute || 0);

    if (endMinutes <= startMinutes) {
      setError("Дуусах цаг нь эхлэх цагаас хойш байх ёстой.");
      return;
    }

    // Build naive timestamps: "YYYY-MM-DD HH:mm:00" — no timezone conversion
    const scheduledAtStr = toNaiveTimestamp(form.date, form.startTime);
    const endAtStr = toNaiveTimestamp(form.date, form.endTime);
    const effectiveDoctorId = form.doctorId ? Number(form.doctorId) : null;
    const effectiveBranchId = isEditMode
      ? Number(editingAppointment?.branchId ?? form.branchId)
      : Number(form.branchId);

    if (
      enforceSlotCapacity &&
      effectiveDoctorId &&
      !Number.isNaN(effectiveDoctorId) &&
      effectiveBranchId &&
      !Number.isNaN(effectiveBranchId)
    ) {
      const fullSlot = findFirstFullSlotForCandidate({
        appointments,
        doctorId: effectiveDoctorId,
        branchId: effectiveBranchId,
        startNaive: scheduledAtStr,
        endNaive: endAtStr,
        excludeAppointmentId: editingAppointment?.id,
      });
      if (fullSlot) {
        setError(slotFullMessage);
        return;
      }
    }

    try {
      if (!isEditMode) {
        // CREATE
        const res = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: form.patientId,
            doctorId: form.doctorId ? Number(form.doctorId) : null,
            branchId: Number(form.branchId),
            scheduledAt: scheduledAtStr,
            endAt: endAtStr,
            status: forceBookedStatus ? "booked" : form.status,
            notes: form.notes || null,
          }),
        });

        let data: Appointment | { error?: string };
        try {
          data = await res.json();
        } catch {
          data = { error: "Unknown error" };
        }

        if (!res.ok) {
          const payload = data as any;
          const isSlotFull = isSlotFullApiResponse(res.status, payload);
          setError(
            enforceSlotCapacity && isSlotFull
              ? slotFullMessage
              : payload?.error || payload?.message || "Алдаа гарлаа"
          );
          return;
        }

        onCreated(data as Appointment);
        onClose();
        return;
      }

      // EDIT
      if (!editingAppointment) {
        setError("Засварлах цаг олдсонгүй.");
        return;
      }

      const patchPayload: any = {
        scheduledAt: scheduledAtStr,
        endAt: endAtStr,
        doctorId: form.doctorId ? Number(form.doctorId) : null,
        notes: form.notes || null,
        status: form.status,
      };
      // Only include patientId if it changed to avoid triggering unnecessary validation
      if (form.patientId !== (editingAppointment.patientId ?? null)) {
        patchPayload.patientId = form.patientId;
      }

      const res = await fetch(`/api/appointments/${editingAppointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload),
      });

      let data: Appointment | { error?: string };
      try {
        data = await res.json();
      } catch {
        data = { error: "Unknown error" };
      }

      if (!res.ok) {
        const payload = data as any;
        const isSlotFull = isSlotFullApiResponse(res.status, payload);
        setError(
          enforceSlotCapacity && isSlotFull
            ? slotFullMessage
            : payload?.error || payload?.message || "Алдаа гарлаа"
        );
        return;
      }

      onUpdated?.(data as Appointment);
      onClose();
    } catch {
      setError("Сүлжээгээ шалгана уу");
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 70,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: 8,
          boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
          padding: 16,
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15 }}>
            {isEditMode ? "Цаг засварлах" : "Шинэ цаг захиалах"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          {/* View-only notice for completed appointments */}
          {isCompletedReadOnly && (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "8px 12px",
                borderRadius: 6,
                background: "#fef9c3",
                border: "1px solid #fde68a",
                color: "#92400e",
                fontSize: 13,
              }}
            >
              {COMPLETED_READONLY_MSG}
            </div>
          )}
          {/* Patient */}
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <label>Үйлчлүүлэгч</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                ref={patientSearchRef}
                name="patientQuery"
                placeholder="Үйлчлүүлэгчийн овог, нэр, утас, РД"
                value={form.patientQuery}
                onChange={handleChange}
                onKeyDown={handlePatientKeyDown}
                onFocus={() => {
                  if (patientResults.length > 0) setPatientSearchOpen(true);
                }}
                autoComplete="off"
                disabled={isCompletedReadOnly}
                style={{
                  flex: 1,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                  background: isCompletedReadOnly ? "#f9fafb" : "white",
                }}
              />

              <button
                type="button"
                onClick={() => {
                  setShowQuickPatientModal(true);
                  setQuickPatientError("");
                  setQuickPatientForm((prev) => ({
                    ...prev,
                    branchId: prev.branchId || form.branchId,
                  }));
                }}
                disabled={isCompletedReadOnly}
                style={{
                  padding: "0 10px",
                  borderRadius: 6,
                  border: "1px solid #16a34a",
                  background: isCompletedReadOnly ? "#f9fafb" : "#dcfce7",
                  color: isCompletedReadOnly ? "#9ca3af" : "#166534",
                  fontWeight: 600,
                  cursor: isCompletedReadOnly ? "default" : "pointer",
                }}
                title="Шинэ үйлчлүүлэгчийн бүртгэл"
              >
                +
              </button>
            </div>
          </div>

          {patientSearchOpen && patientResults.length > 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {patientResults.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPatient(p)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 8px",
                    border: "none",
                    borderBottom: "1px solid #f3f4f6",
                    background: idx === highlightedIndex ? "#eff6ff" : "white",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {formatPatientSearchDropdownRow({
                    id: p.id,
                    name: p.name,
                    ovog: p.ovog ?? null,
                    regNo: p.regNo ?? "",
                    phone: p.phone ?? null,
                  })}
                </button>
              ))}
            </div>
          )}

          {/* Completed visit history (shown after patient is selected) */}
          {form.patientId && !patientResults.length && (
            <div
              style={{
                gridColumn: "1 / -1",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                padding: "6px 8px",
                fontSize: 12,
              }}
            >
              {selectedPatientSummary && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ color: "#0f172a", fontWeight: 700 }}>
                    {formatPatientNameOvogFirst(selectedPatientSummary)}
                  </div>
                  <div style={{ color: "#334155" }}>
                    🆔 {selectedPatientSummary.regNo || "-"} · 📞 {selectedPatientSummary.phone || "-"}
                  </div>
                </div>
              )}
              <div style={{ color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>
                Сүүлийн 3 дууссан үзлэг:
              </div>
              {historyLoading ? (
                <div style={{ color: "#9ca3af" }}>Уншиж байна...</div>
              ) : completedHistory.length === 0 ? (
                <div style={{ color: "#9ca3af" }}>Өмнөх дууссан үзлэг байхгүй</div>
              ) : (
                completedHistory.map((h) => {
                  const doctorName = h.doctor
                    ? formatDoctorName(historyDoctorToDoctor(h.doctor))
                    : "-";
                  const doctorSelectTitle = h.doctor ? `${doctorName} эмчийг сонгох` : undefined;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        if (h.doctor) {
                          setForm((prev) => ({ ...prev, doctorId: String(h.doctor!.id) }));
                        }
                      }}
                      title={doctorSelectTitle}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "3px 0",
                        border: "none",
                        background: "transparent",
                        cursor: h.doctor ? "pointer" : "default",
                        color: h.doctor ? "#2563eb" : "#374151",
                        textDecoration: h.doctor ? "underline" : "none",
                        fontSize: 11,
                      }}
                    >
                      {formatHistoryDate(h.scheduledAt)} — Эмч: {doctorName}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Branch (display-only in edit mode, selectable in create mode) */}
          {isEditMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label>Салбар</label>
              <div
                style={{
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                  background: "#f9fafb",
                  color: "#6b7280",
                  fontSize: 13,
                }}
              >
                {(() => {
                  const b = branches.find((br) => String(br.id) === form.branchId);
                  return b ? b.name : form.branchId || "—";
                })()}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label>Салбар</label>
              <select
                name="branchId"
                value={form.branchId}
                onChange={handleChange}
                required
                style={{
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                }}
              >
                <option value="">Сонгох</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Doctor picker */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Эмч</label>
            <select
              name="doctorId"
              value={form.doctorId}
              onChange={handleChange}
              disabled={isCompletedReadOnly}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
                background: isCompletedReadOnly ? "#f9fafb" : "white",
              }}
            >
              <option value="">— Эмч сонгоогүй —</option>
              {workingDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDoctorName(d)}
                </option>
              ))}
            </select>
          </div>

          {/* Date (editable) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Огноо</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              disabled={isCompletedReadOnly}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
                background: isCompletedReadOnly ? "#f9fafb" : "white",
              }}
            />
          </div>

          {/* Start time (editable) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Эхлэх цаг</label>
            <select
              name="startTime"
              value={form.startTime}
              onChange={handleChange}
              required
              disabled={isCompletedReadOnly}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
                background: isCompletedReadOnly ? "#f9fafb" : "white",
              }}
            >
              <option value="">Эхлэх цаг</option>
              {popupStartSlots.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>

          {/* Duration pill buttons (create mode only) */}
          {!isEditMode && (
            <div role="group" aria-label="Үргэлжлэх хугацаа" style={{ display: "flex", gap: 8 }}>
              {([60, 90] as const).map((mins) => (
                <button
                  key={mins}
                  type="button"
                  aria-pressed={durationMinutes === mins}
                  onClick={() => {
                    const newDuration = durationMinutes === mins ? 30 : mins;
                    setDurationMinutes(newDuration);
                    setEndTimeManuallySet(false);
                    setForm((prev) => ({
                      ...prev,
                      endTime: prev.startTime
                        ? addMinutesToTimeString(prev.startTime, newDuration)
                        : prev.endTime,
                    }));
                  }}
                  style={{
                    borderRadius: 999,
                    border: durationMinutes === mins ? "1px solid #2563eb" : "1px solid #d1d5db",
                    background: durationMinutes === mins ? "#eff6ff" : "#fff",
                    color: durationMinutes === mins ? "#2563eb" : "#374151",
                    padding: "4px 14px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: durationMinutes === mins ? 600 : 400,
                  }}
                >
                  {mins} мин
                </button>
              ))}
            </div>
          )}

          {/* End time (editable) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Дуусах цаг</label>
            <select
              name="endTime"
              value={form.endTime}
              onChange={handleChange}
              required
              disabled={isCompletedReadOnly}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
                background: isCompletedReadOnly ? "#f9fafb" : "white",
              }}
            >
              <option value="">Дуусах цаг</option>
              {popupEndSlots.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status (hidden when forceBookedStatus) */}
          {!forceBookedStatus && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label>Төлөв</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={isCompletedReadOnly}
                style={{
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                  background: isCompletedReadOnly ? "#f9fafb" : "white",
                }}
              >
                <option value="booked">Захиалсан</option>
                <option value="confirmed">Баталгаажсан</option>
                <option value="online">Онлайн</option>
                <option value="ongoing">Явагдаж байна</option>
                <option value="imaging">Зураг авах</option>
                <option value="ready_to_pay">Төлбөр төлөх</option>
                <option value="no_show">Ирээгүй</option>
                <option value="cancelled">Цуцалсан</option>
                <option value="other">Бусад</option>
              </select>
            </div>
          )}

          {/* Notes (editable) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              gridColumn: "1 / -1",
            }}
          >
            <label>Тэмдэглэл</label>
            <input
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Захиалгын товч тэмдэглэл"
              disabled={isCompletedReadOnly}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
                background: isCompletedReadOnly ? "#f9fafb" : "white",
              }}
            />
          </div>

          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 4,
            }}
          >
            {error && (
              <div
                style={{
                  color: "#b91c1c",
                  fontSize: 12,
                  alignSelf: "center",
                  marginRight: "auto",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                cursor: "pointer",
              }}
            >
              Хаах
            </button>

            {!isCompletedReadOnly && (
              <button
                type="submit"
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Хадгалах
              </button>
            )}
          </div>

          {/* Quick new patient modal */}
          {showQuickPatientModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 60,
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 8,
                  padding: 16,
                  width: 340,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  fontSize: 13,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
                  Шинэ үйлчлүүлэгчийн бүртгэл
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    Овог
                    <input
                      name="ovog"
                      value={quickPatientForm.ovog}
                      onChange={handleQuickPatientChange}
                      style={{ borderRadius: 6, border: "1px solid #d1d5db", padding: "6px 8px" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    Нэр
                    <input
                      name="name"
                      value={quickPatientForm.name}
                      onChange={handleQuickPatientChange}
                      style={{ borderRadius: 6, border: "1px solid #d1d5db", padding: "6px 8px" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    Утас
                    <input
                      name="phone"
                      value={quickPatientForm.phone}
                      onChange={handleQuickPatientChange}
                      style={{ borderRadius: 6, border: "1px solid #d1d5db", padding: "6px 8px" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    РД
                    <input
                      name="regNo"
                      value={quickPatientForm.regNo}
                      onChange={handleQuickPatientChange}
                      style={{ borderRadius: 6, border: "1px solid #d1d5db", padding: "6px 8px" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    Салбар
                    <select
                      name="branchId"
                      value={quickPatientForm.branchId}
                      onChange={handleQuickPatientChange}
                      style={{ borderRadius: 6, border: "1px solid #d1d5db", padding: "6px 8px" }}
                    >
                      <option value="">Сонгох</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {quickPatientError && (
                    <div style={{ color: "#b91c1c", fontSize: 12 }}>
                      {quickPatientError}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!quickPatientSaving) {
                          setShowQuickPatientModal(false);
                          setQuickPatientError("");
                        }
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        background: "#f9fafb",
                        cursor: quickPatientSaving ? "default" : "pointer",
                      }}
                    >
                      Хаах
                    </button>

                    <button
                      type="button"
                      onClick={handleQuickPatientSave}
                      disabled={quickPatientSaving}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        background: "#16a34a",
                        color: "white",
                        cursor: quickPatientSaving ? "default" : "pointer",
                      }}
                    >
                      {quickPatientSaving ? "Хадгалж байна..." : "Хадгалах"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

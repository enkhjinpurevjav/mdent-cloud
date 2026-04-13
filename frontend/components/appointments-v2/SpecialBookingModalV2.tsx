import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Appointment, Branch, ScheduledDoctor } from "../appointments/types";
import { SLOT_MINUTES, addMinutesToTimeString, generateTimeSlotsForDay, getDateFromYMD } from "../appointments/time";
import { formatDoctorName, formatHistoryDate, historyDoctorToDoctor } from "../appointments/formatters";
import { SLOT_FULL_MESSAGE, findFirstFullSlotForCandidate } from "./slotCapacity";
import {
  PATIENT_SEARCH_DEBOUNCE_MS,
  PATIENT_SEARCH_MIN_CHARS,
  type PatientSearchResult,
  formatPatientSearchDropdownRow,
  searchPatientsByRules,
} from "./patientSearchRules";

type RecentCompletedVisit = {
  id: number;
  scheduledAt: string;
  doctorName: string;
};

const SPECIAL_BOOKING_DURATION_MINUTES = SLOT_MINUTES * 2;
const SPECIAL_BOOKING_DURATION_LABEL =
  SPECIAL_BOOKING_DURATION_MINUTES % 60 === 0
    ? `${SPECIAL_BOOKING_DURATION_MINUTES / 60} цаг`
    : `${SPECIAL_BOOKING_DURATION_MINUTES} минут`;

type SpecialBookingModalV2Props = {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
  doctors: ScheduledDoctor[];
  appointments: Appointment[];
  defaultDate: string;
  defaultBranchId: string;
  onCreated: (appointment: Appointment) => void;
};

export default function SpecialBookingModalV2({
  open,
  onClose,
  branches,
  doctors,
  appointments,
  defaultDate,
  defaultBranchId,
  onCreated,
}: SpecialBookingModalV2Props) {
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [highlightedPatientIndex, setHighlightedPatientIndex] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [selectedPatientRecent, setSelectedPatientRecent] = useState<RecentCompletedVisit[]>([]);
  const [selectedPatientHistoryLoading, setSelectedPatientHistoryLoading] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const patientSearchRequestIdRef = useRef(0);
  const suppressPatientSearchRef = useRef(false);
  const patientSearchAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setPatientQuery("");
    setPatientResults([]);
    setPatientSearchOpen(false);
    setHighlightedPatientIndex(0);
    setSelectedPatient(null);
    setSelectedPatientRecent([]);
    setSelectedPatientHistoryLoading(false);
    setBranchId(defaultBranchId || "");
    setDoctorId("");
    setDate(defaultDate);
    setStartTime("");
    setNotes("");
    setError("");
  }, [defaultBranchId, defaultDate, open]);

  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!patientSearchAreaRef.current?.contains(event.target as Node)) {
        setPatientSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
        const rows = await searchPatientsByRules(trimmed);
        if (currentRequestId !== patientSearchRequestIdRef.current) return;
        setPatientResults(rows);
        setHighlightedPatientIndex(0);
        setPatientSearchOpen(rows.length > 0);
      } catch {
        if (currentRequestId !== patientSearchRequestIdRef.current) return;
        setPatientResults([]);
        setPatientSearchOpen(false);
      }
    }, PATIENT_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [open, patientQuery]);

  const loadSelectedPatientRecent = useCallback(async (patientId: number) => {
    try {
      setSelectedPatientHistoryLoading(true);
      const res = await fetch(`/api/patients/${patientId}/completed-appointments?limit=3`);
      const data = await res.json().catch(() => []);
      if (!res.ok || !Array.isArray(data)) {
        setSelectedPatientRecent([]);
        return;
      }
      setSelectedPatientRecent(
        data.map((item: any) => ({
          id: item.id,
          scheduledAt: item.scheduledAt,
          doctorName: item.doctor ? formatDoctorName(historyDoctorToDoctor(item.doctor)) : "",
        }))
      );
    } catch {
      setSelectedPatientRecent([]);
    } finally {
      setSelectedPatientHistoryLoading(false);
    }
  }, []);

  const handleSelectPatient = useCallback(
    (patient: PatientSearchResult) => {
      setSelectedPatient(patient);
      setSelectedPatientRecent([]);
      setPatientResults([]);
      setPatientSearchOpen(false);
      setHighlightedPatientIndex(0);
      suppressPatientSearchRef.current = true;
      setPatientQuery(formatPatientSearchDropdownRow(patient));
      setError("");
      loadSelectedPatientRecent(patient.id);
    },
    [loadSelectedPatientRecent]
  );

  const handlePatientInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPatientSearchOpen(false);
        return;
      }
      if (!patientResults.length || !patientSearchOpen) return;
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
          patientResults.length === 1 ? patientResults[0] : patientResults[highlightedPatientIndex];
        if (quickPick) handleSelectPatient(quickPick);
      }
    },
    [handleSelectPatient, highlightedPatientIndex, patientResults, patientSearchOpen]
  );

  const availableDoctors = useMemo(() => {
    if (!branchId) return [];
    const branchIdNum = Number(branchId);
    return doctors.filter((doctor) => {
      if (!Array.isArray(doctor.branches) || doctor.branches.length === 0) return true;
      return doctor.branches.some((branch) => branch.id === branchIdNum);
    });
  }, [branchId, doctors]);

  const timeOptions = useMemo(() => {
    if (!date) return [];
    return generateTimeSlotsForDay(getDateFromYMD(date)).map((slot) => slot.label);
  }, [date]);

  const handleSubmit = useCallback(async () => {
    setError("");
    if (!selectedPatient?.id) {
      setError("Үйлчлүүлэгч сонгоно уу.");
      return;
    }
    if (!branchId) {
      setError("Салбар сонгоно уу.");
      return;
    }
    if (!doctorId) {
      setError("Эмч сонгоно уу.");
      return;
    }
    if (!date) {
      setError("Огноо сонгоно уу.");
      return;
    }
    if (!startTime) {
      setError("Эхлэх цаг сонгоно уу.");
      return;
    }

    const docIdNum = Number(doctorId);
    const branchIdNum = Number(branchId);
    if (
      Number.isNaN(docIdNum) ||
      docIdNum <= 0 ||
      Number.isNaN(branchIdNum) ||
      branchIdNum <= 0
    ) {
      setError("Эмч болон салбарын мэдээлэл буруу байна.");
      return;
    }

    const scheduledAt = `${date} ${startTime}:00`;
    const endAt = `${date} ${addMinutesToTimeString(startTime, SPECIAL_BOOKING_DURATION_MINUTES)}:00`;
    const fullSlot = findFirstFullSlotForCandidate({
      appointments,
      doctorId: docIdNum,
      branchId: branchIdNum,
      startNaive: scheduledAt,
      endNaive: endAt,
    });
    if (fullSlot) {
      setError(SLOT_FULL_MESSAGE);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          doctorId: docIdNum,
          branchId: branchIdNum,
          scheduledAt,
          endAt,
          status: "booked",
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || typeof (data as Appointment).id !== "number") {
        setError((data && (data as { error?: string }).error) || "Алдаа гарлаа");
        return;
      }
      onCreated(data as Appointment);
      onClose();
    } catch {
      setError("Сүлжээгээ шалгана уу.");
    } finally {
      setSaving(false);
    }
  }, [appointments, branchId, date, doctorId, notes, onClose, onCreated, selectedPatient, startTime]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 80,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={(event) => event.stopPropagation()}
        className="bg-white rounded-[10px] p-6 w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto text-sm"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="m-0 text-base font-bold text-slate-900">Онцгой захиалга</h3>
          <button
            type="button"
            onClick={onClose}
            className="bg-transparent border-none text-xl cursor-pointer text-gray-500 leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div ref={patientSearchAreaRef} className="flex flex-col gap-1">
            <label className="font-semibold">Хайх</label>
            <input
              type="text"
              placeholder="Үйлчлүүлэгчийн овог, нэр, утас, РД"
              value={patientQuery}
              onChange={(event) => {
                const value = event.target.value;
                setPatientQuery(value);
                if (selectedPatient) {
                  setSelectedPatient(null);
                  setSelectedPatientRecent([]);
                }
                if (value.trim().length >= PATIENT_SEARCH_MIN_CHARS) setPatientSearchOpen(true);
              }}
              onKeyDown={handlePatientInputKeyDown}
              autoComplete="off"
              className="rounded border border-gray-300 px-2 py-1.5"
            />
            {patientSearchOpen && patientResults.length > 0 && (
              <div className="border border-gray-200 rounded bg-white max-h-[180px] overflow-y-auto">
                {patientResults.map((patient, index) => (
                  <button
                    key={`${patient.id}-${index}`}
                    type="button"
                    onClick={() => handleSelectPatient(patient)}
                    className="block w-full text-left px-2 py-1.5 border-none border-b border-gray-100 cursor-pointer text-xs"
                    style={{ background: index === highlightedPatientIndex ? "#eff6ff" : "#ffffff" }}
                  >
                    {formatPatientSearchDropdownRow(patient)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPatient && (
            <div className="rounded border border-slate-200 bg-slate-50 p-2.5 text-xs">
              <div className="font-semibold text-slate-800">
                {[selectedPatient.name, selectedPatient.ovog || ""].filter(Boolean).join(" ")}
              </div>
              <div className="mt-1 text-slate-700">
                🆔 {selectedPatient.regNo || "-"} · 📞 {selectedPatient.phone || "-"}
              </div>
              <div className="mt-2 font-semibold text-slate-700">Сүүлийн 3 дууссан үзлэг</div>
              <div className="mt-1 text-slate-700">
                {selectedPatientHistoryLoading ? (
                  <div className="text-slate-400">Уншиж байна...</div>
                ) : selectedPatientRecent.length === 0 ? (
                  <div className="text-slate-400">Өмнөх дууссан үзлэг байхгүй</div>
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

          <div className="flex flex-col gap-1">
            <label className="font-semibold">Салбар</label>
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setDoctorId("");
              }}
              className="rounded border border-gray-300 px-2 py-1.5"
            >
              <option value="">Салбар сонгох</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold">Эмч</label>
            <select
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
              disabled={!branchId}
              className="rounded border border-gray-300 px-2 py-1.5"
              style={{ background: !branchId ? "#f3f4f6" : undefined }}
            >
              <option value="">{branchId ? "Эмч сонгох" : "Эхлээд салбар сонгоно уу"}</option>
              {availableDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {formatDoctorName(doctor)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold">Огноо</label>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setStartTime("");
              }}
              className="rounded border border-gray-300 px-2 py-1.5"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold">Эхлэх цаг</label>
            <select
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              disabled={!date}
              className="rounded border border-gray-300 px-2 py-1.5"
              style={{ background: !date ? "#f3f4f6" : undefined }}
            >
              <option value="">Цаг сонгох</option>
              {timeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-gray-500">
            Үргэлжлэх хугацаа: <strong>{SPECIAL_BOOKING_DURATION_LABEL}</strong>
            {startTime ? (
              <>
                {" "}
                — Дуусах цаг: <strong>{addMinutesToTimeString(startTime, SPECIAL_BOOKING_DURATION_MINUTES)}</strong>
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold">Тэмдэглэл</label>
            <input
              type="text"
              placeholder="Захиалгын тэмдэглэл"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="rounded border border-gray-300 px-2 py-1.5"
            />
          </div>

          {error && <div className="text-red-700 text-xs">{error}</div>}

          <div className="flex justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded border border-gray-300 bg-gray-50 text-sm"
            >
              Цуцлах
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 rounded border-none bg-slate-900 text-white text-sm font-semibold"
            >
              {saving ? "Хадгалж байна..." : "Захиалах"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

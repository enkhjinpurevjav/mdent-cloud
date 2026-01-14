 import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import type {
  Encounter,
  Diagnosis,
  DiagnosisProblem,
  Service,
  EditableDiagnosis,
  ActiveIndicator,
  EditablePrescriptionItem,
  ChartToothRow,
  EncounterMediaType,
  ConsentType,
  EncounterConsent,
  EncounterMedia,
  VisitCard,
  WarningLine,
  EncounterService,
  AssignedTo,
  Branch,
} from "../../types/encounter-admin";
import { formatDateTime, formatShortDate, ymdLocal, addDays, getTimeHHMM, isTimeWithinRangeStr } from "../../utils/date-formatters";
import { formatPatientName, formatDoctorDisplayName, formatStaffName } from "../../utils/name-formatters";
import { extractWarningLinesFromVisitCard } from "../../utils/visit-card-helpers";
import { displayOrDash } from "../../utils/display-helpers";
import { ADULT_TEETH, CHILD_TEETH, ALL_TEETH_LABEL, stringifyToothList } from "../../utils/tooth-helpers";
import { buildFollowUpAvailability } from "../../utils/scheduling";
import SignaturePad from "../../components/SignaturePad";
import PatientHeader from "../../components/encounter/PatientHeader";
import ToothChartSelector from "../../components/encounter/ToothChartSelector";
import DiagnosesEditor from "../../components/encounter/DiagnosesEditor";
import MediaGallery from "../../components/encounter/MediaGallery";
import PrescriptionEditor from "../../components/encounter/PrescriptionEditor";
import FollowUpScheduler from "../../components/encounter/FollowUpScheduler";
import ConsentFormsBlock from "../../components/encounter/ConsentFormsBlock";

type DiagnosisServiceRow = EditableDiagnosis;

const isDxRowEffectivelyEmpty = (r: DiagnosisServiceRow | undefined | null) => {
  if (!r) return true;

  const hasDiagnosis = !!r.diagnosisId;
  const hasProblems = Array.isArray(r.selectedProblemIds) && r.selectedProblemIds.length > 0;
  const hasNote = !!(r.note || "").trim();
  const hasService = !!r.serviceId;
  const hasIndicators = Array.isArray(r.indicatorIds) && r.indicatorIds.length > 0;

  return !hasDiagnosis && !hasProblems && !hasNote && !hasService && !hasIndicators;
};


export default function EncounterAdminPage() {
  const router = useRouter();
  const { id } = router.query;

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicator[]>([]);
  const [openIndicatorIndex, setOpenIndicatorIndex] = useState<number | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [serviceFilterBranchId, setServiceFilterBranchId] = useState<
    number | null
  >(null);

  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [problemsByDiagnosis, setProblemsByDiagnosis] = useState<
    Record<number, DiagnosisProblem[]>
  >({});

  const [editableDxRows, setEditableDxRows] = useState<EditableDiagnosis[]>(
    []
  );
  const [editableServices, setEditableServices] = useState<
    EncounterService[]
  >([]);

  const [prescriptionItems, setPrescriptionItems] = useState<
    EditablePrescriptionItem[]
  >([]);
  const [prescriptionSaving, setPrescriptionSaving] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState("");

  const [media, setMedia] = useState<EncounterMedia[]>([]);
  const [mediaTypeFilter, setMediaTypeFilter] =
    useState<EncounterMediaType | "ALL">("ALL");
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [chartTeeth, setChartTeeth] = useState<ChartToothRow[]>([]);
  const [chartError, setChartError] = useState("");
  const [toothMode, setToothMode] = useState<"ADULT" | "CHILD">("ADULT");
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [activeDxRowIndex, setActiveDxRowIndex] = useState<number | null>(null);
  const [customToothRange, setCustomToothRange] = useState("");

  const loadActiveIndicators = async (branchId: number) => {
  try {
    const res = await fetch(
      `/api/sterilization/indicators/active?branchId=${branchId}`
    );
    const json = await res.json().catch(() => []);
    if (res.ok && Array.isArray(json)) {
      setActiveIndicators(json);
    } else {
      setActiveIndicators([]);
    }
  } catch {
    setActiveIndicators([]);
  }
};

  const [openDxIndex, setOpenDxIndex] = useState<number | null>(null);
  const [openServiceIndex, setOpenServiceIndex] = useState<number | null>(null);

  const toggleToothMode = (mode: "ADULT" | "CHILD") => {
    setToothMode(mode);
  };

  const isToothSelected = (code: string) => selectedTeeth.includes(code);

  const areAllModeTeethSelected = () => {
    const allCodes = toothMode === "ADULT" ? ADULT_TEETH : CHILD_TEETH;
    return allCodes.length > 0 && allCodes.every((c) => selectedTeeth.includes(c));
  };

  const updateActiveRowToothList = (
    nextTeeth: string[],
    opts?: { isAllTeeth?: boolean }
  ) => {
    // Check if we have an active row and if it's writable
    const hasWritableActiveRow = 
      activeDxRowIndex !== null && 
      rows[activeDxRowIndex] && 
      !rows[activeDxRowIndex].locked;

    // If no writable active row, create a new one (unless empty selection)
    if (!hasWritableActiveRow) {
      if (nextTeeth.length === 0 && !opts?.isAllTeeth) return;

      const idx = createDiagnosisRow(nextTeeth);
      setActiveDxRowIndex(idx);

      const toothStr = opts?.isAllTeeth
        ? ALL_TEETH_LABEL
        : stringifyToothList(nextTeeth);

      setEditableDxRows((prev) =>
        prev.map((row, i) => (i === idx ? { ...row, toothCode: toothStr } : row))
      );
      setRows((prev) =>
        prev.map((row, i) => (i === idx ? { ...row, toothCode: toothStr } : row))
      );

      return;
    }

    // Update the writable active row
    const toothStr = opts?.isAllTeeth
      ? ALL_TEETH_LABEL
      : stringifyToothList(nextTeeth);

    setEditableDxRows((prev) =>
      prev.map((row, i) =>
        i === activeDxRowIndex ? { ...row, toothCode: toothStr } : row
      )
    );
    setRows((prev) =>
      prev.map((row, i) =>
        i === activeDxRowIndex ? { ...row, toothCode: toothStr } : row
      )
    );

   if (nextTeeth.length === 0 && !opts?.isAllTeeth) {
  // if the active row is a new/unsaved row and still empty -> remove it
  const idx = activeDxRowIndex;

  if (idx !== null) {
    const r = rows[idx];

    const isNewUnsaved = !r?.id;          // not saved to DB yet
    const isUnlocked = !r?.locked;        // editable/new
    const toothEmpty = !(r?.toothCode || "").trim();
if (isNewUnsaved && isUnlocked && toothEmpty) {
  removeDiagnosisRow(idx);
}
  }

  setActiveDxRowIndex(null);
}
  };

  const handleFinishEncounter = async () => {
    if (!id || typeof id !== "string") return;
    setFinishing(true);
    try {
      await handleSaveDiagnoses();
      await handleSaveServices();
      await savePrescription();

      const res = await fetch(`/api/encounters/${id}/finish`, {
        method: "PUT",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) ||
            "Үзлэг дууссаны төлөв шинэчлэх үед алдаа гарлаа."
        );
      }

      // Reset tooth selection session after successful finish
      resetToothSelectionSession();

      // ✅ Redirect to billing page for this encounter
      await router.push(`/billing/${id}`);
    } catch (err) {
      console.error("handleFinishEncounter failed", err);
    } finally {
      setFinishing(false);
    }
  };
 
  const resetToothSelectionSession = useCallback(() => {
    setSelectedTeeth([]);
    setActiveDxRowIndex(null);
    setCustomToothRange("");
    setOpenDxIndex(null);
    setOpenServiceIndex(null);
  }, []);

  const toggleToothSelection = (code: string) => {
    if (code === "ALL") {
      const allCodes = toothMode === "ADULT" ? ADULT_TEETH : CHILD_TEETH;

      setSelectedTeeth((prev) => {
        const allSelected = allCodes.every((c) => prev.includes(c));
        const next = allSelected ? [] : allCodes;

        updateActiveRowToothList(next, { isAllTeeth: !allSelected });
        return next;
      });

      return;
    }

    setSelectedTeeth((prev) => {
      const exists = prev.includes(code);
      const next = exists ? prev.filter((c) => c !== code) : [...prev, code];

      updateActiveRowToothList(next);
      return next;
    });
  };

  const [consents, setConsents] = useState<EncounterConsent[]>([]);
  const [consentTypeDraft, setConsentTypeDraft] =
    useState<ConsentType | null>(null);
  const [consentAnswersDraft, setConsentAnswersDraft] = useState<any>({});
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [uploadingPatientSignature, setUploadingPatientSignature] = useState(false);
  const [uploadingDoctorSignature, setUploadingDoctorSignature] = useState(false);
  const [attachingDoctorSignature, setAttachingDoctorSignature] = useState(false);

  // Follow-up appointment scheduling state
  const [showFollowUpScheduler, setShowFollowUpScheduler] = useState(false);
  const [followUpDateFrom, setFollowUpDateFrom] = useState("");
  const [followUpDateTo, setFollowUpDateTo] = useState("");
  const [followUpSlotMinutes, setFollowUpSlotMinutes] = useState(30);
  const [followUpAvailability, setFollowUpAvailability] = useState<{
    days: Array<{
      date: string;
      dayLabel: string;
      slots: Array<{
        start: string;
        end: string;
        status: "available" | "booked" | "off";
        appointmentIds?: number[];
      }>;
    }>;
    timeLabels: string[];
  } | null>(null);

  // NEW: store appointments and no-schedule flag
  const [followUpAppointments, setFollowUpAppointments] = useState<any[]>([]);
  const [followUpNoSchedule, setFollowUpNoSchedule] = useState(false);
 
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState("");
  const [followUpBooking, setFollowUpBooking] = useState(false);
  const [followUpSuccess, setFollowUpSuccess] = useState("");

  const [nursesForEncounter, setNursesForEncounter] = useState<
    {
      nurseId: number;
      name?: string | null;
      ovog?: string | null;
      email: string;
      phone?: string | null;
      schedules: {
        id: number;
        date: string;
        branch: Branch;
        startTime: string;
        endTime: string;
        note?: string | null;
      }[];
    }[]
  >([]);
  const [changingNurse, setChangingNurse] = useState(false);

  const [visitCard, setVisitCard] = useState<VisitCard | null>(null);
  const [visitCardLoading, setVisitCardLoading] = useState(false);

  const [saveError, setSaveError] = useState("");

  const [rows, setRows] = useState<DiagnosisServiceRow[]>([]);
  const [servicesLoadError, setServicesLoadError] = useState("");
  const [dxError, setDxError] = useState("");
  
  const encounterId = useMemo(
    () => (typeof id === "string" ? Number(id) : NaN),
    [id]
  );

  // Helper to update a single field in both rows and editableDxRows
  const updateDxRowField = useCallback(
    <K extends keyof EditableDiagnosis>(
      index: number,
      field: K,
      value: EditableDiagnosis[K]
    ) => {
      setRows((prev) =>
        prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
      );
      setEditableDxRows((prev) =>
        prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
      );
    },
    []
  );

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    const eid = Number(id);
    if (!eid || Number.isNaN(eid)) {
      setError("ID буруу байна.");
      setLoading(false);
      return;
    }

    const loadServices = async () => {
      try {
        const res = await fetch("/api/services");
        const json = await res.json().catch(() => null);
        if (res.ok && Array.isArray(json)) {
          setServices(json);
          setServicesLoadError("");
        } else {
          setServicesLoadError("Үйлчилгээ ачааллахад алдаа гарлаа.");
        }
      } catch {
        setServicesLoadError("Үйлчилгээ ачааллахэд алдаа гарлаа.");
      }
    };

    const loadNursesForEncounter = async () => {
      try {
        const res = await fetch(`/api/encounters/${id}/nurses`);
        const json = await res.json().catch(() => null);
        if (res.ok && json && Array.isArray(json.items)) {
          setNursesForEncounter(json.items);
        } else {
          setNursesForEncounter([]);
        }
      } catch {
        setNursesForEncounter([]);
      }
    };

    // NOTE: This is the FULL `loadEncounter` function for frontend/pages/encounters/[id].tsx
// based on the code you pasted, with the "merged" behavior:
// - serviceId + serviceSearchText are restored from encounterServices using meta.diagnosisId
// - serviceSearchText uses svc.name (as you requested)
// - BOTH rows and editableDxRows are set to the same merged array (prevents drift + "sometimes disappears")

const loadEncounter = async () => {
  setLoading(true);
  setError("");

  try {
    const res = await fetch(`/api/encounters/${id}`);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((json && json.error) || "failed to load");
    }

    const enc: Encounter = json;
    setEncounter(enc);

    // 1) Build base diagnosis rows from encounterDiagnoses
    const dxRows: EditableDiagnosis[] =
      enc.encounterDiagnoses?.map((row, idx) => ({
        ...row,
        diagnosisId: row.diagnosisId ?? null,
        diagnosis: (row as any).diagnosis ?? null,
        localId: idx + 1,
        selectedProblemIds: Array.isArray(row.selectedProblemIds)
          ? row.selectedProblemIds
          : [],
        note: row.note || "",
        toothCode: row.toothCode || "",

        // service fields filled in merge step
        serviceId: undefined,
        serviceSearchText: "",

        searchText: (row as any).diagnosis
          ? `${(row as any).diagnosis.code} – ${(row as any).diagnosis.name}`
          : "",

        locked: true,

        // indicators
        indicatorIds: Array.isArray((row as any).sterilizationIndicators)
          ? (row as any).sterilizationIndicators
              .map((x: any) => x.indicatorId)
              .filter(Boolean)
          : [],
        indicatorSearchText: "",
      })) || [];

    // 2) Load active indicators for patient's branch (needed for display)
    const patientBranchId = enc?.patientBook?.patient?.branchId;
    if (patientBranchId) {
      await loadActiveIndicators(patientBranchId);
    }

    // 3) Build saved encounter services list (for linking to diagnoses)
    const svcRows: EncounterService[] =
      enc.encounterServices?.map((row) => ({
        ...row,
        quantity: row.quantity || 1,
      })) || [];
    setEditableServices(svcRows);

    // 4) Merge services back into diagnosis rows via meta.diagnosisId
    const mergedRows: DiagnosisServiceRow[] = dxRows.map((dxRow) => {
      const linkedService = svcRows.find(
        (svc) => (svc.meta as any)?.diagnosisId === dxRow.id
      );

      const assignedTo: AssignedTo =
        ((linkedService?.meta as any)?.assignedTo as AssignedTo) || "DOCTOR";

      return {
        ...dxRow,
        serviceId: linkedService?.serviceId,
        // ✅ requested: show only service name after refresh
        serviceSearchText: linkedService?.service?.name ?? "",
        assignedTo,
      };
    });

    // ✅ IMPORTANT: keep both arrays in sync to avoid "sometimes disappears"
    setRows(mergedRows);
    setEditableDxRows(mergedRows);

    // 5) Prescription items
    const rxItems: EditablePrescriptionItem[] =
      enc.prescription?.items?.map((it) => ({
        localId: it.order,
        drugName: it.drugName,
        durationDays: it.durationDays,
        quantityPerTake: it.quantityPerTake,
        frequencyPerDay: it.frequencyPerDay,
        note: it.note || "",
      })) || [];

    if (rxItems.length === 0) {
      rxItems.push({
        localId: 1,
        drugName: "",
        durationDays: null,
        quantityPerTake: null,
        frequencyPerDay: null,
        note: "",
      });
    }

    setPrescriptionItems(rxItems);
  } catch (err) {
    console.error(err);
    setError("Үзлэгийн дэлгэ��энгүйг ачааллах үед алдаа гарлаа");
    setEncounter(null);
  } finally {
    setLoading(false);
  }
};

    const loadDx = async () => {
      try {
        const res = await fetch("/api/diagnoses");
        const json = await res.json().catch(() => null);
        if (res.ok && Array.isArray(json)) {
          setDiagnoses(json);
          setDxError("");
        } else {
          setDxError("Онош ачааллахад алдаа гарлаа.");
        }
      } catch {
        setDxError("Онош ачааллахад алдаа гарлаа.");
      }
    };

    const loadConsents = async () => {
      try {
        setConsentLoading(true);
        const res = await fetch(`/api/encounters/${id}/consents`);
        const json = await res.json().catch(() => null);
        if (!res.ok) return;

        if (Array.isArray(json)) {
          setConsents(json);
          // If there's at least one consent, set the first one as active for editing
          if (json.length > 0) {
            setConsentTypeDraft(json[0].type || null);
            setConsentAnswersDraft(json[0].answers || {});
          } else {
            setConsentTypeDraft(null);
            setConsentAnswersDraft({});
          }
        } else {
          setConsents([]);
          setConsentTypeDraft(null);
          setConsentAnswersDraft({});
        }
      } catch (err) {
        console.error("loadConsents failed", err);
      } finally {
        setConsentLoading(false);
      }
    };

    const loadChartTeeth = async () => {
      try {
        const res = await fetch(`/api/encounters/${id}/chart-teeth`);
        const json = await res.json().catch(() => null);
        if (res.ok && Array.isArray(json)) {
          setChartTeeth(json);
          setChartError("");
        } else {
          setChartTeeth([]);
          setChartError("Шүдний диаграм ачааллахад алдаа гарлаа.");
        }
      } catch (err) {
        console.error("loadChartTeeth failed", err);
        setChartTeeth([]);
        setChartError("Шүдний диаграм ачааллахад алдаа гарлаа.");
      }
    };

    const loadVisitCardForEncounter = async () => {
      try {
        setVisitCardLoading(true);
        setVisitCard(null);

        const encRes = await fetch(`/api/encounters/${id}`);
        const encJson = await encRes.json().catch(() => null);
        if (!encRes.ok || !encJson?.patientBook?.bookNumber) {
          setVisitCardLoading(false);
          return;
        }
        const bookNumber: string = encJson.patientBook.bookNumber;

        const vcRes = await fetch(
          `/api/patients/visit-card/by-book/${encodeURIComponent(
            bookNumber
          )}`
        );
        const vcJson = await vcRes.json().catch(() => null);
        if (vcRes.ok && vcJson?.visitCard) {
          setVisitCard(vcJson.visitCard as VisitCard);
        } else {
          setVisitCard(null);
        }
      } catch (err) {
        console.error("loadVisitCardForEncounter failed", err);
        setVisitCard(null);
      } finally {
        setVisitCardLoading(false);
      }
    };

    void loadServices();
    void loadDx();
    void loadEncounter();
    void loadConsents();
    void loadNursesForEncounter();
    void loadChartTeeth();
    void loadVisitCardForEncounter();
  }, [id]);

  // Update serviceSearchText when services are loaded
useEffect(() => {
  if (services.length === 0) return;

  setRows((prevRows) =>
    prevRows.map((row) => {
      if (!row.serviceId) return row;
      if ((row.serviceSearchText || "").trim()) return row; // ✅ don't overwrite
      const svc = services.find((s) => s.id === row.serviceId);
      return { ...row, serviceSearchText: svc ? svc.name : "" };
    })
  );
}, [services]);

  const reloadEncounter = async () => {
    if (!id || typeof id !== "string") return;
    try {
      const res = await fetch(`/api/encounters/${id}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((json && json.error) || "failed to reload");
      }
      const enc: Encounter = json;
      setEncounter(enc);
    } catch (err) {
      console.error("reloadEncounter failed", err);
    }
  };



  
  const reloadMedia = async () => {
    if (!id || typeof id !== "string") return;
    try {
      setMediaLoading(true);
      setMediaError("");
      const query =
        mediaTypeFilter === "ALL"
          ? ""
          : `?type=${encodeURIComponent(mediaTypeFilter)}`;
      const res = await fetch(`/api/encounters/${id}/media${query}`);
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json)) {
        setMedia(json);
      } else {
        setMedia([]);
        setMediaError("Зураг ачааллахад алдаа гарлаа.");
      }
    } catch (err) {
      console.error("reloadMedia failed", err);
      setMedia([]);
      setMediaError("Зураг ачааллахад алдаа гарлаа.");
    } finally {
      setMediaLoading(false);
    }
  };

  useEffect(() => {
    void reloadMedia();
  }, [id, mediaTypeFilter]);

  // Initialize follow-up date range when checkbox is toggled on (14 days)
  useEffect(() => {
    if (showFollowUpScheduler && !followUpDateFrom) {
      const today = new Date();
      const todayStr = ymdLocal(today);
      const plusFourteen = new Date(today);
      plusFourteen.setDate(plusFourteen.getDate() + 14);
      const plusFourteenStr = ymdLocal(plusFourteen);

      setFollowUpDateFrom(todayStr);
      setFollowUpDateTo(plusFourteenStr);
    }
  }, [showFollowUpScheduler]);

  // Load availability when dates/filters change
  useEffect(() => {
    if (showFollowUpScheduler && followUpDateFrom && followUpDateTo && encounter) {
      void loadFollowUpAvailability();
    }
  }, [showFollowUpScheduler, followUpDateFrom, followUpDateTo, followUpSlotMinutes, encounter]);

  const ensureProblemsLoaded = async (diagnosisId: number) => {
    if (problemsByDiagnosis[diagnosisId]) return;
    try {
      const res = await fetch(`/api/diagnoses/${diagnosisId}/problems`);
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json)) {
        setProblemsByDiagnosis((prev) => ({
          ...prev,
          [diagnosisId]: json,
        }));
      }
    } catch (err) {
      console.error("ensureProblemsLoaded failed", err);
    }
  };

  const createDiagnosisRow = (initialTeeth: string[]): number => {
  const idx = rows.length; // deterministic index (append)
  const nextLocalId =
    rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.localId)) + 1;

  const newRow: EditableDiagnosis = {
  localId: nextLocalId,
  diagnosisId: null,
  diagnosis: null,
  selectedProblemIds: [],
  note: "",
  toothCode: stringifyToothList(initialTeeth),
  serviceId: undefined,
  searchText: "",
  serviceSearchText: "",
  locked: false,

  indicatorIds: [],
  indicatorSearchText: "",
};

  setEditableDxRows((prev) => [...prev, newRow]);
  setRows((prev) => [...prev, newRow]);

  return idx;
};

const removeDiagnosisRow = (index: number) => {
  const row = rows[index];
  if (row?.locked) {
    alert("Түгжигдсэн мөрийг устгах боломжгүй. Эхлээд түгжээг тайлна уу.");
    return;
  }

  setEditableDxRows((prev) => prev.filter((_, i) => i !== index));
  setRows((prev) => prev.filter((_, i) => i !== index));

  setOpenDxIndex((prev) => {
    if (prev === null) return null;
    if (prev === index) return null;
    if (prev > index) return prev - 1;
    return prev;
  });

  setOpenServiceIndex((prev) => {
    if (prev === null) return null;
    if (prev === index) return null;
    if (prev > index) return prev - 1;
    return prev;
  });

  setActiveDxRowIndex((prev) => {
    if (prev === null) return null;
    if (prev === index) return null;
    if (prev > index) return prev - 1;
    return prev;
  });
};

  const unlockRow = (index: number) => {
    if (confirm("Энэ мөрийн түгжээг тайлж, засварлахыг зөвшөөрч байна уу?")) {
      setEditableDxRows((prev) =>
        prev.map((row, i) =>
          i === index ? { ...row, locked: false } : row
        )
      );
      setRows((prev) =>
        prev.map((row, i) =>
          i === index ? { ...row, locked: false } : row
        )
      );
    }
  };

  const lockRow = (index: number) => {
    setEditableDxRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, locked: true } : row
      )
    );
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, locked: true } : row
      )
    );
  };

  const saveConsentApi = async (type: ConsentType | null) => {
    if (!id || typeof id !== "string") return;
    if (!type) {
      // Delete all consents
      setConsentSaving(true);
      setConsentError("");
      try {
        const res = await fetch(`/api/encounters/${id}/consent`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: null }),
        });
        if (!res.ok) {
          throw new Error("Failed to delete consents");
        }
        setConsents([]);
        setConsentTypeDraft(null);
        setConsentAnswersDraft({});
      } catch (err: any) {
        console.error("delete consents failed", err);
        setConsentError(err?.message || "Зөвшөөрөл устгахад алдаа гарлаа");
      } finally {
        setConsentSaving(false);
      }
      return;
    }

    setConsentSaving(true);
    setConsentError("");
    try {
      const res = await fetch(`/api/encounters/${id}/consents/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: consentAnswersDraft || {},
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Зөвшөөрлийн хуудас хадгалахад алдаа гарлаа"
        );
      }

      // Reload all consents
      const consentsRes = await fetch(`/api/encounters/${id}/consents`);
      const consentsJson = await consentsRes.json().catch(() => null);
      if (consentsRes.ok && Array.isArray(consentsJson)) {
        setConsents(consentsJson);
      }
    } catch (err: any) {
      console.error("saveConsent failed", err);
      setConsentError(
        err?.message || "Зөвшөөрлийн хуудас хадгалахад алдаа гарлаа"
      );
    } finally {
      setConsentSaving(false);
    }
  };

  const updateConsentAnswers = (partial: any) => {
    setConsentAnswersDraft((prev: any) => ({
      ...(prev || {}),
      ...(partial || {}),
    }));
  };

  const saveCurrentConsent = async () => {
    await saveConsentApi(consentTypeDraft);
  };

  const handlePatientSignatureUpload = async (blob: Blob) => {
    if (!id || typeof id !== "string") return;
    setUploadingPatientSignature(true);
    setConsentError("");
    try {
      const formData = new FormData();
      formData.append("file", blob, "patient-signature.png");

      const res = await fetch(`/api/encounters/${id}/patient-signature`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Гарын үсэг хадгалахад алдаа гарлаа"
        );
      }

      // Reload encounter to get updated signature fields
      await reloadEncounter();
    } catch (err: any) {
      console.error("handlePatientSignatureUpload failed", err);
      setConsentError(err?.message || "Гарын үсэг хадгалахад алдаа гарлаа");
    } finally {
      setUploadingPatientSignature(false);
    }
  };

  const handleDoctorSignatureUpload = async (blob: Blob) => {
    if (!id || typeof id !== "string") return;
    setUploadingDoctorSignature(true);
    setConsentError("");
    try {
      const formData = new FormData();
      formData.append("file", blob, "doctor-signature.png");

      const res = await fetch(`/api/encounters/${id}/doctor-signature`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Эмчийн гарын үсэг хадгалахад алдаа гарлаа"
        );
      }

      // Reload encounter to get updated signature fields
      await reloadEncounter();
    } catch (err: any) {
      console.error("handleDoctorSignatureUpload failed", err);
      setConsentError(err?.message || "Эмчийн гарын үсэг хадгалахад алдаа гарлаа");
    } finally {
      setUploadingDoctorSignature(false);
    }
  };

  const handleAttachDoctorSignature = async () => {
    if (!id || typeof id !== "string") return;
    setAttachingDoctorSignature(true);
    setConsentError("");
    try {
      const res = await fetch(`/api/encounters/${id}/doctor-signature`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Эмчийн гарын үсэг холбохд алдаа гарлаа"
        );
      }

      // Reload encounter to get updated signature fields
      await reloadEncounter();
    } catch (err: any) {
      console.error("handleAttachDoctorSignature failed", err);
      setConsentError(err?.message || "Эмчийн гарын үсэг холбохд алдаа гарлаа");
    } finally {
      setAttachingDoctorSignature(false);
    }
  };

  // Follow-up appointment scheduling functions
  const loadFollowUpAvailability = async () => {
    if (!encounter || !followUpDateFrom || !followUpDateTo) return;

    setFollowUpLoading(true);
    setFollowUpError("");
    setFollowUpNoSchedule(false);

    try {
      const doctorId = encounter.doctorId;
      const branchId = encounter.patientBook.patient.branchId;

      // 1) Load doctor schedules
      const schedParams = new URLSearchParams({
        doctorId: String(doctorId),
        dateFrom: followUpDateFrom,
        dateTo: followUpDateTo,
      });
      if (branchId) {
        schedParams.append("branchId", String(branchId));
      }

      const schedRes = await fetch(`/api/doctors/scheduled?${schedParams}`);
      const schedJson = await schedRes.json().catch(() => null);

      if (!schedRes.ok) {
        throw new Error(schedJson?.error || "Failed to load doctor schedules");
      }

      // schedJson is array of doctors with schedules
      const doctors = Array.isArray(schedJson) ? schedJson : [];
      const doctor = doctors.find((d: any) => d.id === doctorId);
      const schedules = doctor?.schedules || [];

      // 2) Load appointments
      const apptParams = new URLSearchParams({
        doctorId: String(doctorId),
        dateFrom: followUpDateFrom,
        dateTo: followUpDateTo,
        status: "ALL",
      });
      if (branchId) {
        apptParams.append("branchId", String(branchId));
      }

      const apptRes = await fetch(`/api/appointments?${apptParams}`);
      const apptJson = await apptRes.json().catch(() => null);

      if (!apptRes.ok) {
        throw new Error(apptJson?.error || "Failed to load appointments");
      }

      const appointments = Array.isArray(apptJson) ? apptJson : [];

      // Store appointments for details modal
      setFollowUpAppointments(appointments);

      // Check if no schedules exist across the range
      if (schedules.length === 0) {
        setFollowUpNoSchedule(true);
        setFollowUpAvailability(null);
      } else {
        setFollowUpNoSchedule(false);

        // 3) Build availability grid
        const availability = buildFollowUpAvailability({
          dateFrom: followUpDateFrom,
          dateTo: followUpDateTo,
          schedules: schedules.map((s: any) => ({
            id: s.id,
            doctorId: s.doctorId,
            branchId: s.branchId,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            note: s.note,
          })),
          appointments: appointments.map((a: any) => ({
            id: a.id,
            scheduledAt: a.scheduledAt,
            endAt: a.endAt,
            status: a.status,
          })),
          slotMinutes: followUpSlotMinutes,
          capacityPerSlot: 2,
        });

        setFollowUpAvailability(availability);
      }
    } catch (err: any) {
      console.error("loadFollowUpAvailability failed", err);
      setFollowUpError(err?.message || "Цагийн хуваарь татахад алдаа гарлаа");
      setFollowUpAvailability(null);
      setFollowUpAppointments([]);
      setFollowUpNoSchedule(false);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const createFollowUpAppointment = async (slotStart: string) => {
    if (!encounter) return;

    setFollowUpBooking(true);
    setFollowUpError("");
    setFollowUpSuccess("");

    try {
      // Calculate endAt (slot start + duration)
      const startDate = new Date(slotStart);
      const endDate = new Date(startDate.getTime() + followUpSlotMinutes * 60000);

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: encounter.patientBook.patient.id,
          doctorId: encounter.doctorId,
          branchId: encounter.patientBook.patient.branchId,
          scheduledAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          status: "booked",
          notes: `Давтан үзлэг — Encounter #${encounter.id}`,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create appointment");
      }

      setFollowUpSuccess(
        `Цаг амжилттай авлаа: ${formatDateTime(slotStart)}`
      );

      // Reload availability to show updated slots
      await loadFollowUpAvailability();

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setFollowUpSuccess("");
      }, 5000);
    } catch (err: any) {
      console.error("createFollowUpAppointment failed", err);
      setFollowUpError(err?.message || "Цаг авахад алдаа гарлаа");
    } finally {
      setFollowUpBooking(false);
    }
  };

  // Quick create handler for manual date/time entry (Option 3A)
  const handleQuickCreateAppointment = async (params: {
    date: string;
    time: string;
    durationMinutes: number;
  }) => {
    if (!encounter) return;

    setFollowUpBooking(true);
    setFollowUpError("");
    setFollowUpSuccess("");

    try {
      // Build ISO datetime from local date + time
      const [hh, mm] = params.time.split(":").map(Number);
      const [y, m, d] = params.date.split("-").map(Number);
      const startDate = new Date(y, m - 1, d, hh, mm, 0, 0);
      const endDate = new Date(startDate.getTime() + params.durationMinutes * 60000);

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: encounter.patientBook.patient.id,
          doctorId: encounter.doctorId,
          branchId: encounter.patientBook.patient.branchId,
          scheduledAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          status: "booked",
          notes: `Давтан үзлэг — Encounter #${encounter.id}`,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create appointment");
      }

      setFollowUpSuccess(
        `Цаг амжилттай үүсгэлээ: ${params.date} ${params.time}`
      );

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setFollowUpSuccess("");
      }, 5000);
    } catch (err: any) {
      console.error("handleQuickCreateAppointment failed", err);
      setFollowUpError(err?.message || "Цаг үүсгэхэд алдаа гарлаа");
    } finally {
      setFollowUpBooking(false);
    }
  };

  const handleDiagnosisChange = async (
    index: number,
    diagnosisId: number
  ) => {
    setEditableDxRows((prev) =>
      prev.map((row, i) => {
        if (i !== index || row.locked) return row;
        return {
          ...row,
          diagnosisId,
          selectedProblemIds: [],
        };
      })
    );
    const dx = diagnoses.find((d) => d.id === diagnosisId) || null;
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index || row.locked) return row;
        return {
          ...row,
          diagnosisId,
          diagnosis: dx,
          selectedProblemIds: [],
          searchText: dx ? `${dx.code} – ${dx.name}` : "",
        };
      })
    );
    if (diagnosisId) {
      await ensureProblemsLoaded(diagnosisId);
    }
  };

  const toggleProblem = (index: number, problemId: number) => {
    setEditableDxRows((prev) =>
      prev.map((row, i) => {
        if (i !== index || row.locked) return row;
        const exists = row.selectedProblemIds.includes(problemId);
        return {
          ...row,
          selectedProblemIds: exists
            ? row.selectedProblemIds.filter((id) => id !== problemId)
            : [...row.selectedProblemIds, problemId],
        };
      })
    );
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index || row.locked) return row;
        const exists =
          row.selectedProblemIds &&
          row.selectedProblemIds.includes(problemId);
        return {
          ...row,
          selectedProblemIds: exists
            ? row.selectedProblemIds.filter((id) => id !== problemId)
            : [...(row.selectedProblemIds || []), problemId],
        };
      })
    );
  };

  const handleNoteChange = (index: number, value: string) => {
    setEditableDxRows((prev) =>
      prev.map((row, i) =>
        i === index && !row.locked ? { ...row, note: value } : row
      )
    );
    setRows((prev) =>
      prev.map((row, i) =>
        i === index && !row.locked ? { ...row, note: value } : row
      )
    );
  };

  const handleDxToothCodeChange = (index: number, value: string) => {
    setEditableDxRows((prev) =>
      prev.map((row, i) =>
        i === index && !row.locked ? { ...row, toothCode: value } : row
      )
    );
    setRows((prev) =>
      prev.map((row, i) =>
        i === index && !row.locked ? { ...row, toothCode: value } : row
      )
    );
  };

  const handleSaveDiagnoses = async () => {
  if (!id || typeof id !== "string") return;

  setSaving(true);
  setSaveError("");

  // ✅ Snapshot by stable key (id if exists, else localId)
const snapById = new Map<number, {
  serviceId?: number;
  serviceSearchText: string;
  indicatorIds: number[];
  assignedTo: AssignedTo;
}>();

const snapByIndex = new Map<number, {
  serviceId?: number;
  serviceSearchText: string;
  indicatorIds: number[];
  assignedTo: AssignedTo;
}>();

rows.forEach((r, idx) => {
  const snap = {
    serviceId: r.serviceId,
    serviceSearchText: r.serviceSearchText || "",
    indicatorIds: Array.isArray(r.indicatorIds) ? [...r.indicatorIds] : [],
    assignedTo: r.assignedTo ?? "DOCTOR",
  };

  if (r.id) snapById.set(r.id, snap);
  else snapByIndex.set(idx, snap); // fallback for new rows
});

  try {
   const payload = {
  items: editableDxRows.map((row) => ({
    id: row.id ?? null,              // ✅ add this
    diagnosisId: row.diagnosisId,
    selectedProblemIds: row.selectedProblemIds,
    note: row.note || null,
    toothCode: row.toothCode || null,
  })),
};

    const res = await fetch(`/api/encounters/${id}/diagnoses`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error((json && json.error) || "Онош хадгалахад алдаа гарлаа");

    const saved = Array.isArray(json) ? json : [];

    const savedDxRows: EditableDiagnosis[] = saved.map((srvRow: any, idx: number) => {
      const rowId = Number(srvRow?.id);
const snap =
  (Number.isFinite(rowId) && rowId > 0 ? snapById.get(rowId) : undefined) ??
  snapByIndex.get(idx);

      return {
        ...srvRow,
        diagnosisId: srvRow.diagnosisId ?? null,
        diagnosis: srvRow.diagnosis ?? null,
        localId: idx + 1,
        selectedProblemIds: Array.isArray(srvRow.selectedProblemIds) ? srvRow.selectedProblemIds : [],
        note: srvRow.note || "",
        toothCode: srvRow.toothCode || "",

        serviceId: snap?.serviceId,
        serviceSearchText: snap?.serviceSearchText || "",
        indicatorIds: snap?.indicatorIds || [],
        indicatorSearchText: "",
        assignedTo: snap?.assignedTo ?? "DOCTOR",

        searchText: srvRow.diagnosis ? `${srvRow.diagnosis.code} – ${srvRow.diagnosis.name}` : "",
        locked: true,
      };
    });

    setEditableDxRows(savedDxRows);
    setRows(savedDxRows);

    // ✅ save indicators by matching the same key (NOT index)
    await Promise.all(
      saved.map(async (srvRow: any) => {
        const dxId = Number(srvRow?.id);
        if (!dxId) return;

       
const snap = snapById.get(dxId);

     
        const indicatorIds = snap?.indicatorIds || [];

        await fetch(`/api/encounters/${id}/diagnoses/${dxId}/sterilization-indicators`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ indicatorIds }),
        });
      })
    );
  } catch (err: any) {
    console.error("handleSaveDiagnoses failed", err);
    setSaveError(err?.message || "Онош хадгалахад алдаа гарлаа.");
  } finally {
    setSaving(false);
  }
};

  const handleSaveServices = async () => {
    if (!id || typeof id !== "string") return;
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
  items: rows
    .filter((r) => r.serviceId)
    .map((r) => {
      const svc = services.find((s) => s.id === r.serviceId);
      const isImaging = svc?.category === "IMAGING";

      return {
        serviceId: r.serviceId!,
        quantity: 1,
        assignedTo: isImaging ? (r.assignedTo ?? "DOCTOR") : "DOCTOR",
        diagnosisId: r.id ?? null, // IMPORTANT: must be EncounterDiagnosis row id
      };
    }),
};

      const res = await fetch(`/api/encounters/${id}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Үйлчилгээ хадгалахад алдаа гарлаа"
        );
      }

      if (encounter) {
        setEncounter({
          ...encounter,
          encounterServices: json,
        });
      }
      setEditableServices(json);
setRows((prev) =>
  prev.map((dxRow) => {
    const linked = (Array.isArray(json) ? json : []).find(
      (es: any) => (es.meta as any)?.diagnosisId === dxRow.id
    );
    if (!linked) return dxRow;

    const svc = services.find((s) => s.id === linked.serviceId);
    return {
      ...dxRow,
      serviceId: linked.serviceId,
      serviceSearchText: svc ? `${svc.code} – ${svc.name}` : dxRow.serviceSearchText,
      assignedTo: (linked.meta as any)?.assignedTo ?? dxRow.assignedTo ?? "DOCTOR",
    };
  })
);
     
    } catch (err: any) {
      console.error("handleSaveServices failed", err);
      setSaveError(
        err?.message || "Үйлчилгээ хадгалахад алдаа гарлаа."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangeNurse = async (nurseIdStr: string) => {
    if (!id || typeof id !== "string") return;
    setChangingNurse(true);
    try {
      const nurseId =
        nurseIdStr === "" ? null : Number(nurseIdStr) || null;

      const res = await fetch(`/api/encounters/${id}/nurse`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurseId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Сувилагч сонгоход алдаа гарлаа"
        );
      }

      if (encounter) {
        setEncounter({
          ...encounter,
          nurse: json.nurse || null,
          nurseId: json.nurse ? json.nurse.id : null,
        });
      }
    } catch (err) {
      console.error("handleChangeNurse failed", err);
    } finally {
      setChangingNurse(false);
    }
  };

  const savePrescription = async () => {
    if (!id || typeof id !== "string") return;
    setPrescriptionSaving(true);
    setPrescriptionError("");
    try {
      const payload = {
        items: prescriptionItems.map((it) => ({
          drugName: it.drugName,
          durationDays: it.durationDays ?? 1,
          quantityPerTake: it.quantityPerTake ?? 1,
          frequencyPerDay: it.frequencyPerDay ?? 1,
          note: it.note || "",
        })),
      };

      const res = await fetch(`/api/encounters/${id}/prescription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Жор хадгалахад алдаа гарлаа"
        );
      }

      if (encounter) {
        setEncounter({
          ...encounter,
          prescription: json.prescription,
        });
      }

      const newItems: EditablePrescriptionItem[] =
        json.prescription?.items?.map((it: any) => ({
          localId: it.order,
          drugName: it.drugName,
          durationDays: it.durationDays,
          quantityPerTake: it.quantityPerTake,
          frequencyPerDay: it.frequencyPerDay,
          note: it.note || "",
        })) || [];

      if (newItems.length === 0) {
  newItems.push({
    localId: 1,
    drugName: "",
    durationDays: null,
    quantityPerTake: null,
    frequencyPerDay: null,
    note: "",
  });
}

      setPrescriptionItems(newItems);
    } catch (err: any) {
      console.error("savePrescription failed", err);
      setPrescriptionError(
        err?.message || "Жор хадгалахад алдаа гарлаа."
      );
    } finally {
      setPrescriptionSaving(false);
    }
  };

 

  const handleMediaUpload = async (file: File) => {
    if (!id || typeof id !== "string") return;
    try {
      setUploadingMedia(true);
      setMediaError("");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("toothCode", selectedTeeth.join(",") || "");
      formData.append(
        "type",
        mediaTypeFilter === "ALL" ? "XRAY" : mediaTypeFilter
      );

      const res = await fetch(`/api/encounters/${id}/media`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Файл байршуулахад алдаа гарлаа"
        );
      }

      await reloadMedia();
    } catch (err: any) {
      console.error("handleMediaUpload failed", err);
      setMediaError(
        err?.message || "Файл байршуулахад алдаа гарлаа."
      );
    } finally {
      setUploadingMedia(false);
    }
  };


  const warningLines: WarningLine[] = extractWarningLinesFromVisitCard(
    visitCard
  );

  const totalDiagnosisServicesPrice = rows.reduce((sum, r) => {
    if (!r.serviceId) return sum;
    const svc = services.find((x) => x.id === r.serviceId);
    const price = svc?.price ?? 0;
    return sum + price;
  }, 0);

  if (!id || typeof id !== "string") {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: 24,
          fontFamily: "sans-serif",
        }}
      >
        <h1>Үзлэгийн дэлгэрэнгүй</h1>
        <div style={{ color: "red" }}>ID буруу байна.</div>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>
        Үзлэгийн дэлгэрэнгүй
      </h1>

      {loading && <div>Ачаалж байна...</div>}
      {!loading && error && (
        <div style={{ color: "red", marginBottom: 12 }}>{error}</div>
      )}

      {!loading && !error && encounter && (
        <>
          <PatientHeader
            encounter={encounter}
            warningLines={warningLines}
            nursesForEncounter={nursesForEncounter}
            changingNurse={changingNurse}
            onChangeNurse={handleChangeNurse}
            onNavigateToPatient={() =>
              router.push(
                `/patients/${encodeURIComponent(
                  encounter.patientBook.bookNumber
                )}`
              )
            }
            onNavigateToVisitCard={() =>
              router.push(
                `/patients/${encodeURIComponent(
                  encounter.patientBook.bookNumber
                )}?tab=visit-card`
              )
            }
            onNavigateToOrtho={() =>
              router.push(
                `/ortho/${encodeURIComponent(
                  encounter.patientBook.bookNumber
                )}`
              )
            }
            onNavigateToPreviousEncounters={() =>
              router.push(
                `/patients/${encodeURIComponent(
                  encounter.patientBook.bookNumber
                )}?tab=encounters`
              )
            }
          />

          <section
            style={{
              marginBottom: 16,
            }}
          >
            <ConsentFormsBlock
              encounter={encounter}
              consents={consents}
              consentTypeDraft={consentTypeDraft}
              consentAnswersDraft={consentAnswersDraft}
              consentSaving={consentSaving}
              consentLoading={consentLoading}
              consentError={consentError}
              uploadingPatientSignature={uploadingPatientSignature}
              uploadingDoctorSignature={uploadingDoctorSignature}
              attachingDoctorSignature={attachingDoctorSignature}
              onConsentTypeDraftChange={setConsentTypeDraft}
              onConsentAnswersDraftUpdate={updateConsentAnswers}
              onSaveConsent={saveCurrentConsent}
              onSaveConsentApi={saveConsentApi}
              onPatientSignatureUpload={handlePatientSignatureUpload}
              onDoctorSignatureUpload={handleDoctorSignatureUpload}
              onAttachDoctorSignature={handleAttachDoctorSignature}
            />

            {/* Follow-up Appointment Scheduler */}
            <FollowUpScheduler
              showFollowUpScheduler={showFollowUpScheduler}
              followUpDateFrom={followUpDateFrom}
              followUpDateTo={followUpDateTo}
              followUpSlotMinutes={followUpSlotMinutes}
              followUpAvailability={followUpAvailability}
              followUpLoading={followUpLoading}
              followUpError={followUpError}
              followUpSuccess={followUpSuccess}
              followUpBooking={followUpBooking}
              followUpAppointments={followUpAppointments}
              followUpNoSchedule={followUpNoSchedule}
              onToggleScheduler={(checked) => {
                setShowFollowUpScheduler(checked);
                if (!checked) {
                  setFollowUpError("");
                  setFollowUpSuccess("");
                  setFollowUpAvailability(null);
                  setFollowUpAppointments([]);
                  setFollowUpNoSchedule(false);
                }
              }}
              onDateFromChange={setFollowUpDateFrom}
              onDateToChange={setFollowUpDateTo}
              onSlotMinutesChange={setFollowUpSlotMinutes}
              onBookAppointment={createFollowUpAppointment}
              onQuickCreate={handleQuickCreateAppointment}
            />
          </section>

          <ToothChartSelector
            toothMode={toothMode}
            selectedTeeth={selectedTeeth}
            customToothRange={customToothRange}
            chartError={chartError}
            onToggleToothMode={toggleToothMode}
            onToggleToothSelection={toggleToothSelection}
            onCustomToothRangeChange={setCustomToothRange}
            isToothSelected={isToothSelected}
            areAllModeTeethSelected={areAllModeTeethSelected}
          />

          <section
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <DiagnosesEditor
              rows={rows}
              diagnoses={diagnoses}
              services={services}
              activeIndicators={activeIndicators}
              problemsByDiagnosis={problemsByDiagnosis}
              dxError={dxError}
              servicesLoadError={servicesLoadError}
              saveError={saveError}
              saving={saving}
              finishing={finishing}
              prescriptionSaving={prescriptionSaving}
              openDxIndex={openDxIndex}
              openServiceIndex={openServiceIndex}
              openIndicatorIndex={openIndicatorIndex}
              activeDxRowIndex={activeDxRowIndex}
              totalDiagnosisServicesPrice={totalDiagnosisServicesPrice}
              onDiagnosisChange={handleDiagnosisChange}
              onToggleProblem={toggleProblem}
              onNoteChange={handleNoteChange}
              onToothCodeChange={handleDxToothCodeChange}
              onRemoveRow={removeDiagnosisRow}
              onUnlockRow={unlockRow}
              onLockRow={lockRow}
              onSetOpenDxIndex={setOpenDxIndex}
              onSetOpenServiceIndex={setOpenServiceIndex}
              onSetOpenIndicatorIndex={setOpenIndicatorIndex}
              onSetActiveDxRowIndex={setActiveDxRowIndex}
              onUpdateRowField={updateDxRowField}
              onSave={async () => {
                await handleSaveDiagnoses();
                await handleSaveServices();
                await savePrescription();
              }}
              onFinish={handleFinishEncounter}
              onResetToothSelection={resetToothSelectionSession}
            />

            <MediaGallery
              media={media}
              mediaLoading={mediaLoading}
              mediaError={mediaError}
              uploadingMedia={uploadingMedia}
              onUpload={handleMediaUpload}
              onReload={reloadMedia}
            />

            <PrescriptionEditor
              prescriptionItems={prescriptionItems}
              prescriptionSaving={prescriptionSaving}
              prescriptionError={prescriptionError}
              onUpdateItem={(idx, updates) =>
                setPrescriptionItems((prev) =>
                  prev.map((p, i) => (i === idx ? { ...p, ...updates } : p))
                )
              }
              onRemoveItem={(idx) =>
                setPrescriptionItems((prev) =>
                  prev.filter((_, i) => i !== idx)
                )
              }
              onAddItem={() => {
                if (prescriptionItems.length >= 3) return;
                setPrescriptionItems((prev) => [
                  ...prev,
                  {
                    localId: prev.length + 1,
                    drugName: "",
                    durationDays: null,
                    quantityPerTake: null,
                    frequencyPerDay: null,
                    note: "",
                  },
                ]);
              }}
              onSave={savePrescription}
            />
          </section>
        </>
      )}
    </main>
  );
}

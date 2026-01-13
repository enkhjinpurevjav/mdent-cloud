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
import SignaturePad from "../../components/SignaturePad";
import PatientHeader from "../../components/encounter/PatientHeader";
import ToothChartSelector from "../../components/encounter/ToothChartSelector";
import DiagnosesEditor from "../../components/encounter/DiagnosesEditor";
import MediaGallery from "../../components/encounter/MediaGallery";
import PrescriptionEditor from "../../components/encounter/PrescriptionEditor";
import FollowUpScheduler from "../../components/encounter/FollowUpScheduler";

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
        appointmentId?: number;
      }>;
    }>;
    timeLabels: string[];
  } | null>(null);

const [weekSchedules, setWeekSchedules] = useState<any[]>([]);
const [weekAppointments, setWeekAppointments] = useState<any[]>([]);
const [weekLoading, setWeekLoading] = useState(false);
const [weekError, setWeekError] = useState("");
 
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
            serviceId: undefined,
            searchText: (row as any).diagnosis
              ? `${(row as any).diagnosis.code} – ${
                  (row as any).diagnosis.name
                }`
              : "",
            serviceSearchText: "",
            locked: true,
            indicatorIds: Array.isArray((row as any).sterilizationIndicators)
  ? (row as any).sterilizationIndicators.map((x: any) => x.indicatorId).filter(Boolean)
  : [],
indicatorSearchText: "",
          })) || [];
        setEditableDxRows(dxRows);

        const patientBranchId = enc?.patientBook?.patient?.branchId;
if (patientBranchId) {
  await loadActiveIndicators(patientBranchId);
}

        const svcRows: EncounterService[] =
          enc.encounterServices?.map((row) => ({
            ...row,
            quantity: row.quantity || 1,
          })) || [];
        setEditableServices(svcRows);

        // Restore services to their diagnosis rows based on meta.diagnosisId
        // Use a function that will be called after services are loaded
        const mergedRows: DiagnosisServiceRow[] = dxRows.map((dxRow) => {
          // Find a service that belongs to this diagnosis row
          const linkedService = svcRows.find((svc) => {
            const diagnosisId = (svc.meta as any)?.diagnosisId;
            return diagnosisId && diagnosisId === dxRow.id;
          });

          const assignedTo = linkedService ? (linkedService.meta as any)?.assignedTo || "DOCTOR" : "DOCTOR";

          return {
            ...dxRow,
            serviceId: linkedService?.serviceId,
            serviceSearchText: "", // Will be filled when services are loaded
            assignedTo,
          };
        });
        setRows(mergedRows);

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
        setError("Үзлэгийн дэлгэрэнгүйг ачааллах үед алдаа гарлаа");
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
        const svc = services.find((s) => s.id === row.serviceId);
        return {
          ...row,
          serviceSearchText: svc ? `${svc.code} – ${svc.name}` : "",
        };
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

  // Initialize follow-up date range when checkbox is toggled on
  useEffect(() => {
    if (showFollowUpScheduler && !followUpDateFrom) {
      const today = new Date();
      const todayStr = ymdLocal(today);
      const plusSeven = new Date(today);
      plusSeven.setDate(plusSeven.getDate() + 7);
      const plusSevenStr = ymdLocal(plusSeven);

      setFollowUpDateFrom(todayStr);
      setFollowUpDateTo(plusSevenStr);
    }
  }, [showFollowUpScheduler]);

  // Load availability when dates/filters change
 useEffect(() => {
  // Disabled old availability endpoint:
  // it caused timezone shift + backend memory issues.
  // if (showFollowUpScheduler && followUpDateFrom && followUpDateTo) {
  //   void loadFollowUpAvailability();
  // }
}, [showFollowUpScheduler, followUpDateFrom, followUpDateTo, followUpSlotMinutes]);

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
    try {
      const params = new URLSearchParams({
        doctorId: String(encounter.doctorId),
        from: followUpDateFrom,
        to: followUpDateTo,
        slotMinutes: String(followUpSlotMinutes),
        ...(encounter.patientBook.patient.branchId && {
          branchId: String(encounter.patientBook.patient.branchId),
        }),
      });

      const res = await fetch(`/api/appointments/availability?${params}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load availability");
      }

      setFollowUpAvailability(json);
    } catch (err: any) {
      console.error("loadFollowUpAvailability failed", err);
      setFollowUpError(err?.message || "Цагийн хуваарь татахад алдаа гарлаа");
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
          notes: "Давтан үзлэг",
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
  const snapByKey = new Map<string, {
    serviceId?: number;
    serviceSearchText: string;
    indicatorIds: number[];
    assignedTo: AssignedTo;
  }>();

  rows.forEach((r) => {
    const key = r.id ? `id:${r.id}` : `local:${r.localId}`;
    snapByKey.set(key, {
      serviceId: r.serviceId,
      serviceSearchText: r.serviceSearchText || "",
      indicatorIds: Array.isArray(r.indicatorIds) ? [...r.indicatorIds] : [],
      assignedTo: r.assignedTo ?? "DOCTOR",
    });
  });

  try {
    const payload = {
      items: editableDxRows.map((row) => ({
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
      const key = srvRow?.id ? `id:${srvRow.id}` : `local:${idx + 1}`;
      const snap = snapByKey.get(key);

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

        const key = `id:${dxId}`;
        const snap = snapByKey.get(key);
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
              diagnosisId: r.id || null, // Store diagnosis row ID for later restoration
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
            {/* TODO: Consider replacing with <ConsentFormsBlock /> component once the UX pattern
                is aligned. Current implementation uses checkbox + radio pattern, while
                ConsentFormsBlock uses button selection pattern. */}
            <div
              style={{
                marginTop: 4,
                marginBottom: 4,
                padding: 8,
                borderRadius: 6,
                border: "1px dashed #e5e7eb",
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
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={consents.length > 0}
                    disabled={consentLoading || consentSaving}
                    onChange={async (e) => {
                      if (e.target.checked) {
                        await saveConsentApi("root_canal");
                      } else {
                        await saveConsentApi(null);
                      }
                    }}
                  />
                  <span>Зөвшөөрлийн хуудас шаардлагатай</span>
                </label>

                {consentLoading && (
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    (ачаалж байна...)
                  </span>
                )}

                {consentError && (
                  <span style={{ fontSize: 12, color: "#b91c1c" }}>
                    {consentError}
                  </span>
                )}
              </div>

              {consents.length > 0 && (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>Төрөл:</span>

                    <label
                      style={{
                        display: "inline-flex",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="radio"
                        name="consentType"
                        value="root_canal"
                        checked={consentTypeDraft === "root_canal"}
                        disabled={consentSaving}
                        onChange={() => {
                          setConsentTypeDraft("root_canal");
                          const existingConsent = consents.find((c) => c.type === "root_canal");
                          if (existingConsent) {
                            setConsentAnswersDraft(existingConsent.answers || {});
                          } else {
                            setConsentAnswersDraft({});
                            void saveConsentApi("root_canal");
                          }
                        }}
                      />
                      Сувгийн эмчилгээ
                    </label>

                    <label
                      style={{
                        display: "inline-flex",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="radio"
                        name="consentType"
                        value="surgery"
                        checked={consentTypeDraft === "surgery"}
                        disabled={consentSaving}
                        onChange={() => {
                          setConsentTypeDraft("surgery");
                          const existingConsent = consents.find((c) => c.type === "surgery");
                          if (existingConsent) {
                            setConsentAnswersDraft(existingConsent.answers || {});
                          } else {
                            setConsentAnswersDraft({});
                            void saveConsentApi("surgery");
                          }
                        }}
                      />
                      Мэс засал
                    </label>

                    <label
                      style={{
                        display: "inline-flex",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="radio"
                        name="consentType"
                        value="orthodontic"
                        checked={consentTypeDraft === "orthodontic"}
                        disabled={consentSaving}
                        onChange={() => {
                          setConsentTypeDraft("orthodontic");
                          const existingConsent = consents.find((c) => c.type === "orthodontic");
                          if (existingConsent) {
                            setConsentAnswersDraft(existingConsent.answers || {});
                          } else {
                            setConsentAnswersDraft({});
                            void saveConsentApi("orthodontic");
                          }
                        }}
                      />
                      Гажиг засал
                    </label>

                    <label
                      style={{
                        display: "inline-flex",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="radio"
                        name="consentType"
                        value="prosthodontic"
                        checked={consentTypeDraft === "prosthodontic"}
                        disabled={consentSaving}
                        onChange={() => {
                          setConsentTypeDraft("prosthodontic");
                          const existingConsent = consents.find((c) => c.type === "prosthodontic");
                          if (existingConsent) {
                            setConsentAnswersDraft(existingConsent.answers || {});
                          } else {
                            setConsentAnswersDraft({});
                            void saveConsentApi("prosthodontic");
                          }
                        }}
                      />
                      Согог засал
                    </label>
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      paddingTop: 4,
                      borderTop: "1px dashed #e5e7eb",
                      fontSize: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {consentTypeDraft === "root_canal" && (
                      <div>
                        <div
                          style={{
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: 14,
                            marginBottom: 8,
                          }}
                        >
                          “MON FAMILY” Шүдний эмнэлгийн шүдний сувгийн эмчилгээ
                          хийх таниулсан зөвшөөрлийн хуудас
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: "#111827",
                            marginBottom: 8,
                            whiteSpace: "pre-line",
                          }}
                        >
                          Шүдний сувгийн (endodont) эмчилгээ нь шүдний цөгц болон
                          сурвалжийн хөндийд байрлах мэдрэл судасны багц
                          (зөөлц)-д үүссэн өвдөлт үрэвслийг эмчлэх олон удаагийн
                          (3-5 удаагийн ирэлт болон тухайн шүдний үрэвслийн
                          байдлаас шалтгаалан 5-с дээш 6 сар хүртэл хугацаагаар)
                          ирэлтээр эмчлэгддэг курс эмчилгээ юм. Сувгийн
                          эмчилгээгээр суваг доторх үрэвслийг намдаадаг боловч
                          шүдний сурвалжийн оройн эдийн өөрчлөлт нь хэвийн
                          байдалд эргэн орж, эдгэрэхэд хугацаа шаардагддаг.
                          {"\n\n"}
                          Сувгийн эмчилгээний эхний 1-7 хоногт эмчилгээтэй
                          шүднүүдэд эвгүй мэдрэмжүүд үүсч болно. Тэр хугацаанд
                          тухайн шүдээр ачаалал үүсэх хэт хатуу (ааруул, хатуу
                          чихэр, үртэй жимс, самар... гэх мэт) зүйлс хазаж идэхийг
                          хатуу хориглоно. Хатуу зүйлс нь тухайн шүдний зовиур
                          таагүй мэдрэмжүүдийг ихэсгэх, мөн эрдэсгүйжсэн шүдний
                          (сувгийн эмчилгээтэй шүд нь мэдрэл судасгүй болсны
                          улмаас хэврэг болдог) цөгцний болон сурвалжийн хугарал
                          үүсч цаашлаад тухайн шүд авагдах хүртэл хүндрэл үүсч
                          болдог.
                          {"\n\n"}
                          Эмчилгээ хийлгэсэн шүд хэсэг хугацааны дараа өнгө
                          хувирч болно. Цоорол их хэмжээгээр үүсч шүдний цөгцний
                          ихэнхи хэсэг цооролд өртсөн (цөгцний ½-1/3 хүртэл)
                          шүдэнд сувгийн эмчилгээний дараа голонцор (метал,
                          шилэн) ашиглан тухайн шүдийг сэргээдэг. Сувгийн
                          эмчилгээ ихэнхи тохиолдолд тухайн хүний дархлааны
                          системтэй хамааралтай байдаг ба даарч хөрөх, ханиад
                          томуу, стресс ядаргаа, ажлын ачаалал, нойргүйдэл,
                          дааврын өөрчлөлт (жирэмсэн, хөхүүл, архаг хууч
                          өвчтэй хүмүүс, өндөр настнууд) зэрэг нь эмчилгээний
                          хугацаа болон үр дүнг уртасгаж удаашруулж болно.
                          {"\n\n"}
                          Эмчилгээний явцад үйлчлүүлэгч эмчийн заасан хугацаанд
                          эмчилгээндээ ирэхгүй байх, эмчийн бичиж өгсөн эм,
                          уусмалыг зааврын дагуу уухгүй байх, огт хэрэглээгүй
                          байх зэрэг нь эмчилгээний үр дүнд шууд нөлөөлөх ба
                          аливаа хүндрэл (эрүүл мэнд болон санхүүгийн) эрсдэлийг
                          тухайн үйлчлүүлэгч өөрөө бүрэн хариуцна.
                          {"\n\n"}
                          Үүсч болох эрсдлүүд: Сувгийн эмчилгээг шүдний сувагт
                          тохирсон зориулалтын нарийн багажнуудаар жижгээс
                          томруулах зарчимаар хийдэг эмчилгээ бөгөөд зарим
                          шүдний сурвалж анатомын онцлогоос хамаарч хэт далий
                          муруй, нарийн байснаас болж эмчийн ажиллах явцад
                          сувагт багаж хугарах, сурвалж цоорох, сурвалж, цөгц
                          хугарах, мэдээ алдуулах тарианд харшлах зэрэг эрсдлүүд
                          үүсч болно.
                        </div>

                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 10,
                            fontSize: 12,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!consentAnswersDraft?.acknowledged}
                            onChange={async (e) => {
                              updateConsentAnswers({
                                acknowledged: e.target.checked,
                              });
                              await saveConsentApi(consentTypeDraft);
                            }}
                          />
                          <span>
                            Өвчтөн / асран хамгаалагч танилцуулгыг бүрэн уншиж,
                            ойлгож зөвшөөрсөн.
                          </span>
                        </label>

                        <div
                          style={{
                            marginTop: 4,
                            paddingTop: 6,
                            borderTop: "1px dashed #e5e7eb",
                            fontSize: 12,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <div style={{ flex: "1 1 150px" }}>
                              <div
                                style={{
                                  marginBottom: 2,
                                  color: "#4b5563",
                                }}
                              >
                                Үйлчлүүлэгч / асран хамгаалагчийн нэр
                              </div>
                              <input
                                type="text"
                                value={consentAnswersDraft?.patientName || ""}
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    patientName: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                placeholder="Ж: Б. Болор"
                                style={{
                                  width: "100%",
                                  borderRadius: 6,
                                  border: "1px solid #d1d5db",
                                  padding: "4px 6px",
                                }}
                              />
                            </div>

                            <div style={{ flex: "1 1 200px" }}>
                              <div
                                style={{
                                  marginBottom: 2,
                                  color: "#4b5563",
                                }}
                              >
                                Эмчилгээ хийсэн эмчийн нэр
                              </div>
                              <div>
                                <strong>
                                  {formatDoctorDisplayName(
                                    encounter.doctor
                                  )}
                                </strong>
                              </div>
                            </div>
                          </div>

                          <div>
                            Огноо:{" "}
                            <strong>
                              {formatShortDate(encounter.visitDate)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {consentTypeDraft === "surgery" && (
                      <div>
                        <div
                          style={{
                            marginBottom: 8,
                            fontSize: 13,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>Сонголт:</span>
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <input
                              type="radio"
                              name="surgeryMode"
                              checked={
                                consentAnswersDraft?.surgeryMode !==
                                "PROCEDURE"
                              }
                              onChange={async () => {
                                updateConsentAnswers({
                                  surgeryMode: "SURGERY",
                                });
                                await saveConsentApi(consentTypeDraft);
                              }}
                            />
                            <span>Мэс засал</span>
                          </label>
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <input
                              type="radio"
                              name="surgeryMode"
                              checked={
                                consentAnswersDraft?.surgeryMode ===
                                "PROCEDURE"
                              }
                              onChange={async () => {
                                updateConsentAnswers({
                                  surgeryMode: "PROCEDURE",
                                });
                                await saveConsentApi(consentTypeDraft);
                              }}
                            />
                            <span>Мэс ажилбар</span>
                          </label>
                        </div>

                        {consentAnswersDraft?.surgeryMode === "PROCEDURE" ? (
                          <div>
                            <div
                              style={{
                                textAlign: "center",
                                fontWeight: 700,
                                fontSize: 14,
                                marginBottom: 8,
                              }}
                            >
                              МЭС АЖИЛБАР ХИЙЛГЭХ ТУХАЙ ЗӨВШӨӨРЛИЙН ХУУДАС
                            </div>

                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: 12,
                                marginBottom: 6,
                              }}
                            >
                              А) МЭДЭЭЛЛИЙН ХУУДАС
                            </div>

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Санал болгож буй мэс ажилбарын нэр:
                            </label>
                            <textarea
                              value={consentAnswersDraft?.name || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  name: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={2}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Санал болгож буй мэс ажилбарын үр дүн (эмнэл
                              зүйн туршлагын дүн, нотолгоонд тулгуурлан
                              бүрэн эдгэрэлт, сайжралт, эндэгдэл,
                              хүндрэлийн магадлалыг хувиар илэрхийлэн
                              ойлгомжтойгоор тайлбарлана):
                            </label>
                            <textarea
                              value={consentAnswersDraft?.outcome || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  outcome: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Гарч болох эрсдлүүд (эрсдлүүдийг нэг бүрчлэн
                              дурдана):
                            </label>
                            <textarea
                              value={consentAnswersDraft?.risks || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  risks: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Гарч болох хүндрэлүүд (хүндрэлүүдийг нэг
                              бүрчлэн дурдана):
                            </label>
                            <textarea
                              value={consentAnswersDraft?.complications || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  complications: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Тухайн мэс ажилбарын үед хийгдэж болох нэмэлт
                              ажилбарууд (ажилбаруудыг нэг бүрчлэн дурдана):
                            </label>
                            <textarea
                              value={
                                consentAnswersDraft?.additionalProcedures ||
                                ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  additionalProcedures: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Тухайн мэс ажилбар орлуулах боломжтой эмчилгээний
                              бусад аргууд (бусад аргуудыг дурдана):
                            </label>
                            <textarea
                              value={
                                consentAnswersDraft?.alternativeTreatments ||
                                ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  alternativeTreatments: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Санал болгож буй мэс ажилбарын давуу тал:
                            </label>
                            <textarea
                              value={consentAnswersDraft?.advantages || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  advantages: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <div
                              style={{
                                marginTop: 4,
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 500,
                                  marginBottom: 2,
                                }}
                              >
                                Санал болгож буй мэс ажилбарын үед хийгдэх
                                мэдээгүйжүүлэлт:
                              </div>

                              {[
                                {
                                  key: "anesthesiaGeneral",
                                  label: "Ерөнхий",
                                },
                                {
                                  key: "anesthesiaSpinal",
                                  label: "Нугасны мэдээ алдуулалт",
                                },
                                {
                                  key: "anesthesiaLocal",
                                  label: "Хэсгийн мэдээ алдуулалт",
                                },
                                {
                                  key: "anesthesiaSedation",
                                  label: "Тайвшруулалт",
                                },
                              ].map((opt) => {
                                const checked =
                                  !!consentAnswersDraft?.[opt.key];
                                return (
                                  <label
                                    key={opt.key}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      marginBottom: 2,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={async (e) => {
                                        updateConsentAnswers({
                                          [opt.key]: e.target.checked,
                                        });
                                        await saveConsentApi(
                                          consentTypeDraft
                                        );
                                      }}
                                    />
                                    <span>{opt.label}</span>
                                  </label>
                                );
                              })}
                            </div>

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Үйлчлүүлэгчээс тавьсан асуулт:
                            </label>
                            <textarea
                              value={
                                consentAnswersDraft?.patientQuestions || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  patientQuestions: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={2}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 4,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Дээрх асуултын товч:
                            </label>
                            <textarea
                              value={
                                consentAnswersDraft?.questionSummary || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  questionSummary: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={2}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Эмчтэй холбоо барих утас:
                            </label>
                            <input
                              type="text"
                              value={consentAnswersDraft?.doctorPhone || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  doctorPhone: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 8,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                marginBottom: 6,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  !!consentAnswersDraft?.doctorExplained
                                }
                                onChange={async (e) => {
                                  updateConsentAnswers({
                                    doctorExplained: e.target.checked,
                                  });
                                  await saveConsentApi(consentTypeDraft);
                                }}
                              />
                              <span>
                                Би үйлчлүүлэгчдээ дээрх мэдээллүүдийг
                                дэлгэрэнгүй, энгийн ойлгомжтой хэллэгээр
                                тайлбарлаж өгсөн болно.
                              </span>
                            </label>

                            <div
                              style={{
                                marginTop: 4,
                                paddingTop: 6,
                                borderTop: "1px dashed #e5e7eb",
                                fontSize: 12,
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              <div style={{ flex: "1 1 200px" }}>
                                Эмчийн нэр:{" "}
                                <strong>
                                  {formatDoctorDisplayName(
                                    encounter.doctor
                                  )}
                                </strong>
                              </div>
                              <div style={{ flex: "1 1 160px" }}>
                                Огноо:{" "}
                                <strong>
                                  {formatShortDate(
                                    encounter.visitDate
                                  )}
                                </strong>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div
                              style={{
                                textAlign: "center",
                                fontWeight: 700,
                                fontSize: 14,
                                marginBottom: 8,
                              }}
                            >
                              МЭС ЗАСАЛ ХИЙЛГЭХ ТУХАЙ ЗӨВШӨӨРЛИЙН ХУУДАС
                            </div>

                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: 12,
                                marginBottom: 6,
                              }}
                            >
                              А) МЭДЭЭЛЛИЙН ХУУДАС
                            </div>

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Санал болгож буй мэс заслын нэр:
                            </label>
                            <textarea
                              value={consentAnswersDraft?.name || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  name: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={2}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Санал болгож буй мэс заслын үр дүн (эмнэл зүйн
                              туршлагын дүн, нотолгоонд тулгуурлан бүрэн
                              эдгэрэлт, сайжралт, эндэгдэл, хүндрэлийн
                              магадлалыг хувиар илэрхийлэн тайлбарлана):
                            </label>
                            <textarea
                              value={consentAnswersDraft?.outcome || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  outcome: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Гарч болох эрсдлүүд (эрсдлүүдийг нэг бүрчлэн
                              дурдана):
                            </label>
                            <textarea
                              value={consentAnswersDraft?.risks || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  risks: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Гарч болох хүндрэлүүд (хүндрэлүүдийг нэг
                              бүрчлэн дурдана):
                            </label>
                            <textarea
                              value={consentAnswersDraft?.complications || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  complications: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Тухайн мэс заслын үед хийгдэж болох нэмэлт
                              ажилбарууд:
                            </label>
                            <textarea
                              value={
                                consentAnswersDraft?.additionalProcedures ||
                                ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  additionalProcedures: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Тухайн мэс заслыг орлуулах боломжтой бусад
                              эмчилгээний аргууд:
                            </label>
                            <textarea
                              value={
                                consentAnswersDraft?.alternativeTreatments ||
                                ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  alternativeTreatments: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Санал болгож буй мэс заслын давуу тал:
                            </label>
                            <textarea
                              value={consentAnswersDraft?.advantages || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  advantages: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <div
                              style={{
                                marginTop: 4,
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 500,
                                  marginBottom: 2,
                                }}
                              >
                                Санал болгож буй мэс заслын үед хийгдэх
                                мэдээгүйжүүлэлт:
                              </div>

                              {[
                                {
                                  key: "anesthesiaGeneral",
                                  label: "Ерөнхий",
                                },
                                {
                                  key: "anesthesiaSpinal",
                                  label: "Нугасны мэдээ алдуулалт",
                                },
                                {
                                  key: "anesthesiaLocal",
                                  label: "Хэсгийн мэдээ алдуулалт",
                                },
                                {
                                  key: "anesthesiaSedation",
                                  label: "Тайвшруулалт",
                                },
                              ].map((opt) => {
                                const checked =
                                  !!consentAnswersDraft?.[opt.key];
                                return (
                                  <label
                                    key={opt.key}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      marginBottom: 2,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={async (e) => {
                                        updateConsentAnswers({
                                          [opt.key]: e.target.checked,
                                        });
                                        await saveConsentApi(
                                          consentTypeDraft
                                        );
                                      }}
                                    />
                                    <span>{opt.label}</span>
                                  </label>
                                );
                              })}
                            </div>

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Үйлчлүүлэгчээс тавьсан асуулт:
                            </label>
                            <textarea
                              value={
                                consentAnswersDraft?.patientQuestions || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  patientQuestions: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={2}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 4,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Дээрх асуултын товч:
                            </label>
                            <textarea
                              value={
                                consentAnswersDraft?.questionSummary || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  questionSummary: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={2}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 6,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Эмчтэй холбоо барих утас:
                            </label>
                            <input
                              type="text"
                              value={consentAnswersDraft?.doctorPhone || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  doctorPhone: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                marginBottom: 8,
                                fontSize: 12,
                              }}
                            />

                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                marginBottom: 6,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  !!consentAnswersDraft?.doctorExplained
                                }
                                onChange={async (e) => {
                                  updateConsentAnswers({
                                    doctorExplained: e.target.checked,
                                  });
                                  await saveConsentApi(consentTypeDraft);
                                }}
                              />
                              <span>
                                Би үйлчлүүлэгчдээ дээрх мэдээллүүдийг
                                дэлгэрэнгүй, энгийн ойлгомжтой хэллэгээр
                                тайлбарлаж өгсөн болно.
                              </span>
                            </label>

                            <div
                              style={{
                                marginTop: 4,
                                paddingTop: 6,
                                borderTop: "1px dashed #e5e7eb",
                                fontSize: 12,
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              <div style={{ flex: "1 1 200px" }}>
                                Эмчийн нэр:{" "}
                                <strong>
                                  {formatDoctorDisplayName(
                                    encounter.doctor
                                  )}
                                </strong>
                              </div>
                              <div style={{ flex: "1 1 160px" }}>
                                Огноо:{" "}
                                <strong>
                                  {formatShortDate(
                                    encounter.visitDate
                                  )}
                                </strong>
                              </div>
                            </div>
                          </div>
                        )}

                        <div
                          style={{
                            marginTop: 8,
                            paddingTop: 6,
                            borderTop: "1px dashed #e5e7eb",
                            fontSize: 12,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 12,
                              marginBottom: 4,
                            }}
                          >
                            Б) ҮЙЛЧЛҮҮЛЭГЧИЙН ЗӨВШӨӨРӨЛ
                          </div>

                          <label
                            style={{
                              display: "block",
                              marginBottom: 4,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={
                                !!consentAnswersDraft?.patientConsentMain
                              }
                              onChange={async (e) => {
                                updateConsentAnswers({
                                  patientConsentMain: e.target.checked,
                                });
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{ marginRight: 6 }}
                            />
                            Эмчийн санал болгож буй мэс засал / мэс
                            ажилбарыг дээрхи мэдээ алдуулалтаар хийлгэхийг
                            БИ ЗӨВШӨӨРЧ БАЙНА. Түүнчлэн гэмтсэн эд,
                            эрхтний хэсэг болон эд эрхтнийг журмын дагуу
                            устгахыг уг эмнэлэгт зөвшөөрч байна.
                          </label>

                          <label
                            style={{
                              display: "block",
                              marginBottom: 4,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={
                                !!consentAnswersDraft?.patientConsentInfo
                              }
                              onChange={async (e) => {
                                updateConsentAnswers({
                                  patientConsentInfo: e.target.checked,
                                });
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{ marginRight: 6 }}
                            />
                            Мэс засал / мэс ажилбарын үр дүн, гарч болох
                            хүндрэл, эрсдэл, нэмэлт ажилбарууд, орлуулж
                            болох эмчилгээний талаар БИ тодорхой мэдээлэл
                            авсан болно.
                          </label>

                          <div
                            style={{
                              marginTop: 6,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  marginBottom: 2,
                                  color: "#4b5563",
                                }}
                              >
                                Үйлчлүүлэгчийн нэр (гарын үсгийн талбарын
                                оронд):
                              </div>
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft
                                    ?.patientSignatureName || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    patientSignatureName:
                                      e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  width: "100%",
                                  borderRadius: 6,
                                  border: "1px solid #d1d5db",
                                  padding: "4px 6px",
                                  fontSize: 12,
                                }}
                              />
                            </div>

                            <div>
                              <div
                                style={{
                                  marginBottom: 2,
                                  color: "#4b5563",
                                }}
                              >
                                Асран хамгаалагч / харгалзан дэмжигчийн нэр
                                (хэрэв үйлчлүүлэгч эрх зүйн чадамжгүй бол):
                              </div>
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.guardianName || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    guardianName: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  width: "100%",
                                  borderRadius: 6,
                                  border: "1px solid #d1d5db",
                                  padding: "4px 6px",
                                  fontSize: 12,
                                  marginBottom: 4,
                                }}
                              />

                              <input
                                type="text"
                                placeholder="Нэр, үйлчлүүлэгчтэй холбоотой эсэх"
                                value={
                                  consentAnswersDraft
                                    ?.guardianRelationDescription ||
                                  ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    guardianRelationDescription:
                                      e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  width: "100%",
                                  borderRadius: 6,
                                  border: "1px solid #d1d5db",
                                  padding: "4px 6px",
                                  fontSize: 12,
                                }}
                              />
                            </div>

                            <div>
                              <div
                                style={{
                                  marginBottom: 2,
                                  color: "#4b5563",
                                }}
                              >
                                Үйлчлүүлэгч эрх зүйн чадамжгүй байгаа
                                шалтгаан:
                              </div>
                              {[
                                "minor",
                                "unconscious",
                                "mentalDisorder",
                                "other",
                              ].map((key) => {
                                const labels: Record<string, string> = {
                                  minor: "Насанд хүрээгүй",
                                  unconscious: "Ухаангүй",
                                  mentalDisorder: "Сэтгэцийн эмгэгтэй",
                                  other: "Бусад (тайлбарлана уу)",
                                };
                                const checked =
                                  !!consentAnswersDraft?.incapacityReason?.[
                                    key
                                  ];
                                return (
                                  <label
                                    key={key}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      marginBottom: 2,
                                      fontSize: 12,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const prev =
                                          consentAnswersDraft
                                            ?.incapacityReason || {};
                                        updateConsentAnswers({
                                          incapacityReason: {
                                            ...prev,
                                            [key]: e.target.checked,
                                          },
                                        });
                                      }}
                                      onBlur={async () => {
                                        await saveConsentApi(
                                          consentTypeDraft
                                        );
                                      }}
                                    />
                                    <span>{labels[key]}</span>
                                  </label>
                                );
                              })}

                              <textarea
                                placeholder="Бусад шалтгааны тайлбар"
                                value={
                                  consentAnswersDraft?.incapacityReason
                                    ?.otherText || ""
                                }
                                onChange={(e) => {
                                  const prev =
                                    consentAnswersDraft?.incapacityReason ||
                                    {};
                                  updateConsentAnswers({
                                    incapacityReason: {
                                      ...prev,
                                      otherText: e.target.value,
                                    },
                                  });
                                }}
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                rows={2}
                                style={{
                                  width: "100%",
                                  borderRadius: 6,
                                  border: "1px solid #d1d5db",
                                  padding: "4px 6px",
                                  marginTop: 2,
                                  fontSize: 12,
                                }}
                              />
                            </div>

                            <div
                              style={{
                                marginTop: 6,
                                paddingTop: 6,
                                borderTop: "1px dashed #e5e7eb",
                              }}
                            >
                              <div
                                style={{
                                  marginBottom: 4,
                                  color: "#4b5563",
                                  fontSize: 12,
                                }}
                              >
                                Хэрэв өвчтөн жирэмсэн тохиолдолд:
                              </div>
                              <label
                                style={{
                                  display: "block",
                                  marginBottom: 4,
                                  fontSize: 12,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    !!consentAnswersDraft?.husbandConsent
                                  }
                                  onChange={async (e) => {
                                    updateConsentAnswers({
                                      husbandConsent: e.target.checked,
                                    });
                                    await saveConsentApi(consentTypeDraft);
                                  }}
                                  style={{ marginRight: 6 }}
                                />
                                Миний эхнэрийн хийлгэхээр зөвшөөрсөн мэс
                                ажилбар / мэс заслыг би зөвшөөрч байна.
                              </label>

                              <div
                                style={{
                                  marginBottom: 2,
                                  color: "#4b5563",
                                }}
                              >
                                Нөхрийн нэр:
                              </div>
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.husbandName || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    husbandName: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  width: "100%",
                                  borderRadius: 6,
                                  border: "1pxsolid #d1d5db",
                                  padding: "4px 6px",
                                  fontSize: 12,
                                  marginBottom: 4,
                                }}
                              />

                              <textarea
                                placeholder="Хэрэв нөхөр / асран хамгаалагч / харгалзан дэмжигч нь зөвшөөрөөгүй бол тайлбарлана уу."
                                value={
                                  consentAnswersDraft
                                    ?.husbandRefuseReason || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    husbandRefuseReason: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                rows={2}
                                style={{
                                  width: "100%",
                                  borderRadius: 6,
                                  border: "1px solid #d1d5db",
                                  padding: "4px 6px",
                                  fontSize: 12,
                                }}
                              />
                            </div>

                            <div style={{ marginTop: 6, fontSize: 12 }}>
                              Огноо:{" "}
                              <strong>
                                {formatShortDate(encounter.visitDate)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {consentTypeDraft === "orthodontic" && (
                      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                        <div
                          style={{
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: 14,
                            marginBottom: 8,
                          }}
                        >
                          Шүд эрүүний гажиг заслын эмчилгээ хийлгэх өвчтөний
                          зөвшөөрлийн хуудас
                        </div>

                        <div style={{ marginBottom: 8 }}>
                          Нүүр амны гажиг заслын эмчилгээ хийлгэснээр таны:
                          <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                            <li>
                              Амыг хөндийд эрүүл ахуйн байдал (шүдний цоорол,
                              тулгуур эдийн өвчлөлийг багасгана.)
                            </li>
                            <li>Нүүрний гадаад төрх</li>
                            <li>Өөртөө итгэх үнэлэмж</li>
                            <li>Үйл зүйн тохирлын байдал сайжирна.</li>
                          </ul>
                        </div>

                        <div style={{ marginBottom: 8 }}>
                          Нүүр амны гажиг заслын эмчилгээний үр дүн нь эмч
                          өвчтөний хамтын үйл ажиллагаанаас шууд хамаарадаг ба
                          өвчтөн эмчийн заавар, зөвлөгөөг дагаж мөрдөх
                          шаардлагатай. Учир нь өвчтөн эмчийн заавар
                          зөвлөгөөг мөрдөөгүй улмаас эмчилгээний явцад тодорхой
                          хүндрэлүүд гарах боломжтой. Гажиг заслын эмчилгээг нь
                          олон улсын мөрдөдөг эмчилгээний стандартыг дагуу
                          төлөвлөгдөн эхэлдэг боловч нэр бүрийн хүчин зүйлээс
                          шалтгаалж үйлчлүүлэгч болон эмчилгээний үр дүн
                          харилцан адилгүй, мөн хүссэн хэмжээнд хүрэхгүй байх
                          ч тохиолдол гардаг. Иймээс эмчилгээний үр дүнг тэр
                          болгог урьдчилан мэдэх боломжгүй тул баталгааг
                          өгдөггүй. Гажиг заслын эмчилгээгээр шүдний механик
                          хүч ашиглан шүдүүдийг хөдөлгөн зуултыг засдаг бөгөөд
                          зажлах, ярьж, залгих, үлээх үйлдлийн давтамжаас
                          хамаарч тухайн хүч нь яс, сурвалж, буйл, шүдний тулгуур
                          эд болон эрүүл үенд ачаалал өгдөг юм.
                        </div>

                        <div style={{ marginBottom: 8 }}>
                          Анагаах ухааны салбарт эмчилгээг болон өөрийн
                          хэрэгсэл эрсдэл дагуулдаг бөгөөд зөвхөн нэг шүд
                          эрүүний гажиг заслын эмчилгээний явцад дараах
                          хүндрэлүүд гарч болзошгүй.
                        </div>

                        <ol style={{ paddingLeft: 20, marginBottom: 8 }}>
                          <li>
                            Өвчтөн шүдээ тогтмол угаахгүй байх, нүүрс-ус болон
                            чихэрний агууламж өндөртэй хүнсний
                            бүтээгдэхүүнүүд хэрэглэхээс шүд эрдэсгүйтэн
                            цоорох, буйл үрэвсэх. Үүний улмаас шүдийг 1 удаа
                            фтортуулах шаардлагатай байж болно.
                          </li>
                          <li>
                            Эмчилгээний явцад зарим өвчтөнүүдийн шүдний
                            сурвалж богиносож, яс нь бага хэмжээгээр шимэгдэж
                            болно. Харин өвчтөний наснаас хамааран (25 наснаас
                            дээш) шүд суух, буйл шамарч, шүд хөдөлгөөнтэй болох
                            хүндрэлүүд гарч болзошгүй.
                          </li>
                          <li>
                            Амны хөндийн эрүүл ахуй дутуу сахиснаар буйл
                            болон шүдний холбоос эдээр халдвар дамжиж, шүдийг
                            тойрон хүрээлсэн тулгуур эд гэмтэх, улмаар шүд
                            хөдөлгөөнтэй болох эрсдэлтэй.
                          </li>
                          <li>
                            Эмчилгээний дараа бэхжүүлэх зэмсгийг тогтмол
                            зүүхгүй байх, зажлах зуршил буруу хэвээр байх,
                            амьсгалаа амаар авах, зуршлын өөрчлөлт хийхгүй байх
                            зэрэг нь гажиг давтан үүсэх шалтгаан болдог.
                          </li>
                        </ol>

                        <div
                          style={{
                            marginTop: 8,
                            paddingTop: 6,
                            borderTop: "1px dashed #e5e7eb",
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: 4,
                            }}
                          >
                            Сонгож хийх боломж
                          </div>

                          <div style={{ marginBottom: 8 }}>
                            Гажиг заслын эмчилгээ хийлгэх нь хувь хүний
                            сонголт юм. Иймээс зарим өвчтөн эмчилгээний явцад
                            өөрийн шүдний байрлал, зуулт, бүтэц, нүүрний
                            гадаад үзэмж зэрэгт сэтгэл ханамжтай байх
                            тохиолдолд эмчилгээг дуусгалгүй орхих боломжтой.
                            Энэ нь өвчтөний сонголт юм. Жишээ нь: шүд
                            авахуулах/хийгээр засуулах, эрүү нүүрний мэс засал
                            хийлгэхгүй байх, хиймэл шүд хийлгэх зэргийг гажиг
                            заслын эмчилгээ эхлэхээс өмнө эмчтэй зөвлөж
                            сонголтоо хийх хэрэгтэй.
                          </div>

                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: 4,
                            }}
                          >
                            Төлбөр тооцоо
                          </div>

                          <ol style={{ paddingLeft: 20 }}>
                            <li>
                              Гажиг заслын эмчилгээний зэмсгийн төлбөр нь
                              таны сонголтоос хамаарна.
                            </li>
                            <li>
                              Өвчтөн сар бүр давтан үзүүлэхэд{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.orthoMonthlyFee || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoMonthlyFee: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 80,
                                  borderRadius: 4,
                                  border: "1px solid #d1d5db",
                                  padding: "0 4px",
                                  fontSize: 12,
                                }}
                              />{" "}
                              төгрөгийн төлбөр төлнө.
                            </li>
                            <li>
                              Зэмсэг унасан, гэмтсэн тохиолдолд зэмсгээс
                              хамааран{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.orthoBrokenFee || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoBrokenFee: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 80,
                                  borderRadius: 4,
                                  border: "1pxsolid #d1d5db",
                                  padding: "0 4px",
                                  fontSize: 12,
                                }}
                              />{" "}
                              төгрөг нэмж төлнө.
                            </li>
                            <li>
                              Гажиг заслын эмчилгээний үр дүнг бэхжүүлэх
                              зэмсэг нь{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.orthoRetainerFee ||
                                  ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoRetainerFee: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 80,
                                  borderRadius: 4,
                                  border: "1px solid #d1d5db",
                                  padding: "0 4px",
                                  fontSize: 12,
                                }}
                              />{" "}
                              төгрөг байна.
                            </li>
                          </ol>
                        </div>

                        <div
                          style={{
                            marginTop: 8,
                            paddingTop: 6,
                            borderTop: "1px dashed #e5e7eb",
                            marginBottom: 8,
                          }}
                        >
                          <ol start={6} style={{ paddingLeft: 20 }}>
                            <li>
                              Гажиг заслын эмчилгээний явцад хэрэглэгдэх
                              нэмэлт тоноглолууд (hook, open coil, stopper,
                              torque spring, button, band г.м) тус бүр{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.orthoAccessoryFee ||
                                  ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoAccessoryFee: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 80,
                                  borderRadius: 4,
                                  border: "1px solid #d1d5db",
                                  padding: "0 4px",
                                  fontSize: 12,
                                }}
                              />{" "}
                              төгрөгийн төлбөртэй.
                            </li>
                            <li>
                              Эмчилгээний явцад ирэхгүй 3 сар тутамд нэмэлт
                              төлбөр{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.orthoNoShowFee3m ||
                                  ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoNoShowFee3m: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 80,
                                  borderRadius: 4,
                                  border: "1px solid #d1d5db",
                                  padding: "0 4px",
                                  fontSize: 12,
                                }}
                              />{" "}
                              төгрөг бодогдоно.
                            </li>
                            <li>
                              6 сар болон түүнээс дээш хугацаагаар
                              эмчилгээндээ ирэхгүй тохиолдолд рентген зураг
                              дахин авч оношлогоо дахин хийнэ. Эмчилгээний
                              төлбөр нэмэлт{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.orthoNoShowFee6m ||
                                  ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoNoShowFee6m: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 80,
                                  borderRadius: 4,
                                  border: "1px solid #d1d5db",
                                  padding: "0 4px",
                                  fontSize: 12,
                                }}
                              />{" "}
                              төгрөг байна.
                            </li>
                            <li>
                              9 болон түүнээс дээш сараар эмчилгээндээ ирэхгүй
                              бол нэмэлт төлбөр{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft
                                    ?.orthoNoShowFee9mOrMore || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoNoShowFee9mOrMore:
                                      e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 80,
                                  borderRadius: 4,
                                  border: "1px solid #d1d5db",
                                  padding: "0 4px",
                                  fontSize: 12,
                                }}
                              />{" "}
                              авч эмчилгээг дахин эхлүүлнэ.
                            </li>
                            <li>
                              1 жил буюу түүнээс дээш хугацаагаар
                              эмчилгээндээ ирэхгүй тохиолдолд гажиг заслын
                              эмчилгээг зогсоож, ахин шинээр хийлгэх
                              эмчилгээг дахин эхлүүлнэ.
                            </li>
                            <li>
                              Гажиг заслын авхдагтай зэмсэг зүүх хугацаанд 6
                              сар тутам, эмчилгээ дууссаны дараа рентген
                              зураг авах ба 1 рентген зургийн төлбөр{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.orthoXrayFee || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoXrayFee: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 80,
                                  borderRadius: 4,
                                  border: "1px solid #d1d5db",
                                  padding: "0 4px",
                                  fontSize: 12,
                                }}
                              />{" "}
                              төгрөг байна.
                            </li>
                            <li>
                              12.{" "}
                              <textarea
                                placeholder="Эмчийн нэмэлт тэмдэглэл / тусгай нөхцөл"
                                value={
                                  consentAnswersDraft?.orthoExtraNotes || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoExtraNotes: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                rows={2}
                                style={{
                                  width: "100%",
                                  borderRadius: 6,
                                  border: "1px solid #d1d5db",
                                  padding: "4px 6px",
                                  fontSize: 12,
                                  marginTop: 4,
                                }}
                              />
                            </li>
                          </ol>

                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                            }}
                          >
                            Танилцуулсан зөвшөөрлийг уншиж зөвшөөрсөн
                            өвчтөний гарын үсэг{" "}
                            <input
                              type="text"
                              placeholder="гарын үсэг"
                              value={
                                consentAnswersDraft
                                  ?.orthoPatientAgreeSignature || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  orthoPatientAgreeSignature:
                                    e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{
                                minWidth: 80,
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                padding: "0 4px",
                                fontSize: 12,
                              }}
                            />{" "}
                            /{" "}
                            <input
                              type="text"
                              placeholder="нэр"
                              value={
                                consentAnswersDraft
                                  ?.orthoPatientAgreeName || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  orthoPatientAgreeName: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{
                                minWidth: 80,
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                padding: "0 4px",
                                fontSize: 12,
                              }}
                            />
                            <br />
                            Өвчтөний асран хамгаалагчийн гарын үсэг{" "}
                            <input
                              type="text"
                              placeholder="гарын үсэг"
                              value={
                                consentAnswersDraft
                                  ?.orthoGuardianAgreeSignature || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  orthoGuardianAgreeSignature:
                                    e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{
                                minWidth: 80,
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                padding: "0 4px",
                                fontSize: 12,
                              }}
                            />{" "}
                            /{" "}
                            <input
                              type="text"
                              placeholder="нэр"
                              value={
                                consentAnswersDraft
                                  ?.orthoGuardianAgreeName || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  orthoGuardianAgreeName: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{
                                minWidth: 80,
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                padding: "0 4px",
                                fontSize: 12,
                              }}
                            />
                            <br />
                            Эмчилгээ хийж буй эмчийн гарын үсэг{" "}
                            <input
                              type="text"
                              placeholder="гарын үсэг"
                              value={
                                consentAnswersDraft
                                  ?.orthoDoctorAgreeSignature || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  orthoDoctorAgreeSignature:
                                    e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{
                                minWidth: 80,
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                padding: "0 4px",
                                fontSize: 12,
                              }}
                            />{" "}
                            /{" "}
                            <strong>
                              {formatDoctorDisplayName(encounter.doctor)}
                            </strong>
                            <div style={{ marginTop: 4 }}>
                              Огноо:{" "}
                              <strong>
                                {formatShortDate(encounter.visitDate)}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 8,
                            borderTop: "1px dashed #e5e7eb",
                          }}
                        >
                          <div
                            style={{
                              textAlign: "center",
                              fontWeight: 600,
                              fontSize: 13,
                              marginBottom: 8,
                            }}
                          >
                            Эмчилгээний танилцуулга гэрээ
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 16,
                              marginBottom: 8,
                            }}
                          >
                            <div>
                              Овог:{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.orthoIntroOvog || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoIntroOvog: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 140,
                                  borderRadius: 4,
                                  border: "1px solid #d1d5db",
                                  padding: "0 6px",
                                  fontSize: 12,
                                }}
                              />
                            </div>
                            <div>
                              Нэр:{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft?.orthoIntroName || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoIntroName: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 140,
                                  borderRadius: 4,
                                  border: "1px solid #d1d5db",
                                  padding: "0 6px",
                                  fontSize: 12,
                                }}
                              />
                            </div>
                            <div>
                              Огноо:{" "}
                              <strong>
                                {formatShortDate(encounter.visitDate)}
                              </strong>
                            </div>
                          </div>

                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              marginBottom: 6,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={
                                !!consentAnswersDraft
                                  ?.orthoIntroDoctorExplained
                              }
                              onChange={async (e) => {
                                updateConsentAnswers({
                                  orthoIntroDoctorExplained:
                                    e.target.checked,
                                });
                                await saveConsentApi(consentTypeDraft);
                              }}
                            />
                            <span>
                              Хийгдэхээр төлөвлөгдсөн эмчилгээ болон түүнээс
                              гарч болох хүндрэлүүдийг эмч тайлбарлаж өгсөн
                              болно.
                            </span>
                          </label>

                          <div
                            style={{
                              fontSize: 12,
                              marginBottom: 6,
                            }}
                          >
                            НАС сургуулийн НAСЭ-т сургалт, эрдэм
                            шинжилгээ, эмчилгээ, үйлчилгээ зэрэг явагддаг тул
                            нэгдсэн багээр (эмч, багш, резидент эмч,
                            оюутнууд хамтран) үзлэг, эмчилгээ хийхийг
                            зөвшөөрч байна.
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 16,
                              marginBottom: 8,
                              fontSize: 12,
                            }}
                          >
                            <div>
                              Эмчийн нэр:{" "}
                              <strong>
                                {formatDoctorDisplayName(encounter.doctor)}
                              </strong>
                            </div>
                            <div>
                              Гарын үсэг:{" "}
                              <input
                                type="text"
                                value={
                                  consentAnswersDraft
                                    ?.orthoIntroDoctorSignature || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    orthoIntroDoctorSignature:
                                      e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsentApi(consentTypeDraft);
                                }}
                                style={{
                                  minWidth: 140,
                                  borderRadius: 4,
                                  border: "1px solid #d1d5db",
                                  padding: "0 6px",
                                  fontSize: 12,
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ marginBottom: 6 }}>
                            <div
                              style={{
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Үйлчлүүлэгчийн асуусан асуулт:
                            </div>
                            <textarea
                              value={
                                consentAnswersDraft
                                  ?.orthoIntroPatientQuestions || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  orthoIntroPatientQuestions:
                                    e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1pxsolид #d1d5db",
                                padding: "4px 6px",
                                fontSize: 12,
                              }}
                            />
                          </div>

                          <div style={{ marginBottom: 6 }}>
                            <div
                              style={{
                                fontWeight: 500,
                                marginBottom: 2,
                              }}
                            >
                              Эмчийн хариулт:
                            </div>
                            <textarea
                              value={
                                consentAnswersDraft?.orthoIntroDoctorAnswer ||
                                ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  orthoIntroDoctorAnswer: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              rows={3}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                padding: "4px 6px",
                                fontSize: 12,
                              }}
                            />
                          </div>

                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              marginTop: 6,
                              marginBottom: 4,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={
                                !!consentAnswersDraft
                                  ?.orthoIntroPatientUnderstood
                              }
                              onChange={async (e) => {
                                updateConsentAnswers({
                                  orthoIntroPatientUnderstood:
                                    e.target.checked,
                                });
                                await saveConsentApi(consentTypeDraft);
                              }}
                            />
                            <span>
                              Хийлгэх эмчилгээний талаар дэлгэрэнгүй
                              тайлбар авсан бөгөөд энэхүү эмчилгээг хийлгэхийг
                              зөвшөөрч байна.
                            </span>
                          </label>

                          <div style={{ marginTop: 4, fontSize: 12 }}>
                            Үйлчлүүлэгчийн гарын үсэг{" "}
                            <input
                              type="text"
                              value={
                                consentAnswersDraft
                                  ?.orthoIntroPatientSignature1 || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  orthoIntroPatientSignature1:
                                    e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{
                                minWidth: 140,
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                padding: "0 6px",
                                fontSize: 12,
                              }}
                            />
                            <br />
                            Үйлчлүүлэгчийн гарын үсэг{" "}
                            <input
                              type="text"
                              value={
                                consentAnswersDraft
                                  ?.orthoIntroPatientSignature2 || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  orthoIntroPatientSignature2:
                                    e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{
                                minWidth: 140,
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                padding: "0 6px",
                                fontSize: 12,
                                marginTop: 2,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {consentTypeDraft === "prosthodontic" && (
                      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                        <div
                          style={{
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: 14,
                            marginBottom: 12,
                          }}
                        >
                          НАСЗ заслын эмчилгээний танилцуулах зөвшөөрөл
                        </div>

                        <textarea
                          placeholder="Эмчилгээний ерөнхий тайлбар, зорилго, онцлог..."
                          value={consentAnswersDraft?.prosthoIntroText || ""}
                          onChange={(e) =>
                            updateConsentAnswers({
                              prosthoIntroText: e.target.value,
                            })
                          }
                          onBlur={async () => {
                            await saveConsentApi(consentTypeDraft);
                          }}
                          rows={3}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 8px",
                            fontSize: 12,
                            marginBottom: 10,
                          }}
                        />

                        <div
                          style={{
                            fontWeight: 500,
                            marginBottom: 2,
                          }}
                        >
                          Хоёрдох удаагийн ирэлтээр:
                        </div>
                        <textarea
                          value={
                            consentAnswersDraft?.prosthoSecondVisit || ""
                          }
                          onChange={(e) =>
                            updateConsentAnswers({
                              prosthoSecondVisit: e.target.value,
                            })
                          }
                          onBlur={async () => {
                            await saveConsentApi(consentTypeDraft);
                          }}
                          rows={2}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 8px",
                            fontSize: 12,
                            marginBottom: 10,
                          }}
                        />

                        <div
                          style={{
                            fontWeight: 500,
                            marginBottom: 2,
                          }}
                        >
                          Эмчилгээний сул тал:
                        </div>
                        <textarea
                          value={consentAnswersDraft?.prosthoWeakPoints || ""}
                          onChange={(e) =>
                            updateConsentAnswers({
                              prosthoWeakPoints: e.target.value,
                            })
                          }
                          onBlur={async () => {
                            await saveConsentApi(consentTypeDraft);
                          }}
                          rows={2}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 8px",
                            fontSize: 12,
                            marginBottom: 10,
                          }}
                        />

                        <div
                          style={{
                            fontWeight: 500,
                            marginBottom: 2,
                          }}
                        >
                          Эмчилгээний явц:
                        </div>
                        <textarea
                          value={consentAnswersDraft?.prosthoCourse || ""}
                          onChange={(e) =>
                            updateConsentAnswers({
                              prosthoCourse: e.target.value,
                            })
                          }
                          onBlur={async () => {
                            await saveConsentApi(consentTypeDraft);
                          }}
                          rows={2}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 8px",
                            fontSize: 12,
                            marginBottom: 10,
                          }}
                        />

                        <div
                          style={{
                            fontWeight: 500,
                            marginBottom: 2,
                          }}
                        >
                          Эмчилгээний үнэ өртөг:
                        </div>
                        <textarea
                          value={consentAnswersDraft?.prosthoCost || ""}
                          onChange={(e) =>
                            updateConsentAnswers({
                              prosthoCost: e.target.value,
                            })
                          }
                          onBlur={async () => {
                            await saveConsentApi(consentTypeDraft);
                          }}
                          rows={2}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 8px",
                            fontSize: 12,
                            marginBottom: 10,
                          }}
                        />

                        <div
                          style={{
                            fontWeight: 500,
                            marginBottom: 2,
                          }}
                        >
                          Танилцах зөвшөөрлийг уншиж танилцсан:
                        </div>
                        <textarea
                          value={
                            consentAnswersDraft?.prosthoAcknowledgement || ""
                          }
                          onChange={(e) =>
                            updateConsentAnswers({
                              prosthoAcknowledgement: e.target.value,
                            })
                          }
                          onBlur={async () => {
                            await saveConsentApi(consentTypeDraft);
                          }}
                          rows={2}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 8px",
                            fontSize: 12,
                            marginBottom: 12,
                          }}
                        />

                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                          }}
                        >
                          <div style={{ marginBottom: 6 }}>
                            Эмчлэгч эмч:{" "}
                            <input
                              type="text"
                              placeholder="гарын үсэг"
                              value={
                                consentAnswersDraft?.prosthoDoctorSignature ||
                                ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  prosthoDoctorSignature: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsentApi(consentTypeDraft);
                              }}
                              style={{
                                minWidth: 120,
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                padding: "0 6px",
                                fontSize: 12,
                                marginRight: 6,
                              }}
                            />
                            /{" "}
                            <strong>
                              {formatDoctorDisplayName(encounter.doctor)}
                            </strong>
                          </div>

                          <div>
                            Огноо:{" "}
                            <strong>
                              {formatShortDate(encounter.visitDate)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => void saveCurrentConsent()}
                      disabled={consentSaving}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #16a34a",
                        background: "#ecfdf3",
                        color: "#166534",
                        fontSize: 12,
                        cursor: consentSaving ? "default" : "pointer",
                      }}
                    >
                      {consentSaving
                        ? "Хадгалж байна..."
                        : "Зөвшөөрөл хадгалах"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void saveCurrentConsent()}
                      disabled={consentSaving}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #2563eb",
                        background: "#eff6ff",
                        color: "#2563eb",
                        fontSize: 12,
                        cursor: consentSaving ? "default" : "pointer",
                      }}
                    >
                      {consentSaving
                        ? "Илгээж байна..."
                        : "Зөвшөөрөл илгээх / засах"}
                    </button>
                  </div>

                  {/* Shared signature section for all consent types */}
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 12,
                      borderTop: "1px dashed #e5e7eb",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 8,
                      }}
                    >
                      Гарын үсэг (бүх зөвшөөрлийн маягтад хамаарна)
                    </h3>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        marginBottom: 12,
                      }}
                    >
                      Энэ гарын үсэг нь 4 төрлийн зөвшөөрлийн маягтад хамтдаа хэрэглэгдэнэ.
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                        padding: 12,
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        background: "#fafafa",
                      }}
                    >
                      {/* Patient signature */}
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 8,
                          }}
                        >
                          Өвчтөн/асран хамгаалагчийн гарын үсэг
                        </div>
                        {encounter.patientSignaturePath ? (
                          <div>
                            <img
                              src={encounter.patientSignaturePath}
                              alt="Patient signature"
                              style={{
                                maxWidth: "100%",
                                height: "auto",
                                border: "1px solid #d1d5db",
                                borderRadius: 6,
                                background: "#ffffff",
                              }}
                            />
                            {encounter.patientSignedAt && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#6b7280",
                                  marginTop: 4,
                                }}
                              >
                                Гарын үсэг зурсан:{" "}
                                {formatDateTime(encounter.patientSignedAt)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <SignaturePad
                              disabled={uploadingPatientSignature}
                              onChange={(blob) =>
                                void handlePatientSignatureUpload(blob)
                              }
                            />
                            {uploadingPatientSignature && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#6b7280",
                                  marginTop: 4,
                                }}
                              >
                                Хадгалж байна...
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Doctor signature */}
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 8,
                          }}
                        >
                          Эмчийн гарын үсэг
                        </div>
                        {encounter.doctorSignaturePath ? (
                          <div>
                            <img
                              src={encounter.doctorSignaturePath}
                              alt="Doctor signature"
                              style={{
                                maxWidth: "100%",
                                height: "auto",
                                border: "1px solid #d1d5db",
                                borderRadius: 6,
                                background: "#ffffff",
                              }}
                            />
                            {encounter.doctorSignedAt && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#6b7280",
                                  marginTop: 4,
                                }}
                              >
                                Холбосон:{" "}
                                {formatDateTime(encounter.doctorSignedAt)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div style={{ marginBottom: 8 }}>
                              <SignaturePad
                                disabled={uploadingDoctorSignature}
                                onChange={(blob) =>
                                  void handleDoctorSignatureUpload(blob)
                                }
                              />
                              {uploadingDoctorSignature && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "#6b7280",
                                    marginTop: 4,
                                  }}
                                >
                                  Хадгалж байна...
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 11,
                                color: "#6b7280",
                              }}
                            >
                              <span>эсвэл</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleAttachDoctorSignature()}
                              disabled={
                                attachingDoctorSignature ||
                                !encounter.doctor?.signatureImagePath
                              }
                              style={{
                                marginTop: 8,
                                padding: "8px 16px",
                                borderRadius: 6,
                                border: "1px solid #2563eb",
                                background: "#eff6ff",
                                color: "#2563eb",
                                fontSize: 12,
                                cursor:
                                  attachingDoctorSignature ||
                                  !encounter.doctor?.signatureImagePath
                                    ? "not-allowed"
                                    : "pointer",
                                opacity:
                                  attachingDoctorSignature ||
                                  !encounter.doctor?.signatureImagePath
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {attachingDoctorSignature
                                ? "Холбож байна..."
                                : "Эмчийн гарын үсэг холбох"}
                            </button>
                            {!encounter.doctor?.signatureImagePath && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#b91c1c",
                                  marginTop: 4,
                                }}
                              >
                                Эмчийн профайлд гарын үсэг байхгүй байна
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {encounter.notes && (
                <div style={{ marginTop: 4 }}>
                  <strong>Тэмдэглэл:</strong> {encounter.notes}
                </div>
              )}

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
              onToggleScheduler={(checked) => {
                setShowFollowUpScheduler(checked);
                if (!checked) {
                  setFollowUpError("");
                  setFollowUpSuccess("");
                  setFollowUpAvailability(null);
                }
              }}
              onDateFromChange={setFollowUpDateFrom}
              onDateToChange={setFollowUpDateTo}
              onSlotMinutesChange={setFollowUpSlotMinutes}
              onBookAppointment={createFollowUpAppointment}
            />
            </div>
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

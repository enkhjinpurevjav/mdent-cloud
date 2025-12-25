import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

type Branch = {
  id: number;
  name: string;
};

type Patient = {
  id: number;
  ovog?: string | null;
  name: string;
  regNo?: string | null;
  phone?: string | null;
  branch?: Branch | null;
};

type PatientBook = {
  id: number;
  bookNumber: string;
  patient: Patient;
};

type Doctor = {
  id: number;
  name?: string | null;
  ovog?: string | null;
  email: string;
};

type Nurse = {
  id: number;
  name?: string | null;
  ovog?: string | null;
  email: string;
};

type Diagnosis = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
};

type DiagnosisProblem = {
  id: number;
  diagnosisId: number;
  label: string;
  order: number;
  active: boolean;
};

type EncounterDiagnosisRow = {
  id: number;
  diagnosisId: number;
  selectedProblemIds: number[] | null;
  note?: string | null;
  diagnosis: Diagnosis;
  toothCode?: string | null;
};

type ServiceCategory =
  | "GENERAL_DENTISTRY"
  | "IMPLANTS"
  | "ORTHODONTICS"
  | "COSMETIC_DENTISTRY"
  | "CHILDRENS";

type ServiceBranch = {
  branchId: number;
  branch: Branch;
};

type Service = {
  id: number;
  code?: string | null;
  category: ServiceCategory;
  name: string;
  price: number;
  isActive: boolean;
  description?: string | null;
  serviceBranches?: ServiceBranch[];
};

type EncounterService = {
  id: number;
  encounterId: number;
  serviceId: number;
  quantity: number;
  price: number;
  service: Service;
};

type PrescriptionItem = {
  id: number;
  order: number;
  drugName: string;
  durationDays: number;
  quantityPerTake: number;
  frequencyPerDay: number;
  note?: string | null;
};

type Prescription = {
  id: number;
  encounterId: number;
  items: PrescriptionItem[];
};

type Encounter = {
  id: number;
  patientBookId: number;
  doctorId: number;
  visitDate: string;
  notes?: string | null;
  patientBook: PatientBook;
  doctor: Doctor | null;
  nurse?: Nurse | null;                      // <--- NEW
  encounterDiagnoses: EncounterDiagnosisRow[];
  encounterServices: EncounterService[];
  prescription?: Prescription | null;
};

type EditableDiagnosis = {
  diagnosisId: number;
  diagnosis?: Diagnosis;
  selectedProblemIds: number[];
  note: string;
  toothCode?: string;
  serviceId?: number;
  searchText?: string;
  serviceSearchText?: string;
};

type EditablePrescriptionItem = {
  id?: number;
  drugName: string;
  durationDays: number | null;
  quantityPerTake: number | null;
  frequencyPerDay: number | null;
  note: string;
};

type ChartToothRow = {
  id?: number;
  toothCode: string;
  toothGroup?: string | null;  // <--- NEW
  status?: string | null;
  notes?: string | null;
  // chartNotes?: ChartNote[];
};

// --- Media / X-ray types ---

type EncounterMediaType = "XRAY" | "PHOTO" | "DOCUMENT";

type ConsentType = "root_canal" | "surgery" | "orthodontic" | "prosthodontic";

type SurgeryConsentAnswers = {
  surgeryMode?: "SURGERY" | "PROCEDURE"; // Мэс засал vs Мэс ажилбар

  // Shared A) informational fields
  name?: string;
  outcome?: string;
  risks?: string;
  complications?: string;
  additionalProcedures?: string;
  alternativeTreatments?: string;
  advantages?: string;

  // Anesthesia options
  anesthesiaGeneral?: boolean;
  anesthesiaSpinal?: boolean;
  anesthesiaLocal?: boolean;
  anesthesiaSedation?: boolean;

  patientQuestions?: string;
  questionSummary?: string;
  doctorPhone?: string;

  // Doctor confirmation
  doctorExplained?: boolean;

  // B) patient consent
  patientConsentMain?: boolean;
  patientConsentInfo?: boolean;

  patientSignatureName?: string;

  guardianName?: string;
  guardianRelationDescription?: string;

  incapacityReason?: {
    minor?: boolean;
    unconscious?: boolean;
    mentalDisorder?: boolean;
    other?: boolean;
    otherText?: string;
  };

  husbandConsent?: boolean;
  husbandName?: string;
  husbandRefuseReason?: string;
};


type EncounterConsent = {
  encounterId: number;
  type: ConsentType;
  answers: any;
  patientSignedAt?: string | null;
  doctorSignedAt?: string | null;
  patientSignaturePath?: string | null;
  doctorSignaturePath?: string | null;
};

type EncounterMedia = {
  id: number;
  encounterId: number;
  filePath: string; // e.g. "/media/filename.jpg"
  toothCode?: string | null;
  type: EncounterMediaType;
  createdAt?: string;
};

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("mn-MN");
  } catch {
    return iso;
  }
}

function formatPatientName(p: Patient) {
  const ovog = p.ovog ? p.ovog.trim() : "";
  const name = p.name ? p.name.toString().trim() : "";
  if (!ovog) return name || p.regNo || String(p.id);
  const initial = ovog.charAt(0);
  return `${initial}. ${name}`;
}

function formatDoctorName(d: Doctor | null) {
  if (!d) return "-";
  if (d.name && d.name.trim()) return d.name;
  return d.email;
}

function formatStaffName(u: { name?: string | null; ovog?: string | null; email: string } | null | undefined) {
  if (!u) return "-";
  if (u.name && u.name.trim()) {
    const ovogInitial = u.ovog && u.ovog.trim() ? `${u.ovog.trim().charAt(0)}. ` : "";
    return `${ovogInitial}${u.name.trim()}`;
  }
  return u.email;
}

function formatDoctorDisplayName(d: Doctor | null) {
  if (!d) return "";
  if (d.name && d.name.trim()) {
    const ovogInitial = d.ovog && d.ovog.trim() ? `${d.ovog.trim().charAt(0)}. ` : "";
    return `${ovogInitial}${d.name.trim()}`;
  }
  return d.email;
}

function formatShortDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
  } catch {
    return iso;
  }
}

function stringifyToothList(list: string[]): string {
  return Array.from(new Set(list))
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}

export default function EncounterAdminPage() {
  const router = useRouter();
  const { id } = router.query;
  const encounterId = useMemo(
    () => (typeof id === "string" ? Number(id) : NaN),
    [id]
  );

  const [finishing, setFinishing] = useState(false);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [encounterLoading, setEncounterLoading] = useState(false);
  const [encounterError, setEncounterError] = useState("");

  // Diagnoses
  const [allDiagnoses, setAllDiagnoses] = useState<Diagnosis[]>([]);
  const [dxLoading, setDxLoading] = useState(false);
  const [dxError, setDxError] = useState("");
  const [problemsByDiagnosis, setProblemsByDiagnosis] = useState<
    Record<number, DiagnosisProblem[]>
  >({});
  const [rows, setRows] = useState<EditableDiagnosis[]>([]);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openDxIndex, setOpenDxIndex] = useState<number | null>(null);

  // Services
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [servicesLoadError, setServicesLoadError] = useState("");
  const [openServiceIndex, setOpenServiceIndex] = useState<number | null>(null);
 // Nurse selection
  const [allNurses, setAllNurses] = useState<Nurse[]>([]);
  const [nurseSaving, setNurseSaving] = useState(false);
  // Tooth chart selection
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [chartError, setChartError] = useState("");
  const [toothMode, setToothMode] = useState<"ADULT" | "CHILD">("ADULT");
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  // Prescription
  const [prescriptionItems, setPrescriptionItems] = useState<
    EditablePrescriptionItem[]
  >([]);
  const [prescriptionSaving, setPrescriptionSaving] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState("");

  // Media (X-rays / photos)
  const [media, setMedia] = useState<EncounterMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

    // Consent form (Step 1: type only)
  const [consent, setConsent] = useState<EncounterConsent | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState("");

  // --- Load master services ---
  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await fetch("/api/services?onlyActive=true");
        const data = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(data)) {
          throw new Error(data?.error || "Алдаа гарлаа");
        }
        setAllServices(data);
      } catch (err: any) {
        console.error("Failed to load services:", err);
        setServicesLoadError(
          err.message || "Үйлчилгээний жагсаалт ачаалахад алдаа гарлаа."
        );
      }
    };
    loadServices();
  }, []);


      // --- Load nurses scheduled for this encounter's date/branch ---
  useEffect(() => {
    if (!encounterId || Number.isNaN(encounterId)) return;

    const loadNursesForEncounter = async () => {
      try {
        const res = await fetch(`/api/encounters/${encounterId}/nurses`);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !Array.isArray(data.items)) {
          return;
        }
        // Map API response items to Nurse[]
        setAllNurses(
          data.items.map((it: any) => ({
            id: it.nurseId,
            name: it.name,
            ovog: it.ovog,
            email: it.email,
          })) as Nurse[]
        );
      } catch {
        // optional: log error; field is optional
      }
    };

    loadNursesForEncounter();
  }, [encounterId]);
  // --- Load encounter (diagnoses + services + prescription) ---
  useEffect(() => {
    if (!encounterId || Number.isNaN(encounterId)) return;

    const load = async () => {
      setEncounterLoading(true);
      setEncounterError("");
      try {
        const res = await fetch(`/api/encounters/${encounterId}`);
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || !data || !data.id) {
          throw new Error((data && data.error) || "Алдаа гарлаа");
        }

        setEncounter(data);

        const initialRows: EditableDiagnosis[] =
          Array.isArray(data.encounterDiagnoses) &&
          data.encounterDiagnoses.length > 0
            ? data.encounterDiagnoses.map((r: EncounterDiagnosisRow) => ({
                diagnosisId: r.diagnosisId,
                diagnosis: r.diagnosis,
                selectedProblemIds: Array.isArray(r.selectedProblemIds)
                  ? (r.selectedProblemIds as number[])
                  : [],
                note: r.note || "",
                toothCode: r.toothCode || "",
                serviceId: undefined,
                searchText: r.diagnosis
                  ? `${r.diagnosis.code} – ${r.diagnosis.name}`
                  : "",
                serviceSearchText: "",
              }))
            : [];

        if (
          Array.isArray(data.encounterServices) &&
          data.encounterServices.length > 0 &&
          initialRows.length > 0
        ) {
          const services = data.encounterServices as EncounterService[];
          for (let i = 0; i < initialRows.length && i < services.length; i++) {
            const svc = services[i];
            initialRows[i].serviceId = svc.serviceId;
            initialRows[i].serviceSearchText = svc.service?.name || "";
          }
        }

        setRows(initialRows);

        // Prescription hydrate
        if (data.prescription && Array.isArray(data.prescription.items)) {
          setPrescriptionItems(
            data.prescription.items
              .sort((a: any, b: any) => a.order - b.order)
              .map((it: any) => ({
                id: it.id,
                drugName: it.drugName || "",
                durationDays: it.durationDays ?? null,
                quantityPerTake: it.quantityPerTake ?? null,
                frequencyPerDay: it.frequencyPerDay ?? null,
                note: it.note || "",
              }))
          );
        } else {
          setPrescriptionItems([]);
        }
      } catch (err: any) {
        console.error("Failed to load encounter:", err);
        setEncounterError(err.message || "Алдаа гарлаа");
        setEncounter(null);
      } finally {
        setEncounterLoading(false);
      }
    };

    load();
  }, [encounterId]);

  // --- Load all diagnoses ---
  useEffect(() => {
    const loadDx = async () => {
      setDxLoading(true);
      setDxError("");
      try {
        const res = await fetch("/api/diagnoses");
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        if (!res.ok || !Array.isArray(data)) {
          throw new Error((data && data.error) || "Алдаа гарлаа");
        }
        setAllDiagnoses(data);
      } catch (err: any) {
        console.error("Failed to load diagnoses:", err);
        setDxError(err.message || "Алдаа гарлаа");
        setAllDiagnoses([]);
      } finally {
        setDxLoading(false);
      }
    };

    loadDx();
  }, []);

  // --- Helper: reload media list from backend ---
  const reloadMedia = async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setMediaLoading(true);
    setMediaError("");
    try {
      const res = await fetch(
        `/api/encounters/${encounterId}/media?type=XRAY`
      );
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !Array.isArray(data)) {
        throw new Error((data && data.error) || "Медиа ачаалахад алдаа гарлаа");
      }

      setMedia(data as EncounterMedia[]);
    } catch (err: any) {
      console.error("Failed to load media:", err);
      setMediaError(
        err.message || "Медиа (рентген зураг) ачаалахад алдаа гарлаа."
      );
      setMedia([]);
    } finally {
      setMediaLoading(false);
    }
  };

  // --- Load consent for this encounter (if any) ---
  useEffect(() => {
    if (!encounterId || Number.isNaN(encounterId)) return;

    const loadConsent = async () => {
      setConsentLoading(true);
      setConsentError("");
      try {
        const res = await fetch(`/api/encounters/${encounterId}/consent`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Зөвшөөрлийн хуудас ачаалахад алдаа гарлаа.");
        }
        if (data) {
          setConsent(data as EncounterConsent);
        } else {
          setConsent(null);
        }
      } catch (err: any) {
        console.error("Failed to load consent:", err);
        setConsentError(
          err.message || "Зөвшөөрлийн хуудас ачаалахад алдаа гарлаа."
        );
        setConsent(null);
      } finally {
        setConsentLoading(false);
      }
    };

    void loadConsent();
  }, [encounterId]);

  
  // --- Load media on first render / when encounterId changes ---
  useEffect(() => {
    void reloadMedia();
  }, [encounterId]);

  // --- Diagnoses helpers ---

  const ensureProblemsLoaded = async (diagnosisId: number) => {
    if (problemsByDiagnosis[diagnosisId]) return;
    try {
      const res = await fetch(`/api/diagnoses/${diagnosisId}/problems`);
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || !Array.isArray(data)) {
        throw new Error((data && data.error) || "Алдаа гарлаа");
      }
      setProblemsByDiagnosis((prev) => ({
        ...prev,
        [diagnosisId]: data,
      }));
    } catch (err) {
      console.error("Failed to load problems:", err);
    }
  };

  const createDiagnosisRow = (initialTeeth: string[]): number => {
    const index = rows.length;
    const toothCode = stringifyToothList(initialTeeth);
    const newRow: EditableDiagnosis = {
      diagnosisId: 0,
      diagnosis: undefined,
      selectedProblemIds: [],
      note: "",
      toothCode,
      serviceId: undefined,
      searchText: "",
      serviceSearchText: "",
    };
    setRows((prev) => [...prev, newRow]);
    return index;
  };

  const removeDiagnosisRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setOpenDxIndex((prev) => (prev === index ? null : prev));
    setActiveRowIndex((prev) => {
      if (prev === null) return prev;
      if (prev === index) return null;
      if (index < prev) return prev - 1;
      return prev;
    });
  };

  const saveConsent = async (type: ConsentType | null) => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setConsentSaving(true);
    setConsentError("");
    try {
      const res = await fetch(`/api/encounters/${encounterId}/consent`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          answers: consent?.answers ?? {}, // for now, keep existing answers or empty
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Зөвшөөрлийн хуудас хадгалахад алдаа гарлаа.");
      }
      setConsent(data || null);
    } catch (err: any) {
      console.error("Failed to save consent:", err);
      setConsentError(
        err.message || "Зөвшөөрлийн хуудас хадгалахад алдаа гарлаа."
      );
    } finally {
      setConsentSaving(false);
    }
  };

  const updateConsentAnswers = (partial: any) => {
    setConsent((prev) =>
      prev
        ? {
            ...prev,
            answers: {
              ...(prev.answers || {}),
              ...partial,
            },
          }
        : prev
    );
  };
  
  const handleDiagnosisChange = async (index: number, diagnosisId: number) => {
    const dx = allDiagnoses.find((d) => d.id === diagnosisId);
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              diagnosisId,
              diagnosis: dx,
              selectedProblemIds: [],
              searchText: dx ? `${dx.code} – ${dx.name}` : "",
            }
          : row
      )
    );
    if (diagnosisId) {
      await ensureProblemsLoaded(diagnosisId);
    }
  };

  const toggleProblem = (index: number, problemId: number) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const exists = row.selectedProblemIds.includes(problemId);
        return {
          ...row,
          selectedProblemIds: exists
            ? row.selectedProblemIds.filter((id) => id !== problemId)
            : [...row.selectedProblemIds, problemId],
        };
      })
    );
  };

  const handleNoteChange = (index: number, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, note: value } : row))
    );
  };

  const handleDxToothCodeChange = (index: number, value: string) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, toothCode: value } : row
      )
    );
  };

  const handleSaveDiagnoses = async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setSaveError("");
    setSaving(true);
    try {
      const payload = {
        items: rows
          .filter((r) => r.diagnosisId)
          .map((r) => ({
            diagnosisId: r.diagnosisId,
            selectedProblemIds: r.selectedProblemIds,
            note: r.note || null,
            toothCode:
              r.toothCode && r.toothCode.trim()
                ? r.toothCode.trim()
                : null,
          })),
      };

      const res = await fetch(`/api/encounters/${encounterId}/diagnoses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Хадгалах үед алдаа гарлаа");
      }

      if (Array.isArray(data)) {
        setRows((prevRows) =>
          data.map((r: any) => {
            const match = prevRows.find(
              (x) =>
                x.diagnosisId === r.diagnosisId &&
                (x.toothCode || "") === (r.toothCode || "")
            );
            const matchedService =
              match?.serviceId &&
              allServices.find((s) => s.id === match.serviceId);
            return {
              diagnosisId: r.diagnosisId,
              diagnosis: r.diagnosis,
              selectedProblemIds: Array.isArray(r.selectedProblemIds)
                ? (r.selectedProblemIds as number[])
                : [],
              note: r.note || "",
              toothCode: r.toothCode || "",
              serviceId: match?.serviceId,
              searchText: r.diagnosis
                ? `${r.diagnosis.code} – ${r.diagnosis.name}`
                : "",
              serviceSearchText: matchedService?.name || "",
            } as EditableDiagnosis;
          })
        );
      }

      setSelectedTeeth([]);
      setActiveRowIndex(null);
    } catch (err: any) {
      console.error("Failed to save diagnoses:", err);
      setSaveError(err.message || "Хадгалах үед алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  // --- Save services ---

  const handleSaveServices = async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;

    const items = rows
      .filter((r) => r.serviceId)
      .map((r) => ({
        serviceId: r.serviceId as number,
        quantity: 1,
      }));

    try {
      const res = await fetch(`/api/encounters/${encounterId}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error || "Үйлчилгээ хадгалахад алдаа гарлаа."
        );
      }

      if (Array.isArray(data)) {
        setEncounter((prev) =>
          prev
            ? {
                ...prev,
                encounterServices: data,
              }
            : prev
        );
      }
    } catch (err: any) {
      console.error("Failed to save services:", err);
      setSaveError(
        err.message || "Үйлчилгээ хадгалахад алдаа гарлаа."
      );
    }
  };


    const handleChangeNurse = async (nurseIdStr: string) => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setNurseSaving(true);
    try {
      const nurseId = nurseIdStr ? Number(nurseIdStr) : null;

      const res = await fetch(`/api/encounters/${encounterId}/nurse`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurseId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Сувилагч хадгалахад алдаа гарлаа.");
      }

      setEncounter((prev) =>
        prev
          ? {
              ...prev,
              nurse: data?.nurse ?? null,
            }
          : prev
      );
    } catch (err) {
      console.error("Failed to save nurse:", err);
      // optional: set a local error message
    } finally {
      setNurseSaving(false);
    }
  };
  
  // --- Prescription save ---

  const savePrescription = async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setPrescriptionError("");
    setPrescriptionSaving(true);

    try {
      const filtered = prescriptionItems
        .map((it) => ({
          ...it,
          drugName: it.drugName.trim(),
        }))
        .filter((it) => it.drugName.length > 0)
        .slice(0, 3);

      const payload =
        filtered.length === 0
          ? { items: [] }
          : {
              items: filtered.map((it) => ({
                drugName: it.drugName,
                durationDays:
                  it.durationDays && it.durationDays > 0
                    ? it.durationDays
                    : 1,
                quantityPerTake:
                  it.quantityPerTake && it.quantityPerTake > 0
                    ? it.quantityPerTake
                    : 1,
                frequencyPerDay:
                  it.frequencyPerDay && it.frequencyPerDay > 0
                    ? it.frequencyPerDay
                    : 1,
                note: it.note?.trim() || null,
              })),
            };

      const res = await fetch(
        `/api/encounters/${encounterId}/prescription`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error || "Жор хадгалахад алдаа гарлаа."
        );
      }

      if (data && data.prescription && Array.isArray(data.prescription.items)) {
        setPrescriptionItems(
          data.prescription.items
            .sort((a: any, b: any) => a.order - b.order)
            .map((it: any) => ({
              id: it.id,
              drugName: it.drugName || "",
              durationDays: it.durationDays ?? null,
              quantityPerTake: it.quantityPerTake ?? null,
              frequencyPerDay: it.frequencyPerDay ?? null,
              note: it.note || "",
            }))
        );
      } else {
        setPrescriptionItems([]);
      }
    } catch (err: any) {
      console.error("save prescription failed", err);
      setPrescriptionError(
        err.message || "Жор хадгалахад алдаа гарлаа."
      );
    } finally {
      setPrescriptionSaving(false);
    }
  };

  const handleFinishEncounter = async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setFinishing(true);
    setSaveError("");
    try {
      await handleSaveDiagnoses();
      await handleSaveServices();
      await savePrescription();

      const res = await fetch(`/api/encounters/${encounterId}/finish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error || "Үзлэг дууссан төлөвт шилжүүлэхэд алдаа гарлаа."
        );
      }
    } catch (err: any) {
      console.error("Failed to finish encounter:", err);
      setSaveError(
        err.message || "Үзлэг дууссан төлөвт шилжүүлэхэд алдаа гарлаа."
      );
    } finally {
      setFinishing(false);
    }
  };

  // --- Media upload handler ---

  const handleMediaUpload = async (file: File) => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setUploadingMedia(true);
    setMediaError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      // Use currently selected teeth as toothCode (optional)
      formData.append("toothCode", selectedTeeth.join(",") || "");
      formData.append("type", "XRAY");

      const res = await fetch(`/api/encounters/${encounterId}/media`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Зураг хадгалахад алдаа гарлаа.");
      }

      // Backend returns created media row; append and/or refresh
      if (data && data.id) {
        setMedia((prev) => [data as EncounterMedia, ...prev]);
      } else {
        await reloadMedia();
      }
    } catch (err: any) {
      console.error("Media upload failed:", err);
      setMediaError(err.message || "Зураг хадгалахад алдаа гарлаа.");
    } finally {
      setUploadingMedia(false);
    }
  };

  // Tooth helpers

  const ADULT_TEETH: string[] = [
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "31",
    "32",
    "33",
    "34",
    "35",
    "36",
    "37",
    "38",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
  ];

  const CHILD_TEETH: string[] = [
    "51",
    "52",
    "53",
    "54",
    "55",
    "61",
    "62",
    "63",
    "64",
    "65",
    "71",
    "72",
    "73",
    "74",
    "75",
    "81",
    "82",
    "83",
    "84",
    "85",
  ];

  const toggleToothMode = (mode: "ADULT" | "CHILD") => {
    setToothMode(mode);
  };

  const isToothSelected = (code: string) => selectedTeeth.includes(code);

  const updateActiveRowToothList = (nextTeeth: string[]) => {
    if (activeRowIndex === null) {
      if (nextTeeth.length === 0) return;
      const idx = createDiagnosisRow(nextTeeth);
      setActiveRowIndex(idx);
      return;
    }

    setRows((prev) =>
      prev.map((row, i) =>
        i === activeRowIndex
          ? { ...row, toothCode: stringifyToothList(nextTeeth) }
          : row
      )
    );

    if (nextTeeth.length === 0) {
      setRows((prev) => {
        const row = prev[activeRowIndex!];
        const isEmpty =
          row.diagnosisId === 0 &&
          (row.note || "").trim() === "" &&
          (row.selectedProblemIds?.length ?? 0) === 0 &&
          !row.serviceId;
        if (!isEmpty) {
          return prev.map((r, i) =>
            i === activeRowIndex ? { ...r, toothCode: "" } : r
          );
        }
        return prev.filter((_, i) => i !== activeRowIndex);
      });
      setActiveRowIndex(null);
    }
  };


  const setCustomToothRange = (value: string) => {
  const trimmed = value.trim();

  if (activeRowIndex !== null) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === activeRowIndex ? { ...row, toothCode: trimmed } : row
      )
    );
    return;
  }

  // If no active row yet, create one and set its toothCode
  const idx = createDiagnosisRow([]);
  setActiveRowIndex(idx);
  setRows((prev) =>
    prev.map((row, i) =>
      i === idx ? { ...row, toothCode: trimmed } : row
    )
  );
};

  
  const toggleToothSelection = (code: string) => {
    setSelectedTeeth((prev) => {
      let next: string[];
      if (prev.includes(code)) {
        next = prev.filter((c) => c !== code);
      } else {
        next = [...prev, code];
      }
      updateActiveRowToothList(next);
      return next;
    });
  };

  const totalDiagnosisServicesPrice = rows.reduce((sum, r) => {
    if (!r.serviceId) return sum;
    const svc = allServices.find((x) => x.id === r.serviceId);
    const price = svc?.price ?? 0;
    return sum + price;
  }, 0);

  if (!encounterId || Number.isNaN(encounterId)) {
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
        Үзлэгийн дэлгэрэнгүй (ID: {encounterId})
      </h1>

      {encounterLoading && <div>Ачаалж байна...</div>}
      {!encounterLoading && encounterError && (
        <div style={{ color: "red", marginBottom: 12 }}>
          {encounterError}
        </div>
      )}

      {encounter && (
        <>
          {/* Encounter header */}
          <section
            style={{
              marginBottom: 16,
              padding: 16,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <div style={{ marginBottom: 4 }}>
              <strong>Үйлчлүүлэгч:</strong>{" "}
              {formatPatientName(encounter.patientBook.patient)} (Карт:{" "}
              {encounter.patientBook.bookNumber})
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Салбар:</strong>{" "}
              {encounter.patientBook.patient.branch
                ? encounter.patientBook.patient.branch.name
                : "-"}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Эмч:</strong> {formatDoctorName(encounter.doctor)}
            </div>
                        <div style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <strong>Сувилагч:</strong>
              {allNurses.length === 0 ? (
                <span style={{ fontSize: 13, color: "#6b7280" }}>
                  (Сувилагч бүртгээгүй эсвэл ачаалаагүй байна)
                </span>
              ) : (
                <select
                  value={encounter.nurse?.id ?? ""}
                  onChange={(e) => void handleChangeNurse(e.target.value)}
                  disabled={nurseSaving}
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 8px",
                    fontSize: 13,
                  }}
                >
                  <option value="">— Сонгоогүй —</option>
                  {allNurses.map((n) => (
                    <option key={n.id} value={n.id}>
                      {formatStaffName(n)}
                    </option>
                  ))}
                </select>
              )}
            </div>
                        <div style={{ marginBottom: 4 }}>
              <strong>Огноо:</strong> {formatDateTime(encounter.visitDate)}
            </div>

            {/* Consent form (step 1: enable + choose type) */}
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
                    checked={!!consent}
                    disabled={consentLoading || consentSaving}
                    onChange={async (e) => {
                      if (e.target.checked) {
                        // default type when enabling for the first time
                        await saveConsent(consent?.type || "root_canal");
                      } else {
                        await saveConsent(null);
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
              </div>

                            {consent && (
                <>
                  {/* Type selection */}
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
                        checked={consent.type === "root_canal"}
                        disabled={consentSaving}
                        onChange={() => void saveConsent("root_canal")}
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
                        checked={consent.type === "surgery"}
                        disabled={consentSaving}
                        onChange={() => void saveConsent("surgery")}
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
                        checked={consent.type === "orthodontic"}
                        disabled={consentSaving}
                        onChange={() => void saveConsent("orthodontic")}
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
                        checked={consent.type === "prosthodontic"}
                        disabled={consentSaving}
                        onChange={() => void saveConsent("prosthodontic")}
                      />
                      Согог засал
                    </label>
                  </div>

                  {/* Per-type fields */}
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
                                        {/* 1. Сувгийн эмчилгээ */}
                    {consent.type === "root_canal" && (
                      <div>
                        {/* Title */}
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

                        {/* Main explanatory text */}
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

                        {/* Acknowledgement */}
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
                            checked={!!consent.answers?.acknowledged}
                            onChange={async (e) => {
                              updateConsentAnswers({
                                acknowledged: e.target.checked,
                              });
                              await saveConsent(consent.type);
                            }}
                          />
                          <span>
                            Өвчтөн / асран хамгаалагч танилцуулгыг бүрэн уншиж,
                            ойлгож зөвшөөрсөн.
                          </span>
                        </label>

                        {/* Bottom: patient + doctor + date */}
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
                                value={consent.answers?.patientName || ""}
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    patientName: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsent(consent.type);
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
                                  {formatDoctorDisplayName(encounter.doctor)}
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

                                        {/* 2. Мэс засал / Мэс ажилбар */}
                    {consent.type === "surgery" && (
                      <div>
                        {/* Internal mode: Мэс засал vs Мэс ажилбар */}
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
                          <span style={{ fontWeight: 600 }}>
                            Сонголт:
                          </span>
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
                                consent.answers?.surgeryMode !==
                                  "PROCEDURE" /* default = Мэс засал */
                              }
                              onChange={async () => {
                                updateConsentAnswers({
                                  surgeryMode: "SURGERY",
                                });
                                await saveConsent(consent.type);
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
                                consent.answers?.surgeryMode ===
                                "PROCEDURE"
                              }
                              onChange={async () => {
                                updateConsentAnswers({
                                  surgeryMode: "PROCEDURE",
                                });
                                await saveConsent(consent.type);
                              }}
                            />
                            <span>Мэс ажилбар</span>
                          </label>
                        </div>

                        {/* Decide which form to render based on surgeryMode */}
                        {consent.answers?.surgeryMode === "PROCEDURE" ? (
                          // ==========================
                          // МЭС АЖИЛБАР ХИЙЛГЭХ ТУХАЙ ЗӨВШӨӨРЛИЙН ХУУДАС
                          // ==========================
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

                            {/* Name */}
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
                              value={consent.answers?.name || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  name: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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

                            {/* Outcome */}
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
                              value={consent.answers?.outcome || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  outcome: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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

                            {/* Risks */}
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
                              value={consent.answers?.risks || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  risks: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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

                            {/* Complications */}
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
                              value={consent.answers?.complications || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  complications: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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

                            {/* Additional procedures */}
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
                                consent.answers?.additionalProcedures || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  additionalProcedures: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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

                            {/* Alternatives */}
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
                                consent.answers?.alternativeTreatments || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  alternativeTreatments: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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

                            {/* Advantages */}
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
                              value={consent.answers?.advantages || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  advantages: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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

                            {/* Anesthesia checkboxes */}
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
                                  !!consent.answers?.[opt.key];
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
                                        await saveConsent(consent.type);
                                      }}
                                    />
                                    <span>{opt.label}</span>
                                  </label>
                                );
                              })}
                            </div>

                            {/* Questions */}
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
                                consent.answers?.patientQuestions || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  patientQuestions: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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
                                consent.answers?.questionSummary || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  questionSummary: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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

                            {/* Doctor phone */}
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
                              value={
                                consent.answers?.doctorPhone || ""
                              }
                              onChange={(e) =>
                                updateConsentAnswers({
                                  doctorPhone: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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

                            {/* Doctor confirmation */}
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
                                  !!consent.answers?.doctorExplained
                                }
                                onChange={async (e) => {
                                  updateConsentAnswers({
                                    doctorExplained: e.target.checked,
                                  });
                                  await saveConsent(consent.type);
                                }}
                              />
                              <span>
                                Би үйлчлүүлэгчдээ дээрх мэдээллүүдийг
                                дэлгэрэнгүй, энгийн ойлгомжтой хэллэгээр
                                тайлбарлаж өгсөн болно.
                              </span>
                            </label>

                            {/* Doctor + date from encounter */}
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

                            {/* B) Patient consent – shared with surgery form below */}
                            <div
                              style={{
                                marginTop: 8,
                                paddingTop: 6,
                                borderTop: "1px dashed #e5e7eb",
                                fontSize: 12,
                              }}
                            >
                              {/* We reuse same B) block for both forms */}
                              {/* (see shared block after the surgery form) */}
                            </div>
                          </div>
                        ) : (
                          // ==========================
                          // МЭС ЗАСАЛ ХИЙЛГЭХ ТУХАЙ ЗӨВШӨӨРЛИЙН ХУУДАС
                          // (same fields, different title wording)
                          // ==========================
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

                            {/* All same fields as procedure, just label says "мэс засал" */}
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
                              value={consent.answers?.name || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  name: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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
                              value={consent.answers?.outcome || ""}
                              onChange={(e) =>
                                updateConsentAnswers({
                                  outcome: e.target.value,
                                })
                              }
                              onBlur={async () => {
                                await saveConsent(consent.type);
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

                            {/* Reuse risks, complications, etc. exactly as above */}
                            {/* ... same blocks as in PROCEDURE branch ... */}
                            {/* For brevity in this answer, copy the same JSX
                                from the procedure branch for:
                                - risks
                                - complications
                                - additionalProcedures
                                - alternativeTreatments
                                - advantages
                                - anesthesia checkboxes
                                - patientQuestions
                                - questionSummary
                                - doctorPhone
                                - doctorExplained
                                - doctor name + date
                              */}
                            {/* You can literally duplicate the JSX from the procedure section here. */}
                          </div>
                        )}

                        {/* Shared B) Үйлчлүүлэгчийн зөвшөөрөл – used for both surgery modes */}
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
                                !!consent.answers?.patientConsentMain
                              }
                              onChange={async (e) => {
                                updateConsentAnswers({
                                  patientConsentMain: e.target.checked,
                                });
                                await saveConsent(consent.type);
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
                                !!consent.answers?.patientConsentInfo
                              }
                              onChange={async (e) => {
                                updateConsentAnswers({
                                  patientConsentInfo: e.target.checked,
                                });
                                await saveConsent(consent.type);
                              }}
                              style={{ marginRight: 6 }}
                            />
                            Мэс засал / мэс ажилбарын үр дүн, гарч болох
                            хүндрэл, эрсдэл, нэмэлт ажилбарууд, орлуулж
                            болох эмчилгээний талаар БИ тодорхой мэдээлэл
                            авсан болно.
                          </label>

                          {/* Patient / guardian fields */}
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
                                  consent.answers
                                    ?.patientSignatureName || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    patientSignatureName:
                                      e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsent(consent.type);
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
                                  consent.answers?.guardianName || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    guardianName: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsent(consent.type);
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
                                  consent.answers
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
                                  await saveConsent(consent.type);
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

                            {/* Incapacity reason checkboxes */}
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
                                  !!consent.answers?.incapacityReason?.[
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
                                          consent.answers
                                            ?.incapacityReason || {};
                                        updateConsentAnswers({
                                          incapacityReason: {
                                            ...prev,
                                            [key]: e.target.checked,
                                          },
                                        });
                                      }}
                                      onBlur={async () => {
                                        await saveConsent(consent.type);
                                      }}
                                    />
                                    <span>{labels[key]}</span>
                                  </label>
                                );
                              })}

                              <textarea
                                placeholder="Бусад шалтгааны тайлбар"
                                value={
                                  consent.answers?.incapacityReason
                                    ?.otherText || ""
                                }
                                onChange={(e) => {
                                  const prev =
                                    consent.answers?.incapacityReason ||
                                    {};
                                  updateConsentAnswers({
                                    incapacityReason: {
                                      ...prev,
                                      otherText: e.target.value,
                                    },
                                  });
                                }}
                                onBlur={async () => {
                                  await saveConsent(consent.type);
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

                            {/* Pregnant: husband consent */}
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
                                    !!consent.answers?.husbandConsent
                                  }
                                  onChange={async (e) => {
                                    updateConsentAnswers({
                                      husbandConsent: e.target.checked,
                                    });
                                    await saveConsent(consent.type);
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
                                  consent.answers?.husbandName || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    husbandName: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsent(consent.type);
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

                              <textarea
                                placeholder="Хэрэв нөхөр / асран хамгаалагч / харгалзан дэмжигч нь зөвшөөрөөгүй бол тайлбарлана уу."
                                value={
                                  consent.answers
                                    ?.husbandRefuseReason || ""
                                }
                                onChange={(e) =>
                                  updateConsentAnswers({
                                    husbandRefuseReason: e.target.value,
                                  })
                                }
                                onBlur={async () => {
                                  await saveConsent(consent.type);
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

                            {/* Date from encounter */}
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

                                        {/* 3. Гажиг засал */}
                    {consent.type === "orthodontic" && (
                      <>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>
                          Гажиг заслын эмчилгээний танилцуулга
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            marginBottom: 6,
                          }}
                        >
                          Гажиг заслын эмчилгээний зорилго, боломжит эрсдэл,
                          эмчилгээний хугацаа, нэмэлт шинжилгээ, рентген зураг
                          авах, төлбөр тооцооны талаар эмч танилцуулсныг
                          баталгаажуулах хэсэг.
                        </div>

                        {/* 3.1 Гол эрсдэл, хүндрэлүүд */}
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 2,
                          }}
                        >
                          Гол эрсдэл, хүндрэлүүд
                        </label>
                        <textarea
                          placeholder="Ж: Шүдний цоорол, буйлны үрэвсэл сэдрэх, яс сорвижих, эмчилгээ сунжрах, брекет хугарах, аппаратыг тогтмол зүүхгүй үед гарах хүндрэлүүд гэх мэт."
                          value={consent.answers?.mainRisks || ""}
                          onChange={(e) =>
                            updateConsentAnswers({ mainRisks: e.target.value })
                          }
                          onBlur={async () => {
                            await saveConsent(consent.type);
                          }}
                          rows={4}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 6px",
                            marginBottom: 6,
                            fontSize: 12,
                          }}
                        />

                        {/* 3.2 Үргэлжлэх хугацаа */}
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 2,
                          }}
                        >
                          Төлөвлөсөн эмчилгээний үргэлжлэх хугацаа
                        </label>
                        <input
                          type="text"
                          placeholder="Ж: 18–24 сар, сард 1 удаа хяналт"
                          value={consent.answers?.expectedDuration || ""}
                          onChange={(e) =>
                            updateConsentAnswers({
                              expectedDuration: e.target.value,
                            })
                          }
                          onBlur={async () => {
                            await saveConsent(consent.type);
                          }}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 6px",
                            marginBottom: 6,
                            fontSize: 12,
                          }}
                        />

                        {/* 3.3 Үйлчлүүлэгчийн асуулт / эмчийн хариу – contract-like part */}
                        <div
                          style={{
                            marginTop: 4,
                            paddingTop: 6,
                            borderTop: "1px dashed #e5e7eb",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 500,
                              fontSize: 12,
                              marginBottom: 2,
                            }}
                          >
                            Үйлчлүүлэгчийн асуулт:
                          </div>
                          <textarea
                            placeholder="Үйлчлүүлэгчийн асуусан асуултуудыг энд тэмдэглэнэ."
                            value={consent.answers?.patientQuestions || ""}
                            onChange={(e) =>
                              updateConsentAnswers({
                                patientQuestions: e.target.value,
                              })
                            }
                            onBlur={async () => {
                              await saveConsent(consent.type);
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

                          <div
                            style={{
                              fontWeight: 500,
                              fontSize: 12,
                              marginBottom: 2,
                            }}
                          >
                            Эмчийн хариулт:
                          </div>
                          <textarea
                            placeholder="Эмчилгээний явц, эрсдэл, хувилбаруудын талаар эмчийн өгсөн тайлбар, хариултуудыг тэмдэглэнэ."
                            value={consent.answers?.doctorAnswer || ""}
                            onChange={(e) =>
                              updateConsentAnswers({
                                doctorAnswer: e.target.value,
                              })
                            }
                            onBlur={async () => {
                              await saveConsent(consent.type);
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

                          {/* Read-only doctor + date to mimic bottom of paper form */}
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              fontSize: 12,
                              color: "#4b5563",
                              marginTop: 4,
                            }}
                          >
                            <div style={{ flex: "1 1 200px" }}>
                              Эмчийн нэр:{" "}
                              <strong>
                                {formatDoctorDisplayName(encounter.doctor)}
                              </strong>
                            </div>
                            <div style={{ flex: "1 1 160px" }}>
                              Огноо:{" "}
                              <strong>
                                {formatShortDate(encounter.visitDate)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* 4. Согог засал – basic fields */}
                    {consent.type === "prosthodontic" && (
                      <>
                        <div style={{ marginBottom: 4 }}>
                          Согог заслын үед тохиролцсон нөхцөл, онцгой заалтуудыг
                          энд тэмдэглэнэ.
                        </div>
                        <textarea
                          placeholder="Нөхцөл, тайлбар"
                          value={consent.answers?.conditions || ""}
                          onChange={(e) =>
                            updateConsentAnswers({
                              conditions: e.target.value,
                            })
                          }
                          onBlur={async () => {
                            await saveConsent(consent.type);
                          }}
                          rows={3}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 6px",
                          }}
                        />
                      </>
                    )}
                  </div>
                </>
  
              )}
            </div>

            {encounter.notes && (
              <div style={{ marginTop: 4 }}>
                <strong>Тэмдэглэл:</strong> {encounter.notes}
              </div>
            )}
          </section>

          {/* Tooth chart */}
          <section
            style={{
              marginTop: 0,
              padding: 16,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
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
              <h2 style={{ fontSize: 16, margin: 0 }}>Шүдний диаграм</h2>

              <div
                style={{
                  display: "inline-flex",
                  borderRadius: 999,
                  border: "1px solid #d1d5db",
                  overflow: "hidden",
                  fontSize: 13,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleToothMode("ADULT")}
                  style={{
                    padding: "4px 10px",
                    border: "none",
                    background:
                      toothMode === "ADULT" ? "#2563eb" : "white",
                    color:
                      toothMode === "ADULT" ? "white" : "#111827",
                    cursor: "pointer",
                  }}
                >
                  Байнгын шүд
                </button>
                <button
                  type="button"
                  onClick={() => toggleToothMode("CHILD")}
                  style={{
                    padding: "4px 10px",
                    border: "none",
                    background:
                      toothMode === "CHILD" ? "#2563eb" : "white",
                    color:
                      toothMode === "CHILD" ? "white" : "#111827",
                    cursor: "pointer",
                  }}
                >
                  Сүүн шүд
                </button>
              </div>
            </div>

                        {chartError && (
  <div style={{ color: "red", marginBottom: 8 }}>{chartError}</div>
)}

<div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  }}
>
  {(toothMode === "ADULT" ? ADULT_TEETH : CHILD_TEETH).map((code) => {
    const selected = isToothSelected(code);
    return (
      <button
        key={code}
        type="button"
        onClick={() => toggleToothSelection(code)}
        style={{
          minWidth: 34,
          padding: "4px 6px",
          borderRadius: 999,
          border: selected ? "1px solid #16a34a" : "1px solid #d1d5db",
          background: selected ? "#dcfce7" : "white",
          color: selected ? "#166534" : "#111827",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {code}
      </button>
    );
  })}

  {/* NEW: inline text field between last tooth and "Бүх шүд" */}
  <input
    key="RANGE"
    type="text"
    placeholder="ж: 21-24, 25-26, 11,21,22"
    onChange={(e) => setCustomToothRange(e.target.value)}
    style={{
      minWidth: 140,
      padding: "4px 8px",
      borderRadius: 999,
      border: "1px solid #d1d5db",
      fontSize: 12,
    }}
  />

  <button
    key="ALL"
    type="button"
    onClick={() => toggleToothSelection("ALL")}
    style={{
      minWidth: 60,
      padding: "4px 10px",
      borderRadius: 999,
      border: isToothSelected("ALL")
        ? "1px solid #16a34a"
        : "1px solid #d1d5db",
      background: isToothSelected("ALL") ? "#dcfce7" : "white",
      color: isToothSelected("ALL") ? "#166534" : "#111827",
      fontSize: 12,
      cursor: "pointer",
      marginLeft: 8,
    }}
  >
    Бүх шүд
  </button>
</div>

            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
              Шүдийг дарж сонгох үед тухайн шүднүүдэд зориулсан нэг оношийн мөр
              доорх хэсэгт үүснэ. Нэг онош нь олон шүдэнд (эсвэл Бүх шүд)
              хамаарч болно.
            </div>
          </section>

          {/* Diagnoses + services + prescription (now also contains media section) */}
          <section
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
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
              <div>
                <h2 style={{ fontSize: 16, margin: 0 }}>Онош тавих</h2>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Нэг мөр = нэг онош, олон шүдэнд хамаарч болно. Шүдний код,
                  онош болон үйлчилгээний дагуу урьдчилсан дүн доор харагдана.
                </div>
              </div>
            </div>

            {dxError && (
              <div style={{ color: "red", marginBottom: 8 }}>{dxError}</div>
            )}
            {servicesLoadError && (
              <div style={{ color: "red", marginBottom: 8 }}>
                {servicesLoadError}
              </div>
            )}

            {rows.length === 0 && (
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                Одоогоор оношийн мөр алга байна. Дээрх шүдний диаграмаас шүд
                сонгоход автоматаар оношийн мөр үүснэ.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rows.map((row, index) => {
                const problems = problemsByDiagnosis[row.diagnosisId] || [];
                return (
                  <div
                    key={index}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 12,
                      background: "#f9fafb",
                    }}
                  >
                    {/* Diagnosis search */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ position: "relative", flex: 1 }}>
                          <input
                            placeholder="Онош бичиж хайх (ж: K04.1, пульпит...)"
                            value={row.searchText ?? ""}
                            onChange={(e) => {
                              const text = e.target.value;
                              setOpenDxIndex(index);
                              setRows((prev) =>
                                prev.map((r, i) =>
                                  i === index
                                    ? {
                                        ...r,
                                        searchText: text,
                                        ...(text.trim()
                                          ? {}
                                          : {
                                              diagnosisId: 0,
                                              diagnosis: undefined,
                                              selectedProblemIds: [],
                                            }),
                                      }
                                    : r
                                )
                              );
                            }}
                            onFocus={() => setOpenDxIndex(index)}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "6px 8px",
                              fontSize: 13,
                            }}
                          />

                          {openDxIndex === index &&
                            allDiagnoses.length > 0 && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  right: 0,
                                  maxHeight: 220,
                                  overflowY: "auto",
                                  marginTop: 4,
                                  background: "white",
                                  borderRadius: 6,
                                  boxShadow:
                                    "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
                                  zIndex: 20,
                                  fontSize: 13,
                                }}
                              >
                                {allDiagnoses
                                  .filter((d) => {
                                    const q = (
                                      row.searchText || ""
                                    ).toLowerCase();
                                    if (!q.trim()) return true;
                                    const hay = `${d.code} ${d.name}`.toLowerCase();
                                    return hay.includes(q);
                                  })
                                  .slice(0, 50)
                                  .map((d) => (
                                    <div
                                      key={d.id}
                                      onMouseDown={async (e) => {
                                        e.preventDefault();
                                        await handleDiagnosisChange(
                                          index,
                                          d.id
                                        );
                                        setOpenDxIndex(null);
                                      }}
                                      style={{
                                        padding: "6px 8px",
                                        cursor: "pointer",
                                        borderBottom:
                                          "1px solid #f3f4f6",
                                        background:
                                          row.diagnosisId === d.id
                                            ? "#eff6ff"
                                            : "white",
                                      }}
                                    >
                                      <div style={{ fontWeight: 500 }}>
                                        {d.code} – {d.name}
                                      </div>
                                      {d.description && (
                                        <div
                                          style={{
                                            fontSize: 11,
                                            color: "#6b7280",
                                            marginTop: 2,
                                          }}
                                        >
                                          {d.description}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeDiagnosisRow(index)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid #dc2626",
                            background: "#fef2f2",
                            color: "#b91c1c",
                            cursor: "pointer",
                            fontSize: 12,
                            height: 32,
                            alignSelf: "flex-start",
                          }}
                        >
                          Устгах
                        </button>
                      </div>
                    </div>

                    {/* Tooth list */}
                    <div
                      style={{
                        marginBottom: 8,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        placeholder="Шүдний код (ж: 11, 21, 22)"
                        value={row.toothCode || ""}
                        onChange={(e) =>
                          handleDxToothCodeChange(index, e.target.value)
                        }
                        style={{
                          maxWidth: 260,
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          padding: "6px 8px",
                          fontSize: 12,
                        }}
                      />
                      <span style={{ fontSize: 11, color: "#6b7280" }}>
                        Шүдний диаграмаас автоматаар бөглөгдөнө, засах
                        боломжтой.
                      </span>
                    </div>

                    {/* Service for this diagnosis */}
                    <div
                      style={{
                        marginBottom: 8,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          minWidth: 260,
                          flex: "0 0 auto",
                        }}
                      >
                        <input
                          placeholder="Үйлчилгээний нэр эсвэл кодоор хайх..."
                          value={row.serviceSearchText ?? ""}
                          onChange={(e) => {
                            const text = e.target.value;
                            setOpenServiceIndex(index);
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === index
                                  ? {
                                      ...r,
                                      serviceSearchText: text,
                                      ...(text.trim()
                                        ? {}
                                        : { serviceId: undefined }),
                                    }
                                  : r
                              )
                            );
                          }}
                          onFocus={() => setOpenServiceIndex(index)}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "6px 8px",
                            fontSize: 13,
                            background: "#ffffff",
                          }}
                        />

                        {allServices.length > 0 &&
                          openServiceIndex === index &&
                          (row.serviceSearchText || "").length > 0 && (
                            <div
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                right: 0,
                                maxHeight: 220,
                                overflowY: "auto",
                                marginTop: 4,
                                background: "white",
                                borderRadius: 6,
                                boxShadow:
                                  "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
                                zIndex: 15,
                                fontSize: 13,
                              }}
                            >
                              {allServices
                                .filter((svc) => {
                                  const q = (
                                    row.serviceSearchText || ""
                                  ).toLowerCase();
                                  if (!q.trim()) return true;
                                  const hay = `${svc.code || ""} ${svc.name}`.toLowerCase();
                                  return hay.includes(q);
                                })
                                .slice(0, 50)
                                .map((svc) => (
                                  <div
                                    key={svc.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setRows((prev) =>
                                        prev.map((r, i) =>
                                          i === index
                                            ? {
                                                ...r,
                                                serviceId: svc.id,
                                                serviceSearchText:
                                                  svc.name,
                                              }
                                            : r
                                        )
                                      );
                                      setOpenServiceIndex(null);
                                    }}
                                    style={{
                                      padding: "6px 8px",
                                      cursor: "pointer",
                                      borderBottom:
                                        "1px solid #f3f4f6",
                                      background:
                                        row.serviceId === svc.id
                                          ? "#eff6ff"
                                          : "white",
                                    }}
                                  >
                                    <div style={{ fontWeight: 500 }}>
                                      {svc.code ? `${svc.code} — ` : ""}
                                      {svc.name}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 11,
                                        color: "#6b7280",
                                        marginTop: 2,
                                      }}
                                    >
                                      Үнэ:{" "}
                                      {svc.price.toLocaleString(
                                        "mn-MN"
                                      )}
                                      ₮
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Problems */}
                    {row.diagnosisId ? (
                      <>
                        {problems.length === 0 ? (
                          <div
                            style={{
                              color: "#6b7280",
                              fontSize: 12,
                              marginBottom: 8,
                            }}
                          >
                            Энэ оношид тохирсон зовиур бүртгээгүй байна
                            (оношийн тохиргооноос нэмнэ).
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            {problems.map((p) => {
                              const checked =
                                row.selectedProblemIds.includes(p.id);
                              return (
                                <label
                                  key={p.id}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "4px 8px",
                                    borderRadius: 999,
                                    border: checked
                                      ? "1px solid #16a34a"
                                      : "1px solid #d1d5db",
                                    background: checked
                                      ? "#dcfce7"
                                      : "#ffffff",
                                    fontSize: 12,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      toggleProblem(index, p.id)
                                    }
                                  />
                                  {p.label}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : null}

                    {/* Note */}
                    <textarea
                      placeholder="Энэ оношид холбогдох тэмдэглэл (сонголттой)"
                      value={row.note}
                      onChange={(e) =>
                        handleNoteChange(index, e.target.value)
                      }
                      rows={2}
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "6px 8px",
                        fontSize: 13,
                        resize: "vertical",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {saveError && (
              <div style={{ color: "red", marginTop: 8 }}>{saveError}</div>
            )}

            {/* Totals + buttons */}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 13, color: "#111827" }}>
                Нийт үйлчилгээний урьдчилсан дүн:{" "}
                <strong>
                  {totalDiagnosisServicesPrice.toLocaleString("mn-MN")}₮
                </strong>{" "}
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  (Эмчийн сонгосон онош, үйлчилгээний дагуу. Төлбөрийн касс
                  дээр эцэслэнэ.)
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveDiagnoses();
                    await handleSaveServices();
                    await savePrescription();
                  }}
                  disabled={saving || finishing || prescriptionSaving}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: "#16a34a",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {saving || prescriptionSaving
                    ? "Хадгалж байна..."
                    : "Зөвхөн онош хадгалах"}
                </button>

                <button
                  type="button"
                  onClick={handleFinishEncounter}
                  disabled={saving || finishing || prescriptionSaving}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {finishing
                    ? "Дуусгаж байна..."
                    : "Үзлэг дуусгах / Төлбөрт шилжүүлэх"}
                </button>
              </div>
            </div>

            {/* Media / X-ray images – directly ABOVE prescription */}
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
                  margin: 0,
                  marginBottom: 6,
                }}
              >
                Рентген / зураг
              </h3>
              <p
                style={{
                  marginTop: 0,
                  marginBottom: 6,
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Энэ үзлэгт холбоотой рентген болон бусад зургууд.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontSize: 12,
                    cursor: uploadingMedia ? "default" : "pointer",
                  }}
                >
                  {uploadingMedia ? "Хуулж байна..." : "+ Зураг нэмэх"}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    disabled={uploadingMedia}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleMediaUpload(file);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void reloadMedia()}
                  disabled={mediaLoading}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #6b7280",
                    background: "#f3f4f6",
                    color: "#374151",
                    fontSize: 12,
                    cursor: mediaLoading ? "default" : "pointer",
                  }}
                >
                  {mediaLoading ? "Шинэчилж байна..." : "Зураг шинэчлэх"}
                </button>
              </div>

              {mediaLoading && (
                <div style={{ fontSize: 13 }}>Зураг ачаалж байна...</div>
              )}

              {mediaError && (
                <div style={{ color: "red", fontSize: 13, marginBottom: 8 }}>
                  {mediaError}
                </div>
              )}

              {!mediaLoading && media.length === 0 && !mediaError && (
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  Одоогоор энэ үзлэгт зураг хадгалаагүй байна.
                </div>
              )}

              {media.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(120px, 1fr))",
                    gap: 12,
                    marginTop: 8,
                  }}
                >
                  {media.map((m) => {
                    const href = m.filePath.startsWith("http")
                      ? m.filePath
                      : m.filePath.startsWith("/")
                      ? m.filePath
                      : `/${m.filePath}`;
                    return (
                      <a
                        key={m.id}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          textDecoration: "none",
                          color: "#111827",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                          overflow: "hidden",
                          background: "#f9fafb",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            aspectRatio: "4 / 3",
                            overflow: "hidden",
                            background: "#111827",
                          }}
                        >
                          <img
                            src={href}
                            alt={m.toothCode || "Рентген зураг"}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            padding: 6,
                            fontSize: 11,
                            borderTop: "1px solid #e5e7eb",
                            background: "#ffffff",
                          }}
                        >
                          <div>
                            {m.type === "XRAY" ? "Рентген" : "Зураг"}{" "}
                            {m.toothCode ? `(${m.toothCode})` : ""}
                          </div>
                          {m.createdAt && (
                            <div style={{ color: "#6b7280", marginTop: 2 }}>
                              {formatDateTime(m.createdAt)}
                            </div>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Prescription section (stays last) */}
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
                  margin: 0,
                  marginBottom: 6,
                }}
              >
                Эмийн жор (ихдээ 3 эм)
              </h3>
              <p
                style={{
                  marginTop: 0,
                  marginBottom: 6,
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Өвчтөнд өгөх эмийн нэр, тун, хэрэглэх давтамж болон хоногийг
                бөглөнө үү. Жор бичихгүй бол энэ хэсгийг хоосон орхиж болно.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 2fr 80px 80px 80px 1.5fr 60px",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 12,
                  marginBottom: 4,
                  padding: "4px 0",
                  color: "#6b7280",
                }}
              >
                <div>№</div>
                <div>Эмийн нэр / тун / хэлбэр</div>
                <div style={{ textAlign: "center" }}>Нэг удаад</div>
                <div style={{ textAlign: "center" }}>Өдөрт</div>
                <div style={{ textAlign: "center" }}>Хэд хоног</div>
                <div>Тэмдэглэл</div>
                <div />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {prescriptionItems.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "40px 2fr 80px 80px 80px 1.5fr 60px",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <div>{idx + 1}</div>
                    <input
                      value={it.drugName}
                      onChange={(e) =>
                        setPrescriptionItems((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? { ...p, drugName: e.target.value }
                              : p
                          )
                        )
                      }
                      placeholder="Ж: Амоксициллин 500мг таб."
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        fontSize: 12,
                      }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={it.quantityPerTake ?? ""}
                      onChange={(e) =>
                        setPrescriptionItems((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? {
                                  ...p,
                                  quantityPerTake:
                                    Number(e.target.value) || 1,
                                }
                              : p
                          )
                        )
                      }
                      placeholder="1"
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={it.frequencyPerDay ?? ""}
                      onChange={(e) =>
                        setPrescriptionItems((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? {
                                  ...p,
                                  frequencyPerDay:
                                    Number(e.target.value) || 1,
                                }
                              : p
                          )
                        )
                      }
                      placeholder="3"
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={it.durationDays ?? ""}
                      onChange={(e) =>
                        setPrescriptionItems((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? {
                                  ...p,
                                  durationDays:
                                    Number(e.target.value) || 1,
                                }
                              : p
                          )
                        )
                      }
                      placeholder="7"
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    />
                    <input
                      value={it.note}
                      onChange={(e) =>
                        setPrescriptionItems((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? { ...p, note: e.target.value }
                              : p
                          )
                        )
                      }
                      placeholder="Ж: Хоолны дараа"
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        fontSize: 12,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPrescriptionItems((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      style={{
                        padding: "4px 6px",
                        borderRadius: 6,
                        border: "1px solid #dc2626",
                        background: "#fef2f2",
                        color: "#b91c1c",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      Устгах
                    </button>
                  </div>
                ))}

                {prescriptionItems.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      marginTop: 4,
                    }}
                  >
                    Жор бичээгүй байна. Хэрвээ эмийн жор шаардлагатай бол
                    доорх &quot;Эм нэмэх&quot; товчоор эм нэмнэ үү.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (prescriptionItems.length >= 3) return;
                    setPrescriptionItems((prev) => [
                      ...prev,
                      {
                        drugName: "",
                        durationDays: null,
                        quantityPerTake: null,
                        frequencyPerDay: null,
                        note: "",
                      },
                    ]);
                  }}
                  disabled={prescriptionItems.length >= 3}
                  style={{
                    marginTop: 4,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#2563eb",
                    cursor:
                      prescriptionItems.length >= 3
                        ? "default"
                        : "pointer",
                    fontSize: 12,
                    alignSelf: "flex-start",
                  }}
                >
                  + Эм нэмэх
                </button>

                <button
                  type="button"
                  onClick={savePrescription}
                  disabled={prescriptionSaving}
                  style={{
                    marginTop: 4,
                    marginLeft: 8,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #16a34a",
                    background: "#ecfdf3",
                    color: "#166534",
                    cursor: prescriptionSaving ? "default" : "pointer",
                    fontSize: 12,
                  }}
                >
                  {prescriptionSaving
                    ? "Жор хадгалж байна..."
                    : "Жор хадгалах"}
                </button>

                {prescriptionError && (
                  <div
                    style={{
                      color: "#b91c1c",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {prescriptionError}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

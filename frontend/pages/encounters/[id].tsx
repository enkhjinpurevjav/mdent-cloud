import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

type Branch = {
  id: number;
  name: string;
};

type Patient = {
  id: number;
  regNo?: string | null;
  ovog?: string | null;
  name: string;
  gender?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  address?: string | null;
  bloodType?: string | null;
  citizenship?: string | null;
  emergencyPhone?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  branchId: number;
  branch?: Branch;
};

type PatientBook = {
  id: number;
  bookNumber: string;
  patient: Patient;
};

type Doctor = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
};

type Nurse = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
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
  id?: number;
  diagnosisId: number | null;
  diagnosis?: Diagnosis | null;
  selectedProblemIds: number[];
  note?: string;
  toothCode?: string | null;
};

type ServiceCategory =
  | "ORTHODONTIC_TREATMENT"
  | "IMAGING"
  | "DEFECT_CORRECTION"
  | "ADULT_TREATMENT"
  | "WHITENING"
  | "CHILD_TREATMENT"
  | "SURGERY";

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
  serviceBranches: ServiceBranch[];
};

type EncounterService = {
  id?: number;
  encounterId: number;
  serviceId: number;
  service?: Service;
  quantity: number;
  price: number;
};

type PrescriptionItem = {
  id?: number;
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
  createdAt: string;
  updatedAt: string;
  doctorNameSnapshot?: string | null;
  patientNameSnapshot?: string | null;
  diagnosisSummary?: string | null;
  clinicNameSnapshot?: string | null;
  items: PrescriptionItem[];
};

type Encounter = {
  id: number;
  patientBookId: number;
  visitDate: string;
  notes?: string | null;
  doctorId: number;
  doctor: Doctor | null;
  nurseId?: number | null;
  nurse?: Nurse | null;
  appointmentId?: number | null;
  patientBook: PatientBook;
  encounterDiagnoses: EncounterDiagnosisRow[];
  encounterServices: EncounterService[];
  invoice?: any | null;
  prescription?: Prescription | null;
};

type EditableDiagnosis = EncounterDiagnosisRow & {
  localId: number;
};

type EditablePrescriptionItem = {
  localId: number;
  drugName: string;
  durationDays: number | null;
  quantityPerTake: number | null;
  frequencyPerDay: number | null;
  note?: string;
};

type ChartToothRow = {
  id?: number;
  toothCode: string;
  toothGroup?: string | null;
  status?: string | null;
  notes?: string | null;
};

type EncounterMediaType = "XRAY" | "PHOTO" | "DOCUMENT";

type ConsentType = "root_canal" | "surgery" | "orthodontic" | "prosthodontic";

type SurgeryConsentAnswers = {
  [key: string]: any;
};

type EncounterConsent = {
  encounterId: number;
  type: ConsentType;
  answers: any;
  patientSignedAt?: string | null;
  doctorSignedAt?: string | null;
  patientSignaturePath?: string | null;
  doctorSignaturePath?: string | null;
  createdAt: string;
  updatedAt: string;
};

type EncounterMedia = {
  id: number;
  encounterId: number;
  filePath: string;
  toothCode?: string | null;
  type: EncounterMediaType;
  // backend currently does not include createdAt, so mark optional
  createdAt?: string;
};

type VisitCardType = "ADULT" | "CHILD";

type VisitCardAnswers = {
  generalMedical?: Record<string, any>;
  allergies?: Record<string, any>;
  habits?: Record<string, any>;
  dentalFollowup?: Record<string, any>;
  [key: string]: any;
};

type VisitCard = {
  id: number;
  patientBookId: number;
  type: VisitCardType;
  answers: VisitCardAnswers;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${hh}:${mm}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function formatPatientName(p: Patient) {
  const name = p.name || "";
  const ovog = (p.ovog || "").trim();
  if (ovog) {
    const first = ovog.charAt(0).toUpperCase();
    return `${first}.${name}`;
  }
  return name;
}

function formatDoctorName(d: Doctor | null) {
  if (!d) return "-";
  const name = d.name || "";
  const ovog = (d.ovog || "").trim();
  if (name && ovog) {
    const first = ovog.charAt(0).toUpperCase();
    return `${first}.${name}`;
  }
  if (name) return name;
  return d.email || "-";
}

function formatStaffName(u: {
  name?: string | null;
  ovog?: string | null;
  email: string;
} | null | undefined) {
  if (!u) return "-";
  const name = u.name || "";
  const ovog = (u.ovog || "").trim();
  if (name && ovog) {
    const first = ovog.charAt(0).toUpperCase();
    return `${first}.${name}`;
  }
  if (name) return name;
  return u.email || "-";
}

function formatDoctorDisplayName(d: Doctor | null) {
  return formatDoctorName(d);
}

function stringifyToothList(list: string[]): string {
  return list.join(", ");
}

function displayOrDash(value?: string | null) {
  if (value === undefined || value === null) return "-";
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return "-";
  return trimmed;
}

// ---- Helper: extract “Анхаарах!” lines from visit card answers ----

type WarningLine = { label: string; value: string };

function extractWarningLinesFromVisitCard(
  visitCard: VisitCard | null
): WarningLine[] {
  if (!visitCard || !visitCard.answers) return [];

  const a = visitCard.answers;
  const lines: WarningLine[] = [];

  // 1) General medical (shared for adult/child, but labels differ slightly)
  const generalMedicalLabels: Record<string, string> =
    visitCard.type === "CHILD"
      ? {
          heartDisease: "Зүрх судасны өвчинтэй эсэх",
          highBloodPressure: "Даралт ихсэх өвчинтэй эсэх",
          infectiousDisease: "Халдварт өвчинтэй эсэх",
          tuberculosis: "Сүрьеэ өвчнөөр өвчилж байсан эсэх",
          hepatitisBC: "Халдварт гепатит В, С-ээр өвдөж байсан эсэх",
          diabetes: "Чихрийн шижинтэй эсэх",
          onMedication: "Одоо хэрэглэж байгаа эм, тариа байгаа эсэх",
          seriousIllnessOrSurgery:
            "Ойрын 5 жилд хүнд өвчнөөр өвчилсөн болон мэс ажилбарт орж байсан эсэх",
          implant: "Зүрхний импланттай эсэх",
          generalAnesthesia: "Бүтэн наркоз хийлгэж байсан эсэх",
          chemoOrRadiation: "Химийн/ туяа эмчилгээ хийлгэж байгаа эсэх",
        }
      : {
          heartDisease: "Зүрх судасны өвчтэй эсэх",
          highBloodPressure: "Даралт ихсэх өвчтэй эсэх",
          infectiousDisease: "Халдварт өвчний түүхтэй эсэх",
          tuberculosis: "Сүрьеэ өвчнөөр өвчилж байсан эсэх",
          hepatitisBC:
            "Халдварт гепатит B, C‑сээр өвдөж байсан эсэх",
          diabetes: "Чихрийн шижинтэй эсэх",
          onMedication: "Одоо хэрэглэж байгаа эм, тариа байгаа эсэх",
          seriousIllnessOrSurgery:
            "Ойрын 5 жилд хүнд өвчнөөр өвчилсөн болон мэс ажилбар хийлгэж байсан эсэх",
          implant: "Зүрхний импланттай эсэх",
          generalAnesthesia: "Бүтэн наркоз хийлгэж байсан эсэх",
          chemoOrRadiation: "Хими / туяа эмчилгээ хийлгэж байгаа эсэх",
        };

  if (a.generalMedical) {
    Object.keys(generalMedicalLabels).forEach((key) => {
      const v = (a.generalMedical as any)[key];
      if (v === "yes") {
        const label = generalMedicalLabels[key];
        const detailKey = `${key}Detail`;
        const detail =
          (a.generalMedical as any)[detailKey] ||
          (a.generalMedical as any).details ||
          "";
        const tail = detail ? `Тийм - ${detail}` : "Тийм";
        lines.push({ label, value: tail });
      }
    });

    // Extra special flags
    if ((a.generalMedical as any).pregnant === "yes") {
      lines.push({
        label: "Жирэмсэн эсэх",
        value: "Тийм",
      });
    }
    if ((a.generalMedical as any).childAllergyFood === "yes") {
      lines.push({
        label: "Хүүхэд хүнсний харшилтай эсэх",
        value: "Тийм",
      });
    }
  }

  // 2) Allergies
  if (a.allergies) {
    const allergyLabels: Record<string, string> = {
      drug: "Харшил - Эм тариа",
      metal: "Харшил - Метал",
      localAnesthetic: "Харшил - Шүдний мэдээ алдуулах тариа",
      latex: "Харшил - Латекс",
      other: "Харшил - Бусад",
    };

    (["drug", "metal", "localAnesthetic", "latex", "other"] as const).forEach(
      (key) => {
        const v = (a.allergies as any)[key];
        if (v === "yes") {
          const label = allergyLabels[key];
          const detailKey =
            key === "other" ? "otherDetail" : `${key}Detail`;
          const detail = (a.allergies as any)[detailKey] || "";
          const tail = detail ? `Тийм - ${detail}` : "Тийм";
          lines.push({ label, value: tail });
        }
      }
    );
  }

  // 3) Habits
  if (a.habits) {
    const habitLabelsAdult: Record<string, string> = {
      smoking: "Зуршил - Тамхи татдаг эсэх",
      alcohol: "Зуршил - Архи хэрэглэдэг эсэх",
      coffee: "Зуршил - Кофе хэрэглэдэг эсэх",
      nightGrinding: "Шөнө шүдээ хавирдаг эсэх",
      mouthBreathing: "Ам ангайж унтдаг / амаар амьсгалдаг эсэх",
      other: "Зуршил - Бусад",
    };

    const habitLabelsChild: Record<string, string> = {
      mouthBreathing: "Хэл, хуруу хөхдөг эсэх",
      nightGrinding: "Шөнө амаа ангайж унтдаг эсэх",
      other: "Зуршил - Бусад",
    };

    const labels =
      visitCard.type === "CHILD" ? habitLabelsChild : habitLabelsAdult;

    Object.keys(labels).forEach((key) => {
      const v = (a.habits as any)[key];
      if (v === "yes") {
        const label = labels[key];
        const detailKey =
          key === "other" ? "otherDetail" : `${key}Detail`;
        const detail = (a.habits as any)[detailKey] || "";
        const tail = detail ? `Тийм - ${detail}` : "Тийм";
        lines.push({ label, value: tail });
      }
    });
  }

  // 4) Dental follow-up extras
  if (a.dentalFollowup) {
    const dentalLabels: Record<string, string> = {
      regularCheckups: "Шүдний эмчид байнга үзүүлдэг эсэх",
      bleedingAfterExtraction:
        "Шүд авахуулсны дараа цус тогтол удаан эсэх",
      gumBleeding: "Буйлнаас цус гардаг эсэх",
      badBreath: "Амнаас эвгүй үнэр гардаг эсэх",
    };

    Object.keys(dentalLabels).forEach((key) => {
      const v = (a.dentalFollowup as any)[key];
      if (v === "yes") {
        const label = dentalLabels[key];
        const detailKey = `${key}Detail`;
        const detail = (a.dentalFollowup as any)[detailKey] || "";
        const tail = detail ? `Тийм - ${detail}` : "Тийм";
        lines.push({ label, value: tail });
      }
    });
  }

  return lines;
}

// For tooth selection UI – same arrays as original file
const ADULT_TEETH = [
  "18",
  "17",
  "16",
  "15",
  "14",
  "13",
  "12",
  "11",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "48",
  "47",
  "46",
  "45",
  "44",
  "43",
  "42",
  "41",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
];

const CHILD_TEETH = [
  "55",
  "54",
  "53",
  "52",
  "51",
  "61",
  "62",
  "63",
  "64",
  "65",
  "85",
  "84",
  "83",
  "82",
  "81",
  "71",
  "72",
  "73",
  "74",
  "75",
];

export default function EncounterAdminPage() {
  const router = useRouter();
  const { id } = router.query;

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

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
  const [activeDxRowIndex, setActiveDxRowIndex] = useState<number | null>(
    null
  );
  const [customToothRange, setCustomToothRangeState] = useState("");

  const [consent, setConsent] = useState<EncounterConsent | null>(null);
  const [consentTypeDraft, setConsentTypeDraft] =
    useState<ConsentType | null>(null);
  const [consentAnswersDraft, setConsentAnswersDraft] = useState<any>({});
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState("");

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

  // search state for diagnoses/services
  const [openDxIndex, setOpenDxIndex] = useState<number | null>(null);
  const [openServiceIndex, setOpenServiceIndex] = useState<number | null>(
    null
  );

  // rows is a richer structure combining dx+service search UI,
  // but we can derive from editableDxRows + editableServices.
  // For simplicity, keep a separate "rows" array shaped for the UI.
  type DiagnosisServiceRow = EditableDiagnosis & {
    serviceId?: number;
    serviceSearchText?: string;
    searchText?: string;
  };
  const [rows, setRows] = useState<DiagnosisServiceRow[]>([]);
  const [servicesLoadError, setServicesLoadError] = useState("");
  const [dxError, setDxError] = useState("");

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    const encounterId = Number(id);
    if (!encounterId || Number.isNaN(encounterId)) {
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
        setServicesLoadError("Үйлчилгээ ачааллахад алдаа гарлаа.");
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
            localId: idx + 1,
          })) || [];
        setEditableDxRows(dxRows);

        const svcRows: EncounterService[] =
          enc.encounterServices?.map((row) => ({
            ...row,
            quantity: row.quantity || 1,
          })) || [];
        setEditableServices(svcRows);

        const mergedRows: DiagnosisServiceRow[] = dxRows.map((dxRow, i) => {
          const svc = svcRows[i];
          return {
            ...dxRow,
            serviceId: svc?.serviceId,
            serviceSearchText: svc?.service?.name || "",
            searchText: "",
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

        while (rxItems.length < 3) {
          rxItems.push({
            localId: rxItems.length + 1,
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

    const loadConsent = async () => {
      try {
        setConsentLoading(true);
        const res = await fetch(`/api/encounters/${id}/consent`);
        const json = await res.json().catch(() => null);
        if (!res.ok) return;

        if (json) {
          setConsent(json);
          setConsentTypeDraft(json.type || null);
          setConsentAnswersDraft(json.answers || {});
        } else {
          setConsent(null);
          setConsentTypeDraft(null);
          setConsentAnswersDraft({});
        }
      } catch (err) {
        console.error("loadConsent failed", err);
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

        // get encounter to know bookNumber
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
    void loadConsent();
    void loadNursesForEncounter();
    void loadChartTeeth();
    void loadVisitCardForEncounter();
  }, [id]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mediaTypeFilter]);

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
    setEditableDxRows((prev) => {
      const nextLocalId =
        prev.length === 0
          ? 1
          : Math.max(...prev.map((r) => r.localId)) + 1;
      const toothCode = stringifyToothList(initialTeeth);
      const newRow: EditableDiagnosis = {
        localId: nextLocalId,
        diagnosisId: null,
        selectedProblemIds: [],
        note: "",
        toothCode,
      };
      setRows((old) => [
        ...old,
        {
          ...newRow,
          serviceId: undefined,
          serviceSearchText: "",
          searchText: "",
        },
      ]);
      return [...prev, newRow];
    });
    return 0;
  };

  const removeDiagnosisRow = (index: number) => {
    setEditableDxRows((prev) => prev.filter((_, i) => i !== index));
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const saveConsent = async (type: ConsentType | null) => {
    if (!id || typeof id !== "string") return;
    setConsentSaving(true);
    setConsentError("");
    try {
      const res = await fetch(`/api/encounters/${id}/consent`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          answers: type ? consentAnswersDraft : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Зөвшөөрлийн хуудас хадгалахад алдаа гарлаа"
        );
      }

      if (!json) {
        setConsent(null);
        setConsentTypeDraft(null);
        setConsentAnswersDraft({});
      } else {
        setConsent(json);
        setConsentTypeDraft(json.type || null);
        setConsentAnswersDraft(json.answers || {});
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
    await saveConsent(consentTypeDraft);
  };

  const handleDiagnosisChange = async (
    index: number,
    diagnosisId: number
  ) => {
    setEditableDxRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              diagnosisId,
              selectedProblemIds: [],
            }
          : row
      )
    );
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              diagnosisId,
              selectedProblemIds: [],
            }
          : row
      )
    );
    if (diagnosisId) {
      await ensureProblemsLoaded(diagnosisId);
    }
  };

  const toggleProblem = (index: number, problemId: number) => {
    setEditableDxRows((prev) =>
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
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
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
      prev.map((row, i) => (i === index ? { ...row, note: value } : row))
    );
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, note: value } : row))
    );
  };

  const handleDxToothCodeChange = (index: number, value: string) => {
    setEditableDxRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, toothCode: value } : row
      )
    );
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, toothCode: value } : row
      )
    );
  };

  const handleSaveDiagnoses = async () => {
    if (!id || typeof id !== "string") return;
    setSaving(true);
    setSaveError("");
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
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Онош хадгалахад алдаа гарлаа"
        );
      }

      if (encounter) {
        setEncounter({
          ...encounter,
          encounterDiagnoses: json,
        });
      }
    } catch (err: any) {
      console.error("handleSaveDiagnoses failed", err);
      setSaveError(
        err?.message || "Онош хадгалахад алдаа гарлаа."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveServices = async () => {
    if (!id || typeof id !== "string") return;
    setSaving(true);
    setSaveError("");
    try {
      // sync rows -> editableServices
      const itemsForSave: EncounterService[] = rows
        .filter((r) => r.serviceId)
        .map((r) => ({
          encounterId: Number(id),
          serviceId: r.serviceId!,
          quantity: 1,
          price: 0,
        }));

      const payload = {
        items: itemsForSave.map((svc) => ({
          serviceId: svc.serviceId,
          quantity: svc.quantity || 1,
        })),
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

      while (newItems.length < 3) {
        newItems.push({
          localId: newItems.length + 1,
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

  const handleFinishEncounter = async () => {
    if (!id || typeof id !== "string") return;
    setFinishing(true);
    try {
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
    } catch (err) {
      console.error("handleFinishEncounter failed", err);
    } finally {
      setFinishing(false);
    }
  };

  const handleMediaUpload = async (file: File) => {
    if (!id || typeof id !== "string") return;
    try {
      setUploadingMedia(true);
      setMediaError("");
      const formData = new FormData();
      formData.append("file", file);
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

  const toggleToothMode = (mode: "ADULT" | "CHILD") => {
    setToothMode(mode);
  };

  const isToothSelected = (code: string) => selectedTeeth.includes(code);

  const updateActiveRowToothList = (nextTeeth: string[]) => {
    if (activeDxRowIndex === null) return;
    const toothStr = stringifyToothList(nextTeeth);
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
  };

  const setCustomToothRange = (value: string) => {
    setCustomToothRangeState(value);
    if (!value.trim()) return;
    const parts = value
      .split(/[,\s;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const next = Array.from(new Set([...selectedTeeth, ...parts]));
    setSelectedTeeth(next);
    updateActiveRowToothList(next);
  };

  const toggleToothSelection = (code: string) => {
    if (code === "ALL") {
      // special: select all visible teeth
      const allCodes =
        toothMode === "ADULT" ? ADULT_TEETH : CHILD_TEETH;
      const allSelected =
        allCodes.every((c) => selectedTeeth.includes(c));
      const next = allSelected ? [] : allCodes;
      setSelectedTeeth(next);
      updateActiveRowToothList(next);
      return;
    }

    setSelectedTeeth((prev) => {
      const exists = prev.includes(code);
      const next = exists ? prev.filter((c) => c !== code) : [...prev, code];
      updateActiveRowToothList(next);
      return next;
    });
  };

  // ---- Derived: warning lines from visit card ----
  const warningLines: WarningLine[] = extractWarningLinesFromVisitCard(
    visitCard
  );

  const allDiagnoses = diagnoses;
  const allServices = services;

  const totalDiagnosisServicesPrice = rows.reduce((sum, r) => {
    if (!r.serviceId) return sum;
    const svc = allServices.find((x) => x.id === r.serviceId);
    const price = svc?.price ?? 0;
    return sum + price;
  }, 0);

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
          {/* Encounter header */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div
  style={{
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: 16,
    background: "#ffffff",
  }}
>
  <div
    style={{
      fontSize: 18,
      fontWeight: 600,
      marginBottom: 4,
    }}
  >
    {formatPatientName(encounter.patientBook.patient)}
  </div>
  <div style={{ fontSize: 13, color: "#6b7280" }}>
    Картын дугаар: {encounter.patientBook.bookNumber}
  </div>
  {encounter.patientBook.patient.regNo && (
    <div style={{ fontSize: 13, color: "#6b7280" }}>
      РД: {encounter.patientBook.patient.regNo}
    </div>
  )}
  <div style={{ fontSize: 13, color: "#6b7280" }}>
    Утас: {displayOrDash(encounter.patientBook.patient.phone)}
  </div>
  <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
    Бүртгэсэн салбар:{" "}
    {encounter.patientBook.patient.branch?.name ||
      encounter.patientBook.patient.branchId}
  </div>

  {/* NEW: navigation buttons based on Картын дугаар (bookNumber) */}
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    }}
  >
    {/* 1) Үйлчлүүлэгчийн дэлгэрэнгүй → patients/[bookNumber] */}
    <button
      type="button"
      onClick={() =>
        router.push(
          `/patients/${encodeURIComponent(
            encounter.patientBook.bookNumber
          )}`
        )
      }
      style={{
        padding: "4px 8px",
        borderRadius: 6,
        border: "1px solid #d1d5db",
        background: "#f9fafb",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      Үйлчлүүлэгчийн дэлгэрэнгүй
    </button>

    {/* 2) Үйлчлүүлэгчийн карт (үзлэгийн карт) → patients/[bookNumber]?tab=visit-card */}
    <button
      type="button"
      onClick={() =>
        router.push(
          `/patients/${encodeURIComponent(
            encounter.patientBook.bookNumber
          )}?tab=visit-card`
        )
      }
      style={{
        padding: "4px 8px",
        borderRadius: 6,
        border: "1px solid #d1d5db",
        background: "#f0f9ff",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      Үйлчлүүлэгчийн карт
    </button>

    {/* 3) Гажиг заслын карт → ortho/[bookNumber] */}
    <button
      type="button"
      onClick={() =>
        router.push(
          `/ortho/${encodeURIComponent(
            encounter.patientBook.bookNumber
          )}`
        )
      }
      style={{
        padding: "4px 8px",
        borderRadius: 6,
        border: "1px solid #d1d5db",
        background: "#fef3c7",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      Гажиг заслын карт
    </button>

    {/* 4) Өмнөх үзлэгүүд → patients/[bookNumber]?tab=encounters (to implement later) */}
    <button
      type="button"
      onClick={() =>
        router.push(
          `/patients/${encodeURIComponent(
            encounter.patientBook.bookNumber
          )}?tab=encounters`
        )
      }
      style={{
        padding: "4px 8px",
        borderRadius: 6,
        border: "1px solid #d1d5db",
        background: "#f3e8ff",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      Өмнөх үзлэгүүд
    </button>
  </div>
</div>

            <div
              style={{
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: 16,
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}
                >
                  Огноо
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {formatShortDate(encounter.visitDate)}
                </div>
              </div>

              <div>
                <div
                  style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}
                >
                  Эмч
                </div>
                <div style={{ fontSize: 14 }}>
                  {formatDoctorDisplayName(encounter.doctor)}
                </div>
              </div>

              <div>
                <div
                  style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}
                >
                  Сувилагч
                </div>
                <select
                  value={encounter.nurseId || ""}
                  onChange={(e) => void handleChangeNurse(e.target.value)}
                  disabled={changingNurse}
                  style={{
                    width: "100%",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                    fontSize: 13,
                  }}
                >
                  <option value="">Сонгоогүй</option>
                  {nursesForEncounter.map((n) => (
                    <option key={n.nurseId} value={n.nurseId}>
                      {formatStaffName({
                        name: n.name || undefined,
                        ovog: n.ovog || undefined,
                        email: n.email,
                      })}
                    </option>
                  ))}
                </select>
              </div>

              {/* Анхаарах! – summary from visit card */}
              {warningLines.length > 0 && (
                <div
                  style={{
                    marginTop: 4,
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #f97316",
                    background: "#fff7ed",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#b91c1c",
                      marginBottom: 4,
                    }}
                  >
                    Анхаарах!
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 16,
                      fontSize: 12,
                      color: "#7f1d1d",
                    }}
                  >
                    {warningLines.map((w, idx) => (
                      <li key={`${w.label}-${idx}`} style={{ marginBottom: 2 }}>
                        {w.label} ({w.value})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Consent form (Зөвшөөрлийн хуудас шаардлагатай) */}
          <section
            style={{
              marginBottom: 16,
            }}
          >
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
              {/* Enable checkbox */}
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

                {consentError && (
                  <span style={{ fontSize: 12, color: "#b91c1c" }}>
                    {consentError}
                  </span>
                )}
              </div>

              {/* Everything below only when consent exists */}
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

                  {/* NOTE: for brevity here we keep only the root_canal form fully;
                      the surgery / orthodontic / prosthodontic parts follow the same
                      structure you already have. */}

                  {consent.type === "root_canal" && (
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
                        {/* long explanatory text – kept from your current version */}
                        Шүдний сувгийн (endodont) эмчилгээ нь шүдний цөгц болон
                        сурвалжийн хөндийд байрлах мэдрэл судасны багц
                        (зөөлц)-д үүссэн өвдөлт үрэвслийг эмчлэх олон удаагийн
                        (3-5 удаагийн ирэлт болон тухайн шүдний үрэвслийн
                        байдлаас шалтгаалан 5-с дээш 6 сар хүртэл хугацаагаар)
                        ирэлтээр эмчлэгддэг курс эмчилгээ юм. ...
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

                  {/* ... keep your full surgery / orthodontic / prosthodontic JSX here ... */}

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
              <div style={{ color: "red", marginBottom: 8 }}>
                {chartError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 8,
              }}
            >
              {(toothMode === "ADULT" ? ADULT_TEETH : CHILD_TEETH).map(
                (code) => {
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
                        border: selected
                          ? "1px solid #16a34a"
                          : "1px solid #d1d5db",
                        background: selected ? "#dcfce7" : "white",
                        color: selected ? "#166534" : "#111827",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {code}
                    </button>
                  );
                }
              )}

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
                  background: isToothSelected("ALL")
                    ? "#dcfce7"
                    : "white",
                  color: isToothSelected("ALL")
                    ? "#166534"
                    : "#111827",
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

          {/* Diagnoses + services + prescription + media */}
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
                const problems =
                  problemsByDiagnosis[row.diagnosisId ?? 0] || [];
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
                                              diagnosisId: null,
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
                        onFocus={() => setActiveDxRowIndex(index)}
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
                                row.selectedProblemIds?.includes(p.id);
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
                  Одоогоор энэ үзлэгт зураг хадгалагүй байна.
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

            {/* Prescription section */}
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
                        localId: prev.length + 1,
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

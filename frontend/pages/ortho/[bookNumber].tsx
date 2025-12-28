import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import FullArchDiscOdontogram, {
  ActiveStatusKey,
} from "../../components/odontogram/FullArchDiscOdontogram";

/**
 * Orthodontic patient card page.
 */

type OrthoDisc = {
  code: string;
  status: string;
  regions?: {
    top?: "none" | "caries" | "filled";
    bottom?: "none" | "caries" | "filled";
    left?: "none" | "caries" | "filled";
    right?: "none" | "caries" | "filled";
    center?: "none" | "caries" | "filled";
  };
};

type TreatmentPlanSection = {
  orthodontic?: boolean;
  growthModification?: boolean;
  combinedSurgery?: boolean;
  phaseI: { plan?: string; note?: string };
  phaseII: { plan?: string; note?: string };
  phaseIII: { plan?: string; note?: string };
};

const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlanSection>({
  orthodontic: false,
  growthModification: false,
  combinedSurgery: false,
  phaseI: { plan: "", note: "" },
  phaseII: { plan: "", note: "" },
  phaseIII: { plan: "", note: "" },
});

type ProblemRowKey =
  | "boneAngle"
  | "boneStep"
  | "tooth"
  | "toothPosition"
  | "functional"
  | "badHabit";

type ProblemListRow = {
  plus?: boolean;
  minus?: boolean;
  comment?: string; // NEW: doctor comment after +/- 
  problem?: string; // NEW: main problem text (Problem list)
};

type ProblemSection = {
  rows: Record<ProblemRowKey, ProblemListRow>;
  diagnosis?: string; // ОНОШ
  cause?: string;     // ШАЛТГААН
  treatmentGoals?: string[]; // ЭМЧИЛГЭЭНИЙ ЗОРИЛГО (1–6)
};

type SumOfIncisorInputs = {
  u12: string;
  u11: string;
  u21: string;
  u22: string;
  l32: string;
  l31: string;
  l41: string;
  l42: string;
};

type BoltonInputs = {
  upper6: string[];
  lower6: string[];
  upper12: string[];
  lower12: string[];
};

type HowesInputs = {
  pmbaw?: string;
  tm?: string;
};

type DiscrepancyAxis = {
  upperLeft: string;
  upperRight: string;
  lowerLeft: string;
  lowerRight: string;
};

type TeethSection = {
  // Overbite
  overbiteDeep?: boolean;
  overbiteOpen?: boolean;

  // Overjet
  overjetEdgeToEdge?: boolean; // Ирмэг ирмэгээр
  overjetPositive?: boolean;
  overjetNegative?: boolean;

  // Curve of Spee: 4 numeric cells (same pattern as DiscrepancyAxis)
  curveOfSpee: DiscrepancyAxis;

  // Cross bite, Scissor bite, Diastem: 4‑value grids too
  crossBite: DiscrepancyAxis;
  scissorBite: DiscrepancyAxis;
  diastem: DiscrepancyAxis;

  // Голын шугам – also 4 cells
  midline: DiscrepancyAxis;

  // Нумын хэлбэр (arch form) – U & L each have 4 choices
  archFormU: {
    square?: boolean; // Дөрвөлжин
    parabola?: boolean; // Парабол
    round?: boolean; // Дугуй
    vShape?: boolean; // V хэлбэр
  };
  archFormL: {
    square?: boolean;
    parabola?: boolean;
    round?: boolean;
    vShape?: boolean;
  };

  // Хоршилт (occlusion classes) – right/left I/II/III
  molarRelationRight?: "I" | "II" | "III" | "";
  molarRelationLeft?: "I" | "II" | "III" | "";
  canineRelationRight?: "I" | "II" | "III" | "";
  canineRelationLeft?: "I" | "II" | "III" | "";
};

type DiscrepancyInputs = {
  ald: DiscrepancyAxis;
  midline: DiscrepancyAxis;
  curveOfSpee: DiscrepancyAxis;
  expansion: DiscrepancyAxis;
  fmiaABPlane: DiscrepancyAxis;
  overjet: DiscrepancyAxis;
  total: DiscrepancyAxis;
};



/**
 * АСУУМЖ (survey) section data.
 */
type OrthoSurvey = {
  mainReason?: string;
  currentComplaint?: string;
  medicalHistory?: string;
  orthoTreatment?: string;
  familyHistory?: string;

  allergyPlant?: boolean;
  allergyMetal?: boolean;
  allergyDrug?: boolean;
  allergyFood?: boolean;
  allergyPlastic?: boolean;
  allergyOther?: boolean;
  allergyOtherText?: string;

  hbv?: boolean;
  hbc?: boolean;
  hiv?: boolean;
};

/**
 * БОДИТ ҮЗЛЭГ (Physical Exam)
 */
type PhysicalExam = {
  weight?: string;
  height?: string;
  boneAge?: string;
  dentalAge?: string;

  growthSpurtNormal?: boolean;
  growthSpurtAbnormal?: boolean;

  growthSpurtBefore?: boolean;
  growthSpurtMiddle?: boolean;
  growthSpurtAfter?: boolean;

  patternVertical?: boolean;
  patternHorizontal?: boolean;
  patternClockwise?: boolean;
  patternCounterclockwise?: boolean;
};

/**
 * ЗУРШИЛ
 */
type HabitSection = {
  tongueThrust?: boolean;
  lipNailBite?: boolean;
  fingerSucking?: boolean;
  breathingMouth?: boolean;
  breathingNose?: boolean;
  swallowNormal?: boolean;
  swallowAbnormal?: boolean;
  other?: string;
};

/**
 * ХОЛБООС
 */
type AttachmentSection = {
  aheaGood?: boolean;
  aheaMedium?: boolean;
  aheaPoor?: boolean;
  gingivitis?: boolean;
  gingivitisNo?: boolean;
  frenumInflammation?: boolean;
  frenumInflammationNo?: boolean;
};

/**
 * ЭРҮҮНИЙ ҮЕ (TMJ)
 */
type TmjSection = {
  previousPainYes?: boolean;
  previousPainNo?: boolean;
  asymptomatic?: boolean;
  symptomatic?: boolean;
  soundRight?: boolean;
  soundLeft?: boolean;
  painRight?: boolean;
  painLeft?: boolean;
  headacheYes?: boolean;
  headacheNo?: boolean;
  muscleTensionYes?: boolean;
  muscleTensionNo?: boolean;
  mouthOpeningNormal?: boolean;
  mouthOpeningLimited?: boolean;
  maxMouthOpeningMm?: string;
};

/**
 * УТТС
 */
type UttsSection = {
  lipCleft?: boolean;
  palateCleft?: boolean;
  unilateral?: boolean;
  unilateralSide?: string;
  bilateral?: boolean;
  other?: boolean;
  otherText?: string;
};

/**
 * УРУУЛ
 */
type LipSection = {
  closed?: boolean;
  open?: boolean;
  restLipMm?: string;
  smilingMm?: string;
};

type OrthoCardData = {
  patientName?: string;
  notes?: string;
  toothChart: OrthoDisc[];
  problemList?: { id: number; label: string; checked?: boolean }[];
  supernumeraryNote?: string;

  sumOfIncisorInputs?: SumOfIncisorInputs;
  boltonInputs?: BoltonInputs;
  howesInputs?: HowesInputs;

  discrepancyInputs?: DiscrepancyInputs;

  survey?: OrthoSurvey;

  physicalExam?: PhysicalExam;

  habits?: HabitSection;
  attachment?: AttachmentSection;
  tmj?: TmjSection;
  utts?: UttsSection;
  lip?: LipSection;
  teeth?: TeethSection; // NEW
  problemSection?: ProblemSection; // NEW
};

type OrthoCardApiResponse = {
  patientBook: { id: number; bookNumber: string };
  patient: {
    id: number;
    name: string | null;
    ovog: string | null;
    regNo: string | null;
    age?: number | null;
    gender?: string | null;
    phone?: string | null;
    address?: string | null;
    branch?: { id: number; name: string | null } | null;
  };
  orthoCard: {
    id: number;
    patientBookId: number;
    data: OrthoCardData;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type StatusKey = ActiveStatusKey;

const STATUS_BUTTONS: {
  key: StatusKey;
  label: string;
  color: string;
}[] = [
  { key: "caries", label: "Цоорсон", color: "#dc2626" },
  { key: "filled", label: "Ломбодсон", color: "#2563eb" },
  { key: "extracted", label: "Авахуулсан", color: "#166534" },
  { key: "prosthesis", label: "Шүдэлбэр", color: "#9ca3af" },
  { key: "delay", label: "Саатсан", color: "#fbbf24" },
  { key: "anodontia", label: "Anodontia", color: "#14b8a6" },
  { key: "shapeAnomaly", label: "Хэлбэрийн гажиг", color: "#6366f1" },
  { key: "supernumerary", label: "Илүү шүд", color: "#a855f7" },
];

const emptyBoltonInputs = (): BoltonInputs => ({
  upper6: Array(6).fill(""),
  lower6: Array(6).fill(""),
  upper12: Array(12).fill(""),
  lower12: Array(12).fill(""),
});

const emptyAxis = (): DiscrepancyAxis => ({
  upperLeft: "",
  upperRight: "",
  lowerLeft: "",
  lowerRight: "",
});

const emptyDiscrepancyInputs = (): DiscrepancyInputs => ({
  ald: emptyAxis(),
  midline: emptyAxis(),
  curveOfSpee: emptyAxis(),
  expansion: emptyAxis(),
  fmiaABPlane: emptyAxis(),
  overjet: emptyAxis(),
  total: emptyAxis(),
});

export default function OrthoCardPage() {
  const router = useRouter();
  const { bookNumber } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  

  const [patientRegNo, setPatientRegNo] = useState<string>("");
  const [patientAge, setPatientAge] = useState<string>("");
  const [patientGender, setPatientGender] = useState<string>("");
  const [patientPhone, setPatientPhone] = useState<string>("");
  const [patientAddress, setPatientAddress] = useState<string>("");

  const [patientBookId, setPatientBookId] = useState<number | null>(null);
  const [patientNameHeader, setPatientNameHeader] = useState<string>("");

  const [cardPatientName, setCardPatientName] = useState<string>("");
  const [cardNotes, setCardNotes] = useState<string>("");
  const [supernumeraryNote, setSupernumeraryNote] = useState<string>("");
  const [toothChart, setToothChart] = useState<OrthoDisc[]>([]);

  const [sumOfIncisorInputs, setSumOfIncisorInputs] =
    useState<SumOfIncisorInputs>({
      u12: "",
      u11: "",
      u21: "",
      u22: "",
      l32: "",
      l31: "",
      l41: "",
      l42: "",
    });

  const [boltonInputs, setBoltonInputs] = useState<BoltonInputs>(
    emptyBoltonInputs()
  );

  const [howesInputs, setHowesInputs] = useState<HowesInputs>({
    pmbaw: "",
    tm: "",
  });

  const [discrepancyInputs, setDiscrepancyInputs] =
    useState<DiscrepancyInputs>(emptyDiscrepancyInputs());

  const [activeStatus, setActiveStatus] = useState<StatusKey | null>(null);

  const [extraToothText, setExtraToothText] = useState<string>("");

  const [survey, setSurvey] = useState<OrthoSurvey>({
    mainReason: "",
    currentComplaint: "",
    medicalHistory: "",
    orthoTreatment: "",
    familyHistory: "",
    allergyPlant: false,
    allergyMetal: false,
    allergyDrug: false,
    allergyFood: false,
    allergyPlastic: false,
    allergyOther: false,
    allergyOtherText: "",
    hbv: false,
    hbc: false,
    hiv: false,
  });

      const [problemSection, setProblemSection] = useState<ProblemSection>({
    rows: {
      boneAngle: { plus: false, minus: false, comment: "", problem: "" },
      boneStep: { plus: false, minus: false, comment: "", problem: "" },
      tooth: { plus: false, minus: false, comment: "", problem: "" },
      toothPosition: { plus: false, minus: false, comment: "", problem: "" },
      functional: { plus: false, minus: false, comment: "", problem: "" },
      badHabit: { plus: false, minus: false, comment: "", problem: "" },
    },
    diagnosis: "",
    cause: "",
    treatmentGoals: ["", "", "", "", "", ""],
  });
  
  const [physicalExam, setPhysicalExam] = useState<PhysicalExam>({
    weight: "",
    height: "",
    boneAge: "",
    dentalAge: "",
    growthSpurtNormal: false,
    growthSpurtAbnormal: false,
    growthSpurtBefore: false,
    growthSpurtMiddle: false,
    growthSpurtAfter: false,
    patternVertical: false,
    patternHorizontal: false,
    patternClockwise: false,
    patternCounterclockwise: false,
  });

  const [habits, setHabits] = useState<HabitSection>({
    tongueThrust: false,
    lipNailBite: false,
    fingerSucking: false,
    breathingMouth: false,
    breathingNose: false,
    swallowNormal: false,
    swallowAbnormal: false,
    other: "",
  });

  const [attachment, setAttachment] = useState<AttachmentSection>({
    aheaGood: false,
    aheaMedium: false,
    aheaPoor: false,
    gingivitis: false,
    gingivitisNo: false,
    frenumInflammation: false,
    frenumInflammationNo: false,
  });

  const [tmj, setTmj] = useState<TmjSection>({
    previousPainYes: false,
    previousPainNo: false,
    asymptomatic: false,
    symptomatic: false,
    soundRight: false,
    soundLeft: false,
    painRight: false,
    painLeft: false,
    headacheYes: false,
    headacheNo: false,
    muscleTensionYes: false,
    muscleTensionNo: false,
    mouthOpeningNormal: false,
    mouthOpeningLimited: false,
    maxMouthOpeningMm: "",
  });

  const [utts, setUtts] = useState<UttsSection>({
    lipCleft: false,
    palateCleft: false,
    unilateral: false,
    unilateralSide: "",
    bilateral: false,
    other: false,
    otherText: "",
  });

  const [lip, setLip] = useState<LipSection>({
  closed: false,
  open: false,
  restLipMm: "",
  smilingMm: "",
});

  const [teeth, setTeeth] = useState<TeethSection>({
    overbiteDeep: false,
    overbiteOpen: false,
    overjetEdgeToEdge: false,
    overjetPositive: false,
    overjetNegative: false,
    curveOfSpee: emptyAxis(),
    crossBite: emptyAxis(),
    scissorBite: emptyAxis(),
    diastem: emptyAxis(),
    midline: emptyAxis(),
    archFormU: {
      square: false,
      parabola: false,
      round: false,
      vShape: false,
    },
    archFormL: {
      square: false,
      parabola: false,
      round: false,
      vShape: false,
    },
    molarRelationRight: "",
    molarRelationLeft: "",
    canineRelationRight: "",
    canineRelationLeft: "",
  });
  
  const bn =
    typeof bookNumber === "string" && bookNumber.trim()
      ? bookNumber.trim()
      : "";

  const parseOrZero = (v: string | undefined | null): number =>
    !v ? 0 : Number.parseFloat(v) || 0;

  const updateSumOfIncisor = (
    key: keyof SumOfIncisorInputs,
    value: string
  ) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setSumOfIncisorInputs((prev) => ({ ...prev, [key]: cleaned }));
  };

  const u1Sum =
    parseOrZero(sumOfIncisorInputs.u12) +
    parseOrZero(sumOfIncisorInputs.u11) +
    parseOrZero(sumOfIncisorInputs.u21) +
    parseOrZero(sumOfIncisorInputs.u22);

  const l1Sum =
    parseOrZero(sumOfIncisorInputs.l32) +
    parseOrZero(sumOfIncisorInputs.l31) +
    parseOrZero(sumOfIncisorInputs.l41) +
    parseOrZero(sumOfIncisorInputs.l42);

  const u1l1Ratio = l1Sum > 0 ? (u1Sum / l1Sum).toFixed(2) : "";

  const updateBoltonUpper6 = (index: number, value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  setBoltonInputs((prev) => {
    const next: BoltonInputs = {
      upper6: [...prev.upper6],
      lower6: [...prev.lower6],
      upper12: [...prev.upper12],
      lower12: [...prev.lower12],
    };
    next.upper6[index] = cleaned;
    next.upper12[index] = cleaned; // keep your rule
    return next;
  });
};

const updateBoltonLower6 = (index: number, value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  setBoltonInputs((prev) => {
    const next: BoltonInputs = {
      upper6: [...prev.upper6],
      lower6: [...prev.lower6],
      upper12: [...prev.upper12],
      lower12: [...prev.lower12],
    };
    next.lower6[index] = cleaned;
    next.lower12[index] = cleaned; // keep your rule
    return next;
  });
};

const updateBoltonUpper12 = (index: number, value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  setBoltonInputs((prev) => {
    const next: BoltonInputs = {
      upper6: [...prev.upper6],
      lower6: [...prev.lower6],
      upper12: [...prev.upper12],
      lower12: [...prev.lower12],
    };
    next.upper12[index] = cleaned;
    return next;
  });
};

const updateBoltonLower12 = (index: number, value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  setBoltonInputs((prev) => {
    const next: BoltonInputs = {
      upper6: [...prev.upper6],
      lower6: [...prev.lower6],
      upper12: [...prev.upper12],
      lower12: [...prev.lower12],
    };
    next.lower12[index] = cleaned;
    return next;
  });
};

  const sumArray = (arr: string[]): number =>
    arr.reduce((acc, v) => acc + parseOrZero(v), 0);

  const upper6Sum = sumArray(boltonInputs.upper6);
  const lower6Sum = sumArray(boltonInputs.lower6);
  const upper12Sum = sumArray(boltonInputs.upper12);
  const lower12Sum = sumArray(boltonInputs.lower12);

  const bolton6Result =
    upper6Sum > 0 ? ((lower6Sum / upper6Sum) * 100).toFixed(1) : "";
  const bolton12Result =
    upper12Sum > 0 ? ((lower12Sum / upper12Sum) * 100).toFixed(1) : "";

  const updateHowes = (field: keyof HowesInputs, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setHowesInputs((prev) => ({ ...prev, [field]: cleaned }));
  };

  const pmbawNum = parseOrZero(howesInputs.pmbaw);
  const tmNum = parseOrZero(howesInputs.tm);
  const howesResult =
    tmNum > 0 ? ((pmbawNum / tmNum) * 100).toFixed(1) : "";

  const getHowesCategory = () => {
    const v = Number.parseFloat(howesResult || "");
    if (!howesResult || Number.isNaN(v)) return { label: "", color: "" };
    if (v < 37)
      return {
        label: "< 37% — Суурь яс дутмаг → шүд авах магадлал өндөр",
        color: "#b91c1c",
      };
    if (v > 44)
      return {
        label: "> 44% — Суурь өргөн их → шүд авахгүй байх нь тохиромжтой",
        color: "#16a34a",
      };
    return {
      label: "37–44% — Хэвийн / завсрын бүс",
      color: "#f97316",
    };
  };

  const howesCategory = getHowesCategory();

  type AxisKey =
    | "ald"
    | "midline"
    | "curveOfSpee"
    | "expansion"
    | "fmiaABPlane"
    | "overjet"
    | "total";

  const updateDiscrepancy = (
    axis: Exclude<AxisKey, "total">,
    pos: keyof DiscrepancyAxis,
    value: string
  ) => {
    const cleaned = value.replace(/[^0-9.+-]/g, "");
    setDiscrepancyInputs((prev) => ({
      ...prev,
      [axis]: {
        ...prev[axis],
        [pos]: cleaned,
      },
    }));
  };

  const valueAt = (ax: DiscrepancyAxis, pos: keyof DiscrepancyAxis): number =>
    parseOrZero(ax[pos]);

  const ald = discrepancyInputs.ald;
  const midline = discrepancyInputs.midline;
  const curveOfSpee = discrepancyInputs.curveOfSpee;
  const expansion = discrepancyInputs.expansion;
  const fmia = discrepancyInputs.fmiaABPlane;
  const overjet = discrepancyInputs.overjet;

  const totalAxis: DiscrepancyAxis = {
    upperLeft: (
      valueAt(ald, "upperLeft") +
      valueAt(midline, "upperLeft") +
      valueAt(curveOfSpee, "upperLeft") +
      valueAt(expansion, "upperLeft") +
      valueAt(fmia, "upperLeft") +
      valueAt(overjet, "upperLeft")
    ).toFixed(2),
    upperRight: (
      valueAt(ald, "upperRight") +
      valueAt(midline, "upperRight") +
      valueAt(curveOfSpee, "upperRight") +
      valueAt(expansion, "upperRight") +
      valueAt(fmia, "upperRight") +
      valueAt(overjet, "upperRight")
    ).toFixed(2),
    lowerLeft: (
      valueAt(ald, "lowerLeft") +
      valueAt(midline, "lowerLeft") +
      valueAt(curveOfSpee, "lowerLeft") +
      valueAt(expansion, "lowerLeft") +
      valueAt(fmia, "lowerLeft") +
      valueAt(overjet, "lowerLeft")
    ).toFixed(2),
    lowerRight: (
      valueAt(ald, "lowerRight") +
      valueAt(midline, "lowerRight") +
      valueAt(curveOfSpee, "lowerRight") +
      valueAt(expansion, "lowerRight") +
      valueAt(fmia, "lowerRight") +
      valueAt(overjet, "lowerRight")
    ).toFixed(2),
  };

  const toggleHabitBool = (field: keyof HabitSection) =>
    setHabits((prev) => ({ ...prev, [field]: !prev[field] }));

  const updateHabitText = (field: keyof HabitSection, value: string) =>
    setHabits((prev) => ({ ...prev, [field]: value }));

  const toggleAttachmentBool = (field: keyof AttachmentSection) =>
    setAttachment((prev) => ({ ...prev, [field]: !prev[field] }));

  const toggleTmjBool = (field: keyof TmjSection) =>
    setTmj((prev) => ({ ...prev, [field]: !prev[field] }));

  const updateTmjText = (field: keyof TmjSection, value: string) =>
    setTmj((prev) => ({ ...prev, [field]: value }));

  const toggleUttsBool = (field: keyof UttsSection) =>
    setUtts((prev) => ({ ...prev, [field]: !prev[field] }));

  const updateUttsText = (field: keyof UttsSection, value: string) =>
    setUtts((prev) => ({ ...prev, [field]: value }));

  const toggleLipBool = (field: keyof LipSection) =>
    setLip((prev) => ({ ...prev, [field]: !prev[field] }));

  const updateLipText = (field: keyof LipSection, value: string) =>
    setLip((prev) => ({ ...prev, [field]: value }));
  const toggleTeethBool = (field: keyof TeethSection) =>
    setTeeth((prev) => ({ ...prev, [field]: !prev[field] }));

  const updateProblemRow = (
    key: ProblemRowKey,
    field: keyof ProblemListRow,
    value: boolean | string
  ) => {
    setProblemSection((prev) => ({
      ...prev,
      rows: {
        ...prev.rows,
        [key]: {
          ...(prev.rows?.[key] ||
  { plus: false, minus: false, comment: "", problem: "" }),
          [field]: value,
        },
      },
    }));
  };
  
  const updateTeethAxis = (
    field: keyof TeethSection,
    pos: keyof DiscrepancyAxis,
    value: string
  ) => {
    const cleaned = value.replace(/[^0-9.+-]/g, "");
    setTeeth((prev) => ({
      ...prev,
      [field]: {
        ...(prev[field] as DiscrepancyAxis),
        [pos]: cleaned,
      },
    }));
  };

  const toggleArchFormU = (field: keyof TeethSection["archFormU"]) =>
    setTeeth((prev) => ({
      ...prev,
      archFormU: { ...prev.archFormU, [field]: !prev.archFormU?.[field] },
    }));

  const toggleArchFormL = (field: keyof TeethSection["archFormL"]) =>
    setTeeth((prev) => ({
      ...prev,
      archFormL: { ...prev.archFormL, [field]: !prev.archFormL?.[field] },
    }));

  const setTeethClass = (
    field:
      | "molarRelationRight"
      | "molarRelationLeft"
      | "canineRelationRight"
      | "canineRelationLeft",
    value: "I" | "II" | "III"
  ) =>
    setTeeth((prev) => ({
      ...prev,
      [field]: prev[field] === value ? "" : value,
    }));
  useEffect(() => {
    if (!bn) return;

    const load = async () => {
      setLoading(true);
      setError("");
      setInfo("");

      try {
        const res = await fetch(
          `/api/patients/ortho-card/by-book/${encodeURIComponent(bn)}`
        );
        const json = (await res
          .json()
          .catch(() => null)) as OrthoCardApiResponse | null;

        if (!res.ok) {
          throw new Error(
            (json && (json as any).error) ||
              "Гажиг заслын карт ачаалахад алдаа гарлаа."
          );
        }

        if (!json || !json.patientBook) {
          throw new Error("Картын мэдээлэл олдсонгүй.");
        }

        setPatientBookId(json.patientBook.id);

        if (json.patient) {
          const { ovog, name, regNo, age, gender, phone, address } =
            json.patient;

          if (name) {
            const trimmedOvog = (ovog || "").trim();
            const display =
              trimmedOvog && trimmedOvog !== "null"
                ? `${trimmedOvog.charAt(0).toUpperCase()}.${name}`
                : name;
            setPatientNameHeader(display);
          }

          setPatientRegNo(regNo || "");
          setPatientAge(
            age != null && !Number.isNaN(Number(age)) ? String(age) : ""
          );
          setPatientGender(gender || "");
          setPatientPhone(phone || "");
          setPatientAddress(address || "");
        }

        if (json.orthoCard && json.orthoCard.data) {
          const data = json.orthoCard.data;
          setCardPatientName(data.patientName || "");
          setCardNotes(data.notes || "");

          const note = data.supernumeraryNote || "";
          setSupernumeraryNote(note);
          setExtraToothText(note);

          setToothChart(data.toothChart || []);
          setSumOfIncisorInputs(
            data.sumOfIncisorInputs || {
              u12: "",
              u11: "",
              u21: "",
              u22: "",
              l32: "",
              l31: "",
              l41: "",
              l42: "",
            }
          );
          if (data.boltonInputs) {
            const bi = data.boltonInputs;
            setBoltonInputs({
              upper6: bi.upper6?.length === 6 ? bi.upper6 : Array(6).fill(""),
              lower6: bi.lower6?.length === 6 ? bi.lower6 : Array(6).fill(""),
              upper12:
                bi.upper12?.length === 12 ? bi.upper12 : Array(12).fill(""),
              lower12:
                bi.lower12?.length === 12 ? bi.lower12 : Array(12).fill(""),
            });
          } else {
            setBoltonInputs(emptyBoltonInputs());
          }
          if (data.howesInputs) {
            setHowesInputs({
              pmbaw: data.howesInputs.pmbaw || "",
              tm: data.howesInputs.tm || "",
            });
          } else {
            setHowesInputs({ pmbaw: "", tm: "" });
          }
          if (data.discrepancyInputs) {
            const di = data.discrepancyInputs;
            setDiscrepancyInputs({
              ald: di.ald || emptyAxis(),
              midline: di.midline || emptyAxis(),
              curveOfSpee: di.curveOfSpee || emptyAxis(),
              expansion: di.expansion || emptyAxis(),
              fmiaABPlane: di.fmiaABPlane || emptyAxis(),
              overjet: di.overjet || emptyAxis(),
              total: di.total || emptyAxis(),
            });
          } else {
            setDiscrepancyInputs(emptyDiscrepancyInputs());
          }

          if (data.survey) {
            setSurvey({
              mainReason: data.survey.mainReason || "",
              currentComplaint: data.survey.currentComplaint || "",
              medicalHistory: data.survey.medicalHistory || "",
              orthoTreatment: data.survey.orthoTreatment || "",
              familyHistory: data.survey.familyHistory || "",
              allergyPlant: !!data.survey.allergyPlant,
              allergyMetal: !!data.survey.allergyMetal,
              allergyDrug: !!data.survey.allergyDrug,
              allergyFood: !!data.survey.allergyFood,
              allergyPlastic: !!data.survey.allergyPlastic,
              allergyOther: !!data.survey.allergyOther,
              allergyOtherText: data.survey.allergyOtherText || "",
              hbv: !!data.survey.hbv,
              hbc: !!data.survey.hbc,
              hiv: !!data.survey.hiv,
            });
          } else {
            setSurvey({
              mainReason: "",
              currentComplaint: "",
              medicalHistory: "",
              orthoTreatment: "",
              familyHistory: "",
              allergyPlant: false,
              allergyMetal: false,
              allergyDrug: false,
              allergyFood: false,
              allergyPlastic: false,
              allergyOther: false,
              allergyOtherText: "",
              hbv: false,
              hbc: false,
              hiv: false,
            });
          }

          if (data.physicalExam) {
            setPhysicalExam({
              weight: data.physicalExam.weight || "",
              height: data.physicalExam.height || "",
              boneAge: data.physicalExam.boneAge || "",
              dentalAge: data.physicalExam.dentalAge || "",
              growthSpurtNormal: !!data.physicalExam.growthSpurtNormal,
              growthSpurtAbnormal: !!data.physicalExam.growthSpurtAbnormal,
              growthSpurtBefore: !!data.physicalExam.growthSpurtBefore,
              growthSpurtMiddle: !!data.physicalExam.growthSpurtMiddle,
              growthSpurtAfter: !!data.physicalExam.growthSpurtAfter,
              patternVertical: !!data.physicalExam.patternVertical,
              patternHorizontal: !!data.physicalExam.patternHorizontal,
              patternClockwise: !!data.physicalExam.patternClockwise,
              patternCounterclockwise:
                !!data.physicalExam.patternCounterclockwise,
            });
          } else {
            setPhysicalExam({
              weight: "",
              height: "",
              boneAge: "",
              dentalAge: "",
              growthSpurtNormal: false,
              growthSpurtAbnormal: false,
              growthSpurtBefore: false,
              growthSpurtMiddle: false,
              growthSpurtAfter: false,
              patternVertical: false,
              patternHorizontal: false,
              patternClockwise: false,
              patternCounterclockwise: false,
            });
          }

          if (data.habits) {
            setHabits({
              tongueThrust: !!data.habits.tongueThrust,
              lipNailBite: !!data.habits.lipNailBite,
              fingerSucking: !!data.habits.fingerSucking,
              breathingMouth: !!data.habits.breathingMouth,
              breathingNose: !!data.habits.breathingNose,
              swallowNormal: !!data.habits.swallowNormal,
              swallowAbnormal: !!data.habits.swallowAbnormal,
              other: data.habits.other || "",
            });
          } else {
            setHabits({
              tongueThrust: false,
              lipNailBite: false,
              fingerSucking: false,
              breathingMouth: false,
              breathingNose: false,
              swallowNormal: false,
              swallowAbnormal: false,
              other: "",
            });
          }

          if (data.attachment) {
            setAttachment({
              aheaGood: !!data.attachment.aheaGood,
              aheaMedium: !!data.attachment.aheaMedium,
              aheaPoor: !!data.attachment.aheaPoor,
              gingivitis: !!data.attachment.gingivitis,
              gingivitisNo: !!data.attachment.gingivitisNo,
              frenumInflammation: !!data.attachment.frenumInflammation,
              frenumInflammationNo: !!data.attachment.frenumInflammationNo,
            });
          } else {
            setAttachment({
              aheaGood: false,
              aheaMedium: false,
              aheaPoor: false,
              gingivitis: false,
              gingivitisNo: false,
              frenumInflammation: false,
              frenumInflammationNo: false,
            });
          }

          if (data.tmj) {
            setTmj({
              previousPainYes: !!data.tmj.previousPainYes,
              previousPainNo: !!data.tmj.previousPainNo,
              asymptomatic: !!data.tmj.asymptomatic,
              symptomatic: !!data.tmj.symptomatic,
              soundRight: !!data.tmj.soundRight,
              soundLeft: !!data.tmj.soundLeft,
              painRight: !!data.tmj.painRight,
              painLeft: !!data.tmj.painLeft,
              headacheYes: !!data.tmj.headacheYes,
              headacheNo: !!data.tmj.headacheNo,
              muscleTensionYes: !!data.tmj.muscleTensionYes,
              muscleTensionNo: !!data.tmj.muscleTensionNo,
              mouthOpeningNormal: !!data.tmj.mouthOpeningNormal,
              mouthOpeningLimited: !!data.tmj.mouthOpeningLimited,
              maxMouthOpeningMm: data.tmj.maxMouthOpeningMm || "",
            });
          } else {
            setTmj({
              previousPainYes: false,
              previousPainNo: false,
              asymptomatic: false,
              symptomatic: false,
              soundRight: false,
              soundLeft: false,
              painRight: false,
              painLeft: false,
              headacheYes: false,
              headacheNo: false,
              muscleTensionYes: false,
              muscleTensionNo: false,
              mouthOpeningNormal: false,
              mouthOpeningLimited: false,
              maxMouthOpeningMm: "",
            });
          }

          if (data.utts) {
            setUtts({
              lipCleft: !!data.utts.lipCleft,
              palateCleft: !!data.utts.palateCleft,
              unilateral: !!data.utts.unilateral,
              unilateralSide: data.utts.unilateralSide || "",
              bilateral: !!data.utts.bilateral,
              other: !!data.utts.other,
              otherText: data.utts.otherText || "",
            });
          } else {
            setUtts({
              lipCleft: false,
              palateCleft: false,
              unilateral: false,
              unilateralSide: "",
              bilateral: false,
              other: false,
              otherText: "",
            });
          }

          if (data.lip) {
            setLip({
              closed: !!data.lip.closed,
              open: !!data.lip.open,
              restLipMm: data.lip.restLipMm || "",
              smilingMm: data.lip.smilingMm || "",
            });
          } else {
            setLip({
              closed: false,
              open: false,
              restLipMm: "",
              smilingMm: "",
            });
          }

          if (data.teeth) {
            setTeeth({
              overbiteDeep: !!data.teeth.overbiteDeep,
              overbiteOpen: !!data.teeth.overbiteOpen,
              overjetEdgeToEdge: !!data.teeth.overjetEdgeToEdge,
              overjetPositive: !!data.teeth.overjetPositive,
              overjetNegative: !!data.teeth.overjetNegative,
              curveOfSpee: data.teeth.curveOfSpee || emptyAxis(),
              crossBite: data.teeth.crossBite || emptyAxis(),
              scissorBite: data.teeth.scissorBite || emptyAxis(),
              diastem: data.teeth.diastem || emptyAxis(),
              midline: data.teeth.midline || emptyAxis(),
              archFormU: {
                square: !!data.teeth.archFormU?.square,
                parabola: !!data.teeth.archFormU?.parabola,
                round: !!data.teeth.archFormU?.round,
                vShape: !!data.teeth.archFormU?.vShape,
              },
              archFormL: {
                square: !!data.teeth.archFormL?.square,
                parabola: !!data.teeth.archFormL?.parabola,
                round: !!data.teeth.archFormL?.round,
                vShape: !!data.teeth.archFormL?.vShape,
              },
              molarRelationRight: data.teeth.molarRelationRight || "",
              molarRelationLeft: data.teeth.molarRelationLeft || "",
              canineRelationRight: data.teeth.canineRelationRight || "",
              canineRelationLeft: data.teeth.canineRelationLeft || "",
            });
          } else {
            setTeeth({
              overbiteDeep: false,
              overbiteOpen: false,
              overjetEdgeToEdge: false,
              overjetPositive: false,
              overjetNegative: false,
              curveOfSpee: emptyAxis(),
              crossBite: emptyAxis(),
              scissorBite: emptyAxis(),
              diastem: emptyAxis(),
              midline: emptyAxis(),
              archFormU: {
                square: false,
                parabola: false,
                round: false,
                vShape: false,
              },
              archFormL: {
                square: false,
                parabola: false,
                round: false,
                vShape: false,
              },
              molarRelationRight: "",
              molarRelationLeft: "",
              canineRelationRight: "",
              canineRelationLeft: "",
            });
          }
                if (data.problemSection && data.problemSection.rows) {
            const r = data.problemSection.rows;
                        setProblemSection({
              rows: {
                boneAngle:
                  r.boneAngle || { plus: false, minus: false, comment: "", problem: "" },
                boneStep:
                  r.boneStep || { plus: false, minus: false, comment: "", problem: "" },
                tooth:
                  r.tooth || { plus: false, minus: false, comment: "", problem: "" },
                toothPosition:
                  r.toothPosition ||
                  { plus: false, minus: false, comment: "", problem: "" },
                functional:
                  r.functional || { plus: false, minus: false, comment: "", problem: "" },
                badHabit:
                  r.badHabit || { plus: false, minus: false, comment: "", problem: "" },
              },
              diagnosis: data.problemSection.diagnosis || "",
              cause: data.problemSection.cause || "",
              treatmentGoals:
                data.problemSection.treatmentGoals &&
                data.problemSection.treatmentGoals.length > 0
                  ? data.problemSection.treatmentGoals
                  : ["", "", "", "", "", ""],
            });
                              } else {
            setProblemSection({
              rows: {
                boneAngle: { plus: false, minus: false, comment: "", problem: "" },
                boneStep: { plus: false, minus: false, comment: "", problem: "" },
                tooth: { plus: false, minus: false, comment: "", problem: "" },
                toothPosition: { plus: false, minus: false, comment: "", problem: "" },
                functional: { plus: false, minus: false, comment: "", problem: "" },
                badHabit: { plus: false, minus: false, comment: "", problem: "" },
              },
              diagnosis: "",
              cause: "",
              treatmentGoals: ["", "", "", "", "", ""],
            });
          }   
        } if (data.treatmentPlan) {
  setTreatmentPlan({
    orthodontic: !!data.treatmentPlan.orthodontic,
    growthModification: !!data.treatmentPlan.growthModification,
    combinedSurgery: !!data.treatmentPlan.combinedSurgery,
    phaseI: {
      plan: data.treatmentPlan.phaseI?.plan || "",
      note: data.treatmentPlan.phaseI?.note || "",
    },
    phaseII: {
      plan: data.treatmentPlan.phaseII?.plan || "",
      note: data.treatmentPlan.phaseII?.note || "",
    },
    phaseIII: {
      plan: data.treatmentPlan.phaseIII?.plan || "",
      note: data.treatmentPlan.phaseIII?.note || "",
    },
  });
} else {
  setTreatmentPlan({
    orthodontic: false,
    growthModification: false,
    combinedSurgery: false,
    phaseI: { plan: "", note: "" },
    phaseII: { plan: "", note: "" },
    phaseIII: { plan: "", note: "" },
  });
}else {
          setCardPatientName("");
          setCardNotes("");
          setSupernumeraryNote("");
          setExtraToothText("");
          setToothChart([]);
          setSumOfIncisorInputs({
            u12: "",
            u11: "",
            u21: "",
            u22: "",
            l32: "",
            l31: "",
            l41: "",
            l42: "",
          });
          setBoltonInputs(emptyBoltonInputs());
          setHowesInputs({ pmbaw: "", tm: "" });
          setDiscrepancyInputs(emptyDiscrepancyInputs());
          setSurvey({
            mainReason: "",
            currentComplaint: "",
            medicalHistory: "",
            orthoTreatment: "",
            familyHistory: "",
            allergyPlant: false,
            allergyMetal: false,
            allergyDrug: false,
            allergyFood: false,
            allergyPlastic: false,
            allergyOther: false,
            allergyOtherText: "",
            hbv: false,
            hbc: false,
            hiv: false,
          });
          setPhysicalExam({
            weight: "",
            height: "",
            boneAge: "",
            dentalAge: "",
            growthSpurtNormal: false,
            growthSpurtAbnormal: false,
            growthSpurtBefore: false,
            growthSpurtMiddle: false,
            growthSpurtAfter: false,
            patternVertical: false,
            patternHorizontal: false,
            patternClockwise: false,
            patternCounterclockwise: false,
          });
          setHabits({
            tongueThrust: false,
            lipNailBite: false,
            fingerSucking: false,
            breathingMouth: false,
            breathingNose: false,
            swallowNormal: false,
            swallowAbnormal: false,
            other: "",
          });
          setAttachment({
            aheaGood: false,
            aheaMedium: false,
            aheaPoor: false,
            gingivitis: false,
            gingivitisNo: false,
            frenumInflammation: false,
            frenumInflammationNo: false,
          });
          setTmj({
            previousPainYes: false,
            previousPainNo: false,
            asymptomatic: false,
            symptomatic: false,
            soundRight: false,
            soundLeft: false,
            painRight: false,
            painLeft: false,
            headacheYes: false,
            headacheNo: false,
            muscleTensionYes: false,
            muscleTensionNo: false,
            mouthOpeningNormal: false,
            mouthOpeningLimited: false,
            maxMouthOpeningMm: "",
          });
          setUtts({
            lipCleft: false,
            palateCleft: false,
            unilateral: false,
            unilateralSide: "",
            bilateral: false,
            other: false,
            otherText: "",
          });
          setLip({
            closed: false,
            open: false,
            restLipMm: "",
            smilingMm: "",
          });
          
        }
      } catch (err: any) {
        console.error("load ortho card failed", err);
        setError(
          err?.message || "Гажиг заслын карт ачаалахад алдаа гарлаа."
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [bn]);

  const handleSave = async () => {
    if (!patientBookId) {
      setError("PatientBook ID олдсонгүй.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");

    try {
      const discrepancyWithTotal: DiscrepancyInputs = {
        ...discrepancyInputs,
        total: totalAxis,
      };

      const payload: OrthoCardData = {
        patientName: cardPatientName || undefined,
        notes: cardNotes || undefined,
        toothChart,
        supernumeraryNote: extraToothText || undefined,
        sumOfIncisorInputs,
        boltonInputs,
        howesInputs,
        discrepancyInputs: discrepancyWithTotal,
        survey,
        physicalExam,
        habits,
        attachment,
        tmj,
        utts,
        lip,
        teeth, // NEW
        problemSection, // NEW
      };

      const res = await fetch(`/api/patients/ortho-card/${patientBookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          (json && json.error) ||
            "Гажиг заслын карт хадгалахад алдаа гарлаа."
        );
      }

      setInfo("Гажиг заслын карт амжилттай хадгалагдлаа.");
    } catch (err: any) {
      console.error("save ortho card failed", err);
      setError(
        err?.message || "Гажиг заслын карт хадгалахад алдаа гарлаа."
      );
    } finally {
      setSaving(false);
    }
  };

  const uniformInputStyle: React.CSSProperties = {
    width: 68,
    borderRadius: 4,
    border: "1px solid #d1d5db",
    padding: "2px 4px",
    fontSize: 11,
  };

  const uniformTotalBoxBase: React.CSSProperties = {
    width: 68,
    borderRadius: 4,
    border: "1px solid #d1d5db",
    padding: "2px 4px",
    background: "#f9fafb",
    fontSize: 11,
    fontWeight: 700,
  };

  const renderAxis = (
    axisKey: Exclude<AxisKey, "total">,
    label: string,
    axis: DiscrepancyAxis
  ) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <input
            type="text"
            value={axis.upperLeft}
            onChange={(e) =>
              updateDiscrepancy(axisKey, "upperLeft", e.target.value)
            }
            style={uniformInputStyle}
          />
          <input
            type="text"
            value={axis.upperRight}
            onChange={(e) =>
              updateDiscrepancy(axisKey, "upperRight", e.target.value)
            }
            style={uniformInputStyle}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <input
            type="text"
            value={axis.lowerLeft}
            onChange={(e) =>
              updateDiscrepancy(axisKey, "lowerLeft", e.target.value)
            }
            style={uniformInputStyle}
          />
          <input
            type="text"
            value={axis.lowerRight}
            onChange={(e) =>
              updateDiscrepancy(axisKey, "lowerRight", e.target.value)
            }
            style={uniformInputStyle}
          />
        </div>
      </div>
    </div>
  );

  const Arrow = () => (
    <div
      style={{
        width: 32,
        height: 1,
        background: "#d1d5db",
        position: "relative",
        margin: "0 4px",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 0,
          top: -3,
          width: 0,
          height: 0,
          borderTop: "4px solid transparent",
          borderBottom: "4px solid transparent",
          borderLeft: "6px solid #6b7280",
        }}
      />
    </div>
  );

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (!bookNumber || typeof bookNumber !== "string") {
            router.push("/patients");
            return;
          }
          router.push(`/patients/${encodeURIComponent(bookNumber)}`);
        }}
        style={{
          marginBottom: 16,
          padding: "4px 8px",
          borderRadius: 4,
          border: "1px solid #d1d5db",
          background: "#f9fafb",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        ← Үйлчлүүлэгчийн хэсэг рүү буцах
      </button>

      <h1 style={{ fontSize: 20, marginTop: 0, marginBottom: 8 }}>
        Гажиг заслын үйлчлүүлэгчийн карт
      </h1>

      {/* Patient header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 13,
          color: "#111827",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "baseline",
          }}
        >
          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>
              Картын дугаар:
            </span>
            <span style={{ fontWeight: 600 }}>{bn || "—"}</span>
          </div>

          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>
              Үйлчлүүлэгч:
            </span>
            <span style={{ fontWeight: 600 }}>
              {patientNameHeader || "—"}
            </span>
          </div>

          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>РД:</span>
            <span style={{ fontWeight: 500 }}>{patientRegNo || "—"}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "baseline",
          }}
        >
          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>Нас:</span>
            <span style={{ fontWeight: 500 }}>{patientAge || "—"}</span>
          </div>

          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>Хүйс:</span>
            <span style={{ fontWeight: 500 }}>{patientGender || "—"}</span>
          </div>

          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>Утас:</span>
            <span style={{ fontWeight: 500 }}>{patientPhone || "—"}</span>
          </div>
        </div>

        <div>
          <span style={{ color: "#6b7280", marginRight: 4 }}>Хаяг:</span>
          <span style={{ fontWeight: 500 }}>{patientAddress || "—"}</span>
        </div>
      </div>

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && (
        <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>
          {error}
        </div>
      )}
      {!loading && info && (
        <div style={{ color: "#16a34a", fontSize: 13, marginBottom: 8 }}>
          {info}
        </div>
      )}

      {!loading && !error && (
        <section
          style={{
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: 16,
            background: "white",
          }}
        >
                    {/* АСУУМЖ */}
          <section
            style={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 12,
              background: "#ffffff",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>АСУУМЖ</div>

            <div style={{ marginBottom: 6 }}>
              <div style={{ marginBottom: 2 }}>
                1. Гол шалтгаан / ирсэн шалтгаан
              </div>
              <textarea
                value={survey.mainReason || ""}
                onChange={(e) =>
                  setSurvey((prev) => ({
                    ...prev,
                    mainReason: e.target.value,
                  }))
                }
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

            <div style={{ marginBottom: 6 }}>
              <div style={{ marginBottom: 2 }}>2. Одоогийн зовуурь</div>
              <textarea
                value={survey.currentComplaint || ""}
                onChange={(e) =>
                  setSurvey((prev) => ({
                    ...prev,
                    currentComplaint: e.target.value,
                  }))
                }
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

            <div style={{ marginBottom: 6 }}>
              <div style={{ marginBottom: 2 }}>3. Өвчний түүх</div>
              <textarea
                value={survey.medicalHistory || ""}
                onChange={(e) =>
                  setSurvey((prev) => ({
                    ...prev,
                    medicalHistory: e.target.value,
                  }))
                }
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

            <div style={{ marginBottom: 6 }}>
              <div style={{ marginBottom: 2 }}>
                4. Өмнөх гажиг заслын эмчилгээ
              </div>
              <textarea
                value={survey.orthoTreatment || ""}
                onChange={(e) =>
                  setSurvey((prev) => ({
                    ...prev,
                    orthoTreatment: e.target.value,
                  }))
                }
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

            <div style={{ marginBottom: 6 }}>
              <div style={{ marginBottom: 2 }}>5. Удамшлын өгүүлэмж</div>
              <textarea
                value={survey.familyHistory || ""}
                onChange={(e) =>
                  setSurvey((prev) => ({
                    ...prev,
                    familyHistory: e.target.value,
                  }))
                }
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

            <div style={{ marginTop: 8, marginBottom: 4 }}>
              <span style={{ display: "inline-block", width: 90 }}>
                Харшил:
              </span>
              <label style={{ marginRight: 8 }}>
                <input
                  type="checkbox"
                  checked={!!survey.allergyPlant}
                  onChange={() =>
                    setSurvey((prev) => ({
                      ...prev,
                      allergyPlant: !prev.allergyPlant,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Ургамал
              </label>
              <label style={{ marginRight: 8 }}>
                <input
                  type="checkbox"
                  checked={!!survey.allergyMetal}
                  onChange={() =>
                    setSurvey((prev) => ({
                      ...prev,
                      allergyMetal: !prev.allergyMetal,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Металл
              </label>
              <label style={{ marginRight: 8 }}>
                <input
                  type="checkbox"
                  checked={!!survey.allergyDrug}
                  onChange={() =>
                    setSurvey((prev) => ({
                      ...prev,
                      allergyDrug: !prev.allergyDrug,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Эм
              </label>
              <label style={{ marginRight: 8 }}>
                <input
                  type="checkbox"
                  checked={!!survey.allergyFood}
                  onChange={() =>
                    setSurvey((prev) => ({
                      ...prev,
                      allergyFood: !prev.allergyFood,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Хоол
              </label>
              <label style={{ marginRight: 8 }}>
                <input
                  type="checkbox"
                  checked={!!survey.allergyPlastic}
                  onChange={() =>
                    setSurvey((prev) => ({
                      ...prev,
                      allergyPlastic: !prev.allergyPlastic,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Пластик
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!survey.allergyOther}
                  onChange={() =>
                    setSurvey((prev) => ({
                      ...prev,
                      allergyOther: !prev.allergyOther,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Бусад
              </label>
            </div>

            <div style={{ marginBottom: 6 }}>
              <span style={{ display: "inline-block", width: 90 }}>
                Бусад харшил:
              </span>
              <input
                type="text"
                value={survey.allergyOtherText || ""}
                onChange={(e) =>
                  setSurvey((prev) => ({
                    ...prev,
                    allergyOtherText: e.target.value,
                  }))
                }
                style={{
                  width: "60%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "3px 6px",
                  fontSize: 12,
                }}
              />
            </div>

            <div>
              <span style={{ display: "inline-block", width: 90 }}>
                Халдварт:
              </span>
              <label style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={!!survey.hbv}
                  onChange={() =>
                    setSurvey((prev) => ({ ...prev, hbv: !prev.hbv }))
                  }
                  style={{ marginRight: 4 }}
                />
                HBV
              </label>
              <label style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={!!survey.hbc}
                  onChange={() =>
                    setSurvey((prev) => ({ ...prev, hbc: !prev.hbc }))
                  }
                  style={{ marginRight: 4 }}
                />
                HBC
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!survey.hiv}
                  onChange={() =>
                    setSurvey((prev) => ({ ...prev, hiv: !prev.hiv }))
                  }
                  style={{ marginRight: 4 }}
                />
                HIV
              </label>
            </div>
          </section>

              {/* БОДИТ ҮЗЛЭГ */}
          <section
            style={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 12,
              background: "#ffffff",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              БОДИТ ҮЗЛЭГ
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div>
                <span style={{ marginRight: 4 }}>Жин:</span>
                <input
                  type="text"
                  value={physicalExam.weight || ""}
                  onChange={(e) =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      weight: e.target.value,
                    }))
                  }
                  style={{
                    width: 70,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                    marginRight: 4,
                  }}
                />
                кг
              </div>
              <div>
                <span style={{ marginRight: 4 }}>Өндөр:</span>
                <input
                  type="text"
                  value={physicalExam.height || ""}
                  onChange={(e) =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      height: e.target.value,
                    }))
                  }
                  style={{
                    width: 70,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                    marginRight: 4,
                  }}
                />
                см
              </div>
              <div>
                <span style={{ marginRight: 4 }}>Ясны нас:</span>
                <input
                  type="text"
                  value={physicalExam.boneAge || ""}
                  onChange={(e) =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      boneAge: e.target.value,
                    }))
                  }
                  style={{
                    width: 70,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                  }}
                />
              </div>
              <div>
                <span style={{ marginRight: 4 }}>Шүдний нас:</span>
                <input
                  type="text"
                  value={physicalExam.dentalAge || ""}
                  onChange={(e) =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      dentalAge: e.target.value,
                    }))
                  }
                  style={{
                    width: 70,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 4 }}>
              <span style={{ width: 120, display: "inline-block" }}>
                Growth spurt:
              </span>
              <label style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={!!physicalExam.growthSpurtNormal}
                  onChange={() =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      growthSpurtNormal: !prev.growthSpurtNormal,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Хэвийн
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!physicalExam.growthSpurtAbnormal}
                  onChange={() =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      growthSpurtAbnormal: !prev.growthSpurtAbnormal,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Хэвийн бус
              </label>
            </div>

            <div style={{ marginBottom: 4 }}>
              <span style={{ width: 120, display: "inline-block" }}>
                Growth period:
              </span>
              <label style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={!!physicalExam.growthSpurtBefore}
                  onChange={() =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      growthSpurtBefore: !prev.growthSpurtBefore,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Өмнө
              </label>
              <label style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={!!physicalExam.growthSpurtMiddle}
                  onChange={() =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      growthSpurtMiddle: !prev.growthSpurtMiddle,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Дунд
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!physicalExam.growthSpurtAfter}
                  onChange={() =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      growthSpurtAfter: !prev.growthSpurtAfter,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Дараа
              </label>
            </div>

            <div>
              <span style={{ width: 120, display: "inline-block" }}>
                Growth pattern:
              </span>
              <label style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={!!physicalExam.patternVertical}
                  onChange={() =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      patternVertical: !prev.patternVertical,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Босоо
              </label>
              <label style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={!!physicalExam.patternHorizontal}
                  onChange={() =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      patternHorizontal: !prev.patternHorizontal,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                Хэвтээ
              </label>
              <label style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={!!physicalExam.patternClockwise}
                  onChange={() =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      patternClockwise: !prev.patternClockwise,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                CW
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!physicalExam.patternCounterclockwise}
                  onChange={() =>
                    setPhysicalExam((prev) => ({
                      ...prev,
                      patternCounterclockwise:
                        !prev.patternCounterclockwise,
                    }))
                  }
                  style={{ marginRight: 4 }}
                />
                CCW
              </label>
            </div>
          </section>
          {/* ЗУРШИЛ, ХОЛБООС, ЭРҮҮНИЙ ҮЕ, УТТС, УРУУЛ */}
          <section
            style={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 12,
              background: "#ffffff",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {/* ЗУРШИЛ */}
            <div style={{ fontWeight: 700, marginBottom: 4 }}>ЗУРШИЛ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <span style={{ width: 90, display: "inline-block" }}>
                  Зуршил:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!habits.tongueThrust}
                    onChange={() => toggleHabitBool("tongueThrust")}
                    style={{ marginRight: 4 }}
                  />
                  Хэлээр түлхэх
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!habits.lipNailBite}
                    onChange={() => toggleHabitBool("lipNailBite")}
                    style={{ marginRight: 4 }}
                  />
                  Уруул, хумс мэрэх
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!habits.fingerSucking}
                    onChange={() => toggleHabitBool("fingerSucking")}
                    style={{ marginRight: 4 }}
                  />
                  Хуруу хөхөх
                </label>
              </div>

              <div>
                <span style={{ width: 90, display: "inline-block" }}>
                  Амьсгалалт:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!habits.breathingMouth}
                    onChange={() => toggleHabitBool("breathingMouth")}
                    style={{ marginRight: 4 }}
                  />
                  Амаар
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!habits.breathingNose}
                    onChange={() => toggleHabitBool("breathingNose")}
                    style={{ marginRight: 4 }}
                  />
                  Хамраар
                </label>
              </div>

              <div>
                <span style={{ width: 90, display: "inline-block" }}>
                  Залгилт:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!habits.swallowNormal}
                    onChange={() => toggleHabitBool("swallowNormal")}
                    style={{ marginRight: 4 }}
                  />
                  Хэвийн
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!habits.swallowAbnormal}
                    onChange={() => toggleHabitBool("swallowAbnormal")}
                    style={{ marginRight: 4 }}
                  />
                  Хэвийн бус
                </label>
              </div>

              <div>
                <span style={{ width: 90, display: "inline-block" }}>
                  Бусад:
                </span>
                <input
                  type="text"
                  value={habits.other || ""}
                  onChange={(e) => updateHabitText("other", e.target.value)}
                  style={{
                    width: "60%",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "3px 6px",
                  }}
                />
              </div>
            </div>

            {/* ХОЛБООС */}
            <div
              style={{
                fontWeight: 700,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              ХОЛБООС
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <span style={{ width: 90, display: "inline-block" }}>
                  АХЭА:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!attachment.aheaGood}
                    onChange={() => toggleAttachmentBool("aheaGood")}
                    style={{ marginRight: 4 }}
                  />
                  Сайн
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!attachment.aheaMedium}
                    onChange={() => toggleAttachmentBool("aheaMedium")}
                    style={{ marginRight: 4 }}
                  />
                  Дунд
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!attachment.aheaPoor}
                    onChange={() => toggleAttachmentBool("aheaPoor")}
                    style={{ marginRight: 4 }}
                  />
                  Муу
                </label>
              </div>

              <div>
                <span style={{ width: 130, display: "inline-block" }}>
                  Буйлны үрэвсэл:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!attachment.gingivitis}
                    onChange={() => toggleAttachmentBool("gingivitis")}
                    style={{ marginRight: 4 }}
                  />
                  Тийм
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!attachment.gingivitisNo}
                    onChange={() => toggleAttachmentBool("gingivitisNo")}
                    style={{ marginRight: 4 }}
                  />
                  Үгүй
                </label>
              </div>

              <div>
                <span style={{ width: 130, display: "inline-block" }}>
                  Холбоосын үрэвсэл:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!attachment.frenumInflammation}
                    onChange={() =>
                      toggleAttachmentBool("frenumInflammation")
                    }
                    style={{ marginRight: 4 }}
                  />
                  Тийм
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!attachment.frenumInflammationNo}
                    onChange={() =>
                      toggleAttachmentBool("frenumInflammationNo")
                    }
                    style={{ marginRight: 4 }}
                  />
                  Үгүй
                </label>
              </div>
            </div>

            {/* ЭРҮҮНИЙ ҮЕ */}
            <div
              style={{
                fontWeight: 700,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              ЭРҮҮНИЙ ҮЕ
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <span style={{ width: 190, display: "inline-block" }}>
                  Өмнө өвдөж байсан эсэх:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.previousPainYes}
                    onChange={() => toggleTmjBool("previousPainYes")}
                    style={{ marginRight: 4 }}
                  />
                  Тийм
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.previousPainNo}
                    onChange={() => toggleTmjBool("previousPainNo")}
                    style={{ marginRight: 4 }}
                  />
                  Үгүй
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.asymptomatic}
                    onChange={() => toggleTmjBool("asymptomatic")}
                    style={{ marginRight: 4 }}
                  />
                  Asymptomatic
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!tmj.symptomatic}
                    onChange={() => toggleTmjBool("symptomatic")}
                    style={{ marginRight: 4 }}
                  />
                  Symptomatic
                </label>
              </div>

              <div>
                <span style={{ width: 60, display: "inline-block" }}>
                  Дуу:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.soundRight}
                    onChange={() => toggleTmjBool("soundRight")}
                    style={{ marginRight: 4 }}
                  />
                  Баруун
                </label>
                <label style={{ marginRight: 32 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.soundLeft}
                    onChange={() => toggleTmjBool("soundLeft")}
                    style={{ marginRight: 4 }}
                  />
                  Зүүн
                </label>

                <span style={{ width: 80, display: "inline-block" }}>
                  Өвдөлт:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.painRight}
                    onChange={() => toggleTmjBool("painRight")}
                    style={{ marginRight: 4 }}
                  />
                  Баруун
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!tmj.painLeft}
                    onChange={() => toggleTmjBool("painLeft")}
                    style={{ marginRight: 4 }}
                  />
                  Зүүн
                </label>
              </div>

              <div>
                <span style={{ width: 120, display: "inline-block" }}>
                  Толгой өвдөлт:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.headacheYes}
                    onChange={() => toggleTmjBool("headacheYes")}
                    style={{ marginRight: 4 }}
                  />
                  Тийм
                </label>
                <label style={{ marginRight: 32 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.headacheNo}
                    onChange={() => toggleTmjBool("headacheNo")}
                    style={{ marginRight: 4 }}
                  />
                  Үгүй
                </label>

                <span style={{ width: 150, display: "inline-block" }}>
                  Булчингийн чангарал:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.muscleTensionYes}
                    onChange={() => toggleTmjBool("muscleTensionYes")}
                    style={{ marginRight: 4 }}
                  />
                  Тийм
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!tmj.muscleTensionNo}
                    onChange={() => toggleTmjBool("muscleTensionNo")}
                    style={{ marginRight: 4 }}
                  />
                  Үгүй
                </label>
              </div>

              <div>
                <span style={{ width: 120, display: "inline-block" }}>
                  Ам ангайллт:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.mouthOpeningNormal}
                    onChange={() => toggleTmjBool("mouthOpeningNormal")}
                    style={{ marginRight: 4 }}
                  />
                  Хэвийн
                </label>
                <label style={{ marginRight: 32 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.mouthOpeningLimited}
                    onChange={() => toggleTmjBool("mouthOpeningLimited")}
                    style={{ marginRight: 4 }}
                  />
                  Хязгаарлагдсан
                </label>

                <span style={{ width: 150, display: "inline-block" }}>
                  Max. ам ангайллт:
                </span>
                <input
                  type="text"
                  value={tmj.maxMouthOpeningMm || ""}
                  onChange={(e) =>
                    updateTmjText("maxMouthOpeningMm", e.target.value)
                  }
                  style={{
                    width: 70,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                    marginRight: 4,
                  }}
                />
                мм
              </div>
            </div>

            {/* УТТС */}
            <div
              style={{
                fontWeight: 700,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              УТТС
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!utts.lipCleft}
                    onChange={() => toggleUttsBool("lipCleft")}
                    style={{ marginRight: 4 }}
                  />
                  Уруулын сэтэрхий
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!utts.palateCleft}
                    onChange={() => toggleUttsBool("palateCleft")}
                    style={{ marginRight: 4 }}
                  />
                  Тагнайн сэтэрхий
                </label>
                <label style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!utts.unilateral}
                    onChange={() => toggleUttsBool("unilateral")}
                    style={{ marginRight: 4 }}
                  />
                  Нэг талын (Б/З):
                </label>
                <input
                  type="text"
                  value={utts.unilateralSide || ""}
                  onChange={(e) =>
                    updateUttsText("unilateralSide", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                  }}
                />
              </div>

              <div>
                <label style={{ marginRight: 16 }}>
                  <input
                    type="checkbox"
                    checked={!!utts.bilateral}
                    onChange={() => toggleUttsBool("bilateral")}
                    style={{ marginRight: 4 }}
                  />
                  Хоёр талын
                </label>
                <span style={{ marginRight: 4 }}>Бусад</span>
                <input
                  type="text"
                  value={utts.otherText || ""}
                  onChange={(e) =>
                    updateUttsText("otherText", e.target.value)
                  }
                  style={{
                    width: "55%",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            {/* УРУУЛ */}
            <div
              style={{
                fontWeight: 700,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              УРУУЛ
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!lip.closed}
                    onChange={() => toggleLipBool("closed")}
                    style={{ marginRight: 4 }}
                  />
                  Нийлсэн
                </label>
                <label style={{ marginRight: 24 }}>
                  <input
                    type="checkbox"
                    checked={!!lip.open}
                    onChange={() => toggleLipBool("open")}
                    style={{ marginRight: 4 }}
                  />
                  Нийлээгүй
                </label>
                <span style={{ marginRight: 4 }}>rest lip</span>
                <input
                  type="text"
                  value={lip.restLipMm || ""}
                  onChange={(e) =>
                    updateLipText("restLipMm", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                    marginRight: 4,
                  }}
                />
                мм
              </div>
              <div>
                <span style={{ marginRight: 8 }}>smiling</span>
                <input
                  type="text"
                  value={lip.smilingMm || ""}
                  onChange={(e) =>
                    updateLipText("smilingMm", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                    marginRight: 4,
                  }}
                />
                мм
              </div>
            </div>
           
                        {/* ШҮД */}
            <div
              style={{
                fontWeight: 700,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              ШҮД
            </div>

            {/* Overbite & Overjet checkboxes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <span style={{ width: 80, display: "inline-block" }}>
                  Overbite:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!teeth.overbiteDeep}
                    onChange={() => toggleTeethBool("overbiteDeep")}
                    style={{ marginRight: 4 }}
                  />
                  Deep
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!teeth.overbiteOpen}
                    onChange={() => toggleTeethBool("overbiteOpen")}
                    style={{ marginRight: 4 }}
                  />
                  Open
                </label>
              </div>

              <div>
                <span style={{ width: 80, display: "inline-block" }}>
                  Overjet:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!teeth.overjetEdgeToEdge}
                    onChange={() => toggleTeethBool("overjetEdgeToEdge")}
                    style={{ marginRight: 4 }}
                  />
                  Ирмэг ирмэгээр
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!teeth.overjetPositive}
                    onChange={() => toggleTeethBool("overjetPositive")}
                    style={{ marginRight: 4 }}
                  />
                  Позитив
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!teeth.overjetNegative}
                    onChange={() => toggleTeethBool("overjetNegative")}
                    style={{ marginRight: 4 }}
                  />
                  Негатив
                </label>
              </div>
            </div>

            {/* Curve of spee / Cross bite / Scissor bite / Diastem / Голын шугам */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 24,
                alignItems: "flex-start",
                marginTop: 8,
                marginBottom: 8,
              }}
            >
              {/* Curve of spee – we CAN reuse renderAxis here because key exists in AxisKey */}
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>
                  Curve of spee
                </div>
                {renderAxis("curveOfSpee", "", teeth.curveOfSpee)}
              </div>

              {/* Cross bite – custom 4-cell grid using updateTeethAxis */}
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>
                  Cross bite
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={teeth.crossBite.upperLeft}
                      onChange={(e) =>
                        updateTeethAxis("crossBite", "upperLeft", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                    <input
                      type="text"
                      value={teeth.crossBite.upperRight}
                      onChange={(e) =>
                        updateTeethAxis("crossBite", "upperRight", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={teeth.crossBite.lowerLeft}
                      onChange={(e) =>
                        updateTeethAxis("crossBite", "lowerLeft", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                    <input
                      type="text"
                      value={teeth.crossBite.lowerRight}
                      onChange={(e) =>
                        updateTeethAxis("crossBite", "lowerRight", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Scissor bite – custom grid */}
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>
                  Scissor bite
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={teeth.scissorBite.upperLeft}
                      onChange={(e) =>
                        updateTeethAxis("scissorBite", "upperLeft", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                    <input
                      type="text"
                      value={teeth.scissorBite.upperRight}
                      onChange={(e) =>
                        updateTeethAxis("scissorBite", "upperRight", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={teeth.scissorBite.lowerLeft}
                      onChange={(e) =>
                        updateTeethAxis("scissorBite", "lowerLeft", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                    <input
                      type="text"
                      value={teeth.scissorBite.lowerRight}
                      onChange={(e) =>
                        updateTeethAxis("scissorBite", "lowerRight", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Diastem – custom grid */}
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>
                  Diastem
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={teeth.diastem.upperLeft}
                      onChange={(e) =>
                        updateTeethAxis("diastem", "upperLeft", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                    <input
                      type="text"
                      value={teeth.diastem.upperRight}
                      onChange={(e) =>
                        updateTeethAxis("diastem", "upperRight", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={teeth.diastem.lowerLeft}
                      onChange={(e) =>
                        updateTeethAxis("diastem", "lowerLeft", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                    <input
                      type="text"
                      value={teeth.diastem.lowerRight}
                      onChange={(e) =>
                        updateTeethAxis("diastem", "lowerRight", e.target.value)
                      }
                      style={uniformInputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Голын шугам – we can reuse renderAxis here because "midline" is valid AxisKey */}
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>
                  Голын шугам
                </div>
                {renderAxis("midline", "", teeth.midline)}
              </div>
            </div>

            {/* Нумын хэлбэр */}
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>
                Нумын хэлбэр:
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ width: 24, display: "inline-block" }}>U:</span>
                <label style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!teeth.archFormU?.square}
                    onChange={() => toggleArchFormU("square")}
                    style={{ marginRight: 4 }}
                  />
                  Дөрвөлжин
                </label>
                <label style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!teeth.archFormU?.parabola}
                    onChange={() => toggleArchFormU("parabola")}
                    style={{ marginRight: 4 }}
                  />
                  Парабол
                </label>
                <label style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!teeth.archFormU?.round}
                    onChange={() => toggleArchFormU("round")}
                    style={{ marginRight: 4 }}
                  />
                  Дугуй
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!teeth.archFormU?.vShape}
                    onChange={() => toggleArchFormU("vShape")}
                    style={{ marginRight: 4 }}
                  />
                  V хэлбэр
                </label>
              </div>

              <div>
                <span style={{ width: 24, display: "inline-block" }}>L:</span>
                <label style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!teeth.archFormL?.square}
                    onChange={() => toggleArchFormL("square")}
                    style={{ marginRight: 4 }}
                  />
                  Дөрвөлжин
                </label>
                <label style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!teeth.archFormL?.parabola}
                    onChange={() => toggleArchFormL("parabola")}
                    style={{ marginRight: 4 }}
                  />
                  Парабол
                </label>
                <label style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!teeth.archFormL?.round}
                    onChange={() => toggleArchFormL("round")}
                    style={{ marginRight: 4 }}
                  />
                  Дугуй
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!teeth.archFormL?.vShape}
                    onChange={() => toggleArchFormL("vShape")}
                    style={{ marginRight: 4 }}
                  />
                  V хэлбэр
                </label>
              </div>
            </div>

            {/* Хоршилт: I / II / III */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>
                Хоршилт:
              </div>

              <div style={{ marginBottom: 4 }}>
                <span style={{ width: 160, display: "inline-block" }}>
                  1-р их арааны хоршилт:
                </span>
                <span style={{ marginRight: 8 }}>Баруун</span>
                {["I", "II", "III"].map((cls) => (
                  <label key={`molarR-${cls}`} style={{ marginRight: 4 }}>
                    <input
                      type="checkbox"
                      checked={teeth.molarRelationRight === cls}
                      onChange={() =>
                        setTeethClass(
                          "molarRelationRight",
                          cls as "I" | "II" | "III"
                        )
                      }
                      style={{ marginRight: 2 }}
                    />
                    {cls}
                  </label>
                ))}
                <span style={{ marginLeft: 16, marginRight: 8 }}>Зүүн</span>
                {["I", "II", "III"].map((cls) => (
                  <label key={`molarL-${cls}`} style={{ marginRight: 4 }}>
                    <input
                      type="checkbox"
                      checked={teeth.molarRelationLeft === cls}
                      onChange={() =>
                        setTeethClass(
                          "molarRelationLeft",
                          cls as "I" | "II" | "III"
                        )
                      }
                      style={{ marginRight: 2 }}
                    />
                    {cls}
                  </label>
                ))}
              </div>

              <div>
                <span style={{ width: 160, display: "inline-block" }}>
                  Сойёны хоршилт:
                </span>
                <span style={{ marginRight: 8 }}>Баруун</span>
                {["I", "II", "III"].map((cls) => (
                  <label key={`canineR-${cls}`} style={{ marginRight: 4 }}>
                    <input
                      type="checkbox"
                      checked={teeth.canineRelationRight === cls}
                      onChange={() =>
                        setTeethClass(
                          "canineRelationRight",
                          cls as "I" | "II" | "III"
                        )
                      }
                      style={{ marginRight: 2 }}
                    />
                    {cls}
                  </label>
                ))}
                <span style={{ marginLeft: 16, marginRight: 8 }}>Зүүн</span>
                {["I", "II", "III"].map((cls) => (
                  <label key={`canineL-${cls}`} style={{ marginRight: 4 }}>
                    <input
                      type="checkbox"
                      checked={teeth.canineRelationLeft === cls}
                      onChange={() =>
                        setTeethClass(
                          "canineRelationLeft",
                          cls as "I" | "II" | "III"
                        )
                      }
                      style={{ marginRight: 2 }}
                    />
                    {cls}
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Odontogram + legend */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2.2fr) minmax(230px, 1fr)",
              gap: 16,
              alignItems: "flex-start",
            }}
          >
            <div>
              <FullArchDiscOdontogram
                value={toothChart}
                onChange={setToothChart}
                activeStatus={activeStatus}
              />
            </div>

            <aside
              style={{
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                padding: 12,
                background: "#f9fafb",
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 8 }}>
                Тэмдэглэгээ / Үйлдэл сонгох
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                {STATUS_BUTTONS.map((s) => {
                  const isActive = activeStatus === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() =>
                        setActiveStatus((prev) =>
                          prev === s.key ? null : s.key
                        )
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: isActive
                          ? `2px solid ${s.color}`
                          : "1px solid #d1d5db",
                        background: isActive ? "#ffffff" : "#f3f4f6",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      <span>{s.label}</span>
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          backgroundColor: s.color,
                          display: "inline-block",
                        }}
                      />
                    </button>
                  );
                })}
              </div>

              {activeStatus === "supernumerary" && (
                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 6,
                    borderTop: "1px dashed #e5e7eb",
                  }}
                >
                  <div style={{ fontSize: 12, marginBottom: 2 }}>
                    Илүү шүдний байрлал / тайлбар:
                  </div>
                  <input
                    value={extraToothText}
                    onChange={(e) => setExtraToothText(e.target.value)}
                    placeholder='Жишээ: "баруун дээд, 3 дахь шүдний дотор"'
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                      fontSize: 12,
                    }}
                  />
                </div>
              )}
            </aside>
          </div>

          {/* MODEL MEASUREMENTS (ЗАГВАР ХЭМЖИЛЗҮЙ) */}
          <section
            style={{
              marginTop: 16,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 12,
              background: "#ffffff",
              fontSize: 13,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              ЗАГВАР ХЭМЖИЛЗҮЙ
            </div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Sum of incisor
            </div>

            {/* Upper incisors */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>
                Дээд үүдэн шүд (U1)
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span>12:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.u12}
                  onChange={(e) =>
                    updateSumOfIncisor("u12", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>11:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.u11}
                  onChange={(e) =>
                    updateSumOfIncisor("u11", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>21:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.u21}
                  onChange={(e) =>
                    updateSumOfIncisor("u21", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>22:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.u22}
                  onChange={(e) =>
                    updateSumOfIncisor("u22", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span style={{ marginLeft: 12 }}>
                  U1 сум ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {u1Sum.toFixed(2)}
                  </span>{" "}
                  мм
                </span>
              </div>
            </div>

            {/* Lower incisors */}
            <div>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>
                Доод үүдэн шүд (L1)
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span>32:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.l32}
                  onChange={(e) =>
                    updateSumOfIncisor("l32", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>31:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.l31}
                  onChange={(e) =>
                    updateSumOfIncisor("l31", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>41:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.l41}
                  onChange={(e) =>
                    updateSumOfIncisor("l41", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>42:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.l42}
                  onChange={(e) =>
                    updateSumOfIncisor("l42", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span style={{ marginLeft: 12 }}>
                  L1 сум ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {l1Sum.toFixed(2)}
                  </span>{" "}
                  мм
                </span>
              </div>
            </div>

            {/* U1 : L1 ratio */}
            <div
              style={{
                marginTop: 12,
                marginBottom: 16,
                fontSize: 13,
                color: "#111827",
              }}
            >
              U1 : L1 харьцаа (лавлагаа болгон):{" "}
              {u1l1Ratio ? (
                <span style={{ fontWeight: 700 }}>{u1l1Ratio} : 1</span>
              ) : (
                "-"
              )}
            </div>

            {/* Bolton index */}
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Bolton Index
            </div>

            {/* 6) */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                  flexWrap: "wrap",
                }}
              >
                <span>6)</span>
                <span>дээд</span>
                {boltonInputs.upper6.map((val, i) => (
                  <input
                    key={`u6-${i}`}
                    type="text"
                    value={val}
                    onChange={(e) => updateBoltonUpper6(i, e.target.value)}
                    style={{
                      width: 60,
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                    }}
                  />
                ))}
                <span style={{ marginLeft: 8 }}>
                  Σ ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {upper6Sum.toFixed(2)}
                  </span>
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ width: 24 }} />
                <span>доод</span>
                {boltonInputs.lower6.map((val, i) => (
                  <input
                    key={`l6-${i}`}
                    type="text"
                    value={val}
                    onChange={(e) => updateBoltonLower6(i, e.target.value)}
                    style={{
                      width: 60,
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                    }}
                  />
                ))}
                <span style={{ marginLeft: 8 }}>
                  Σ ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {lower6Sum.toFixed(2)}
                  </span>
                </span>
              </div>
            </div>

            {/* 12) */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                  flexWrap: "wrap",
                }}
              >
                <span>12)</span>
                <span>дээд</span>
                {boltonInputs.upper12.map((val, i) => (
                  <input
                    key={`u12-${i}`}
                    type="text"
                    value={val}
                    onChange={(e) =>
                      updateBoltonUpper12(i, e.target.value)
                    }
                    style={{
                      width: 60,
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                    }}
                  />
                ))}
                <span style={{ marginLeft: 8 }}>
                  Σ ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {upper12Sum.toFixed(2)}
                  </span>
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ width: 28 }} />
                <span>доод</span>
                {boltonInputs.lower12.map((val, i) => (
                  <input
                    key={`l12-${i}`}
                    type="text"
                    value={val}
                    onChange={(e) =>
                      updateBoltonLower12(i, e.target.value)
                    }
                    style={{
                      width: 60,
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                    }}
                  />
                ))}
                <span style={{ marginLeft: 8 }}>
                  Σ ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {lower12Sum.toFixed(2)}
                  </span>
                </span>
              </div>
            </div>

            {/* Bolton summary */}
            <div style={{ fontSize: 13, marginTop: 4, marginBottom: 12 }}>
              6 = 78.1% (
              <span style={{ fontWeight: 600 }}>
                {bolton6Result || ""}
              </span>
              ){" "}
              <span style={{ marginLeft: 24 }}>
                12 = 91.4% (
                <span style={{ fontWeight: 600 }}>
                  {bolton12Result || ""}
                </span>
                )
              </span>
            </div>

            {/* Howes' Ax */}
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Howes&apos; AX
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
              }}
            >
              <span>Howes AX (%) =</span>
              <span>PMBAW</span>
              <input
                type="text"
                value={howesInputs.pmbaw || ""}
                onChange={(e) => updateHowes("pmbaw", e.target.value)}
                style={{
                  width: 80,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                }}
              />
              <span>/ TM</span>
              <input
                type="text"
                value={howesInputs.tm || ""}
                onChange={(e) => updateHowes("tm", e.target.value)}
                style={{
                  width: 80,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                }}
              />
              <span>× 100 =</span>
              <span
                style={{
                  minWidth: 60,
                  fontWeight: 700,
                }}
              >
                {howesResult ? `${howesResult} %` : ""}
              </span>
            </div>
            {howesCategory.label && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: howesCategory.color,
                  fontWeight: 600,
                }}
              >
                {howesCategory.label}
              </div>
            )}
          </section>

          {/* TOTAL DISCREPANCY */}
          <section
            style={{
              marginTop: 16,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 12,
              background: "#ffffff",
              fontSize: 13,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              TOTAL DISCREPANCY
            </div>

            {/* Row 1: ALD -> Mid line -> Curve of spee -> Expansion */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 24,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              {[
                { key: "ald" as AxisKey, label: "ALD" },
                { key: "midline" as AxisKey, label: "Mid line" },
                { key: "curveOfSpee" as AxisKey, label: "Curve of spee" },
                { key: "expansion" as AxisKey, label: "Expansion" },
              ].map(({ key, label }, index, arr) => {
                const axis = discrepancyInputs[key];
                const isLast = index === arr.length - 1;
                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {renderAxis(key as Exclude<AxisKey, "total">, label, axis)}
                    {!isLast && <Arrow />}
                  </div>
                );
              })}
            </div>

            {/* Row 2: FMIA/A-B -> Overjet -> Total discrepancy */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 24,
                alignItems: "center",
              }}
            >
              {[
                { key: "fmiaABPlane" as AxisKey, label: "FMIA / A-B plane" },
                { key: "overjet" as AxisKey, label: "Overjet" },
              ].map(({ key, label }, index, arr) => {
                const axis = discrepancyInputs[key];
                const isLastAxis = index === arr.length - 1;
                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {renderAxis(key as Exclude<AxisKey, "total">, label, axis)}
                    {!isLastAxis && <Arrow />}
                  </div>
                );
              })}

              {/* Arrow to Total discrepancy */}
              <Arrow />

              {/* Total discrepancy block */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <div style={{ marginBottom: 4, fontWeight: 600 }}>
                  Total discrepancy
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        ...uniformTotalBoxBase,
                        textAlign: "left",
                      }}
                    >
                      {totalAxis.upperLeft}
                    </div>
                    <div
                      style={{
                        ...uniformTotalBoxBase,
                        textAlign: "right",
                      }}
                    >
                      {totalAxis.upperRight}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        ...uniformTotalBoxBase,
                        textAlign: "left",
                      }}
                    >
                      {totalAxis.lowerLeft}
                    </div>
                    <div
                      style={{
                        ...uniformTotalBoxBase,
                        textAlign: "right",
                      }}
                    >
                      {totalAxis.lowerRight}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* ГАЖГИЙН ШИНЖ ТӨЛӨВ / PROBLEM LIST / ОНОШ / ШАЛТГААН */}
          <section
            style={{
              marginTop: 16,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 12,
              background: "#ffffff",
              fontSize: 13,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              ГАЖГИЙН ШИНЖ ТӨЛӨВ
            </div>

                        {/* Header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontWeight: 500,
                marginBottom: 4,
                fontSize: 12,
              }}
            >
              <span style={{ width: 180 }} />
              <span style={{ width: 40, textAlign: "center" }}>-</span>
              <span style={{ width: 40, textAlign: "center" }}>+</span>
              <span
                style={{
                  width: 180,
                  textAlign: "left",
                  paddingLeft: 4,
                }}
              >
                Тайлбар
              </span>
              <span
                style={{
                  width: 180,
                  textAlign: "left",
                  paddingLeft: 4,
                }}
              >
                PROBLEM LIST
              </span>
            </div>

            {/* Row helper */}
                        {[
              { key: "boneAngle" as ProblemRowKey, label: "Ясны: Өнцөг" },
              { key: "boneStep" as ProblemRowKey, label: "  Шугаман" },
              { key: "tooth" as ProblemRowKey, label: "Шүдний" },
              { key: "toothPosition" as ProblemRowKey, label: "Шүдлэлийн" },
              { key: "functional" as ProblemRowKey, label: "Үйл зүйн" },
              { key: "badHabit" as ProblemRowKey, label: "Буруу зуршил" },
            ].map(({ key, label }, index) => {
              const row =
                problemSection.rows[key] || {
                  plus: false,
                  minus: false,
                  comment: "",
                  problem: "",
                };
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ width: 180 }}>{label}</span>

                  {/* - checkbox */}
                  <div style={{ width: 40, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={!!row.minus}
                      onChange={() =>
                        updateProblemRow(key, "minus", !row.minus)
                      }
                    />
                  </div>

                  {/* + checkbox */}
                  <div style={{ width: 40, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={!!row.plus}
                      onChange={() =>
                        updateProblemRow(key, "plus", !row.plus)
                      }
                    />
                  </div>

                                    {/* Comment field (right after +/-) */}
                  <input
                    type="text"
                    value={row.comment || ""}
                    onChange={(e) =>
                      updateProblemRow(key, "comment", e.target.value)
                    }
                    style={{
                      width: 180,
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      padding: "3px 6px",
                      fontSize: 12,
                    }}
                    placeholder=""
                  />

                  {/* Problem list field (last column, numbered) */}
                  <input
                    type="text"
                    value={row.problem || ""}
                    onChange={(e) =>
                      updateProblemRow(key, "problem", e.target.value)
                    }
                    style={{
                      width: 180,
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      padding: "3px 6px",
                      fontSize: 12,
                    }}
                    placeholder={String(index + 1)}
                  />
                </div>
              );
            })}

            {/* ОНОШ */}
            <div style={{ marginTop: 8, marginBottom: 6 }}>
              <div style={{ fontWeight: 500, marginBottom: 2 }}>ОНОШ</div>
              <textarea
                value={problemSection.diagnosis || ""}
                onChange={(e) =>
                  setProblemSection((prev) => ({
                    ...prev,
                    diagnosis: e.target.value,
                  }))
                }
                rows={2}
                style={{
                  width: "100%",
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                  fontSize: 12,
                }}
              />
            </div>

            {/* ШАЛТГААН */}
            <div>
              <div style={{ fontWeight: 500, marginBottom: 2 }}>ШАЛТГААН</div>
              <textarea
                value={problemSection.cause || ""}
                onChange={(e) =>
                  setProblemSection((prev) => ({
                    ...prev,
                    cause: e.target.value,
                  }))
                }
                rows={2}
                style={{
                  width: "100%",
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                  fontSize: 12,
                }}
              />
            </div>
          </section>
            {/* ЭМЧИЛГЭЭНИЙ ЗОРИЛГО */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                ЭМЧИЛГЭЭНИЙ ЗОРИЛГО
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        textAlign: "right",
                        fontSize: 12,
                      }}
                    >
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={problemSection.treatmentGoals?.[idx] || ""}
                      onChange={(e) =>
                        setProblemSection((prev) => {
                          const goals = [...(prev.treatmentGoals || ["", "", "", "", "", ""])];
                          goals[idx] = e.target.value;
                          return { ...prev, treatmentGoals: goals };
                        })
                      }
                      style={{
                        flex: 1,
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        padding: "3px 6px",
                        fontSize: 12,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          
          {/* Actions */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Буцах
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: saving ? "#9ca3af" : "#2563eb",
                color: "#ffffff",
                fontSize: 13,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Хадгалж байна..." : "Карт хадгалах"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

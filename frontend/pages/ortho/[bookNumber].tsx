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
 * АСУУМЖ (survey)
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
      const next = structuredClone(prev) as BoltonInputs;
      next.upper6[index] = cleaned;
      next.upper12[index] = cleaned;
      return next;
    });
  };

  const updateBoltonLower6 = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setBoltonInputs((prev) => {
      const next = structuredClone(prev) as BoltonInputs;
      next.lower6[index] = cleaned;
      next.lower12[index] = cleaned;
      return next;
    });
  };

  const updateBoltonUpper12 = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setBoltonInputs((prev) => {
      const next = structuredClone(prev) as BoltonInputs;
      next.upper12[index] = cleaned;
      return next;
    });
  };

  const updateBoltonLower12 = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setBoltonInputs((prev) => {
      const next = structuredClone(prev) as BoltonInputs;
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

  const updateSurveyText = (field: keyof OrthoSurvey, value: string) =>
    setSurvey((prev) => ({ ...prev, [field]: value }));

  const toggleSurveyBool = (
    field:
      | "allergyPlant"
      | "allergyMetal"
      | "allergyDrug"
      | "allergyFood"
      | "allergyPlastic"
      | "allergyOther"
      | "hbv"
      | "hbc"
      | "hiv"
  ) =>
    setSurvey((prev) => ({ ...prev, [field]: !prev[field] }));

  const updatePhysicalText = (field: keyof PhysicalExam, value: string) =>
    setPhysicalExam((prev) => ({ ...prev, [field]: value }));

  const togglePhysicalBool = (
    field:
      | "growthSpurtNormal"
      | "growthSpurtAbnormal"
      | "growthSpurtBefore"
      | "growthSpurtMiddle"
      | "growthSpurtAfter"
      | "patternVertical"
      | "patternHorizontal"
      | "patternClockwise"
      | "patternCounterclockwise"
  ) => setPhysicalExam((prev) => ({ ...prev, [field]: !prev[field] }));

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

  useEffect(() => {
    const bn =
      typeof bookNumber === "string" && bookNumber.trim()
        ? bookNumber.trim()
        : "";
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
          }

          if (data.lip) {
            setLip({
              closed: !!data.lip.closed,
              open: !!data.lip.open,
              restLipMm: data.lip.restLipMm || "",
              smilingMm: data.lip.smilingMm || "",
            });
          }
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
  }, [bookNumber]);

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
          {/* ...keep your existing Sum of incisor, Bolton, Howes and TOTAL DISCREPANCY sections here unchanged... */}
          {/* (You can paste those blocks from your last working version under this comment.) */}

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

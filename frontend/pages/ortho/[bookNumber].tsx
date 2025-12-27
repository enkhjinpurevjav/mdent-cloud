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
  upper6: string[]; // 6 fields
  lower6: string[]; // 6 fields
  upper12: string[]; // 12 fields
  lower12: string[]; // 12 fields
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

type OrthoCardData = {
  patientName?: string;
  notes?: string;
  toothChart: OrthoDisc[];
  problemList?: { id: number; label: string; checked?: boolean }[];
  supernumeraryNote?: string;

  // Model measurements
  sumOfIncisorInputs?: SumOfIncisorInputs;
  boltonInputs?: BoltonInputs;
  howesInputs?: HowesInputs;

  // Total discrepancy
  discrepancyInputs?: DiscrepancyInputs;
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

  // This is the text field inside the "Илүү шүд" control.
  const [extraToothText, setExtraToothText] = useState<string>("");

  const bn =
    typeof bookNumber === "string" && bookNumber.trim()
      ? bookNumber.trim()
      : "";

  const parseOrZero = (v: string | undefined | null): number =>
    !v ? 0 : Number.parseFloat(v) || 0;

  // Sum of incisor
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

  // Bolton
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

  // Howes Ax
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

  // DISCREPANCY
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

  // Load card
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

        // patient info for header
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
          // IMPORTANT: also feed it into the UI field so Илүү шүд persists
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
        } else {
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

  // Save
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
        // IMPORTANT: persist the Илүү шүд text from the legend
        supernumeraryNote: extraToothText || undefined,
        sumOfIncisorInputs,
        boltonInputs,
        howesInputs,
        discrepancyInputs: discrepancyWithTotal,
      };

      const res = await fetch(`/api/patients/ortho-card/${patientBookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          (json && (json as any).error) || "Гажиг заслын карт хадгалахад алдаа гарлаа."
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
        {/* upper row */}
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
        {/* lower row */}
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
      {/* Back */}
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
        {/* Row 1: Картын дугаар, Үйлчлүүлэгч, РД */}
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

        {/* Row 2: Нас, Хүйс, Утас */}
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

        {/* Row 3: Хаяг */}
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

          {/* MODEL MEASUREMENTS (ЗАГВАР ХЭМЖИЛ) – Sum of incisors + Bolton + Howes */}
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

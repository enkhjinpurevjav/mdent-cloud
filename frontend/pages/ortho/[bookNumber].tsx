import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import FullArchDiscOdontogram, {
  ActiveStatusKey,
} from "../../components/odontogram/FullArchDiscOdontogram";

/**
 * Ortho card page using the new full‑arch disc odontogram layout.
 * Data shape now supports:
 *  - toothChart: { code, status, regions }[]  (regions = caries/filled)
 *  - sumOfIncisorInputs: per‑tooth mesio‑distal widths for incisors
 *  - boltonInputs: 36 fields (6 upper + 6 lower + 12 upper + 12 lower)
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
  upper6: string[];  // length 6
  lower6: string[];  // length 6
  upper12: string[]; // length 12
  lower12: string[]; // length 12
};

type OrthoCardData = {
  patientName?: string;
  notes?: string;
  toothChart: OrthoDisc[];
  problemList?: { id: number; label: string; checked?: boolean }[];
  supernumeraryNote?: string;

  // ЗАГВАР ХЭМЖИЛ
  sumOfIncisorInputs?: SumOfIncisorInputs;
  boltonInputs?: BoltonInputs;
};

type OrthoCardApiResponse = {
  patientBook: { id: number; bookNumber: string };
  patient: {
    id: number;
    name: string | null;
    ovog: string | null;
    regNo: string | null;
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

// Reuse ActiveStatusKey for the right‑side legend buttons
type StatusKey = ActiveStatusKey;

// Right panel buttons: label + color + internal key
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

export default function OrthoCardPage() {
  const router = useRouter();
  const { bookNumber } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [patientBookId, setPatientBookId] = useState<number | null>(null);
  const [patientNameHeader, setPatientNameHeader] = useState<string>("");

  // Editable card fields
  const [cardPatientName, setCardPatientName] = useState<string>("");
  const [cardNotes, setCardNotes] = useState<string>("");
  const [supernumeraryNote, setSupernumeraryNote] = useState<string>("");
  const [toothChart, setToothChart] = useState<OrthoDisc[]>([]);

  // Sum of incisor inputs
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

  // Bolton 36-field inputs
  const [boltonInputs, setBoltonInputs] = useState<BoltonInputs>(
    emptyBoltonInputs()
  );

  // UI‑only
  const [activeStatus, setActiveStatus] = useState<StatusKey | null>(null);
  const [extraToothText, setExtraToothText] = useState<string>("");

  const bn =
    typeof bookNumber === "string" && bookNumber.trim()
      ? bookNumber.trim()
      : "";

  const parseOrZero = (v: string | undefined | null): number =>
    !v ? 0 : Number.parseFloat(v) || 0;

  // Sum of incisor helpers
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

  // Bolton helpers: 36 fields with linking
  const updateBoltonUpper6 = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setBoltonInputs((prev) => {
      const next = structuredClone(prev) as BoltonInputs;
      next.upper6[index] = cleaned;
      // Mirror into first 6 of upper12
      next.upper12[index] = cleaned;
      return next;
    });
  };

  const updateBoltonLower6 = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setBoltonInputs((prev) => {
      const next = structuredClone(prev) as BoltonInputs;
      next.lower6[index] = cleaned;
      // Mirror into first 6 of lower12
      next.lower12[index] = cleaned;
      return next;
    });
  };

  const updateBoltonUpper12 = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setBoltonInputs((prev) => {
      const next = structuredClone(prev) as BoltonInputs;
      next.upper12[index] = cleaned;
      // Only extra 6 are independent; we don't push back into upper6
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

  // --- Load existing ortho card (or create empty state) ---
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
        const json = (await res.json().catch(() => null)) as
          | OrthoCardApiResponse
          | null;

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
          const { ovog, name } = json.patient;
          if (name) {
            const trimmedOvog = (ovog || "").trim();
            const display =
              trimmedOvog && trimmedOvog !== "null"
                ? `${trimmedOvog.charAt(0).toUpperCase()}.${name}`
                : name;
            setPatientNameHeader(display);
          }
        }

        if (json.orthoCard && json.orthoCard.data) {
          const data = json.orthoCard.data;
          setCardPatientName(data.patientName || "");
          setCardNotes(data.notes || "");
          setSupernumeraryNote(data.supernumeraryNote || "");
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
        } else {
          setCardPatientName("");
          setCardNotes("");
          setSupernumeraryNote("");
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

  // --- Save handler ---
  const handleSave = async () => {
    if (!patientBookId) {
      setError("PatientBook ID олдсонгүй.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");

    try {
      const payload: OrthoCardData = {
        patientName: cardPatientName || undefined,
        notes: cardNotes || undefined,
        toothChart,
        supernumeraryNote: supernumeraryNote || undefined,
        sumOfIncisorInputs,
        boltonInputs,
      };

      const res = await fetch(`/api/patients/ortho-card/${patientBookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Гажиг заслын карт хадгалахад алдаа гарлаа."
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

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      {/* Back to patient profile */}
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

      <h1 style={{ fontSize: 20, marginTop: 0, marginBottom: 4 }}>
        Гажиг заслын өвчтөний карт
      </h1>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
        Картын дугаар: {bn || "—"}
      </div>
      {patientNameHeader && (
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Өвчтөн: {patientNameHeader}
        </div>
      )}

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
          {/* Top card fields */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ color: "#6b7280", marginBottom: 2 }}>
                Өвчтөний овог, нэр (сонголттой)
              </div>
              <input
                value={cardPatientName}
                onChange={(e) => setCardPatientName(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                }}
              />
            </div>
            <div>
              <div style={{ color: "#6b7280", marginBottom: 2 }}>
                Тэмдэглэл (сонголттой)
              </div>
              <input
                value={cardNotes}
                onChange={(e) => setCardNotes(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                }}
              />
            </div>
          </div>

          {/* Odontogram */}
          <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 8 }}>
            Шүдний тойргийн зураг (Одонтограм)
          </h2>

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

              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                Товчийг сонгоод тойрог дээр дарж тухайн шүдний байдал, хэсэг
                тус бүрийн цоорсон / ломбодсон байдлыг тэмдэглэнэ. Илүү шүд
                товч дээр тайлбар бичиж хадгална.
              </div>
            </aside>
          </div>

          {/* ЗАГВАР ХЭМЖИЛ – Sum of incisor + Bolton */}
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
                marginBottom: 4,
              }}
            >
              ЗАГВАР ХЭМЖИЛ
            </div>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>
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

                <span style={{ marginLeft: 12, fontWeight: 500 }}>
                  U1 сум = {u1Sum.toFixed(2)} мм
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

                <span style={{ marginLeft: 12, fontWeight: 500 }}>
                  L1 сум = {l1Sum.toFixed(2)} мм
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

            {/* Bolton index with 36 inputs */}
            <div style={{ fontWeight: 500, marginBottom: 8 }}>
              Bolton index
            </div>

            {/* 6) дээд / доод */}
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
              </div>
            </div>

            {/* 12) дээд / доод */}
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
              </div>
            </div>

            {/* Summary line */}
            <div style={{ fontSize: 13, marginTop: 4 }}>
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
          </section>

          {/* Supernumerary note (kept for compatibility, unlabeled) */}
          <section style={{ marginTop: 16 }}>
            <textarea
              value={supernumeraryNote}
              onChange={(e) => setSupernumeraryNote(e.target.value)}
              rows={2}
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
                resize: "vertical",
              }}
              placeholder=""
            />
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

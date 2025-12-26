import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { OrthoOdontogram } from "../../components/odontogram/OrthoOdontogram";
import type { OrthoCardData } from "../../types/orthoCard";
import { createEmptyChartState } from "../../utils/orthoChartRules";

type OrthoCardApiResponse = {
  orthoCard: {
    id: number;
    patientBookId: number;
    data: OrthoCardData;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export default function OrthoCardPage() {
  const router = useRouter();
  const { bookNumber } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [orthoCard, setOrthoCard] = useState<OrthoCardData | null>(null);
  const [patientBookId, setPatientBookId] = useState<number | null>(null);

  // Load ortho card by bookNumber
  useEffect(() => {
    if (!bookNumber || typeof bookNumber !== "string") return;

    const load = async () => {
      setLoading(true);
      setError("");
      setInfo("");
      try {
        const res = await fetch(
          `/api/patients/ortho-card/by-book/${encodeURIComponent(bookNumber)}`
        );
        const json = (await res.json().catch(() => null)) as
          | (OrthoCardApiResponse & { patientBookId?: number })
          | null;

        if (!res.ok) {
          throw new Error(
            (json && (json as any).error) ||
              "Гажиг заслын карт ачаалахад алдаа гарлаа."
          );
        }

        // Backend can optionally include patientBookId; if not, you can adjust here
        if ((json as any)?.patientBookId) {
          setPatientBookId((json as any).patientBookId);
        }

        if (json?.orthoCard?.data) {
          setOrthoCard(json.orthoCard.data);
        } else {
          // no existing ortho card → start with empty tooth chart
          setOrthoCard({
            toothChart: createEmptyChartState(),
            problemList: [],
            // optional extra fields like patientName, notes can be added here
          } as OrthoCardData);
        }
      } catch (err: any) {
        console.error("load ortho card failed", err);
        setError(
          err?.message || "Гажиг заслын карт ачаалахад алдаа гарлаа."
        );
        setOrthoCard({
          toothChart: createEmptyChartState(),
          problemList: [],
        } as OrthoCardData);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [bookNumber]);

  const handleSave = async () => {
    if (!patientBookId || !orthoCard) {
      setError("PatientBook ID олдсонгүй эсвэл картын өгөгдөл алга.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch(`/api/patients/ortho-card/${patientBookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: orthoCard }),
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
        maxWidth: 1000,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => router.push("/patients")}
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
        ← Буцах
      </button>

      <h1 style={{ fontSize: 20, marginTop: 0, marginBottom: 8 }}>
        Гажиг заслын өвчтөний карт
      </h1>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Картын дугаар:{" "}
        {typeof bookNumber === "string" ? bookNumber : "(сонгогдоогүй)"}
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

      {!loading && orthoCard && (
        <section
          style={{
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: 16,
            background: "white",
          }}
        >
          {/* Basic header fields – keep it super simple for now */}
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
                Өвчтөний овог, нэр
              </div>
              <input
                value={(orthoCard as any).patientName ?? ""}
                onChange={(e) =>
                  setOrthoCard((prev) =>
                    prev ? { ...prev, patientName: e.target.value } : prev
                  )
                }
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
                value={(orthoCard as any).notes ?? ""}
                onChange={(e) =>
                  setOrthoCard((prev) =>
                    prev ? { ...prev, notes: e.target.value } : prev
                  )
                }
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                }}
              />
            </div>
          </div>

          {/* Tooth chart */}
          <h2
            style={{
              fontSize: 14,
              marginTop: 0,
              marginBottom: 8,
            }}
          >
            Шүдний тойргийн зураг (Одонтограм)
          </h2>
          <OrthoOdontogram
            value={orthoCard.toothChart}
            onChange={(next) =>
              setOrthoCard((prev) =>
                prev ? { ...prev, toothChart: next } : prev
              )
            }
          />

          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
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
              {saving ? "Хадгалж байна..." : "Гажиг заслын карт хадгалах"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

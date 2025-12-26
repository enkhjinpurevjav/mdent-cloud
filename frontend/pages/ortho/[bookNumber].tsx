import React, { useState } from "react";
import { useRouter } from "next/router";
import OrthoOdontogram from "../../components/odontogram/OrthoOdontogram";

type OrthoTooth = {
  code: string;
  status: string;
};

export default function OrthoCardPrototypePage() {
  const router = useRouter();
  const { bookNumber } = router.query;

  const [patientName, setPatientName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [toothChart, setToothChart] = useState<OrthoTooth[]>([]);
  const [info, setInfo] = useState<string>("");

  const bn =
    typeof bookNumber === "string" && bookNumber.trim()
      ? bookNumber.trim()
      : "";

  const handleSave = () => {
    // Phase 1: just log / show message
    console.log("Ortho card save (prototype):", {
      bookNumber: bn,
      patientName,
      notes,
      toothChart,
    });
    setInfo("Гажиг заслын картын өгөгдлийг локал прототип байдлаар хадгаллаа (console.log).");
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
        ← Өвчтөнүүдийн жагсаалт руу
      </button>

      <h1 style={{ fontSize: 20, marginTop: 0, marginBottom: 8 }}>
        Гажиг заслын өвчтөний карт (туршилтын хувилбар)
      </h1>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Картын дугаар: {bn || "—"}
      </div>

      {info && (
        <div
          style={{
            color: "#16a34a",
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          {info}
        </div>
      )}

      <section
        style={{
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: 16,
          background: "white",
        }}
      >
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
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
              }}
            />
          </div>
        </div>

        <h2
          style={{
            fontSize: 14,
            marginTop: 0,
            marginBottom: 8,
          }}
        >
          Шүдний тойргийн зураг (Одонтограм)
        </h2>

        <OrthoOdontogram value={toothChart} onChange={setToothChart} />

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
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Карт хадгалах (прототип)
          </button>
        </div>
      </section>
    </main>
  );
}

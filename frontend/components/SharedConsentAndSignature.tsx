import React, { useRef, useState } from "react";
import SignaturePad, { SignaturePadRef } from "./SignaturePad";

type Props = {
  sharedSignature: { filePath: string; signedAt: string } | null;
  sharedSignatureLoading: boolean;
  signatureSaving: boolean;
  consentAccepted: boolean;
  onConsentChange: (accepted: boolean) => void;
  onSaveSignature: (blob: Blob) => Promise<void>;
  formatDate: (iso?: string) => string;
};

export default function SharedConsentAndSignature({
  sharedSignature,
  sharedSignatureLoading,
  signatureSaving,
  consentAccepted,
  onConsentChange,
  onSaveSignature,
  formatDate,
}: Props) {
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const handleSaveSignature = async () => {
    if (!signaturePadRef.current) return;
    
    const blob = await signaturePadRef.current.getBlob();
    if (!blob) {
      alert("Гарын үсэг зураагүй байна.");
      return;
    }
    
    await onSaveSignature(blob);
    setShowSignaturePad(false);
  };

  const handleRedrawSignature = () => {
    setShowSignaturePad(true);
  };

  // If signature exists and we're not in draw mode, show it
  const hasExistingSignature = !sharedSignatureLoading && sharedSignature && !showSignaturePad;

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        padding: 16,
        background: "white",
        marginTop: 16,
      }}
    >
      {/* Consent Section */}
      <section
        style={{
          paddingBottom: 12,
          borderBottom: "1px dashed #e5e7eb",
          fontSize: 13,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => onConsentChange(e.target.checked)}
          />
          <span>
            Урьдчилан сэргийлэх асуумжийг үнэн зөв бөглөж, эмчилгээний
            нөхцөлтэй танилцсан үйлчлүүлэгч/асран хамгаалагч.
          </span>
        </label>
      </section>

      {/* Signature Section */}
      <section
        style={{
          marginTop: 12,
        }}
      >
        <div style={{ fontSize: 13, marginBottom: 8, fontWeight: 500 }}>
          Гарын үсэг
        </div>

        {hasExistingSignature ? (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <img
                src={sharedSignature.filePath}
                alt="Shared signature"
                style={{
                  maxWidth: 400,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                }}
              />
              {sharedSignature.signedAt && (
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  Огноо: {formatDate(sharedSignature.signedAt)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleRedrawSignature}
              style={{
                marginTop: 8,
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #9ca3af",
                background: "#f9fafb",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Дахин гарын үсэг зурах
            </button>
          </div>
        ) : (
          <div>
            <SignaturePad ref={signaturePadRef} disabled={signatureSaving} />
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
                marginTop: 4,
                marginBottom: 8,
              }}
            >
              Таблет, утас эсвэл хулгана ашиглан доор гарын үсэг зурна уу.
            </div>
            <button
              type="button"
              onClick={handleSaveSignature}
              disabled={signatureSaving}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: signatureSaving ? "#9ca3af" : "#10b981",
                color: "#ffffff",
                fontSize: 13,
                cursor: signatureSaving ? "default" : "pointer",
              }}
            >
              {signatureSaving ? "Хадгалж байна..." : "Гарын үсэг хадгалах"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

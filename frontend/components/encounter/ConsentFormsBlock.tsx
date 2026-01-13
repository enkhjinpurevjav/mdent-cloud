import React from "react";
import type {
  Encounter,
  EncounterConsent,
  ConsentType,
} from "../../types/encounter-admin";
import { formatDateTime } from "../../utils/date-formatters";
import SignaturePad from "../SignaturePad";

type ConsentFormsBlockProps = {
  encounter: Encounter;
  consents: EncounterConsent[];
  consentTypeDraft: ConsentType | null;
  consentAnswersDraft: any;
  consentSaving: boolean;
  consentLoading: boolean;
  consentError: string;
  uploadingPatientSignature: boolean;
  uploadingDoctorSignature: boolean;
  attachingDoctorSignature: boolean;
  onConsentTypeDraftChange: (type: ConsentType | null) => void;
  onConsentAnswersDraftUpdate: (partial: any) => void;
  onSaveConsent: () => Promise<void>;
  onPatientSignatureUpload: (blob: Blob) => Promise<void>;
  onDoctorSignatureUpload: (blob: Blob) => Promise<void>;
  onAttachDoctorSignature: () => Promise<void>;
};

export default function ConsentFormsBlock({
  encounter,
  consents,
  consentTypeDraft,
  consentAnswersDraft,
  consentSaving,
  consentLoading,
  consentError,
  uploadingPatientSignature,
  uploadingDoctorSignature,
  attachingDoctorSignature,
  onConsentTypeDraftChange,
  onConsentAnswersDraftUpdate,
  onSaveConsent,
  onPatientSignatureUpload,
  onDoctorSignatureUpload,
  onAttachDoctorSignature,
}: ConsentFormsBlockProps) {
  const consentTypeLabels: Record<ConsentType, string> = {
    root_canal: "Суваг цэвэрлэх",
    surgery: "Мэс ажилбар",
    orthodontic: "Гажиг засал",
    prosthodontic: "Протез",
  };

  return (
    <>
      {/* Consent Type Selection */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Зөвшөөрлийн маягт сонгох
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 8,
          }}
        >
          {(["root_canal", "surgery", "orthodontic", "prosthodontic"] as const).map(
            (ctype) => {
              const selected = consentTypeDraft === ctype;
              return (
                <button
                  key={ctype}
                  type="button"
                  onClick={() => {
                    onConsentTypeDraftChange(ctype);
                    const existing = consents.find((c) => c.type === ctype);
                    if (existing) {
                      onConsentAnswersDraftUpdate(existing.answers || {});
                    } else {
                      onConsentAnswersDraftUpdate({});
                    }
                  }}
                  disabled={consentLoading}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: selected
                      ? "1px solid #2563eb"
                      : "1px solid #d1d5db",
                    background: selected ? "#eff6ff" : "#ffffff",
                    color: selected ? "#2563eb" : "#6b7280",
                    fontSize: 12,
                    cursor: consentLoading ? "default" : "pointer",
                  }}
                >
                  {consentTypeLabels[ctype]}
                </button>
              );
            }
          )}
          <button
            type="button"
            onClick={() => {
              onConsentTypeDraftChange(null);
              onConsentAnswersDraftUpdate({});
            }}
            disabled={consentLoading}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: consentTypeDraft === null
                ? "1px solid #2563eb"
                : "1px solid #d1d5db",
              background: consentTypeDraft === null ? "#eff6ff" : "#ffffff",
              color: consentTypeDraft === null ? "#2563eb" : "#6b7280",
              fontSize: 12,
              cursor: consentLoading ? "default" : "pointer",
            }}
          >
            Зөвшөөрөл хэрэггүй
          </button>
        </div>

        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
          Эмчилгээний төрөл болон шүдний онцлогт тохирсон зөвшөөрлийн маягт
          сонгоно. Сонгосны дараа доор маягтын талбаруудыг бөглөнө үү.
        </div>

        {consentError && (
          <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>
            {consentError}
          </div>
        )}

        <button
          type="button"
          onClick={onSaveConsent}
          disabled={consentSaving}
          style={{
            marginTop: 8,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #16a34a",
            background: "#ecfdf3",
            color: "#166534",
            cursor: consentSaving ? "default" : "pointer",
            fontSize: 12,
          }}
        >
          {consentSaving
            ? "Зөвшөөрлийн маягт хадгалж байна..."
            : "Зөвшөөрлийн маягт хадгалах"}
        </button>
      </div>

      {/* Consent Form Display (Basic - Surgery type only for now) */}
      {consentTypeDraft === "surgery" && (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Мэс ажилбарын зөвшөөрлийн маягт
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              marginBottom: 8,
            }}
          >
            Доорх талбаруудыг бөглөх нь сонголттой. Өвчтөнтэй ярилцсаны
            дараа шаардлагатай мэдээллийг оруулна уу.
          </div>

          {/* Surgery mode selector */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
              Мэс ажилбарын төрөл:
            </label>
            <select
              value={consentAnswersDraft?.surgeryMode || "SURGERY"}
              onChange={(e) =>
                onConsentAnswersDraftUpdate({
                  surgeryMode: e.target.value as "SURGERY" | "PROCEDURE",
                })
              }
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 12,
              }}
            >
              <option value="SURGERY">Мэс ажилбар</option>
              <option value="PROCEDURE">Процедур</option>
            </select>
          </div>

          {/* Basic text fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: "#6b7280" }}>
                Нэр / тайлбар:
              </label>
              <input
                type="text"
                value={consentAnswersDraft?.name || ""}
                onChange={(e) =>
                  onConsentAnswersDraftUpdate({ name: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "#6b7280" }}>
                Үр дүн:
              </label>
              <textarea
                rows={2}
                value={consentAnswersDraft?.outcome || ""}
                onChange={(e) =>
                  onConsentAnswersDraftUpdate({ outcome: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "#6b7280" }}>
                Эрсдэл:
              </label>
              <textarea
                rows={2}
                value={consentAnswersDraft?.risks || ""}
                onChange={(e) =>
                  onConsentAnswersDraftUpdate({ risks: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Shared Signatures Section */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Гарын үсэг
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {/* Patient signature */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              Өвчтөний гарын үсэг
            </div>
            {encounter.patientSignaturePath ? (
              <div>
                <img
                  src={encounter.patientSignaturePath}
                  alt="Өвчтөний гарын үсэг"
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
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
                    Гарын үсэг зурсан: {formatDateTime(encounter.patientSignedAt)}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <SignaturePad
                  disabled={uploadingPatientSignature}
                  onChange={(blob) => void onPatientSignatureUpload(blob)}
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
                marginBottom: 4,
              }}
            >
              Эмчийн гарын үсэг
            </div>
            {encounter.doctorSignaturePath ? (
              <div>
                <img
                  src={encounter.doctorSignaturePath}
                  alt="Эмчийн гарын үсэг"
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
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
                    Холбосон: {formatDateTime(encounter.doctorSignedAt)}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <SignaturePad
                    disabled={uploadingDoctorSignature}
                    onChange={(blob) => void onDoctorSignatureUpload(blob)}
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
                  onClick={() => void onAttachDoctorSignature()}
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

      {encounter.notes && (
        <div style={{ marginTop: 4 }}>
          <strong>Тэмдэглэл:</strong> {encounter.notes}
        </div>
      )}
    </>
  );
}

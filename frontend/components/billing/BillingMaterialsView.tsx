import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

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

type EncounterMedia = {
  id: number;
  encounterId: number;
  filePath: string;
  toothCode?: string | null;
  type: string;
};

type EncounterConsent = {
  encounterId: number;
  type: string;
  answers: unknown;
  patientSignedAt?: string | null;
  doctorSignedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type EbarimtReceipt = {
  id?: string | null;
  date?: string | null;
  lottery?: string | null;
  totalAmount?: number | null;
  qrData?: string | null;
  status?: string | null;
  ddtd?: string | null;
  printedAtText?: string | null;
};

type InvoiceData = {
  hasEBarimt?: boolean;
  ebarimtReceipt?: EbarimtReceipt | null;
  status?: string;
};

type EncounterData = {
  id: number;
  prescription?: Prescription | null;
};

const CONSENT_TYPE_LABELS: Record<string, string> = {
  root_canal: "Сувгийн эмчилгээ",
  surgery: "Мэс засал",
  orthodontic: "Гажиг засал",
  prosthodontic: "Согог засал",
};

function formatConsentTypeLabel(type: string): string {
  return CONSENT_TYPE_LABELS[type] ?? type;
}

function formatMoney(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "0";
  return new Intl.NumberFormat("mn-MN").format(Number(v));
}

type Props = {
  encounterId: number;
};

export default function BillingMaterialsView({ encounterId }: Props) {
  const [encounter, setEncounter] = useState<EncounterData | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [xrays, setXrays] = useState<EncounterMedia[]>([]);
  const [consents, setConsents] = useState<EncounterConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!encounterId || Number.isNaN(encounterId)) return;

    const loadAll = async () => {
      setLoading(true);
      setError("");
      try {
        const [encRes, invRes, xrayRes, consentRes] = await Promise.all([
          fetch(`/api/encounters/${encounterId}`),
          fetch(`/api/billing/encounters/${encounterId}/invoice`),
          fetch(`/api/encounters/${encounterId}/media?type=XRAY`),
          fetch(`/api/encounters/${encounterId}/consents`),
        ]);

        const encData = await encRes.json().catch(() => null);
        if (encRes.ok && encData?.id) {
          setEncounter(encData);
        }

        const invData = await invRes.json().catch(() => null);
        if (invRes.ok && invData) {
          setInvoice(invData);
        }

        const xrayData = await xrayRes.json().catch(() => null);
        setXrays(Array.isArray(xrayData) ? xrayData : []);

        const consentData = await consentRes.json().catch(() => null);
        setConsents(Array.isArray(consentData) ? consentData : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Хавсралтын мэдээлэл ачаалж чадсангүй.");
      } finally {
        setLoading(false);
      }
    };

    void loadAll();
  }, [encounterId]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
        Ачаалж байна...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, background: "#fee2e2", color: "#b91c1c", borderRadius: 6 }}>
        {error}
      </div>
    );
  }

  const receipt = invoice?.ebarimtReceipt;
  const hasEbarimt = invoice?.hasEBarimt && receipt;
  const prescription = encounter?.prescription;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Print-only styles: hide everything except the e-Barimt receipt */}
      <style>{`
  .ebarimt-receipt-print-root { display: none; }

  @media print {
    body * { visibility: hidden !important; }

    .ebarimt-receipt-print-root {
      display: block !important;
      visibility: visible !important;
      position: fixed;
      top: 0;
      left: 0;
      width: 215px;
      background: #fff;
      z-index: 9999;
    }

    .ebarimt-receipt-print-root * {
      visibility: visible !important;
    }

    @page { margin: 0; }
  }
`}</style>
      {/* Hidden print container for e-Barimt receipt */}
      {hasEbarimt && (
        <div className="ebarimt-receipt-print-root">
          <div style={{ width: 215, padding: "8px 6px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.4 }}>
            <hr style={{ margin: "4px 0" }} />
            {receipt!.ddtd && <div>ДДТД: {receipt!.ddtd}</div>}
            {receipt!.printedAtText && <div>Огноо: {receipt!.printedAtText}</div>}
            {receipt!.lottery && <div>Сугалаа: {receipt!.lottery}</div>}
            {receipt!.qrData && (
              <div style={{ textAlign: "center", margin: "6px 0" }}>
                <QRCodeSVG value={receipt!.qrData} size={140} />
              </div>
            )}
            <div style={{ fontWeight: 700, marginTop: 2 }}>
              Нийт дүн: {formatMoney(receipt!.totalAmount)}₮
            </div>
          </div>
        </div>
      )}

      {/* e-Barimt */}
      <section
        style={{
          padding: 16,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <h3 style={{ fontSize: 15, margin: 0, marginBottom: 8 }}>e-Barimt</h3>
        {!hasEbarimt ? (
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            e-Barimt олгогдоогүй.
          </div>
        ) : (
          <div style={{ fontSize: 13 }}>
            {receipt!.ddtd && (
              <div>
                <strong>ДДТД:</strong> {receipt!.ddtd}
              </div>
            )}
            {receipt!.printedAtText && (
              <div>
                <strong>Огноо:</strong> {receipt!.printedAtText}
              </div>
            )}
            {receipt!.lottery && (
              <div>
                <strong>Сугалаа:</strong> {receipt!.lottery}
              </div>
            )}
            {receipt!.totalAmount != null && (
              <div>
                <strong>Нийт дүн:</strong> {formatMoney(receipt!.totalAmount)}₮
              </div>
            )}
            {receipt!.qrData && (
              <div style={{ marginTop: 8 }}>
                <QRCodeSVG value={receipt!.qrData} size={120} />
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                🖨️ e-Barimt хэвлэх
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Printable materials */}
      <section
        style={{
          padding: 16,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <h3 style={{ fontSize: 15, margin: 0, marginBottom: 4 }}>
          Хэвлэх боломжтой материалууд
        </h3>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          Үйлчлүүлэгчид цаасаар өгөх шаардлагатай мэдээллүүд.
        </div>

        {/* Prescription */}
        <div
          style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}
        >
          <h4 style={{ margin: 0, fontSize: 14, marginBottom: 6 }}>Эмийн жор</h4>
          {prescription?.items?.length ? (
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
              {prescription.items
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((it) => (
                  <li key={it.id} style={{ marginBottom: 4 }}>
                    <div>
                      <strong>{it.drugName}</strong> — {it.quantityPerTake}x,{" "}
                      {it.frequencyPerDay}/өдөр, {it.durationDays} хоног
                    </div>
                    <div style={{ color: "#6b7280" }}>
                      Тэмдэглэл: {it.note || "-"}
                    </div>
                  </li>
                ))}
            </ol>
          ) : (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Энэ үзлэгт эмийн жор байхгүй.
            </div>
          )}
        </div>

        {/* XRAY */}
        <div
          style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}
        >
          <h4 style={{ margin: 0, fontSize: 14, marginBottom: 6 }}>XRAY зураг</h4>
          {xrays.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              XRAY зураг хавсаргагдаагүй.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {xrays.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f9fafb",
                    fontSize: 12,
                  }}
                >
                  <a href={m.filePath} target="_blank" rel="noreferrer">
                    {m.filePath}
                  </a>
                  {m.toothCode ? (
                    <span style={{ color: "#6b7280" }}> • Шүд: {m.toothCode}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Consent forms */}
        <div
          style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}
        >
          <h4 style={{ margin: 0, fontSize: 14, marginBottom: 6 }}>
            Зөвшөөрлийн маягт
          </h4>
          {consents.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Энэ үзлэгт бөглөгдсөн зөвшөөрлийн маягт байхгүй.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {consents.map((c) => (
                <div
                  key={`${c.encounterId}-${c.type}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "6px 8px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f9fafb",
                    fontSize: 12,
                  }}
                >
                  <div>
                    <strong>Төрөл:</strong> {formatConsentTypeLabel(c.type)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `/print/consent?encounterId=${c.encounterId}&type=${encodeURIComponent(c.type)}`;
                      window.open(url, "_blank", "width=900,height=700,noopener,noreferrer");
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "1px solid #2563eb",
                      background: "#eff6ff",
                      color: "#2563eb",
                      cursor: "pointer",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Хэвлэх
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

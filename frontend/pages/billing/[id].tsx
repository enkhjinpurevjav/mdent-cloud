import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

type Branch = {
  id: number;
  name: string;
};

type Patient = {
  id: number;
  ovog?: string | null;
  name: string;
  regNo?: string | null;
  phone?: string | null;
  branch?: Branch | null;
};

type PatientBook = {
  id: number;
  bookNumber: string;
  patient: Patient;
};

type Doctor = {
  id: number;
  name?: string | null;
  ovog?: string | null;
  email: string;
};

type Service = {
  id: number;
  code?: string | null;
  name: string;
  price: number;
};

type EncounterService = {
  id: number;
  serviceId: number;
  service: Service;
  quantity: number;
};

type Invoice = {
  id: number;
  encounterId: number;
  totalAmount: number;
  status: string;
};

type Encounter = {
  id: number;
  visitDate: string;
  notes?: string | null;
  patientBook: PatientBook;
  doctor: Doctor | null;
  encounterServices: EncounterService[];
  invoice?: Invoice | null;
};

type BillingItem = {
  id: number; // local row id
  encounterServiceId: number | null;
  serviceId: number;
  name: string;
  basePrice: number;
  quantity: number;
  discountAmount: number; // flat discount per line
};

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("mn-MN");
  } catch {
    return iso;
  }
}

function formatPatientName(p: Patient) {
  const ovog = p.ovog ? p.ovog.trim() : "";
  const name = p.name ? p.name.toString().trim() : "";
  if (!ovog) return name || p.regNo || String(p.id);
  const initial = ovog.charAt(0);
  return `${initial}. ${name}`;
}

function formatDoctorName(d: Doctor | null) {
  if (!d) return "-";
  if (d.name && d.name.trim()) return d.name;
  return d.email;
}

export default function BillingPage() {
  const router = useRouter();
  const { id } = router.query;

  const encounterId = useMemo(
    () => (typeof id === "string" ? Number(id) : NaN),
    [id]
  );

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  useEffect(() => {
    if (!encounterId || Number.isNaN(encounterId)) return;

    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await fetch(`/api/encounters/${encounterId}`);
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || !data || !data.id) {
          throw new Error((data && data.error) || "Алдаа гарлаа");
        }

        setEncounter(data);

        const rows: BillingItem[] = Array.isArray(data.encounterServices)
          ? data.encounterServices.map((es: any, idx: number) => ({
              id: idx + 1,
              encounterServiceId: es.id ?? null,
              serviceId: es.serviceId,
              name: es.service?.name || "",
              basePrice: es.service?.price ?? es.price ?? 0,
              quantity: es.quantity ?? 1,
              discountAmount: 0,
            }))
          : [];

        setBillingItems(rows);
      } catch (err: any) {
        console.error("Failed to load encounter for billing:", err);
        setLoadError(err.message || "Алдаа гарлаа");
        setEncounter(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [encounterId]);

  const handleItemChange = (
    id: number,
    field: "quantity" | "basePrice" | "discountAmount",
    value: string
  ) => {
    setBillingItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const num = Number(value.replace(/\s/g, "")) || 0;
        if (field === "quantity") {
          return { ...row, quantity: num > 0 ? num : 1 };
        }
        if (field === "basePrice") {
          return { ...row, basePrice: num >= 0 ? num : 0 };
        }
        if (field === "discountAmount") {
          return { ...row, discountAmount: num >= 0 ? num : 0 };
        }
        return row;
      })
    );
  };

  const handleRemoveRow = (id: number) => {
    setBillingItems((prev) => prev.filter((row) => row.id !== id));
  };

  const handleAddRowFromService = () => {
    const nextId =
      billingItems.length === 0
        ? 1
        : Math.max(...billingItems.map((r) => r.id)) + 1;
    setBillingItems((prev) => [
      ...prev,
      {
        id: nextId,
        encounterServiceId: null,
        serviceId: 0,
        name: "",
        basePrice: 0,
        quantity: 1,
        discountAmount: 0,
      },
    ]);
  };

  const totalBeforeDiscount = billingItems.reduce(
    (sum, row) => sum + row.basePrice * row.quantity,
    0
  );
  const totalDiscount = billingItems.reduce(
    (sum, row) => sum + row.discountAmount,
    0
  );
  const totalAfterDiscount = Math.max(
    totalBeforeDiscount - totalDiscount,
    0
  );

  const handleSaveBilling = async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setSaveError("");
    setSaveSuccess("");
    setSaving(true);

    try {
      const payload = {
        items: billingItems
          .filter((r) => r.serviceId)
          .map((r) => ({
            encounterServiceId: r.encounterServiceId,
            serviceId: r.serviceId,
            price: r.basePrice,
            quantity: r.quantity,
            discountAmount: r.discountAmount,
          })),
      };

      const res = await fetch(`/api/encounters/${encounterId}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(
          (data && data.error) || "Төлбөр хадгалахад алдаа гарлаа."
        );
      }

      setSaveSuccess("Төлбөрийн мэдээллийг хадгаллаа (түр хувилбар).");
    } catch (err: any) {
      console.error("Failed to save billing:", err);
      setSaveError(err.message || "Төлбөр хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  if (!encounterId || Number.isNaN(encounterId)) {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: 24,
          fontFamily: "sans-serif",
        }}
      >
        <h1>Төлбөрийн хуудас</h1>
        <div style={{ color: "red" }}>Encounter ID буруу байна.</div>
      </main>
    );
  }

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
        Төлбөрийн хуудас (Encounter ID: {encounterId})
      </h1>

      {loading && <div>Ачаалж байна...</div>}
      {!loading && loadError && (
        <div style={{ color: "red", marginBottom: 12 }}>{loadError}</div>
      )}

      {encounter && (
        <>
          {/* Header / Encounter summary */}
          <section
            style={{
              marginBottom: 16,
              padding: 16,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <div style={{ marginBottom: 4 }}>
              <strong>Үйлчлүүлэгч:</strong>{" "}
              {formatPatientName(encounter.patientBook.patient)} (Карт:{" "}
              {encounter.patientBook.bookNumber})
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Салбар:</strong>{" "}
              {encounter.patientBook.patient.branch
                ? encounter.patientBook.patient.branch.name
                : "-"}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Эмч:</strong> {formatDoctorName(encounter.doctor)}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Огноо:</strong> {formatDateTime(encounter.visitDate)}
            </div>
            {encounter.notes && (
              <div style={{ marginTop: 4 }}>
                <strong>Үзлэгийн тэмдэглэл:</strong> {encounter.notes}
              </div>
            )}
            {encounter.invoice && (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                <strong>Одоогийн нэхэмжлэл:</strong> #{encounter.invoice.id} –{" "}
                {encounter.invoice.totalAmount.toLocaleString("mn-MN")}₮ (
                {encounter.invoice.status})
              </div>
            )}
          </section>

          {/* Billing items */}
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
              <div>
                <h2 style={{ fontSize: 16, margin: 0 }}>
                  Үйлчилгээний мөрүүд (Invoice lines)
                </h2>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Доорх жагсаалт нь энэ үзлэгийн EncounterService мөрүүд дээр
                  тулгуурласан. Та тоо хэмжээ, нэгж үнэ, хөнгөлөлтийг засварлаж
                  болно.
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddRowFromService}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  color: "#2563eb",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                + Нэмэлт мөр
              </button>
            </div>

            {billingItems.length === 0 && (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Одоогоор үйлчилгээний мөр алга байна. EncounterService бүртгэл
                хараахан үүсээгүй эсвэл бүгд устгагдсан байж магадгүй.
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 8,
              }}
            >
              {billingItems.map((row) => {
                const lineTotal = Math.max(
                  row.basePrice * row.quantity - row.discountAmount,
                  0
                );
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "2fr 80px 120px 120px 120px auto",
                      gap: 8,
                      alignItems: "center",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      padding: 8,
                      background: "#f9fafb",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          marginBottom: 2,
                        }}
                      >
                        {row.name || "Үйлчилгээний нэр (Service)"}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                        }}
                      >
                        Service ID: {row.serviceId || "-"}
                      </div>
                    </div>

                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) =>
                        handleItemChange(row.id, "quantity", e.target.value)
                      }
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        fontSize: 13,
                      }}
                    />

                    <input
                      type="number"
                      min={0}
                      value={row.basePrice}
                      onChange={(e) =>
                        handleItemChange(row.id, "basePrice", e.target.value)
                      }
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        fontSize: 13,
                      }}
                    />

                    <input
                      type="number"
                      min={0}
                      value={row.discountAmount}
                      onChange={(e) =>
                        handleItemChange(
                          row.id,
                          "discountAmount",
                          e.target.value
                        )
                      }
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        fontSize: 13,
                      }}
                    />

                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: "right",
                      }}
                    >
                      {lineTotal.toLocaleString("mn-MN")}₮
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #dc2626",
                        background: "#fef2f2",
                        color: "#b91c1c",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Устгах
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                alignItems: "flex-end",
                fontSize: 13,
              }}
            >
              <div>
                Нийт (хөнгөлөлтгүй):{" "}
                <strong>
                  {totalBeforeDiscount.toLocaleString("mn-MN")}₮
                </strong>
              </div>
              <div>
                Нийт хөнгөлөлт:{" "}
                <strong>
                  -{totalDiscount.toLocaleString("mn-MN")}₮
                </strong>
              </div>
              <div>
                Төлөх дүн:{" "}
                <strong style={{ fontSize: 16 }}>
                  {totalAfterDiscount.toLocaleString("mn-MN")}₮
                </strong>
              </div>
            </div>

            {saveError && (
              <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 13 }}>
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div style={{ color: "#16a34a", marginTop: 8, fontSize: 13 }}>
                {saveSuccess}
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={handleSaveBilling}
                disabled={saving}
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
                {saving
                  ? "Төлбөр хадгалж байна..."
                  : "Төлбөр хадгалах (түр)"}
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

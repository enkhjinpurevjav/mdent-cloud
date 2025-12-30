import React, {
  useEffect,
  useMemo,
  useState,
  useMemo as useReactMemo,
} from "react";
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

type InvoiceItem = {
  id?: number;
  itemType: "SERVICE" | "PRODUCT";
  serviceId?: number | null;
  productId?: number | null;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal?: number;
};

type Payment = {
  id: number;
  amount: number;
  method: string;
  timestamp: string;
};

type InvoiceResponse = {
  id: number | null;
  branchId: number;
  encounterId: number;
  patientId: number;
  status: string;
  totalBeforeDiscount: number;
  discountPercent: number; // 0, 5, 10
  finalAmount: number;
  hasEBarimt: boolean;
  isProvisional?: boolean;
  items: InvoiceItem[];
  // settlement extras
  paidTotal?: number;
  unpaidAmount?: number;
  payments?: Payment[];
};

type Encounter = {
  id: number;
  visitDate: string;
  notes?: string | null;
  patientBook: PatientBook;
  doctor: Doctor | null;
};

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
  const name = d.name?.trim();
  if (name) return name;
  return d.email;
}

function formatMoney(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "0";
  return new Intl.NumberFormat("mn-MN").format(Number(v));
}

// ----------------- Payment section -----------------

const PAYMENT_METHODS = [
  // Direct patient payments
  { key: "CASH", label: "Бэлэн мөнгө", icon: "₮" },
  { key: "POS", label: "Карт (POS)", icon: "💳" },
  { key: "QPAY", label: "QPay", icon: "Ⓠ" },
  { key: "TRANSFER", label: "Дансны шилжүүлэг", icon: "🏦" },

  // Third-party / special arrangements
  { key: "INSURANCE", label: "Даатгал", icon: "🛡" },
  { key: "VOUCHER", label: "Купон / Ваучер", icon: "🎟" },
  { key: "BARTER", label: "Бартер", icon: "⇄" },
  { key: "APPLICATION", label: "Аппликэйшнээр төлбөр", icon: "📱" },
  { key: "EMPLOYEE_BENEFIT", label: "Ажилтны хөнгөлөлт", icon: "👨‍⚕️" },
];

function BillingPaymentSection({
  invoice,
  onUpdated,
}: {
  invoice: InvoiceResponse;
  onUpdated: (inv: InvoiceResponse) => void;
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [insuranceProvider, setInsuranceProvider] = useState<string>("");
  const [appProvider, setAppProvider] = useState<string>("");
  const [issueEBarimt, setIssueEBarimt] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // NEW: codes for various methods
  const [voucherCode, setVoucherCode] = useState("");
  const [barterCode, setBarterCode] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [employeeRemaining, setEmployeeRemaining] = useState<number | null>(
    null
  );

  const hasRealInvoice = !!invoice.id;
  const unpaid =
    invoice.unpaidAmount ??
    Math.max((invoice.finalAmount ?? 0) - (invoice.paidTotal ?? 0), 0);

  const INSURANCE_PROVIDERS = [
    { value: "BODI_DAATGAL", label: "Bodi Daatgal" },
    { value: "NATIONAL_LIFE", label: "National Life" },
    { value: "MANDAL_DAATGAL", label: "Mandal Daatgal" },
  ];

  const APP_PROVIDERS = [
    { value: "STOREPAY", label: "Storepay" },
    { value: "POCKETPAY", label: "PocketPay" },
    { value: "CAREPAY", label: "CarePay" },
    { value: "ARDPAY", label: "ArdPay" },
    { value: "TOKI", label: "Toki" },
    { value: "PAYON", label: "payOn" },
    { value: "SONO", label: "Sono" },
  ];

  useEffect(() => {
    setEnabled({});
    setAmounts({});
    setInsuranceProvider("");
    setAppProvider("");
    setVoucherCode("");
    setBarterCode("");
    setEmployeeCode("");
    setEmployeeRemaining(null);
    setError("");
    setSuccess("");
  }, [invoice.id]);

  const handleToggle = (methodKey: string, checked: boolean) => {
    setEnabled((prev) => ({ ...prev, [methodKey]: checked }));
    if (!checked) {
      setAmounts((prev) => ({ ...prev, [methodKey]: "" }));
      if (methodKey === "INSURANCE") setInsuranceProvider("");
      if (methodKey === "APPLICATION") setAppProvider("");
      if (methodKey === "VOUCHER") setVoucherCode("");
      if (methodKey === "BARTER") setBarterCode("");
      if (methodKey === "EMPLOYEE_BENEFIT") {
        setEmployeeCode("");
        setEmployeeRemaining(null);
      }
    }
  };

  const handleAmountChange = (methodKey: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [methodKey]: value }));
  };

  const totalEntered = PAYMENT_METHODS.reduce((sum, m) => {
    if (!enabled[m.key]) return sum;
    const raw = amounts[m.key] ?? "";
    const amt = Number(raw);
    if (!amt || amt <= 0) return sum;
    return sum + amt;
  }, 0);

  const remainingAfterEntered = Math.max(unpaid - totalEntered, 0);

  // NEW: verify employee benefit code via backend
  const handleVerifyEmployeeCode = async () => {
    setError("");
    setSuccess("");

    if (!employeeCode.trim()) {
      setError("Ажилтны хөнгөлөлтийн кодыг оруулна уу.");
      return;
    }

    try {
      const res = await fetch("/api/billing/employee-benefit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: employeeCode.trim(),
          invoiceId: invoice.id,
          encounterId: invoice.encounterId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(
          (data && data.error) || "Код шалгахад алдаа гарлаа."
        );
      }

      const remaining = data.remainingAmount ?? 0;
      setEmployeeRemaining(remaining);
      setSuccess(
        `Ажилтны код баталгаажлаа. Үлдэгдэл: ${formatMoney(remaining)} ₮`
      );
    } catch (e: any) {
      console.error("verify employee benefit code failed:", e);
      setEmployeeRemaining(null);
      setError(e.message || "Код шалгахад алдаа гарлаа.");
    }
  };

  const handleSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!hasRealInvoice || !invoice.id) {
      setError("Эхлээд нэхэмжлэлийн бүтцийг хадгална уу.");
      return;
    }

    const entries: {
      method: string;
      amount: number;
      meta?: any;
    }[] = [];

    for (const m of PAYMENT_METHODS) {
      if (!enabled[m.key]) continue;

      const raw = amounts[m.key] ?? "";
      const amt = Number(raw);
      if (!amt || amt <= 0) continue;

      const entry: { method: string; amount: number; meta?: any } = {
        method: m.key,
        amount: amt,
      };

      if (m.key === "INSURANCE") {
        if (!insuranceProvider) {
          setError("Даатгалын нэрийг сонгоно уу.");
          return;
        }
        entry.meta = { ...(entry.meta || {}), provider: insuranceProvider };
      }

      if (m.key === "APPLICATION") {
        if (!appProvider) {
          setError("Аппликэйшнийг сонгоно уу.");
          return;
        }
        entry.meta = { ...(entry.meta || {}), provider: appProvider };
      }

      if (m.key === "VOUCHER") {
        if (!voucherCode.trim()) {
          setError("Купон / Ваучер кодыг оруулна уу.");
          return;
        }
        entry.meta = { ...(entry.meta || {}), code: voucherCode.trim() };
      }

      if (m.key === "BARTER") {
        if (!barterCode.trim()) {
          setError("Бартерын кодыг оруулна уу.");
          return;
        }
        entry.meta = { ...(entry.meta || {}), code: barterCode.trim() };
      }

      if (m.key === "EMPLOYEE_BENEFIT") {
        if (!employeeCode.trim()) {
          setError("Ажилтны хөнгөлөлтийн кодыг оруулна уу.");
          return;
        }
        if (employeeRemaining != null && amt > employeeRemaining) {
          setError("Оруулсан дүн ажилтны үлдэгдлээс их байна.");
          return;
        }
        entry.meta = {
          ...(entry.meta || {}),
          employeeCode: employeeCode.trim(),
        };
      }

      entries.push(entry);
    }

    if (entries.length === 0) {
      setError("Төлбөрийн аргыг сонгож дүнгээ оруулна уу.");
      return;
    }

    try {
      setSubmitting(true);
      let latest: InvoiceResponse | null = null;

      for (const entry of entries) {
        const res = await fetch(`/api/invoices/${invoice.id}/settlement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: entry.amount,
            method: entry.method,
            issueEBarimt,
            meta: entry.meta ?? null,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data) {
          throw new Error(
            (data && data.error) || "Төлбөр бүртгэхэд алдаа гарлаа."
          );
        }

        latest = { ...invoice, ...data };
      }

      if (latest) {
        onUpdated(latest);
      }

      setSuccess("Төлбөр(үүд) амжилттай бүртгэгдлээ.");
      setEnabled({});
      setAmounts({});
      setInsuranceProvider("");
      setAppProvider("");
      setVoucherCode("");
      setBarterCode("");
      setEmployeeCode("");
      setEmployeeRemaining(null);
    } catch (err: any) {
      console.error("Failed to settle invoice:", err);
      setError(err.message || "Төлбөр бүртгэхэд алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
      }}
    >
      <h2 style={{ fontSize: 16, margin: 0, marginBottom: 8 }}>
        Төлбөр бүртгэх
      </h2>

      {!hasRealInvoice && (
        <div style={{ fontSize: 13, color: "#b91c1c", marginBottom: 8 }}>
          Нэхэмжлэлийн мөрүүдийг хадгалсны дараа төлбөр бүртгэх боломжтой.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {PAYMENT_METHODS.map((m) => {
            const checked = !!enabled[m.key];
            const value = amounts[m.key] ?? "";
            return (
              <div
                key={m.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    id={`pay-${m.key}`}
                    checked={checked}
                    onChange={(e) => handleToggle(m.key, e.target.checked)}
                  />
                  <label
                    htmlFor={`pay-${m.key}`}
                    style={{
                      minWidth: 180,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ width: 18, textAlign: "center" }}>
                      {m.icon}
                    </span>
                    <span>{m.label}</span>
                  </label>
                </div>

                {checked && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginLeft: 26,
                    }}
                  >
                    {m.key === "INSURANCE" && (
                      <select
                        value={insuranceProvider}
                        onChange={(e) =>
                          setInsuranceProvider(e.target.value)
                        }
                        style={{
                          minWidth: 200,
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          padding: "4px 6px",
                          fontSize: 13,
                        }}
                      >
                        <option value="">
                          Даатгалын компанийг сонгох...
                        </option>
                        {INSURANCE_PROVIDERS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {m.key === "APPLICATION" && (
                      <select
                        value={appProvider}
                        onChange={(e) =>
                          setAppProvider(e.target.value)
                        }
                        style={{
                          minWidth: 200,
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          padding: "4px 6px",
                          fontSize: 13,
                        }}
                      >
                        <option value="">Аппликэйшнийг сонгох...</option>
                        {APP_PROVIDERS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {m.key === "VOUCHER" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <input
                          type="text"
                          value={voucherCode}
                          onChange={(e) =>
                            setVoucherCode(e.target.value)
                          }
                          placeholder="Ваучерын код"
                          style={{
                            width: 140,
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 6px",
                            fontSize: 12,
                          }}
                        />
                      </div>
                    )}

                    {m.key === "BARTER" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <input
                          type="text"
                          value={barterCode}
                          onChange={(e) =>
                            setBarterCode(e.target.value)
                          }
                          placeholder="Бартерын код"
                          style={{
                            width: 140,
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 6px",
                            fontSize: 12,
                          }}
                        />
                      </div>
                    )}

                    {m.key === "EMPLOYEE_BENEFIT" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <input
                          type="text"
                          value={employeeCode}
                          onChange={(e) =>
                            setEmployeeCode(e.target.value)
                          }
                          placeholder="Ажилтны код"
                          style={{
                            width: 140,
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "4px 6px",
                            fontSize: 12,
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleVerifyEmployeeCode}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "1px solid #2563eb",
                            background: "#eff6ff",
                            color: "#2563eb",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          Шалгах
                        </button>
                        {employeeRemaining != null && (
                          <span
                            style={{
                              fontSize: 12,
                              color: "#16a34a",
                              marginLeft: 4,
                            }}
                          >
                            Үлдэгдэл:{" "}
                            {formatMoney(employeeRemaining)} ₮
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        flex: 1,
                      }}
                    >
                      <input
                        type="number"
                        min={0}
                        value={value}
                        onChange={(e) =>
                          handleAmountChange(m.key, e.target.value)
                        }
                        placeholder="0"
                        style={{
                          flex: 1,
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          padding: "4px 8px",
                          fontSize: 13,
                          textAlign: "right",
                        }}
                      />
                      <span style={{ fontSize: 12 }}>₮</span>
                    </div>

                    {m.key === "QPAY" && (
                      <button
                        type="button"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "none",
                          background: "#2563eb",
                          color: "#ffffff",
                          fontSize: 12,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Нэхэмжлэх үүсгэх
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 13,
            marginTop: 8,
          }}
        >
          <input
            id="issueEBarimt"
            type="checkbox"
            checked={issueEBarimt}
            onChange={(e) => setIssueEBarimt(e.target.checked)}
          />
          <label htmlFor="issueEBarimt">
            Бүрэн төлөгдсөн үед e‑Barimt автоматаар гаргах
          </label>
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#4b5563",
            marginTop: 4,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {invoice.paidTotal != null || invoice.unpaidAmount != null ? (
            <>
              <div>
                Нийт төлсөн (өмнө):{" "}
                <strong>{formatMoney(invoice.paidTotal || 0)} ₮</strong>
              </div>
              <div>
                Үлдэгдэл (одоогийн):{" "}
                <strong>{formatMoney(unpaid)} ₮</strong>
              </div>
            </>
          ) : null}
          <div>
            Энэ удаад оруулсан дүн:{" "}
            <strong>{formatMoney(totalEntered)} ₮</strong>
          </div>
          <div>
            Үлдэгдэл (энэ удаагийн дараа, онолын):{" "}
            <strong>{formatMoney(remainingAfterEntered)} ₮</strong>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "#b91c1c", marginTop: 4 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ fontSize: 13, color: "#16a34a", marginTop: 4 }}>
            {success}
          </div>
        )}

        <div
          style={{ marginTop: 4, display: "flex", justifyContent: "flex-end" }}
        >
          <button
            type="submit"
            disabled={submitting || !hasRealInvoice}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: hasRealInvoice ? "#16a34a" : "#9ca3af",
              color: "#ffffff",
              cursor: hasRealInvoice ? "pointer" : "not-allowed",
              fontSize: 14,
            }}
          >
            {submitting ? "Төлбөр хадгалж байна..." : "Төлбөр бүртгэх"}
          </button>
        </div>
      </form>

      {invoice.payments && invoice.payments.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Бүртгэгдсэн төлбөрүүд
          </div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {invoice.payments.map((p) => (
              <li key={p.id}>
                {formatDateTime(p.timestamp)} — {p.method} —{" "}
                {formatMoney(p.amount)} ₮
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ----------------- Main page -----------------

export default function BillingPage() {
  const router = useRouter();
  const { id } = router.query;

  const encounterId = useMemo(
    () => (typeof id === "string" ? Number(id) : NaN),
    [id]
  );

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Service selector state
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceModalRowIndex, setServiceModalRowIndex] =
    useState<number | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");

  useEffect(() => {
    if (!encounterId || Number.isNaN(encounterId)) return;

    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        // Load encounter summary
        const encRes = await fetch(`/api/encounters/${encounterId}`);
        let encData: any = null;
        try {
          encData = await encRes.json();
        } catch {
          encData = null;
        }

        if (!encRes.ok || !encData || !encData.id) {
          throw new Error((encData && encData.error) || "Алдаа гарлаа");
        }
        setEncounter(encData);

        // Load billing/invoice
        const invRes = await fetch(
          `/api/billing/encounters/${encounterId}/invoice`
        );
        let invData: any = null;
        try {
          invData = await invRes.json();
        } catch {
          invData = null;
        }

        if (!invRes.ok || !invData) {
          throw new Error(
            (invData && invData.error) ||
              "Төлбөрийн мэдээлэл ачаалж чадсангүй."
          );
        }

        const inv: InvoiceResponse = invData;
        setInvoice(inv);
        setItems(inv.items || []);
        setDiscountPercent(inv.discountPercent || 0);
      } catch (err: any) {
        console.error("Failed to load billing:", err);
        setLoadError(err.message || "Алдаа гарлаа");
        setEncounter(null);
        setInvoice(null);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [encounterId]);

  const handleItemChange = (
    index: number,
    field: "name" | "quantity" | "unitPrice",
    value: string
  ) => {
    setItems((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === "name") {
          return { ...row, name: value };
        }
        const num = Number(value.replace(/\s/g, "")) || 0;
        if (field === "quantity") {
          return { ...row, quantity: num > 0 ? num : 1 };
        }
        if (field === "unitPrice") {
          return { ...row, unitPrice: num >= 0 ? num : 0 };
        }
        return row;
      })
    );
  };

  const handleRemoveRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddRowFromService = () => {
    const newRow: InvoiceItem = {
      itemType: "SERVICE",
      serviceId: null,
      productId: null,
      name: "",
      unitPrice: 0,
      quantity: 1,
    };
    setItems((prev) => [...prev, newRow]);
    setServiceModalRowIndex(items.length);
  };

  const totalBeforeDiscount = items.reduce(
    (sum, row) => sum + (row.unitPrice || 0) * (row.quantity || 0),
    0
  );
  const discountFactor =
    discountPercent === 0 ? 1 : (100 - discountPercent) / 100;
  const finalAmount = Math.max(
    Math.round(totalBeforeDiscount * discountFactor),
    0
  );

  const handleSaveBilling = async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setSaveError("");
    setSaveSuccess("");
    setSaving(true);

    try {
      const payload = {
        discountPercent,
        items: items
          .filter((r) => (r.serviceId || r.productId || r.name.trim()))
          .map((r) => ({
            id: r.id,
            itemType: r.itemType,
            serviceId: r.itemType === "SERVICE" ? r.serviceId : null,
            productId: r.itemType === "PRODUCT" ? r.productId : null,
            name: r.name,
            unitPrice: r.unitPrice,
            quantity: r.quantity,
          })),
      };

      const res = await fetch(
        `/api/billing/encounters/${encounterId}/invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || !data.id) {
        throw new Error(
          (data && data.error) || "Төлбөр хадгалахад алдаа гарлаа."
        );
      }

      const saved: InvoiceResponse = data;
      setInvoice(saved);
      setItems(saved.items || []);
      setDiscountPercent(saved.discountPercent || 0);
      setSaveSuccess("Нэхэмжлэлийн бүтцийг хадгаллаа.");
    } catch (err: any) {
      console.error("Failed to save invoice:", err);
      setSaveError(err.message || "Төлбөр хадгалахад алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  // ---- Service modal logic ----

  const loadServices = async () => {
    if (services.length > 0 || servicesLoading) return;
    setServicesLoading(true);
    setServicesError("");
    try {
      const res = await fetch(`/api/services`);
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(
          (data && data.error) ||
            "Үйлчилгээний жагсаалт ачаалахад алдаа гарлаа."
        );
      }

      const list: Service[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any).services)
        ? (data as any).services
        : [];

      setServices(list);
    } catch (err: any) {
      console.error("Failed to load services:", err);
      setServicesError(
        err.message || "Үйлчилгээний жагсаалт ачаалахад алдаа гарлаа."
      );
    } finally {
      setServicesLoading(false);
    }
  };

  const openServiceModalForRow = (index: number) => {
    setServiceModalRowIndex(index);
    setServiceModalOpen(true);
    setServiceQuery("");
    void loadServices();
  };

  const closeServiceModal = () => {
    setServiceModalOpen(false);
    setServiceModalRowIndex(null);
    setServiceQuery("");
  };

  const handleSelectServiceForRow = (svc: Service) => {
    if (serviceModalRowIndex == null) return;
    setItems((prev) =>
      prev.map((row, i) =>
        i === serviceModalRowIndex
          ? {
              ...row,
              itemType: "SERVICE",
              serviceId: svc.id,
              productId: null,
              name: svc.name,
              unitPrice: svc.price,
            }
          : row
      )
    );
    closeServiceModal();
  };

  const filteredServices = useReactMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const code = (s.code || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [services, serviceQuery]);

  // ---------------------------

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
        <h1>Нэхэмжлэлийн хуудас</h1>
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
        Нэхэмжлэлийн хуудас (Encounter ID: {encounterId})
      </h1>

      {loading && <div>Ачаалж байна...</div>}
      {!loading && loadError && (
        <div style={{ color: "red", marginBottom: 12 }}>{loadError}</div>
      )}

      {encounter && invoice && (
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
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <strong>Нэхэмжлэл:</strong>{" "}
              {invoice.id
                ? `#${invoice.id} – ${invoice.finalAmount.toLocaleString(
                    "mn-MN"
                  )}₮ (${invoice.status})`
                : "Одоогоор хадгалагдсан нэхэмжлэл байхгүй (түр санал болгосон тооцоо)."}
              {invoice.hasEBarimt && " • e-Barimt хэвлэгдсэн"}
            </div>
            {invoice.paidTotal != null && (
              <div style={{ marginTop: 4, fontSize: 13 }}>
                Нийт төлсөн:{" "}
                <strong>{formatMoney(invoice.paidTotal)} ₮</strong> • Үлдэгдэл:{" "}
                <strong>{formatMoney(invoice.unpaidAmount || 0)} ₮</strong>
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
                  Доорх жагсаалт нь энэ үзлэгт гүйцэтгэсэн үйлчилгээ,
                  бүтээгдэхүүнийг илэрхийлнэ.
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

            {items.length === 0 && (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Нэхэмжлэлийн мөр алга байна. Үйлчилгээ нэмнэ үү.
              </div>
            )}

            {items.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 80px 120px 120px auto",
                  gap: 8,
                  alignItems: "center",
                  padding: "4px 8px",
                  marginTop: 8,
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                <div>Үйлчилгээ / Бүтээгдэхүүн</div>
                <div style={{ textAlign: "center" }}>Тоо хэмжээ</div>
                <div style={{ textAlign: "center" }}>Нэгж үнэ</div>
                <div style={{ textAlign: "center" }}>Мөрийн дүн</div>
                <div />
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 4,
              }}
            >
              {items.map((row, index) => {
                const lineTotal =
                  (row.unitPrice || 0) * (row.quantity || 0);
                return (
                  <div
                    key={index}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 80px 120px 120px auto",
                      gap: 8,
                      alignItems: "center",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      padding: 8,
                      background: "#f9fafb",
                    }}
                  >
                    <div>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) =>
                          handleItemChange(index, "name", e.target.value)
                        }
                        placeholder={
                          row.itemType === "SERVICE"
                            ? "Үйлчилгээний нэр"
                            : "Бүтээгдэхүүний нэр"
                        }
                        style={{
                          width: "100%",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          padding: "4px 6px",
                          fontSize: 13,
                          marginBottom: 4,
                          background: "#ffffff",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 11,
                          color: "#6b7280",
                        }}
                      >
                        <span>
                          {row.itemType === "SERVICE"
                            ? `Service ID: ${
                                row.serviceId || "- (сонгоогүй)"
                              }`
                            : `Product ID: ${
                                row.productId || "- (сонгоогүй)"
                              }`}
                        </span>
                        {row.itemType === "SERVICE" && (
                          <button
                            type="button"
                            onClick={() => openServiceModalForRow(index)}
                            style={{
                              marginLeft: 8,
                              padding: "2px 6px",
                              borderRadius: 999,
                              border: "1px solid #2563eb",
                              background: "#eff6ff",
                              color: "#2563eb",
                              cursor: "pointer",
                              fontSize: 11,
                            }}
                          >
                            Үйлчилгээ сонгох
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) =>
                        handleItemChange(index, "quantity", e.target.value)
                      }
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        fontSize: 13,
                        textAlign: "center",
                      }}
                    />

                    <input
                      type="number"
                      min={0}
                      value={row.unitPrice}
                      onChange={(e) =>
                        handleItemChange(index, "unitPrice", e.target.value)
                      }
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        fontSize: 13,
                        textAlign: "right",
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
                      onClick={() => handleRemoveRow(index)}
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
                Хөнгөлөлт (0 / 5 / 10%):{" "}
                <select
                  value={discountPercent}
                  onChange={(e) =>
                    setDiscountPercent(Number(e.target.value))
                  }
                  style={{
                    marginLeft: 8,
                    padding: "2px 4px",
                    fontSize: 13,
                  }}
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={10}>10%</option>
                </select>
              </div>
              <div>
                Төлөх дүн:{" "}
                <strong style={{ fontSize: 16 }}>
                  {finalAmount.toLocaleString("mn-MN")}₮
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
                  ? "Нэхэмжлэл хадгалж байна..."
                  : "Нэхэмжлэл хадгалах"}
              </button>
            </div>
          </section>

          {/* Payment section */}
          <BillingPaymentSection
            invoice={invoice}
            onUpdated={(updated) => setInvoice(updated)}
          />

          {/* Prescription summary (read-only) */}
          {encounter && (encounter as any).prescription && (
            <section
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
              }}
            >
              <h2 style={{ fontSize: 16, margin: 0, marginBottom: 8 }}>
                Эмийн жор (эмчийн бичсэн)
              </h2>

              {!(encounter as any).prescription.items ||
              (encounter as any).prescription.items.length === 0 ? (
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  Энэ үзлэгт эмийн жор бичигдээгүй байна.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "40px 2fr 80px 80px 80px 1.5fr",
                      gap: 6,
                      alignItems: "center",
                      fontSize: 12,
                      marginBottom: 4,
                      paddingBottom: 4,
                      borderBottom: "1px solid #e5e7eb",
                      color: "#6b7280",
                    }}
                  >
                    <div>№</div>
                    <div>Эмийн нэр / тун / хэлбэр</div>
                    <div style={{ textAlign: "center" }}>Нэг удаад</div>
                    <div style={{ textAlign: "center" }}>Өдөрт</div>
                    <div style={{ textAlign: "center" }}>Хэд хоног</div>
                    <div>Тэмдэглэл</div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      fontSize: 12,
                    }}
                  >
                    {(encounter as any).prescription.items
                      .slice()
                      .sort((a: any, b: any) => a.order - b.order)
                      .map((it: PrescriptionItem, idx: number) => (
                        <div
                          key={it.id ?? idx}
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "40px 2fr 80px 80px 80px 1.5fr",
                            gap: 6,
                            alignItems: "center",
                          }}
                        >
                          <div>{it.order ?? idx + 1}</div>
                          <div>{it.drugName}</div>
                          <div style={{ textAlign: "center" }}>
                            {it.quantityPerTake}x
                          </div>
                          <div style={{ textAlign: "center" }}>
                            {it.frequencyPerDay} / өдөр
                          </div>
                          <div style={{ textAlign: "center" }}>
                            {it.durationDays} хоног
                          </div>
                          <div>{it.note || "-"}</div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}

      {/* Service picker modal */}
      {serviceModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 80,
          }}
          onClick={closeServiceModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 480,
              maxWidth: "95vw",
              maxHeight: "80vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
              padding: 16,
              fontSize: 13,
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
              <h3 style={{ margin: 0, fontSize: 15 }}>Үйлчилгээ сонгох</h3>
              <button
                type="button"
                onClick={closeServiceModal}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                value={serviceQuery}
                onChange={(e) => setServiceQuery(e.target.value)}
                placeholder="Нэр эсвэл кодоор хайх..."
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                  fontSize: 13,
                }}
              />
            </div>

            {servicesLoading && (
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Үйлчилгээнүүдийг ачаалж байна...
              </div>
            )}
            {servicesError && (
              <div style={{ fontSize: 12, color: "#b91c1c" }}>
                {servicesError}
              </div>
            )}

            {!servicesLoading &&
              !servicesError &&
              filteredServices.length === 0 && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Хайлтад тохирох үйлчилгээ олдсонгүй.
                </div>
              )}

            <div
              style={{
                marginTop: 8,
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {filteredServices.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectServiceForRow(s)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 8px",
                    border: "none",
                    borderBottom: "1px solid #f3f4f6",
                    background: "#ffffff",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{s.name}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      marginTop: 2,
                    }}
                  >
                    Код: {s.code || "-"} • Үнэ:{" "}
                    {s.price.toLocaleString("mn-MN")}₮
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

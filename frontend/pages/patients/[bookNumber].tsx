import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

type Branch = {
  id: number;
  name: string;
  address?: string | null;
};

type Patient = {
  id: number;
  ovog?: string | null;
  name: string;
  regNo?: string | null;
  phone?: string | null;
  address?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  notes?: string | null;
  branchId: number;
  branch?: Branch;
  createdAt?: string;
};

type PatientBook = {
  id: number;
  bookNumber: string;
};

type ChartNote = {
  id: number;
  description: string;
  createdAt: string;
};

type ChartTooth = {
  id: number;
  toothCode: string;
  status?: string | null;
  notes?: string | null;
  chartNotes: ChartNote[];
};

type Procedure = {
  code: string;
  name: string;
  price: number;
};

type InvoiceItem = {
  id: number;
  price: number;
  quantity: number;
  procedure?: Procedure;
};

type Payment = {
  id: number;
  amount: number;
  method: string;
  qpayTxnId?: string | null;
  timestamp: string;
};

type EBarimtReceipt = {
  id: number;
  receiptNumber: string;
  timestamp: string;
};

type Invoice = {
  id: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  payment?: Payment | null;
  eBarimtReceipt?: EBarimtReceipt | null;
  invoiceItems: InvoiceItem[];
};

type Media = {
  id: number;
  encounterId: number;
  filePath: string;
  toothCode?: string | null;
  type: string;
};

type Doctor = {
  id: number;
  ovog?: string | null;
  name?: string | null;
  email: string;
};

type Encounter = {
  id: number;
  visitDate: string;
  notes?: string | null;
  doctorId: number;
  doctor: Doctor;
  invoice?: Invoice | null;
  chartTeeth: ChartTooth[];
  media: Media[];
};

type PatientProfileResponse = {
  patient: Patient;
  patientBook: PatientBook;
  encounters: Encounter[];
  invoices: Invoice[];
  media: Media[];
};

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatMoney(amount?: number) {
  if (amount == null) return "-";
  return amount.toLocaleString("mn-MN") + " ₮";
}

export default function PatientProfilePage() {
  const router = useRouter();
  const { bookNumber } = router.query;

  const [data, setData] = useState<PatientProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bookNumber || typeof bookNumber !== "string") return;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/patients/profile/by-book/${encodeURIComponent(bookNumber)}`
        );
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error((json && json.error) || "failed to load");
        }

        setData(json as PatientProfileResponse);
      } catch (err) {
        console.error(err);
        setError("Профайлыг ачааллах үед алдаа гарлаа");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [bookNumber]);

  const patient = data?.patient;
  const pb = data?.patientBook;

  return (
    <main
      style={{
        maxWidth: 1100,
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
        ← Буцах (Жагсаалт руу)
      </button>

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && patient && pb && (
        <>
          {/* Header / basic info */}
          <section style={{ marginBottom: 24 }}>
            <h1 style={{ marginBottom: 4 }}>
              {patient.ovog || ""} {patient.name}
            </h1>
            <div style={{ color: "#4b5563", fontSize: 14, marginBottom: 8 }}>
              Картын дугаар:{" "}
              <strong>{pb.bookNumber}</strong>{" "}
              {patient.regNo ? <> · РД: {patient.regNo}</> : null}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Утас: {patient.phone || "-"} · Салбар:{" "}
              {patient.branch?.name || patient.branchId}
              {patient.createdAt
                ? ` · Бүртгэсэн: ${formatDate(patient.createdAt)}`
                : ""}
            </div>
            {patient.address && (
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                Хаяг: {patient.address}
              </div>
            )}
            {patient.notes && (
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                Тэмдэглэл: {patient.notes}
              </div>
            )}
          </section>

          {/* Encounter / treatment history */}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              Үзлэг, эмчилгээний түүх
            </h2>
            {data!.encounters.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                Одоогоор бүртгэлтэй үзлэг алга.
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Огноо
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Эмч
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Тэмдэглэл
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Нэхэмжлэх
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data!.encounters.map((e) => (
                    <tr key={e.id}>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                        }}
                      >
                        {formatDateTime(e.visitDate)}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                        }}
                      >
                        {`${e.doctor.ovog || ""} ${
                          e.doctor.name || ""
                        }`.trim() || e.doctor.email}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                        }}
                      >
                        {e.notes || "-"}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                        }}
                      >
                        {e.invoice ? (
                          <>
                            <div>
                              Дүн:{" "}
                              <strong>
                                {formatMoney(e.invoice.totalAmount)}
                              </strong>{" "}
                              ({e.invoice.status})
                            </div>
                            {e.invoice.payment && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#6b7280",
                                }}
                              >
                                Төлбөр:{" "}
                                {formatMoney(e.invoice.payment.amount)} ·{" "}
                                {e.invoice.payment.method} ·{" "}
                                {formatDateTime(e.invoice.payment.timestamp)}
                              </div>
                            )}
                            {e.invoice.eBarimtReceipt && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#6b7280",
                                }}
                              >
                                E-Barimt:{" "}
                                {e.invoice.eBarimtReceipt.receiptNumber}
                              </div>
                            )}
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Payment / invoice summary */}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              Нэхэмжлэх, төлбөрийн түүх
            </h2>
            {data!.invoices.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                Нэхэмжлэхийн бүртгэл алга.
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Огноо
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Дүн
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Төлөв
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Төлбөр
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data!.invoices
                    .slice()
                    .sort((a, b) =>
                      a.createdAt.localeCompare(b.createdAt)
                    )
                    .map((inv) => (
                      <tr key={inv.id}>
                        <td
                          style={{
                            borderBottom: "1px solid #f3f4f6",
                            padding: 6,
                          }}
                        >
                          {formatDateTime(inv.createdAt)}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #f3f4f6",
                            padding: 6,
                          }}
                        >
                          {formatMoney(inv.totalAmount)}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #f3f4f6",
                            padding: 6,
                          }}
                        >
                          {inv.status}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #f3f4f6",
                            padding: 6,
                          }}
                        >
                          {inv.payment ? (
                            <>
                              <div>
                                {formatMoney(inv.payment.amount)} ·{" "}
                                {inv.payment.method}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#6b7280",
                                }}
                              >
                                {formatDateTime(inv.payment.timestamp)}
                              </div>
                            </>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Media attachments */}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              Хавсралт зураг, файл (Media)
            </h2>
            {data!.media.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                Одоогоор хавсралт алга.
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Encounter ID
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Төрөл
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Шүдний код
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 6,
                      }}
                    >
                      Файл
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data!.media.map((m) => (
                    <tr key={m.id}>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                        }}
                      >
                        {m.encounterId}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                        }}
                      >
                        {m.type}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                        }}
                      >
                        {m.toothCode || "-"}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                        }}
                      >
                        {m.filePath}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}

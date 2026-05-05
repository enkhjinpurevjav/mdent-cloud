import React, { useCallback, useMemo, useRef, useState } from "react";
import ReceptionLayout from "../../components/ReceptionLayout";
import EncounterReportModal from "../../components/patients/EncounterReportModal";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "next/router";

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentItem = {
  paymentId: number;
  invoiceId: number;
  encounterId: number | null;
  appointmentId: number | null;
  patientId: number | null;
  patientName: string | null;
  patientOvog: string | null;
  scheduledAt: string | null;
  visitDate: string | null;
  visitDateNaive?: string | null;
  doctorId: number | null;
  doctorName: string | null;
  doctorOvog: string | null;
  amount: number;
  collectedById: number | null;
  collectedByName: string | null;
  collectedByOvog: string | null;
  paymentTimestamp: string;
  meta: Record<string, unknown> | null;
};

type PaymentTypeGroup = {
  method: string;
  label: string;
  totalAmount: number;
  count: number;
  items: PaymentItem[];
};

type DailyIncomeResponse = {
  date: string;
  grandTotal: number;
  paymentTypes: PaymentTypeGroup[];
};

type PaymentProvider = { id: number; name: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMnt(v: number) {
  return `${Number(v || 0).toLocaleString("mn-MN")} ₮`;
}

function fmtName(
  ovog: string | null | undefined,
  name: string | null | undefined
) {
  const n = (name || "").trim();
  const o = (ovog || "").trim();
  if (o && n) return `${o[0]}. ${n}`;
  return n || o || "-";
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`h-4 w-4 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

// ── Expanded detail rows ───────────────────────────────────────────────────────

function DetailRows({
  items,
  method,
  providerMap,
  onOpenReport,
}: {
  items: PaymentItem[];
  method: string;
  providerMap: Map<number, string>;
  onOpenReport: (appointmentId: number) => void;
}) {
  const showProvider = method === "APPLICATION" || method === "INSURANCE";

  if (items.length === 0) {
    return (
      <tr>
        <td
          colSpan={showProvider ? 9 : 8}
          className="py-3 pl-10 text-sm text-gray-400 italic"
        >
          Дэлгэрэнгүй мэдээлэл байхгүй
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="bg-blue-50">
        <td className="py-2 pl-10 pr-2 text-xs font-semibold text-gray-500">
          #
        </td>
        <td className="px-2 py-2 text-xs font-semibold text-gray-500">
          Үйлчлүүлэгч
        </td>
        <td className="px-2 py-2 text-xs font-semibold text-gray-500">
          Нэхэмжлэл #
        </td>
        <td className="px-2 py-2 text-xs font-semibold text-gray-500">
          Үзлэгийн огноо
        </td>
        <td className="px-2 py-2 text-xs font-semibold text-gray-500">Эмч</td>
        {showProvider && (
          <td className="px-2 py-2 text-xs font-semibold text-gray-500">
            Нийлүүлэгч
          </td>
        )}
        <td className="px-2 py-2 text-right text-xs font-semibold text-gray-500">
          Дүн
        </td>
        <td className="px-2 py-2 text-xs font-semibold text-gray-500">
          Төлбөр хураасан
        </td>
        <td className="px-2 py-2 text-xs font-semibold text-gray-500">
          Үйлдэл
        </td>
      </tr>

      {items.map((item, idx) => {
        const providerId =
          item.meta && typeof (item.meta as any).providerId === "number"
            ? ((item.meta as any).providerId as number)
            : null;
        const providerName =
          providerId != null ? providerMap.get(providerId) ?? "-" : "-";

        return (
          <tr
            key={item.paymentId}
            className="border-t border-blue-100 bg-blue-50/60 hover:bg-blue-50"
          >
            <td className="py-2 pl-10 pr-2 text-sm text-gray-600">
              {idx + 1}
            </td>
            <td className="px-2 py-2 text-sm text-gray-800">
              {fmtName(item.patientOvog, item.patientName)}
            </td>
            <td className="px-2 py-2 text-sm text-gray-600">
              {item.invoiceId ? `#${item.invoiceId}` : "-"}
            </td>
            <td className="px-2 py-2 text-sm text-gray-600">
              {item.visitDateNaive || "-"}
            </td>
            <td className="px-2 py-2 text-sm text-gray-800">
              {fmtName(item.doctorOvog, item.doctorName)}
            </td>
            {showProvider && (
              <td className="px-2 py-2 text-sm text-gray-600">
                {providerName}
              </td>
            )}
            <td className="px-2 py-2 text-right text-sm font-medium text-gray-800">
              {fmtMnt(item.amount)}
            </td>
            <td className="px-2 py-2 text-sm text-gray-600">
              {fmtName(item.collectedByOvog, item.collectedByName)}
            </td>
            <td className="px-2 py-2">
              {item.appointmentId != null && (
                <div className="group relative inline-block">
                  <button
                    aria-label="Тайлан харах"
                    className="rounded-md border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50 hover:text-blue-600"
                    onClick={() => onOpenReport(item.appointmentId!)}
                  >
                    <EyeIcon />
                  </button>
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Үзлэгийн тайлан
                  </span>
                </div>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReceptionDailyIncomePage() {
  const { me } = useAuth();
  const router = useRouter();

  // Redirect non-reception/marketing roles away from this page
  React.useEffect(() => {
    if (me && me.role !== "receptionist" && me.role !== "marketing") {
      void router.replace("/login");
    }
  }, [me, router]);

  // Filters — date prefilled to today, but no auto-fetch
  const [date, setDate] = useState<string>(getTodayStr);

  // Reference data
  const [providerMap, setProviderMap] = useState<Map<number, string>>(
    new Map()
  );

  // Report state
  const [data, setData] = useState<DailyIncomeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // UI state
  const [submitted, setSubmitted] = useState(false);
  const [expandedMethods, setExpandedMethods] = useState<Set<string>>(
    new Set()
  );

  // Payment type filter
  const [selectedPaymentTypes, setSelectedPaymentTypes] = useState<Set<string>>(
    new Set()
  );
  const [paymentFilterOpen, setPaymentFilterOpen] = useState(false);
  const paymentFilterRef = useRef<HTMLDivElement>(null);

  // Encounter modal
  const [reportAppointmentId, setReportAppointmentId] = useState<number | null>(
    null
  );
  const [reportOpen, setReportOpen] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  // Load payment providers (for APPLICATION and INSURANCE) on mount
  React.useEffect(() => {
    fetch("/api/payment-settings")
      .then((r) => r.json())
      .then(
        (d: {
          methods?: Array<{ key: string; providers?: PaymentProvider[] }>;
        }) => {
          const map = new Map<number, string>();
          for (const m of d.methods ?? []) {
            if (m.key === "APPLICATION" || m.key === "INSURANCE") {
              for (const p of m.providers ?? []) {
                map.set(p.id, p.name);
              }
            }
          }
          setProviderMap(map);
        }
      )
      .catch(() => setProviderMap(new Map()));
  }, []);

  // Initialize payment type filter when data loads (select all by default)
  React.useEffect(() => {
    if (data) {
      setSelectedPaymentTypes(
        new Set(data.paymentTypes.map((pt) => pt.method))
      );
    }
  }, [data]);

  // Close payment filter dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        paymentFilterRef.current &&
        !paymentFilterRef.current.contains(e.target as Node)
      ) {
        setPaymentFilterOpen(false);
      }
    }
    if (paymentFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [paymentFilterOpen]);

  const fetchReport = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ date });
      const res = await fetch(`/api/reception/daily-income?${params}`);
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "Мэдээлэл татахад алдаа гарлаа");
      setData(json);
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Мэдээлэл татахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [date]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchReport();
  };

  const toggleMethod = (method: string) => {
    setExpandedMethods((prev) => {
      const next = new Set(prev);
      if (next.has(method)) {
        next.delete(method);
      } else {
        next.add(method);
      }
      return next;
    });
  };

  const openReport = (appointmentId: number) => {
    setReportAppointmentId(appointmentId);
    setReportOpen(true);
  };

  const filteredPaymentTypes = useMemo(() => {
    if (!data) return [];
    return data.paymentTypes.filter((g) => selectedPaymentTypes.has(g.method));
  }, [data, selectedPaymentTypes]);

  const grandTotal = useMemo(
    () => filteredPaymentTypes.reduce((s, g) => s + g.totalAmount, 0),
    [filteredPaymentTypes]
  );
  const totalCount = useMemo(
    () => filteredPaymentTypes.reduce((s, g) => s + g.count, 0),
    [filteredPaymentTypes]
  );

  // CSV export
  const handleExportCSV = () => {
    if (!data) return;

    const BOM = "\uFEFF";
    const rows: string[] = [
      `Өдрийн орлогын тайлан: ${data.date}`,
      "",
      "Төлбөрийн төрөл,Тоо,Нийт дүн (₮)",
      ...filteredPaymentTypes.map((g) => `"${g.label}",${g.count},${g.totalAmount}`),
      `"Нийт",${totalCount},${grandTotal}`,
      "",
      "Дэлгэрэнгүй",
      "Төлбөрийн төрөл,Үйлчлүүлэгч,Нэхэмжлэл #,Огноо,Эмч,Дүн (₮),Төлбөр хураасан",
      ...filteredPaymentTypes.flatMap((g) =>
        g.items.map(
          (item) =>
            `"${g.label}","${fmtName(item.patientOvog, item.patientName)}",${
              item.invoiceId
            },"${item.visitDateNaive || ""}","${fmtName(
              item.doctorOvog,
              item.doctorName
            )}",${item.amount},"${fmtName(
              item.collectedByOvog,
              item.collectedByName
            )}"`
        )
      ),
    ];

    const csv = BOM + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-income-${data.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <ReceptionLayout wide>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body > *:not(#reception-daily-income-printable) {
            display: none !important;
          }
          #reception-daily-income-printable {
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
          .print-break {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="w-full px-2 py-4 font-sans" id="reception-daily-income-printable">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900">
            Өдрийн орлогын тайлан
          </h1>
          {submitted && data && (
            <div className="no-print flex gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                CSV татах
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Хэвлэх
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <form
          onSubmit={handleSubmit}
          className="no-print mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Огноо</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>
          {/* Payment type multi-select filter – only visible after data loads */}
          {data && (
            <div className="flex flex-col gap-1" ref={paymentFilterRef}>
              <label className="text-xs font-semibold text-gray-600">
                Төлбөрийн төрөл
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPaymentFilterOpen((o) => !o)}
                  className="flex min-w-[160px] items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <span>
                    {selectedPaymentTypes.size === 0
                      ? "Сонгоогүй"
                      : selectedPaymentTypes.size === data.paymentTypes.length
                      ? "Бүгд"
                      : `${selectedPaymentTypes.size} сонгогдсон`}
                  </span>
                  <ChevronIcon open={paymentFilterOpen} />
                </button>
                {paymentFilterOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPaymentTypes(
                            new Set(data.paymentTypes.map((g) => g.method))
                          )
                        }
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Бүгд
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentTypes(new Set())}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700"
                      >
                        Цэвэрлэх
                      </button>
                    </div>
                    <ul className="max-h-48 overflow-y-auto py-1">
                      {data.paymentTypes.map((g) => (
                        <li key={g.method}>
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-gray-50">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-blue-600"
                              checked={selectedPaymentTypes.has(g.method)}
                              onChange={(e) => {
                                setSelectedPaymentTypes((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) {
                                    next.add(g.method);
                                  } else {
                                    next.delete(g.method);
                                  }
                                  return next;
                                });
                              }}
                            />
                            <span className="text-sm text-gray-700">
                              {g.label}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {/* Selected chips */}
              {selectedPaymentTypes.size > 0 &&
                selectedPaymentTypes.size < data.paymentTypes.length && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.paymentTypes
                      .filter((g) => selectedPaymentTypes.has(g.method))
                      .map((g) => (
                        <span
                          key={g.method}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                        >
                          {g.label}
                          <button
                            type="button"
                            aria-label={`${g.label} арилгах`}
                            onClick={() =>
                              setSelectedPaymentTypes((prev) => {
                                const next = new Set(prev);
                                next.delete(g.method);
                                return next;
                              })
                            }
                            className="ml-0.5 text-blue-400 hover:text-blue-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !date}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Ачаалж байна..." : "Хайх"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Not yet submitted */}
        {!submitted && !loading && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mb-3 h-10 w-10 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm">
              Огноо сонгоод &ldquo;Хайх&rdquo; дарна уу
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-gray-500">
            Ачаалж байна...
          </div>
        )}

        {/* Report */}
        {submitted && !loading && data && (
          <div ref={printRef}>
            {/* Print header (visible only in print) */}
            <div className="mb-4 hidden print:block">
              <h2 className="text-lg font-bold">Өдрийн орлогын тайлан</h2>
              <p className="text-sm text-gray-600">Огноо: {data.date}</p>
            </div>

            {/* Summary totals (top) */}
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-center">
                <p className="text-xs text-blue-600">Нийт орлого</p>
                <p className="text-xl font-bold text-blue-800">
                  {fmtMnt(grandTotal)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-center">
                <p className="text-xs text-gray-500">Нийт гүйлгээ</p>
                <p className="text-xl font-bold text-gray-800">{totalCount}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-center">
                <p className="text-xs text-gray-500">Төлбөрийн төрөл</p>
                <p className="text-xl font-bold text-gray-800">
                  {filteredPaymentTypes.length}
                </p>
              </div>
            </div>

            {/* Payment types table */}
            {selectedPaymentTypes.size === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
                Төлбөрийн төрөл сонгоогүй байна
              </div>
            ) : data.paymentTypes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
                Тухайн өдөр орлого байхгүй байна
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-600">
                        #
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-600">
                        Төлбөрийн төрөл
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">
                        Гүйлгээний тоо
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">
                        Нийт дүн
                      </th>
                      <th className="no-print px-4 py-3 font-semibold text-gray-600">
                        Үйлдэл
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPaymentTypes.map((group, idx) => (
                      <React.Fragment key={group.method}>
                        <tr
                          className={`border-t border-gray-200 ${
                            expandedMethods.has(group.method)
                              ? "bg-blue-50/40"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-3 text-gray-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {group.label}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {group.count}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">
                            {fmtMnt(group.totalAmount)}
                          </td>
                          <td className="no-print px-4 py-3">
                            <button
                              aria-label={
                                expandedMethods.has(group.method)
                                  ? "Хаах"
                                  : "Дэлгэрэнгүй харах"
                              }
                              onClick={() => toggleMethod(group.method)}
                              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                            >
                              <ChevronIcon
                                open={expandedMethods.has(group.method)}
                              />
                              {expandedMethods.has(group.method)
                                ? "Хаах"
                                : "Дэлгэрэнгүй"}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded detail rows */}
                        {expandedMethods.has(group.method) && (
                          <DetailRows
                            items={group.items}
                            method={group.method}
                            providerMap={providerMap}
                            onOpenReport={openReport}
                          />
                        )}

                        {/* For print: always show detail rows */}
                        {!expandedMethods.has(group.method) && (
                          <tr className="hidden print:table-row">
                            <td colSpan={5}>
                              <table className="w-full text-xs">
                                <tbody>
                                  {group.items.map((item) => {
                                    const showProvider =
                                      group.method === "APPLICATION" ||
                                      group.method === "INSURANCE";
                                    const providerId =
                                      showProvider &&
                                      item.meta &&
                                      typeof (item.meta as any).providerId ===
                                        "number"
                                        ? ((item.meta as any)
                                            .providerId as number)
                                        : null;
                                    const providerName =
                                      providerId != null
                                        ? providerMap.get(providerId) ?? "-"
                                        : "-";

                                    return (
                                      <tr
                                        key={item.paymentId}
                                        className="border-t border-blue-100 bg-blue-50/60"
                                      >
                                        <td className="py-1 pl-10 pr-2">
                                          {fmtName(
                                            item.patientOvog,
                                            item.patientName
                                          )}
                                        </td>
                                        <td className="px-2 py-1">
                                          #{item.invoiceId}
                                        </td>
                                        <td className="px-2 py-1">
                                          {item.visitDateNaive || "-"}
                                        </td>
                                        <td className="px-2 py-1">
                                          {fmtName(
                                            item.doctorOvog,
                                            item.doctorName
                                          )}
                                        </td>
                                        {showProvider && (
                                          <td className="px-2 py-1">
                                            {providerName}
                                          </td>
                                        )}
                                        <td className="px-2 py-1 text-right">
                                          {fmtMnt(item.amount)}
                                        </td>
                                        <td className="px-2 py-1">
                                          {fmtName(
                                            item.collectedByOvog,
                                            item.collectedByName
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}

                    {/* Totals row */}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                      <td className="px-4 py-3" colSpan={2}>
                        Нийт
                      </td>
                      <td className="px-4 py-3 text-right">{totalCount}</td>
                      <td className="px-4 py-3 text-right text-blue-700">
                        {fmtMnt(grandTotal)}
                      </td>
                      <td className="no-print px-4 py-3" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom totals summary */}
            {filteredPaymentTypes.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {filteredPaymentTypes.map((g) => (
                  <div
                    key={g.method}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-center shadow-sm"
                  >
                    <p className="text-xs text-gray-500">{g.label}</p>
                    <p className="text-sm font-bold text-gray-800">
                      {fmtMnt(g.totalAmount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Encounter report modal */}
      <EncounterReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        appointmentId={reportAppointmentId}
      />
    </ReceptionLayout>
  );
}

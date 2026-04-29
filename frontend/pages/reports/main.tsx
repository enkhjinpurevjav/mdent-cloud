import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TabKey = "summary" | "doctor" | "finance" | "treatment" | "appointments";
type RevenueMetric = "sales" | "collected" | "income";
type DoctorMetric = "sales" | "income" | "avgPerAppointment";
type TrendView = "monthly" | "daily";

type DoctorFilter = {
  id: number;
  name: string | null;
  ovog: string | null;
  branchId: number | null;
};

type MainReportResponse = {
  period: { from: string; to: string; view: TrendView };
  scope: { branchId: number | null; doctorId: number | null };
  filters: {
    branches: Array<{ id: number; name: string }>;
    doctors: DoctorFilter[];
  };
  kpis: {
    totalSales: number;
    collected: number;
    outstanding: number;
    nonCash: number;
    completedVisits: number;
  };
  revenueTrend: Array<{
    bucket: string;
    sales: number;
    collected: number;
    income: number;
  }>;
  paymentMethods: Array<{
    key: string;
    label: string;
    amount: number;
  }>;
  branchPerformance: Array<{
    branchId: number;
    branchName: string;
    sales: number;
    collected: number;
    completedVisits: number;
  }>;
  topDoctors: Array<{
    doctorId: number;
    doctorName: string;
    sales: number;
    income: number;
    completedCount: number;
    avgPerAppointment: number;
  }>;
};

const MONTH_LABELS = [
  "1-р сар",
  "2-р сар",
  "3-р сар",
  "4-р сар",
  "5-р сар",
  "6-р сар",
  "7-р сар",
  "8-р сар",
  "9-р сар",
  "10-р сар",
  "11-р сар",
  "12-р сар",
];

const DONUT_COLORS = [
  "#2563eb",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#ec4899",
];

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "summary", label: "Товч тайлан" },
  { key: "doctor", label: "Эмч" },
  { key: "finance", label: "Санхүү" },
  { key: "treatment", label: "Эмчилгээ" },
  { key: "appointments", label: "Цаг захиалга" },
];

const REVENUE_METRIC_LABEL: Record<RevenueMetric, string> = {
  sales: "Борлуулалт",
  collected: "Төлөлт",
  income: "Орлого",
};

const DOCTOR_METRIC_LABEL: Record<DoctorMetric, string> = {
  sales: "Борлуулалт",
  income: "Орлого",
  avgPerAppointment: "Үзлэг тутам",
};

function currentYearRange() {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function formatMoney(value: number) {
  return `${Math.round(Number(value || 0)).toLocaleString("mn-MN")}₮`;
}

function formatCompact(value: number) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} тэрб`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} сая`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} мян`;
  return String(Math.round(n));
}

function toDoctorShortName(d: { name?: string | null; ovog?: string | null; id?: number }) {
  const name = (d.name || "").trim();
  const ovog = (d.ovog || "").trim();
  if (ovog && name) return `${ovog.charAt(0)}.${name}`;
  if (name) return name;
  if (ovog) return ovog;
  return d.id ? `Эмч #${d.id}` : "Эмч";
}

function formatTrendLabel(bucket: string, view: TrendView) {
  if (view === "monthly") {
    const idx = Number(bucket.slice(5, 7)) - 1;
    return MONTH_LABELS[idx] || bucket;
  }
  const [y, m, d] = bucket.split("-");
  if (!y || !m || !d) return bucket;
  return `${Number(m)}/${Number(d)}`;
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const raw = row[h] == null ? "" : String(row[h]);
          if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
            return `"${raw.replace(/"/g, '""')}"`;
          }
          return raw;
        })
        .join(",")
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
    </div>
  );
}

function isDateRangeValid(from: string, to: string) {
  return Boolean(from && to && from <= to);
}

export default function MainReportPage() {
  const defaults = currentYearRange();
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [branchId, setBranchId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [revenueMetric, setRevenueMetric] = useState<RevenueMetric>("sales");
  const [doctorMetric, setDoctorMetric] = useState<DoctorMetric>("sales");
  const [data, setData] = useState<MainReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSummary = useCallback(async () => {
    if (!isDateRangeValid(from, to)) {
      setError("Огнооны муж буруу байна.");
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      if (branchId) params.set("branchId", branchId);
      if (doctorId) params.set("doctorId", doctorId);

      const res = await fetch(`/api/reports/main-overview?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        throw new Error(json?.error || "Тайлан ачааллахад алдаа гарлаа.");
      }
      setData(json as MainReportResponse);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Тайлан ачааллахад алдаа гарлаа.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, doctorId, from, to]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const doctorNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of data?.filters.doctors || []) {
      map.set(d.id, toDoctorShortName(d));
    }
    return map;
  }, [data?.filters.doctors]);

  const revenueChartData = useMemo(
    () =>
      (data?.revenueTrend || []).map((row) => ({
        ...row,
        label: formatTrendLabel(row.bucket, data?.period.view || "monthly"),
      })),
    [data?.period.view, data?.revenueTrend]
  );

  const donutData = useMemo(
    () =>
      (data?.paymentMethods || [])
        .filter((row) => row.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [data?.paymentMethods]
  );

  const branchChartData = useMemo(
    () => [...(data?.branchPerformance || [])].sort((a, b) => b.sales - a.sales),
    [data?.branchPerformance]
  );

  const topDoctorsData = useMemo(() => {
    const rows = [...(data?.topDoctors || [])]
      .map((row) => ({
        ...row,
        doctorLabel: doctorNameById.get(row.doctorId) || toDoctorShortName({ name: row.doctorName }),
      }))
      .sort((a, b) => Number(b[doctorMetric]) - Number(a[doctorMetric]))
      .slice(0, 5);
    return rows;
  }, [data?.topDoctors, doctorMetric, doctorNameById]);

  const exportCurrentTab = () => {
    if (!data) return;
    if (activeTab !== "summary") {
      downloadCsv("undsen_tailan.csv", [{ Таб: TAB_ITEMS.find((t) => t.key === activeTab)?.label || "" }]);
      return;
    }

    const rows: Array<Record<string, string | number>> = [
      { Төрөл: "Товч үзүүлэлт", Нэр: "Нийт нэхэмжилсэн", Утга: data.kpis.totalSales },
      { Төрөл: "Товч үзүүлэлт", Нэр: "Нийт төлсөн", Утга: data.kpis.collected },
      { Төрөл: "Товч үзүүлэлт", Нэр: "Нийт төлөгдөөгүй", Утга: data.kpis.outstanding },
      { Төрөл: "Товч үзүүлэлт", Нэр: "Мөнгөн бус", Утга: data.kpis.nonCash },
      { Төрөл: "Товч үзүүлэлт", Нэр: "Дууссан үзлэг", Утга: data.kpis.completedVisits },
    ];

    for (const row of data.revenueTrend) {
      rows.push({
        Төрөл: "Орлогын чиг хандлага",
        Огноо: row.bucket,
        Борлуулалт: row.sales,
        Төлөлт: row.collected,
        Орлого: row.income,
      });
    }
    for (const row of data.paymentMethods) {
      rows.push({ Төрөл: "Төлбөрийн төрлүүд", Нэр: row.label, Утга: row.amount });
    }
    for (const row of data.branchPerformance) {
      rows.push({
        Төрөл: "Салбарын харьцуулалт",
        Нэр: row.branchName,
        Борлуулалт: row.sales,
        Төлөлт: row.collected,
        "Дууссан үзлэг": row.completedVisits,
      });
    }
    for (const row of data.topDoctors) {
      rows.push({
        Төрөл: "Эмчийн эрэмбэ",
        Нэр: doctorNameById.get(row.doctorId) || toDoctorShortName({ name: row.doctorName }),
        Борлуулалт: row.sales,
        Орлого: row.income,
        "Үзлэг тутам": row.avgPerAppointment,
      });
    }
    downloadCsv("undsen_tailan_tovch.csv", rows);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Үндсэн тайлан</h1>

      <div className="mt-5 flex flex-wrap gap-2">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sticky top-0 z-20 mt-4 rounded-xl border border-gray-200 bg-white/95 p-3 backdrop-blur">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <label className="text-xs font-medium text-gray-600">
            Эхлэх огноо
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Дуусах огноо
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Салбар
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Бүх салбар</option>
              {(data?.filters.branches || []).map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            Эмч
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Бүх эмч</option>
              {(data?.filters.doctors || []).map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {toDoctorShortName(d)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void fetchSummary()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={!isDateRangeValid(from, to)}
          >
            Шүүх
          </button>
          <button
            type="button"
            onClick={exportCurrentTab}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Татах
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? <div className="mt-4 text-sm text-gray-600">Тайлан ачааллаж байна...</div> : null}

      {!loading && activeTab !== "summary" ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 text-gray-600">
          Энэ таб дараагийн шатанд хийгдэнэ.
        </div>
      ) : null}

      {!loading && activeTab === "summary" && data ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Нийт нэхэмжилсэн" value={formatMoney(data.kpis.totalSales)} />
            <KpiCard label="Нийт төлсөн" value={formatMoney(data.kpis.collected)} />
            <KpiCard label="Нийт төлөгдөөгүй" value={formatMoney(data.kpis.outstanding)} />
            <KpiCard label="Мөнгөн бус" value={formatMoney(data.kpis.nonCash)} />
            <KpiCard label="Дууссан үзлэг" value={String(data.kpis.completedVisits)} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-8">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">Орлогын чиг хандлага</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(["sales", "collected", "income"] as RevenueMetric[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRevenueMetric(m)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                        revenueMetric === m
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {REVENUE_METRIC_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(Number(v))} />
                    <Tooltip formatter={(v: number) => [formatMoney(v), REVENUE_METRIC_LABEL[revenueMetric]]} />
                    <Line
                      type="monotone"
                      dataKey={revenueMetric}
                      name={REVENUE_METRIC_LABEL[revenueMetric]}
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-4">
              <h3 className="mb-3 text-base font-semibold text-gray-900">Төлбөрийн төрлийн бүтэц</h3>
              {donutData.length > 0 ? (
                <>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} dataKey="amount" nameKey="label" innerRadius={50} outerRadius={88}>
                          {donutData.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatMoney(v), "Дүн"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 text-xs text-gray-700">
                    {donutData.map((row, i) => (
                      <div key={row.key} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                          />
                          <span className="truncate">{row.label}</span>
                        </div>
                        <span className="font-semibold text-gray-900">{formatMoney(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-56 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                  Өгөгдөл байхгүй
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-6">
              <h3 className="mb-3 text-base font-semibold text-gray-900">Салбарын харьцуулалт</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchChartData} layout="vertical" margin={{ left: 20, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(Number(v))} />
                    <YAxis type="category" dataKey="branchName" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [formatMoney(v), "Борлуулалт"]} />
                    <Bar dataKey="sales" name="Борлуулалт" fill="#2563eb" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">Эмчийн эрэмбэ (Топ 5)</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(["sales", "income", "avgPerAppointment"] as DoctorMetric[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDoctorMetric(m)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                        doctorMetric === m
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {DOCTOR_METRIC_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDoctorsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="doctorLabel" interval={0} angle={-25} textAnchor="end" height={82} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(Number(v))} />
                    <Tooltip
                      formatter={(v: number) => [
                        doctorMetric === "avgPerAppointment" ? formatMoney(v) : formatMoney(v),
                        DOCTOR_METRIC_LABEL[doctorMetric],
                      ]}
                    />
                    <Bar dataKey={doctorMetric} fill="#7c3aed" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

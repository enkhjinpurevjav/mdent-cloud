import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
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

type DoctorTabResponse = {
  period: { from: string; to: string; view: TrendView };
  scope: { branchId: number | null; doctorId: number | null };
  filters: {
    branches: Array<{ id: number; name: string }>;
    doctors: DoctorFilter[];
  };
  topN: 5 | 10 | 20;
  kpis: {
    totalDoctorIncome: number;
    totalSales: number;
    avgPerAppointment: number;
    completedAppointments: number;
  };
  trend: {
    buckets: string[];
    doctors: Array<{ doctorId: number; doctorName: string }>;
    rows: Array<Record<string, number | string>>;
    hasOther: boolean;
  };
  ranking: Array<{
    doctorId: number;
    doctorName: string;
    sales: number;
    income: number;
    avgPerAppointment: number;
  }>;
  avgPerPatient: Array<{
    doctorId: number;
    doctorName: string;
    value: number;
    sales: number;
    completedAppointments: number;
  }>;
  categoryBreakdown: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  table: Array<{
    doctorId: number;
    doctorName: string;
    branchName: string;
    sales: number;
    income: number;
    completedAppointments: number;
    completedServices: number;
    avgPerAppointment: number;
  }>;
};

type TreatmentTabResponse = {
  period: { from: string; to: string; view: TrendView };
  scope: { branchId: number | null; doctorId: number | null };
  filters: {
    branches: Array<{ id: number; name: string }>;
    doctors: DoctorFilter[];
  };
  topN: 5 | 10 | 20;
  kpis: {
    serviceRevenue: number;
    treatmentCount: number;
    avgServiceValue: number;
  };
  categoryDistribution: Array<{
    key: string;
    label: string;
    revenue: number;
    count: number;
  }>;
  topServices: Array<{
    serviceId: number;
    serviceName: string;
    categoryKey: string;
    categoryLabel: string;
    count: number;
    totalSales: number;
  }>;
  categoryTrend: {
    categories: Array<{ key: string; label: string }>;
    rows: Array<Record<string, number | string>>;
  };
  serviceTable: Array<{
    serviceId: number;
    serviceName: string;
    categoryKey: string;
    categoryLabel: string;
    count: number;
    totalSales: number;
  }>;
};

type AppointmentHeatmapDimension = "doctor" | "branch" | "chair";
type AppointmentTrendMetric = "total" | "completed" | "noShow";

type AppointmentTabResponse = {
  period: { from: string; to: string; view: TrendView };
  scope: {
    branchId: number | null;
    doctorId: number | null;
    heatmapDimension: AppointmentHeatmapDimension;
    heatmapTargetId: string | null;
    trendMetric: AppointmentTrendMetric;
  };
  filters: {
    branches: Array<{ id: number; name: string }>;
    doctors: DoctorFilter[];
    heatmapTargets: Array<{ id: string; label: string }>;
  };
  kpis: {
    total: number;
    completed: number;
    noShow: number;
    paymentPending: number;
  };
  trend: {
    metric: AppointmentTrendMetric;
    rows: Array<{
      bucket: string;
      total: number;
      completed: number;
      noShow: number;
    }>;
  };
  heatmap: {
    dimension: AppointmentHeatmapDimension;
    targetId: string | null;
    maxCount: number;
    rows: Array<{
      weekday: number;
      weekdayLabel: string;
      time: string;
      count: number;
    }>;
  };
  utilization: {
    rows: Array<{
      doctorId: number;
      doctorName: string;
      availableHours: number;
      bookedHours: number;
      utilizationPct: number;
      state: "overloaded" | "underused" | "normal";
    }>;
    overloadedDoctors: Array<{
      doctorId: number;
      doctorName: string;
      availableHours: number;
      bookedHours: number;
      utilizationPct: number;
      state: "overloaded" | "underused" | "normal";
    }>;
    underusedDoctors: Array<{
      doctorId: number;
      doctorName: string;
      availableHours: number;
      bookedHours: number;
      utilizationPct: number;
      state: "overloaded" | "underused" | "normal";
    }>;
  };
  repeatVisit: {
    totalPatients: number;
    returningPatients: number;
    repeatVisitPct: number;
  };
};

type DoctorTrendChartRow = {
  bucket: string;
  label: string;
  others?: number;
} & Record<string, string | number | undefined>;

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

const TOP_N_OPTIONS = [5, 10, 20] as const;
const DOCTOR_CHART_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
  "#f97316",
];
const APPOINTMENT_TREND_LABEL: Record<AppointmentTrendMetric, string> = {
  total: "Нийт",
  completed: "Дууссан",
  noShow: "Ирээгүй",
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
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}.${parts.slice(1).join(" ")}`;
    }
    return name;
  }
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
  const [doctorTabData, setDoctorTabData] = useState<DoctorTabResponse | null>(null);
  const [treatmentTabData, setTreatmentTabData] = useState<TreatmentTabResponse | null>(null);
  const [doctorTopN, setDoctorTopN] = useState<5 | 10 | 20>(10);
  const [treatmentTopN, setTreatmentTopN] = useState<5 | 10 | 20>(20);
  const [appointmentsTrendMetric, setAppointmentsTrendMetric] =
    useState<AppointmentTrendMetric>("total");
  const [appointmentsHeatmapDimension, setAppointmentsHeatmapDimension] =
    useState<AppointmentHeatmapDimension>("doctor");
  const [appointmentsHeatmapTargetId, setAppointmentsHeatmapTargetId] = useState("");
  const [doctorRankingMetric, setDoctorRankingMetric] = useState<DoctorMetric>("sales");
  const [appointmentsTabData, setAppointmentsTabData] = useState<AppointmentTabResponse | null>(null);
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

  const fetchDoctorTab = useCallback(async () => {
    if (!isDateRangeValid(from, to)) {
      setError("Огнооны муж буруу байна.");
      setDoctorTabData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to, topN: String(doctorTopN) });
      if (branchId) params.set("branchId", branchId);
      if (doctorId) params.set("doctorId", doctorId);
      const res = await fetch(`/api/reports/main-doctor?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        throw new Error(json?.error || "Эмчийн тайлан ачааллахад алдаа гарлаа.");
      }
      setDoctorTabData(json as DoctorTabResponse);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Эмчийн тайлан ачааллахад алдаа гарлаа.");
      setDoctorTabData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, doctorId, doctorTopN, from, to]);

  const fetchTreatmentTab = useCallback(async () => {
    if (!isDateRangeValid(from, to)) {
      setError("Огнооны муж буруу байна.");
      setTreatmentTabData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to, topN: String(treatmentTopN) });
      if (branchId) params.set("branchId", branchId);
      if (doctorId) params.set("doctorId", doctorId);
      const res = await fetch(`/api/reports/main-treatment?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        throw new Error(json?.error || "Эмчилгээний тайлан ачааллахад алдаа гарлаа.");
      }
      setTreatmentTabData(json as TreatmentTabResponse);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Эмчилгээний тайлан ачааллахад алдаа гарлаа.");
      setTreatmentTabData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, doctorId, from, to, treatmentTopN]);

  const fetchAppointmentsTab = useCallback(async () => {
    if (!isDateRangeValid(from, to)) {
      setError("Огнооны муж буруу байна.");
      setAppointmentsTabData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        from,
        to,
        trendMetric: appointmentsTrendMetric,
        heatmapDimension: appointmentsHeatmapDimension,
      });
      if (branchId) params.set("branchId", branchId);
      if (doctorId) params.set("doctorId", doctorId);
      if (appointmentsHeatmapTargetId) params.set("heatmapTargetId", appointmentsHeatmapTargetId);
      const res = await fetch(`/api/reports/main-appointments?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        throw new Error(json?.error || "Цаг захиалгын тайлан ачааллахад алдаа гарлаа.");
      }
      setAppointmentsTabData(json as AppointmentTabResponse);
      const nextTarget = (json as AppointmentTabResponse)?.scope?.heatmapTargetId || "";
      if (String(nextTarget || "") !== String(appointmentsHeatmapTargetId || "")) {
        setAppointmentsHeatmapTargetId(String(nextTarget || ""));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Цаг захиалгын тайлан ачааллахад алдаа гарлаа.");
      setAppointmentsTabData(null);
    } finally {
      setLoading(false);
    }
  }, [
    appointmentsHeatmapDimension,
    appointmentsHeatmapTargetId,
    appointmentsTrendMetric,
    branchId,
    doctorId,
    from,
    to,
  ]);

  useEffect(() => {
    if (appointmentsHeatmapDimension !== "chair") {
      setAppointmentsHeatmapTargetId("");
    }
  }, [appointmentsHeatmapDimension]);

  useEffect(() => {
    if (activeTab === "doctor") {
      void fetchDoctorTab();
      return;
    }
    if (activeTab === "treatment") {
      void fetchTreatmentTab();
      return;
    }
    if (activeTab === "appointments") {
      void fetchAppointmentsTab();
      return;
    }
    void fetchSummary();
  }, [activeTab, fetchAppointmentsTab, fetchDoctorTab, fetchSummary, fetchTreatmentTab]);

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

  const doctorTrendChartData = useMemo<DoctorTrendChartRow[]>(
    () =>
      (doctorTabData?.trend.rows || []).map((row) => {
        const rawBucket = String(row.bucket || "");
        return {
          ...(row as Record<string, string | number | undefined>),
          bucket: rawBucket,
          label: formatTrendLabel(rawBucket, doctorTabData?.period.view || "monthly"),
        };
      }),
    [doctorTabData?.period.view, doctorTabData?.trend.rows]
  );

  const treatmentTrendChartData = useMemo(
    () =>
      (treatmentTabData?.categoryTrend.rows || []).map((row) => ({
        ...row,
        label: formatTrendLabel(
          String(row.bucket || ""),
          treatmentTabData?.period.view || "monthly"
        ),
      })),
    [treatmentTabData?.categoryTrend.rows, treatmentTabData?.period.view]
  );

  const selectedDoctorName = useMemo(() => {
    if (!doctorId) return "";
    const idNum = Number(doctorId);
    if (!Number.isFinite(idNum)) return "";
    const fromDoctorFilter = doctorTabData?.filters.doctors.find((d) => d.id === idNum);
    if (fromDoctorFilter) return toDoctorShortName(fromDoctorFilter);
    const fromSummaryFilter = data?.filters.doctors.find((d) => d.id === idNum);
    if (fromSummaryFilter) return toDoctorShortName(fromSummaryFilter);
    return "";
  }, [data?.filters.doctors, doctorId, doctorTabData?.filters.doctors]);

  const appointmentsTrendChartData = useMemo(
    () =>
      (appointmentsTabData?.trend.rows || []).map((row) => ({
        ...row,
        label: formatTrendLabel(String(row.bucket || ""), appointmentsTabData?.period.view || "monthly"),
      })),
    [appointmentsTabData?.period.view, appointmentsTabData?.trend.rows]
  );

  const appointmentsHeatmapMatrix = useMemo(() => {
    if (!appointmentsTabData) return [];
    const weekdayOrder = [1, 2, 3, 4, 5, 6, 7];
    const weekdayLabelMap = new Map<number, string>();
    const times = new Set<string>();
    const byWeekday = new Map<number, Map<string, number>>();

    for (const row of appointmentsTabData.heatmap.rows) {
      weekdayLabelMap.set(row.weekday, row.weekdayLabel);
      times.add(row.time);
      if (!byWeekday.has(row.weekday)) {
        byWeekday.set(row.weekday, new Map());
      }
      byWeekday.get(row.weekday)!.set(row.time, row.count);
    }

    const sortedTimes = Array.from(times).sort((a, b) => a.localeCompare(b));
    return weekdayOrder.map((weekday) => {
      const rowCounts = byWeekday.get(weekday) || new Map();
      return {
        weekday,
        weekdayLabel: weekdayLabelMap.get(weekday) || "",
        slots: sortedTimes.map((time) => ({
          time,
          count: Number(rowCounts.get(time) || 0),
        })),
      };
    });
  }, [appointmentsTabData]);

  function heatColor(count: number, max: number) {
    if (max <= 0 || count <= 0) return "rgb(243 244 246)";
    const ratio = Math.max(0, Math.min(1, count / max));
    const lightness = 94 - ratio * 52;
    return `hsl(217 91% ${lightness.toFixed(1)}%)`;
  }

  const exportCurrentTab = () => {
    if (activeTab === "doctor") {
      if (!doctorTabData) return;
      const rows: Array<Record<string, string | number>> = [
        { Төрөл: "Товч үзүүлэлт", Нэр: "Нийт эмчийн орлого", Утга: doctorTabData.kpis.totalDoctorIncome },
        { Төрөл: "Товч үзүүлэлт", Нэр: "Нийт борлуулалт", Утга: doctorTabData.kpis.totalSales },
        { Төрөл: "Товч үзүүлэлт", Нэр: "Нэг үзлэгт ногдох дундаж", Утга: doctorTabData.kpis.avgPerAppointment },
        { Төрөл: "Товч үзүүлэлт", Нэр: "Дууссан үзлэг", Утга: doctorTabData.kpis.completedAppointments },
      ];
      for (const row of doctorTabData.table) {
        rows.push({
          Төрөл: "Эмчийн хүснэгт",
          Эмч: row.doctorName,
          Салбар: row.branchName,
          Борлуулалт: row.sales,
          Орлого: row.income,
          "Дууссан үзлэг": row.completedAppointments,
          "Дууссан үйлчилгээ": row.completedServices,
          "Нэг үзлэгт ногдох дундаж": row.avgPerAppointment,
        });
      }
      downloadCsv("undsen_tailan_emch.csv", rows);
      return;
    }
    if (activeTab === "treatment") {
      if (!treatmentTabData) return;
      const rows: Array<Record<string, string | number>> = [
        { Төрөл: "Товч үзүүлэлт", Нэр: "Үйлчилгээний борлуулалт", Утга: treatmentTabData.kpis.serviceRevenue },
        { Төрөл: "Товч үзүүлэлт", Нэр: "Эмчилгээний тоо", Утга: treatmentTabData.kpis.treatmentCount },
        {
          Төрөл: "Товч үзүүлэлт",
          Нэр: "Нэг үйлчилгээний дундаж үнэ",
          Утга: treatmentTabData.kpis.avgServiceValue,
        },
      ];
      for (const row of treatmentTabData.serviceTable) {
        rows.push({
          Ангилал: "Эмчилгээний хүснэгт",
          Үйлчилгээ: row.serviceName,
          Төрөл: row.categoryLabel,
          Тоо: row.count,
        });
      }
      downloadCsv("undsen_tailan_emchilgee.csv", rows);
      return;
    }
    if (activeTab === "appointments") {
      if (!appointmentsTabData) return;
      const rows: Array<Record<string, string | number>> = [
        { Төрөл: "Товч үзүүлэлт", Нэр: "Нийт", Утга: appointmentsTabData.kpis.total },
        { Төрөл: "Товч үзүүлэлт", Нэр: "Дууссан", Утга: appointmentsTabData.kpis.completed },
        { Төрөл: "Товч үзүүлэлт", Нэр: "Ирээгүй", Утга: appointmentsTabData.kpis.noShow },
        {
          Төрөл: "Товч үзүүлэлт",
          Нэр: "Төлбөрийн үлдэгдэлтэй",
          Утга: appointmentsTabData.kpis.paymentPending,
        },
      ];
      for (const row of appointmentsTabData.trend.rows) {
        rows.push({
          Төрөл: "Цаг захиалгын график",
          Огноо: row.bucket,
          Нийт: row.total,
          Дууссан: row.completed,
          Ирээгүй: row.noShow,
        });
      }
      for (const r of appointmentsTabData.utilization.rows) {
        rows.push({
          Төрөл: "Эмчийн ачаалал",
          Эмч: r.doctorName,
          "Боломжит цаг": r.availableHours,
          "Захиалагдсан цаг": r.bookedHours,
          "Ашиглалт %": r.utilizationPct,
        });
      }
      rows.push({
        Төрөл: "Давтан үзлэг",
        "Нийт өвчтөн": appointmentsTabData.repeatVisit.totalPatients,
        "Буцаж ирсэн өвчтөн": appointmentsTabData.repeatVisit.returningPatients,
        "Repeat Visit %": appointmentsTabData.repeatVisit.repeatVisitPct,
      });
      downloadCsv("undsen_tailan_tsag_zakhialga.csv", rows);
      return;
    }
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
              {(
                (activeTab === "doctor"
                  ? doctorTabData?.filters.branches
                  : activeTab === "treatment"
                    ? treatmentTabData?.filters.branches
                    : activeTab === "appointments"
                      ? appointmentsTabData?.filters.branches
                    : data?.filters.branches) || []
              ).map((b) => (
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
              {(
                (activeTab === "doctor"
                  ? doctorTabData?.filters.doctors
                  : activeTab === "treatment"
                    ? treatmentTabData?.filters.doctors
                    : activeTab === "appointments"
                      ? appointmentsTabData?.filters.doctors
                    : data?.filters.doctors) || []
              ).map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {toDoctorShortName(d)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              if (activeTab === "doctor") {
                void fetchDoctorTab();
                return;
              }
              if (activeTab === "treatment") {
                void fetchTreatmentTab();
                return;
              }
              if (activeTab === "appointments") {
                void fetchAppointmentsTab();
                return;
              }
              void fetchSummary();
            }}
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

      {!loading && !["summary", "doctor", "treatment", "appointments"].includes(activeTab) ? (
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

      {!loading && activeTab === "doctor" && doctorTabData ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Нийт борлуулалт" value={formatMoney(doctorTabData.kpis.totalSales)} />
            <KpiCard label="Нийт эмчийн орлого" value={formatMoney(doctorTabData.kpis.totalDoctorIncome)} />
            <KpiCard label="Нэг үзлэгт ногдох дундаж" value={formatMoney(doctorTabData.kpis.avgPerAppointment)} />
            <KpiCard label="Дууссан үзлэг" value={doctorTabData.kpis.completedAppointments.toLocaleString("mn-MN")} />
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900">Эмчийн борлуулалтын график</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Топ:</span>
                <select
                  value={doctorTopN}
                  onChange={(e) => setDoctorTopN(Number(e.target.value) as 5 | 10 | 20)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  disabled={Boolean(doctorId)}
                >
                  {TOP_N_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={doctorTrendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(Number(v))} />
                  <Tooltip
                    formatter={(v: number | string, name: string | number) => {
                      const numeric = Number(v || 0);
                      if (name === "others") {
                        return [formatMoney(numeric), "Бусад"];
                      }
                      const doctorName =
                        doctorTabData.trend.doctors.find((d) => String(d.doctorId) === String(name))
                          ?.doctorName || String(name);
                      return [formatMoney(numeric), doctorName];
                    }}
                    itemSorter={(item: { value?: number | string | ReadonlyArray<string | number> }) =>
                      -Number(item?.value || 0)
                    }
                  />
                  {doctorTabData.trend.doctors.map((d, idx) => (
                    <Line
                      key={d.doctorId}
                      type="monotone"
                      dataKey={String(d.doctorId)}
                      name={d.doctorName}
                      stroke={DOCTOR_CHART_COLORS[idx % DOCTOR_CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                  {doctorTabData.trend.hasOther ? (
                    <Line
                      type="monotone"
                      dataKey="others"
                      name="Бусад"
                      stroke="#9ca3af"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="4 4"
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">Эмчийн орлогын эрэмбэ</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(["sales", "income", "avgPerAppointment"] as DoctorMetric[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDoctorRankingMetric(m)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                        doctorRankingMetric === m
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
                  <BarChart
                    data={[...doctorTabData.ranking]
                      .sort((a, b) => Number(b[doctorRankingMetric]) - Number(a[doctorRankingMetric]))
                      .slice(0, doctorTabData.topN)}
                    layout="vertical"
                    margin={{ left: 20, right: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(Number(v))} />
                    <YAxis type="category" dataKey="doctorName" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number) => [formatMoney(v), DOCTOR_METRIC_LABEL[doctorRankingMetric]]}
                    />
                    <Bar dataKey={doctorRankingMetric} fill="#2563eb" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-6">
              <h3 className="mb-3 text-base font-semibold text-gray-900">Нэг үзлэгт ногдох борлуулалт</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={doctorTabData.avgPerPatient}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="doctorName"
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={82}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(Number(v))} />
                    <Tooltip formatter={(v: number) => [formatMoney(v), "Нэг үзлэгт ногдох дундаж"]} />
                    <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-12">
              <h3 className="mb-3 text-base font-semibold text-gray-900">Эмчийн хүснэгт</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Эмч</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Салбар</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Борлуулалт</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Эмчийн орлого</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Дууссан үзлэг</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Дууссан үйлчилгээ</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Нэг үзлэгт ногдох дундаж</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorTabData.table.map((r) => (
                      <tr key={r.doctorId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-800">{r.doctorName}</td>
                        <td className="px-3 py-2 text-gray-700">{r.branchName}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">{formatMoney(r.sales)}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">{formatMoney(r.income)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {r.completedAppointments.toLocaleString("mn-MN")}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {r.completedServices.toLocaleString("mn-MN")}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{formatMoney(r.avgPerAppointment)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {doctorId ? (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-semibold text-gray-900">
                Төрлийн бүтэц
                {selectedDoctorName ? ` — ${selectedDoctorName}` : ""}
              </h3>
              {doctorTabData.categoryBreakdown.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="h-72 xl:col-span-5">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={doctorTabData.categoryBreakdown}
                          dataKey="count"
                          nameKey="label"
                          innerRadius={58}
                          outerRadius={110}
                        >
                          {doctorTabData.categoryBreakdown.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [String(v), "Үйлчилгээний тоо"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="xl:col-span-7">
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      {doctorTabData.categoryBreakdown.map((r, i) => (
                        <div key={r.key} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                            <span className="text-gray-700">{r.label}</span>
                          </div>
                          <span className="font-semibold text-gray-900">{r.count.toLocaleString("mn-MN")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                  Сонгосон эмч дээр ангиллын өгөгдөл байхгүй байна.
                </div>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {!loading && activeTab === "treatment" && treatmentTabData ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Үйлчилгээний борлуулалт" value={formatMoney(treatmentTabData.kpis.serviceRevenue)} />
            <KpiCard label="Эмчилгээний тоо" value={treatmentTabData.kpis.treatmentCount.toLocaleString("mn-MN")} />
            <KpiCard label="Нэг үйлчилгээний дундаж үнэ" value={formatMoney(treatmentTabData.kpis.avgServiceValue)} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-6">
              <h3 className="mb-3 text-base font-semibold text-gray-900">Борлуулалтын бүтэц</h3>
              {treatmentTabData.categoryDistribution.length > 0 ? (
                <>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={treatmentTabData.categoryDistribution}
                          dataKey="revenue"
                          nameKey="label"
                          innerRadius={52}
                          outerRadius={102}
                        >
                          {treatmentTabData.categoryDistribution.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number, _name: string | number, item: { payload?: { label?: string } }) => [
                            formatMoney(v),
                            item?.payload?.label || "",
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 text-xs text-gray-700">
                    {treatmentTabData.categoryDistribution.map((row, i) => (
                      <div key={row.key} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                          />
                          <span className="truncate">{row.label}</span>
                        </div>
                        <span className="font-semibold text-gray-900">{formatMoney(row.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                  Өгөгдөл байхгүй
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">Топ үйлчилгээний борлуулалт</h3>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Топ:</span>
                  <select
                    value={treatmentTopN}
                    onChange={(e) => setTreatmentTopN(Number(e.target.value) as 5 | 10 | 20)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  >
                    {TOP_N_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={treatmentTabData.topServices.map((row) => ({
                      ...row,
                      totalSales: Number(row.totalSales || 0),
                    }))}
                    layout="vertical"
                    margin={{ left: 20, right: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      domain={[0, "dataMax"]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatCompact(Number(v))}
                    />
                    <YAxis type="category" dataKey="serviceName" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [formatMoney(v), "Борлуулалт"]} />
                    <Bar dataKey="totalSales" fill="#2563eb" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Эмчилгээний төрлийн график</h3>
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={treatmentTrendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(Number(v))} />
                  <Tooltip
                    formatter={(v: number, name: string | number) => {
                      const label =
                        treatmentTabData.categoryTrend.categories.find((c) => c.key === String(name))?.label ||
                        String(name || "");
                      return [formatMoney(v), label];
                    }}
                    itemSorter={(item) => -Number(item?.value ?? 0)}
                  />
                  {treatmentTabData.categoryTrend.categories.map((cat, i) => (
                    <Area
                      key={cat.key}
                      type="monotone"
                      dataKey={cat.key}
                      stackId="1"
                      name={cat.label}
                      stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                      fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                      fillOpacity={0.45}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Эмчилгээний хүснэгт</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Үйлчилгээ</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Төрөл</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Тоо</th>
                  </tr>
                </thead>
                <tbody>
                  {treatmentTabData.serviceTable.map((row) => (
                    <tr key={row.serviceId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-800">{row.serviceName}</td>
                      <td className="px-3 py-2 text-gray-700">{row.categoryLabel}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{row.count.toLocaleString("mn-MN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {!loading && activeTab === "appointments" && appointmentsTabData ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Нийт" value={appointmentsTabData.kpis.total.toLocaleString("mn-MN")} />
            <KpiCard label="Дууссан" value={appointmentsTabData.kpis.completed.toLocaleString("mn-MN")} />
            <KpiCard label="Ирээгүй" value={appointmentsTabData.kpis.noShow.toLocaleString("mn-MN")} />
            <KpiCard
              label="Төлбөрийн үлдэгдэлтэй"
              value={appointmentsTabData.kpis.paymentPending.toLocaleString("mn-MN")}
            />
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900">Цаг захиалгын график</h3>
              <div className="flex flex-wrap gap-1.5">
                {(["total", "completed", "noShow"] as const).map((metric) => (
                  <button
                    key={metric}
                    type="button"
                    onClick={() => setAppointmentsTrendMetric(metric)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                      appointmentsTrendMetric === metric
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {APPOINTMENT_TREND_LABEL[metric]}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={appointmentsTrendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [String(Math.round(v || 0)), APPOINTMENT_TREND_LABEL[appointmentsTrendMetric]]}
                  />
                  <Line
                    type="monotone"
                    dataKey={appointmentsTrendMetric}
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900">Цагийн ачааллын heatmap</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={appointmentsHeatmapDimension}
                  onChange={(e) =>
                    setAppointmentsHeatmapDimension(e.target.value as "doctor" | "branch" | "chair")
                  }
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="doctor">Эмч</option>
                  <option value="branch">Салбар</option>
                  <option value="chair">Сандал</option>
                </select>
                <select
                  value={appointmentsHeatmapTargetId}
                  onChange={(e) => setAppointmentsHeatmapTargetId(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  {(appointmentsTabData.filters.heatmapTargets || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              {appointmentsHeatmapMatrix.length > 0 ? (
                <div className="min-w-[860px]">
                  <div
                    className="grid gap-1 text-[11px] text-gray-500"
                    style={{
                      gridTemplateColumns: `100px repeat(${appointmentsHeatmapMatrix[0].slots.length}, minmax(28px, 1fr))`,
                    }}
                  >
                    <div />
                    {appointmentsHeatmapMatrix[0].slots.map((slot) => (
                      <div key={slot.time} className="text-center">
                        {slot.time}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {appointmentsHeatmapMatrix.map((weekdayRow) => (
                      <div
                        key={weekdayRow.weekday}
                        className="grid gap-1"
                        style={{
                          gridTemplateColumns: `100px repeat(${weekdayRow.slots.length}, minmax(28px, 1fr))`,
                        }}
                      >
                        <div className="self-center pr-2 text-xs font-medium text-gray-700">
                          {weekdayRow.weekdayLabel}
                        </div>
                        {weekdayRow.slots.map((slot) => (
                          <div
                            key={`${weekdayRow.weekday}-${slot.time}`}
                            className="h-8 rounded-sm border border-gray-100"
                            style={{ backgroundColor: heatColor(slot.count, appointmentsTabData.heatmap.maxCount) }}
                            title={`${weekdayRow.weekdayLabel} ${slot.time} — ${slot.count}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                  Өгөгдөл байхгүй
                </div>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-8">
              <h3 className="mb-3 text-base font-semibold text-gray-900">Эмчийн ачаалал</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Эмч</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Боломжит цаг</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Захиалагдсан цаг</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Ашиглалт</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Төлөв</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointmentsTabData.utilization.rows.map((r) => (
                      <tr key={r.doctorId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-800">{r.doctorName}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.availableHours.toLocaleString("mn-MN")}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.bookedHours.toLocaleString("mn-MN")}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">{r.utilizationPct.toLocaleString("mn-MN")}%</td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              r.state === "overloaded"
                                ? "bg-red-100 text-red-700"
                                : r.state === "underused"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {r.state === "overloaded"
                              ? "Хэт ачаалалтай"
                              : r.state === "underused"
                                ? "Ачаалал багатай"
                                : "Хэвийн"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-4">
              <h3 className="mb-3 text-base font-semibold text-gray-900">Давтан үзлэг</h3>
              <div className="space-y-3">
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-500">Нийт өвчтөн</p>
                  <p className="text-xl font-bold text-gray-900">
                    {appointmentsTabData.repeatVisit.totalPatients.toLocaleString("mn-MN")}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-500">Буцаж ирсэн өвчтөн</p>
                  <p className="text-xl font-bold text-gray-900">
                    {appointmentsTabData.repeatVisit.returningPatients.toLocaleString("mn-MN")}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                  <p className="text-xs text-blue-600">Repeat Visit %</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {appointmentsTabData.repeatVisit.repeatVisitPct.toLocaleString("mn-MN")}%
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-red-700">Хэт ачаалалтай</p>
                  <ul className="space-y-1 text-xs text-gray-700">
                    {appointmentsTabData.utilization.overloadedDoctors.length > 0 ? (
                      appointmentsTabData.utilization.overloadedDoctors.map((d) => (
                        <li key={`over-${d.doctorId}`}>
                          {d.doctorName} ({d.utilizationPct.toLocaleString("mn-MN")}%)
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-500">Байхгүй</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-amber-700">Ачаалал багатай</p>
                  <ul className="space-y-1 text-xs text-gray-700">
                    {appointmentsTabData.utilization.underusedDoctors.length > 0 ? (
                      appointmentsTabData.utilization.underusedDoctors.map((d) => (
                        <li key={`under-${d.doctorId}`}>
                          {d.doctorName} ({d.utilizationPct.toLocaleString("mn-MN")}%)
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-500">Байхгүй</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

type MainReportResponse = {
  period: { from: string; to: string; view: "monthly" };
  scope: { branchId: number | null; doctorId: number | null };
  filters: {
    branches: Array<{ id: number; name: string }>;
    doctors: Array<{ id: number; name: string | null; ovog: string | null; branchId: number | null }>;
  };
  kpis: {
    totalSales: number;
    collected: number;
    outstanding: number;
    nonCash: number;
    completedVisits: number;
  };
  revenueTrend: Array<{
    month: string;
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
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "summary", label: "Товч тайлан" },
  { key: "doctor", label: "Эмч" },
  { key: "finance", label: "Санхүү" },
  { key: "treatment", label: "Эмчилгээ" },
  { key: "appointments", label: "Цаг захиалга" },
];

function currentYearFromDate() {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function fmtMoney(value: number) {
  return `${Math.round(Number(value || 0)).toLocaleString("mn-MN")}₮`;
}

function monthLabel(ym: string) {
  const idx = Number(String(ym).slice(5, 7)) - 1;
  return MONTH_LABELS[idx] || ym;
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

export default function MainReportPage() {
  const defaults = currentYearFromDate();
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
    } catch (e: any) {
      setError(e?.message || "Тайлан ачааллахад алдаа гарлаа.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, branchId, doctorId]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const revenueChartData = useMemo(
    () =>
      (data?.revenueTrend || []).map((row) => ({
        ...row,
        label: monthLabel(row.month),
      })),
    [data?.revenueTrend]
  );

  const donutData = useMemo(
    () =>
      (data?.paymentMethods || [])
        .filter((row) => row.amount > 0)
        .map((row) => ({ name: row.label, value: row.amount })),
    [data?.paymentMethods]
  );

  const branchChartData = useMemo(
    () => [...(data?.branchPerformance || [])].sort((a, b) => b.sales - a.sales),
    [data?.branchPerformance]
  );

  const topDoctorsData = useMemo(() => {
    const source = [...(data?.topDoctors || [])];
    source.sort((a, b) => Number(b[doctorMetric]) - Number(a[doctorMetric]));
    return source.slice(0, 5);
  }, [data?.topDoctors, doctorMetric]);

  const exportCurrentTab = () => {
    if (!data) return;
    if (activeTab !== "summary") {
      downloadCsv(`undsen_tailan_${activeTab}.csv`, [{ tab: activeTab, note: "Удахгүй нэмэгдэнэ" }]);
      return;
    }

    const rows: Array<Record<string, string | number>> = [];
    rows.push({ section: "KPI", metric: "Total Sales", value: data.kpis.totalSales });
    rows.push({ section: "KPI", metric: "Collected", value: data.kpis.collected });
    rows.push({ section: "KPI", metric: "Outstanding", value: data.kpis.outstanding });
    rows.push({ section: "KPI", metric: "Non-Cash", value: data.kpis.nonCash });
    rows.push({ section: "KPI", metric: "Completed Visits", value: data.kpis.completedVisits });

    for (const row of data.revenueTrend) {
      rows.push({
        section: "Revenue Trend",
        month: row.month,
        sales: row.sales,
        collected: row.collected,
        income: row.income,
      });
    }
    for (const row of data.paymentMethods) {
      rows.push({ section: "Payment Methods", method: row.label, amount: row.amount });
    }
    for (const row of data.branchPerformance) {
      rows.push({
        section: "Branch Performance",
        branch: row.branchName,
        sales: row.sales,
        collected: row.collected,
        completedVisits: row.completedVisits,
      });
    }
    for (const row of data.topDoctors) {
      rows.push({
        section: "Top Doctors",
        doctor: row.doctorName,
        sales: row.sales,
        income: row.income,
        avgPerAppointment: row.avgPerAppointment,
      });
    }
    downloadCsv("undsen_tailan_tovch.csv", rows);
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 20 }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Үндсэн тайлан</h1>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              border: activeTab === tab.key ? "2px solid #2563eb" : "1px solid #d1d5db",
              background: activeTab === tab.key ? "#eff6ff" : "#fff",
              color: activeTab === tab.key ? "#1e40af" : "#111827",
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            Эхлэх огноо
          </label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            Дуусах огноо
          </label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            Салбар
          </label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Бүх салбар</option>
            {(data?.filters.branches || []).map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            Эмч
          </label>
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Бүх эмч</option>
            {(data?.filters.doctors || []).map((d) => (
              <option key={d.id} value={String(d.id)}>
                {`${d.ovog ? `${d.ovog} ` : ""}${d.name || ""}`.trim() || `Эмч #${d.id}`}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void fetchSummary()}
          style={{
            border: "none",
            background: "#2563eb",
            color: "#fff",
            borderRadius: 8,
            padding: "8px 14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Шүүх
        </button>
        <button
          type="button"
          onClick={exportCurrentTab}
          style={{
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#111827",
            borderRadius: 8,
            padding: "8px 14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Export
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 16, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10 }}>
          {error}
        </div>
      ) : null}

      {loading ? <div style={{ marginTop: 18 }}>Ачааллаж байна...</div> : null}

      {!loading && activeTab !== "summary" ? (
        <div style={{ marginTop: 16, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>{TAB_ITEMS.find((t) => t.key === activeTab)?.label}</h3>
          <div style={{ color: "#6b7280" }}>Энэ таб дараагийн шатанд хийгдэнэ.</div>
        </div>
      ) : null}

      {!loading && activeTab === "summary" && data ? (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
            <KpiCard label="Total Sales" value={fmtMoney(data.kpis.totalSales)} />
            <KpiCard label="Collected" value={fmtMoney(data.kpis.collected)} />
            <KpiCard label="Outstanding" value={fmtMoney(data.kpis.outstanding)} />
            <KpiCard label="Non-Cash" value={fmtMoney(data.kpis.nonCash)} />
            <KpiCard label="Completed Visits" value={String(data.kpis.completedVisits)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>📊 Revenue Trend</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["sales", "collected", "income"] as RevenueMetric[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRevenueMetric(m)}
                      style={{
                        border: revenueMetric === m ? "2px solid #2563eb" : "1px solid #d1d5db",
                        borderRadius: 8,
                        padding: "4px 8px",
                        fontSize: 12,
                        fontWeight: 600,
                        background: revenueMetric === m ? "#eff6ff" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {m === "sales" ? "Sales" : m === "collected" ? "Collected" : "Income"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    <Line
                      type="monotone"
                      dataKey={revenueMetric}
                      name={revenueMetric}
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>📊 Payment Method Breakdown</h3>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={105}
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 16 }}>📊 Branch Comparison</h3>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="branchName" width={110} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    <Bar dataKey="sales" name="Sales" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>📊 Doctor Ranking (Top 5)</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["sales", "income", "avgPerAppointment"] as DoctorMetric[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDoctorMetric(m)}
                      style={{
                        border: doctorMetric === m ? "2px solid #2563eb" : "1px solid #d1d5db",
                        borderRadius: 8,
                        padding: "4px 8px",
                        fontSize: 12,
                        fontWeight: 600,
                        background: doctorMetric === m ? "#eff6ff" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {m === "sales" ? "Sales" : m === "income" ? "Income" : "Avg/Appt"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDoctorsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="doctorName" interval={0} angle={-25} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    <Bar dataKey={doctorMetric} fill="#8b5cf6" name={doctorMetric} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700, color: "#111827" }}>{value}</div>
    </div>
  );
}

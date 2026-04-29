import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import * as XLSX from "xlsx";

function getFirstDayOfMonthStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function getLastDayOfMonthStr(): string {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const y = lastDay.getFullYear();
  const m = String(lastDay.getMonth() + 1).padStart(2, "0");
  const day = String(lastDay.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDoctorName(ovog: string | null | undefined, name: string): string {
  if (ovog && ovog.trim().length > 0) {
    return `${ovog.trim()[0]}.${name}`;
  }
  return name;
}

type DoctorSummary = {
  doctorId: number;
  doctorName: string;
  doctorOvog: string | null;
  branchName: string;
  startDate: string;
  endDate: string;
  appointmentCount: number;
  serviceCount: number;
  averageVisitRevenue: number;
  revenue: number;
  commission: number;
  monthlyGoal: number;
  progressPercent: number;
};

type SortKey =
  | "appointmentCount"
  | "serviceCount"
  | "averageVisitRevenue"
  | "revenue"
  | "progressPercent";
type SortDirection = "asc" | "desc";

function buildFilenameDatePart(value: string) {
  return String(value || "").replaceAll("-", "");
}

export default function DoctorsIncomePage() {
  const router = useRouter();
  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonthStr);
  const [endDate, setEndDate] = useState<string>(getLastDayOfMonthStr);
  const [branchId, setBranchId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("progressPercent");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      setBranches(data || []);
    } catch (e) {
      console.error("Failed to load branches:", e);
      setBranches([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/doctors-income?startDate=${startDate}&endDate=${endDate}&branchId=${branchId || ""}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch doctors' income data");
      setDoctors(data);
    } catch (e: any) {
      console.error("Failed to fetch data:", e);
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchData();
  }, [startDate, endDate, branchId]);

  const sortedDoctors = useMemo(
    () =>
      [...doctors].sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        const primary = sortDirection === "asc" ? diff : -diff;
        return primary || b.revenue - a.revenue || a.doctorName.localeCompare(b.doctorName);
      }),
    [doctors, sortDirection, sortKey]
  );

  const renderSortableHeader = (label: string, key: SortKey) => (
    <th className="px-2 py-3 text-right font-semibold text-gray-700">
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        <span className="inline-flex flex-col leading-none">
          <button
            type="button"
            aria-label={`${label} өсөхөөр эрэмбэлэх`}
            onClick={() => {
              setSortKey(key);
              setSortDirection("asc");
            }}
            className={`h-3 px-0.5 text-[10px] ${
              sortKey === key && sortDirection === "asc" ? "text-blue-600" : "text-gray-400"
            }`}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={`${label} буурахаар эрэмбэлэх`}
            onClick={() => {
              setSortKey(key);
              setSortDirection("desc");
            }}
            className={`h-3 px-0.5 text-[10px] ${
              sortKey === key && sortDirection === "desc" ? "text-blue-600" : "text-gray-400"
            }`}
          >
            ▼
          </button>
        </span>
      </span>
    </th>
  );

  const handleExportExcel = () => {
    const rows = sortedDoctors.map((doctor) => ({
      "Эмч": formatDoctorName(doctor.doctorOvog, doctor.doctorName),
      "Эхлэх огноо": doctor.startDate,
      "Дуусах огноо": doctor.endDate,
      "Цаг захиалга": doctor.appointmentCount,
      "Үйлчилгээ": doctor.serviceCount,
      "Үзлэгийн дундаж (₮)": doctor.averageVisitRevenue,
      "Борлуулалт (₮)": doctor.revenue,
      "Эмчийн хувь (₮)": doctor.commission,
      "Сарын зорилт (₮)": doctor.monthlyGoal,
      "Гүйцэтгэл (%)": doctor.progressPercent,
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "DoctorsIncome");

    const filename = `doctors_income_${buildFilenameDatePart(startDate)}_${buildFilenameDatePart(endDate)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <main className="w-full px-6 py-6 font-sans">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Эмчийн Орлогын Тайлан</h1>

      {/* Filters */}
      <section className="mb-6 flex flex-wrap gap-4">
        <div>
          <label>Эхлэх:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label>Дуусах:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label>Салбар:</label>
          <select
            value={branchId || ""}
            onChange={(e) => setBranchId(Number(e.target.value) || null)}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="">Бүх салбар</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || sortedDoctors.length === 0}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Excel татах
          </button>
        </div>
      </section>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Data Table */}
      <section>
        {loading ? (
          <p className="text-sm text-gray-600">Ачаалж байна...</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-[980px] w-full border-collapse text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-50 px-2 py-3 font-semibold text-gray-700 shadow-[1px_0_0_0_rgba(229,231,235,1)]">Нэр</th>
                    <th className="px-2 py-3 font-semibold text-gray-700">Эхлэх</th>
                    <th className="px-2 py-3 font-semibold text-gray-700">Дуусах</th>
                    {renderSortableHeader("Цаг захиалга", "appointmentCount")}
                    {renderSortableHeader("Үйлчилгээ", "serviceCount")}
                    {renderSortableHeader("Үзлэгийн дундаж", "averageVisitRevenue")}
                    {renderSortableHeader("Борлуулалт", "revenue")}
                    <th className="px-2 py-3 text-right font-semibold text-gray-700">Эмчийн хувь</th>
                    <th className="px-2 py-3 text-right font-semibold text-gray-700">Сарын зорилт</th>
                    {renderSortableHeader("Гүйцэтгэл (%)", "progressPercent")}
                    <th className="px-2 py-3 font-semibold text-gray-700">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDoctors.map((doctor) => (
                    <tr key={doctor.doctorId} className="border-t border-gray-200">
                      <td className="sticky left-0 z-10 bg-white px-2 py-2 shadow-[1px_0_0_0_rgba(229,231,235,1)]">
                        {formatDoctorName(doctor.doctorOvog, doctor.doctorName)}
                      </td>
                      <td className="px-2 py-2">{doctor.startDate}</td>
                      <td className="px-2 py-2">{doctor.endDate}</td>
                      <td className="px-2 py-2 text-right">{doctor.appointmentCount}</td>
                      <td className="px-2 py-2 text-right">{doctor.serviceCount}</td>
                      <td className="px-2 py-2 text-right">
                        {doctor.averageVisitRevenue.toLocaleString("mn-MN")} ₮
                      </td>
                      <td className="px-2 py-2 text-right">
                        {doctor.revenue.toLocaleString("mn-MN")} ₮
                      </td>
                      <td className="px-2 py-2 text-right">
                        {doctor.commission.toLocaleString("mn-MN")} ₮
                      </td>
                      <td className="px-2 py-2 text-right">
                        {doctor.monthlyGoal.toLocaleString("mn-MN")} ₮
                      </td>
                      <td className="px-2 py-2 text-right">{doctor.progressPercent}%</td>
                      <td className="px-2 py-2">
                        <div className="group relative inline-block">
                          <button
                            aria-label="Дэлгэрэнгүй"
                            className="rounded-md border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                            onClick={() =>
                              router.push(
                                `/admin/doctor/income/${doctor.doctorId}?startDate=${startDate}&endDate=${endDate}`
                              )
                            }
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
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                            Дэлгэрэнгүй
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

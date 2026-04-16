import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

type Branch = { id: number; name: string };
type ReportRow = { amount: number };
type DoctorRow = ReportRow & { doctorId: number; doctorName: string };
type ImagingRow = ReportRow & { performerKey: string; performerName: string };
type PaymentSummaryRow = {
  method: string;
  label: string;
  totalAmount: number;
  count: number;
};
type IncomeDetailedResponse = {
  startDate: string;
  endDate: string;
  branchId: number | null;
  branchName: string | null;
  collectors: string[];
  doctors: DoctorRow[];
  doctorRevenueTotal: number;
  imaging: ImagingRow[];
  imagingProductionTotal: number;
  grandTotal: number;
  paymentSummary: PaymentSummaryRow[];
  debtSnapshotAmount: number;
  overpaymentSnapshotAmount: number;
};

function getFirstDayOfMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmtMnt(v: number) {
  return `${Number(v || 0).toLocaleString("mn-MN")} ₮`;
}

export default function FinanceIncomeDetailedPage() {
  const router = useRouter();
  const { me, loading: authLoading } = useAuth();

  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonthStr);
  const [endDate, setEndDate] = useState<string>(getTodayStr);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState<IncomeDetailedResponse | null>(null);

  const canView = me?.role === "admin" || me?.role === "super_admin";

  useEffect(() => {
    if (!authLoading && me && !canView) {
      void router.replace("/");
    }
  }, [authLoading, canView, me, router]);

  useEffect(() => {
    fetch("/api/branches")
      .then((res) => res.json())
      .then((json) => setBranches(Array.isArray(json) ? json : []))
      .catch(() => setBranches([]));
  }, []);

  const selectedBranchLabel = useMemo(() => {
    if (data?.branchName) return data.branchName;
    return branches.find((b) => b.id === branchId)?.name ?? "Бүх салбар";
  }, [branches, branchId, data?.branchName]);

  const fetchReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError("");
    setSubmitted(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (branchId) params.set("branchId", String(branchId));
      const res = await fetch(`/api/admin/income-detailed?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Тайлан татахад алдаа гарлаа.");
      setData(json as IncomeDetailedResponse);
    } catch (e: any) {
      setError(e?.message || "Тайлан татахад алдаа гарлаа.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchReport();
  };

  if (authLoading || !me || !canView) return null;

  return (
    <main className="w-full px-6 py-6 font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Орлогын дэлгэрэнгүй тайлан</h1>
        <p className="mt-2 text-sm text-gray-600">Салбар: {selectedBranchLabel}</p>
        <p className="text-sm text-gray-600">
          Орлого хураасан ажилтан: {data?.collectors?.length ? data.collectors.join(", ") : "-"}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Эхлэх огноо</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Дуусах огноо</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Салбар</label>
          <select
            value={branchId ?? ""}
            onChange={(e) => setBranchId(Number(e.target.value) || null)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Бүх салбар</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading || !startDate || !endDate}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Ачаалж байна..." : "Хайх"}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!submitted && !loading && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center text-sm text-gray-400">
          Огнооны муж болон салбар сонгоод &ldquo;Хайх&rdquo; дарна уу
        </div>
      )}

      {loading && (
        <div className="py-10 text-center text-sm text-gray-500">Ачаалж байна...</div>
      )}

      {submitted && !loading && data && (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-800">
              Эмчийн нэрс
            </div>
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Эмч</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Борлуулалтын дүн</th>
                </tr>
              </thead>
              <tbody>
                {data.doctors.map((d) => (
                  <tr key={d.doctorId} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-gray-800">{d.doctorName}</td>
                    <td className="px-4 py-2 text-right text-gray-800">{fmtMnt(d.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-gray-900">Нийт</td>
                  <td className="px-4 py-2 text-right text-gray-900">{fmtMnt(data.doctorRevenueTotal)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-800">
              Зургийн орлого
            </div>
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Гүйцэтгэгч</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Дүн</th>
                </tr>
              </thead>
              <tbody>
                {data.imaging.map((r) => (
                  <tr key={r.performerKey} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-gray-800">{r.performerName}</td>
                    <td className="px-4 py-2 text-right text-gray-800">{fmtMnt(r.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-gray-900">Нийт</td>
                  <td className="px-4 py-2 text-right text-gray-900">{fmtMnt(data.imagingProductionTotal)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
            <p className="text-sm text-blue-700">Нийт орлого (Эмч + Зураг)</p>
            <p className="text-2xl font-bold text-blue-900">{fmtMnt(data.grandTotal)}</p>
          </div>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-800">Нэгтгэл</div>
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Төлбөрийн төрөл</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Гүйлгээний тоо</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Нийт дүн</th>
                </tr>
              </thead>
              <tbody>
                {data.paymentSummary.map((row) => (
                  <tr key={row.method} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-gray-800">{row.label}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{row.count}</td>
                    <td className="px-4 py-2 text-right text-gray-800">{fmtMnt(row.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Авлагын snapshot (одоогийн)</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{fmtMnt(data.debtSnapshotAmount)}</p>
              <Link href="/finance/debts" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                Авлагын дэлгэрэнгүй
              </Link>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Илүү төлөлтийн snapshot (одоогийн)</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{fmtMnt(data.overpaymentSnapshotAmount)}</p>
              <Link href="/finance/overpayments" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                Илүү төлөлтийн дэлгэрэнгүй
              </Link>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

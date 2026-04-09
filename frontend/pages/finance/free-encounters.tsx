import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";

type Branch = { id: number; name: string };

type FreeEncounterItem = {
  id: number;
  visitDate: string | null;
  closedWithoutPaymentAt: string | null;
  closedWithoutPaymentNote: string | null;
  closedWithoutPaymentBy: { id: number; name: string | null; ovog: string | null } | null;
  doctor: { id: number; name: string | null; ovog: string | null } | null;
  patient: {
    id: number;
    name: string | null;
    ovog: string | null;
    phone: string | null;
    regNo: string | null;
    branchName: string | null;
  } | null;
  patientBookId: number;
};

function fmtName(ovog: string | null | undefined, name: string | null | undefined) {
  const n = (name || "").trim();
  const o = (ovog || "").trim();
  if (o && n) return `${o[0]}. ${n}`;
  return n || o || "-";
}

function fmtDatetime(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FreeEncountersPage() {
  const router = useRouter();
  const { me, loading: authLoading } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [dateFrom, setDateFrom] = useState(getTodayStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [branchId, setBranchId] = useState<string>("all");

  const [results, setResults] = useState<FreeEncounterItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Detail modal state
  const [detailItem, setDetailItem] = useState<FreeEncounterItem | null>(null);

  const isAdmin = me?.role === "admin" || me?.role === "super_admin";

  // Auth guard
  useEffect(() => {
    if (!authLoading && me && !isAdmin) {
      void router.replace("/");
    }
  }, [authLoading, me, isAdmin, router]);

  // Load branches
  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => setBranches([]));
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (branchId && branchId !== "all") params.set("branchId", branchId);

      const res = await fetch(`/api/encounters/free-closed?${params.toString()}`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error((data && data.error) || "Хайлт хийхэд алдаа гарлаа.");
      }

      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Хайлт хийхэд алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-500">
        Ачаалж байна...
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="p-6 font-sans">
      <div className="mb-5">
        <h1 className="text-2xl font-bold mb-1">Төлбөргүй үзлэгийн жагсаалт</h1>
        <p className="text-sm text-gray-500">Төлбөргүй хаагдсан үзлэгүүдийн жагсаалт</p>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Эхлэх огноо</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Дуусах огноо</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Салбар</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Бүх салбар</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition"
        >
          {loading ? "Хайж байна..." : "Хайх"}
        </button>
      </form>

      {error && (
        <div className="mb-4 text-red-600 text-sm">{error}</div>
      )}

      {results === null && !loading && (
        <div className="text-sm text-gray-400 text-center py-10">
          Хайх товч дарна уу.
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-10">
          Өгөгдөл олдсонгүй.
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Үзлэгийн дугаар",
                  "Огноо",
                  "Салбар",
                  "Үйлчлүүлэгчийн нэр",
                  "Утасны дугаар",
                  "РД",
                  "Эмч",
                  "Үйлчлүүлэгч",
                  "Дэлгэрэнгүй",
                ].map((label, i) => (
                  <th
                    key={i}
                    className="sticky top-0 z-10 text-left border-b border-gray-200 py-2 px-3 font-semibold text-gray-700 whitespace-nowrap bg-gray-50"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((item) => (
                <tr key={item.id} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                  <td className="border-b border-gray-100 py-2 px-3">{item.id}</td>
                  <td className="border-b border-gray-100 py-2 px-3 whitespace-nowrap">
                    {fmtDatetime(item.closedWithoutPaymentAt || item.visitDate)}
                  </td>
                  <td className="border-b border-gray-100 py-2 px-3">
                    {item.patient?.branchName || "-"}
                  </td>
                  <td className="border-b border-gray-100 py-2 px-3">
                    {item.patient ? fmtName(item.patient.ovog, item.patient.name) : "-"}
                  </td>
                  <td className="border-b border-gray-100 py-2 px-3">
                    {item.patient?.phone || "-"}
                  </td>
                  <td className="border-b border-gray-100 py-2 px-3">
                    {item.patient?.regNo || "-"}
                  </td>
                  <td className="border-b border-gray-100 py-2 px-3">
                    {item.doctor ? fmtName(item.doctor.ovog, item.doctor.name) : "-"}
                  </td>
                  <td className="border-b border-gray-100 py-2 px-3">
                    {item.patient?.id ? (
                      <Link
                        href={`/patients/${item.patient.id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Үйлчлүүлэгчийн дэлгэрэнгүй
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="border-b border-gray-100 py-2 px-3">
                    <button
                      type="button"
                      onClick={() => setDetailItem(item)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Дэлгэрэнгүй
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailItem(null); }}
        >
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">Үзлэгийн дэлгэрэнгүй #{detailItem.id}</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-600">Тайлбар:</span>
                <p className="mt-1 text-gray-800 whitespace-pre-wrap">
                  {detailItem.closedWithoutPaymentNote || "-"}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Үзлэг хаасан огноо/цаг:</span>
                <p className="mt-1 text-gray-800">
                  {fmtDatetime(detailItem.closedWithoutPaymentAt)}
                </p>
              </div>
              {detailItem.closedWithoutPaymentBy && (
                <div>
                  <span className="font-medium text-gray-600">Хаасан хэрэглэгч:</span>
                  <p className="mt-1 text-gray-800">
                    {fmtName(detailItem.closedWithoutPaymentBy.ovog, detailItem.closedWithoutPaymentBy.name)}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-50 transition"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

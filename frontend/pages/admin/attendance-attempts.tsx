import React, { useEffect, useMemo, useState } from "react";

type AttemptRow = {
  id: number;
  attemptAt: string;
  attemptType: "CHECK_IN" | "CHECK_OUT";
  result: "SUCCESS" | "FAIL";
  failureCode?: string | null;
  failureMessage?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  distanceM?: number | null;
  radiusM?: number | null;
  user: {
    id: number;
    name: string | null;
    ovog: string | null;
    role: string;
  };
  branch?: {
    id: number;
    name: string;
  } | null;
};

function fmtName(ovog: string | null, name: string | null) {
  if (!name) return "(нэргүй)";
  if (!ovog || !ovog.trim()) return name;
  return `${ovog.trim()[0]}.${name}`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function AdminAttendanceAttemptsPage() {
  const [items, setItems] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"" | "SUCCESS" | "FAIL">("");
  const [take, setTake] = useState(200);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ take: String(take) });
        if (result) params.set("result", result);
        const res = await fetch(`/api/attendance/attempts?${params}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((json as any).error || "Алдаа гарлаа.");
        }
        if (!cancelled) setItems(Array.isArray((json as any).items) ? (json as any).items : []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Алдаа гарлаа.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [result, take]);

  const summary = useMemo(() => {
    let success = 0;
    let fail = 0;
    for (const row of items) {
      if (row.result === "SUCCESS") success += 1;
      else fail += 1;
    }
    return { success, fail };
  }, [items]);

  return (
    <main className="w-full px-4 py-6 font-sans">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Ирцийн оролдлогын аудит</h1>

      <section className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Үр дүн</label>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value as "" | "SUCCESS" | "FAIL")}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">Бүгд</option>
            <option value="SUCCESS">Амжилттай</option>
            <option value="FAIL">Амжилтгүй</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Мөрийн тоо</label>
          <select
            value={String(take)}
            onChange={(e) => setTake(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
          </select>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
          Нийт оролдлого: <strong>{items.length}</strong>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
          Амжилттай: <strong>{summary.success}</strong>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          Амжилтгүй: <strong>{summary.fail}</strong>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        {loading ? (
          <p className="text-sm text-gray-600">Ачаалж байна...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold text-gray-700">Огноо</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">Ажилтан</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">Салбар</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">Төрөл</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">Үр дүн</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">Шалтгаан</th>
                  <th className="px-3 py-2 font-semibold text-gray-700">GPS</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-400">
                      Мэдээлэл олдсонгүй
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(row.attemptAt)}</td>
                      <td className="px-3 py-2">
                        {fmtName(row.user.ovog, row.user.name)}
                        <div className="text-xs text-gray-500">{row.user.role}</div>
                      </td>
                      <td className="px-3 py-2">{row.branch?.name || "—"}</td>
                      <td className="px-3 py-2">{row.attemptType === "CHECK_IN" ? "Ирэх" : "Явах"}</td>
                      <td className="px-3 py-2">
                        <span className={row.result === "SUCCESS" ? "text-green-600" : "text-red-600"}>
                          {row.result === "SUCCESS" ? "Амжилттай" : "Амжилтгүй"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row.failureCode || "—"}
                        {row.failureMessage ? (
                          <div className="text-xs text-gray-500">{row.failureMessage}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        acc: {row.accuracyM ?? "—"}м • d: {row.distanceM ?? "—"}м / r: {row.radiusM ?? "—"}м
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

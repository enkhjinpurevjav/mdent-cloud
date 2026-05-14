import React, { useEffect, useState } from "react";

type Branch = { id: number; name: string };

type Mismatch = {
  id: number;
  encounterId: number;
  cycleId: number;
  toolId: number;
  requiredQty: number;
  finalizedQty: number;
  mismatchQty: number;
  status: "UNRESOLVED" | "RESOLVED";
  encounter?: {
    id: number;
    visitDate: string;
    patientBook?: {
      patient?: {
        id: number;
        name: string;
        ovog?: string | null;
      };
    };
  };
  branch?: {
    id: number;
    name: string;
  };
  cycle?: {
    code: string;
  };
  tool?: {
    name: string;
  };
};

type MismatchGroup = {
  encounterId: number;
  patient: string;
  branch: string;
  visitDate: string;
  mismatches: Mismatch[];
};

export default function MismatchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [selectedStatus, setSelectedStatus] = useState<"UNRESOLVED" | "RESOLVED" | "">("UNRESOLVED");
  const [patientNameFilter, setPatientNameFilter] = useState("");
  const [visitDateFilter, setVisitDateFilter] = useState("");

  const [resolvingEncounterId, setResolvingEncounterId] = useState<number | null>(null);
  const [resolverName, setResolverName] = useState("");
  const [resolveNote, setResolveNote] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/branches");
        const data = await res.json().catch(() => []);
        if (res.ok) setBranches(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      }
    })();
  }, []);

  const loadMismatches = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.append("status", selectedStatus);
      if (selectedBranchId) params.append("branchId", String(selectedBranchId));
      if (patientNameFilter.trim()) params.append("patientName", patientNameFilter.trim());
      if (visitDateFilter) params.append("visitDate", visitDateFilter);

      const res = await fetch(`/api/sterilization/mismatches?${params.toString()}`);
      const data = await res.json().catch(() => []);

      if (!res.ok) throw new Error(data?.error || "Failed to load mismatches");

      setMismatches(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
      setMismatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMismatches();
  }, [selectedStatus, selectedBranchId, patientNameFilter, visitDateFilter]);

  const groupedMismatches: MismatchGroup[] = React.useMemo(() => {
    const groups: Record<number, MismatchGroup> = {};

    for (const mismatch of mismatches) {
      const encId = mismatch.encounterId;
      const branchId = mismatch.branch?.id;

      if (!groups[encId]) {
        const patient = mismatch.encounter?.patientBook?.patient;
        const patientName = patient ? `${patient.ovog || ""} ${patient.name}`.trim() : "Тодорхойгүй";
        const branchName =
          mismatch.branch?.name ||
          branches.find((b) => b.id === branchId)?.name ||
          "—";
        const visitDate = mismatch.encounter?.visitDate || "";

        groups[encId] = {
          encounterId: encId,
          patient: patientName,
          branch: branchName,
          visitDate,
          mismatches: [],
        };
      }

      groups[encId].mismatches.push(mismatch);
    }

    return Object.values(groups);
  }, [mismatches, selectedBranchId, branches]);

  const formatDateTime = (isoString: string) => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      if (Number.isNaN(date.getTime())) return isoString;
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch {
      return isoString;
    }
  };

  const openResolveModal = (encounterId: number) => {
    setResolvingEncounterId(encounterId);
    setResolverName("");
    setResolveNote("");
  };

  const closeResolveModal = () => {
    setResolvingEncounterId(null);
    setResolverName("");
    setResolveNote("");
  };

  const submitResolve = async () => {
    if (!resolvingEncounterId) return;
    if (!resolverName.trim()) {
      setError("Шийдвэрлэсэн хүний нэрийг оруулна уу.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sterilization/mismatches/${resolvingEncounterId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolvedByName: resolverName.trim(),
          note: resolveNote.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to resolve mismatches");

      alert("Зөрүүг шийдвэрлэлээ.");
      closeResolveModal();
      await loadMismatches();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px]">
      <h1 className="mb-1.5 text-lg font-semibold">Ариутгал → Зөрүү</h1>
      <p className="mb-3 text-sm text-gray-500">Ариутгалын багажийн зөрүүг харах болон шийдвэрлэх.</p>

      {error && <div className="mb-2.5 text-sm text-red-700">{error}</div>}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
          className="min-w-[220px] rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
        >
          <option value="">Бүх салбар</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <input
          value={patientNameFilter}
          onChange={(e) => setPatientNameFilter(e.target.value)}
          placeholder="Үйлчлүүлэгчийн нэр"
          className="min-w-[220px] rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
        />

        <div className="flex min-w-[170px] flex-col gap-1">
          <label className="text-xs text-gray-500">Үзлэгийн огноо</label>
          <input
            type="date"
            value={visitDateFilter}
            onChange={(e) => setVisitDateFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as "UNRESOLVED" | "RESOLVED" | "")}
          className="min-w-[180px] rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
        >
          <option value="">Бүх төлөв</option>
          <option value="UNRESOLVED">⚠ Шийдвэрлээгүй</option>
          <option value="RESOLVED">✓ Шийдвэрлэсэн</option>
        </select>

        <button
          type="button"
          onClick={() => void loadMismatches()}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:cursor-default disabled:opacity-60"
        >
          {loading ? "Ачаалж байна..." : "Шинэчлэх"}
        </button>
      </div>

      {/* Grouped Mismatches */}
      <div className="flex flex-col gap-3">
        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Ачаалж байна...
          </div>
        )}

        {!loading && groupedMismatches.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Зөрүү олдсонгүй.
          </div>
        )}

        {!loading && groupedMismatches.map((group) => (
          <div
            key={group.encounterId}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="mb-1 text-sm font-semibold">
                  {group.patient}
                </div>
                <div className="text-xs text-gray-500">
                  Салбар: {group.branch} • Үзлэгийн огноо: {formatDateTime(group.visitDate)}
                </div>
              </div>

              {selectedStatus === "UNRESOLVED" && (
                <button
                  type="button"
                  onClick={() => openResolveModal(group.encounterId)}
                  className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white"
                >
                  Шийдвэрлэх
                </button>
              )}
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-1 py-2">Багаж</th>
                  <th className="px-1 py-2">Код</th>
                  <th className="w-[100px] px-1 py-2">Хэрэгтэй</th>
                  <th className="w-[100px] px-1 py-2">Ашигласан</th>
                  <th className="w-[100px] px-1 py-2">Зөрүү</th>
                </tr>
              </thead>
              <tbody>
                {group.mismatches.map((mismatch) => (
                  <tr key={mismatch.id} className="border-b border-gray-100">
                    <td className="px-1 py-2">{mismatch.tool?.name || "—"}</td>
                    <td className="px-1 py-2">{mismatch.cycle?.code || "—"}</td>
                    <td className="px-1 py-2">{mismatch.requiredQty}</td>
                    <td className="px-1 py-2">{mismatch.finalizedQty}</td>
                    <td className="px-1 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                          mismatch.mismatchQty > 0
                            ? "bg-red-100 text-red-900"
                            : "bg-emerald-100 text-emerald-900"
                        }`}
                      >
                        {mismatch.mismatchQty > 0 ? `+${mismatch.mismatchQty}` : mismatch.mismatchQty}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Resolve Modal */}
      {resolvingEncounterId !== null && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
          onClick={closeResolveModal}
        >
          <div
            className="w-[90%] max-w-[500px] rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-base font-semibold">Зөрүү шийдвэрлэх</h2>

            <div className="mb-3">
              <label className="mb-1 block text-xs text-gray-500">
                Шийдвэрлэсэн хүний нэр <span className="text-red-600">*</span>
              </label>
              <input
                value={resolverName}
                onChange={(e) => setResolverName(e.target.value)}
                placeholder="Нэр оруулах"
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs text-gray-500">
                Тэмдэглэл
              </label>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Нэмэлт мэдээлэл..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeResolveModal}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={submitResolve}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-default disabled:opacity-60"
              >
                {loading ? "Шийдвэрлэж байна..." : "Шийдвэрлэх"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

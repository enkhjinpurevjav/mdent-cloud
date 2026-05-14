import React, { useEffect, useMemo, useState } from "react";

type Branch = { id: number; name: string };

type Doctor = {
  id: number;
  name: string | null;
  ovog: string | null;
  email: string;
  branchId: number | null;
  branches: Array<{ id: number; name: string }>;
};

type NurseUser = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
  branchId?: number | null;
  branches?: Array<{ id: number; name: string }>;
};

type Tool = {
  id: number;
  branchId: number;
  name: string;
  baselineAmount: number;
};

type ReturnLine = {
  id: number;
  toolId: number;
  returnedQty: number;
  tool?: { id: number; name: string };
};

type ReturnRecord = {
  id: number;
  branchId: number;
  date: string; // ISO string (stored as midnight)
  time: string; // "HH:mm"
  doctorId: number;
  nurseName: string;
  notes: string | null;

  branch?: { id: number; name: string };
  doctor?: { id: number; name: string | null; ovog: string | null; email: string };
  lines: ReturnLine[];

  createdAt?: string;
  updatedAt?: string;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function formatDateOnly(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatHHmm(date: Date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function doctorLabel(d: Doctor | ReturnRecord["doctor"] | null | undefined) {
  if (!d) return "—";
  const full = `${(d as any).ovog || ""} ${(d as any).name || ""}`.trim();
  return full || (d as any).email || "—";
}

function formatUserLabel(u: { id: number; email: string; name?: string | null; ovog?: string | null }): string {
  if (u.ovog && u.ovog.trim() && u.name && u.name.trim()) return `${u.ovog.trim().charAt(0)}.${u.name.trim()}`;
  if (u.name && u.name.trim()) return u.name.trim();
  if (u.email) return u.email;
  return `User #${u.id}`;
}

function sumLines(lines: ReturnLine[]) {
  return (lines || []).reduce((s, ln) => s + Number(ln.returnedQty || 0), 0);
}

export default function SterilizationReturnsPage() {
  const now = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => formatDateOnly(now), [now]);

  // Lookup data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [allNurses, setAllNurses] = useState<NurseUser[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);

  // Filtered lists derived from selected branch
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [filteredNurses, setFilteredNurses] = useState<NurseUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Create form fields
  const [branchId, setBranchId] = useState<number | "">("");
  const [date, setDate] = useState<string>(todayYmd);
  const [time, setTime] = useState<string>(formatHHmm(new Date()));
  const [doctorId, setDoctorId] = useState<number | "">("");
  const [nurseName, setNurseName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // qty inputs for all tools (keyed by toolId)
  const [qtyByToolId, setQtyByToolId] = useState<Record<number, number>>({});
  const [toolFilter, setToolFilter] = useState<string>("");

  // History
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filters
  const [filterBranchId, setFilterBranchId] = useState<number | "">("");
  const [filterDoctorId, setFilterDoctorId] = useState<number | "">("");
  const [filterFrom, setFilterFrom] = useState(formatDateOnly(new Date(Date.now() - THIRTY_DAYS_MS)));
  const [filterTo, setFilterTo] = useState(formatDateOnly(new Date()));

  const [loading, setLoading] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load branches + doctors + nurses on mount
  useEffect(() => {
    (async () => {
      setLoadingStaff(true);
      try {
        const [bRes, dRes, nRes] = await Promise.all([
          fetch("/api/branches"),
          fetch("/api/users?role=doctor"),
          fetch("/api/users?role=nurse"),
        ]);
        const bJson = await bRes.json().catch(() => []);
        const dJson = await dRes.json().catch(() => []);
        const nJson = await nRes.json().catch(() => []);

        if (bRes.ok) setBranches(Array.isArray(bJson) ? bJson : []);
        if (dRes.ok) setAllDoctors(Array.isArray(dJson) ? dJson : []);
        if (nRes.ok) setAllNurses(Array.isArray(nJson) ? nJson : []);
      } catch {
        // ignore
      } finally {
        setLoadingStaff(false);
      }
    })();
  }, []);

  // When branch changes in create form: load tools for that branch
  useEffect(() => {
    if (!branchId) {
      setTools([]);
      setQtyByToolId({});
      return;
    }

    (async () => {
      setLoadingTools(true);
      try {
        const res = await fetch(`/api/sterilization/items?branchId=${branchId}`);
        const json = await res.json().catch(() => []);
        if (res.ok) {
          const list: Tool[] = Array.isArray(json) ? json : [];
          setTools(list);

          // Initialize qty map (keep any existing typed values if same toolId exists)
          setQtyByToolId((prev) => {
            const next: Record<number, number> = {};
            for (const t of list) next[t.id] = Number(prev[t.id] || 0);
            return next;
          });
        } else {
          setTools([]);
          setQtyByToolId({});
        }
      } catch {
        setTools([]);
        setQtyByToolId({});
      } finally {
        setLoadingTools(false);
      }
    })();
  }, [branchId]);

  // Mirror create branch to history branch filter (nice UX)
  useEffect(() => {
    if (branchId) setFilterBranchId(branchId);
  }, [branchId]);

  // Filter doctors and nurses by selected branch, auto-select first
  useEffect(() => {
    if (!branchId) {
      setFilteredDoctors([]);
      setFilteredNurses([]);
      setDoctorId("");
      setNurseName("");
      return;
    }
    const bid = Number(branchId);
    const docs = allDoctors.filter(
      (d) => d.branchId === bid || (d.branches && d.branches.some((b) => b.id === bid))
    );
    const nurses = allNurses.filter(
      (n) => n.branchId === bid || (n.branches && n.branches.some((b) => b.id === bid))
    );
    setFilteredDoctors(docs);
    setFilteredNurses(nurses);
    setDoctorId(docs.length > 0 ? docs[0].id : "");
    setNurseName(nurses.length > 0 ? formatUserLabel(nurses[0]) : "");
  }, [branchId, allDoctors, allNurses]);

  const filteredTools = useMemo(() => {
    const q = toolFilter.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) => t.name.toLowerCase().includes(q));
  }, [tools, toolFilter]);

  const totalReturnQty = useMemo(() => {
    return Object.values(qtyByToolId).reduce((s, v) => s + Number(v || 0), 0);
  }, [qtyByToolId]);

  const resetForm = () => {
    setDate(todayYmd);
    setTime(formatHHmm(new Date()));
    setDoctorId(filteredDoctors.length > 0 ? filteredDoctors[0].id : "");
    setNurseName(filteredNurses.length > 0 ? formatUserLabel(filteredNurses[0]) : "");
    setNotes("");
    setToolFilter("");
    setExpandedId(null);
    setQtyByToolId((prev) => {
      const next: Record<number, number> = {};
      for (const t of tools) next[t.id] = 0;
      // if tools not loaded, fallback
      return Object.keys(next).length ? next : {};
    });
  };

  const loadRecords = async () => {
    setLoadingList(true);
    setError("");
    try {
      if (!filterBranchId) {
        setRecords([]);
        return;
      }

      const params = new URLSearchParams();
      params.set("branchId", String(filterBranchId));
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (filterDoctorId) params.set("doctorId", String(filterDoctorId));

      const res = await fetch(`/api/sterilization/returns?${params.toString()}`);
      const json = await res.json().catch(() => []);
      if (!res.ok) throw new Error(json?.error || "Failed to load return records");

      setRecords(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
      setRecords([]);
    } finally {
      setLoadingList(false);
    }
  };

  // Auto load history when filters change
  useEffect(() => {
    void loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, filterFrom, filterTo, filterDoctorId]);

  const submit = async () => {
    setError("");
    setSuccessMsg("");

    if (!branchId) return setError("Салбар сонгоно уу.");
    if (!date) return setError("Огноо оруулна уу.");
    if (!time) return setError("Цаг оруулна уу.");
    if (!doctorId) return setError("Эмч сонгоно уу.");
    if (!nurseName.trim()) return setError("Сувилагчийн нэр оруулна уу.");

    // Build lines with qty>0 only (your requirement)
    const lines = tools
      .map((t) => ({ toolId: t.id, returnedQty: Math.floor(Number(qtyByToolId[t.id] || 0)) }))
      .filter((x) => x.returnedQty > 0);

    if (lines.length === 0) {
      return setError("Дор хаяж нэг багажийн буцаасан тоо 0-ээс их байх ёстой.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sterilization/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: Number(branchId),
          date, // YYYY-MM-DD
          time, // HH:mm
          doctorId: Number(doctorId),
          nurseName: nurseName.trim(),
          notes: notes.trim() || null,
          lines,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Багаж буцаалт хадгалахад алдаа гарлаа.");

      setSuccessMsg("✅ Багаж буцаалт амжилттай хадгалагдлаа.");
      resetForm();
      await loadRecords();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const fullInputClass = "w-full rounded border border-gray-300 p-2 text-sm";
  const compactInputClass = "rounded border border-gray-300 p-2 text-sm";

  return (
    <div className="max-w-[1400px] p-5 font-sans">
      <h1 className="mb-2 text-3xl font-bold">Ариутгал → Багаж буцаалт</h1>
      <div className="mb-4 text-[13px] text-gray-500">
        Ашигласан багажуудыг буцаан өгсөн бүртгэл (compliance-only). Бараа/нөөцөд нөлөөлөхгүй.
      </div>

      {/* Create form */}
      <div className="mb-6 rounded-lg border border-gray-300 bg-[#f9f9f9] p-5">
        <h2 className="mb-4 text-2xl font-semibold">Шинэ буцаалт бүртгэх</h2>

        {error && <div className="mb-3 rounded bg-red-50 p-2.5 text-red-700">{error}</div>}
        {successMsg && <div className="mb-3 rounded bg-green-50 p-2.5 text-green-700">{successMsg}</div>}

        <div className="grid grid-cols-2 gap-[14px]">
          {/* Branch */}
          <div>
            <label className="mb-[5px] block font-bold">
              Салбар <span className="text-red-600">*</span>
            </label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")} className={fullInputClass}>
              <option value="">-- Сонгох --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor */}
          <div>
            <label className="mb-[5px] block font-bold">
              Эмч <span className="text-red-600">*</span>
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : "")}
              disabled={!branchId || loadingStaff}
              className={fullInputClass}
            >
              {!branchId && <option value="">-- Эхлээд салбар сонгоно уу --</option>}
              {branchId && loadingStaff && <option value="">Ачаалж байна...</option>}
              {branchId && !loadingStaff && filteredDoctors.length === 0 && <option value="">Энэ салбарт эмч олдсонгүй</option>}
              {branchId &&
                !loadingStaff &&
                filteredDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatUserLabel(d)}
                  </option>
                ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="mb-[5px] block font-bold">
              Огноо <span className="text-red-600">*</span>
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fullInputClass} />
          </div>

          {/* Time */}
          <div>
            <label className="mb-[5px] block font-bold">
              Цаг <span className="text-red-600">*</span>
            </label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={fullInputClass} />
          </div>

          {/* Nurse name */}
          <div>
            <label className="mb-[5px] block font-bold">
              Сувилагчийн нэр <span className="text-red-600">*</span>
            </label>
            <select value={nurseName} onChange={(e) => setNurseName(e.target.value)} disabled={!branchId || loadingStaff} className={fullInputClass}>
              {!branchId && <option value="">-- Эхлээд салбар сонгоно уу --</option>}
              {branchId && loadingStaff && <option value="">Ачаалж байна...</option>}
              {branchId && !loadingStaff && filteredNurses.length === 0 && <option value="">Энэ салбарт сувилагч олдсонгүй</option>}
              {branchId &&
                !loadingStaff &&
                filteredNurses.map((n) => (
                  <option key={n.id} value={formatUserLabel(n)}>
                    {formatUserLabel(n)}
                  </option>
                ))}
            </select>
          </div>

          {/* Notes */}
          <div className="col-span-2">
            <label className="mb-[5px] block font-bold">Тэмдэглэл</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Тэмдэглэл..."
              className={fullInputClass}
            />
          </div>
        </div>

        {/* Tools table */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-bold">Багажийн жагсаалт (буцаасан тоо)</div>
            <input
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              placeholder="Багаж хайх..."
              className="min-w-[240px] rounded-md border border-gray-300 p-2 text-sm"
              disabled={!branchId || loadingTools}
            />
          </div>

          {!branchId && <div className="mt-2.5 text-gray-500">Эхлээд салбар сонгоно уу.</div>}
          {branchId && loadingTools && <div className="mt-2.5 text-gray-500">Багаж ачаалж байна...</div>}

          {branchId && !loadingTools && tools.length === 0 && <div className="mt-2.5 text-gray-500">Энэ салбарт багаж бүртгэгдээгүй байна.</div>}

          {branchId && !loadingTools && tools.length > 0 && (
            <div className="mt-2.5 overflow-x-auto">
              <table className="w-full border-collapse bg-white text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-b-2 border-gray-300 p-2.5 text-left">Багаж</th>
                    <th className="w-[120px] border-b-2 border-gray-300 p-2.5 text-right">Үндсэн</th>
                    <th className="w-[160px] border-b-2 border-gray-300 p-2.5 text-right">Буцаасан тоо</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTools.map((t) => (
                    <tr key={t.id} className="border-b border-gray-200">
                      <td className="p-2.5">{t.name}</td>
                      <td className="p-2.5 text-right text-gray-500">{t.baselineAmount}</td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          value={qtyByToolId[t.id] ?? 0}
                          onChange={(e) => {
                            const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            setQtyByToolId((prev) => ({ ...prev, [t.id]: v }));
                          }}
                          className="w-[120px] rounded border border-gray-300 p-1.5 text-right text-sm"
                        />
                      </td>
                    </tr>
                  ))}

                  <tr className="border-t-2 border-gray-300">
                    <td className="p-2.5 font-bold">Нийт</td>
                    <td className="p-2.5" />
                    <td className="p-2.5 text-right font-bold">{totalReturnQty}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={submit}
            disabled={loading}
            className={`rounded px-5 py-2.5 text-base text-white ${loading ? "cursor-not-allowed bg-gray-300" : "cursor-pointer bg-green-500"}`}
          >
            {loading ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="rounded-lg border border-gray-300 bg-white p-5">
        <h2 className="mb-4 text-2xl font-semibold">Буцаалтын түүх</h2>

        <div className="mb-4 flex flex-wrap gap-[15px]">
          <div>
            <label className="mb-[5px] block font-bold">Салбар</label>
            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : "")}
              className={compactInputClass}
            >
              <option value="">-- Сонгох --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="mt-[3px] text-xs text-gray-500">(Салбар сонгохгүй бол түүх хоосон)</div>
          </div>

          <div>
            <label className="mb-[5px] block font-bold">Эмч</label>
            <select
              value={filterDoctorId}
              onChange={(e) => setFilterDoctorId(e.target.value ? Number(e.target.value) : "")}
              className={`${compactInputClass} min-w-[240px]`}
            >
              <option value="">-- Бүгд --</option>
              {allDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatUserLabel(d)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-[5px] block font-bold">Эхлэх огноо</label>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className={compactInputClass} />
          </div>

          <div>
            <label className="mb-[5px] block font-bold">Дуусах огноо</label>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className={compactInputClass} />
          </div>

          <div className="self-end">
            <button
              type="button"
              onClick={() => void loadRecords()}
              disabled={loadingList}
              className={`rounded border border-gray-300 bg-white px-[14px] py-[9px] text-sm ${loadingList ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              {loadingList ? "Ачаалж байна..." : "Шинэчлэх"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-[50px] border-b-2 border-gray-300 p-2.5 text-left" />
                <th className="border-b-2 border-gray-300 p-2.5 text-left">Огноо</th>
                <th className="border-b-2 border-gray-300 p-2.5 text-left">Цаг</th>
                <th className="border-b-2 border-gray-300 p-2.5 text-left">Эмч</th>
                <th className="border-b-2 border-gray-300 p-2.5 text-left">Сувилагч</th>
                <th className="border-b-2 border-gray-300 p-2.5 text-right">Нийт</th>
                <th className="border-b-2 border-gray-300 p-2.5 text-left">Тэмдэглэл</th>
              </tr>
            </thead>
            <tbody>
              {loadingList && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">
                    Ачаалж байна...
                  </td>
                </tr>
              )}

              {!loadingList && records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-5 text-center text-gray-400">
                    Мэдээлэл олдсонгүй
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isExpanded = expandedId === r.id;
                  const total = sumLines(r.lines || []);
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        className={`cursor-pointer border-b border-gray-200 ${isExpanded ? "bg-gray-50" : "bg-white"}`}
                        onClick={() => toggleExpand(r.id)}
                      >
                        <td className="p-2.5 text-center">{isExpanded ? "▼" : "▶"}</td>
                        <td className="p-2.5">{new Date(r.date).toLocaleDateString("mn-MN")}</td>
                        <td className="p-2.5">{r.time}</td>
                        <td className="p-2.5">{doctorLabel(r.doctor)}</td>
                        <td className="p-2.5">{r.nurseName}</td>
                        <td className="p-2.5 text-right font-bold">{total}</td>
                        <td className="p-2.5 text-gray-700">{r.notes || ""}</td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="p-[14px]">
                            <div className="mb-2 text-xs text-gray-500">Буцаасан багажууд:</div>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse bg-white text-[13px]">
                                <thead>
                                  <tr className="border-b border-gray-200 text-left text-gray-500">
                                    <th className="px-2.5 py-2">Багаж</th>
                                    <th className="w-[160px] px-2.5 py-2 text-right">Буцаасан тоо</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(r.lines || [])
                                    .slice()
                                    .sort((a, b) => (a.tool?.name || "").localeCompare(b.tool?.name || ""))
                                    .map((ln) => (
                                      <tr key={ln.id} className="border-b border-gray-100">
                                        <td className="px-2.5 py-2">{ln.tool?.name || `Tool #${ln.toolId}`}</td>
                                        <td className="px-2.5 py-2 text-right">{ln.returnedQty}</td>
                                      </tr>
                                    ))}
                                  <tr className="border-t-2 border-gray-200">
                                    <td className="px-2.5 py-2 font-bold">Бүгд</td>
                                    <td className="px-2.5 py-2 text-right font-bold">{total}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loadingList && records.length > 0 && <div className="mt-2.5 text-xs text-gray-500">Нийт бүртгэл: {records.length}</div>}
      </div>
    </div>
  );
}

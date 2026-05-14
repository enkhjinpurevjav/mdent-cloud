import { useEffect, useMemo, useState } from "react";

type Branch = { id: number; name: string };

type SterilizationUser = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
};

function formatUserLabel(u: SterilizationUser): string {
  if (u.ovog && u.ovog.trim() && u.name && u.name.trim()) return `${u.ovog.trim().charAt(0)}.${u.name.trim()}`;
  if (u.name && u.name.trim()) return u.name.trim();
  if (u.email) return u.email;
  return `User #${u.id}`;
}

type DisinfectionLog = {
  id: number;
  branchId: number;
  date: string; // ISO string (stored as midnight)
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  rinsedWithDistilledWater: boolean;
  driedInUVCabinet: boolean;
  nurseName: string;
  notes: string | null;

  qtyPolishingRubber: number;
  qtyBrush: number;
  qtyCup: number;
  qtyLine: number;
  qtyShoeCutter: number;
  qtyPlasticMedicineTray: number;
  qtyPlasticSpatula: number;
  qtyTongueDepressor: number;
  qtyMouthOpener: number;
  qtyRootmeterTip: number;
  qtyTighteningTip: number;
  qtyBurContainer: number;
  qtyPlasticSpoon: number;

  branch?: { id: number; name: string };
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

type QtyKey =
  | "qtyPolishingRubber"
  | "qtyBrush"
  | "qtyCup"
  | "qtyLine"
  | "qtyShoeCutter"
  | "qtyPlasticMedicineTray"
  | "qtyPlasticSpatula"
  | "qtyTongueDepressor"
  | "qtyMouthOpener"
  | "qtyRootmeterTip"
  | "qtyTighteningTip"
  | "qtyBurContainer"
  | "qtyPlasticSpoon";

const TOOL_FIELDS: { key: QtyKey; label: string }[] = [
  { key: "qtyPolishingRubber", label: "Өнгөлгөөний резин" },
  { key: "qtyBrush", label: "Браш" },
  { key: "qtyCup", label: "Хундага" },
  { key: "qtyLine", label: "Шугам" },
  { key: "qtyShoeCutter", label: "Гута тасдагч" },
  { key: "qtyPlasticMedicineTray", label: "Эмийн хуванцар тавиур" },
  { key: "qtyPlasticSpatula", label: "Хуванцар шпатель" },
  { key: "qtyTongueDepressor", label: "Хэл дарагч" },
  { key: "qtyMouthOpener", label: "Ам тэлэгч" },
  { key: "qtyRootmeterTip", label: "Рутмерийн хошуу" },
  { key: "qtyTighteningTip", label: "Чангалагч хошуу" },
  { key: "qtyBurContainer", label: "Борын сав" },
  { key: "qtyPlasticSpoon", label: "Хуванцар халбага" },
];

function sumQty(row: Pick<DisinfectionLog, QtyKey>) {
  return TOOL_FIELDS.reduce((sum, f) => sum + Number(row[f.key] || 0), 0);
}

export default function DisinfectionPage() {
  const now = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => formatDateOnly(now), [now]);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [logs, setLogs] = useState<DisinfectionLog[]>([]);

  // Sterilization users for nurse select
  const [sterilizationUsers, setSterilizationUsers] = useState<SterilizationUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Create form
  const [branchId, setBranchId] = useState<number | "">("");
  const [date, setDate] = useState<string>(todayYmd);
  const [startTime, setStartTime] = useState<string>(formatHHmm(new Date()));
  const [endTime, setEndTime] = useState<string>(formatHHmm(new Date()));
  const [rinsedWithDistilledWater, setRinsedWithDistilledWater] = useState<boolean>(true); // default YES
  const [driedInUVCabinet, setDriedInUVCabinet] = useState<boolean>(false); // default NO
  const [nurseName, setNurseName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [qty, setQty] = useState<Record<QtyKey, number>>(() => {
    const init: Record<QtyKey, number> = {} as any;
    for (const f of TOOL_FIELDS) init[f.key] = 0;
    return init;
  });

  // Filters (history)
  const [filterBranchId, setFilterBranchId] = useState<number | "">("");
  const [filterFrom, setFilterFrom] = useState(formatDateOnly(new Date(Date.now() - THIRTY_DAYS_MS)));
  const [filterTo, setFilterTo] = useState(formatDateOnly(new Date()));

  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load branches
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

  // If branch selected in form, default filter branch too (optional UX)
  useEffect(() => {
    if (branchId) setFilterBranchId(branchId);
  }, [branchId]);

  // Load sterilization users when branch changes
  useEffect(() => {
    if (!branchId) {
      setSterilizationUsers([]);
      setNurseName("");
      return;
    }
    setLoadingUsers(true);
    (async () => {
      try {
        const res = await fetch(`/api/users?role=sterilization&branchId=${branchId}`);
        const data = await res.json().catch(() => []);
        if (res.ok && Array.isArray(data)) {
          setSterilizationUsers(data);
          setNurseName(data.length > 0 ? formatUserLabel(data[0]) : "");
        } else {
          setSterilizationUsers([]);
          setNurseName("");
        }
      } catch {
        setSterilizationUsers([]);
        setNurseName("");
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, [branchId]);

  const loadLogs = async () => {
    setLoadingList(true);
    try {
      setError("");
      const bid = filterBranchId || branchId;
      if (!bid) {
        setLogs([]);
        return;
      }

      const params = new URLSearchParams();
      params.set("branchId", String(bid));
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const res = await fetch(`/api/sterilization/disinfection-logs?${params.toString()}`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || "Failed to load disinfection logs");

      setLogs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
      setLogs([]);
    } finally {
      setLoadingList(false);
    }
  };

  // Reload history when filters change
  useEffect(() => {
    void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, filterFrom, filterTo]);

  const setQtyField = (key: QtyKey, value: number) => {
    const n = Number.isFinite(value) ? Math.floor(value) : 0;
    setQty((prev) => ({ ...prev, [key]: Math.max(0, n) }));
  };

  const resetForm = () => {
    setDate(todayYmd);
    setStartTime(formatHHmm(new Date()));
    setEndTime(formatHHmm(new Date()));
    setRinsedWithDistilledWater(true);
    setDriedInUVCabinet(false);
    setNurseName(sterilizationUsers.length > 0 ? formatUserLabel(sterilizationUsers[0]) : "");
    setNotes("");
    const cleared: Record<QtyKey, number> = {} as any;
    for (const f of TOOL_FIELDS) cleared[f.key] = 0;
    setQty(cleared);
  };

  const submit = async () => {
    setError("");
    setSuccessMsg("");

    if (!branchId) return setError("Салбар сонгоно уу.");
    if (!date) return setError("Огноо оруулна уу.");
    if (!startTime) return setError("Эхэлсэн цаг оруулна уу.");
    if (!endTime) return setError("Дууссан цаг оруулна уу.");
    if (!nurseName.trim()) return setError("Сувилагчийн нэр оруулна уу.");

    const total = TOOL_FIELDS.reduce((s, f) => s + (qty[f.key] || 0), 0);
    if (total <= 0) return setError("Дор хаяж нэг багажийн тоо 0-ээс их байх ёстой.");

    setLoading(true);
    try {
      const body: any = {
        branchId: Number(branchId),
        date, // YYYY-MM-DD
        startTime, // HH:mm
        endTime, // HH:mm
        rinsedWithDistilledWater,
        driedInUVCabinet,
        nurseName: nurseName.trim(),
        notes: notes.trim() || null,
      };

      for (const f of TOOL_FIELDS) body[f.key] = qty[f.key] || 0;

      const res = await fetch("/api/sterilization/disinfection-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Хүйтэн ариутгал хадгалахад алдаа гарлаа.");

      setSuccessMsg("✅ Хүйтэн ариутгалын бүртгэл амжилттай хадгалагдлаа.");
      resetForm();
      await loadLogs();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1200px] px-5">
      <h1 className="mb-4 text-xl font-semibold">Хүйтэн ариутгал</h1>

      <div className="mb-6 rounded-lg border border-gray-300 bg-gray-50 p-5">
        <h2 className="mb-4 text-lg font-semibold">Шинэ бүртгэл үүсгэх</h2>

        {error && <div className="mb-3 rounded bg-red-50 p-2.5 text-red-700">{error}</div>}
        {successMsg && <div className="mb-3 rounded bg-emerald-50 p-2.5 text-emerald-700">{successMsg}</div>}

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div>
            <label className="mb-1 block font-bold">
              Салбар <span className="text-red-600">*</span>
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            >
              <option value="">-- Сонгох --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-bold">
              Огноо <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-bold">
              Эхэлсэн цаг <span className="text-red-600">*</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-bold">
              Дууссан цаг <span className="text-red-600">*</span>
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-bold">
              Нэрмэл усаар зайлсан эсэх <span className="text-red-600">*</span>
            </label>
            <select
              value={rinsedWithDistilledWater ? "YES" : "NO"}
              onChange={(e) => setRinsedWithDistilledWater(e.target.value === "YES")}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            >
              <option value="YES">Тийм</option>
              <option value="NO">Үгүй</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-bold">
              Хэт ягаан туяатай хатаах шүүгээнд хатаасан эсэх <span className="text-red-600">*</span>
            </label>
            <select
              value={driedInUVCabinet ? "YES" : "NO"}
              onChange={(e) => setDriedInUVCabinet(e.target.value === "YES")}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            >
              <option value="NO">Үгүй</option>
              <option value="YES">Тийм</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-bold">
              Сувилагчийн нэр <span className="text-red-600">*</span>
            </label>
            <select
              value={nurseName}
              onChange={(e) => setNurseName(e.target.value)}
              disabled={!branchId || loadingUsers}
              className="w-full rounded border border-gray-300 p-2 text-sm disabled:bg-gray-100"
            >
              {!branchId && <option value="">-- Эхлээд салбар сонгоно уу --</option>}
              {branchId && loadingUsers && <option value="">Ачаалж байна...</option>}
              {branchId && !loadingUsers && sterilizationUsers.length === 0 && (
                <option value="">Ариутгалын ажилтан олдсонгүй</option>
              )}
              {branchId && !loadingUsers &&
                sterilizationUsers.map((u) => (
                  <option key={u.id} value={formatUserLabel(u)}>
                    {formatUserLabel(u)}
                  </option>
                ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block font-bold">Тэмдэглэл</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Тэмдэглэл..."
              className="w-full rounded border border-gray-300 p-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 font-bold">Багажийн тоо (0 байж болно)</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-b-2 border-gray-300 p-2.5 text-left">Багаж</th>
                  <th className="w-[140px] border-b-2 border-gray-300 p-2.5 text-right">Тоо</th>
                </tr>
              </thead>
              <tbody>
                {TOOL_FIELDS.map((f) => (
                  <tr key={f.key} className="border-b border-gray-200">
                    <td className="p-2.5">{f.label}</td>
                    <td className="p-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        value={qty[f.key]}
                        onChange={(e) => setQtyField(f.key, Number(e.target.value) || 0)}
                        className="w-[110px] rounded border border-gray-300 p-1.5 text-right text-sm"
                      />
                    </td>
                  </tr>
                ))}

                <tr className="border-t-2 border-gray-300">
                  <td className="p-2.5 font-bold">Нийт</td>
                  <td className="p-2.5 text-right font-bold">
                    {TOOL_FIELDS.reduce((s, f) => s + (qty[f.key] || 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={submit}
            disabled={loading}
            className="rounded bg-green-600 px-5 py-2.5 text-base text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-300 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Бүртгэлийн түүх</h2>

        <div className="mb-4 flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block font-bold">Салбар</label>
            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : "")}
              className="rounded border border-gray-300 p-2 text-sm"
            >
              <option value="">-- Сонгох --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="mt-0.5 text-xs text-gray-500">(Салбар сонгохгүй бол жагсаалт хоосон байна)</div>
          </div>

          <div>
            <label className="mb-1 block font-bold">Эхлэх огноо</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="rounded border border-gray-300 p-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-bold">Дуусах огноо</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="rounded border border-gray-300 p-2 text-sm"
            />
          </div>

          <div className="self-end">
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={loadingList}
              className="rounded border border-gray-300 bg-white px-3.5 py-[9px] text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingList ? "Ачаалж байна..." : "Шинэчлэх"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b-2 border-gray-300 p-2.5 text-left">Огноо</th>
                <th className="border-b-2 border-gray-300 p-2.5 text-left">Цаг</th>
                <th className="border-b-2 border-gray-300 p-2.5 text-left">Сувилагч</th>
                <th className="border-b-2 border-gray-300 p-2.5 text-center">Нэрмэл ус</th>
                <th className="border-b-2 border-gray-300 p-2.5 text-center">UV</th>
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

              {!loadingList && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-5 text-center text-gray-400">
                    Мэдээлэл олдсонгүй
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id} className="border-b border-gray-200">
                    <td className="p-2.5">{new Date(row.date).toLocaleDateString("mn-MN")}</td>
                    <td className="p-2.5">
                      {row.startTime}–{row.endTime}
                    </td>
                    <td className="p-2.5">{row.nurseName}</td>
                    <td className="p-2.5 text-center">{row.rinsedWithDistilledWater ? "Тийм" : "Үгүй"}</td>
                    <td className="p-2.5 text-center">{row.driedInUVCabinet ? "Тийм" : "Үгүй"}</td>
                    <td className="p-2.5 text-right font-bold">{sumQty(row as any)}</td>
                    <td className="p-2.5 text-gray-700">{row.notes || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {logs.length > 0 && !loadingList && (
          <div className="mt-2.5 text-xs text-gray-500">Нийт бүртгэл: {logs.length}</div>
        )}
      </div>
    </div>
  );
}

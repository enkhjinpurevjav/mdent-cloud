import { useEffect, useRef, useState } from "react";

type Branch = { id: number; name: string };

type SterilizationUser = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
};

type Machine = {
  id: number;
  machineNumber: string;
  name: string | null;
  branchId: number;
};

type BurCycle = {
  id: number;
  branchId: number;
  code: string;
  sterilizationRunNumber: string;
  machineId: number;
  startedAt: string;
  pressure: string | null;
  temperature: number | null;
  finishedAt: string;
  removedFromAutoclaveAt: string | null;
  result: "PASS" | "FAIL";
  operator: string;
  notes: string | null;
  fastBurQty: number;
  slowBurQty: number;
  createdAt: string;
  updatedAt: string;
  branch: { id: number; name: string };
  machine: { id: number; machineNumber: string; name: string | null } | null;
};

const CLINIC_TIME_ZONE = "Asia/Ulaanbaatar";

function formatDateTime(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function formatDateOnly(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatIsoDateTimeInClinicTz(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("mn-MN", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function addMinutes(dateTimeLocal: string, minutes: number): string {
  const d = new Date(dateTimeLocal);
  d.setMinutes(d.getMinutes() + minutes);
  return formatDateTime(d);
}

function toNaiveTimestampFromLocal(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  const normalized = datetimeLocal.replace("T", " ");
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function formatUserLabel(u: SterilizationUser): string {
  if (u.ovog && u.ovog.trim() && u.name && u.name.trim()) return `${u.ovog.trim().charAt(0)}.${u.name.trim()}`;
  if (u.name && u.name.trim()) return u.name.trim();
  if (u.email) return u.email;
  return `User #${u.id}`;
}

export default function BurCyclesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [burCycles, setBurCycles] = useState<BurCycle[]>([]);

  // Sterilization users for operator select
  const [sterilizationUsers, setSterilizationUsers] = useState<SterilizationUser[]>([]);

  // Form fields
  const [branchId, setBranchId] = useState<number | "">("");
  const [sterilizationRunNumber, setSterilizationRunNumber] = useState("");
  const [runNumberWarning, setRunNumberWarning] = useState("");
  const [lastCheckedRunNumber, setLastCheckedRunNumber] = useState("");
  const [machineId, setMachineId] = useState<number | "">("");
  const [startedAt, setStartedAt] = useState(formatDateTime(new Date()));
  const [pressure, setPressure] = useState("0247");
  const [temperature, setTemperature] = useState("138");
  const [finishedAt, setFinishedAt] = useState(() => addMinutes(formatDateTime(new Date()), 10));
  // Track whether the user has manually overridden finishedAt
  const finishedAtOverridden = useRef(false);
  // Keep a ref to always have the current startedAt value available in effects
  const startedAtRef = useRef(startedAt);
  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);
  const [removedFromAutoclaveAt, setRemovedFromAutoclaveAt] = useState("");
  const [result, setResult] = useState<"PASS" | "FAIL">("PASS");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");
  const [fastBurQty, setFastBurQty] = useState<number>(0);
  const [slowBurQty, setSlowBurQty] = useState<number>(0);

  // Filter fields
  const [filterFrom, setFilterFrom] = useState(formatDateOnly(new Date(Date.now() - THIRTY_DAYS_MS))); // 30 days ago
  const [filterTo, setFilterTo] = useState(formatDateOnly(new Date()));
  const [filterBranchId, setFilterBranchId] = useState<number | "">("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load branches on mount
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

  // Load machines when branch changes
  useEffect(() => {
    if (!branchId) {
      setMachines([]);
      setMachineId("");
      setRunNumberWarning("");
      setLastCheckedRunNumber("");
      setSterilizationUsers([]);
      setOperator("");
      return;
    }

    // Reset finishedAt override when branch changes
    finishedAtOverridden.current = false;
    const newFinishedAt = addMinutes(startedAtRef.current || formatDateTime(new Date()), 10);
    setFinishedAt(newFinishedAt);
    setRunNumberWarning("");
    setLastCheckedRunNumber("");

    (async () => {
      try {
        const res = await fetch(`/api/sterilization/machines?branchId=${branchId}`);
        const data = await res.json().catch(() => []);

        if (res.ok) {
          const machinesList = Array.isArray(data) ? data : [];
          setMachines(machinesList);
          // Default to first machine
          if (machinesList.length > 0) {
            setMachineId(machinesList[0].id);
          }
        }
      } catch {
        setMachines([]);
      }
    })();

    (async () => {
      try {
        const res = await fetch(`/api/users?role=sterilization&branchId=${branchId}`);
        const data = await res.json().catch(() => []);
        if (res.ok && Array.isArray(data)) {
          setSterilizationUsers(data);
          setOperator(data.length > 0 ? formatUserLabel(data[0]) : "");
        } else {
          setSterilizationUsers([]);
          setOperator("");
        }
      } catch {
        setSterilizationUsers([]);
        setOperator("");
      }
    })();
  }, [branchId]);

  // Load bur cycles when filter changes
  useEffect(() => {
    loadBurCycles();
  }, [filterFrom, filterTo, filterBranchId]);

  const loadBurCycles = async () => {
    try {
      const params = new URLSearchParams();
      if (filterBranchId) params.append("branchId", String(filterBranchId));
      if (filterFrom) params.append("from", filterFrom);
      if (filterTo) params.append("to", filterTo);

      const res = await fetch(`/api/sterilization/bur-cycles?${params.toString()}`);
      const data = await res.json().catch(() => []);

      if (res.ok) {
        setBurCycles(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  };

  const checkRunNumberUniqueness = async (forceCheck = false) => {
    if (!machineId || !sterilizationRunNumber.trim()) {
      setRunNumberWarning("");
      return true;
    }

    // Avoid duplicate checks
    if (!forceCheck && sterilizationRunNumber.trim() === lastCheckedRunNumber) {
      return !runNumberWarning;
    }

    setLastCheckedRunNumber(sterilizationRunNumber.trim());

    try {
      const res = await fetch(
        `/api/sterilization/bur-cycles/check-run-number?machineId=${machineId}&sterilizationRunNumber=${encodeURIComponent(
          sterilizationRunNumber.trim()
        )}`
      );
      const data = await res.json().catch(() => ({ exists: false }));

      if (data.exists) {
        setRunNumberWarning("⚠️ Энэ ариутгалын дугаар аль хэдийн ашиглагдсан байна");
        return false;
      } else {
        setRunNumberWarning("");
        return true;
      }
    } catch {
      setRunNumberWarning("");
      return true;
    }
  };

  const submit = async () => {
    setError("");
    setSuccessMsg("");

    // Validation
    if (!branchId) return setError("Салбар сонгоно уу.");
    if (!sterilizationRunNumber.trim()) return setError("Ариутгалын дугаар оруулна уу.");
    if (!machineId) return setError("Машин сонгоно уу.");
    if (!startedAt) return setError("Эхэлсэн цаг оруулна уу.");
    if (!finishedAt) return setError("Дууссан цаг оруулна уу.");
    if (!operator.trim()) return setError("Сувилагчийн нэр оруулна уу.");
    if (runNumberWarning) return setError("Ариутгалын дугаар давхардсан байна.");

    const runNumberOk = await checkRunNumberUniqueness(true);
    if (!runNumberOk) return setError("Ариутгалын дугаар давхардсан байна.");

    if (fastBurQty === 0 && slowBurQty === 0) {
      return setError("Хурдан эсвэл удаан өрмийн тоо дор хаяж нэг нь 0-ээс их байх ёстой.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sterilization/bur-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          sterilizationRunNumber: sterilizationRunNumber.trim(),
          machineId,
          startedAt: toNaiveTimestampFromLocal(startedAt),
          pressure: pressure.trim() || null,
          temperature: temperature ? Number(temperature) : null,
          finishedAt: toNaiveTimestampFromLocal(finishedAt),
          removedFromAutoclaveAt: removedFromAutoclaveAt
            ? toNaiveTimestampFromLocal(removedFromAutoclaveAt)
            : null,
          result,
          operator: operator.trim(),
          notes: notes.trim() || null,
          fastBurQty,
          slowBurQty,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(`✅ Өрмийн бүртгэл амжилттай үүслээ. Код: ${data?.code || "-"}`);
        // Reset form
        setSterilizationRunNumber("");
        setPressure("0247");
        setTemperature("138");
        setNotes("");
        setFastBurQty(0);
        setSlowBurQty(0);
        const newStartedAt = formatDateTime(new Date());
        setStartedAt(newStartedAt);
        finishedAtOverridden.current = false;
        setFinishedAt(addMinutes(newStartedAt, 10));
        setRemovedFromAutoclaveAt("");
        setRunNumberWarning("");
        setLastCheckedRunNumber("");
        // Reload list
        loadBurCycles();
      } else {
        setError(data.error || "Алдаа гарлаа.");
      }
    } catch (err) {
      setError("Серверт холбогдох үед алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 [font-family:Arial,sans-serif]">
      <h1 className="mb-5">Өрмийн бүртгэл, хяналт</h1>

      {/* Create Form */}
      <div className="mb-[30px] rounded-lg border border-[#ccc] bg-[#f9f9f9] p-5">
        <h2 className="mb-5 mt-0">Шинэ бүртгэл үүсгэх</h2>

        {error && (
          <div className="mb-[15px] rounded p-2.5 text-[#c62828] bg-[#ffebee]">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-[15px] rounded bg-[#e8f5e9] p-2.5 text-[#2e7d32]">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-[15px]">
          {/* Branch */}
          <div>
            <label className="mb-[5px] block font-bold">
              Салбар <span className="text-[red]">*</span>
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
            >
              <option value="">-- Сонгох --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Machine */}
          <div>
            <label className="mb-[5px] block font-bold">
              Машин <span className="text-[red]">*</span>
            </label>
            <select
              value={machineId}
              onChange={(e) => {
                setMachineId(e.target.value ? Number(e.target.value) : "");
                setRunNumberWarning("");
                setLastCheckedRunNumber("");
              }}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
              disabled={!branchId}
            >
              <option value="">-- Сонгох --</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.machineNumber} {m.name ? `(${m.name})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Cycle Code */}
          <div>
            <label className="mb-[5px] block font-bold">
              Циклын код
            </label>
            <input
              type="text"
              value="Автоматаар үүснэ"
              readOnly
              className="w-full cursor-default rounded border border-[#ccc] bg-gray-100 p-2 text-sm text-gray-500"
            />
          </div>

          {/* Sterilization Run Number */}
          <div>
            <label className="mb-[5px] block font-bold">
              Ариутгалын дугаар <span className="text-[red]">*</span>
            </label>
            <input
              type="text"
              value={sterilizationRunNumber}
              onChange={(e) => {
                setSterilizationRunNumber(e.target.value);
                setRunNumberWarning("");
                setLastCheckedRunNumber("");
              }}
              onBlur={() => void checkRunNumberUniqueness()}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
              placeholder="Ариутгалын дугаар"
            />
            {runNumberWarning && <div className="mt-[3px] text-xs text-[#ff9800]">{runNumberWarning}</div>}
          </div>

          {/* Started At */}
          <div>
            <label className="mb-[5px] block font-bold">
              Эхэлсэн цаг <span className="text-[red]">*</span>
            </label>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => {
                setStartedAt(e.target.value);
                if (!finishedAtOverridden.current) {
                  setFinishedAt(addMinutes(e.target.value, 10));
                }
              }}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
            />
          </div>

          {/* Finished At */}
          <div>
            <label className="mb-[5px] block font-bold">
              Дууссан цаг <span className="text-[red]">*</span>
            </label>
            <input
              type="datetime-local"
              value={finishedAt}
              onChange={(e) => {
                finishedAtOverridden.current = true;
                setFinishedAt(e.target.value);
              }}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
            />
          </div>

          {/* Pressure */}
          <div>
            <label className="mb-[5px] block font-bold">Даралт (kPa)</label>
            <input
              type="text"
              value={pressure}
              onChange={(e) => setPressure(e.target.value)}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
              placeholder="жишээ: 90 230"
            />
          </div>

          {/* Temperature */}
          <div>
            <label className="mb-[5px] block font-bold">Температур (°C)</label>
            <input
              type="text"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
              placeholder="Температур"
            />
          </div>

          {/* Removed From Autoclave At */}
          <div>
            <label className="mb-[5px] block font-bold">Автоклаваас гаргасан цаг</label>
            <input
              type="datetime-local"
              value={removedFromAutoclaveAt}
              onChange={(e) => setRemovedFromAutoclaveAt(e.target.value)}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
            />
          </div>

          {/* Result */}
          <div>
            <label className="mb-[5px] block font-bold">
              Үр дүн <span className="text-[red]">*</span>
            </label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value as "PASS" | "FAIL")}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
            >
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
            </select>
          </div>

          {/* Operator */}
          <div>
            <label className="mb-[5px] block font-bold">
              Сувилагчийн нэр <span className="text-[red]">*</span>
            </label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              disabled={!branchId}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
            >
              {sterilizationUsers.length === 0 ? (
                <option value="">-- Сонгох --</option>
              ) : (
                sterilizationUsers.map((u) => {
                  const label = formatUserLabel(u);
                  return (
                    <option key={u.id} value={label}>
                      {label}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* Fast Bur Qty */}
          <div>
            <label className="mb-[5px] block font-bold">Хурдан өрөм тоо</label>
            <input
              type="number"
              min="0"
              value={fastBurQty}
              onChange={(e) => setFastBurQty(Number(e.target.value) || 0)}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
              placeholder="0"
            />
          </div>

          {/* Slow Bur Qty */}
          <div>
            <label className="mb-[5px] block font-bold">Удаан өрөм тоо</label>
            <input
              type="number"
              min="0"
              value={slowBurQty}
              onChange={(e) => setSlowBurQty(Number(e.target.value) || 0)}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
              placeholder="0"
            />
          </div>

          {/* Notes (full width) */}
          <div className="col-span-2">
            <label className="mb-[5px] block font-bold">Тэмдэглэл</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-[#ccc] p-2 text-sm"
              placeholder="Тэмдэглэл..."
            />
          </div>
        </div>

        <div className="mt-5">
          <button
            onClick={submit}
            disabled={loading}
            className={`rounded px-5 py-2.5 text-base text-white border-0 ${
              loading ? "cursor-not-allowed bg-[#ccc]" : "cursor-pointer bg-[#4caf50]"
            }`}
          >
            {loading ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </div>

      {/* History List */}
      <div className="rounded-lg border border-[#ccc] bg-white p-5">
        <h2 className="mb-5 mt-0">Бүртгэлийн түүх</h2>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap gap-[15px]">
          <div>
            <label className="mb-[5px] block font-bold">Салбар</label>
            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : "")}
              className="rounded border border-[#ccc] p-2 text-sm"
            >
              <option value="">-- Бүгд --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-[5px] block font-bold">Эхлэх огноо</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="rounded border border-[#ccc] p-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-[5px] block font-bold">Дуусах огноо</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="rounded border border-[#ccc] p-2 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className="border-b-2 border-[#ddd] p-2.5 text-left">Огноо</th>
                <th className="border-b-2 border-[#ddd] p-2.5 text-left">Салбар</th>
                <th className="border-b-2 border-[#ddd] p-2.5 text-left">Машин</th>
                <th className="border-b-2 border-[#ddd] p-2.5 text-left">Дугаар</th>
                <th className="border-b-2 border-[#ddd] p-2.5 text-left">Код</th>
                <th className="border-b-2 border-[#ddd] p-2.5 text-right">Хурдан өрөм</th>
                <th className="border-b-2 border-[#ddd] p-2.5 text-right">Удаан өрөм</th>
                <th className="border-b-2 border-[#ddd] p-2.5 text-right">Нийт өрөм</th>
                <th className="border-b-2 border-[#ddd] p-2.5 text-center">Үр дүн</th>
                <th className="border-b-2 border-[#ddd] p-2.5 text-left">Сувилагч</th>
              </tr>
            </thead>
            <tbody>
              {burCycles.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-5 text-center text-[#999]">
                    Мэдээлэл олдсонгүй
                  </td>
                </tr>
              ) : (
                burCycles.map((cycle) => (
                  <tr key={cycle.id} className="border-b border-[#eee]">
                    <td className="p-2.5">{formatIsoDateTimeInClinicTz(cycle.startedAt)}</td>
                    <td className="p-2.5">{cycle.branch.name}</td>
                    <td className="p-2.5">
                      {cycle.machine
                        ? `${cycle.machine.machineNumber}${cycle.machine.name ? ` (${cycle.machine.name})` : ""}`
                        : cycle.machineId}
                    </td>
                    <td className="p-2.5">{cycle.sterilizationRunNumber}</td>
                    <td className="p-2.5">{cycle.code}</td>
                    <td className="p-2.5 text-right">{cycle.fastBurQty}</td>
                    <td className="p-2.5 text-right">{cycle.slowBurQty}</td>
                    <td className="p-2.5 text-right font-bold">
                      {cycle.fastBurQty + cycle.slowBurQty}
                    </td>
                    <td className="p-2.5 text-center">
                      <span
                        className={`rounded px-2 py-1 font-bold ${
                          cycle.result === "PASS" ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-[#ffebee] text-[#c62828]"
                        }`}
                      >
                        {cycle.result}
                      </span>
                    </td>
                    <td className="p-2.5">{cycle.operator}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

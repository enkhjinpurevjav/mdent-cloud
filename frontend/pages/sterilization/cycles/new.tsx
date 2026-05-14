import React, { useEffect, useState } from "react";

type Branch = { id: number; name: string };

type SterilizationUser = {
  id: number;
  name: string | null;
  ovog: string | null;
  email: string;
};

function formatUserLabel(user: SterilizationUser): string {
  const ovog = user.ovog?.trim();
  const name = user.name?.trim();
  if (ovog && name) return `${ovog[0]}.${name}`;
  if (name) return name;
  if (user.email) return user.email;
  return `User #${user.id}`;
}

function addMinutes(datetimeLocal: string, minutes: number): string {
  if (!datetimeLocal) return "";
  const date = new Date(datetimeLocal);
  if (isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() + minutes);
  return formatDateTime(date);
}

function toNaiveTimestampFromLocal(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  const normalized = datetimeLocal.replace("T", " ");
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

type SterilizationItem = {
  id: number;
  name: string;
  branchId: number;
};

type Machine = {
  id: number;
  machineNumber: string;
  name: string | null;
  branchId: number;
};

type ToolLine = {
  id: string; // Stable unique identifier for React key
  toolId: number | "";
  producedQty: number;
  toolSearch: string; // Search query for filtering tools
  showDropdown: boolean; // Whether to show the dropdown
  duplicateError: string; // Error message for duplicate selection
};

function formatDateTime(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

let toolLineIdCounter = 0;

function generateId() {
  return `tool-line-${Date.now()}-${++toolLineIdCounter}`;
}

export default function CycleCreatePage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tools, setTools] = useState<SterilizationItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sterilizationUsers, setSterilizationUsers] = useState<SterilizationUser[]>([]);

  const [branchId, setBranchId] = useState<number | "">("");
  const [sterilizationRunNumber, setSterilizationRunNumber] = useState("");
  const [runNumberWarning, setRunNumberWarning] = useState("");
  const [lastCheckedRunNumber, setLastCheckedRunNumber] = useState("");
  const [machineId, setMachineId] = useState<number | "">("");
  const [startedAt, setStartedAt] = useState(formatDateTime(new Date()));
  const [pressure, setPressure] = useState("90-230");
  const [temperature, setTemperature] = useState("134");
  const finishedAt = addMinutes(startedAt, 90);
  const [removedFromAutoclaveAt, setRemovedFromAutoclaveAt] = useState("");
  const [result, setResult] = useState<"PASS" | "FAIL">("PASS");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");
  const [toolLines, setToolLines] = useState<ToolLine[]>([{ id: generateId(), toolId: "", producedQty: 1, toolSearch: "", showDropdown: false, duplicateError: "" }]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

  useEffect(() => {
    if (!branchId) {
      setTools([]);
      setMachines([]);
      setMachineId("");
      setRunNumberWarning("");
      setLastCheckedRunNumber("");
      return;
    }
    
    (async () => {
      try {
        const [itemsRes, machinesRes] = await Promise.all([
          fetch(`/api/sterilization/items?branchId=${branchId}`),
          fetch(`/api/sterilization/machines?branchId=${branchId}`)
        ]);
        
        const itemsData = await itemsRes.json().catch(() => []);
        const machinesData = await machinesRes.json().catch(() => []);
        
        if (itemsRes.ok) setTools(Array.isArray(itemsData) ? itemsData : []);
        if (machinesRes.ok) {
          const machinesList = Array.isArray(machinesData) ? machinesData : [];
          setMachines(machinesList);
          // Default to first machine
          if (machinesList.length > 0) {
            setMachineId(machinesList[0].id);
          }
        }
      } catch {
        setTools([]);
        setMachines([]);
      }
    })();
  }, [branchId]);

  useEffect(() => {
    setSterilizationUsers([]);
    setOperator("");
    if (!branchId) return;
    (async () => {
      try {
        const res = await fetch(`/api/users?role=sterilization&branchId=${branchId}`);
        const data = await res.json().catch(() => []);
        if (res.ok) {
          const users: SterilizationUser[] = Array.isArray(data) ? data : [];
          setSterilizationUsers(users);
          if (users.length > 0) {
            setOperator(formatUserLabel(users[0]));
          }
        }
      } catch {
        setSterilizationUsers([]);
      }
    })();
  }, [branchId]);

  const checkRunNumberUniqueness = async (forceCheck = false) => {
    if (!branchId || !machineId || !sterilizationRunNumber.trim()) {
      setRunNumberWarning("");
      return true;
    }

    if (!forceCheck && sterilizationRunNumber.trim() === lastCheckedRunNumber) {
      return !runNumberWarning;
    }

    setLastCheckedRunNumber(sterilizationRunNumber.trim());

    try {
      const res = await fetch(
        `/api/sterilization/cycles/check-run-number?branchId=${branchId}&machineId=${machineId}&sterilizationRunNumber=${encodeURIComponent(
          sterilizationRunNumber.trim()
        )}`
      );
      const data = await res.json().catch(() => ({ exists: false }));
      if (data.exists) {
        setRunNumberWarning("⚠️ Энэ ариутгалын дугаар аль хэдийн ашиглагдсан байна");
        return false;
      }
      setRunNumberWarning("");
      return true;
    } catch {
      setRunNumberWarning("");
      return true;
    }
  };

  const addToolLine = () => {
    setToolLines([...toolLines, { id: generateId(), toolId: "", producedQty: 1, toolSearch: "", showDropdown: false, duplicateError: "" }]);
  };

  const removeToolLine = (index: number) => {
    setToolLines(toolLines.filter((_, i) => i !== index));
  };

  const updateToolLine = (index: number, field: keyof ToolLine, value: any) => {
    const updated = [...toolLines];
    updated[index] = { ...updated[index], [field]: value };
    setToolLines(updated);
  };

  // Helper to update multiple fields in a single state update (reduces re-renders)
  const patchToolLine = (index: number, patches: Partial<ToolLine>) => {
    const updated = [...toolLines];
    updated[index] = { ...updated[index], ...patches };
    setToolLines(updated);
  };

  const selectTool = (index: number, toolId: number) => {
    // Check if this tool is already selected in another line
    const alreadySelected = toolLines.some((line, i) => i !== index && line.toolId === toolId);
    
    if (alreadySelected) {
      // Don't select, show error
      patchToolLine(index, { duplicateError: "Энэ багаж аль хэдийн сонгогдсон байна" });
      return;
    }
    
    // Find the tool name
    const selectedTool = tools.find((t) => t.id === toolId);
    
    // Update with single state change
    patchToolLine(index, {
      toolId,
      toolSearch: selectedTool?.name || "",
      showDropdown: false,
      duplicateError: "",
    });
  };

  const submit = async () => {
    setError("");
    setSuccessMsg("");

    if (!branchId) return setError("Салбар сонгоно уу.");
    if (!machineId) return setError("Машин сонгоно уу.");
    if (!startedAt) return setError("Эхэлсэн цаг оруулна уу.");
    if (!finishedAt) return setError("Дууссан цаг оруулна уу.");
    if (!operator.trim()) return setError("Сувилагч сонгоно уу.");
    if (runNumberWarning) return setError("Ариутгалын дугаарыг давхардуулж болохгүй.");

    const runNumberOk = await checkRunNumberUniqueness(true);
    if (!runNumberOk) {
      return setError("Ариутгалын дугаар давхардсан байна.");
    }

    const validLines = toolLines.filter((line) => line.toolId && line.producedQty >= 1);
    if (validLines.length === 0) {
      return setError("Дор хаяж 1 багаж нэмнэ үү.");
    }

    setLoading(true);
    try {
      const body: any = {
        branchId: Number(branchId),
        machineId: Number(machineId),
        startedAt: toNaiveTimestampFromLocal(startedAt),
        finishedAt: toNaiveTimestampFromLocal(finishedAt),
        result,
        operator: operator.trim(),
        notes: notes.trim() || undefined,
        toolLines: validLines.map((line) => ({
          toolId: Number(line.toolId),
          producedQty: Math.floor(line.producedQty),
        })),
      };

      if (sterilizationRunNumber.trim()) {
        body.sterilizationRunNumber = sterilizationRunNumber.trim();
      }
      if (pressure.trim()) {
        // Sanitize pressure: keep only digits and spaces, normalize spacing
        const sanitizedPressure = pressure.replace(/-/g, ' ').replace(/[^\d\s]/g, '').replace(/\s+/g, ' ').trim();
        if (sanitizedPressure) {
          body.pressure = sanitizedPressure;
        }
      }
      if (temperature.trim()) {
        body.temperature = Number(temperature);
      }
      if (removedFromAutoclaveAt) {
        body.removedFromAutoclaveAt = toNaiveTimestampFromLocal(removedFromAutoclaveAt);
      }

      const res = await fetch("/api/sterilization/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Цикл үүсгэхэд алдаа гарлаа");

      setSuccessMsg(`Цикл үүсгэлээ: ${json?.code || "Автоматаар үүссэн код"}`);
      
      // Reset form
      setSterilizationRunNumber("");
      setRunNumberWarning("");
      setLastCheckedRunNumber("");
      setStartedAt(formatDateTime(new Date()));
      setPressure("90-230");
      setTemperature("134");
      setRemovedFromAutoclaveAt("");
      if (sterilizationUsers.length > 0) {
        setOperator(formatUserLabel(sterilizationUsers[0]));
      } else {
        setOperator("");
      }
      setNotes("");
      setToolLines([{ id: generateId(), toolId: "", producedQty: 1, toolSearch: "", showDropdown: false, duplicateError: "" }]);
      // Reset machine to first one if available
      if (machines.length > 0) {
        setMachineId(machines[0].id);
      }
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1200px]">
      <h1 className="mb-1.5 text-lg font-semibold">Ариутгал → Цикл үүсгэх</h1>
      <p className="mb-3 text-sm text-gray-500">Автоклавын цикл үүсгэх. Багажуудын үйлдвэрлэгдсэн тоог бүртгэнэ.</p>

      {error && <div className="mb-2.5 text-sm text-red-700">{error}</div>}
      {successMsg && <div className="mb-2.5 text-sm text-emerald-700">{successMsg}</div>}

      <div className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 font-semibold">Циклын мэдээлэл</div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Салбар <span className="text-red-600">*</span>
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            >
              <option value="">Сонгох...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Ариутгалын дугаар</label>
            <input
              value={sterilizationRunNumber}
              onChange={(e) => {
                setSterilizationRunNumber(e.target.value);
                setRunNumberWarning("");
                setLastCheckedRunNumber("");
              }}
              onBlur={() => void checkRunNumberUniqueness()}
              placeholder="Ж: SR-001"
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
            {runNumberWarning && (
              <div className="mt-1 text-xs text-orange-600">{runNumberWarning}</div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Циклын код
            </label>
            <input
              value="Автоматаар үүснэ"
              readOnly
              className="w-full cursor-default rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-2 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Машин <span className="text-red-600">*</span>
            </label>
            <select
              value={machineId}
              onChange={(e) => {
                setMachineId(e.target.value ? Number(e.target.value) : "");
                setRunNumberWarning("");
                setLastCheckedRunNumber("");
              }}
              disabled={!branchId || machines.length === 0}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm disabled:bg-gray-100"
            >
              <option value="">Сонгох...</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.machineNumber}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Эхэлсэн цаг <span className="text-red-600">*</span>
            </label>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Даралт</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={pressure}
                onChange={(e) => setPressure(e.target.value)}
                placeholder="Ж: 90 230"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
              />
              <span className="whitespace-nowrap text-sm text-gray-500">kPa</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Температур</label>
            <input
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="Ж: 134"
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Дууссан цаг <span className="text-red-600">*</span>
            </label>
            <input
              type="datetime-local"
              value={finishedAt}
              readOnly
              className="w-full cursor-default rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Автоклаваас гаргасан цаг</label>
            <input
              type="datetime-local"
              value={removedFromAutoclaveAt}
              onChange={(e) => setRemovedFromAutoclaveAt(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Үр дүн <span className="text-red-600">*</span>
            </label>
            <div className="flex items-center gap-4 pt-2">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="result"
                  value="PASS"
                  checked={result === "PASS"}
                  onChange={() => setResult("PASS")}
                />
                <span className="text-sm font-medium text-emerald-700">✓ PASS</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="result"
                  value="FAIL"
                  checked={result === "FAIL"}
                  onChange={() => setResult("FAIL")}
                />
                <span className="text-sm font-medium text-red-700">✗ FAIL</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Сувилагчийн нэр <span className="text-red-600">*</span>
            </label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              disabled={!branchId}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm disabled:bg-gray-100"
            >
              {!branchId && <option value="">Эхлээд салбар сонгоно уу</option>}
              {branchId && sterilizationUsers.length === 0 && <option value="">Сувилагч байхгүй</option>}
              {sterilizationUsers.map((u) => {
                const label = formatUserLabel(u);
                return <option key={u.id} value={label}>{label}</option>;
              })}
            </select>
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <label className="mb-1 block text-xs text-gray-500">Тэмдэглэл</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Нэмэлт мэдээлэл..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">Багажийн жагсаалт</div>
          <button
            type="button"
            onClick={addToolLine}
            disabled={!branchId}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            + Багаж нэмэх
          </button>
        </div>

        {!branchId && <div className="py-3 text-sm text-gray-500">Эхлээд салбар сонгоно уу.</div>}
        {branchId && toolLines.length === 0 && <div className="py-3 text-sm text-gray-500">Багаж нэмээгүй байна.</div>}

        {branchId && toolLines.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-1 py-2">№</th>
                <th className="px-1 py-2">Багаж</th>
                <th className="w-[140px] px-1 py-2">Үйлдвэрлэсэн тоо</th>
                <th className="w-[100px] px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {toolLines.map((line, index) => {
                const filteredTools = line.toolSearch.trim()
                  ? tools.filter((tool) => tool.name.toLowerCase().includes(line.toolSearch.toLowerCase()))
                  : tools;

                return (
                  <tr key={line.id} className="border-b border-gray-100">
                    <td className="px-1 py-2 align-top">{index + 1}</td>
                    <td className="px-1 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={line.toolSearch}
                          onChange={(e) => {
                            patchToolLine(index, {
                              toolSearch: e.target.value,
                              toolId: "",
                              showDropdown: true,
                              duplicateError: "",
                            });
                          }}
                          onFocus={() => patchToolLine(index, { showDropdown: true })}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              patchToolLine(index, { showDropdown: false });
                            }
                          }}
                          placeholder="Багаж хайх..."
                          className={`w-full rounded-lg border px-2 py-1.5 text-sm ${
                            line.duplicateError ? "border-red-600" : "border-gray-300"
                          }`}
                        />
                        {line.showDropdown && filteredTools.length > 0 && (
                          <div className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-[200px] overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-md">
                            {filteredTools.map((tool) => (
                              <div
                                key={tool.id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectTool(index, tool.id);
                                }}
                                className={`cursor-pointer border-b border-gray-100 px-2.5 py-2 text-sm hover:bg-gray-100 ${
                                  line.toolId === tool.id ? "bg-blue-50" : "bg-white"
                                }`}
                              >
                                {tool.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {line.duplicateError && <div className="mt-0.5 text-xs text-red-600">{line.duplicateError}</div>}
                      {line.toolSearch.trim() && !line.showDropdown && filteredTools.length === 0 && (
                        <div className="mt-0.5 text-xs text-red-600">Илэрц олдсонгүй</div>
                      )}
                    </td>
                    <td className="px-1 py-2 align-top">
                      <input
                        type="number"
                        min={1}
                        value={line.producedQty}
                        onChange={(e) => updateToolLine(index, "producedQty", Math.max(1, Number(e.target.value) || 1))}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-1 py-2 text-right align-top">
                      <button
                        type="button"
                        onClick={() => removeToolLine(index)}
                        disabled={toolLines.length === 1}
                        className="rounded-lg border border-red-600 bg-white px-2.5 py-1.5 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Устгах
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-default disabled:opacity-60"
          >
            {loading ? "Үүсгэж байна..." : "Цикл үүсгэх"}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type AutoclaveMachine = {
  id: number;
  branchId: number;
  machineNumber: string;
  name: string | null;
  branch?: Branch;
  createdAt?: string;
  updatedAt?: string;
};

export default function AutoclaveMachinesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [machines, setMachines] = useState<AutoclaveMachine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [machineNumber, setMachineNumber] = useState("");
  const [machineName, setMachineName] = useState("");

  // Inline edit state
  const [editingMachineId, setEditingMachineId] = useState<number | null>(null);
  const [editMachineNumber, setEditMachineNumber] = useState("");
  const [editMachineName, setEditMachineName] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const machineUrl = selectedBranchId 
        ? `/api/sterilization/machines?branchId=${selectedBranchId}`
        : `/api/sterilization/machines`;
      
      const [branchRes, machineRes] = await Promise.all([
        fetch("/api/branches"),
        fetch(machineUrl),
      ]);

      const br = await branchRes.json().catch(() => []);
      const mach = await machineRes.json().catch(() => []);

      if (branchRes.ok) setBranches(Array.isArray(br) ? br : []);
      if (!machineRes.ok) throw new Error(mach?.error || "Failed to load machines");

      setMachines(Array.isArray(mach) ? mach : []);
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [selectedBranchId]);

  const createMachine = async () => {
    const num = machineNumber.trim();
    if (!selectedBranchId) {
      setError("Салбар сонгоно уу");
      return;
    }
    if (!num) {
      setError("Машины дугаар оруулна уу");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/sterilization/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: Number(selectedBranchId),
          machineNumber: num,
          name: machineName.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create machine");

      setSuccessMsg(`Машин үүслээ: ${num}`);
      setMachineNumber("");
      setMachineName("");
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (machine: AutoclaveMachine) => {
    setEditingMachineId(machine.id);
    setEditMachineNumber(machine.machineNumber);
    setEditMachineName(machine.name || "");
  };

  const cancelEdit = () => {
    setEditingMachineId(null);
    setEditMachineNumber("");
    setEditMachineName("");
  };

  const saveEdit = async (id: number) => {
    const num = editMachineNumber.trim();
    if (!num) {
      setError("Машины дугаар хоосон байж болохгүй");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/sterilization/machines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineNumber: num,
          name: editMachineName.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update machine");

      setSuccessMsg("Машин шинэчлэгдлээ");
      cancelEdit();
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const deleteMachine = async (id: number, num: string) => {
    if (!confirm(`Машин "${num}"-г устгах уу?`)) return;

    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/sterilization/machines/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to delete machine");
      }

      setSuccessMsg("Машин устгагдлаа");
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <h1 className="mb-2 text-2xl font-bold">Автоклав машины тохиргоо</h1>
      <p className="mb-4 text-sm text-gray-500">Салбар бүрд харгалзах автоклав машинуудыг бүртгэж удирдана.</p>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-3 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}

      {/* Branch selector */}
      <div className="mb-5">
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">Салбар</label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
          className="w-full max-w-[300px] rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
        >
          <option value="">Бүгд</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Create machine form */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 text-base font-semibold">Шинэ машин нэмэх</div>
        <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-[200px_1fr_140px]">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Машины дугаар *</label>
            <input
              value={machineNumber}
              onChange={(e) => setMachineNumber(e.target.value)}
              placeholder="Ж: A-1"
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Нэр (заавал биш)</label>
            <input
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              placeholder="Ж: Autoclave 1"
              className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={createMachine}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "..." : "Нэмэх"}
          </button>
        </div>
      </div>

      {/* Machines list */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3 text-base font-semibold">
          Машинуудын жагсаалт ({machines.length})
        </div>
        
        {machines.length === 0 ? (
          <div className="p-5 text-center text-sm text-gray-500">
            {loading ? "Ачаалж байна..." : "Машин олдсонгүй"}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 font-semibold">Салбар</th>
                <th className="px-4 py-2.5 font-semibold">Машины дугаар</th>
                <th className="px-4 py-2.5 font-semibold">Нэр</th>
                <th className="w-[200px] px-4 py-2.5 font-semibold">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((machine) => {
                const isEditing = editingMachineId === machine.id;
                return (
                  <tr key={machine.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      {machine.branch?.name || `Branch #${machine.branchId}`}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input
                          value={editMachineNumber}
                          onChange={(e) => setEditMachineNumber(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                        />
                      ) : (
                        <span className="font-semibold">{machine.machineNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input
                          value={editMachineName}
                          onChange={(e) => setEditMachineName(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                        />
                      ) : (
                        <span className="text-gray-500">{machine.name || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(machine.id)}
                            className="rounded-md bg-green-600 px-3 py-1.5 text-xs text-white"
                          >
                            Хадгалах
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-md bg-gray-500 px-3 py-1.5 text-xs text-white"
                          >
                            Болих
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(machine)}
                            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs text-white"
                          >
                            Засах
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMachine(machine.id, machine.machineNumber)}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs text-white"
                          >
                            Устгах
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

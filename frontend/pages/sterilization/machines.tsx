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
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8, fontWeight: 700 }}>
        Автоклав машины тохиргоо
      </h1>
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
        Салбар бүрд харгалзах автоклав машинуудыг бүртгэж удирдана.
      </div>

      {error && (
        <div
          style={{
            background: "#fee",
            color: "#b91c1c",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
      {successMsg && (
        <div
          style={{
            background: "#d1fae5",
            color: "#065f46",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Branch selector */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Салбар
        </label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
          style={{
            width: 300,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 14,
          }}
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
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Шинэ машин нэмэх
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 140px", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              Машины дугаар *
            </label>
            <input
              value={machineNumber}
              onChange={(e) => setMachineNumber(e.target.value)}
              placeholder="Ж: A-1"
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 14,
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              Нэр (заавал биш)
            </label>
            <input
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              placeholder="Ж: Autoclave 1"
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 14,
              }}
            />
          </div>
          <button
            type="button"
            onClick={createMachine}
            disabled={loading}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : "Нэмэх"}
          </button>
        </div>
      </div>

      {/* Machines list */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e5e7eb",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Машинуудын жагсаалт ({machines.length})
        </div>
        
        {machines.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
            {loading ? "Ачаалж байна..." : "Машин олдсонгүй"}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Салбар</th>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Машины дугаар</th>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Нэр</th>
                <th style={{ padding: "10px 16px", fontWeight: 600, width: 200 }}>Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((machine) => {
                const isEditing = editingMachineId === machine.id;
                return (
                  <tr key={machine.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 16px" }}>
                      {machine.branch?.name || `Branch #${machine.branchId}`}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {isEditing ? (
                        <input
                          value={editMachineNumber}
                          onChange={(e) => setEditMachineNumber(e.target.value)}
                          style={{
                            width: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 13,
                          }}
                        />
                      ) : (
                        <span style={{ fontWeight: 600 }}>{machine.machineNumber}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {isEditing ? (
                        <input
                          value={editMachineName}
                          onChange={(e) => setEditMachineName(e.target.value)}
                          style={{
                            width: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 13,
                          }}
                        />
                      ) : (
                        <span style={{ color: "#6b7280" }}>{machine.name || "—"}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => saveEdit(machine.id)}
                            style={{
                              background: "#16a34a",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Хадгалах
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            style={{
                              background: "#6b7280",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Болих
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => startEdit(machine)}
                            style={{
                              background: "#f59e0b",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Засах
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMachine(machine.id, machine.machineNumber)}
                            style={{
                              background: "#dc2626",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
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

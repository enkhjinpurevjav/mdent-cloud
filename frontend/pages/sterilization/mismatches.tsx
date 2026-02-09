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
    patientId: number;
    branchId: number;
    startTime: string;
    patient?: {
      id: number;
      firstName: string;
      lastName: string;
    };
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
  }, [selectedStatus]);

  const groupedMismatches: MismatchGroup[] = React.useMemo(() => {
    const groups: Record<number, MismatchGroup> = {};

    for (const mismatch of mismatches) {
      const encId = mismatch.encounterId;
      const branchId = mismatch.encounter?.branchId;

      // Apply branch filter
      if (selectedBranchId && branchId !== selectedBranchId) continue;

      if (!groups[encId]) {
        const patient = mismatch.encounter?.patient;
        const patientName = patient ? `${patient.lastName} ${patient.firstName}` : "Unknown";
        const branchName = branches.find((b) => b.id === branchId)?.name || "—";
        const visitDate = mismatch.encounter?.startTime || "";

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
    try {
      const date = new Date(isoString);
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
      alert("Шийдвэрлэсэн хүний нэрийг оруулна уу.");
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
    <div style={{ maxWidth: 1400 }}>
      <h1 style={{ fontSize: 18, marginBottom: 6 }}>Ариутгал → Зөрүү</h1>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
        Ариутгалын багажийн зөрүүг харах болон шийдвэрлэх.
      </div>

      {error && <div style={{ color: "#b91c1c", marginBottom: 10, fontSize: 13 }}>{error}</div>}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
          style={{ flex: "0 1 220px", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
        >
          <option value="">Бүх салбар</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as "UNRESOLVED" | "RESOLVED" | "")}
          style={{ flex: "0 1 180px", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
        >
          <option value="">Бүх төлөв</option>
          <option value="UNRESOLVED">⚠ Шийдвэрлээгүй</option>
          <option value="RESOLVED">✓ Шийдвэрлэсэн</option>
        </select>

        <button
          type="button"
          onClick={() => void loadMismatches()}
          disabled={loading}
          style={{
            border: "1px solid #d1d5db",
            background: "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: loading ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          {loading ? "Ачаалж байна..." : "Шинэчлэх"}
        </button>
      </div>

      {/* Grouped Mismatches */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading && (
          <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            Ачаалж байна...
          </div>
        )}

        {!loading && groupedMismatches.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            Зөрүү олдсонгүй.
          </div>
        )}

        {!loading && groupedMismatches.map((group) => (
          <div
            key={group.encounterId}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  {group.patient}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Салбар: {group.branch} • Үзлэгийн огноо: {formatDateTime(group.visitDate)}
                </div>
              </div>

              {selectedStatus === "UNRESOLVED" && (
                <button
                  type="button"
                  onClick={() => openResolveModal(group.encounterId)}
                  style={{
                    border: "none",
                    background: "#16a34a",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Шийдвэрлэх
                </button>
              )}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", textAlign: "left" }}>
                  <th style={{ padding: "8px 4px" }}>Багаж</th>
                  <th style={{ padding: "8px 4px" }}>Код</th>
                  <th style={{ padding: "8px 4px", width: 100 }}>Хэрэгтэй</th>
                  <th style={{ padding: "8px 4px", width: 100 }}>Ашигласан</th>
                  <th style={{ padding: "8px 4px", width: 100 }}>Зөрүү</th>
                </tr>
              </thead>
              <tbody>
                {group.mismatches.map((mismatch) => (
                  <tr key={mismatch.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 4px" }}>{mismatch.tool?.name || "—"}</td>
                    <td style={{ padding: "8px 4px" }}>{mismatch.cycle?.code || "—"}</td>
                    <td style={{ padding: "8px 4px" }}>{mismatch.requiredQty}</td>
                    <td style={{ padding: "8px 4px" }}>{mismatch.finalizedQty}</td>
                    <td style={{ padding: "8px 4px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500,
                          background: mismatch.mismatchQty > 0 ? "#fee2e2" : "#d1fae5",
                          color: mismatch.mismatchQty > 0 ? "#991b1b" : "#065f46",
                        }}
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
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeResolveModal}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: "90%",
              maxWidth: 500,
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              Зөрүү шийдвэрлэх
            </h2>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, display: "block" }}>
                Шийдвэрлэсэн хүний нэр <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                value={resolverName}
                onChange={(e) => setResolverName(e.target.value)}
                placeholder="Нэр оруулах"
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, display: "block" }}>
                Тэмдэглэл
              </label>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Нэмэлт мэдээлэл..."
                rows={3}
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={closeResolveModal}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Болих
              </button>
              <button
                type="button"
                onClick={submitResolve}
                disabled={loading}
                style={{
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: loading ? "default" : "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
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

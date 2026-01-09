import React, { useEffect, useMemo, useState } from "react";

type DoctorRow = {
  doctorId: number;
  ovog?: string | null;
  name?: string | null;
  email: string;

  orthoPct: number;
  defectPct: number;
  surgeryPct: number;
  generalPct: number;

  configCreatedAt?: string | null;
  configUpdatedAt?: string | null;
};

function formatDateOnly(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDoctorName(d: { ovog?: string | null; name?: string | null; email: string }) {
  const ovog = (d.ovog || "").trim();
  const name = (d.name || "").trim();
  if (!ovog && !name) return d.email;
  if (!ovog) return name;
  const initial = ovog.charAt(0);
  return `${initial}. ${name || d.email}`;
}

function toNumberOrNaN(v: string) {
  if (v == null) return NaN;
  const s = String(v).trim();
  if (!s) return 0;
  // allow decimals
  const n = Number(s);
  return n;
}

function clampNonNegative(n: number) {
  if (Number.isNaN(n)) return NaN;
  return n < 0 ? NaN : n;
}

type DoctorDraft = {
  orthoPct: string;
  defectPct: string;
  surgeryPct: string;
  generalPct: string;
};

export default function StaffIncomeSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingDoctorId, setSavingDoctorId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Global whitening setting (separate edit/save)
  const [whiteningValue, setWhiteningValue] = useState<string>("0"); // saved value
  const [whiteningDraft, setWhiteningDraft] = useState<string>("0"); // editing buffer
  const [whiteningEditing, setWhiteningEditing] = useState(false);

  // Doctors list
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);

  // Row-level editing
  const [editDoctorId, setEditDoctorId] = useState<number | null>(null);
  const [doctorDraftById, setDoctorDraftById] = useState<Record<number, DoctorDraft>>({});

  const canEditDoctor = (doctorId: number) => editDoctorId === doctorId;
  const currentDoctorDraft = (doctorId: number) => doctorDraftById[doctorId];

  const clearMessagesSoon = () => {
    setTimeout(() => {
      setSuccess("");
      setError("");
    }, 3500);
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/staff-income-settings");
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        throw new Error((data && data.error) || "Failed to load staff income settings");
      }

      const wd = data.whiteningDeductAmountMnt ?? 0;

      setWhiteningValue(String(wd));
      setWhiteningDraft(String(wd));
      setWhiteningEditing(false);

      const list: DoctorRow[] = Array.isArray(data.doctors) ? data.doctors : [];
      setDoctors(list);

      setEditDoctorId(null);
      setDoctorDraftById({});
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load staff income settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doctorRowsSorted = useMemo(() => {
    const copy = doctors.slice();
    copy.sort((a, b) => {
      const an = formatDoctorName({ ovog: a.ovog, name: a.name, email: a.email });
      const bn = formatDoctorName({ ovog: b.ovog, name: b.name, email: b.email });
      return an.localeCompare(bn, "mn");
    });
    return copy;
  }, [doctors]);

  // ---------- Global save ----------
  const handleGlobalEdit = () => {
    setError("");
    setSuccess("");
    setWhiteningDraft(whiteningValue);
    setWhiteningEditing(true);
  };

  const handleGlobalCancel = () => {
    setError("");
    setSuccess("");
    setWhiteningDraft(whiteningValue);
    setWhiteningEditing(false);
  };

  const handleGlobalSave = async () => {
    setError("");
    setSuccess("");

    const n = clampNonNegative(toNumberOrNaN(whiteningDraft));
    if (Number.isNaN(n)) {
      setError("Home bleaching материалын хасалт нь 0 эсвэл түүнээс их тоо байна.");
      return;
    }

    try {
      setSavingGlobal(true);

      const res = await fetch("/api/admin/staff-income-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whiteningDeductAmountMnt: n,
          // doctors omitted or empty -> backend should support partial update
          doctors: [],
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error((data && data.error) || "Failed to save global setting");
      }

      setWhiteningValue(String(n));
      setWhiteningDraft(String(n));
      setWhiteningEditing(false);

      setSuccess("Нийтлэг тохиргоог хадгаллаа.");
      clearMessagesSoon();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Нийтлэг тохиргоо хадгалахад алдаа гарлаа.");
    } finally {
      setSavingGlobal(false);
    }
  };

  // ---------- Doctor row edit/save/cancel ----------
  const startEditDoctor = (d: DoctorRow) => {
    setError("");
    setSuccess("");

    setEditDoctorId(d.doctorId);
    setDoctorDraftById((prev) => ({
      ...prev,
      [d.doctorId]: {
        orthoPct: String(d.orthoPct ?? 0),
        defectPct: String(d.defectPct ?? 0),
        surgeryPct: String(d.surgeryPct ?? 0),
        generalPct: String(d.generalPct ?? 0),
      },
    }));
  };

  const cancelEditDoctor = (doctorId: number) => {
    setError("");
    setSuccess("");

    setEditDoctorId(null);
    setDoctorDraftById((prev) => {
      const copy = { ...prev };
      delete copy[doctorId];
      return copy;
    });
  };

  const handleDoctorDraftChange = (
    doctorId: number,
    field: keyof DoctorDraft,
    value: string
  ) => {
    setDoctorDraftById((prev) => ({
      ...prev,
      [doctorId]: {
        ...(prev[doctorId] || {
          orthoPct: "0",
          defectPct: "0",
          surgeryPct: "0",
          generalPct: "0",
        }),
        [field]: value,
      },
    }));
  };

  const saveDoctorRow = async (doctorId: number) => {
    setError("");
    setSuccess("");

    const draft = currentDoctorDraft(doctorId);
    if (!draft) {
      setError("Хадгалах өгөгдөл олдсонгүй.");
      return;
    }

    const ortho = clampNonNegative(toNumberOrNaN(draft.orthoPct));
    const defect = clampNonNegative(toNumberOrNaN(draft.defectPct));
    const surgery = clampNonNegative(toNumberOrNaN(draft.surgeryPct));
    const general = clampNonNegative(toNumberOrNaN(draft.generalPct));

    if ([ortho, defect, surgery, general].some((x) => Number.isNaN(x))) {
      setError("Хувь нь 0 эсвэл түүнээс их тоо байна (бутархай зөвшөөрнө).");
      return;
    }

    try {
      setSavingDoctorId(doctorId);

      const res = await fetch("/api/admin/staff-income-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // keep whitening unchanged (backend ideally supports partial updates anyway)
          whiteningDeductAmountMnt: Number(whiteningValue || 0),
          doctors: [
            {
              doctorId,
              orthoPct: ortho,
              defectPct: defect,
              surgeryPct: surgery,
              generalPct: general,
            },
          ],
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error((data && data.error) || "Failed to save doctor config");
      }

      // Update local row values
      setDoctors((prev) =>
        prev.map((d) =>
          d.doctorId === doctorId
            ? { ...d, orthoPct: ortho, defectPct: defect, surgeryPct: surgery, generalPct: general }
            : d
        )
      );

      // Best effort: refresh to get updatedAt/createdAt from backend
      await loadData();

      setEditDoctorId(null);

      setSuccess("Эмчийн тохиргоог хадгаллаа.");
      clearMessagesSoon();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Эмчийн тохиргоо хадгалахад алдаа гарлаа.");
    } finally {
      setSavingDoctorId(null);
    }
  };

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 14 }}>Ажилчдын хувийн тохиргоо</h1>

      {loading ? (
        <div style={{ fontSize: 14, color: "#6b7280" }}>Ачаалж байна...</div>
      ) : null}

      {error ? (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            color: "#b91c1c",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            color: "#15803d",
            fontSize: 13,
          }}
        >
          {success}
        </div>
      ) : null}

      {/* Global settings */}
      <section
        style={{
          marginBottom: 16,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Нийтлэг тохиргоо</div>

            <label style={{ display: "block", fontSize: 13, color: "#374151", marginBottom: 6 }}>
              Home bleaching (код 151) материалын хасалт (₮)
            </label>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number"
                min={0}
                step="1"
                value={whiteningDraft}
                disabled={!whiteningEditing}
                onChange={(e) => setWhiteningDraft(e.target.value)}
                style={{
                  width: 260,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  padding: "8px 10px",
                  fontSize: 14,
                  background: whiteningEditing ? "#ffffff" : "#f9fafb",
                }}
              />

              {!whiteningEditing ? (
                <button
                  type="button"
                  onClick={handleGlobalEdit}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Засах
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleGlobalSave}
                    disabled={savingGlobal}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #16a34a",
                      background: "#f0fdf4",
                      color: "#15803d",
                      cursor: savingGlobal ? "not-allowed" : "pointer",
                      fontSize: 13,
                    }}
                  >
                    {savingGlobal ? "Хадгалж байна..." : "Хадгалах"}
                  </button>

                  <button
                    type="button"
                    onClick={handleGlobalCancel}
                    disabled={savingGlobal}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#ffffff",
                      cursor: savingGlobal ? "not-allowed" : "pointer",
                      fontSize: 13,
                    }}
                  >
                    Болих
                  </button>
                </>
              )}
            </div>

            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                fontSize: 13,
                color: "#374151",
              }}
            >
              Зураг (IMAGING): Эмч 5% (fixed)
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #2563eb",
              background: "#eff6ff",
              color: "#2563eb",
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            Дахин ачаалах
          </button>
        </div>
      </section>

      {/* Doctors table */}
      <section
        style={{
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Эмчийн урамшууллын хувь</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 220px 140px 120px 120px 140px 110px 110px 160px",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            fontSize: 12,
            color: "#6b7280",
            fontWeight: 600,
          }}
        >
          <div>Эмч</div>
          <div>И-мэйл</div>
          <div style={{ textAlign: "center" }}>Гажиг (%)</div>
          <div style={{ textAlign: "center" }}>Согог (%)</div>
          <div style={{ textAlign: "center" }}>Мэс (%)</div>
          <div style={{ textAlign: "center" }}>Бусад (%)</div>
          <div style={{ textAlign: "center" }}>Үүсгэсэн</div>
          <div style={{ textAlign: "center" }}>Шинэчилсэн</div>
          <div style={{ textAlign: "right" }} />
        </div>

        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {doctorRowsSorted.map((d) => {
            const editing = canEditDoctor(d.doctorId);
            const draft = currentDoctorDraft(d.doctorId);

            const inputStyle: React.CSSProperties = {
              width: "100%",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              padding: "6px 8px",
              fontSize: 13,
              textAlign: "right",
              background: editing ? "#ffffff" : "#f9fafb",
            };

            return (
              <div
                key={d.doctorId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 220px 140px 120px 120px 140px 110px 110px 160px",
                  gap: 8,
                  padding: "10px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  {formatDoctorName({ ovog: d.ovog, name: d.name, email: d.email })}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.email}
                </div>

                <input
                  type="number"
                  step="0.1"
                  min={0}
                  disabled={!editing}
                  value={editing ? draft?.orthoPct ?? "" : String(d.orthoPct ?? 0)}
                  onChange={(e) => handleDoctorDraftChange(d.doctorId, "orthoPct", e.target.value)}
                  style={inputStyle}
                />

                <input
                  type="number"
                  step="0.1"
                  min={0}
                  disabled={!editing}
                  value={editing ? draft?.defectPct ?? "" : String(d.defectPct ?? 0)}
                  onChange={(e) => handleDoctorDraftChange(d.doctorId, "defectPct", e.target.value)}
                  style={inputStyle}
                />

                <input
                  type="number"
                  step="0.1"
                  min={0}
                  disabled={!editing}
                  value={editing ? draft?.surgeryPct ?? "" : String(d.surgeryPct ?? 0)}
                  onChange={(e) => handleDoctorDraftChange(d.doctorId, "surgeryPct", e.target.value)}
                  style={inputStyle}
                />

                <input
                  type="number"
                  step="0.1"
                  min={0}
                  disabled={!editing}
                  value={editing ? draft?.generalPct ?? "" : String(d.generalPct ?? 0)}
                  onChange={(e) => handleDoctorDraftChange(d.doctorId, "generalPct", e.target.value)}
                  style={inputStyle}
                />

                <div style={{ fontSize: 12, color: "#374151", textAlign: "center" }}>
                  {formatDateOnly(d.configCreatedAt)}
                </div>
                <div style={{ fontSize: 12, color: "#374151", textAlign: "center" }}>
                  {formatDateOnly(d.configUpdatedAt)}
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  {!editing ? (
                    <button
                      type="button"
                      onClick={() => startEditDoctor(d)}
                      disabled={editDoctorId != null && editDoctorId !== d.doctorId}
                      style={{
                        padding: "7px 10px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Засах
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void saveDoctorRow(d.doctorId)}
                        disabled={savingDoctorId === d.doctorId}
                        style={{
                          padding: "7px 10px",
                          borderRadius: 8,
                          border: "1px solid #16a34a",
                          background: "#f0fdf4",
                          color: "#15803d",
                          cursor: savingDoctorId === d.doctorId ? "not-allowed" : "pointer",
                          fontSize: 12,
                        }}
                      >
                        {savingDoctorId === d.doctorId ? "Хадгалж байна..." : "Хадгалах"}
                      </button>

                      <button
                        type="button"
                        onClick={() => cancelEditDoctor(d.doctorId)}
                        disabled={savingDoctorId === d.doctorId}
                        style={{
                          padding: "7px 10px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          background: "#ffffff",
                          cursor: savingDoctorId === d.doctorId ? "not-allowed" : "pointer",
                          fontSize: 12,
                        }}
                      >
                        Болих
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {doctorRowsSorted.length === 0 ? (
            <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>
              Эмчийн жагсаалт олдсонгүй.
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
          Тайлбар: Хувь нь 0 эсвэл түүнээс их тоо байна. Бутархай (ж. 15.5) зөвшөөрнө.
        </div>
      </section>
    </main>
  );
}

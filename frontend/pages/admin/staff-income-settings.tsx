import React, { useEffect, useMemo, useState } from "react";

type DoctorRow = {
  doctorId: number;
  ovog?: string | null;
  name?: string | null;
  email?: string | null;

  orthoPct: number;
  defectPct: number;
  surgeryPct: number;
  generalPct: number;

  monthlyGoalAmountMnt?: number;

  configUpdatedAt?: string | null;
};

type DoctorDraft = {
  orthoPct: string;
  defectPct: string;
  surgeryPct: string;
  generalPct: string;
  monthlyGoalAmountMnt: string;
};

function formatDateOnly(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDoctorName(d: { ovog?: string | null; name?: string | null; email?: string | null }) {
  const ovog = (d.ovog || "").trim();
  const name = (d.name || "").trim();
  if (!ovog && !name) return (d.email || "").trim() || "-";
  if (!ovog) return name;
  const initial = ovog.charAt(0);
  return `${initial}. ${name || (d.email || "-")}`;
}

function toNumberOrNaN(v: string) {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  return Number(s);
}

function nonNegativeOrNaN(n: number) {
  if (Number.isNaN(n)) return NaN;
  if (n < 0) return NaN;
  return n;
}

function formatMnt(n?: number | null) {
  const v = Number(n ?? 0);
  if (Number.isNaN(v)) return "0";
  return v.toLocaleString("mn-MN");
}

export default function StaffIncomeSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingDoctorId, setSavingDoctorId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Global whitening setting
  const [whiteningValue, setWhiteningValue] = useState<string>("0"); // saved
  const [whiteningDraft, setWhiteningDraft] = useState<string>("0"); // editing
  const [whiteningEditing, setWhiteningEditing] = useState(false);

  // Doctors + row editing
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [editDoctorId, setEditDoctorId] = useState<number | null>(null);
  const [doctorDraftById, setDoctorDraftById] = useState<Record<number, DoctorDraft>>({});

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
      const an = formatDoctorName(a);
      const bn = formatDoctorName(b);
      return an.localeCompare(bn, "mn");
    });
    return copy;
  }, [doctors]);

  // ----- Global edit/save/cancel -----
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

    const n = nonNegativeOrNaN(toNumberOrNaN(whiteningDraft));
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
          doctors: [],
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Failed to save global setting");

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

  // ----- Doctor row edit/save/cancel -----
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
        monthlyGoalAmountMnt: String(d.monthlyGoalAmountMnt ?? 0),
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
          monthlyGoalAmountMnt: "0",
        }),
        [field]: value,
      },
    }));
  };

  const saveDoctorRow = async (doctorId: number) => {
    setError("");
    setSuccess("");

    const draft = doctorDraftById[doctorId];
    if (!draft) {
      setError("Хадгалах өгөгдөл олдсонгүй.");
      return;
    }

    const ortho = nonNegativeOrNaN(toNumberOrNaN(draft.orthoPct));
    const defect = nonNegativeOrNaN(toNumberOrNaN(draft.defectPct));
    const surgery = nonNegativeOrNaN(toNumberOrNaN(draft.surgeryPct));
    const general = nonNegativeOrNaN(toNumberOrNaN(draft.generalPct));
    const goal = nonNegativeOrNaN(toNumberOrNaN(draft.monthlyGoalAmountMnt));

    if ([ortho, defect, surgery, general, goal].some((x) => Number.isNaN(x))) {
      setError("Утга нь 0 эсвэл түүнээс их тоо байна. Хувьд бутархай зөвшөөрнө.");
      return;
    }

    try {
      setSavingDoctorId(doctorId);

      const res = await fetch("/api/admin/staff-income-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whiteningDeductAmountMnt: Number(whiteningValue || 0),
          doctors: [
            {
              doctorId,
              orthoPct: ortho,
              defectPct: defect,
              surgeryPct: surgery,
              generalPct: general,
              monthlyGoalAmountMnt: goal,
            },
          ],
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Failed to save doctor config");

      setDoctors((prev) =>
        prev.map((d) =>
          d.doctorId === doctorId
            ? {
                ...d,
                orthoPct: ortho,
                defectPct: defect,
                surgeryPct: surgery,
                generalPct: general,
                monthlyGoalAmountMnt: goal,
              }
            : d
        )
      );

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

  const anyRowEditing = editDoctorId !== null;

  // Fix for overlap + buttons position:
  // - make Goal column a bit wider
  // - make % columns fixed width but NOT too small
  // - keep actions on far right (last column is 200px)
  const headerAndRowColumns = "200px 180px 90px 90px 90px 90px 110px 200px";

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "32px auto",
        padding: "0 18px 50px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 14px" }}>
        Ажилчдын хувийн тохиргоо
      </h1>

      {loading ? (
        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 10 }}>Ачаалж байна...</div>
      ) : null}

      {error ? (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 10,
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
            borderRadius: 10,
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
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#fff",
          boxShadow: "0 1px 0 rgba(17,24,39,0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 380, flex: 1 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Нийтлэг тохиргоо</div>

            <label style={{ display: "block", fontSize: 13, color: "#374151", marginBottom: 6 }}>
              Home bleaching (код 151) материалын хасалт (₮)
            </label>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="number"
                min={0}
                step="1"
                value={whiteningDraft}
                disabled={!whiteningEditing}
                onChange={(e) => setWhiteningDraft(e.target.value)}
                style={{
                  width: 260,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "9px 11px",
                  fontSize: 14,
                  background: whiteningEditing ? "#ffffff" : "#f9fafb",
                }}
              />

              {!whiteningEditing ? (
                <button
                  type="button"
                  onClick={handleGlobalEdit}
                  disabled={anyRowEditing}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    cursor: anyRowEditing ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: 700,
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
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1px solid #16a34a",
                      background: "#f0fdf4",
                      color: "#15803d",
                      cursor: savingGlobal ? "not-allowed" : "pointer",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {savingGlobal ? "Хадгалж байна..." : "Хадгалах"}
                  </button>

                  <button
                    type="button"
                    onClick={handleGlobalCancel}
                    disabled={savingGlobal}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      background: "#ffffff",
                      cursor: savingGlobal ? "not-allowed" : "pointer",
                      fontSize: 13,
                      fontWeight: 700,
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
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                fontSize: 13,
                color: "#374151",
              }}
            >
              Зураг (IMAGING): Эмч 5% (fixed)
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              style={{
                padding: "9px 12px",
                borderRadius: 10,
                border: "1px solid #2563eb",
                background: "#eff6ff",
                color: "#2563eb",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              Дахин ачаалах
            </button>
          </div>
        </div>
      </section>

      {/* Doctors table */}
      <section
        style={{
          padding: 16,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          boxShadow: "0 1px 0 rgba(17,24,39,0.03)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Эмчийн урамшууллын хувь</div>

        <div style={{ overflowX: "auto" }}>
          {/* minWidth must be >= total columns width, otherwise overlap */}
          <div style={{ minWidth: 1150 }}>
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: headerAndRowColumns,
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                fontSize: 12,
                color: "#6b7280",
                fontWeight: 800,
                alignItems: "center",
              }}
            >
              <div>Эмч</div>
              <div style={{ textAlign: "right" }}>Зорилт (₮)</div>
              <div style={{ textAlign: "right" }}>Гажиг (%)</div>
              <div style={{ textAlign: "right" }}>Согог (%)</div>
              <div style={{ textAlign: "right" }}>Мэс (%)</div>
              <div style={{ textAlign: "right" }}>Бусад (%)</div>
              <div style={{ textAlign: "center" }}>Шинэчилсэн</div>
              <div style={{ textAlign: "right" }} />
            </div>

            {/* Rows */}
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {doctorRowsSorted.map((d) => {
                const editing = editDoctorId === d.doctorId;
                const draft = doctorDraftById[d.doctorId];

                // IMPORTANT: prevent overlap by not using "width: 100%" + maxWidth in a narrow grid column.
                // We set explicit width for each input type.
                const baseInput: React.CSSProperties = {
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  textAlign: "right",
                  background: editing ? "#ffffff" : "#f9fafb",
                  height: 34,
                  padding: "0 10px",
                };

                const goalInputStyle: React.CSSProperties = {
                  ...baseInput,
                  width: "100%", // goal column is wide enough
                };

                const pctInputStyle: React.CSSProperties = {
                  ...baseInput,
                  width: 72, // small and consistent
                  justifySelf: "end",
                  padding: "0 8px",
                };

                const goalValue = editing
                  ? draft?.monthlyGoalAmountMnt ?? ""
                  : String(d.monthlyGoalAmountMnt ?? 0);

                return (
                  <div
                    key={d.doctorId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: headerAndRowColumns,
                      gap: 10,
                      padding: "12px 12px",
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>
                      {formatDoctorName(d)}
                    </div>

                    <input
                      type="number"
                      step="1"
                      min={0}
                      disabled={!editing}
                      value={goalValue}
                      onChange={(e) =>
                        handleDoctorDraftChange(d.doctorId, "monthlyGoalAmountMnt", e.target.value)
                      }
                      style={goalInputStyle}
                      placeholder="0"
                      title={editing ? "" : `${formatMnt(d.monthlyGoalAmountMnt)} ₮ (Сарын зорилт)`}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={!editing}
                      value={editing ? draft?.orthoPct ?? "" : String(d.orthoPct ?? 0)}
                      onChange={(e) => handleDoctorDraftChange(d.doctorId, "orthoPct", e.target.value)}
                      style={pctInputStyle}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={!editing}
                      value={editing ? draft?.defectPct ?? "" : String(d.defectPct ?? 0)}
                      onChange={(e) =>
                        handleDoctorDraftChange(d.doctorId, "defectPct", e.target.value)
                      }
                      style={pctInputStyle}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={!editing}
                      value={editing ? draft?.surgeryPct ?? "" : String(d.surgeryPct ?? 0)}
                      onChange={(e) =>
                        handleDoctorDraftChange(d.doctorId, "surgeryPct", e.target.value)
                      }
                      style={pctInputStyle}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={!editing}
                      value={editing ? draft?.generalPct ?? "" : String(d.generalPct ?? 0)}
                      onChange={(e) =>
                        handleDoctorDraftChange(d.doctorId, "generalPct", e.target.value)
                      }
                      style={pctInputStyle}
                    />

                    <div style={{ fontSize: 12, color: "#374151", textAlign: "center" }}>
                      {formatDateOnly(d.configUpdatedAt)}
                    </div>

                    {/* Actions: keep always on far right */}
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      {!editing ? (
                        <button
                          type="button"
                          onClick={() => startEditDoctor(d)}
                          disabled={editDoctorId !== null && editDoctorId !== d.doctorId}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            cursor:
                              editDoctorId !== null && editDoctorId !== d.doctorId
                                ? "not-allowed"
                                : "pointer",
                            fontSize: 13,
                            fontWeight: 800,
                            minWidth: 88,
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
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #16a34a",
                              background: "#f0fdf4",
                              color: "#15803d",
                              cursor: savingDoctorId === d.doctorId ? "not-allowed" : "pointer",
                              fontSize: 13,
                              fontWeight: 900,
                              minWidth: 96,
                            }}
                          >
                            {savingDoctorId === d.doctorId ? "..." : "Хадгалах"}
                          </button>

                          <button
                            type="button"
                            onClick={() => cancelEditDoctor(d.doctorId)}
                            disabled={savingDoctorId === d.doctorId}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #d1d5db",
                              background: "#ffffff",
                              cursor: savingDoctorId === d.doctorId ? "not-allowed" : "pointer",
                              fontSize: 13,
                              fontWeight: 800,
                              minWidth: 80,
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
          </div>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
          Тайлбар: Хувь нь 0 эсвэл түүнээс их тоо байна. Бутархай (ж. 15.5) зөвшөөрнө.
        </div>
      </section>
    </main>
  );
}

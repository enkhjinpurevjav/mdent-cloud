import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";




type Branch = {
  id: number;
  name: string;
};

type Patient = {
  id: number;
  ovog?: string | null;
  name: string;
  regNo?: string | null;
  phone?: string | null;
  branch?: Branch | null;
};

type PatientBook = {
  id: number;
  bookNumber: string;
  patient: Patient;
};

type Doctor = {
  id: number;
  name?: string | null;
  ovog?: string | null;
  email: string;
};

type Diagnosis = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
};

type DiagnosisProblem = {
  id: number;
  diagnosisId: number;
  label: string;
  order: number;
  active: boolean;
};

type EncounterDiagnosisRow = {
  id: number;
  diagnosisId: number;
  selectedProblemIds: number[] | null;
  note?: string | null;
  diagnosis: Diagnosis;
};

type ServiceCategory =
  | "GENERAL_DENTISTRY"
  | "IMPLANTS"
  | "ORTHODONTICS"
  | "COSMETIC_DENTISTRY"
  | "CHILDRENS";

type ServiceBranch = {
  branchId: number;
  branch: Branch;
};

type Service = {
  id: number;
  code?: string | null;
  category: ServiceCategory;
  name: string;
  price: number;
  isActive: boolean;
  description?: string | null;
  serviceBranches?: ServiceBranch[];
};

type EncounterServiceRow = {
  id?: number;
  serviceId: number;
  service?: Service;
  quantity: number;
  toothCode?: string | null;
};

type Encounter = {
  id: number;
  patientBookId: number;
  doctorId: number;
  visitDate: string;
  notes?: string | null;
  patientBook: PatientBook;
  doctor: Doctor | null;
  encounterDiagnoses: EncounterDiagnosisRow[];
  encounterServices?: EncounterServiceRow[];
};

type EditableDiagnosis = {
  diagnosisId: number;
  diagnosis?: Diagnosis;
  selectedProblemIds: number[];
  note: string;
};

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("mn-MN");
  } catch {
    return iso;
  }
}

function formatPatientName(p: Patient) {
  const ovog = p.ovog ? p.ovog.trim() : "";
  const name = p.name ? p.name.toString().trim() : "";
  if (!ovog) return name || p.regNo || String(p.id);
  const initial = ovog.charAt(0);
  return `${initial}. ${name}`;
}

function formatDoctorName(d: Doctor | null) {
  if (!d) return "-";
  if (d.name && d.name.trim()) return d.name;
  return d.email;
}

export default function EncounterAdminPage() {
  const router = useRouter();
  const { id } = router.query;
  const encounterId = useMemo(
    () => (typeof id === "string" ? Number(id) : NaN),
    [id]
  );

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [encounterLoading, setEncounterLoading] = useState(false);
  const [encounterError, setEncounterError] = useState("");
const [allServices, setAllServices] = useState<Service[]>([]);
const [services, setServices] = useState<EncounterServiceRow[]>([]);
const [servicesError, setServicesError] = useState("");
const [servicesSaving, setServicesSaving] = useState(false);
  const [allDiagnoses, setAllDiagnoses] = useState<Diagnosis[]>([]);
  const [dxLoading, setDxLoading] = useState(false);
  const [dxError, setDxError] = useState("");

  const [problemsByDiagnosis, setProblemsByDiagnosis] = useState<
    Record<number, DiagnosisProblem[]>
  >({});

  const [rows, setRows] = useState<EditableDiagnosis[]>([]);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);


  useEffect(() => {
  const loadServices = async () => {
    try {
      // You can filter by branchId if needed: /api/services?onlyActive=true&branchId=...
      const res = await fetch("/api/services?onlyActive=true");
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        throw new Error(data?.error || "Алдаа гарлаа");
      }
      setAllServices(data);
    } catch (err: any) {
      console.error("Failed to load services:", err);
      setServicesError(err.message || "Үйлчилгээ ачаалахад алдаа гарлаа.");
    }
  };
  loadServices();
}, []);

  
  // Load encounter
  useEffect(() => {
    if (!encounterId || Number.isNaN(encounterId)) return;

    const load = async () => {
      setEncounterLoading(true);
      setEncounterError("");
      try {
        const res = await fetch(`/api/encounters/${encounterId}`);
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || !data || !data.id) {
          throw new Error((data && data.error) || "Алдаа гарлаа");
        }

        setEncounter(data);
        // Initialize editable rows from server data
        const initialRows: EditableDiagnosis[] =
          Array.isArray(data.encounterDiagnoses) &&
          data.encounterDiagnoses.length > 0
            ? data.encounterDiagnoses.map((r: EncounterDiagnosisRow) => ({
                diagnosisId: r.diagnosisId,
                diagnosis: r.diagnosis,
                selectedProblemIds: Array.isArray(r.selectedProblemIds)
                  ? (r.selectedProblemIds as number[])
                  : [],
                note: r.note || "",
              }))
            : [];
        setRows(initialRows);
      } catch (err: any) {
        console.error("Failed to load encounter:", err);
        setEncounterError(err.message || "Алдаа гарлаа");
        setEncounter(null);
      } finally {
        setEncounterLoading(false);
      }
    };

    load();
  }, [encounterId]);

  // Load all diagnoses (for dropdown)
  useEffect(() => {
    const loadDx = async () => {
      setDxLoading(true);
      setDxError("");
      try {
        const res = await fetch("/api/diagnoses");
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        if (!res.ok || !Array.isArray(data)) {
          throw new Error((data && data.error) || "Алдаа гарлаа");
        }
        setAllDiagnoses(data);
      } catch (err: any) {
        console.error("Failed to load diagnoses:", err);
        setDxError(err.message || "Алдаа гарлаа");
        setAllDiagnoses([]);
      } finally {
        setDxLoading(false);
      }
    };

    loadDx();
  }, []);
const initialServices: EncounterServiceRow[] =
  Array.isArray(data.encounterServices) && data.encounterServices.length > 0
    ? data.encounterServices.map((s: any) => ({
        id: s.id,
        serviceId: s.serviceId,
        service: s.service,
        quantity: s.quantity ?? 1,
        toothCode: s.toothCode ?? null,
      }))
    : [];
setServices(initialServices);
  // Helper: load problems for a diagnosis once and cache
  const ensureProblemsLoaded = async (diagnosisId: number) => {
    if (problemsByDiagnosis[diagnosisId]) return;
    try {
      const res = await fetch(`/api/diagnoses/${diagnosisId}/problems`);
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || !Array.isArray(data)) {
        throw new Error((data && data.error) || "Алдаа гарлаа");
      }
      setProblemsByDiagnosis((prev) => ({
        ...prev,
        [diagnosisId]: data,
      }));
    } catch (err) {
      console.error("Failed to load problems:", err);
      // Silent; page still usable, just no checklist
    }
  };

  // Add a new empty diagnosis row
  const addDiagnosisRow = () => {
    setRows((prev) => [
      ...prev,
      {
        diagnosisId: 0,
        diagnosis: undefined,
        selectedProblemIds: [],
        note: "",
      },
    ]);
  };

  const removeDiagnosisRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDiagnosisChange = async (index: number, diagnosisId: number) => {
    const dx = allDiagnoses.find((d) => d.id === diagnosisId);
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              diagnosisId,
              diagnosis: dx,
              selectedProblemIds: [],
              note: row.note,
            }
          : row
      )
    );
    if (diagnosisId) {
      await ensureProblemsLoaded(diagnosisId);
    }
  };

  const toggleProblem = (index: number, problemId: number) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const exists = row.selectedProblemIds.includes(problemId);
        return {
          ...row,
          selectedProblemIds: exists
            ? row.selectedProblemIds.filter((id) => id !== problemId)
            : [...row.selectedProblemIds, problemId],
        };
      })
    );
  };

  const handleNoteChange = (index: number, value: string) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, note: value } : row
      )
    );
  };

  const handleSave = async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setSaveError("");
    setSaving(true);
    try {
      const payload = {
        items: rows
          .filter((r) => r.diagnosisId)
          .map((r) => ({
            diagnosisId: r.diagnosisId,
            selectedProblemIds: r.selectedProblemIds,
            note: r.note || null,
          })),
      };
const addServiceRow = () => {
  setServices((prev) => [
    ...prev,
    { serviceId: 0, service: undefined, quantity: 1, toothCode: "" },
  ]);
};

const removeServiceRow = (index: number) => {
  setServices((prev) => prev.filter((_, i) => i !== index));
};

const handleServiceChange = (
  index: number,
  field: "serviceId" | "quantity" | "toothCode",
  value: any
) => {
  setServices((prev) =>
    prev.map((row, i) => {
      if (i !== index) return row;
      if (field === "serviceId") {
        const sid = Number(value) || 0;
        const svc = allServices.find((s) => s.id === sid);
        return { ...row, serviceId: sid, service: svc || undefined };
      }
      if (field === "quantity") {
        const q = Number(value) || 1;
        return { ...row, quantity: q };
      }
      return { ...row, toothCode: value };
    })
  );
};

const totalServicePrice = services.reduce((sum, s) => {
  const svc = s.service || allServices.find((x) => x.id === s.serviceId);
  const price = svc?.price ?? 0;
  return sum + price * (s.quantity || 1);
}, 0);

const handleSaveServices = async () => {
  if (!encounterId || Number.isNaN(encounterId)) return;
  setServicesError("");
  setServicesSaving(true);
  try {
    const payload = {
      items: services
        .filter((s) => s.serviceId)
        .map((s) => ({
          serviceId: s.serviceId,
          quantity: s.quantity || 1,
          toothCode: s.toothCode || null,
        })),
    };

    const res = await fetch(`/api/encounters/${encounterId}/services`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || "Үйлчилгээ хадгалахад алдаа гарлаа.");
    }

    if (Array.isArray(data)) {
      setServices(
        data.map((s: any) => ({
          id: s.id,
          serviceId: s.serviceId,
          service: s.service,
          quantity: s.quantity ?? 1,
          toothCode: s.toothCode ?? null,
        }))
      );
    }
  } catch (err: any) {
    console.error("Failed to save services:", err);
    setServicesError(err.message || "Үйлчилгээ хадгалахад алдаа гарлаа.");
  } finally {
    setServicesSaving(false);
  }
};
      const res = await fetch(`/api/encounters/${encounterId}/diagnoses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error((data && data.error) || "Хадгалах үед алдаа гарлаа");
      }

      // Refresh encounter from server to reflect saved data
      if (data && Array.isArray(data)) {
        // data is list of EncounterDiagnosis with diagnosis included
        setRows(
          data.map((r: any) => ({
            diagnosisId: r.diagnosisId,
            diagnosis: r.diagnosis,
            selectedProblemIds: Array.isArray(r.selectedProblemIds)
              ? (r.selectedProblemIds as number[])
              : [],
            note: r.note || "",
          }))
        );
      }
    } catch (err: any) {
      console.error("Failed to save diagnoses:", err);
      setSaveError(err.message || "Хадгалах үед алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  if (!encounterId || Number.isNaN(encounterId)) {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: 24,
          fontFamily: "sans-serif",
        }}
      >
        <h1>Үзлэгийн дэлгэрэнгүй</h1>
        <div style={{ color: "red" }}>ID буруу байна.</div>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>
        Үзлэгийн дэлгэрэнгүй (ID: {encounterId})
      </h1>

      {encounterLoading && <div>Ачаалж байна...</div>}
      {!encounterLoading && encounterError && (
        <div style={{ color: "red", marginBottom: 12 }}>
          {encounterError}
        </div>
      )}

      {encounter && (
        <>
          {/* Encounter header info */}
          <section
            style={{
              marginBottom: 16,
              padding: 16,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <div style={{ marginBottom: 4 }}>
              <strong>Үйлчлүүлэгч:</strong>{" "}
              {formatPatientName(encounter.patientBook.patient)} (
              Карт: {encounter.patientBook.bookNumber})
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Салбар:</strong>{" "}
              {encounter.patientBook.patient.branch
                ? encounter.patientBook.patient.branch.name
                : "-"}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Эмч:</strong>{" "}
              {formatDoctorName(encounter.doctor)}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Огноо:</strong>{" "}
              {formatDateTime(encounter.visitDate)}
            </div>
            {encounter.notes && (
              <div style={{ marginTop: 4 }}>
                <strong>Тэмдэглэл:</strong> {encounter.notes}
              </div>
            )}
          </section>

          {/* Diagnosis editor */}
          <section
            style={{
              padding: 16,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h2 style={{ fontSize: 16, margin: 0 }}>Онош тавих</h2>
              <button
                type="button"
                onClick={addDiagnosisRow}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  color: "#2563eb",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                + Онош нэмэх
              </button>
            </div>

            {dxError && (
              <div style={{ color: "red", marginBottom: 8 }}>
                {dxError}
              </div>
            )}

            {rows.length === 0 && (
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                Одоогоор онош сонгоогүй байна. Дээрх “Онош нэмэх”
                товчоор онош нэмнэ үү.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rows.map((row, index) => {
                const problems =
                  problemsByDiagnosis[row.diagnosisId] || [];
                return (
                  <div
                    key={index}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 12,
                      background: "#f9fafb",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <select
                        value={row.diagnosisId || ""}
                        onChange={async (e) => {
                          const val = Number(e.target.value) || 0;
                          await handleDiagnosisChange(index, val);
                        }}
                        style={{
                          flex: 1,
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          padding: "6px 8px",
                        }}
                      >
                        <option value="">Онош сонгох...</option>
                        {allDiagnoses.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code} – {d.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeDiagnosisRow(index)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid #dc2626",
                          background: "#fef2f2",
                          color: "#b91c1c",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Устгах
                      </button>
                    </div>

                    {/* Problems checklist */}
                    {row.diagnosisId ? (
                      <>
                        {problems.length === 0 ? (
                          <div
                            style={{
                              color: "#6b7280",
                              fontSize: 12,
                              marginBottom: 8,
                            }}
                          >
                            Энэ оношид тохирсон проблем бүртгээгүй
                            байна (оношийн тохиргооноос нэмнэ).
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            {problems.map((p) => {
                              const checked =
                                row.selectedProblemIds.includes(p.id);
                              return (
                                <label
                                  key={p.id}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "4px 8px",
                                    borderRadius: 999,
                                    border: checked
                                      ? "1px solid #16a34a"
                                      : "1px solid #d1d5db",
                                    background: checked
                                      ? "#dcfce7"
                                      : "#ffffff",
                                    fontSize: 12,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      toggleProblem(index, p.id)
                                    }
                                  />
                                  {p.label}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : null}

                    {/* Note */}
                    <textarea
                      placeholder="Энэ оношид холбогдох тэмдэглэл (сонголттой)"
                      value={row.note}
                      onChange={(e) =>
                        handleNoteChange(index, e.target.value)
                      }
                      rows={2}
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "6px 8px",
                        fontSize: 13,
                        resize: "vertical",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {saveError && (
              <div style={{ color: "red", marginTop: 8 }}>
                {saveError}
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#16a34a",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {saving ? "Хадгалж байна..." : "Онош хадгалах"}
              </button>
            </div>
          </section>

{/* Services / Treatments */}
<section
  style={{
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    }}
  >
    <h2 style={{ fontSize: 16, margin: 0 }}>Үйлчилгээ / эмчилгээ</h2>
    <button
      type="button"
      onClick={addServiceRow}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid #2563eb",
        background: "#eff6ff",
        color: "#2563eb",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      + Үйлчилгээ нэмэх
    </button>
  </div>

  {servicesError && (
    <div style={{ color: "red", marginBottom: 8 }}>{servicesError}</div>
  )}

  {services.length === 0 && (
    <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>
      Одоогоор үйлчилгээ сонгоогүй байна. Дээрх “Үйлчилгээ нэмэх” товчоор
      эмчилгээ нэмнэ үү.
    </div>
  )}

  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {services.map((s, index) => (
      <div
        key={index}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 2fr) 80px 130px auto",
          gap: 8,
          alignItems: "center",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 8,
          background: "#f9fafb",
        }}
      >
        <select
          value={s.serviceId || ""}
          onChange={(e) =>
            handleServiceChange(index, "serviceId", e.target.value)
          }
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Үйлчилгээ сонгох...</option>
          {allServices.map((svc) => (
            <option key={svc.id} value={svc.id}>
              {svc.code ? `${svc.code} — ` : ""}
              {svc.name} ({svc.price.toLocaleString("mn-MN")}₮)
            </option>
          ))}
        </select>

        <input
          type="number"
          min={1}
          value={s.quantity || 1}
          onChange={(e) =>
            handleServiceChange(index, "quantity", e.target.value)
          }
          style={{
            width: "100%",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />

        <input
          placeholder="Шүдний код (ж: 11, 26, 85)"
          value={s.toothCode || ""}
          onChange={(e) =>
            handleServiceChange(index, "toothCode", e.target.value)
          }
          style={{
            width: "100%",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 13, color: "#111827" }}>
            {(() => {
              const svc =
                s.service ||
                allServices.find((x) => x.id === s.serviceId);
              const price = svc?.price ?? 0;
              return (price * (s.quantity || 1)).toLocaleString("mn-MN") + "₮";
            })()}
          </span>
          <button
            type="button"
            onClick={() => removeServiceRow(index)}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #dc2626",
              background: "#fef2f2",
              color: "#b91c1c",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Устгах
          </button>
        </div>
      </div>
    ))}
  </div>

  <div
    style={{
      marginTop: 12,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <div style={{ fontSize: 14, fontWeight: 600 }}>
      Нийт дүн: {totalServicePrice.toLocaleString("mn-MN")}₮
    </div>
    <button
      type="button"
      onClick={handleSaveServices}
      disabled={servicesSaving}
      style={{
        padding: "8px 16px",
        borderRadius: 6,
        border: "none",
        background: "#2563eb",
        color: "#ffffff",
        cursor: "pointer",
        fontSize: 14,
      }}
    >
      {servicesSaving ? "Үйлчилгээ хадгалж байна..." : "Үйлчилгээ хадгалах"}
    </button>
  </div>
</section>
          
        </>
      )}
    </main>
  );
}

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
  toothCode?: string | null; // will now hold comma-separated list like "11, 21, 22"
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
  toothCode?: string; // comma-separated list of tooth codes
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

// Helper: convert comma-separated toothCode string to array of codes
function parseToothList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Helper: stringify array of tooth codes to "11, 21, 22"
function stringifyToothList(list: string[]): string {
  return Array.from(new Set(list)) // ensure uniqueness
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
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

  // Diagnoses
  const [allDiagnoses, setAllDiagnoses] = useState<Diagnosis[]>([]);
  const [dxLoading, setDxLoading] = useState(false);
  const [dxError, setDxError] = useState("");
  const [problemsByDiagnosis, setProblemsByDiagnosis] = useState<
    Record<number, DiagnosisProblem[]>
  >({});
  const [rows, setRows] = useState<EditableDiagnosis[]>([]);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  // Suggestion dropdown for diagnosis search
  const [openDxIndex, setOpenDxIndex] = useState<number | null>(null);

  // Services
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [services, setServices] = useState<EncounterServiceRow[]>([]);
  const [servicesError, setServicesError] = useState("");
  const [servicesSaving, setServicesSaving] = useState(false);

  // Tooth chart (selector only, per active diagnosis row)
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [toothMode, setToothMode] = useState<"ADULT" | "CHILD">("ADULT");

  // Index of the row linked to current selectedTeeth (multi-tooth per онош)
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  // --- Load master services ---
  useEffect(() => {
    const loadServices = async () => {
      try {
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

  // --- Load encounter ---
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
                toothCode: r.toothCode || "",
              }))
            : [];
        setRows(initialRows);

        const initialServices: EncounterServiceRow[] =
          Array.isArray(data.encounterServices) &&
          data.encounterServices.length > 0
            ? data.encounterServices.map((s: any) => ({
                id: s.id,
                serviceId: s.serviceId,
                service: s.service,
                quantity: s.quantity ?? 1,
                toothCode: s.toothCode ?? null,
              }))
            : [];
        setServices(initialServices);
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

  // --- Load all diagnoses ---
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

  // --- Diagnoses helpers ---

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
    }
  };

  // Create a new diagnosis row, initially empty, optionally with tooth list
  const createDiagnosisRow = (initialTeeth: string[]): number => {
    const index = rows.length;
    const toothCode = stringifyToothList(initialTeeth);
    const newRow: EditableDiagnosis = {
      diagnosisId: 0,
      diagnosis: undefined,
      selectedProblemIds: [],
      note: "",
      toothCode,
    };
    setRows((prev) => [...prev, newRow]);
    return index;
  };

  const removeDiagnosisRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setOpenDxIndex((prev) => (prev === index ? null : prev));
    setActiveRowIndex((prev) => {
      if (prev === null) return prev;
      if (prev === index) return null;
      // If we remove a row before current active index, shift left
      if (index < prev) return prev - 1;
      return prev;
    });
  };

  const handleDiagnosisChange = async (index: number, diagnosisId: number) => {
    const dx = allDiagnoses.find((d) => d.id === diagnosisId);
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              diagnosisId,
              diagnosis: dx,
              selectedProblemIds: [],
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
      prev.map((row, i) => (i === index ? { ...row, note: value } : row))
    );
  };

  const handleDxToothCodeChange = (index: number, value: string) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, toothCode: value } : row
      )
    );
    // Manual edit does not change chart selection; chart is only a helper.
  };

  const handleSaveDiagnoses = async () => {
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
            toothCode:
              r.toothCode && r.toothCode.trim()
                ? r.toothCode.trim()
                : null,
          })),
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

      if (data && Array.isArray(data)) {
        setRows(
          data.map((r: any) => ({
            diagnosisId: r.diagnosisId,
            diagnosis: r.diagnosis,
            selectedProblemIds: Array.isArray(r.selectedProblemIds)
              ? (r.selectedProblemIds as number[])
              : [],
            note: r.note || "",
            toothCode: r.toothCode || "",
          }))
        );
      }

      // After saving, clear current selection so doctor can start new онош
      setSelectedTeeth([]);
      setActiveRowIndex(null);
    } catch (err: any) {
      console.error("Failed to save diagnoses:", err);
      setSaveError(err.message || "Хадгалах үед алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  // --- Services helpers ---

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

  // --- Tooth chart helpers ---

  const ADULT_TEETH: string[] = [
    "11", "12", "13", "14", "15", "16", "17", "18",
    "21", "22", "23", "24", "25", "26", "27", "28",
    "31", "32", "33", "34", "35", "36", "37", "38",
    "41", "42", "43", "44", "45", "46", "47", "48",
  ];

  const CHILD_TEETH: string[] = [
    "51", "52", "53", "54", "55",
    "61", "62", "63", "64", "65",
    "71", "72", "73", "74", "75",
    "81", "82", "83", "84", "85",
  ];

  const toggleToothMode = (mode: "ADULT" | "CHILD") => {
    setToothMode(mode);
  };

  const isToothSelected = (code: string) => selectedTeeth.includes(code);

  const updateActiveRowToothList = (nextTeeth: string[]) => {
    if (activeRowIndex === null) {
      if (nextTeeth.length === 0) return;
      // Create new row for this group of teeth
      const idx = createDiagnosisRow(nextTeeth);
      setActiveRowIndex(idx);
      return;
    }

    // Update existing active row
    setRows((prev) =>
      prev.map((row, i) =>
        i === activeRowIndex
          ? { ...row, toothCode: stringifyToothList(nextTeeth) }
          : row
      )
    );

    // If no teeth left for this row and row is still "empty", remove it
    if (nextTeeth.length === 0) {
      setRows((prev) => {
        const row = prev[activeRowIndex];
        const isEmpty =
          row.diagnosisId === 0 &&
          row.note.trim() === "" &&
          (row.selectedProblemIds?.length ?? 0) === 0;
        if (!isEmpty) {
          // Keep row but clear its toothCode field
          return prev.map((r, i) =>
            i === activeRowIndex ? { ...r, toothCode: "" } : r
          );
        }
        // Remove row entirely
        return prev.filter((_, i) => i !== activeRowIndex);
      });
      setActiveRowIndex(null);
    }
  };

  const toggleToothSelection = (code: string) => {
    setSelectedTeeth((prev) => {
      let next: string[];
      if (prev.includes(code)) {
        next = prev.filter((c) => c !== code);
      } else {
        next = [...prev, code];
      }
      updateActiveRowToothList(next);
      return next;
    });
  };

  // --- Render ---

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
        <div style={{ color: "red", marginBottom: 12 }}>{encounterError}</div>
      )}

      {encounter && (
        <>
          {/* Encounter header */}
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
              {formatPatientName(encounter.patientBook.patient)} (Карт:{" "}
              {encounter.patientBook.bookNumber})
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Салбар:</strong>{" "}
              {encounter.patientBook.patient.branch
                ? encounter.patientBook.patient.branch.name
                : "-"}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Эмч:</strong> {formatDoctorName(encounter.doctor)}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Огноо:</strong> {formatDateTime(encounter.visitDate)}
            </div>
            {encounter.notes && (
              <div style={{ marginTop: 4 }}>
                <strong>Тэмдэглэл:</strong> {encounter.notes}
              </div>
            )}
          </section>

          {/* Tooth chart selector */}
          <section
            style={{
              marginTop: 0,
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
              <h2 style={{ fontSize: 16, margin: 0 }}>Шүдний диаграм</h2>

              <div
                style={{
                  display: "inline-flex",
                  borderRadius: 999,
                  border: "1px solid #d1d5db",
                  overflow: "hidden",
                  fontSize: 13,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleToothMode("ADULT")}
                  style={{
                    padding: "4px 10px",
                    border: "none",
                    background:
                      toothMode === "ADULT" ? "#2563eb" : "white",
                    color:
                      toothMode === "ADULT" ? "white" : "#111827",
                    cursor: "pointer",
                  }}
                >
                  Байнгын шүд
                </button>
                <button
                  type="button"
                  onClick={() => toggleToothMode("CHILD")}
                  style={{
                    padding: "4px 10px",
                    border: "none",
                    background:
                      toothMode === "CHILD" ? "#2563eb" : "white",
                    color:
                      toothMode === "CHILD" ? "white" : "#111827",
                    cursor: "pointer",
                  }}
                >
                  Сүүн шүд
                </button>
              </div>
            </div>

            {chartLoading && (
              <div style={{ fontSize: 13 }}>
                Шүдний диаграм ачааллаж байна...
              </div>
            )}
            {!chartLoading && chartError && (
              <div style={{ color: "red", marginBottom: 8 }}>
                {chartError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 8,
              }}
            >
              {(toothMode === "ADULT" ? ADULT_TEETH : CHILD_TEETH).map(
                (code) => {
                  const selected = isToothSelected(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleToothSelection(code)}
                      style={{
                        minWidth: 34,
                        padding: "4px 6px",
                        borderRadius: 999,
                        border: selected
                          ? "1px solid #16a34a"
                          : "1px solid #d1d5db",
                        background: selected ? "#dcfce7" : "white",
                        color: selected ? "#166534" : "#111827",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {code}
                    </button>
                  );
                }
              )}

              {/* Whole mouth pill */}
              <button
                key="ALL"
                type="button"
                onClick={() => toggleToothSelection("ALL")}
                style={{
                  minWidth: 60,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: isToothSelected("ALL")
                    ? "1px solid #16a34a"
                    : "1px solid #d1d5db",
                  background: isToothSelected("ALL") ? "#dcfce7" : "white",
                  color: isToothSelected("ALL") ? "#166534" : "#111827",
                  fontSize: 12,
                  cursor: "pointer",
                  marginLeft: 12,
                }}
              >
                Бүх шүд
              </button>
            </div>

            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
              Шүдийг дарж сонгох үед тухайн шүднүүдэд зориулсан оношийн мөр
              доорх хэсэгт үүснэ. Олон шүд сонгоход нэг онош нь бүгдэд нь
              хамаарна.
            </div>
          </section>

          {/* Diagnoses */}
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
              <div>
                <h2 style={{ fontSize: 16, margin: 0 }}>Онош тавих</h2>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Шүд сонгоход тухайн шүднүүдэд зориулагдсан нэг оношийн мөр
                  үүснэ. Нэг онош нь олон шүдэнд хамаарч болно.
                </div>
              </div>
            </div>

            {dxError && (
              <div style={{ color: "red", marginBottom: 8 }}>{dxError}</div>
            )}

            {rows.length === 0 && (
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                Одоогоор оношийн мөр алга байна. Дээрх шүдний диаграмаас шүд
                сонгоход автоматаар оношийн мөр үүснэ.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rows.map((row, index) => {
                const problems = problemsByDiagnosis[row.diagnosisId] || [];
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
                    {/* Diagnosis search input + suggestions */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ position: "relative", flex: 1 }}>
                          <input
                            placeholder="Онош бичиж хайх (ж: K04.1, пульпит...)"
                            value={
                              row.diagnosis
                                ? `${row.diagnosis.code} – ${row.diagnosis.name}`
                                : ""
                            }
                            onChange={(e) => {
                              const text = e.target.value;
                              setOpenDxIndex(index);
                              if (!text.trim()) {
                                // clear diagnosis on empty
                                setRows((prev) =>
                                  prev.map((r, i) =>
                                    i === index
                                      ? {
                                          ...r,
                                          diagnosisId: 0,
                                          diagnosis: undefined,
                                          selectedProblemIds: [],
                                        }
                                      : r
                                  )
                                );
                              }
                            }}
                            onFocus={() => setOpenDxIndex(index)}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "6px 8px",
                              fontSize: 13,
                            }}
                          />

                          {/* Suggestions dropdown */}
                          {openDxIndex === index &&
                            allDiagnoses.length > 0 && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  right: 0,
                                  maxHeight: 220,
                                  overflowY: "auto",
                                  marginTop: 4,
                                  background: "white",
                                  borderRadius: 6,
                                  boxShadow:
                                    "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
                                  zIndex: 20,
                                  fontSize: 13,
                                }}
                              >
                                {allDiagnoses
                                  .filter((d) => {
                                    const label = row.diagnosis
                                      ? `${row.diagnosis.code} – ${row.diagnosis.name}`
                                      : "";
                                    const q = label.toLowerCase();
                                    if (!q.trim()) return true;
                                    const hay = `${d.code} ${d.name}`.toLowerCase();
                                    return hay.includes(q);
                                  })
                                  .slice(0, 50)
                                  .map((d) => (
                                    <div
                                      key={d.id}
                                      onMouseDown={async (e) => {
                                        e.preventDefault();
                                        await handleDiagnosisChange(
                                          index,
                                          d.id
                                        );
                                        setOpenDxIndex(null);
                                      }}
                                      style={{
                                        padding: "6px 8px",
                                        cursor: "pointer",
                                        borderBottom:
                                          "1px solid #f3f4f6",
                                        background:
                                          row.diagnosisId === d.id
                                            ? "#eff6ff"
                                            : "white",
                                      }}
                                    >
                                      <div style={{ fontWeight: 500 }}>
                                        {d.code} – {d.name}
                                      </div>
                                      {d.description && (
                                        <div
                                          style={{
                                            fontSize: 11,
                                            color: "#6b7280",
                                            marginTop: 2,
                                          }}
                                        >
                                          {d.description}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            )}
                        </div>

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
                            height: 32,
                            alignSelf: "flex-start",
                          }}
                        >
                          Устгах
                        </button>
                      </div>
                    </div>

                    {/* Tooth list (comma-separated) */}
                    <div
                      style={{
                        marginBottom: 8,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        placeholder="Шүдний код (ж: 11, 21, 22) эсвэл Бүх шүд"
                        value={row.toothCode || ""}
                        onChange={(e) =>
                          handleDxToothCodeChange(index, e.target.value)
                        }
                        style={{
                          maxWidth: 260,
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          padding: "6px 8px",
                          fontSize: 12,
                        }}
                      />
                      <span style={{ fontSize: 11, color: "#6b7280" }}>
                        Шүдний диаграмаас автоматаар бөглөгдөнө, засах
                        боломжтой.
                      </span>
                    </div>

                    {/* Problems */}
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
                            Энэ оношид тохирсон зовиур бүртгээгүй байна
                            (оношийн тохиргооноос нэмнэ).
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
              <div style={{ color: "red", marginTop: 8 }}>{saveError}</div>
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
                onClick={handleSaveDiagnoses}
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

          {/* Services */}
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
              <div style={{ color: "red", marginBottom: 8 }}>
                {servicesError}
              </div>
            )}

            {services.length === 0 && (
              <div
                style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}
              >
                Одоогоор үйлчилгээ сонгоогүй байна. Дээрх “Үйлчилгээ нэмэх”
                товчоор эмчилгээ нэмнэ үү.
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
                        {svc.name} (
                        {svc.price.toLocaleString("mn-MN")}
                        ₮)
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
                    placeholder="Шүдний код (ж: 11, 26, 85) эсвэл хоосон"
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
                        return (
                          (price * (s.quantity || 1)).toLocaleString("mn-MN") +
                          "₮"
                        );
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
                {servicesSaving
                  ? "Үйлчилгээ хадгалж байна..."
                  : "Үйлчилгээ хадгалах"}
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

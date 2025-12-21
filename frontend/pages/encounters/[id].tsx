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
  toothCode?: string | null;
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

type EncounterService = {
  id: number;
  encounterId: number;
  serviceId: number;
  quantity: number;
  price: number;
  service: Service;
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
  encounterServices: EncounterService[];
};

type EditableDiagnosis = {
  diagnosisId: number;
  diagnosis?: Diagnosis;
  selectedProblemIds: number[];
  note: string;
  toothCode?: string;
  serviceId?: number;
  serviceQuantity?: number;
  searchText?: string;
  serviceSearchText?: string;
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

// stringify array of tooth codes to "11, 21, 22"
function stringifyToothList(list: string[]): string {
  return Array.from(new Set(list))
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

  const [finishing, setFinishing] = useState(false);
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
  const [openDxIndex, setOpenDxIndex] = useState<number | null>(null);

  // Services catalog
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [servicesLoadError, setServicesLoadError] = useState("");
  const [openServiceIndex, setOpenServiceIndex] = useState<number | null>(
    null
  );

  // Tooth chart selection
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [chartError, setChartError] = useState("");
  const [toothMode, setToothMode] = useState<"ADULT" | "CHILD">("ADULT");
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  // --- Load master services ---
  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await fetch("/api/services?onlyActive=true");
        const data = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(data)) {
          throw new Error(data?.error || "Алдаа гарлаа");
        }
        setAllServices(data);
      } catch (err: any) {
        console.error("Failed to load services:", err);
        setServicesLoadError(
          err.message || "Үйлчилгээний жагсаалт ачаалахад алдаа гарлаа."
        );
      }
    };
    loadServices();
  }, []);

  // --- Load encounter (diagnoses + services) ---
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

        // Initialize diagnoses from encounterDiagnoses
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
                serviceId: undefined,
                serviceQuantity: undefined,
                searchText: r.diagnosis
                  ? `${r.diagnosis.code} – ${r.diagnosis.name}`
                  : "",
                serviceSearchText: "",
              }))
            : [];

        // Pre-fill per-diagnosis services roughly by index (best effort)
        if (
          Array.isArray(data.encounterServices) &&
          data.encounterServices.length > 0 &&
          initialRows.length > 0
        ) {
          const services = data.encounterServices as EncounterService[];
          for (let i = 0; i < initialRows.length && i < services.length; i++) {
            const svc = services[i];
            initialRows[i].serviceId = svc.serviceId;
            initialRows[i].serviceQuantity =
              svc.quantity && svc.quantity > 0 ? svc.quantity : 1;
            initialRows[i].serviceSearchText = svc.service?.name || "";
          }
        }

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

  const createDiagnosisRow = (initialTeeth: string[]): number => {
    const index = rows.length;
    const toothCode = stringifyToothList(initialTeeth);
    const newRow: EditableDiagnosis = {
      diagnosisId: 0,
      diagnosis: undefined,
      selectedProblemIds: [],
      note: "",
      toothCode,
      serviceId: undefined,
      serviceQuantity: undefined,
      searchText: "",
      serviceSearchText: "",
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
              searchText: dx ? `${dx.code} – ${dx.name}` : "",
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

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Хадгалах үед алдаа гарлаа");
      }

      if (Array.isArray(data)) {
        // keep service selections by matching toothCode + diagnosisId when possible
        setRows((prevRows) =>
          data.map((r: any) => {
            const match = prevRows.find(
              (x) =>
                x.diagnosisId === r.diagnosisId &&
                (x.toothCode || "") === (r.toothCode || "")
            );
            const matchedService =
              match?.serviceId &&
              allServices.find((s) => s.id === match.serviceId);
            return {
              diagnosisId: r.diagnosisId,
              diagnosis: r.diagnosis,
              selectedProblemIds: Array.isArray(r.selectedProblemIds)
                ? (r.selectedProblemIds as number[])
                : [],
              note: r.note || "",
              toothCode: r.toothCode || "",
              serviceId: match?.serviceId,
              serviceQuantity: match?.serviceQuantity,
              searchText: r.diagnosis
                ? `${r.diagnosis.code} – ${r.diagnosis.name}`
                : "",
              serviceSearchText: matchedService?.name || "",
            } as EditableDiagnosis;
          })
        );
      }

      setSelectedTeeth([]);
      setActiveRowIndex(null);
    } catch (err: any) {
      console.error("Failed to save diagnoses:", err);
      setSaveError(err.message || "Хадгалах үед алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  // --- Save services: keep EncounterService in sync ---

  const handleSaveServices = async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;

    // Build items from rows that have a service selected
    const items = rows
      .filter((r) => r.serviceId)
      .map((r) => ({
        serviceId: r.serviceId as number,
        quantity:
          r.serviceQuantity && r.serviceQuantity > 0
            ? r.serviceQuantity
            : 1,
      }));

    try {
      const res = await fetch(`/api/encounters/${encounterId}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error || "Үйлчилгээ хадгалахад алдаа гарлаа."
        );
      }

      // Optionally update encounter.encounterServices in local state
      if (Array.isArray(data)) {
        setEncounter((prev) =>
          prev
            ? {
                ...prev,
                encounterServices: data,
              }
            : prev
        );
      }
    } catch (err: any) {
      console.error("Failed to save services:", err);
      setSaveError(
        err.message || "Үйлчилгээ хадгалахад алдаа гарлаа."
      );
    }
  };

  const handleFinishEncounter = async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    setFinishing(true);
    setSaveError("");
    try {
      // 1) Save diagnoses
      await handleSaveDiagnoses();
      // 2) Save services
      await handleSaveServices();

      // 3) Mark appointment as ready_to_pay
      const res = await fetch(`/api/encounters/${encounterId}/finish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error || "Үзлэг дууссан төлөвт шилжүүлэхэд алдаа гарлаа."
        );
      }
    } catch (err: any) {
      console.error("Failed to finish encounter:", err);
      setSaveError(
        err.message || "Үзлэг дууссан төлөвт шилжүүлэхэд алдаа гарлаа."
      );
    } finally {
      setFinishing(false);
    }
  };

  // --- Tooth chart helpers ---

  const ADULT_TEETH: string[] = [
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "31",
    "32",
    "33",
    "34",
    "35",
    "36",
    "37",
    "38",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
  ];

  const CHILD_TEETH: string[] = [
    "51",
    "52",
    "53",
    "54",
    "55",
    "61",
    "62",
    "63",
    "64",
    "65",
    "71",
    "72",
    "73",
    "74",
    "75",
    "81",
    "82",
    "83",
    "84",
    "85",
  ];

  const toggleToothMode = (mode: "ADULT" | "CHILD") => {
    setToothMode(mode);
  };

  const isToothSelected = (code: string) => selectedTeeth.includes(code);

  const updateActiveRowToothList = (nextTeeth: string[]) => {
    if (activeRowIndex === null) {
      if (nextTeeth.length === 0) return;
      const idx = createDiagnosisRow(nextTeeth);
      setActiveRowIndex(idx);
      return;
    }

    setRows((prev) =>
      prev.map((row, i) =>
        i === activeRowIndex
          ? { ...row, toothCode: stringifyToothList(nextTeeth) }
          : row
      )
    );

    if (nextTeeth.length === 0) {
      setRows((prev) => {
        const row = prev[activeRowIndex!];
        const isEmpty =
          row.diagnosisId === 0 &&
          (row.note || "").trim() === "" &&
          (row.selectedProblemIds?.length ?? 0) === 0 &&
          !row.serviceId;
        if (!isEmpty) {
          return prev.map((r, i) =>
            i === activeRowIndex ? { ...r, toothCode: "" } : r
          );
        }
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

  // --- Derived: total price of services chosen per diagnosis ---
  const totalDiagnosisServicesPrice = rows.reduce((sum, r) => {
    if (!r.serviceId) return sum;
    const svc = allServices.find((x) => x.id === r.serviceId);
    const price = svc?.price ?? 0;
    const qty =
      r.serviceQuantity && r.serviceQuantity > 0 ? r.serviceQuantity : 1;
    return sum + price * qty;
  }, 0);

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
        <div style={{ color: "red", marginBottom: 12 }}>
          {encounterError}
        </div>
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

            {chartError && (
              <div style={{ color: "red", marginBottom: 8 }}>{chartError}</div>
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
              Шүдийг дарж сонгох үед тухайн шүднүүдэд зориулсан нэг оношийн мөр
              доорх хэсэгт үүснэ. Нэг онош нь олон шүдэнд (эсвэл Бүх шүд)
              хамаарч болно.
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
                  Нэг мөр = нэг онош, олон шүдэнд хамаарч болно. Шүдний код,
                  онош болон үйлчилгээний дагуу урьдчилсан дүн доор харагдана.
                </div>
              </div>
            </div>

            {dxError && (
              <div style={{ color: "red", marginBottom: 8 }}>{dxError}</div>
            )}
            {servicesLoadError && (
              <div style={{ color: "red", marginBottom: 8 }}>
                {servicesLoadError}
              </div>
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
                    {/* Diagnosis search */}
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
                            value={row.searchText ?? ""}
                            onChange={(e) => {
                              const text = e.target.value;
                              setOpenDxIndex(index);
                              setRows((prev) =>
                                prev.map((r, i) =>
                                  i === index
                                    ? {
                                        ...r,
                                        searchText: text,
                                        ...(text.trim()
                                          ? {}
                                          : {
                                              diagnosisId: 0,
                                              diagnosis: undefined,
                                              selectedProblemIds: [],
                                            }),
                                      }
                                    : r
                                )
                              );
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
                                    const q = (
                                      row.searchText || ""
                                    ).toLowerCase();
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

                    {/* Tooth list */}
                    <div
                      style={{
                        marginBottom: 8,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
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

                    {/* Service for this diagnosis */}
                    <div
                      style={{
                        marginBottom: 8,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          minWidth: 260,
                          flex: "0 0 auto",
                        }}
                      >
                        <input
                          placeholder="Үйлчилгээний нэр эсвэл кодоор хайх..."
                          value={row.serviceSearchText ?? ""}
                          onChange={(e) => {
                            const text = e.target.value;
                            setOpenServiceIndex(index);
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === index
                                  ? {
                                      ...r,
                                      serviceSearchText: text,
                                      ...(text.trim()
                                        ? {}
                                        : {
                                            serviceId: undefined,
                                            serviceQuantity: undefined,
                                          }),
                                    }
                                  : r
                              )
                            );
                          }}
                          onFocus={() => setOpenServiceIndex(index)}
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            padding: "6px 8px",
                            fontSize: 13,
                            background: "#ffffff",
                          }}
                        />

                        {allServices.length > 0 &&
                          openServiceIndex === index &&
                          (row.serviceSearchText || "").length > 0 && (
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
                                zIndex: 15,
                                fontSize: 13,
                              }}
                            >
                              {allServices
                                .filter((svc) => {
                                  const q = (
                                    row.serviceSearchText || ""
                                  ).toLowerCase();
                                  if (!q.trim()) return true;
                                  const hay = `${svc.code || ""} ${svc.name}`.toLowerCase();
                                  return hay.includes(q);
                                })
                                .slice(0, 50)
                                .map((svc) => (
                                  <div
                                    key={svc.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setRows((prev) =>
                                        prev.map((r, i) =>
                                          i === index
                                            ? {
                                                ...r,
                                                serviceId: svc.id,
                                                serviceQuantity:
                                                  r.serviceQuantity &&
                                                  r.serviceQuantity > 0
                                                    ? r.serviceQuantity
                                                    : 1,
                                                serviceSearchText:
                                                  svc.name,
                                              }
                                            : r
                                        )
                                      );
                                      setOpenServiceIndex(null);
                                    }}
                                    style={{
                                      padding: "6px 8px",
                                      cursor: "pointer",
                                      borderBottom:
                                        "1px solid #f3f4f6",
                                      background:
                                        row.serviceId === svc.id
                                          ? "#eff6ff"
                                          : "white",
                                    }}
                                  >
                                    <div style={{ fontWeight: 500 }}>
                                      {svc.code ? `${svc.code} — ` : ""}
                                      {svc.name}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 11,
                                        color: "#6b7280",
                                        marginTop: 2,
                                      }}
                                    >
                                      Үнэ:{" "}
                                      {svc.price.toLocaleString(
                                        "mn-MN"
                                      )}
                                      ₮
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                      </div>

                      <input
                        type="number"
                        min={1}
                        placeholder="Тоо"
                        value={
                          row.serviceQuantity ?? (row.serviceId ? 1 : "")
                        }
                        onChange={(e) => {
                          const q = Number(e.target.value) || 1;
                          setRows((prev) =>
                            prev.map((r, i) =>
                              i === index
                                ? { ...r, serviceQuantity: q }
                                : r
                            )
                          );
                        }}
                        disabled={!row.serviceId}
                        style={{
                          width: 80,
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          padding: "6px 8px",
                          fontSize: 13,
                          opacity: row.serviceId ? 1 : 0.6,
                        }}
                      />
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
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 13, color: "#111827" }}>
                Нийт үйлчилгээний урьдчилсан дүн:{" "}
                <strong>
                  {totalDiagnosisServicesPrice.toLocaleString("mn-MN")}₮
                </strong>{" "}
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  (Эмчийн сонгосон онош, үйлчилгээний дагуу. Төлбөрийн касс
                  дээр эцэслэнэ.)
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveDiagnoses();
                    await handleSaveServices();
                  }}
                  disabled={saving || finishing}
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
                  {saving ? "Хадгалж байна..." : "Зөвхөн онош хадгалах"}
                </button>

                <button
                  type="button"
                  onClick={handleFinishEncounter}
                  disabled={saving || finishing}
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
                  {finishing
                    ? "Дуусгаж байна..."
                    : "Үзлэг дуусгах / Төлбөрт шилжүүлэх"}
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

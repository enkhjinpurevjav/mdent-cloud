
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import SignaturePad from "../../components/SignaturePad";

type Branch = {
  id: number;
  name: string;
  address?: string | null;
};

type Patient = {
  id: number;
  regNo: string;
  ovog?: string | null;
  name: string;
  gender?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  address?: string | null;
  bloodType?: string | null;
  citizenship?: string | null;
  emergencyPhone?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  branchId: number;
  branch?: Branch;
};

type ActiveTab =
  | "profile"
  | "appointments"
  | "visit_card"
  | "history"
  | "billing";

type PatientBook = {
  id: number;
  bookNumber: string;
};

type VisitCardType = "ADULT" | "CHILD";

type VisitCard = {
  id: number;
  patientBookId: number;
  type: VisitCardType;
  answers: any;
  patientSignaturePath?: string | null;
  signedAt?: string | null;
};

type VisitCardAnswers = {
  // shared header
  date?: string;
  email?: string;
  phone?: string;
  workPlace?: string;
  address?: string;

  // adult/child-specific simple text fields
  previousClinicName?: string;
  previousTreatmentIssues?: string;
  dentistAttentionNotes?: string;

  // simple complaint fields we already use in JSX
  mainComplaint?: string;
  pastHistory?: string;

  // prevention reason (multi-choice)
  reasonToVisit?: {
    toothPain?: boolean;
    toothBroken?: boolean;
    toothDecay?: boolean;
    badBite?: boolean;
    preventiveCheck?: boolean;
    cosmeticSmile?: boolean;
    other?: string;
  };

  previousDentalVisit?: {
    hasVisited?: "yes" | "no";
    clinicName?: string;
    reactionOrComplication?: string;
  };

  generalMedical?: {
    heartDisease?: "yes" | "no";
    highBloodPressure?: "yes" | "no";
    infectiousDisease?: "yes" | "no";
    tuberculosis?: "yes" | "no";
    hepatitisBC?: "yes" | "no";
    diabetes?: "yes" | "no";
    onMedication?: "yes" | "no";
    seriousIllnessOrSurgery?: "yes" | "no";
    implant?: "yes" | "no";
    generalAnesthesia?: "yes" | "no";
    chemoOrRadiation?: "yes" | "no";
    pregnant?: "yes" | "no";
    childAllergyFood?: "yes" | "no";
    details?: string;
  };

  allergies?: {
    drug?: "yes" | "no";
    drugDetail?: string;
    metal?: "yes" | "no";
    localAnesthetic?: "yes" | "no";
    latex?: "yes" | "no";
    other?: "yes" | "no";
    otherDetail?: string;
  };

  habits?: {
    smoking?: "yes" | "no";
    alcohol?: "yes" | "no";
    coffee?: "yes" | "no";
    nightGrinding?: "yes" | "no";
    mouthBreathing?: "yes" | "no";
    other?: string;
  };

  dentalFollowup?: {
    regularCheckups?: "yes" | "no";
    bleedingAfterExtraction?: "yes" | "no";
    gumBleeding?: "yes" | "no";
    badBreath?: "yes" | "no";
  };

  consentAccepted?: boolean;
  notes?: string;
};

type Encounter = {
  id: number;
  visitDate: string;
  notes?: string | null;
};

type Appointment = {
  id: number;
  patientId: number;
  doctorId?: number | null;
  branchId: number;
  scheduledAt: string;
  status: string;
  notes?: string | null;
};

type PatientProfileResponse = {
  patient: Patient;
  patientBook: PatientBook;
  encounters: Encounter[];
  appointments: Appointment[];
};

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function displayOrDash(value?: string | null) {
  if (value === undefined || value === null) return "-";
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return "-";
  return trimmed;
}

function formatDisplayName(patient: Patient) {
  const name = patient.name || "";
  const ovog = (patient.ovog || "").trim();
  if (ovog) {
    const first = ovog.charAt(0).toUpperCase();
    return `${first}.${name}`;
  }
  return name;
}

export default function PatientProfilePage() {
  const router = useRouter();
  const { bookNumber } = router.query;

  const [data, setData] = useState<PatientProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<ActiveTab>("profile");

  const [visitCard, setVisitCard] = useState<VisitCard | null>(null);
  const [visitCardLoading, setVisitCardLoading] = useState(false);
  const [visitCardError, setVisitCardError] = useState("");
  const [visitCardTypeDraft, setVisitCardTypeDraft] =
    useState<VisitCardType | null>(null);
  const [visitCardAnswers, setVisitCardAnswers] =
    useState<VisitCardAnswers>({});
  const [visitCardSaving, setVisitCardSaving] = useState(false);
  const [signatureSaving, setSignatureSaving] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Patient>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Load main profile
  useEffect(() => {
    if (!bookNumber || typeof bookNumber !== "string") return;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/patients/profile/by-book/${encodeURIComponent(bookNumber)}`
        );
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error((json && json.error) || "failed to load");
        }

        setData(json as PatientProfileResponse);
      } catch (err) {
        console.error(err);
        setError("Профайлыг ачааллах үед алдаа гарлаа");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [bookNumber]);

  // Load visit card only when visit_card tab is active
  useEffect(() => {
    if (!bookNumber || typeof bookNumber !== "string") return;
    if (activeTab !== "visit_card") return;

    const loadVisitCard = async () => {
      setVisitCardLoading(true);
      setVisitCardError("");
      try {
        const res = await fetch(
          `/api/patients/visit-card/by-book/${encodeURIComponent(bookNumber)}`
        );
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            (json && json.error) || "Үзлэгийн карт ачаалахад алдаа гарлаа."
          );
        }

        const card: VisitCard | null = json.visitCard || null;
        setVisitCard(card);
        if (card) {
          setVisitCardTypeDraft(card.type);
          setVisitCardAnswers(card.answers || {});
        } else {
          setVisitCardTypeDraft(null);
          setVisitCardAnswers({});
        }
      } catch (err: any) {
        console.error("loadVisitCard failed", err);
        setVisitCardError(
          err?.message || "Үзлэгийн карт ачаалахад алдаа гарлаа."
        );
        setVisitCard(null);
      } finally {
        setVisitCardLoading(false);
      }
    };

    void loadVisitCard();
  }, [bookNumber, activeTab]);

  const patient = data?.patient;
  const pb = data?.patientBook;
  const encounters = data?.encounters || [];
  const appointments = data?.appointments || [];
  const patientBookId = pb?.id || null;

  const updateVisitCardAnswer = (
    key: keyof VisitCardAnswers,
    value: VisitCardAnswers[typeof key]
  ) => {
    setVisitCardAnswers((prev: VisitCardAnswers) => ({
      ...(prev || {}),
      [key]: value,
    }));
  };

  const updateNested = (
    section: keyof VisitCardAnswers,
    field: string,
    value: any
  ) => {
    setVisitCardAnswers((prev: VisitCardAnswers) => ({
      ...(prev || {}),
      [section]: {
        ...(prev?.[section] as any),
        [field]: value,
      },
    }));
  };

  const totalEncounters = encounters.length;
  const lastEncounter = encounters[0];

  const now = new Date();
  const totalAppointments = appointments.length;
  const upcomingAppointments = appointments.filter((a) => {
    const d = new Date(a.scheduledAt);
    if (Number.isNaN(d.getTime())) return false;
    return d > now && a.status === "booked";
  });

  const startEdit = () => {
    if (!patient) return;
    setEditForm({
      ovog: patient.ovog || "",
      name: patient.name || "",
      regNo: patient.regNo || "",
      phone: patient.phone || "",
      gender: patient.gender || "",
      birthDate: patient.birthDate ? patient.birthDate.slice(0, 10) : "",
      address: patient.address || "",
      bloodType: patient.bloodType || "",
      citizenship: patient.citizenship || "Монгол",
      emergencyPhone: patient.emergencyPhone || "",
      notes: patient.notes || "",
    });
    setSaveError("");
    setSaveSuccess("");
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditForm({});
    setSaveError("");
    setSaveSuccess("");
  };

const handleEditChange = (
  e:
    | React.ChangeEvent<HTMLInputElement>
    | React.ChangeEvent<HTMLTextAreaElement>
    | React.ChangeEvent<HTMLSelectElement>
) => {
  const { name, value } = e.target;
  setEditForm((prev) => ({ ...prev, [name]: value }));
};

  const handleGenderChange = (value: "" | "эр" | "эм") => {
    setEditForm((prev) => ({ ...prev, gender: value }));
  };

  const handleSave = async () => {
    if (!patient) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    if (
      editForm.gender &&
      editForm.gender !== "эр" &&
      editForm.gender !== "эм"
    ) {
      setSaveError("Хүйс талбарт зөвхөн 'эр' эсвэл 'эм' утга сонгох боломжтой.");
      setSaving(false);
      return;
    }

    try {
      const payload: any = {
        ovog: (editForm.ovog || "").trim() || null,
        name: (editForm.name || "").trim(),
        regNo: (editForm.regNo || "").trim() || null,
        phone: (editForm.phone || "").trim() || null,
        gender: editForm.gender || null,
        birthDate: editForm.birthDate || null,
        address: (editForm.address || "").trim() || null,
        bloodType: (editForm.bloodType || "").trim() || null,
        citizenship: (editForm.citizenship || "").trim() || null,
        emergencyPhone: (editForm.emergencyPhone || "").trim() || null,
        notes: (editForm.notes || "").trim() || null,
      };

      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Өгөгдөл хадгалах үед алдаа гарлаа"
        );
      }

      const updatedPatient = (json && json.patient) || json || patient;
      setData((prev) =>
        prev
          ? {
              ...prev,
              patient: {
                ...prev.patient,
                ...updatedPatient,
              },
            }
          : prev
      );

      setSaveSuccess("Мэдээлэл амжилттай хадгалагдлаа.");
      setEditMode(false);
    } catch (err: any) {
      console.error(err);
      setSaveError(err?.message || "Өгөгдөл хадгалах үед алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVisitCard = async () => {
    if (!patientBookId) {
      setVisitCardError("PatientBook ID олдсонгүй.");
      return;
    }

    const type = visitCard?.type || visitCardTypeDraft;
    if (!type) {
      setVisitCardError(
        "Эхлээд картын төрлийг сонгоно уу (том хүн / хүүхэд)."
      );
      return;
    }

    setVisitCardSaving(true);
    setVisitCardError("");
    try {
      const res = await fetch(`/api/patients/visit-card/${patientBookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          answers: visitCardAnswers,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Үзлэгийн карт хадгалахад алдаа гарлаа."
        );
      }

      const card: VisitCard = json.visitCard;
      setVisitCard(card);
      setVisitCardTypeDraft(card.type);
      setVisitCardAnswers(card.answers || {});
    } catch (err: any) {
      console.error("save visit card failed", err);
      setVisitCardError(
        err?.message || "Үзлэгийн карт хадгалахад алдаа гарлаа."
      );
    } finally {
      setVisitCardSaving(false);
    }
  };

  const handleUploadSignature = async (blob: Blob) => {
    if (!patientBookId) {
      setVisitCardError("PatientBook ID олдсонгүй.");
      return;
    }
    setSignatureSaving(true);
    setVisitCardError("");
    try {
      const formData = new FormData();
      formData.append("file", blob, "signature.png");

      const res = await fetch(
        `/api/patients/visit-card/${patientBookId}/signature`,
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Гарын үсэг хадгалахад алдаа гарлаа."
        );
      }

      setVisitCard((prev) =>
        prev
          ? {
              ...prev,
              patientSignaturePath: json.patientSignaturePath,
              signedAt: json.signedAt,
            }
          : prev
      );
    } catch (err: any) {
      console.error("upload signature failed", err);
      setVisitCardError(
        err?.message || "Гарын үсэг хадгалахад алдаа гарлаа."
      );
    } finally {
      setSignatureSaving(false);
    }
  };

  const sortedAppointments = [...appointments].sort((a, b) =>
    b.scheduledAt.localeCompare(a.scheduledAt)
  );

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => router.push("/patients")}
        style={{
          marginBottom: 16,
          padding: "4px 8px",
          borderRadius: 4,
          border: "1px solid #d1d5db",
          background: "#f9fafb",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        ← Буцах
      </button>

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && patient && pb && (
        <>
          {/* Top layout: left profile panel + right content */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "260px 1fr",
              gap: 16,
              alignItems: "stretch",
              marginBottom: 24,
            }}
          >
            {/* Left: profile card + side menu */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                background: "white",
              }}
            >
              <div style={{ marginBottom: 4, fontSize: 18, fontWeight: 600 }}>
                {formatDisplayName(patient)}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Картын дугаар: {pb.bookNumber}
              </div>
              {patient.regNo && (
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  РД: {patient.regNo}
                </div>
              )}
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Утас: {displayOrDash(patient.phone)}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Бүртгэсэн салбар: {patient.branch?.name || patient.branchId}
              </div>
              {patient.createdAt && (
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  Бүртгэсэн: {formatDate(patient.createdAt)}
                </div>
              )}

              {/* Side menu */}
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    color: "#9ca3af",
                    marginBottom: 4,
                  }}
                >
                  Цэс
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    fontSize: 13,
                  }}
                >
                  {/* Профайл */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("profile");
                      setEditMode(false);
                      setSaveError("");
                      setSaveSuccess("");
                    }}
                    style={{
                      textAlign: "left",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "none",
                      background:
                        activeTab === "profile" ? "#eff6ff" : "transparent",
                      color:
                        activeTab === "profile" ? "#1d4ed8" : "#6b7280",
                      fontWeight: activeTab === "profile" ? 500 : 400,
                      cursor: "pointer",
                    }}
                  >
                    Профайл
                  </button>

                  {/* Цагууд */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("appointments");
                      setEditMode(false);
                      setSaveError("");
                      setSaveSuccess("");
                    }}
                    style={{
                      textAlign: "left",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "none",
                      background:
                        activeTab === "appointments"
                          ? "#eff6ff"
                          : "transparent",
                      color:
                        activeTab === "appointments"
                          ? "#1d4ed8"
                          : "#6b7280",
                      fontWeight:
                        activeTab === "appointments" ? 500 : 400,
                      cursor: "pointer",
                    }}
                  >
                    Цагууд
                  </button>

                  {/* Үзлэгийн карт */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("visit_card");
                      setEditMode(false);
                      setSaveError("");
                      setSaveSuccess("");
                    }}
                    style={{
                      textAlign: "left",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "none",
                      background:
                        activeTab === "visit_card"
                          ? "#eff6ff"
                          : "transparent",
                      color:
                        activeTab === "visit_card"
                          ? "#1d4ed8"
                          : "#6b7280",
                      fontWeight:
                        activeTab === "visit_card" ? 500 : 400,
                      cursor: "pointer",
                    }}
                  >
                    Үзлэгийн карт
                  </button>

                  {/* Future placeholders */}
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      color: "#6b7280",
                    }}
                  >
                    Үзлэгийн түүх
                  </div>
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      color: "#6b7280",
                    }}
                  >
                    Нэхэмжлэх
                  </div>
                </div>
              </div>
            </div>

            {/* Right content area: depends on activeTab */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {activeTab === "profile" && (
                <>
                  {/* Summary cards row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {/* Encounters summary */}
                    <div
                      style={{
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        padding: 12,
                        background: "#f9fafb",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "#6b7280",
                          marginBottom: 4,
                        }}
                      >
                        Үзлэгүүд
                      </div>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        {totalEncounters}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Нийт бүртгэлтэй үзлэг
                      </div>
                    </div>

                    {/* Last encounter */}
                    <div
                      style={{
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        padding: 12,
                        background: "#f9fafb",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "#6b7280",
                          marginBottom: 4,
                        }}
                      >
                        Сүүлийн үзлэг
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          marginBottom: 4,
                        }}
                      >
                        {lastEncounter
                          ? formatDateTime(lastEncounter.visitDate)
                          : "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Хамгийн сүүлд ирсэн огноо
                      </div>
                    </div>

                    {/* Appointments summary */}
                    <div
                      style={{
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        padding: 12,
                        background: "#f9fafb",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "#6b7280",
                          marginBottom: 4,
                        }}
                      >
                        Цаг захиалгууд
                      </div>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        {totalAppointments}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Нийт бүртгэлтэй цаг
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#16a34a",
                          marginTop: 4,
                        }}
                      >
                        Ирэх цаг: {upcomingAppointments.length}
                      </div>
                    </div>
                  </div>

                  {/* Basic information section (editable) */}
                  <div
                    style={{
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      padding: 16,
                      background: "white",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 12,
                      }}
                    >
                      <h2
                        style={{
                          fontSize: 16,
                          marginTop: 0,
                          marginBottom: 0,
                        }}
                      >
                        Үндсэн мэдээлэл
                      </h2>
                      {!editMode ? (
                        <button
                          type="button"
                          onClick={startEdit}
                          style={{
                            fontSize: 12,
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            background: "#f9fafb",
                            cursor: "pointer",
                          }}
                        >
                          Засах
                        </button>
                      ) : null}
                    </div>

                    {saveError && (
                      <div
                        style={{
                          color: "#b91c1c",
                          fontSize: 12,
                          marginBottom: 8,
                        }}
                      >
                        {saveError}
                      </div>
                    )}
                    {saveSuccess && (
                      <div
                        style={{
                          color: "#16a34a",
                          fontSize: 12,
                          marginBottom: 8,
                        }}
                      >
                        {saveSuccess}
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                        fontSize: 13,
                      }}
                    >
                      {/* Book number and branch (read-only) */}
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Картын дугаар
                        </div>
                        <div>{pb.bookNumber}</div>
                      </div>
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Бүртгэсэн салбар
                        </div>
                        <div>{patient.branch?.name || patient.branchId}</div>
                      </div>

                      {/* Ovog, Name, regNo */}
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Овог
                        </div>
                        {editMode ? (
                          <input
                            name="ovog"
                            value={editForm.ovog ?? ""}
                            onChange={handleEditChange}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                            }}
                          />
                        ) : (
                          <div>{displayOrDash(patient.ovog)}</div>
                        )}
                      </div>
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Нэр
                        </div>
                        {editMode ? (
                          <input
                            name="name"
                            value={editForm.name ?? ""}
                            onChange={handleEditChange}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                            }}
                          />
                        ) : (
                          <div>{patient.name}</div>
                        )}
                      </div>
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          РД
                        </div>
                        {editMode ? (
                          <input
                            name="regNo"
                            value={editForm.regNo ?? ""}
                            onChange={handleEditChange}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                            }}
                          />
                        ) : (
                          <div>{displayOrDash(patient.regNo)}</div>
                        )}
                      </div>

                      {/* Contact info */}
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Утас
                        </div>
                        {editMode ? (
                          <input
                            name="phone"
                            value={editForm.phone ?? ""}
                            onChange={handleEditChange}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                            }}
                          />
                        ) : (
                          <div>{displayOrDash(patient.phone)}</div>
                        )}
                      </div>
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Яаралтай үед холбоо барих утас
                        </div>
                        {editMode ? (
                          <input
                            name="emergencyPhone"
                            value={editForm.emergencyPhone ?? ""}
                            onChange={handleEditChange}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                            }}
                          />
                        ) : (
                          <div>{displayOrDash(patient.emergencyPhone)}</div>
                        )}
                      </div>

                      {/* Dates & demographics */}
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Бүртгэсэн огноо
                        </div>
                        <div>
                          {patient.createdAt
                            ? formatDate(patient.createdAt)
                            : "-"}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Хүйс
                        </div>
                        {editMode ? (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              paddingTop: 2,
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <input
                                type="radio"
                                name="gender"
                                value="эр"
                                checked={editForm.gender === "эр"}
                                onChange={() => handleGenderChange("эр")}
                              />
                              <span>Эр</span>
                            </label>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <input
                                type="radio"
                                name="gender"
                                value="эм"
                                checked={editForm.gender === "эм"}
                                onChange={() => handleGenderChange("эм")}
                              />
                              <span>Эм</span>
                            </label>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <input
                                type="radio"
                                name="gender"
                                value=""
                                checked={!editForm.gender}
                                onChange={() => handleGenderChange("")}
                              />
                              <span>Хоосон</span>
                            </label>
                          </div>
                        ) : (
                          <div>{displayOrDash(patient.gender)}</div>
                        )}
                      </div>
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Төрсөн огноо
                        </div>
                        {editMode ? (
                          <input
                            type="date"
                            name="birthDate"
                            value={editForm.birthDate ?? ""}
                            onChange={handleEditChange}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                            }}
                          />
                        ) : (
                          <div>
                            {patient.birthDate
                              ? formatDate(patient.birthDate)
                              : "-"}
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Цусны бүлэг
                        </div>
                        {editMode ? (
                          <input
                            name="bloodType"
                            value={editForm.bloodType ?? ""}
                            onChange={handleEditChange}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                            }}
                          />
                        ) : (
                          <div>{displayOrDash(patient.bloodType)}</div>
                        )}
                      </div>
                      <div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Иргэншил
                        </div>
                        {editMode ? (
                          <input
                            name="citizenship"
                            value={editForm.citizenship ?? "Монгол"}
                            onChange={handleEditChange}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                            }}
                          />
                        ) : (
                          <div>{displayOrDash(patient.citizenship)}</div>
                        )}
                      </div>

                      {/* Address */}
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Хаяг
                        </div>
                        {editMode ? (
                          <input
                            name="address"
                            value={editForm.address ?? ""}
                            onChange={handleEditChange}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                            }}
                          />
                        ) : (
                          <div>{displayOrDash(patient.address)}</div>
                        )}
                      </div>

                      {/* Notes */}
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>
                          Тэмдэглэл
                        </div>
                        {editMode ? (
                          <textarea
                            name="notes"
                            value={editForm.notes ?? ""}
                            onChange={handleEditChange}
                            rows={3}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                              resize: "vertical",
                            }}
                          />
                        ) : (
                          <div>{displayOrDash(patient.notes)}</div>
                        )}
                      </div>
                    </div>

                    {/* Save / Cancel buttons at bottom when in editMode */}
                    {editMode && (
                      <div
                        style={{
                          marginTop: 16,
                          display: "flex",
                          gap: 8,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            background: "#f9fafb",
                            fontSize: 13,
                            cursor: saving ? "default" : "pointer",
                          }}
                        >
                          Болих
                        </button>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "none",
                            background: saving ? "#9ca3af" : "#2563eb",
                            color: "white",
                            fontSize: 13,
                            cursor: saving ? "default" : "pointer",
                          }}
                        >
                          {saving ? "Хадгалж байна..." : "Хадгалах"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "appointments" && (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    padding: 16,
                    background: "white",
                  }}
                >
                  <h2
                    style={{
                      fontSize: 16,
                      marginTop: 0,
                      marginBottom: 12,
                    }}
                  >
                    Цагууд (бүх бүртгэлтэй цагууд)
                  </h2>
                  {sortedAppointments.length === 0 ? (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Цаг захиалгын бүртгэл алга.
                    </div>
                  ) : (
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                              padding: 6,
                            }}
                          >
                            Огноо / цаг
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                              padding: 6,
                            }}
                          >
                            Салбар ID
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                              padding: 6,
                            }}
                          >
                            Эмч ID
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                              padding: 6,
                            }}
                          >
                            Төлөв
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                              padding: 6,
                            }}
                          >
                            Тэмдэглэл
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAppointments.map((a) => (
                          <tr key={a.id}>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: 6,
                              }}
                            >
                              {formatDateTime(a.scheduledAt)}
                            </td>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: 6,
                              }}
                            >
                              {a.branchId}
                            </td>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: 6,
                              }}
                            >
                              {a.doctorId ?? "-"}
                            </td>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: 6,
                              }}
                            >
                              {a.status}
                            </td>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: 6,
                              }}
                            >
                              {displayOrDash(a.notes ?? null)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === "visit_card" && (
  <div
    style={{
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      padding: 16,
      background: "white",
    }}
  >
    <h2
      style={{
        fontSize: 16,
        marginTop: 0,
        marginBottom: 12,
      }}
    >
      Үзлэгийн карт
    </h2>

    {visitCardLoading && (
      <div style={{ fontSize: 13 }}>Үзлэгийн карт ачааллаж байна...</div>
    )}

    {!visitCardLoading && visitCardError && (
      <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>
        {visitCardError}
      </div>
    )}

    {!visitCardLoading && (
      <>
        {/* 1) Type selector – only when card not yet created */}
        {!visitCard && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: "#f3f4f6",
              fontSize: 13,
            }}
          >
            <div style={{ marginBottom: 8 }}>
              Анхны үзлэгийн карт бөглөх төрөл:
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="visitCardType"
                  value="ADULT"
                  checked={visitCardTypeDraft === "ADULT"}
                  onChange={() => setVisitCardTypeDraft("ADULT")}
                />
                <span>Том хүн</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="visitCardType"
                  value="CHILD"
                  checked={visitCardTypeDraft === "CHILD"}
                  onChange={() => setVisitCardTypeDraft("CHILD")}
                />
                <span>Хүүхэд</span>
              </label>
            </div>
          </div>
        )}

                {/* Урьдчилан сэргийлэх асуумж */}
                <section style={{ marginTop: 8, fontSize: 13 }}>
          <h3
            style={{
              fontSize: 14,
              margin: 0,
              marginBottom: 4,
            }}
          >
            Урьдчилан сэргийлэх асуумж
          </h3>
          <div style={{ marginBottom: 8 }}>
            Та эрүүл мэндийнхээ төлөө доорхи асуултанд үнэн зөв хариулна уу
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Reasons */}
            <div>
              <div
                style={{
                  fontWeight: 500,
                  marginBottom: 8,
                }}
              >
                Таны эмнэлэгт хандах болсон шалтгаан юу вэ?
              </div>

              {([
                ["toothPain", "Шүд өвдсөн"],
                ["toothBroken", "Шүд цоорсон"],
                ["badBite", "Шүд буруу ургасан"],
                // reuse toothDecay for "Ломбо унасан"
                ["toothDecay", "Ломбо унасан"],
                ["preventiveCheck", "Урьдчилан сэргийлэх хяналтанд орох"],
                [
                  "cosmeticSmile",
                  "Гоо сайхны /цайруулах, Hollywood smile гэх мэт/",
                ],
              ] as const).map(([key, label]) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(visitCardAnswers.reasonToVisit?.[key])}
                    onChange={(e) =>
                      updateNested("reasonToVisit", key, e.target.checked)
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}

              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    display: "block",
                    color: "#6b7280",
                    marginBottom: 2,
                  }}
                >
                  Бусад
                </span>
                <input
                  value={visitCardAnswers.reasonToVisit?.other || ""}
                  onChange={(e) =>
                    updateNested("reasonToVisit", "other", e.target.value)
                  }
                  style={{
                    width: "100%",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
              </div>
            </div>

            {/* Q1: Өмнө нь шүдний эмнэлэгт үзүүлж байсан уу? */}
            <div
              style={{
                borderTop: "1px dashed #e5e7eb",
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Өмнө нь шүдний эмнэлэгт үзүүлж байсан уу?
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="radio"
                    name="prevVisit"
                    value="no"
                    checked={
                      visitCardAnswers.previousDentalVisit?.hasVisited === "no"
                    }
                    onChange={() =>
                      updateNested(
                        "previousDentalVisit",
                        "hasVisited",
                        "no"
                      )
                    }
                  />
                  <span>Үгүй</span>
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="radio"
                    name="prevVisit"
                    value="yes"
                    checked={
                      visitCardAnswers.previousDentalVisit?.hasVisited ===
                      "yes"
                    }
                    onChange={() =>
                      updateNested(
                        "previousDentalVisit",
                        "hasVisited",
                        "yes"
                      )
                    }
                  />
                  <span>Тийм</span>
                </label>
              </div>

              {visitCardAnswers.previousDentalVisit?.hasVisited === "yes" && (
                <div>
                  <div
                    style={{ color: "#6b7280", marginBottom: 2 }}
                  >
                    Өмнө үзүүлж байсан эмнэлгийн нэр
                  </div>
                  <input
                    value={
                      visitCardAnswers.previousDentalVisit?.clinicName || ""
                    }
                    onChange={(e) =>
                      updateNested(
                        "previousDentalVisit",
                        "clinicName",
                        e.target.value
                      )
                    }
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Q2: Өмнө шүдний эмчилгээ хийлгэхэд ... */}
            <div>
              <div
                style={{
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Өмнө шүдний эмчилгээ хийлгэхэд ямар нэгэн хүндрэл гарч
                байсан эсэх?
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="radio"
                    name="prevComplication"
                    value="no"
                    checked={
                      !visitCardAnswers.previousDentalVisit
                        ?.reactionOrComplication
                    }
                    onChange={() =>
                      updateNested(
                        "previousDentalVisit",
                        "reactionOrComplication",
                        ""
                      )
                    }
                  />
                  <span>Үгүй</span>
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="radio"
                    name="prevComplication"
                    value="yes"
                    checked={Boolean(
                      visitCardAnswers.previousDentalVisit
                        ?.reactionOrComplication
                    )}
                    onChange={() => {
                      // if switching to Тийм and field is empty, initialize as empty string
                      if (
                        !visitCardAnswers.previousDentalVisit
                          ?.reactionOrComplication
                      ) {
                        updateNested(
                          "previousDentalVisit",
                          "reactionOrComplication",
                          ""
                        );
                      }
                    }}
                  />
                  <span>Тийм</span>
                </label>
              </div>

              {Boolean(
                visitCardAnswers.previousDentalVisit?.reactionOrComplication
              ) && (
                <textarea
                  rows={2}
                  value={
                    visitCardAnswers.previousDentalVisit
                      ?.reactionOrComplication || ""
                  }
                  onChange={(e) =>
                    updateNested(
                      "previousDentalVisit",
                      "reactionOrComplication",
                      e.target.value
                    )
                  }
                  style={{
                    width: "100%",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                    resize: "vertical",
                  }}
                />
              )}
            </div>
          </div>
        
        </section>

        {/* 3) Ерөнхий биеийн талаархи асуумж */}
        <section style={{ marginTop: 16 }}>
          <h3
            style={{
              fontSize: 14,
              margin: 0,
              marginBottom: 8,
            }}
          >
            Ерөнхий биеийн талаархи асуумж
          </h3>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #e5e7eb",
                    padding: 6,
                  }}
                >
                  Асуумж
                </th>
                <th
                  style={{
                    textAlign: "center",
                    borderBottom: "1px solid #e5e7eb",
                    padding: 6,
                    width: 60,
                  }}
                >
                  Үгүй
                </th>
                <th
                  style={{
                    textAlign: "center",
                    borderBottom: "1px solid #e5e7eb",
                    padding: 6,
                    width: 100,
                  }}
                >
                  Тийм
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["heartDisease", "Зүрх судасны өвчтэй эсэх"],
                ["highBloodPressure", "Даралт ихсэх өвчтэй эсэх"],
                ["infectiousDisease", "Халдварт өвчний түүхтэй эсэх"],
                ["tuberculosis", "Сүрьеэ өвчнөөр өвчилж байсан эсэх"],
                ["hepatitisBC", "Халдварт гепатит B, C-сээр өвдөж байсан эсэх"],
                ["diabetes", "Чихрийн шижинтэй эсэх"],
                ["onMedication", "Одоо хэрэглэж байгаа эм, тариа байгаа эсэх"],
                [
                  "seriousIllnessOrSurgery",
                  "Ойрын 5 жилд хүнд өвчнөөр өвчилсөн болон мэс ажилбар хийлгэж байсан эсэх",
                ],
                ["implant", "Зүрхний импланттай эсэх"],
                ["generalAnesthesia", "Бүтэн наркоз хийлгэж байсан эсэх"],
                [
                  "chemoOrRadiation",
                  "Хими / туяа эмчилгээ хийлгэж байгаа эсэх",
                ],
              ].map(([key, label]) => {
                const value = visitCardAnswers.generalMedical?.[
                  key as keyof VisitCardAnswers["generalMedical"]
                ];
                return (
                  <tr key={key}>
                    <td
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        padding: 6,
                      }}
                    >
                      {label}
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        borderBottom: "1px solid #f3f4f6",
                        padding: 6,
                      }}
                    >
                      <input
                        type="radio"
                        name={`gm_${key}`}
                        checked={value === "no"}
                        onChange={() =>
                          updateNested("generalMedical", key, "no")
                        }
                      />
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        borderBottom: "1px solid #f3f4f6",
                        padding: 6,
                      }}
                    >
                      <input
                        type="radio"
                        name={`gm_${key}`}
                        checked={value === "yes"}
                        onChange={() =>
                          updateNested("generalMedical", key, "yes")
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 8 }}>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>
              Дэлгэрэнгүй / бусад тайлбар
            </div>
            <textarea
              rows={2}
              value={visitCardAnswers.generalMedical?.details || ""}
              onChange={(e) =>
                updateNested("generalMedical", "details", e.target.value)
              }
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
                resize: "vertical",
              }}
            />
          </div>
        </section>

        {/* 4) Харшил + Зуршил */}
        <section
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            fontSize: 13,
          }}
        >
          {/* Allergies */}
          <div>
            <h3
              style={{
                fontSize: 14,
                margin: 0,
                marginBottom: 8,
              }}
            >
              Харшил
            </h3>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <tbody>
                {[
                  ["drug", "Эм тариа"],
                  ["metal", "Метал"],
                  ["localAnesthetic", "Шүдний мэдээ алдуулах тариа"],
                  ["latex", "Латекс"],
                  ["other", "Бусад"],
                ].map(([key, label]) => {
                  const value = visitCardAnswers.allergies?.[
                    key as keyof VisitCardAnswers["allergies"]
                  ];
                  return (
                    <tr key={key}>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                        }}
                      >
                        {label}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                          width: 60,
                        }}
                      >
                        <input
                          type="radio"
                          name={`allergy_${key}`}
                          checked={value === "no"}
                          onChange={() =>
                            updateNested("allergies", key, "no")
                          }
                        />
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                          width: 100,
                        }}
                      >
                        <input
                          type="radio"
                          name={`allergy_${key}`}
                          checked={value === "yes"}
                          onChange={() =>
                            updateNested("allergies", key, "yes")
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 4 }}>
              <div style={{ color: "#6b7280", marginBottom: 2 }}>
                Харшлын дэлгэрэнгүй
              </div>
              <textarea
                rows={2}
                value={visitCardAnswers.allergies?.otherDetail || ""}
                onChange={(e) =>
                  updateNested("allergies", "otherDetail", e.target.value)
                }
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                  resize: "vertical",
                }}
              />
            </div>
          </div>

          {/* Habits */}
          <div>
            <h3
              style={{
                fontSize: 14,
                margin: 0,
                marginBottom: 8,
              }}
            >
              Зуршил
            </h3>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <tbody>
                {[
                  ["smoking", "Тамхи татдаг эсэх"],
                  ["alcohol", "Архи хэрэглэдэг эсэх"],
                  ["coffee", "Кофе хэрэглэдэг эсэх"],
                  ["nightGrinding", "Шөнө амаа ангайж унтдаг эсэх"],
                ].map(([key, label]) => {
                  const value = visitCardAnswers.habits?.[
                    key as keyof VisitCardAnswers["habits"]
                  ];
                  return (
                    <tr key={key}>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                        }}
                      >
                        {label}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                          width: 60,
                        }}
                      >
                        <input
                          type="radio"
                          name={`habit_${key}`}
                          checked={value === "no"}
                          onChange={() => updateNested("habits", key, "no")}
                        />
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          borderBottom: "1px solid #f3f4f6",
                          padding: 6,
                          width: 100,
                        }}
                      >
                        <input
                          type="radio"
                          name={`habit_${key}`}
                          checked={value === "yes"}
                          onChange={() => updateNested("habits", key, "yes")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 4 }}>
              <div style={{ color: "#6b7280", marginBottom: 2 }}>Бусад</div>
              <input
                value={visitCardAnswers.habits?.other || ""}
                onChange={(e) =>
                  updateNested("habits", "other", e.target.value)
                }
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                }}
              />
            </div>
          </div>
        </section>

        {/* 5) Гарын үсэг */}
        <section
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px dashed #e5e7eb",
          }}
        >
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            Үйлчлүүлэгч / асран хамгаалагчийн гарын үсэг:
          </div>
          {visitCard?.patientSignaturePath ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <img
                src={visitCard.patientSignaturePath}
                alt="Visit card signature"
                style={{
                  maxWidth: 400,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                }}
              />
              {visitCard.signedAt && (
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  Огноо: {formatDate(visitCard.signedAt)}
                </span>
              )}
            </div>
          ) : (
            <div>
              <SignaturePad
                disabled={signatureSaving}
                onChange={(blob) => void handleUploadSignature(blob)}
              />
              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  marginTop: 4,
                }}
              >
                Таблет, утас эсвэл хулгана ашиглан доор гарын үсэг зурна уу.
              </div>
            </div>
          )}
        </section>

        {/* 6) Save button */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={handleSaveVisitCard}
            disabled={visitCardSaving}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              background: visitCardSaving ? "#9ca3af" : "#2563eb",
              color: "#ffffff",
              fontSize: 13,
              cursor: visitCardSaving ? "default" : "pointer",
            }}
          >
            {visitCardSaving ? "Хадгалж байна..." : "Үзлэгийн карт хадгалах"}
          </button>
        </div>
      </>
    )}
  </div>
)}            </div>
          </section>

          {/* Encounter history and inline appointments table shown only in profile tab */}
          {activeTab === "profile" && (
            <>
              {/* Encounter history table */}
              <section style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, marginBottom: 8 }}>
                  Үзлэгийн түүх (Encounters)
                </h2>
                {encounters.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    Одоогоор бүртгэлтэй үзлэг алга.
                  </div>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #e5e7eb",
                            padding: 6,
                          }}
                        >
                          Огноо
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #e5e7eb",
                            padding: 6,
                          }}
                        >
                          Тэмдэглэл
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {encounters.map((e) => (
                        <tr key={e.id}>
                          <td
                            style={{
                              borderBottom: "1px solid #f3f4f6",
                              padding: 6,
                            }}
                          >
                            {formatDateTime(e.visitDate)}
                          </td>
                          <td
                            style={{
                              borderBottom: "1px solid #f3f4f6",
                              padding: 6,
                            }}
                          >
                            {displayOrDash(e.notes ?? null)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Original appointments list (can be removed later if redundant) */}
              <section>
                <h2 style={{ fontSize: 16, marginBottom: 8 }}>
                  Цаг захиалгууд (Appointments)
                </h2>
                {appointments.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    Цаг захиалгын бүртгэл алга.
                  </div>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #e5e7eb",
                            padding: 6,
                          }}
                        >
                          Огноо / цаг
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #e5e7eb",
                            padding: 6,
                          }}
                        >
                          Салбар ID
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #e5e7eb",
                            padding: 6,
                          }}
                        >
                          Эмч ID
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #e5e7eb",
                            padding: 6,
                          }}
                        >
                          Төлөв
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #e5e7eb",
                            padding: 6,
                          }}
                        >
                          Тэмдэглэл
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments
                        .slice()
                        .sort((a, b) =>
                          a.scheduledAt.localeCompare(b.scheduledAt)
                        )
                        .map((a) => (
                          <tr key={a.id}>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: 6,
                              }}
                            >
                              {formatDateTime(a.scheduledAt)}
                            </td>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: 6,
                              }}
                            >
                              {a.branchId}
                            </td>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: 6,
                              }}
                            >
                              {a.doctorId ?? "-"}
                            </td>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: 6,
                              }}
                            >
                              {a.status}
                            </td>
                            <td
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                padding: 6,
                              }}
                            >
                              {displayOrDash(a.notes ?? null)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

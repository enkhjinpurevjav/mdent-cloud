import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

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

// Normalize possibly-null / "null" / empty strings for display
function displayOrDash(value?: string | null) {
  if (value === undefined || value === null) return "-";
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return "-";
  return trimmed;
}

// Short display name in header: first letter of ovog + "." + name (E.Margad)
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

  // Tabs: "profile" (default) or "appointments"
  const [activeTab, setActiveTab] = useState<"profile" | "appointments">(
    "profile"
  );


    // --- Tab selection: Профайл / Үзлэгийн карт ---
  const [activeTab, setActiveTab] = useState<"PROFILE" | "VISIT_CARD">(
    "PROFILE"
  );

  // --- Visit card state (adult/child form) ---
  const [visitCard, setVisitCard] = useState<VisitCard | null>(null);
  const [visitCardLoading, setVisitCardLoading] = useState(false);
  const [visitCardError, setVisitCardError] = useState("");
  const [visitCardTypeDraft, setVisitCardTypeDraft] =
    useState<VisitCardType | null>(null);
  const [visitCardAnswers, setVisitCardAnswers] = useState<any>({});
  const [visitCardSaving, setVisitCardSaving] = useState(false);
  const [signatureSaving, setSignatureSaving] = useState(false);

  
  // Edit state for Үндсэн мэдээлэл
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Patient>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

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

  const patient = data?.patient;
  const pb = data?.patientBook;
  const encounters = data?.encounters || [];
  const appointments = data?.appointments || [];

  const totalEncounters = encounters.length;
  const lastEncounter = encounters[0];

  const now = new Date();
  const totalAppointments = appointments.length;
  const upcomingAppointments = appointments.filter((a) => {
    const d = new Date(a.scheduledAt);
    if (Number.isNaN(d.getTime())) return false;
    return d > now && a.status === "booked";
  });

  // Initialize edit form from loaded patient when entering edit mode
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

    // Optional front validation for gender
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

      // Update local state with returned patient
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

  // Derived sorted appointments (for the list tab)
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
                  {/* Профайл tab */}
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

                  {/* Цагууд tab – moved directly under Профайл and clickable */}
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

                  {/* Future tabs – still non-functional placeholders */}
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
            </div>
          </section>

          {/* Encounter history and inline appointments table below are still shown only in profile tab */}
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

import React, { useState } from "react";

type Patient = {
  id: number;
  regNo?: string | null;
  ovog?: string | null;
  name: string;
  gender?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  workPlace?: string | null;
};

type PatientBook = {
  id: number;
  bookNumber: string;
};

type VisitCard = {
  id: number;
  type: "ADULT" | "CHILD";
  answers: any;
  signedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type DiagnosisEntry = {
  id: number;
  diagnosisId?: number | null;
  toothCode?: string | null;
  note?: string | null;
  selectedProblemIds?: any;
  diagnosis?: {
    code: string;
    name: string;
  } | null;
  problemTexts?: Array<{
    text: string;
    order: number;
  }>;
  sterilizationIndicators?: Array<{
    indicator: {
      id: number;
      name: string;
      tool?: {
        name: string;
      };
    };
  }>;
};

type EncounterService = {
  id: number;
  serviceId: number;
  quantity: number;
  price: number;
  meta?: any;
  service?: {
    name: string;
  };
  texts?: Array<{
    text: string;
    order: number;
  }>;
};

type Encounter = {
  id: number;
  visitDate: string;
  notes?: string | null;
  doctor?: {
    ovog?: string | null;
    name: string;
  };
  nurse?: {
    ovog?: string | null;
    name: string;
  } | null;
  diagnoses?: DiagnosisEntry[];
  encounterServices?: EncounterService[];
};

type Props = {
  patient: Patient;
  patientBook: PatientBook;
  visitCard?: VisitCard | null;
  encounters: Encounter[];
};

const PatientHistoryBook: React.FC<Props> = ({
  patient,
  patientBook,
  visitCard,
  encounters,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [showHeader, setShowHeader] = useState(true);
  const [showQuestionnaire, setShowQuestionnaire] = useState(true);
  const [showTable, setShowTable] = useState(true);

  // Helper functions
  const displayOrDash = (value?: string | null) => {
    if (value == null || value === "") return "-";
    return value;
  };

  const hasText = (value?: string | null) => {
    return value != null && value.trim() !== "";
  };

  // Label mappings matching the UI exactly
  const REASON_TO_VISIT_LABELS: Record<string, string> = {
    toothPain: "Шүд өвдсөн",
    toothBroken: "Шүд цоорсон",
    badBite: "Шүд буруу ургасан",
    toothDecay: "Ломбо унасан",
    preventiveCheck: "Урьдчилан сэргийлэх хяналтанд орох",
    cosmeticSmile: "Гоо сайхны /цайруулах, Hollywood smile гэх мэт/",
  };

  const GENERAL_MEDICAL_LABELS: Record<string, string> = {
    heartDisease: "Зүрх судасны өвчтэй эсэх",
    highBloodPressure: "Даралт ихсэх өвчтэй эсэх",
    infectiousDisease: "Халдварт өвчний түүхтэй эсэх",
    tuberculosis: "Сүрьеэ өвчнөөр өвчилж байсан эсэх",
    hepatitisBC: "Халдварт гепатит B, C‑сээр өвдөж байсан эсэх",
    diabetes: "Чихрийн шижинтэй эсэх",
    onMedication: "Одоо хэрэглэж байгаа эм, тариа байгаа эсэх",
    seriousIllnessOrSurgery: "Ойрын 5 жилд хүнд өвчнөөр өвчилсөн болон мэс ажилбар хийлгэж байсан эсэх",
    implant: "Зүрхний импланттай эсэх",
    generalAnesthesia: "Бүтэн наркоз хийлгэж байсан эсэх",
    chemoOrRadiation: "Хими / туяа эмчилгээ хийлгэж байгаа эсэх",
  };

  const ALLERGIES_LABELS: Record<string, string> = {
    drug: "Эм тариа",
    metal: "Метал",
    localAnesthetic: "Шүдний мэдээ алдуулах тариа",
    latex: "Латекс",
    other: "Бусад",
  };

  const HABITS_LABELS: Record<string, string> = {
    smoking: "Тамхи татдаг эсэх",
    alcohol: "Архи хэрэглэдэг эсэх",
    coffee: "Кофе хэрэглэдэг эсэх",
    nightGrinding: "Шөнө шүдээ хавирдаг эсэх",
    mouthBreathing: "Ам ангайж унтдаг / амаар амьсгалдаг эсэх",
    other: "Бусад",
  };

  const DENTAL_FOLLOWUP_LABELS: Record<string, string> = {
    regularCheckups: "Шүдний эмчид байнга үзүүлдэг эсэх",
    bleedingAfterExtraction: "Шүд авахуулсны дараа цус тогтол удаан эсэх",
    gumBleeding: "Буйлнаас цус гардаг эсэх",
    badBreath: "Амнаас эвгүй үнэр гардаг эсэх",
  };

  const collectYesFindings = (answers: any): Array<{ label: string; detail?: string }> => {
    const findings: Array<{ label: string; detail?: string }> = [];
    
    // General Medical section - using UI labels
    const generalMed = answers.generalMedical || {};
    Object.keys(GENERAL_MEDICAL_LABELS).forEach((key) => {
      if (generalMed[key] === "yes") {
        const detailKey = `${key}Detail`;
        findings.push({ 
          label: GENERAL_MEDICAL_LABELS[key], 
          detail: generalMed[detailKey] || generalMed.details || ""
        });
      }
    });

    // Allergies section - using UI labels
    const allergies = answers.allergies || {};
    Object.keys(ALLERGIES_LABELS).forEach((key) => {
      if (allergies[key] === "yes") {
        const detailKey = key === "other" ? "otherDetail" : `${key}Detail`;
        findings.push({ 
          label: ALLERGIES_LABELS[key], 
          detail: allergies[detailKey] || ""
        });
      }
    });

    // Habits section - using UI labels
    const habits = answers.habits || {};
    Object.keys(HABITS_LABELS).forEach((key) => {
      if (habits[key] === "yes") {
        const detailKey = key === "other" ? "otherDetail" : `${key}Detail`;
        findings.push({ 
          label: HABITS_LABELS[key], 
          detail: habits[detailKey] || ""
        });
      }
    });

    // Dental followup section - using UI labels
    const dentalFollowup = answers.dentalFollowup || {};
    Object.keys(DENTAL_FOLLOWUP_LABELS).forEach((key) => {
      if (dentalFollowup[key] === "yes") {
        const detailKey = `${key}Detail`;
        findings.push({ 
          label: DENTAL_FOLLOWUP_LABELS[key], 
          detail: dentalFollowup[detailKey] || ""
        });
      }
    });

    return findings;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
  };

  const calculateAge = (birthDate?: string | null) => {
    if (!birthDate) return "-";
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return "-";
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : "-";
  };

  const getInitials = (ovog?: string | null, name?: string) => {
    if (!name) return "";
    const firstLetter = ovog ? ovog.charAt(0).toUpperCase() : "";
    return firstLetter ? `${firstLetter}.${name}` : name;
  };

  const getCardFillDate = () => {
    if (visitCard?.signedAt) {
      return formatDate(visitCard.signedAt);
    }
    if (visitCard?.updatedAt) {
      return formatDate(visitCard.updatedAt);
    }
    if (visitCard?.createdAt) {
      return formatDate(visitCard.createdAt);
    }
    return "-";
  };

  // Filter encounters by date range
  const filteredEncounters = encounters.filter((enc) => {
    if (!filterStartDate && !filterEndDate) return true;
    const encDate = new Date(enc.visitDate);
    if (filterStartDate) {
      const start = new Date(filterStartDate);
      if (encDate < start) return false;
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      if (encDate > end) return false;
    }
    return true;
  });

  // Build diagnosis rows (one row per diagnosis entry)
  const diagnosisRows: Array<{
    date: string;
    toothCode: string;
    complaints: string[];
    diagnosis: string;
    treatment: string[];
    indicators: string[];
    note: string;
    doctorNurse: string;
  }> = [];

  filteredEncounters.forEach((enc) => {
    const diagnoses = enc.diagnoses || [];
    const services = enc.encounterServices || [];

    diagnoses.forEach((diag) => {
      // Tooth code
      const toothCode = diag.toothCode || "-";

      // Complaints (from problemTexts)
      const complaints = (diag.problemTexts || [])
        .sort((a, b) => a.order - b.order)
        .map((pt) => pt.text);

      // Diagnosis code only (strip description)
      let diagnosisCode = "-";
      if (diag.diagnosis?.code) {
        // Split on various dash types (hyphen, en-dash, em-dash) and take first part
        diagnosisCode = diag.diagnosis.code.split(/[-–—]/)[0].trim();
      }

      // Treatment lines (services assigned to this diagnosis)
      const diagServices = services.filter(
        (svc) => svc.meta?.diagnosisId === diag.id
      );
      const treatment: string[] = [];
      diagServices.forEach((svc) => {
        if (svc.texts && svc.texts.length > 0) {
          svc.texts
            .sort((a, b) => a.order - b.order)
            .forEach((t) => treatment.push(t.text));
        }
      });

      // Indicators (sterilization tools)
      const indicators = (diag.sterilizationIndicators || []).map((si) => {
        const toolName = si.indicator.tool?.name || "";
        const indicatorName = si.indicator.name || "";
        return toolName ? `${toolName}/${indicatorName}` : indicatorName;
      });

      // Note
      const note = diag.note || "";

      // Doctor and nurse initials
      const doctorInitials = enc.doctor
        ? getInitials(enc.doctor.ovog, enc.doctor.name)
        : "";
      const nurseInitials = enc.nurse
        ? getInitials(enc.nurse.ovog, enc.nurse.name)
        : "";
      const doctorNurse =
        doctorInitials && nurseInitials
          ? `${doctorInitials} / ${nurseInitials}`
          : doctorInitials || nurseInitials || "-";

      diagnosisRows.push({
        date: formatDate(enc.visitDate),
        toothCode,
        complaints,
        diagnosis: diagnosisCode,
        treatment,
        indicators,
        note,
        doctorNurse,
      });
    });
  });

  // Get questionnaire data
  const answers = visitCard?.answers || {};

  const renderQuestionnaireSection = () => {
    if (!visitCard) {
      return (
        <div style={{ color: "#6b7280", fontSize: 13, marginTop: 16 }}>
          Үзлэгийн карт бөглөөгүй байна.
        </div>
      );
    }

    const isAdult = visitCard.type === "ADULT";

    // Build reason to visit bullet list
    const reasonBullets: string[] = [];
    const reasonToVisit = answers.reasonToVisit || {};
    
    Object.keys(REASON_TO_VISIT_LABELS).forEach((key) => {
      if (reasonToVisit[key]) {
        reasonBullets.push(REASON_TO_VISIT_LABELS[key]);
      }
    });
    
    if (hasText(reasonToVisit.other)) {
      reasonBullets.push(`Бусад: ${reasonToVisit.other}`);
    }

    // Previous dental visit
    const prevDental = answers.previousDentalVisit || {};

    // Collect all YES findings
    const yesFindings = collectYesFindings(answers);

    return (
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 8,
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 4,
          }}
        >
          УРЬДЧИЛАН СЭРГИЙЛЭХ АСУУМЖ
        </div>
        
        {/* Reason to visit - bullet format */}
        {reasonBullets.length > 0 && (
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Таны эмнэлэгт хандах болсон шалтгаан юу вэ?
            </div>
            {reasonBullets.map((reason, idx) => (
              <div key={idx}>• {reason}</div>
            ))}
          </div>
        )}
        
        {/* Previous dental visit section - only show if hasVisited is yes */}
        {prevDental.hasVisited === "yes" && (
          <>
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              • Өмнө нь шүдний эмнэлэгт үзүүлж байсан: Тийм
            </div>
            {hasText(prevDental.clinicName) && (
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                • Өмнө үзүүлж байсан эмнэлгийн нэр: {prevDental.clinicName}
              </div>
            )}
          </>
        )}

        {/* Complication section - NOT nested under hasVisited */}
        {prevDental.hadComplication === "yes" && (
          <>
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              • Өмнө шүдний эмчилгээ хийхэд хүндрэл гарч байсан: Тийм
            </div>
            {hasText(prevDental.reactionOrComplication) && (
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                • Тайлбар: {prevDental.reactionOrComplication}
              </div>
            )}
          </>
        )}

        {/* Dentist attention notes - only if has text */}
        {hasText(answers.dentistAttentionNotes) && (
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            • Шүдний эмчилгээний үед эмчийн зүгээс анхаарах зүйлс: {answers.dentistAttentionNotes}
          </div>
        )}

        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginTop: 16,
            marginBottom: 8,
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 4,
          }}
        >
          ЕРӨНХИЙ БИЕИЙН ТАЛААРХИ АСУУМЖ
        </div>
        <div style={{ fontSize: 12 }}>
          {yesFindings.length > 0 ? (
            yesFindings.map((finding, idx) => (
              <div key={idx}>
                • {finding.label}: Тийм
                {hasText(finding.detail) && ` - ${finding.detail}`}
              </div>
            ))
          ) : (
            <div style={{ color: "#6b7280" }}>Мэдээлэл ороогүй байна.</div>
          )}
        </div>

        {answers.mainComplaint && (
          <div style={{ fontSize: 12, marginTop: 12 }}>
            <strong>Гол гомдол:</strong> {answers.mainComplaint}
          </div>
        )}
        {answers.pastHistory && (
          <div style={{ fontSize: 12, marginTop: 4 }}>
            <strong>Өмнөх түүх:</strong> {answers.pastHistory}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Print and filter controls (hide in print) */}
      <div className="no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            🖨 Хэвлэх
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: "8px 16px",
              background: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {showFilters ? "Шүүлтүүр хаах" : "Шүүлтүүр нээх"}
          </button>
        </div>

        {showFilters && (
          <div
            style={{
              padding: 12,
              background: "#f9fafb",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Шүүлтүүр
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <label
                  style={{ fontSize: 12, color: "#6b7280", display: "block" }}
                >
                  Эхлэх огноо:
                </label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "4px 6px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>
              <div>
                <label
                  style={{ fontSize: 12, color: "#6b7280", display: "block" }}
                >
                  Дуусах огноо:
                </label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "4px 6px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>
            </div>
            <div style={{ fontSize: 12 }}>
              <label style={{ display: "block", marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={showHeader}
                  onChange={(e) => setShowHeader(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Толгой хэсэг харуулах
              </label>
              <label style={{ display: "block", marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={showQuestionnaire}
                  onChange={(e) => setShowQuestionnaire(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Асуумж харуулах
              </label>
              <label style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={showTable}
                  onChange={(e) => setShowTable(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Онош эмчилгээний хүснэгт харуулах
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Printable content */}
      <div
        className="printable-content"
        style={{
          background: "white",
          padding: 24,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        {showHeader && (
          <>
            {/* Logo and header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                marginBottom: 16,
              }}
            >
              <img
                src="/clinic-logo.png"
                alt="Clinic Logo"
                onError={(e) => {
                  // Fallback to placeholder if logo fails to load
                  e.currentTarget.style.display = 'none';
                  const placeholder = document.createElement('div');
                  placeholder.style.cssText = 'width:100px;height:100px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#6b7280;text-align:center;margin-right:16px;';
                  placeholder.textContent = 'CLINIC LOGO';
                  e.currentTarget.parentElement?.insertBefore(placeholder, e.currentTarget);
                }}
                style={{
                  width: 100,
                  height: "auto",
                  marginRight: 16,
                  objectFit: "contain",
                }}
              />
              <div style={{ flex: 1 }}>
                <h1
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    margin: 0,
                    marginBottom: 8,
                  }}
                >
                  ҮЙЛЧЛҮҮЛЭГЧИЙН КАРТ
                </h1>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <strong>Он/Сар/Өдөр:</strong> {getCardFillDate()}
                  </div>
                  <div>
                    <strong>Дугаар:</strong> {patientBook.bookNumber}
                  </div>
                </div>
              </div>
            </div>

            {/* Patient information grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 8,
                fontSize: 12,
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: "2px solid #e5e7eb",
              }}
            >
              <div>
                <strong>Овог, нэр:</strong>{" "}
                {patient.ovog
                  ? `${patient.ovog} ${patient.name}`
                  : patient.name}
              </div>
              <div>
                <strong>Төрсөн он/сар/өдөр:</strong>{" "}
                {formatDate(patient.birthDate)}
              </div>
              <div>
                <strong>Регистрийн дугаар:</strong> {patient.regNo || "-"}
              </div>
              <div>
                <strong>Хүйс:</strong> {patient.gender || "-"}
              </div>
              <div>
                <strong>Нас:</strong> {calculateAge(patient.birthDate)}
              </div>
              <div>
                <strong>Утасны дугаар:</strong> {patient.phone || "-"}
              </div>
              <div>
                <strong>E-mail:</strong> {displayOrDash(patient.email)}
              </div>
              <div>
                <strong>Гэрийн хаяг:</strong> {displayOrDash(patient.address)}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <strong>Ажлын газар:</strong> {displayOrDash(patient.workPlace)}
              </div>
            </div>
          </>
        )}

        {/* Questionnaire sections */}
        {showQuestionnaire && renderQuestionnaireSection()}

        {/* Diagnosis/Treatment table */}
        {showTable && diagnosisRows.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              ОНОШ ЭМЧИЛГЭЭНИЙ БҮРТГЭЛ
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10,
                border: "1px solid #000",
              }}
            >
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px 6px",
                      textAlign: "left",
                      fontWeight: 600,
                      width: "8%",
                    }}
                  >
                    Он/сар/өдөр
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px 6px",
                      textAlign: "left",
                      fontWeight: 600,
                      width: "8%",
                    }}
                  >
                    Шүдний дугаар
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px 6px",
                      textAlign: "left",
                      fontWeight: 600,
                      width: "18%",
                    }}
                  >
                    Бодит үзлэг, зовиур
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px 6px",
                      textAlign: "left",
                      fontWeight: 600,
                      width: "8%",
                    }}
                  >
                    Онош
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px 6px",
                      textAlign: "left",
                      fontWeight: 600,
                      width: "20%",
                    }}
                  >
                    Эмчилгээ
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px 6px",
                      textAlign: "left",
                      fontWeight: 600,
                      width: "12%",
                    }}
                  >
                    Индикатор
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px 6px",
                      textAlign: "left",
                      fontWeight: 600,
                      width: "14%",
                    }}
                  >
                    Тэмдэглэл
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px 6px",
                      textAlign: "left",
                      fontWeight: 600,
                      width: "12%",
                    }}
                  >
                    Эмч болон сувилагч
                  </th>
                </tr>
              </thead>
              <tbody>
                {diagnosisRows.map((row, idx) => (
                  <tr key={idx}>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px 6px",
                        verticalAlign: "top",
                      }}
                    >
                      {row.date}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px 6px",
                        verticalAlign: "top",
                      }}
                    >
                      {row.toothCode}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px 6px",
                        verticalAlign: "top",
                      }}
                    >
                      {row.complaints.map((c, i) => (
                        <div key={i}>{c}</div>
                      ))}
                      {row.complaints.length === 0 && "-"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px 6px",
                        verticalAlign: "top",
                      }}
                    >
                      {row.diagnosis}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px 6px",
                        verticalAlign: "top",
                      }}
                    >
                      {row.treatment.map((t, i) => (
                        <div key={i}>{t}</div>
                      ))}
                      {row.treatment.length === 0 && "-"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px 6px",
                        verticalAlign: "top",
                      }}
                    >
                      {row.indicators.map((ind, i) => (
                        <div key={i}>{ind}</div>
                      ))}
                      {row.indicators.length === 0 && "-"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px 6px",
                        verticalAlign: "top",
                      }}
                    >
                      {row.note || "-"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px 6px",
                        verticalAlign: "top",
                      }}
                    >
                      {row.doctorNurse}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showTable && diagnosisRows.length === 0 && (
          <div
            style={{
              marginTop: 24,
              color: "#6b7280",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Онош эмчилгээний бүртгэл алга.
          </div>
        )}
      </div>

      {/* Print styles */}
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .printable-content {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          img {
            max-width: 100px;
            height: auto;
            display: block;
          }
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>
    </div>
  );
};

export default PatientHistoryBook;

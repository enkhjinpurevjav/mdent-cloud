import React from "react";
import Link from "next/link";
import type { Encounter, Branch, WarningLine } from "../../types/encounter-admin";
import { formatPatientName, formatDoctorDisplayName, formatStaffName } from "../../utils/name-formatters";
import { formatShortDate } from "../../utils/date-formatters";
import { displayOrDash } from "../../utils/display-helpers";

type PatientHeaderProps = {
  encounter: Encounter;
  warningLines: WarningLine[];
  nursesForEncounter: {
    nurseId: number;
    name?: string | null;
    ovog?: string | null;
    email: string;
    phone?: string | null;
    schedules: {
      id: number;
      date: string;
      branch: Branch;
      startTime: string;
      endTime: string;
      note?: string | null;
    }[];
  }[];
  changingNurse: boolean;
  onChangeNurse: (nurseIdStr: string) => void;
};

export default function PatientHeader({
  encounter,
  warningLines,
  nursesForEncounter,
  changingNurse,
  onChangeNurse,
}: PatientHeaderProps) {
  const bookNumber = encodeURIComponent(encounter.patientBook.bookNumber);

  const navItems = [
    { label: "Профайл", href: `/patients/${bookNumber}?tab=profile` },
    { label: "Үйлчлүүлэгчийн карт", href: `/patients/${bookNumber}?tab=patient_history` },
    { label: "Цагууд", href: `/patients/${bookNumber}?tab=appointments` },
    { label: "Карт бөглөх", href: `/patients/${bookNumber}?tab=visit_card` },
    { label: "Гажиг заслын карт", href: `/patients/${bookNumber}?tab=ortho_card` },
  ];
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: 16,
          background: "#ffffff",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          {formatPatientName(encounter.patientBook.patient)}
        </div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Картын дугаар: {encounter.patientBook.bookNumber}
        </div>
        {encounter.patientBook.patient.regNo && (
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            РД: {encounter.patientBook.patient.regNo}
          </div>
        )}
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Утас: {displayOrDash(encounter.patientBook.patient.phone)}
        </div>
        <div
          style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}
        >
          Бүртгэсэн салбар:{" "}
          {encounter.patientBook.patient.branch?.name ||
            encounter.patientBook.patient.branchId}
        </div>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            marginTop: 4,
          }}
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                fontSize: 12,
                color: "#374151",
                textDecoration: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "#eff6ff";
                (e.currentTarget as HTMLAnchorElement).style.color = "#1d4ed8";
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "#bfdbfe";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "#f9fafb";
                (e.currentTarget as HTMLAnchorElement).style.color = "#374151";
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "#e5e7eb";
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div
        style={{
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: 16,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div>
          <div
            style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}
          >
            Огноо
          </div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            {formatShortDate(encounter.visitDate)}
          </div>
        </div>

        <div>
          <div
            style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}
          >
            Эмч
          </div>
          <div style={{ fontSize: 14 }}>
            {formatDoctorDisplayName(encounter.doctor)}
          </div>
        </div>

        <div>
          <div
            style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}
          >
            Сувилагч
          </div>
          <select
            value={encounter.nurseId || ""}
            onChange={(e) => onChangeNurse(e.target.value)}
            disabled={changingNurse}
            style={{
              width: "100%",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "4px 6px",
              fontSize: 13,
            }}
          >
            <option value="">Сонгоогүй</option>
            {nursesForEncounter.map((n) => (
              <option key={n.nurseId} value={n.nurseId}>
                {formatStaffName({
                  name: n.name || undefined,
                  ovog: n.ovog || undefined,
                  email: n.email,
                })}
              </option>
            ))}
          </select>
        </div>

        {warningLines.length > 0 && (
          <div
            style={{
              marginTop: 4,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #f97316",
              background: "#fff7ed",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#b91c1c",
                marginBottom: 4,
              }}
            >
              Анхаарах!
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                fontSize: 12,
                color: "#7f1d1d",
              }}
            >
              {warningLines.map((w, idx) => (
                <li key={`${w.label}-${idx}`} style={{ marginBottom: 2 }}>
                  {w.label} ({w.value})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

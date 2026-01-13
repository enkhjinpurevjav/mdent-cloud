import React from "react";
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
  onNavigateToPatient: () => void;
  onNavigateToVisitCard: () => void;
  onNavigateToOrtho: () => void;
  onNavigateToPreviousEncounters: () => void;
};

export default function PatientHeader({
  encounter,
  warningLines,
  nursesForEncounter,
  changingNurse,
  onChangeNurse,
  onNavigateToPatient,
  onNavigateToVisitCard,
  onNavigateToOrtho,
  onNavigateToPreviousEncounters,
}: PatientHeaderProps) {
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

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onNavigateToPatient}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Үйлчлүүлэгчийн дэлгэрэнгүй
          </button>

          <button
            type="button"
            onClick={onNavigateToVisitCard}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#f0f9ff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Үйлчлүүлэгчийн карт
          </button>

          <button
            type="button"
            onClick={onNavigateToOrtho}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#fef3c7",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Гажиг заслын карт
          </button>

          <button
            type="button"
            onClick={onNavigateToPreviousEncounters}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#f3e8ff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Өмнөх үзлэгүүд
          </button>
        </div>
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

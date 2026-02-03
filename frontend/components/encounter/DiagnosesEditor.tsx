import React from "react";
import type {
  EditableDiagnosis,
  Diagnosis,
  DiagnosisProblem,
  Service,
  ActiveIndicator,
  AssignedTo,
} from "../../types/encounter-admin";

type DiagnosesEditorProps = {
  rows: EditableDiagnosis[];
  diagnoses: Diagnosis[];
  services: Service[];
  activeIndicators: ActiveIndicator[];
  problemsByDiagnosis: Record<number, DiagnosisProblem[]>;
  dxError: string;
  servicesLoadError: string;
  saveError: string;
  saving: boolean;
  finishing: boolean;
  prescriptionSaving: boolean;
  openDxIndex: number | null;
  openServiceIndex: number | null;
  openIndicatorIndex: number | null;
  activeDxRowIndex: number | null;
  totalDiagnosisServicesPrice: number;
  onDiagnosisChange: (index: number, diagnosisId: number) => Promise<void>;
  onToggleProblem: (index: number, problemId: number) => void;
  onNoteChange: (index: number, value: string) => void;
  onToothCodeChange: (index: number, value: string) => void;
  onRemoveRow: (index: number) => void;
  onUnlockRow: (index: number) => void;
  onLockRow: (index: number) => void;
  onSetOpenDxIndex: (index: number | null) => void;
  onSetOpenServiceIndex: (index: number | null) => void;
  onSetOpenIndicatorIndex: (index: number | null) => void;
  onSetActiveDxRowIndex: (index: number | null) => void;
  onUpdateRowField: <K extends keyof EditableDiagnosis>(
    index: number,
    field: K,
    value: EditableDiagnosis[K]
  ) => void;
  onSave: () => Promise<void>;
  onFinish: () => Promise<void>;
  onResetToothSelection: () => void;
};

export default function DiagnosesEditor({
  rows,
  diagnoses,
  services,
  activeIndicators,
  problemsByDiagnosis,
  dxError,
  servicesLoadError,
  saveError,
  saving,
  finishing,
  prescriptionSaving,
  openDxIndex,
  openServiceIndex,
  openIndicatorIndex,
  activeDxRowIndex,
  totalDiagnosisServicesPrice,
  onDiagnosisChange,
  onToggleProblem,
  onNoteChange,
  onToothCodeChange,
  onRemoveRow,
  onUnlockRow,
  onLockRow,
  onSetOpenDxIndex,
  onSetOpenServiceIndex,
  onSetOpenIndicatorIndex,
  onSetActiveDxRowIndex,
  onUpdateRowField,
  onSave,
  onFinish,
  onResetToothSelection,
}: DiagnosesEditorProps) {
  return (
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
          const problems = problemsByDiagnosis[row.diagnosisId ?? 0] || [];
          const isLocked = row.locked ?? false;
          const selectedService = row.serviceId
            ? services.find((s) => s.id === row.serviceId)
            : null;
          const isImaging = selectedService?.category === "IMAGING";

          return (
            <div
              key={index}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                background: isLocked ? "#fef3c7" : "#f9fafb",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  marginBottom: 8,
                }}
              >
                {isLocked && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                      padding: "6px 10px",
                      background: "#fef08a",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#854d0e",
                    }}
                  >
                    <span>🔒 Түгжсэн</span>
                    <button
                      type="button"
                      onClick={() => onUnlockRow(index)}
                      style={{
                        marginLeft: "auto",
                        padding: "4px 12px",
                        borderRadius: 4,
                        border: "1px solid #ca8a04",
                        background: "#ffffff",
                        color: "#ca8a04",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      Түгжээ тайлах
                    </button>
                  </div>
                )}
                {!isLocked && row.id && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginBottom: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onLockRow(index)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 4,
                        border: "1px solid #9ca3af",
                        background: "#ffffff",
                        color: "#6b7280",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      🔒 Түгжих
                    </button>
                  </div>
                )}
                
                {/* Diagnosis search */}
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
                        if (isLocked) return;
                        const text = e.target.value;
                        onSetOpenDxIndex(index);
                        onUpdateRowField(index, "searchText", text);
                        if (!text.trim()) {
                          onUpdateRowField(index, "diagnosisId", null);
                          onUpdateRowField(index, "diagnosis", undefined);
                          onUpdateRowField(index, "selectedProblemIds", []);
                        }
                      }}
                      onFocus={() => {
                        if (!isLocked) onSetOpenDxIndex(index);
                      }}
                      onBlur={() => {
                        setTimeout(() => onSetOpenDxIndex(null), 150);
                      }}
                      disabled={isLocked}
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "6px 8px",
                        fontSize: 13,
                        background: isLocked ? "#f3f4f6" : "#ffffff",
                        cursor: isLocked ? "not-allowed" : "text",
                        opacity: isLocked ? 0.6 : 1,
                      }}
                    />

                    {openDxIndex === index && diagnoses.length > 0 && (
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
                        {diagnoses
                          .filter((d) => {
                            const q = (row.searchText || "").toLowerCase();
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
                                await onDiagnosisChange(index, d.id);
                                onSetOpenDxIndex(null);
                              }}
                              style={{
                                padding: "6px 8px",
                                cursor: "pointer",
                                borderBottom: "1px solid #f3f4f6",
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
                    onClick={() => onRemoveRow(index)}
                    disabled={isLocked}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #dc2626",
                      background: isLocked ? "#f3f4f6" : "#fef2f2",
                      color: isLocked ? "#9ca3af" : "#b91c1c",
                      cursor: isLocked ? "not-allowed" : "pointer",
                      fontSize: 12,
                      height: 32,
                      alignSelf: "flex-start",
                      opacity: isLocked ? 0.5 : 1,
                    }}
                  >
                    Устгах
                  </button>
                </div>
              </div>

              {/* Problems selection */}
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
                          row.selectedProblemIds?.includes(p.id);
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
                              background: checked ? "#dcfce7" : "#ffffff",
                              fontSize: 12,
                              cursor: isLocked ? "not-allowed" : "pointer",
                              opacity: isLocked ? 0.6 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleProblem(index, p.id)}
                              disabled={isLocked}
                              style={{
                                cursor: isLocked ? "not-allowed" : "pointer",
                              }}
                            />
                            {p.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : null}

              {/* Tooth code */}
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
                  placeholder="Шүдний код (ж: 11, 21, 22)"
                  value={row.toothCode || ""}
                  onChange={(e) => onToothCodeChange(index, e.target.value)}
                  onFocus={() => {
                    if (!row.locked) onSetActiveDxRowIndex(index);
                  }}
                  disabled={isLocked}
                  style={{
                    maxWidth: 260,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                    fontSize: 12,
                    background: isLocked ? "#f3f4f6" : "#ffffff",
                    cursor: isLocked ? "not-allowed" : "text",
                    opacity: isLocked ? 0.6 : 1,
                  }}
                />
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  Шүдний диаграмаас автоматаар бөглөгдөнө, засах боломжтой.
                </span>
              </div>

              {/* Service search */}
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
                      if (isLocked) return;
                      const text = e.target.value;
                      onSetOpenServiceIndex(index);
                      onUpdateRowField(index, "serviceSearchText", text);
                      if (!text.trim()) {
                        onUpdateRowField(index, "serviceId", undefined);
                      }
                    }}
                    onFocus={() => {
                      if (!isLocked) onSetOpenServiceIndex(index);
                    }}
                    disabled={isLocked}
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "6px 8px",
                      fontSize: 13,
                      background: isLocked ? "#f3f4f6" : "#ffffff",
                      cursor: isLocked ? "not-allowed" : "text",
                      opacity: isLocked ? 0.6 : 1,
                    }}
                  />

                  {services.length > 0 &&
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
                        {services
                          .filter((svc) => {
                            const q = (
                              row.serviceSearchText || ""
                            ).toLowerCase();
                            if (!q.trim()) return true;
                            const hay = `${svc.code || ""} ${
                              svc.name
                            }`.toLowerCase();
                            return hay.includes(q);
                          })
                          .slice(0, 50)
                          .map((svc) => (
                            <div
                              key={svc.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const nextAssignedTo: AssignedTo | undefined =
                                  svc.category === "IMAGING"
                                    ? (row.assignedTo ?? "DOCTOR")
                                    : undefined;

                                onUpdateRowField(index, "serviceId", svc.id);
                                onUpdateRowField(
                                  index,
                                  "serviceSearchText",
                                  svc.name
                                );
                                onUpdateRowField(
                                  index,
                                  "assignedTo",
                                  nextAssignedTo
                                );
                                onSetOpenServiceIndex(null);
                              }}
                              style={{
                                padding: "6px 8px",
                                cursor: "pointer",
                                borderBottom: "1px solid #f3f4f6",
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
                                {svc.price.toLocaleString("mn-MN")}₮
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                </div>
              </div>

              {/* Imaging assignedTo selector */}
              {isImaging && (
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    Зураг авах оноох:
                  </span>

                  <label
                    style={{
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="radio"
                      name={`assignedTo-${index}`}
                      disabled={isLocked}
                      checked={(row.assignedTo ?? "DOCTOR") === "DOCTOR"}
                      onChange={() => {
                        if (isLocked) return;
                        onUpdateRowField(index, "assignedTo", "DOCTOR");
                      }}
                    />
                    Эмч
                  </label>

                  <label
                    style={{
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="radio"
                      name={`assignedTo-${index}`}
                      disabled={isLocked}
                      checked={row.assignedTo === "NURSE"}
                      onChange={() => {
                        if (isLocked) return;
                        onUpdateRowField(index, "assignedTo", "NURSE");
                      }}
                    />
                    Сувилагч
                  </label>

                  {/* Badge showing "Бүх шүд" for imaging services */}
                  <div
                    style={{
                      padding: "4px 10px",
                      background: "#fef3c7",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#92400e",
                    }}
                  >
                    🦷 Бүх шүд
                  </div>
                </div>
              )}

              {/* Sterilization indicators */}
              <div style={{ marginBottom: 8, position: "relative" }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                  Ариутгалын багц (идэвхитэй индикатор)
                </div>

                {/* Selected indicators list */}
                {(row.indicatorIds || []).length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    {(row.indicatorIds || []).map((iid, k) => {
                      const ind = activeIndicators.find((x) => x.id === iid);
                      const label = ind
                        ? `${ind.packageName} ${ind.code}`
                        : `#${iid}`;
                      return (
                        <div
                          key={`${iid}-${k}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            fontSize: 12,
                            opacity: isLocked ? 0.6 : 1,
                          }}
                        >
                          <span>{label}</span>
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => {
                                const newIndicatorIds = (
                                  row.indicatorIds || []
                                ).filter((_, idx) => idx !== k);
                                onUpdateRowField(
                                  index,
                                  "indicatorIds",
                                  newIndicatorIds
                                );
                              }}
                              style={{
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                                color: "#dc2626",
                                fontWeight: 700,
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Indicator search input */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div
                    style={{ position: "relative", minWidth: 260, flex: "0 0 auto" }}
                  >
                    <input
                      placeholder="Багцын нэр эсвэл кодоор хайх..."
                      value={row.indicatorSearchText ?? ""}
                      onChange={(e) => {
                        if (isLocked) return;
                        const text = e.target.value;
                        onSetOpenIndicatorIndex(index);
                        onUpdateRowField(index, "indicatorSearchText", text);
                      }}
                      onFocus={() => {
                        if (!isLocked) onSetOpenIndicatorIndex(index);
                      }}
                      onBlur={() => {
                        setTimeout(() => onSetOpenIndicatorIndex(null), 150);
                      }}
                      disabled={isLocked}
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        padding: "6px 8px",
                        fontSize: 13,
                        background: isLocked ? "#f3f4f6" : "#ffffff",
                        cursor: isLocked ? "not-allowed" : "text",
                        opacity: isLocked ? 0.6 : 1,
                      }}
                    />

                    {openIndicatorIndex === index && (
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
                        {activeIndicators
                          .filter((it) => {
                            const q = (row.indicatorSearchText || "")
                              .toLowerCase()
                              .trim();
                            if (!q) return true;
                            const hay = `${it.packageName} ${it.code}`.toLowerCase();
                            return hay.includes(q);
                          })
                          .slice(0, 200)
                          .map((it) => (
                            <div
                              key={it.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const next = [...(row.indicatorIds || []), it.id];
                                onUpdateRowField(index, "indicatorIds", next);
                                onUpdateRowField(index, "indicatorSearchText", "");
                                onSetOpenIndicatorIndex(null);
                              }}
                              style={{
                                padding: "6px 8px",
                                cursor: "pointer",
                                borderBottom: "1px solid #f3f4f6",
                                background: "white",
                              }}
                            >
                              <div style={{ fontWeight: 500 }}>
                                {it.packageName} — {it.code}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#6b7280",
                                  marginTop: 2,
                                }}
                              >
                                Үлдэгдэл: {it.current} (нийт {it.produced}, ашигласан{" "}
                                {it.used})
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      if (isLocked) return;
                      onSetOpenIndicatorIndex(index);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      background: "#ffffff",
                      cursor: isLocked ? "not-allowed" : "pointer",
                      opacity: isLocked ? 0.6 : 1,
                      fontWeight: 700,
                    }}
                  >
                    +
                  </button>
                </div>

                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  * Зөвхөн тухайн өвчтөний салбарын идэвхитэй индикаторууд
                  харагдана.
                </div>
              </div>

              {/* Note textarea */}
              <textarea
                placeholder="Энэ оношид холбогдох тэмдэглэл (сонголттой)"
                value={row.note}
                onChange={(e) => onNoteChange(index, e.target.value)}
                rows={2}
                disabled={isLocked}
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                  fontSize: 13,
                  resize: "vertical",
                  background: isLocked ? "#f3f4f6" : "#ffffff",
                  cursor: isLocked ? "not-allowed" : "text",
                  opacity: isLocked ? 0.6 : 1,
                }}
              />
            </div>
          );
        })}
      </div>

      {saveError && (
        <div style={{ color: "red", marginTop: 8 }}>{saveError}</div>
      )}

      {/* Summary and action buttons */}
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
            (Эмчийн сонгосон онош, үйлчилгээний дагуу. Төлбөрийн касс дээр
            эцэслэнэ.)
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
              await onSave();
              onResetToothSelection();
            }}
            disabled={saving || finishing || prescriptionSaving}
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
            {saving || prescriptionSaving
              ? "Хадгалж байна..."
              : "Зөвхөн онош хадгалах"}
          </button>

          <button
            type="button"
            onClick={onFinish}
            disabled={saving || finishing || prescriptionSaving}
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
  );
}

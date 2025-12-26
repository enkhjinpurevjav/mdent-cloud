"use client";

import React from "react";
import SignaturePad from "./SignaturePad";


type VisitCardType = "ADULT" | "CHILD";

type Props = {
  answers: any;
  visitCard: any | null;
  visitCardTypeDraft: VisitCardType | null;
  setVisitCardTypeDraft: (t: VisitCardType) => void;
  updateVisitCardAnswer: (key: string, value: any) => void;
  updateNested: (section: string, field: string, value: any) => void;
  signatureSaving: boolean;
  handleUploadSignature: (blob: Blob) => Promise<void>;
  handleSaveVisitCard: () => Promise<void> | void;
  visitCardSaving: boolean;
  formatDate: (iso?: string) => string;
};

export default function ChildVisitCardForm({
  answers,
  visitCard,
  visitCardTypeDraft,
  setVisitCardTypeDraft,
  updateVisitCardAnswer,
  updateNested,
  signatureSaving,
  handleUploadSignature,
  handleSaveVisitCard,
  visitCardSaving,
  formatDate,
}: Props) {
  return (
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
        Үзлэгийн карт (Хүүхэд)
      </h2>

      {/* Type selector – same as in page */}
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

      {/* 3) Ерөнхий биеийн талаархи асуумж — with child labels */}
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
            {/* --- Ерөнхий бие (same keys, kid wording) --- */}
            {([
              ["heartDisease", "Зүрх судасны өвчинтэй эсэх"],
              ["highBloodPressure", "Даралт ихсэх өвчинтэй эсэх"],
              ["infectiousDisease", "Халдварт өвчинтэй эсэх"],
              ["tuberculosis", "Сүрьеэ өвчнөөр өвчилж байсан эсэх"],
              [
                "hepatitisBC",
                "Халдварт гепатит В, С-ээр өвдөж байсан эсэх",
              ],
              ["diabetes", "Чихрийн шижинтэй эсэх"],
              ["onMedication", "Одоо хэрэглэж байгаа эм, тариа байгаа эсэх"],
              [
                "seriousIllnessOrSurgery",
                "Ойрын 5 жилд хүнд өвчнөөр өвчилсөн болон мэс ажилбарт орж байсан эсэх",
              ],
              ["implant", "Зүрхний импланттай эсэх"],
              ["generalAnesthesia", "Бүтэн наркоз хийлгэж байсан эсэх"],
              [
                "chemoOrRadiation",
                "Химийн/ туяа эмчилгээ хийлгэж байгаа эсэх",
              ],
            ] as const).map(([key, label]) => {
              const value = answers.generalMedical?.[key];
              const detailKey = `${key}Detail`;
              const detailValue = answers.generalMedical?.[detailKey] || "";
              const isYes = value === "yes";
              const isNo = value === "no" || value === undefined;
              return (
                <React.Fragment key={key}>
                  <tr>
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
                        checked={isNo}
                        onChange={() => {
                          updateNested("generalMedical", key, "no");
                          updateNested("generalMedical", detailKey, "");
                        }}
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
                        checked={isYes}
                        onChange={() =>
                          updateNested("generalMedical", key, "yes")
                        }
                      />
                    </td>
                  </tr>
                  {isYes && (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: "0 6px 6px 6px",
                        }}
                      >
                        <input
                          placeholder="Тайлбар / дэлгэрэнгүй"
                          value={detailValue}
                          onChange={(e) =>
                            updateNested(
                              "generalMedical",
                              detailKey,
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
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* --- Харшил --- */}
            <tr>
              <td
                colSpan={3}
                style={{
                  padding: 6,
                  background: "#f9fafb",
                  fontWeight: 500,
                  borderTop: "1px solid #e5e7eb",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Харшил
              </td>
            </tr>
            {([
              ["drug", "Эм тариа"],
              ["metal", "Метал"],
              ["localAnesthetic", "Шүдний мэдээ алдуулах тариа"],
              ["latex", "Латекс"],
              ["other", "Бусад"],
            ] as const).map(([key, label]) => {
              const value = answers.allergies?.[key];
              const isYes = value === "yes";
              const isNo = value === "no" || value === undefined;
              const detailKey = key === "other" ? "otherDetail" : `${key}Detail`;
              const detailValue = answers.allergies?.[detailKey] || "";
              return (
                <React.Fragment key={key}>
                  <tr>
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
                        name={`allergy_${key}`}
                        checked={isNo}
                        onChange={() => {
                          updateNested("allergies", key, "no");
                          updateNested("allergies", detailKey, "");
                        }}
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
                        name={`allergy_${key}`}
                        checked={isYes}
                        onChange={() =>
                          updateNested("allergies", key, "yes")
                        }
                      />
                    </td>
                  </tr>
                  {isYes && (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: "0 6px 6px 6px",
                        }}
                      >
                        <input
                          placeholder="Тайлбар / дэлгэрэнгүй"
                          value={detailValue}
                          onChange={(e) =>
                            updateNested(
                              "allergies",
                              detailKey,
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
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* --- Зуршил (kids wording) --- */}
            <tr>
              <td
                colSpan={3}
                style={{
                  padding: 6,
                  background: "#f9fafb",
                  fontWeight: 500,
                  borderTop: "1px solid #e5e7eb",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Зуршил
              </td>
            </tr>
            {([
              ["mouthBreathing", "Хэл, хуруу хөхдөг эсэх"],
              ["nightGrinding", "Шөнө амаа ангайж унтдаг эсэх"],
              ["other", "Бусад"],
            ] as const).map(([key, label]) => {
              const value = answers.habits?.[key];
              const isYes = value === "yes";
              const isNo = value === "no" || value === undefined;
              const detailKey = key === "other" ? "otherDetail" : `${key}Detail`;
              const detailValue = answers.habits?.[detailKey] || "";
              return (
                <React.Fragment key={key}>
                  <tr>
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
                        name={`habit_${key}`}
                        checked={isNo}
                        onChange={() => {
                          updateNested("habits", key, "no");
                          updateNested("habits", detailKey, "");
                        }}
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
                        name={`habit_${key}`}
                        checked={isYes}
                        onChange={() =>
                          updateNested("habits", key, "yes")
                        }
                      />
                    </td>
                  </tr>
                  {isYes && (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: "0 6px 6px 6px",
                        }}
                      >
                        <input
                          placeholder={
                            key === "other"
                              ? "Бусад зуршил"
                              : "Тайлбар / дэлгэрэнгүй"
                          }
                          value={detailValue}
                          onChange={(e) =>
                            updateNested(
                              "habits",
                              detailKey,
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
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* --- Нэмэлт (same as adult) --- */}
            <tr>
              <td
                colSpan={3}
                style={{
                  padding: 6,
                  background: "#f9fafb",
                  fontWeight: 500,
                  borderTop: "1px solid #e5e7eb",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Нэмэлт
              </td>
            </tr>
            {([
              [
                "regularCheckups",
                "Шүдний эмчид байнга үзүүлдэг эсэх",
              ],
              [
                "bleedingAfterExtraction",
                "Шүд авахуулсны дараа цус тогтолт удаан эсэх",
              ],
              ["gumBleeding", "Буйлнаас цус гардаг эсэх"],
              ["badBreath", "Амнаас эвгүй үнэр гардаг эсэх"],
            ] as const).map(([key, label]) => {
              const value = answers.dentalFollowup?.[key];
              const isYes = value === "yes";
              const isNo = value === "no" || value === undefined;
              const detailKey = `${key}Detail`;
              const detailValue = answers.dentalFollowup?.[detailKey] || "";
              return (
                <React.Fragment key={key}>
                  <tr>
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
                        name={`dental_${key}`}
                        checked={isNo}
                        onChange={() => {
                          updateNested("dentalFollowup", key, "no");
                          updateNested("dentalFollowup", detailKey, "");
                        }}
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
                        name={`dental_${key}`}
                        checked={isYes}
                        onChange={() =>
                          updateNested("dentalFollowup", key, "yes")
                        }
                      />
                    </td>
                  </tr>
                  {isYes && (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: "0 6px 6px 6px",
                        }}
                      >
                        <input
                          placeholder="Тайлбар / дэлгэрэнгүй"
                          value={detailValue}
                          onChange={(e) =>
                            updateNested(
                              "dentalFollowup",
                              detailKey,
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
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Child consent declaration */}
      <section
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px dashed #e5e7eb",
          fontSize: 13,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          Та доорхи таниулсан зөвшөөрлийг бүрэн уншиж танилцана уу
        </div>
        <ol style={{ paddingLeft: 18, margin: 0, marginBottom: 8 }}>
          <li style={{ marginBottom: 4 }}>
            Манай эмнэлгийн <strong>7715-1551</strong> утсаар болон биечлэн
            уулзаж эмчилгээ хийлгэх цагаа урьдчилан захиална.
          </li>
          <li style={{ marginBottom: 4 }}>
            Таны хүүхдэд анхны үзлэгээр эмчилгээний төлөвлөгөө, төлбөрийн
            баримжаа, цаашид хийгдэх эмчилгээ үр дүнгийн талаар эмч урьдчилан
            мэдээллэх үүрэгтэй.
          </li>
          <li style={{ marginBottom: 4 }}>
            Давтан ирэх шаардлагатай эмчилгээнд эмчийн тогтоосон өдөр та
            хүүхдээ дагуулж ирэх үүрэгтэй ба хугацаандаа ирээгүйн улмаас
            эмчилгээ дахих, цаг хугацаа алдах, дахин төлбөр төлөх зэрэг
            асуудал гардаг ба тухайн асуудлыг үйлчлүүлэгчийн эцэг эх
            хариуцна.
          </li>
          <li style={{ marginBottom: 4 }}>
            Сувгийн эмчилгээ нь тухайн шүдний үрэвслийн байдал, тойрон эдийн
            эдгэрэлт зэргээс хамаарч 2 болон түүнээс дээш удаагийн ирэлтээр
            хийгддэг.
          </li>
          <li style={{ marginBottom: 4 }}>
            Та хүндэтгэх шалтгааны улмаас товлосон үзлэгийн цагтаа ирэх
            боломжгүй болсон тохиолдолд урьдчилан манай эмнэлгийн{" "}
            <strong>7715-1551</strong> утсанд мэдэгдэнэ үү. Ингэснээр таны
            хүүхдийн эмчилгээ үр дүнгүй болох зэрэг таагүй байдлаас та
            урьдчилан сэргийлэх боломжтой болно.
          </li>
          <li style={{ marginBottom: 4 }}>
            Та хийлгэсэн эмчилгээний дараахь эмчийн хэлсэн заавар
            зөвлөмжийг дагаж биелүүлэх үүрэгтэй ба ингэснээр эмчилгээ үр
            дүнгүй болох, дараачийн хүндрэлүүд үүсэх зэрэг асуудлаас
            өөрийгөө сэргийлж байгаа юм.
          </li>
          <li style={{ marginBottom: 4 }}>
            Манай эмнэлэгт хэрэглэгдэж буй нэг удаагийн зүүний лацны бүрэн
            бүтэн, аюулгүй байдалд та давхар хяналт тавих эрхтэй.
          </li>
          <li style={{ marginBottom: 4 }}>
            0-6 настай хүүхэд шүдний эмнэлэгт хэрэглэгдэж буй тод гэрэл, дуу
            чимээнээс айж уйлах тохиолдол гардаг ба хүүхдийн уйлсан тохиолдол
            бүрийг өвдөлт гэж андуурч болохгүй.
          </li>
          <li style={{ marginBottom: 4 }}>
            Эмчилгээ хийх явцад тухайн хүүхдийн зан төлөв, эмчилгээний
            айдсаас үүдэн хүүхэд уйлах, тийчлэх үед эмч, сувилагч аюулгүйн
            ажиллагааны бэхэлгээ хийлгэхийг эцэг эх эмчтэй ярилцсаны үүднээс
            харилцан зөвшөөрөх.
          </li>
        </ol>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            marginTop: 4,
          }}
        >
          <input
            type="checkbox"
            checked={answers.childConsentAccepted || false}
            onChange={(e) =>
              updateVisitCardAnswer("childConsentAccepted", e.target.checked)
            }
          />
          <span>
            Урьдчилан сэргийлэх асуумжийг үнэн зөв бөглөж, эмчилгээний
            нөхцөлтэй танилцсан үйлчлүүлэгчийн асран хамгаалагч.
          </span>
        </label>
      </section>

      {/* Signature & save — same pattern as adult */}
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
              onChange={(blob: Blob) => void handleUploadSignature(blob)}
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
    </div>
  );
}

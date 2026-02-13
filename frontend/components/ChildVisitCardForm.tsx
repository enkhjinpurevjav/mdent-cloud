import React from "react";
import PreventativeQuestionnaire from "./PreventativeQuestionnaire";

type VisitCardType = "ADULT" | "CHILD";

type Props = {
  answers: any;
  updateVisitCardAnswer: (key: string, value: any) => void;
  updateNested: (section: string, field: string, value: any) => void;
};

export default function ChildVisitCardForm({
  answers,
  updateVisitCardAnswer,
  updateNested,
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
      

      {/* Урьдчилан сэргийлэх асуумж */}
      <PreventativeQuestionnaire
        answers={answers}
        updateNested={updateNested}
        updateVisitCardAnswer={updateVisitCardAnswer}
        radioNamePrefix="child_"
      />

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
    </div>
  );
}

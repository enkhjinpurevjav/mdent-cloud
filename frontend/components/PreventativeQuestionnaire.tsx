import React from "react";

type Props = {
  answers: any;
  updateNested: (section: string, field: string, value: any) => void;
  updateVisitCardAnswer: (key: string, value: any) => void;
  radioNamePrefix?: string;
};

export default function PreventativeQuestionnaire({
  answers,
  updateNested,
  updateVisitCardAnswer,
  radioNamePrefix = "",
}: Props) {
  return (
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
                checked={Boolean(answers.reasonToVisit?.[key])}
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
              value={answers.reasonToVisit?.other || ""}
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
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 6,
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
                name={`${radioNamePrefix}prevVisit`}
                value="no"
                checked={answers.previousDentalVisit?.hasVisited === "no"}
                onChange={() =>
                  updateNested("previousDentalVisit", "hasVisited", "no")
                }
              />
              <span>Үгүй</span>
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
                name={`${radioNamePrefix}prevVisit`}
                value="yes"
                checked={answers.previousDentalVisit?.hasVisited === "yes"}
                onChange={() =>
                  updateNested("previousDentalVisit", "hasVisited", "yes")
                }
              />
              <span>Тийм</span>
            </label>
          </div>

          {answers.previousDentalVisit?.hasVisited === "yes" && (
            <div>
              <div
                style={{
                  color: "#6b7280",
                  marginBottom: 2,
                }}
              >
                Өмнө үзүүлж байсан эмнэлгийн нэр
              </div>
              <input
                value={answers.previousDentalVisit?.clinicName || ""}
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
            Өмнө шүдний эмчилгээ хийлгэхэд ямар нэгэн хүндрэл гарч байсан
            эсэх?
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 6,
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
                name={`${radioNamePrefix}prevComplication`}
                value="no"
                checked={
                  answers.previousDentalVisit?.hadComplication === "no" ||
                  !answers.previousDentalVisit?.hadComplication
                }
                onChange={() => {
                  updateNested(
                    "previousDentalVisit",
                    "hadComplication",
                    "no"
                  );
                  updateNested(
                    "previousDentalVisit",
                    "reactionOrComplication",
                    ""
                  );
                }}
              />
              <span>Үгүй</span>
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
                name={`${radioNamePrefix}prevComplication`}
                value="yes"
                checked={
                  answers.previousDentalVisit?.hadComplication === "yes"
                }
                onChange={() =>
                  updateNested(
                    "previousDentalVisit",
                    "hadComplication",
                    "yes"
                  )
                }
              />
              <span>Тийм</span>
            </label>
          </div>

          {answers.previousDentalVisit?.hadComplication === "yes" && (
            <textarea
              rows={2}
              placeholder="Хүндрэл гарч байсан бол тайлбарлана уу"
              value={answers.previousDentalVisit?.reactionOrComplication || ""}
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

        {/* Extra notes for dentist during treatment */}
        <div
          style={{
            borderTop: "1px dashed #e5e7eb",
            paddingTop: 8,
            marginTop: 4,
          }}
        >
          <div
            style={{
              color: "#6b7280",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            Шүдний эмчилгээний үед эмчийн зүгээс анхаарах зүйлс:
          </div>
          <textarea
            rows={3}
            value={answers.dentistAttentionNotes || ""}
            onChange={(e) =>
              updateVisitCardAnswer("dentistAttentionNotes", e.target.value)
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
    </section>
  );
}

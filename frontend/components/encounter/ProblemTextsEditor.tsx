import React, { useState } from "react";
import type { EncounterDiagnosisProblemText } from "../../types/encounter-admin";

type ProblemTextsEditorProps = {
  diagnosisId: number | undefined;
  problemTexts: EncounterDiagnosisProblemText[];
  onAdd: () => Promise<void>;
  onUpdate: (id: number, text: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isLocked?: boolean;
  errorMessage?: string | null;
};

export default function ProblemTextsEditor({
  diagnosisId,
  problemTexts,
  onAdd,
  onUpdate,
  onDelete,
  isLocked = false,
  errorMessage = null,
}: ProblemTextsEditorProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const handleStartEdit = (text: EncounterDiagnosisProblemText) => {
    setEditingId(text.id);
    setEditingText(text.text);
  };

  const handleSaveEdit = async (id: number) => {
    if (editingText.trim()) {
      await onUpdate(id, editingText.trim());
    }
    setEditingId(null);
    setEditingText("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  if (!diagnosisId) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: "1px dashed #e5e7eb",
      }}
    >
      <h4
        style={{
          fontSize: 13,
          margin: 0,
          marginBottom: 6,
          fontWeight: 600,
          color: isLocked ? "#9ca3af" : undefined,
        }}
      >
        Бодит үзлэг {isLocked && "(Түгжээтэй)"}
      </h4>

      {errorMessage && (
        <div
          style={{
            fontSize: 12,
            color: "#dc2626",
            background: "#fef2f2",
            padding: "4px 8px",
            borderRadius: 4,
            marginBottom: 6,
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {problemTexts.map((text, idx) => (
          <div
            key={text.id}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280", minWidth: 20 }}>
              {idx + 1}.
            </div>
            {editingId === text.id ? (
              <>
                <input
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveEdit(text.id);
                    } else if (e.key === "Escape") {
                      handleCancelEdit();
                    }
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                    fontSize: 12,
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSaveEdit(text.id)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid #16a34a",
                    background: "#ecfdf3",
                    color: "#166534",
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  Хадгалах
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid #6b7280",
                    background: "#f3f4f6",
                    color: "#374151",
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  Болих
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: "#111827",
                    padding: "4px 0",
                  }}
                >
                  {text.text}
                </div>
                {!isLocked && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(text)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #2563eb",
                        background: "#eff6ff",
                        color: "#2563eb",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      Засах
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(text.id)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        border: "1px solid #dc2626",
                        background: "#fef2f2",
                        color: "#b91c1c",
                        cursor: "pointer",
                        fontSize: 16,
                        lineHeight: "20px",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Устгах"
                    >
                      ×
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}

        {problemTexts.length === 0 && !isLocked && (
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginTop: 2,
            }}
          >
            Бодит үзлэг бүртгээгүй байна.
          </div>
        )}

        {!isLocked && (
          <button
            type="button"
            onClick={onAdd}
            style={{
              marginTop: 4,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #2563eb",
              background: "#eff6ff",
              color: "#2563eb",
              cursor: "pointer",
              fontSize: 12,
              alignSelf: "flex-start",
            }}
          >
            + Нэмэх
          </button>
        )}
      </div>
    </div>
  );
}

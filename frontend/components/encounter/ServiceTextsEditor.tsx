import React, { useState } from "react";
import type { EncounterServiceText } from "../../types/encounter-admin";

type ServiceTextsEditorProps = {
  serviceId: number | undefined;
  serviceTexts: EncounterServiceText[];
  onAdd: () => Promise<void>;
  onUpdate: (id: number, text: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

export default function ServiceTextsEditor({
  serviceId,
  serviceTexts,
  onAdd,
  onUpdate,
  onDelete,
}: ServiceTextsEditorProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const handleStartEdit = (text: EncounterServiceText) => {
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

  if (!serviceId) {
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
        }}
      >
        Эмчилгээний тайлбар
      </h4>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {serviceTexts.map((text, idx) => (
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
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid #dc2626",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  Устгах
                </button>
              </>
            )}
          </div>
        ))}

        {serviceTexts.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginTop: 2,
            }}
          >
            Эмчилгээний тайлбар бүртгээгүй байна.
          </div>
        )}

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
      </div>
    </div>
  );
}

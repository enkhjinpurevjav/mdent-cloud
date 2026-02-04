import React from "react";

type ServiceTextsEditorProps = {
  texts: string[];
  onChange: (texts: string[]) => void;
  isLocked?: boolean;
};

export default function ServiceTextsEditor({
  texts,
  onChange,
  isLocked = false,
}: ServiceTextsEditorProps) {
  const handleTextChange = (index: number, value: string) => {
    const newTexts = [...texts];
    newTexts[index] = value;
    onChange(newTexts);
  };

  const handleAddRow = () => {
    onChange([...texts, ""]);
  };

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
        Эмчилгээний тайлбар {isLocked && "(Түгжээтэй)"}
      </h4>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {texts.map((text, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280", minWidth: 20 }}>
              {idx + 1}.
            </div>
            <input
              value={text}
              onChange={(e) => handleTextChange(idx, e.target.value)}
              disabled={isLocked}
              placeholder="Эмчилгээний тайлбар оруулна уу"
              style={{
                flex: 1,
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
                fontSize: 12,
                background: isLocked ? "#f9fafb" : "#ffffff",
                cursor: isLocked ? "not-allowed" : "text",
              }}
            />
          </div>
        ))}

        {!isLocked && (
          <button
            type="button"
            onClick={handleAddRow}
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

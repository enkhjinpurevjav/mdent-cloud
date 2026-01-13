import React from "react";
import type { EditablePrescriptionItem } from "../../types/encounter-admin";

type PrescriptionEditorProps = {
  prescriptionItems: EditablePrescriptionItem[];
  prescriptionSaving: boolean;
  prescriptionError: string;
  onUpdateItem: (index: number, updates: Partial<EditablePrescriptionItem>) => void;
  onRemoveItem: (index: number) => void;
  onAddItem: () => void;
  onSave: () => void;
};

export default function PrescriptionEditor({
  prescriptionItems,
  prescriptionSaving,
  prescriptionError,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
  onSave,
}: PrescriptionEditorProps) {
  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: "1px dashed #e5e7eb",
      }}
    >
      <h3
        style={{
          fontSize: 14,
          margin: 0,
          marginBottom: 6,
        }}
      >
        Эмийн жор (ихдээ 3 эм)
      </h3>
      <p
        style={{
          marginTop: 0,
          marginBottom: 6,
          fontSize: 12,
          color: "#6b7280",
        }}
      >
        Өвчтөнд өгөх эмийн нэр, тун, хэрэглэх давтамж болон хоногийг
        бөглөнө үү. Жор бичихгүй бол энэ хэсгийг хоосон орхиж болно.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px 2fr 80px 80px 80px 1.5fr 60px",
          gap: 6,
          alignItems: "center",
          fontSize: 12,
          marginBottom: 4,
          padding: "4px 0",
          color: "#6b7280",
        }}
      >
        <div>№</div>
        <div>Эмийн нэр / тун / хэлбэр</div>
        <div style={{ textAlign: "center" }}>Нэг удаад</div>
        <div style={{ textAlign: "center" }}>Өдөрт</div>
        <div style={{ textAlign: "center" }}>Хэд хоног</div>
        <div>Тэмдэглэл</div>
        <div />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {prescriptionItems.map((it, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns:
                "40px 2fr 80px 80px 80px 1.5fr 60px",
              gap: 6,
              alignItems: "center",
            }}
          >
            <div>{idx + 1}</div>
            <input
              value={it.drugName}
              onChange={(e) => onUpdateItem(idx, { drugName: e.target.value })}
              placeholder="Ж: Амоксициллин 500мг таб."
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
                fontSize: 12,
              }}
            />
            <input
              type="number"
              min={1}
              value={it.quantityPerTake ?? ""}
              onChange={(e) =>
                onUpdateItem(idx, {
                  quantityPerTake: Number(e.target.value) || 1,
                })
              }
              placeholder="1"
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
                fontSize: 12,
                textAlign: "center",
              }}
            />
            <input
              type="number"
              min={1}
              value={it.frequencyPerDay ?? ""}
              onChange={(e) =>
                onUpdateItem(idx, {
                  frequencyPerDay: Number(e.target.value) || 1,
                })
              }
              placeholder="3"
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
                fontSize: 12,
                textAlign: "center",
              }}
            />
            <input
              type="number"
              min={1}
              value={it.durationDays ?? ""}
              onChange={(e) =>
                onUpdateItem(idx, {
                  durationDays: Number(e.target.value) || 1,
                })
              }
              placeholder="7"
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
                fontSize: 12,
                textAlign: "center",
              }}
            />
            <input
              value={it.note || ""}
              onChange={(e) => onUpdateItem(idx, { note: e.target.value })}
              placeholder="Ж: Хоолны дараа"
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
                fontSize: 12,
              }}
            />
            <button
              type="button"
              onClick={() => onRemoveItem(idx)}
              style={{
                padding: "4px 6px",
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
          </div>
        ))}

        {prescriptionItems.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginTop: 4,
            }}
          >
            Жор бичээгүй байна. Хэрвээ эмийн жор шаардлагатай бол
            доорх &quot;Эм нэмэх&quot; товчоор эм нэмнэ үү.
          </div>
        )}

        <button
          type="button"
          onClick={onAddItem}
          disabled={prescriptionItems.length >= 3}
          style={{
            marginTop: 4,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #2563eb",
            background: "#eff6ff",
            color: "#2563eb",
            cursor:
              prescriptionItems.length >= 3
                ? "default"
                : "pointer",
            fontSize: 12,
            alignSelf: "flex-start",
          }}
        >
          + Эм нэмэх
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={prescriptionSaving}
          style={{
            marginTop: 4,
            marginLeft: 8,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #16a34a",
            background: "#ecfdf3",
            color: "#166534",
            cursor: prescriptionSaving ? "default" : "pointer",
            fontSize: 12,
          }}
        >
          {prescriptionSaving
            ? "Жор хадгалж байна..."
            : "Жор хадгалах"}
        </button>

        {prescriptionError && (
          <div
            style={{
              color: "#b91c1c",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {prescriptionError}
          </div>
        )}
      </div>
    </div>
  );
}

import React from "react";

type PendingSaveBarProps = {
  pendingSaveId: number | null;
  pendingSaveError: string | null;
  pendingSaving: boolean;
  onSave: (appointmentId: number) => void;
  onCancel: (appointmentId: number) => void;
};

export default function PendingSaveBar({
  pendingSaveId,
  pendingSaveError,
  pendingSaving,
  onSave,
  onCancel,
}: PendingSaveBarProps) {
  if (pendingSaveId === null) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        background: "#ffffff",
        borderRadius: 8,
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 320,
        border: "2px solid #f59e0b",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
        Цаг захиалга өөрчлөгдлөө
      </div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        Та өөрчлөлтийг хадгалах уу эсвэл цуцлах уу?
      </div>
      {pendingSaveError && (
        <div style={{ fontSize: 12, color: "#b91c1c" }}>
          {pendingSaveError}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => onSave(pendingSaveId)}
          disabled={pendingSaving}
          style={{
            flex: 1,
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#16a34a",
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: pendingSaving ? "default" : "pointer",
            opacity: pendingSaving ? 0.6 : 1,
          }}
        >
          {pendingSaving ? "Хадгалж байна..." : "Хадгалах"}
        </button>
        <button
          type="button"
          onClick={() => onCancel(pendingSaveId)}
          disabled={pendingSaving}
          style={{
            flex: 1,
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#f9fafb",
            color: "#111827",
            fontSize: 13,
            fontWeight: 600,
            cursor: pendingSaving ? "default" : "pointer",
            opacity: pendingSaving ? 0.6 : 1,
          }}
        >
          Цуцлах
        </button>
      </div>
    </div>
  );
}

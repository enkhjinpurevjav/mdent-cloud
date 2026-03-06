import React from "react";
import BillingMaterialsView from "../billing/BillingMaterialsView";

type Props = {
  open: boolean;
  onClose: () => void;
  encounterId: number | null;
};

export default function EncounterMaterialsModal({ open, onClose, encounterId }: Props) {
  if (!open || encounterId == null) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 8,
          maxWidth: 800,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            Хавсралтууд
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: "#6b7280",
              lineHeight: 1,
            }}
            aria-label="Хаах"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16 }}>
          <BillingMaterialsView encounterId={encounterId} />
        </div>
      </div>
    </div>
  );
}

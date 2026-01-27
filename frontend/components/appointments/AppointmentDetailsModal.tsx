import React, { useState } from "react";
import { useRouter } from "next/router";
import type { Appointment, Doctor } from "./types";
import { formatStatus, formatDateYmdDots } from "./formatters";

type AppointmentDetailsModalProps = {
  open: boolean;
  onClose: () => void;
  doctor?: Doctor | null;
  slotLabel?: string;
  slotTime?: string; // HH:MM
  date?: string; // YYYY-MM-DD
  appointments: Appointment[];
  onStatusUpdated?: (updated: Appointment) => void;
  onEditAppointment?: (a: Appointment) => void;
};

function formatDetailedTimeRange(start: Date, end: Date | null): string {
  if (Number.isNaN(start.getTime())) return "-";

  const datePart = formatDateYmdDots(start);
  const startTime = start.toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (!end || Number.isNaN(end.getTime())) {
    return `${datePart} ${startTime}`;
  }

  const endTime = end.toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${datePart} ${startTime} – ${endTime}`;
}

function isOngoing(status: string) {
  return status === "ongoing";
}

export default function AppointmentDetailsModal({
  open,
  onClose,
  doctor,
  slotLabel,
  slotTime,
  date,
  appointments,
  onStatusUpdated,
  onEditAppointment,
}: AppointmentDetailsModalProps) {
  const router = useRouter();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<string>("");
  const [editingNote, setEditingNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canReceptionEditAppointment = (status: string) =>
  ["booked", "confirmed", "online", "other"].includes(
    String(status || "").toLowerCase()
  );
  
  const needsExplanation =
    editingStatus === "no_show" ||
    editingStatus === "cancelled" ||
    editingStatus === "other";
  
  if (!open) return null;

    const handleCancelEdit = () => {
  setEditingId(null);
  setEditingStatus("");
  setEditingNote("");
  setError("");
};

  const handleStartEdit = (a: Appointment) => {
  setEditingId(a.id);
  setEditingStatus(a.status);
  setEditingNote(a.notes || "");
  setError("");
};
  
  const handleSaveStatus = async (a: Appointment) => {
  // if status didn't change AND note didn't change -> close edit
  const currentNotes = a.notes || "";
  if (
    (!editingStatus || editingStatus === a.status) &&
    editingNote === currentNotes
  ) {
    setEditingId(null);
    return;
  }

  setSaving(true);
  setError("");

  try {
    const payload: any = { status: editingStatus || a.status };

    // only send notes for these statuses
    if (needsExplanation) {
      payload.notes = editingNote; // backend should trim/convert "" -> null
    }

    const res = await fetch(`/api/appointments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      setError((data && data.error) || `Төлөв шинэчлэхэд алдаа гарлаа (код ${res.status})`);
      return;
    }

    const updated = data as Appointment;
    onStatusUpdated?.(updated);

    setEditingId(null);
    setEditingStatus("");
    setEditingNote("");
  } catch (e) {
    console.error("Update status network error", e);
    setError("Сүлжээгээ шалгана уу.");
  } finally {
    setSaving(false);
  }
};

  const handleStartEncounter = async (a: Appointment) => {
    try {
      setError("");
      const res = await fetch(`/api/appointments/${a.id}/start-encounter`, {
        method: "POST",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || typeof data.encounterId !== "number") {
        console.error("start-encounter failed", res.status, data);
        setError(
          (data && data.error) ||
            "Үзлэг эхлүүлэх үед алдаа гарлаа. Төлөв нь 'Явагдаж байна' эсэхийг шалгана уу."
        );
        return;
      }

      router.push(`/encounters/${data.encounterId}`);
    } catch (e) {
      console.error("start-encounter network error", e);
      setError("Үзлэг эхлүүлэхэд сүлжээний алдаа гарлаа.");
    }
  };

  const handleViewEncounterForPayment = async (a: Appointment) => {
    try {
      setError("");
      const res = await fetch(`/api/appointments/${a.id}/encounter`, {
        method: "GET",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || typeof data.encounterId !== "number") {
        console.error("get encounter for payment failed", res.status, data);
        setError(
          (data && data.error) ||
            "Үзлэгийн мэдээлэл авах үед алдаа гарлаа."
        );
        return;
      }

      // Go to billing page for this encounter
      router.push(`/billing/${data.encounterId}`);
    } catch (e) {
      console.error("view-encounter-for-payment network error", e);
      setError("Үзлэгийн мэдээлэл авах үед сүлжээний алдаа гарлаа.");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: 8,
          boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
          padding: 16,
          fontSize: 13,
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
          <h3
            style={{
              margin: 0,
              fontSize: 15,
            }}
          >
            Цагийн дэлгэрэнгүй
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

                {/* Patient summary header */}
        <div
          style={{
            marginBottom: 8,
            color: "#4b5563",
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {appointments.length > 0 ? (() => {
            const a = appointments[0];
            const p = a.patient as any;

            const name = (p?.name ?? a.patientName ?? "").toString().trim();
            const ovog = (p?.ovog ?? a.patientOvog ?? "").toString().trim();
            const phone = (p?.phone ?? a.patientPhone ?? "").toString().trim();
            const bookNumber =
              p?.patientBook?.bookNumber != null
                ? String(p.patientBook.bookNumber).trim()
                : "";

            let displayName = name;
            if (ovog) {
              const first = ovog.charAt(0).toUpperCase();
              displayName = `${first}.${name}`;
            }

            return (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div>
                    <strong>Үйлчлүүлэгч:</strong>{" "}
                    {displayName || "-"}
                  </div>
                  <div>
                    <span>📞 {phone || "-"}</span>
                  </div>
                  <div>
                    <strong>Картын дугаар:</strong>{" "}
                    {bookNumber || "-"}
                  </div>
                </div>

                                <div style={{ alignSelf: "flex-start" }}>
                  <button
  type="button"
  onClick={() => {
    const p = a.patient as any;
    const bookNumber =
      p?.patientBook?.bookNumber != null
        ? String(p.patientBook.bookNumber).trim()
        : "";

    if (bookNumber) {
      const url = `/patients/${encodeURIComponent(bookNumber)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }}
  style={{
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    cursor: "pointer",
  }}
>
  Дэлгэрэнгүй
</button>
                </div>
              </>
            );
          })() : (
            <div>Үйлчлүүлэгчийн мэдээлэл алга.</div>
          )}
        </div>

        {appointments.length === 0 ? (
          <div style={{ color: "#6b7280" }}>Энэ цагт захиалга алга.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {appointments.map((a) => {
              const start = new Date(a.scheduledAt);
              const end =
                a.endAt && !Number.isNaN(new Date(a.endAt).getTime())
                  ? new Date(a.endAt)
                  : null;

              const isEditing = editingId === a.id;
              const canStartEncounter = isOngoing(a.status);

              return (
                <div
                  key={a.id}
                  style={{
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    padding: 8,
                    background: "#f9fafb",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                  
                    {!isEditing && (
  <div style={{ display: "flex", gap: 6 }}>
    <button
      type="button"
      onClick={() => handleStartEdit(a)}
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #2563eb",
        background: "#eff6ff",
        color: "#1d4ed8",
        cursor: "pointer",
      }}
    >
      Төлөв засах
    </button>

    {canReceptionEditAppointment(a.status) && (
      <button
        type="button"
        onClick={() => {
  // close the details modal so edit modal won't be behind
  onClose();
  // open edit modal
  onEditAppointment?.(a);
}}
        style={{
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 999,
          border: "1px solid #7c3aed",
          background: "#f3e8ff",
          color: "#6d28d9",
          cursor: "pointer",
        }}
      >
        Засварлах
      </button>
    )}
  </div>
)}
                  </div>

                                    {!isEditing ? (
                    <>
                      <div style={{ color: "#4b5563" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <strong>Төлөв:</strong> {formatStatus(a.status)}
                          {a.status === "ready_to_pay" && (
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: "#f97316",
                                color: "white",
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              Төлбөр авах
                            </span>
                          )}
                        </div>
                       
                      </div>

                      {/* Doctor + appointment branch */}
                      <div style={{ color: "#4b5563", marginTop: 4 }}>
  <div>
    <strong>Эмч:</strong>{" "}
    {(() => {
      const rawName = (a.doctorName ?? "").toString().trim();
      const rawOvog = (a.doctorOvog ?? "").toString().trim();

      // doctorName = "Test Amaraa" → нэр хэсгийг авах
      let pureName = rawName;
      if (rawName && rawOvog) {
        const lowerName = rawName.toLowerCase();
        const lowerOvog = rawOvog.toLowerCase();

        if (lowerName.startsWith(lowerOvog + " ")) {
          pureName = rawName.slice(rawOvog.length).trim();
        }
      }

      if (!pureName && !rawOvog) return "-";

      if (rawOvog) {
        const first = rawOvog.charAt(0).toUpperCase();
        return `${first}.${pureName || rawOvog}`;
      }

      return pureName;
    })()}
  </div>
  <div>
                          <strong>Салбар:</strong>{" "}
                          {a.branch?.name ?? a.branchId}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {canStartEncounter && (
                          <button
                            type="button"
                            onClick={() => handleStartEncounter(a)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: "1px solid #16a34a",
                              background: "#dcfce7",
                              color: "#166534",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Үзлэг эхлүүлэх / үргэлжлүүлэх
                          </button>
                        )}

                        {a.status === "ready_to_pay" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleViewEncounterForPayment(a)
                            }
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: "1px solid #f59e0b",
                              background: "#fef3c7",
                              color: "#92400e",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Төлбөр авах / Үзлэг харах
                          </button>
                        )}

                        {!canStartEncounter &&
                          a.status !== "ready_to_pay" && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                              }}
                            >
                              Үзлэгийг зөвхөн "Явагдаж байна" төлөвтэй үед
                              эхлүүлнэ.
                            </span>
                          )}
                      </div>
                    </>
                  ) : (
                    // editing branch stays as-is
                    <div style={{ marginBottom: 4 }}>
    {/* Row: status + buttons (your existing code) */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <label style={{ fontSize: 12 }}>
        Төлөв:
        <select
          value={editingStatus}
          onChange={(e) => setEditingStatus(e.target.value)}
          style={{
            marginLeft: 4,
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "2px 6px",
            fontSize: 12,
          }}
        >
          <option value="booked">Захиалсан</option>
          <option value="confirmed">Баталгаажсан</option>
          <option value="online">Онлайн</option>
          <option value="ongoing">Явагдаж байна</option>
          <option value="ready_to_pay">Төлбөр төлөх</option>
          <option value="completed">Дууссан</option>
          <option value="no_show">Ирээгүй</option>
          <option value="cancelled">Цуцалсан</option>
          <option value="other">Бусад</option>
        </select>
      </label>

      <button
        type="button"
        onClick={() => handleSaveStatus(a)}
        disabled={saving}
        style={{
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 6,
          border: "none",
          background: "#16a34a",
          color: "white",
          cursor: saving ? "default" : "pointer",
        }}
      >
        {saving ? "Хадгалж байна..." : "Хадгалах"}
      </button>

      <button
        type="button"
        onClick={handleCancelEdit}
        disabled={saving}
        style={{
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 6,
          border: "1px solid #d1d5db",
          background: "#f9fafb",
          cursor: saving ? "default" : "pointer",
        }}
      >
        Цуцлах
      </button>
    </div>

    {needsExplanation && (
      <div style={{ marginTop: 6 }}>
        <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
          Тайлбар (заавал биш)
        </label>
        <textarea
          value={editingNote}
          onChange={(e) => setEditingNote(e.target.value)}
          placeholder="Ж: Өвчтөн ирээгүй, утас нь салгаатай байсан..."
          style={{
            width: "100%",
            minHeight: 60,
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
            fontSize: 12,
            resize: "vertical",
          }}
        />
      </div>
    )}
    </div>
)}
                    
                  <div style={{ color: "#4b5563" }}>
                    <strong>Цаг захиалга:</strong>{" "}
                    {formatDetailedTimeRange(start, end)}
                  </div>
                  <div style={{ color: "#4b5563" }}>
                    <strong>Тэмдэглэл:</strong> {a.notes || "-"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 8,
              color: "#b91c1c",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
}

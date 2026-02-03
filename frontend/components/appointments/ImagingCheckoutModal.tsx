import React, { useState, useEffect } from "react";

type Service = {
  id: number;
  code?: string | null;
  name: string;
  category: string;
  price: number;
};

type Nurse = {
  id: number;
  name: string;
};

type Performer = {
  type: "DOCTOR" | "NURSE" | null;
  doctorName?: string;
  nurseName?: string;
  nurseId?: number;
};

type ImagingCheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  appointmentId: number;
  branchId: number;
  doctorName?: string;
  existingPerformer?: Performer;
  onSuccess?: (encounterId: number) => void;
};

export default function ImagingCheckoutModal({
  open,
  onClose,
  appointmentId,
  branchId,
  doctorName,
  existingPerformer,
  onSuccess,
}: ImagingCheckoutModalProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [performerType, setPerformerType] = useState<"DOCTOR" | "NURSE">(
    existingPerformer?.type || "DOCTOR"
  );
  const [selectedNurseId, setSelectedNurseId] = useState<number | null>(
    existingPerformer?.nurseId || null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingNurses, setLoadingNurses] = useState(false);

  const isPerformerSet = !!(existingPerformer?.type);

  // Fetch IMAGING services
  useEffect(() => {
    if (!open) return;

    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const res = await fetch("/api/services");
        if (!res.ok) throw new Error("Failed to fetch services");

        const data = await res.json();
        const imagingServices = data.filter(
          (s: Service) => s.category === "IMAGING"
        );
        setServices(imagingServices);
      } catch (err) {
        console.error("Error fetching services:", err);
        setError("Үйлчилгээ ачаалахад алдаа гарлаа");
      } finally {
        setLoadingServices(false);
      }
    };

    fetchServices();
  }, [open]);

  // Fetch nurses on shift
  useEffect(() => {
    if (!open || performerType !== "NURSE") return;

    const fetchNurses = async () => {
      setLoadingNurses(true);
      try {
        const res = await fetch(
          `/api/users/nurses/today?branchId=${branchId}`
        );
        if (!res.ok) throw new Error("Failed to fetch nurses");

        const data = await res.json();
        
        // Extract nurses from the response structure
        const nurseList = (data.items || []).map((item: any) => ({
          id: item.nurseId,
          name: item.name,
        }));
        
        setNurses(nurseList);
      } catch (err) {
        console.error("Error fetching nurses:", err);
        setError("Сувилагч нарыг ачаалахад алдаа гарлаа");
      } finally {
        setLoadingNurses(false);
      }
    };

    fetchNurses();
  }, [open, performerType, branchId]);

  const handleServiceToggle = (serviceId: number) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSave = async () => {
    setError("");

    // Validate performer is set
    if (!isPerformerSet) {
      if (performerType === "NURSE" && !selectedNurseId) {
        setError("Сувилагчийг сонгоно уу");
        return;
      }

      // Set performer first if not already set
      setLoading(true);
      try {
        const performerRes = await fetch(
          `/api/appointments/${appointmentId}/imaging/set-performer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              performerType,
              nurseId: performerType === "NURSE" ? selectedNurseId : null,
            }),
          }
        );

        if (!performerRes.ok) {
          const errData = await performerRes.json();
          throw new Error(errData.error || "Failed to set performer");
        }
      } catch (err: any) {
        setError(err.message || "Гүйцэтгэгч тохируулахад алдаа гарлаа");
        setLoading(false);
        return;
      }
    }

    // Transition to ready_to_pay with services
    try {
      const transitionRes = await fetch(
        `/api/appointments/${appointmentId}/imaging/transition-to-ready`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceIds: selectedServiceIds,
          }),
        }
      );

      if (!transitionRes.ok) {
        const errData = await transitionRes.json();
        
        // Handle duplicate error specially
        if (errData.duplicates && Array.isArray(errData.duplicates)) {
          setError(
            `${errData.error}\n${errData.duplicates.join("\n")}`
          );
          setLoading(false);
          return;
        }
        
        throw new Error(errData.error || "Failed to transition");
      }

      const result = await transitionRes.json();
      
      // Success - redirect to billing
      if (onSuccess && result.encounterId) {
        onSuccess(result.encounterId);
      }
      
      onClose();
    } catch (err: any) {
      setError(err.message || "Төлбөр төлөх төлөвт шилжүүлэхэд алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 70,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 500,
          maxWidth: "90vw",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: 8,
          boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
          padding: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            Зураг авалт - Үйлчилгээ нэмэх
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: 10,
              marginBottom: 12,
              background: "#fee2e2",
              border: "1px solid #ef4444",
              borderRadius: 6,
              color: "#991b1b",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </div>
        )}

        {/* Performer Section */}
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Гүйцэтгэгч
          </h4>

          {isPerformerSet ? (
            <div
              style={{
                padding: 10,
                background: "#f3f4f6",
                borderRadius: 6,
                fontSize: 13,
                color: "#4b5563",
              }}
            >
              {existingPerformer?.type === "DOCTOR" ? (
                <>
                  <strong>Эмч:</strong> {existingPerformer.doctorName || doctorName || "-"}
                </>
              ) : (
                <>
                  <strong>Сувилагч:</strong> {existingPerformer.nurseName || "-"}
                </>
              )}
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Гүйцэтгэгч өөрчлөх боломжгүй
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="performerType"
                    value="DOCTOR"
                    checked={performerType === "DOCTOR"}
                    onChange={() => setPerformerType("DOCTOR")}
                  />
                  <span style={{ fontSize: 13 }}>
                    Эмч: {doctorName || "-"}
                  </span>
                </label>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="performerType"
                    value="NURSE"
                    checked={performerType === "NURSE"}
                    onChange={() => setPerformerType("NURSE")}
                  />
                  <span style={{ fontSize: 13 }}>Сувилагч</span>
                </label>
              </div>

              {performerType === "NURSE" && (
                <div style={{ marginLeft: 24 }}>
                  {loadingNurses ? (
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      Ачаалж байна...
                    </div>
                  ) : nurses.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#ef4444" }}>
                      Ээлжит сувилагч байхгүй байна
                    </div>
                  ) : (
                    <select
                      value={selectedNurseId || ""}
                      onChange={(e) =>
                        setSelectedNurseId(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                      }}
                    >
                      <option value="">-- Сонгох --</option>
                      {nurses.map((nurse) => (
                        <option key={nurse.id} value={nurse.id}>
                          {nurse.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Services Section */}
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Үйлчилгээ сонгох (зураг авалт)
          </h4>

          {loadingServices ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Үйлчилгээ ачаалж байна...
            </div>
          ) : services.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Зураг авалтын үйлчилгээ олдсонгүй
            </div>
          ) : (
            <div
              style={{
                maxHeight: 250,
                overflowY: "auto",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: 8,
              }}
            >
              {services.map((service) => (
                <label
                  key={service.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    cursor: "pointer",
                    borderRadius: 4,
                    background: selectedServiceIds.includes(service.id)
                      ? "#ede9fe"
                      : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.includes(service.id)}
                    onChange={() => handleServiceToggle(service.id)}
                  />
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <div>
                      {service.code && (
                        <span style={{ color: "#6b7280", marginRight: 4 }}>
                          [{service.code}]
                        </span>
                      )}
                      {service.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      {service.price.toLocaleString()}₮
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#ffffff",
              fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Цуцлах
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || (performerType === "NURSE" && !selectedNurseId && !isPerformerSet)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: loading ? "#9ca3af" : "#8b5cf6",
              color: "#ffffff",
              fontSize: 13,
              cursor:
                loading || (performerType === "NURSE" && !selectedNurseId && !isPerformerSet)
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {loading ? "Хадгалж байна..." : "Төлбөр авах руу шилжих"}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import MediaGallery from "../components/encounter/MediaGallery";
import type { AppointmentRow } from "../types/appointments";
import type { EncounterMedia, Service, Nurse } from "../types/encounter-admin";

type XrayAppointment = AppointmentRow & {
  branchId?: number;
};

export default function XrayPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [searchText, setSearchText] = useState("");
  const [appointments, setAppointments] = useState<XrayAppointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<XrayAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<XrayAppointment | null>(null);

  // Encounter and media state
  const [encounterId, setEncounterId] = useState<number | null>(null);
  const [media, setMedia] = useState<EncounterMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Performer state (for imaging appointments)
  const [performerType, setPerformerType] = useState<"DOCTOR" | "NURSE">("DOCTOR");
  const [selectedNurseId, setSelectedNurseId] = useState<number | null>(null);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loadingNurses, setLoadingNurses] = useState(false);

  // Service state (for imaging appointments)
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Action state
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load appointments with ongoing or imaging status
  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("dateFrom", dateFrom);
        params.set("dateTo", dateTo);
        // Fetch all appointments and filter in the UI
        const res = await fetch(`/api/appointments?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch appointments");
        
        const data = await res.json();
        const filtered = Array.isArray(data) 
          ? data.filter((a: XrayAppointment) => 
              a.status === "ongoing" || a.status === "imaging"
            )
          : [];
        setAppointments(filtered);
      } catch (err: any) {
        setError(err.message || "Цаг татахад алдаа гарлаа");
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [dateFrom, dateTo]);

  // Filter appointments by search text
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredAppointments(appointments);
      return;
    }
    const lowerSearch = searchText.toLowerCase();
    const filtered = appointments.filter((a) => {
      return (
        a.patientName?.toLowerCase().includes(lowerSearch) ||
        a.regNo?.toLowerCase().includes(lowerSearch) ||
        a.doctorName?.toLowerCase().includes(lowerSearch)
      );
    });
    setFilteredAppointments(filtered);
  }, [searchText, appointments]);

  // Load encounter when appointment is selected
  useEffect(() => {
    if (!selectedAppt) {
      setEncounterId(null);
      setMedia([]);
      setPerformerType("DOCTOR");
      setSelectedNurseId(null);
      setSelectedServiceIds([]);
      return;
    }

    const ensureEncounter = async () => {
      try {
        const res = await fetch(`/api/appointments/${selectedAppt.id}/ensure-encounter`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to ensure encounter");
        }
        const data = await res.json();
        setEncounterId(data.encounterId);
      } catch (err: any) {
        setError(err.message || "Үзлэг үүсгэхэд алдаа гарлаа");
      }
    };

    ensureEncounter();
  }, [selectedAppt]);

  // Load media when encounter is set
  useEffect(() => {
    if (!encounterId) return;

    const fetchMedia = async () => {
      setMediaLoading(true);
      setMediaError("");
      try {
        const res = await fetch(`/api/encounters/${encounterId}/media?type=XRAY`);
        if (!res.ok) throw new Error("Failed to fetch media");
        const data = await res.json();
        setMedia(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setMediaError(err.message || "Зураг татахад алдаа гарлаа");
      } finally {
        setMediaLoading(false);
      }
    };

    fetchMedia();
  }, [encounterId]);

  // Load nurses if imaging appointment
  useEffect(() => {
    if (!selectedAppt || selectedAppt.status !== "imaging") return;
    if (!selectedAppt.branchId) {
      console.warn("Branch ID not available for appointment", selectedAppt.id);
      return;
    }

    const fetchNurses = async () => {
      setLoadingNurses(true);
      try {
        const res = await fetch(`/api/users/nurses/today?branchId=${selectedAppt.branchId}`);
        if (!res.ok) throw new Error("Failed to fetch nurses");
        const data = await res.json();
        const nurseItems = data.items || [];
        setNurses(nurseItems.map((n: any) => ({
          id: n.nurseId,
          name: n.name,
          email: "",
        })));
      } catch (err: any) {
        console.error("Error fetching nurses:", err);
      } finally {
        setLoadingNurses(false);
      }
    };

    fetchNurses();
  }, [selectedAppt]);

  // Load services if imaging appointment
  useEffect(() => {
    if (!selectedAppt || selectedAppt.status !== "imaging") return;

    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const res = await fetch("/api/services");
        if (!res.ok) throw new Error("Failed to fetch services");
        const data = await res.json();
        const imagingServices = data.filter((s: Service) => s.category === "IMAGING");
        setServices(imagingServices);
      } catch (err: any) {
        console.error("Error fetching services:", err);
      } finally {
        setLoadingServices(false);
      }
    };

    fetchServices();
  }, [selectedAppt]);

  const handleMediaUpload = async (file: File) => {
    if (!encounterId) return;

    setUploadingMedia(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "XRAY");

      const res = await fetch(`/api/encounters/${encounterId}/media`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Зураг хуулахад алдаа гарлаа");
      }

      // Reload media
      const mediaRes = await fetch(`/api/encounters/${encounterId}/media?type=XRAY`);
      if (mediaRes.ok) {
        const data = await mediaRes.json();
        setMedia(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      setError(err.message || "Зураг хуулахад алдаа гарлаа");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleMediaReload = async () => {
    if (!encounterId) return;

    setMediaLoading(true);
    setMediaError("");
    try {
      const res = await fetch(`/api/encounters/${encounterId}/media?type=XRAY`);
      if (!res.ok) throw new Error("Failed to fetch media");
      const data = await res.json();
      setMedia(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setMediaError(err.message || "Зураг татахад алдаа гарлаа");
    } finally {
      setMediaLoading(false);
    }
  };

  const handleSavePerformer = async () => {
    if (!selectedAppt || selectedAppt.status !== "imaging") return;

    // Validate nurse selection if performer type is NURSE
    if (performerType === "NURSE" && !selectedNurseId) {
      setError("Сувилагч сонгоно уу");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      const performerRes = await fetch(
        `/api/appointments/${selectedAppt.id}/imaging/set-performer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            performerType,
            nurseId: performerType === "NURSE" ? selectedNurseId : undefined,
          }),
        }
      );

      if (!performerRes.ok) {
        const data = await performerRes.json();
        throw new Error(data.error || "Гүйцэтгэгч хадгалахад алдаа гарлаа");
      }

      setSuccessMsg("Гүйцэтгэгч амжилттай хадгалагдлаа");
    } catch (err: any) {
      setError(err.message || "Хадгалахад алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  const handleTransitionToReady = async () => {
    if (!selectedAppt || selectedAppt.status !== "imaging") return;

    // Validate performer selection
    if (performerType === "NURSE" && !selectedNurseId) {
      setError("Төлбөрт шилжүүлэхээс өмнө сувилагч сонгоно уу");
      return;
    }

    // Validate service selection
    if (selectedServiceIds.length === 0) {
      setError("Төлбөрт шилжүүлэхээс өмнө үйлчилгээ сонгоно уу");
      return;
    }

    setTransitioning(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(
        `/api/appointments/${selectedAppt.id}/imaging/transition-to-ready`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceIds: selectedServiceIds }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Төлбөрт шилжүүлэхэд алдаа гарлаа");
      }

      setSuccessMsg("Төлбөрт амжилттай шилжүүллээ");
      
      // Remove from list since status changed
      setTimeout(() => {
        setSelectedAppt(null);
        setAppointments((prev) => prev.filter((a) => a.id !== selectedAppt.id));
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Төлбөрт шилжүүлэхэд алдаа гарлаа");
    } finally {
      setTransitioning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "ongoing") {
      return (
        <span
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 12,
            background: "#fef3c7",
            color: "#92400e",
          }}
        >
          Явагдаж байна
        </span>
      );
    }
    if (status === "imaging") {
      return (
        <span
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 12,
            background: "#dbeafe",
            color: "#1e40af",
          }}
        >
          Зураг
        </span>
      );
    }
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          XRAY ажлын өрөө
        </h1>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left panel: appointment list */}
        <div
          style={{
            width: 400,
            borderRight: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            background: "#f9fafb",
          }}
        >
          <div style={{ padding: 12 }}>
            <input
              type="text"
              placeholder="Өвчтөний нэр, РД хайх..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 8,
              }}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>
            {loading && <div style={{ fontSize: 13 }}>Уншиж байна...</div>}
            {error && (
              <div style={{ color: "red", fontSize: 13, marginTop: 8 }}>
                {error}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredAppointments.length === 0 ? (
              <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>
                Цаг олдсонгүй
              </div>
            ) : (
              filteredAppointments.map((appt) => (
                <div
                  key={appt.id}
                  onClick={() => setSelectedAppt(appt)}
                  style={{
                    padding: 12,
                    borderBottom: "1px solid #e5e7eb",
                    cursor: "pointer",
                    background:
                      selectedAppt?.id === appt.id ? "#eff6ff" : "white",
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
                    <span style={{ fontSize: 14, fontWeight: 500 }}>
                      {appt.patientName}
                    </span>
                    {getStatusBadge(appt.status)}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    РД: {appt.regNo || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Эмч: {appt.doctorName || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Цаг:{" "}
                    {appt.startTime
                      ? new Date(appt.startTime).toLocaleTimeString("mn-MN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel: appointment details */}
        <div
          style={{
            flex: 1,
            padding: 16,
            overflowY: "auto",
            background: "white",
          }}
        >
          {!selectedAppt ? (
            <div style={{ fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 100 }}>
              Цаг сонгоно уу
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                    {selectedAppt.patientName}
                  </h2>
                  {getStatusBadge(selectedAppt.status)}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  РД: {selectedAppt.regNo || "—"}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  Эмч: {selectedAppt.doctorName || "—"}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  Салбар: {selectedAppt.branchName || "—"}
                </div>
              </div>

              {successMsg && (
                <div
                  style={{
                    padding: 12,
                    background: "#d1fae5",
                    color: "#065f46",
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: 13,
                  }}
                >
                  {successMsg}
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: 12,
                    background: "#fee2e2",
                    color: "#991b1b",
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}

              {/* Media section - shown for all statuses */}
              <MediaGallery
                media={media}
                mediaLoading={mediaLoading}
                mediaError={mediaError}
                uploadingMedia={uploadingMedia}
                onUpload={handleMediaUpload}
                onReload={handleMediaReload}
              />

              {/* Imaging-specific section */}
              {selectedAppt.status === "imaging" && (
                <div style={{ marginTop: 24 }}>
                  <div
                    style={{
                      borderTop: "1px dashed #e5e7eb",
                      paddingTop: 16,
                      marginBottom: 16,
                    }}
                  >
                    <h3 style={{ fontSize: 14, marginBottom: 8 }}>
                      Гүйцэтгэгч сонгох
                    </h3>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                        Төрөл:
                      </label>
                      <select
                        value={performerType}
                        onChange={(e) =>
                          setPerformerType(e.target.value as "DOCTOR" | "NURSE")
                        }
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid #d1d5db",
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      >
                        <option value="DOCTOR">Эмч</option>
                        <option value="NURSE">Сувилагч</option>
                      </select>
                    </div>

                    {performerType === "NURSE" && (
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                          Сувилагч:
                        </label>
                        {loadingNurses ? (
                          <div style={{ fontSize: 13 }}>Уншиж байна...</div>
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
                              padding: "8px 12px",
                              border: "1px solid #d1d5db",
                              borderRadius: 6,
                              fontSize: 13,
                            }}
                          >
                            <option value="">-- Сонгох --</option>
                            {nurses.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {performerType === "DOCTOR" && (
                      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
                        Эмч: {selectedAppt.doctorName || "—"}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      borderTop: "1px dashed #e5e7eb",
                      paddingTop: 16,
                      marginBottom: 16,
                    }}
                  >
                    <h3 style={{ fontSize: 14, marginBottom: 8 }}>
                      Үйлчилгээ сонгох
                    </h3>
                    {loadingServices ? (
                      <div style={{ fontSize: 13 }}>Уншиж байна...</div>
                    ) : (
                      <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}>
                        {services.map((s) => (
                          <label
                            key={s.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "6px 8px",
                              cursor: "pointer",
                              borderRadius: 4,
                              fontSize: 13,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedServiceIds.includes(s.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedServiceIds((prev) => [...prev, s.id]);
                                } else {
                                  setSelectedServiceIds((prev) =>
                                    prev.filter((id) => id !== s.id)
                                  );
                                }
                              }}
                              style={{ marginRight: 8 }}
                            />
                            <span>
                              {s.code || s.id}: {s.name} ({s.price}₮)
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={handleSavePerformer}
                      disabled={saving || (performerType === "NURSE" && !selectedNurseId)}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: saving || (performerType === "NURSE" && !selectedNurseId) ? "default" : "pointer",
                        opacity: saving || (performerType === "NURSE" && !selectedNurseId) ? 0.6 : 1,
                      }}
                    >
                      {saving ? "Хадгалж байна..." : "Гүйцэтгэгч хадгалах"}
                    </button>
                    <button
                      onClick={handleTransitionToReady}
                      disabled={transitioning}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        background: "#16a34a",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: transitioning ? "default" : "pointer",
                        opacity: transitioning ? 0.6 : 1,
                      }}
                    >
                      {transitioning ? "Шилжүүлж байна..." : "Төлбөрт шилжүүлэх"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

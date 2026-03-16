/**
 * /check-in?branchId=1
 *
 * Tablet-facing patient self-check-in page.
 * No authentication required — accessible by patients at the clinic entrance.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

interface SearchResult {
  patientId: number;
  appointmentId: number;
  maskedName: string;
  scheduledAt: string;
  doctorDisplay: string | null;
  branchId: number;
  checkedInAt: string | null;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return iso;
  }
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CheckInPage() {
  const router = useRouter();
  const { branchId } = router.query;

  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    number | null
  >(null);
  const [confirming, setConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);

  // Validate branchId from URL
  useEffect(() => {
    if (!router.isReady) return;
    const bid = branchId;
    if (!bid || Array.isArray(bid) || Number.isNaN(Number(bid)) || Number(bid) <= 0) {
      setBranchError("Салбарын дугаар буруу эсвэл байхгүй байна. URL-д ?branchId=1 гэж оруулна уу.");
    } else {
      setBranchError(null);
    }
  }, [router.isReady, branchId]);

  const doSearch = useCallback(
    async (value: string) => {
      const bid = Array.isArray(branchId) ? branchId[0] : branchId;
      if (!bid || !value || value.length < 4) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      setSearched(false);
      setSelectedAppointmentId(null);
      setSuccessMessage(null);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams({
          branchId: bid,
          phone: value,
          date: todayDateStr(),
        });
        const res = await fetch(`/api/check-in/search?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setResults([]);
        } else {
          setResults(Array.isArray(data) ? data : []);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    },
    [branchId]
  );

  // Debounce search on phone input
  useEffect(() => {
    if (!router.isReady || branchError) return;
    if (phone.length < 4) {
      setResults([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(() => {
      doSearch(phone);
    }, 400);
    return () => clearTimeout(t);
  }, [phone, doSearch, router.isReady, branchError]);

  const handleSelect = (appointmentId: number) => {
    setSelectedAppointmentId(
      selectedAppointmentId === appointmentId ? null : appointmentId
    );
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleConfirm = async () => {
    if (!selectedAppointmentId) return;
    setConfirming(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/check-in/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: selectedAppointmentId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(data.message);
        setPhone("");
        setResults([]);
        setSearched(false);
        setSelectedAppointmentId(null);
      } else if (res.status === 409 && data.alreadyCheckedIn) {
        setErrorMessage(data.message);
      } else {
        setErrorMessage(data.error || "Алдаа гарлаа. Дахин оролдоно уу.");
      }
    } catch {
      setErrorMessage("Холболтын алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setPhone("");
    setResults([]);
    setSearched(false);
    setSelectedAppointmentId(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Show branch error full-screen
  if (router.isReady && branchError) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f0f4f8",
          fontFamily: "sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 32,
            maxWidth: 480,
            textAlign: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <p style={{ color: "#b91c1c", fontSize: 16 }}>{branchError}</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Бүртгэл баталгаажуулах</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "40px 16px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            background: "#ffffff",
            borderRadius: 20,
            boxShadow: "0 8px 48px rgba(0,0,0,0.24)",
            padding: "36px 32px 40px",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🏥</div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#0f172a",
                margin: "0 0 8px",
              }}
            >
              Бүртгэл баталгаажуулах
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
              Өнөөдрийн цагийн захиалгаа баталгаажуулна уу
            </p>
          </div>

          {/* Success screen */}
          {successMessage ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
              <p
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#15803d",
                  lineHeight: 1.5,
                  marginBottom: 24,
                }}
              >
                {successMessage}
              </p>
              <button
                onClick={handleReset}
                style={{
                  background: "#0f172a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 28px",
                  fontSize: 15,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Буцах
              </button>
            </div>
          ) : (
            <>
              {/* Phone input */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#1e293b",
                    marginBottom: 8,
                  }}
                >
                  Бүртгэлтэй утасны дугаар оруулах
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setSelectedAppointmentId(null);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  placeholder="Утасны дугаар"
                  autoFocus
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    fontSize: 20,
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "2px solid #e2e8f0",
                    outline: "none",
                    color: "#0f172a",
                    letterSpacing: 1,
                  }}
                />
              </div>

              {/* Loading */}
              {loading && (
                <div
                  style={{
                    textAlign: "center",
                    color: "#94a3b8",
                    padding: "12px 0",
                    fontSize: 14,
                  }}
                >
                  Хайж байна...
                </div>
              )}

              {/* No results */}
              {!loading && searched && results.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "16px",
                    borderRadius: 10,
                    background: "#fef2f2",
                    color: "#b91c1c",
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                >
                  Цаг захиалгатай үйлчлүүлэгч олдсонгүй.
                </div>
              )}

              {/* Results list */}
              {!loading && results.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {results.map((r) => {
                    const isSelected = selectedAppointmentId === r.appointmentId;
                    return (
                      <button
                        key={r.appointmentId}
                        onClick={() => handleSelect(r.appointmentId)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          width: "100%",
                          textAlign: "left",
                          background: isSelected ? "#eff6ff" : "#f8fafc",
                          border: isSelected
                            ? "2px solid #3b82f6"
                            : "2px solid #e2e8f0",
                          borderRadius: 12,
                          padding: "14px 16px",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {r.maskedName}
                        </span>
                        <span style={{ fontSize: 13, color: "#64748b" }}>
                          🕐 {formatTime(r.scheduledAt)}
                          {r.doctorDisplay ? `  |  👨‍⚕️ ${r.doctorDisplay}` : ""}
                        </span>
                        {r.checkedInAt && (
                          <span
                            style={{
                              fontSize: 12,
                              color: "#15803d",
                              fontWeight: 600,
                            }}
                          >
                            ✓ Баталгаажсан
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Error message */}
              {errorMessage && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "#fef2f2",
                    color: "#b91c1c",
                    fontSize: 15,
                    fontWeight: 500,
                    textAlign: "center",
                  }}
                >
                  {errorMessage}
                </div>
              )}

              {/* Confirm button */}
              {selectedAppointmentId !== null && !errorMessage && (
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    marginTop: 20,
                    width: "100%",
                    background: confirming ? "#94a3b8" : "#1d4ed8",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    padding: "16px",
                    fontSize: 17,
                    fontWeight: 700,
                    cursor: confirming ? "not-allowed" : "pointer",
                    letterSpacing: 0.5,
                    transition: "background 0.15s",
                  }}
                >
                  {confirming ? "Баталгаажуулж байна..." : "Баталгаажуулах"}
                </button>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

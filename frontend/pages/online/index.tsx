// frontend/pages/online/index.tsx
// Public online booking mini-site – served at online.mdent.mn
// No admin sidebar; responsive; step-based UI.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Branch = { id: number; name: string; address?: string | null };

type ServiceCategory = {
  category: string;
  label: string;
  durationMinutes: number;
};
type OnlineBookingServiceType = "CONSULTATION" | "TREATMENT";

type Doctor = {
  id: number;
  name: string;
  scheduleStart: string;
  scheduleEnd: string;
};

type BookingGrid = {
  doctors: Doctor[];
  slots: string[]; // "HH:MM"
  busy: string[]; // "doctorId:startTime"
  durationMinutes: number;
};

type HoldResponse = {
  bookingId: number;
  expiresAt: string;
  qpayInvoiceId: string;
  qrText: string;
  qrImage: string; // base64 PNG
  urls?: { name: string; description: string; logo: string; link: string }[];
};

type PaymentStatus = "PENDING" | "PAID" | "EXPIRED";
type DraftMatchStatus = "NEW" | "EXISTING" | "DUPLICATE_NEEDS_REVIEW";

// ─── Personal info ─────────────────────────────────────────────────────────

type PersonalInfo = {
  ovog: string;
  name: string;
  phone: string;
  regNo: string;
};

// ─── Steps ────────────────────────────────────────────────────────────────────
// 1 = personal details
// 2 = service type + category selection
// 3 = branch + date
// 4 = booking grid
// 5 = payment
// 6 = confirmation / expired

type Step = 1 | 2 | 3 | 4 | 5 | 6;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

const BTN_PRIMARY: React.CSSProperties = {
  background: "#f97316",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "12px 28px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};

const BTN_GHOST: React.CSSProperties = {
  background: "transparent",
  color: "#6b7280",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 14,
  cursor: "pointer",
};

const CONSULTATION_CATEGORY_ORDER = [
  "ORTHODONTIC_TREATMENT",
  "ADULT_TREATMENT",
  "SURGERY",
  "DEFECT_CORRECTION",
  "CHILD_TREATMENT",
];
const CONSULTATION_CATEGORY_LABELS: Record<string, string> = {
  ORTHODONTIC_TREATMENT: "Гажиг заслын зөвлөгөө",
  ADULT_TREATMENT: "Том хүний эмчилгээний зөвлөгөө",
  SURGERY: "Мэс заслын зөвлөгөө",
  DEFECT_CORRECTION: "Согог заслын зөвлөгөө",
  CHILD_TREATMENT: "Хүүхдийн эмчилгээний зөвлөгөө",
};

// ─── Page Component ───────────────────────────────────────────────────────────

export default function OnlineBookingPage() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 – personal details
  const [info, setInfo] = useState<PersonalInfo>({ ovog: "", name: "", phone: "", regNo: "" });
  const [infoErrors, setInfoErrors] = useState<Partial<PersonalInfo>>({});
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftMatchStatus, setDraftMatchStatus] = useState<DraftMatchStatus | null>(null);
  const [draftExpiresAt, setDraftExpiresAt] = useState<string | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Step 2 – service type + category
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<OnlineBookingServiceType>("TREATMENT");
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Step 3 – branch + date
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());

  // Step 4 – grid
  const [grid, setGrid] = useState<BookingGrid | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);

  // Step 5 – payment
  const [holdData, setHoldData] = useState<HoldResponse | null>(null);
  const [holdLoading, setHoldLoading] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PENDING");
  const [timeLeft, setTimeLeft] = useState<number>(600); // seconds
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Booking summary for confirmation
  const [bookingSummary, setBookingSummary] = useState<{
    doctorName: string;
    date: string;
    startTime: string;
    endTime: string;
    categoryLabel: string;
  } | null>(null);

  // ── Load branches on mount ────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/public/branches")
      .then((r) => r.json())
      .then((data: Branch[]) => {
        if (Array.isArray(data)) {
          setBranches(data);
          if (data.length > 0) setSelectedBranchId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // ── Load treatment categories (branch-agnostic) ─────────────────────────

  useEffect(() => {
    setLoadingCategories(true);
    setCategories([]);
    fetch("/api/public/service-categories")
      .then((r) => r.json())
      .then((data: ServiceCategory[]) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {})
      .finally(() => setLoadingCategories(false));
  }, []);

  const displayedCategories = useMemo<ServiceCategory[]>(() => {
    if (selectedServiceType === "CONSULTATION") {
      return CONSULTATION_CATEGORY_ORDER.map((category) => ({
        category,
        label: CONSULTATION_CATEGORY_LABELS[category] || category,
        durationMinutes: 30,
      }));
    }
    return categories;
  }, [categories, selectedServiceType]);

  // ── Load grid when entering step 4 ───────────────────────────────────────

  const loadGrid = useCallback(async () => {
    if (!selectedBranchId || !selectedCategory || !selectedDate) return;
    setLoadingGrid(true);
    setGridError(null);
    setGrid(null);
    try {
      const url = `/api/public/booking-grid?branchId=${selectedBranchId}&category=${encodeURIComponent(selectedCategory.category)}&date=${selectedDate}&serviceType=${selectedServiceType}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setGridError(data.error || "Алдаа гарлаа");
        return;
      }
      setGrid(data);
    } catch {
      setGridError("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setLoadingGrid(false);
    }
  }, [selectedBranchId, selectedCategory, selectedDate, selectedServiceType]);

  useEffect(() => {
    if (step === 4) loadGrid();
  }, [step, loadGrid]);

  // ── Payment polling ───────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback((draftIdForPolling: number, expiresAt: Date) => {
    const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    setTimeLeft(secondsLeft);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/online-booking/drafts/${draftIdForPolling}/payment-status`);
        const data = await res.json();
        if (data.status === "PAID") {
          setPaymentStatus("PAID");
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setStep(6);
        } else if (data.status === "EXPIRED" || data.status === "CANCELLED") {
          setPaymentStatus("EXPIRED");
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setStep(6);
        }
      } catch (_e) {
        // ignore poll errors; will retry
      }
    }, 5000);
  }, []); // State setters (setPaymentStatus, setStep, setTimeLeft) are stable refs from useState; refs are mutable objects excluded from deps

  // ── Handlers ─────────────────────────────────────────────────────────────

  function validatePersonalInfo(): boolean {
    const errors: Partial<PersonalInfo> = {};
    if (!info.ovog.trim()) errors.ovog = "Овог оруулна уу";
    if (!info.name.trim()) errors.name = "Нэр оруулна уу";
    if (!info.phone.trim()) errors.phone = "Утасны дугаар оруулна уу";
    if (!info.regNo.trim()) errors.regNo = "Регистр оруулна уу";
    setInfoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function updateDraft(payload: Record<string, unknown>, fallbackError: string): Promise<boolean> {
    if (!draftId) {
      setStartError("Draft олдсонгүй. Мэдээллийн алхмыг дахин бөглөнө үү.");
      setStep(1);
      return false;
    }

    try {
      const res = await fetch(`/api/public/online-booking/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStartError(data.error || fallbackError);
        return false;
      }
      if (typeof data.expiresAt === "string") {
        setDraftExpiresAt(data.expiresAt);
      }
      return true;
    } catch {
      setStartError("Сүлжээний алдаа. Дахин оролдоно уу.");
      return false;
    }
  }

  async function handleStep1Continue() {
    if (!validatePersonalInfo()) return;

    setStartLoading(true);
    setStartError(null);
    try {
      const res = await fetch("/api/public/online-booking/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ovog: info.ovog,
          name: info.name,
          phone: info.phone,
          regNo: info.regNo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStartError(data.error || "Мэдээлэл хадгалах үед алдаа гарлаа.");
        return;
      }
      setDraftId(data.draftId || null);
      setDraftMatchStatus((data.matchStatus as DraftMatchStatus) || null);
      setDraftExpiresAt(data.expiresAt || null);
      setStep(2);
    } catch {
      setStartError("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setStartLoading(false);
    }
  }

  async function handleSlotClick(doctor: Doctor, slotTime: string) {
    if (!selectedBranchId || !selectedCategory || !selectedDate || !draftId) return;
    const endTime = addMinutes(slotTime, selectedCategory.durationMinutes);
    setHoldError(null);
    setStartError(null);
    setHoldLoading(true);
    stopPolling();
    try {
      const syncOk = await updateDraft(
        {
          serviceType: selectedServiceType,
          serviceCategory: selectedCategory.category,
          selectedDate,
          selectedStartTime: slotTime,
          selectedEndTime: endTime,
        },
        "Draft шинэчлэхэд алдаа гарлаа."
      );
      if (!syncOk) return;

      const res = await fetch(`/api/public/online-booking/drafts/${draftId}/init-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor.id,
          startTime: slotTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHoldError(data.error || "Цаг захиалах боломжгүй байна");
        return;
      }
      setHoldData(data);
      setBookingSummary({
        doctorName: doctor.name,
        date: selectedDate,
        startTime: slotTime,
        endTime,
        categoryLabel: selectedCategory.label,
      });
      setPaymentStatus("PENDING");
      setStep(5);
      if (typeof data.expiresAt === "string") {
        setDraftExpiresAt(data.expiresAt);
      }
      startPolling(draftId, new Date(data.expiresAt));
    } catch {
      setHoldError("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setHoldLoading(false);
    }
  }

  function handleRestart() {
    stopPolling();
    setHoldData(null);
    setHoldError(null);
    setBookingSummary(null);
    setPaymentStatus("PENDING");
    setGrid(null);
    setSelectedServiceType("TREATMENT");
    setSelectedCategory(null);
    setSelectedDate(todayStr());
    setDraftId(null);
    setDraftMatchStatus(null);
    setDraftExpiresAt(null);
    setStartError(null);
    setStartLoading(false);
    setStep(1);
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  const progressSteps = ["Мэдээлэл", "Үйлчилгээ", "Салбар/Өдөр", "Цаг", "Төлбөр"];

  function renderProgress() {
    const activeStep = step > 5 ? 5 : step;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
        {progressSteps.map((label, i) => {
          const num = i + 1;
          const done = num < activeStep;
          const active = num === activeStep;
          return (
            <React.Fragment key={num}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: done ? "#22c55e" : active ? "#f97316" : "#e5e7eb",
                  color: done || active ? "#fff" : "#9ca3af",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 14,
                }}>
                  {done ? "✓" : num}
                </div>
                <span style={{ fontSize: 11, color: active ? "#f97316" : "#6b7280", fontWeight: active ? 600 : 400 }}>
                  {label}
                </span>
              </div>
              {i < progressSteps.length - 1 && (
                <div style={{ flex: 2, height: 2, background: done ? "#22c55e" : "#e5e7eb", marginBottom: 18 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // ── Steps render ─────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Таны мэдээлэл</h2>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
          Цаг захиалахын тулд дараах талбаруудыг бөглөнө үү.
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {(["ovog", "name", "phone", "regNo"] as const).map((field) => {
            const labels = { ovog: "Овог *", name: "Нэр *", phone: "Утас *", regNo: "Регистрийн дугаар *" };
            const placeholders = { ovog: "Овгоо оруулна уу", name: "Нэрээ оруулна уу", phone: "Утасны дугаар", regNo: "Регистрийн дугаар" };
            return (
              <div key={field}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                  {labels[field]}
                </label>
                <input
                  style={{ ...INPUT_STYLE, borderColor: infoErrors[field] ? "#ef4444" : "#d1d5db" }}
                  placeholder={placeholders[field]}
                  value={info[field]}
                  onChange={(e) => {
                    setInfo((prev) => ({ ...prev, [field]: e.target.value }));
                    setInfoErrors((prev) => ({ ...prev, [field]: undefined }));
                    setStartError(null);
                  }}
                />
                {infoErrors[field] && (
                  <p style={{ color: "#ef4444", fontSize: 12, margin: "4px 0 0" }}>{infoErrors[field]}</p>
                )}
              </div>
            );
          })}
        </div>
        {startError && (
          <div style={{ marginTop: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, fontSize: 13 }}>
            {startError}
          </div>
        )}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
          <button style={{ ...BTN_PRIMARY, opacity: startLoading ? 0.7 : 1 }} onClick={handleStep1Continue} disabled={startLoading}>
            {startLoading ? "Шалгаж байна..." : "Үргэлжлүүлэх →"}
          </button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Үйлчилгээ сонгох</h2>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
          Үйлчилгээний төрөл болон ангиллаа сонгоно уу.
        </p>
        {draftMatchStatus === "EXISTING" && (
          <div style={{ marginBottom: 12, borderRadius: 8, border: "1px solid #fcd34d", background: "#fffbeb", padding: "10px 12px", color: "#92400e", fontSize: 12 }}>
            РД системд бүртгэлтэй тул одоо байгаа үйлчлүүлэгчтэй холбохоор тэмдэглэв.
          </div>
        )}
        {draftMatchStatus === "DUPLICATE_NEEDS_REVIEW" && (
          <div style={{ marginBottom: 12, borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", padding: "10px 12px", color: "#991b1b", fontSize: 12 }}>
            Ижил РД-тэй олон бүртгэл илэрсэн тул reception шалгалт шаардлагатай.
          </div>
        )}
        {draftId && draftExpiresAt && (
          <p style={{ color: "#9ca3af", fontSize: 11, marginBottom: 12 }}>
            Draft #{draftId} · хүчинтэй хугацаа: {new Date(draftExpiresAt).toLocaleTimeString()}
          </p>
        )}
        {startError && (
          <div style={{ marginBottom: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, fontSize: 13 }}>
            {startError}
          </div>
        )}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
            Үйлчилгээний төрөл *
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { value: "CONSULTATION", label: "Зөвлөгөө" },
              { value: "TREATMENT", label: "Эмчилгээ" },
            ].map((opt) => {
              const selected = selectedServiceType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSelectedServiceType(opt.value as OnlineBookingServiceType);
                    setSelectedCategory(null);
                    setStartError(null);
                  }}
                  style={{
                    textAlign: "center",
                    padding: "10px 12px",
                    border: `2px solid ${selected ? "#f97316" : "#e5e7eb"}`,
                    borderRadius: 10,
                    background: selected ? "#fff7ed" : "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                    color: selected ? "#ea580c" : "#374151",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
            Үйлчилгээний ангилал *
          </label>
          {loadingCategories && selectedServiceType === "TREATMENT" && (
            <p style={{ color: "#6b7280", fontSize: 13 }}>Ачааллаж байна...</p>
          )}
          {!loadingCategories && displayedCategories.length === 0 && (
            <p style={{ color: "#6b7280", fontSize: 13 }}>Онлайн захиалгад тохирох үйлчилгээ олдсонгүй.</p>
          )}
          <div style={{ display: "grid", gap: 10 }}>
            {displayedCategories.map((cat) => {
              const selected = selectedCategory?.category === cat.category;
              return (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    textAlign: "left",
                    padding: "12px 16px",
                    border: `2px solid ${selected ? "#f97316" : "#e5e7eb"}`,
                    borderRadius: 10,
                    background: selected ? "#fff7ed" : "#fff",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: selected ? "#ea580c" : "#111827" }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    Үргэлжлэх хугацаа: {cat.durationMinutes} минут
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
          <button style={BTN_GHOST} onClick={() => setStep(1)}>← Буцах</button>
          <button
            style={{ ...BTN_PRIMARY, opacity: selectedCategory ? 1 : 0.5 }}
            disabled={!selectedCategory}
            onClick={async () => {
              if (!selectedCategory) return;
              setStartError(null);
              const ok = await updateDraft(
                {
                  serviceType: selectedServiceType,
                  serviceCategory: selectedCategory.category,
                },
                "Үйлчилгээний мэдээлэл хадгалах үед алдаа гарлаа."
              );
              if (!ok) return;
              setStep(3);
            }}
          >
            Үргэлжлүүлэх →
          </button>
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Салбар болон өдөр сонгох</h2>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
          Эмчийн боломжит цаг харахын тулд салбар болон өдрөө сонгоно уу.
        </p>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
            Салбар *
          </label>
          <select
            style={{ ...INPUT_STYLE, background: "#fff" }}
            value={selectedBranchId ?? ""}
            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
          >
            <option value="" disabled>Салбар сонгоно уу</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <input
          type="date"
          style={INPUT_STYLE}
          value={selectedDate}
          min={todayStr()}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setStartError(null);
          }}
        />
        {startError && (
          <div style={{ marginTop: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, fontSize: 13 }}>
            {startError}
          </div>
        )}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
          <button style={BTN_GHOST} onClick={() => setStep(2)}>← Буцах</button>
          <button
            style={BTN_PRIMARY}
            disabled={!selectedDate || !selectedBranchId}
            onClick={async () => {
              if (!selectedDate || !selectedBranchId) return;
              setStartError(null);
              const ok = await updateDraft(
                {
                  branchId: selectedBranchId,
                  selectedDate,
                  selectedStartTime: null,
                  selectedEndTime: null,
                },
                "Салбар, өдрийн мэдээлэл хадгалах үед алдаа гарлаа."
              );
              if (!ok) return;
              setStep(4);
            }}
          >
            Цагийн хуваарь харах →
          </button>
        </div>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Цаг сонгох</h2>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 4 }}>
          {selectedCategory?.label} · {selectedDate} · {grid?.durationMinutes ?? selectedCategory?.durationMinutes} минут
        </p>
        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>
          Боломжтой цаг дээр дарж захиална уу. "Захиалгатай" гэсэн цаг захиалах боломжгүй.
        </p>

        {loadingGrid && <p style={{ color: "#6b7280" }}>Ачааллаж байна...</p>}
        {gridError && <p style={{ color: "#ef4444" }}>{gridError}</p>}
        {holdError && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 12, color: "#b91c1c", fontSize: 13 }}>
            {holdError}
          </div>
        )}
        {holdLoading && <p style={{ color: "#6b7280" }}>Цаг захиалж байна...</p>}

        {grid && !loadingGrid && grid.doctors.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            Энэ өдөрт ажлын хуваарьтай эмч байхгүй байна.
          </div>
        )}

        {grid && !loadingGrid && grid.doctors.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 400, width: "100%", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "left", width: 64, minWidth: 56 }}>Цаг</th>
                  {grid.doctors.map((doc) => (
                    <th key={doc.id} style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "center" }}>
                      <div style={{ fontWeight: 600 }}>{doc.name}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 400 }}>
                        {doc.scheduleStart}–{doc.scheduleEnd}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.slots.map((slot) => (
                  <tr key={slot}>
                    <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb", color: "#374151", fontWeight: 500 }}>
                      {slot}
                    </td>
                    {grid.doctors.map((doc) => {
                      const slotMin = Number(slot.split(":")[0]) * 60 + Number(slot.split(":")[1]);
                      const startMin = Number(doc.scheduleStart.split(":")[0]) * 60 + Number(doc.scheduleStart.split(":")[1]);
                      const endMin = Number(doc.scheduleEnd.split(":")[0]) * 60 + Number(doc.scheduleEnd.split(":")[1]);
                      const inSchedule = slotMin >= startMin && slotMin < endMin;

                      if (!inSchedule) {
                        return (
                          <td key={doc.id} style={{ padding: "6px 10px", border: "1px solid #e5e7eb", background: "#f3f4f6" }} />
                        );
                      }

                      const isBusy = grid.busy.includes(`${doc.id}:${slot}`);
                      if (isBusy) {
                        return (
                          <td key={doc.id} style={{ padding: "6px 10px", border: "1px solid #e5e7eb", textAlign: "center" }}>
                            <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 6, padding: "3px 8px", fontSize: 12 }}>
                              Захиалгатай
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={doc.id} style={{ padding: "4px 6px", border: "1px solid #e5e7eb", textAlign: "center" }}>
                          <button
                            type="button"
                            disabled={holdLoading}
                            onClick={() => handleSlotClick(doc, slot)}
                            style={{
                              background: "#f0fdf4",
                              color: "#15803d",
                              border: "1px solid #86efac",
                              borderRadius: 6,
                              padding: "4px 10px",
                              fontSize: 12,
                              cursor: holdLoading ? "not-allowed" : "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Захиалах
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
          <button style={BTN_GHOST} onClick={() => { setHoldError(null); setStep(3); }}>← Буцах</button>
          <button style={BTN_GHOST} onClick={loadGrid}>🔄 Шинэчлэх</button>
        </div>
      </div>
    );
  }

  function renderStep5() {
    if (!holdData || !bookingSummary) return null;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    return (
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Урьдчилгаа төлбөр</h2>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
          Цагийг баталгаажуулахын тулд 10 минутын дотор <strong>30,000₮</strong> урьдчилгаа төлбөр төлнө үү.
        </p>

        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
          <div><b>Эмч:</b> {bookingSummary.doctorName}</div>
          <div><b>Үйлчилгээ:</b> {bookingSummary.categoryLabel}</div>
          <div><b>Өдөр:</b> {bookingSummary.date}</div>
          <div><b>Цаг:</b> {bookingSummary.startTime}–{bookingSummary.endTime}</div>
        </div>

        {timeLeft > 0 ? (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Үлдсэн хугацаа: </span>
            <span style={{ fontWeight: 700, color: timeLeft < 60 ? "#ef4444" : "#111827", fontSize: 16 }}>
              {pad2(mins)}:{pad2(secs)}
            </span>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#ef4444", fontWeight: 600, marginBottom: 16 }}>
            Хугацаа дуусав. Цаг суллагдлаа.
          </div>
        )}

        {holdData.qrImage && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <img
              src={`data:image/png;base64,${holdData.qrImage}`}
              alt="QPay QR code"
              style={{ width: 200, height: 200, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>QPay QR кодыг уншуулна уу</p>
          </div>
        )}

        {holdData.urls && holdData.urls.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Банкны аппаар төлөх:</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {holdData.urls.map((u) => (
                <a
                  key={u.name}
                  href={u.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 8,
                    textDecoration: "none", color: "#111827", fontSize: 13, background: "#fff",
                  }}
                >
                  {u.logo && <img src={u.logo} alt={u.name} style={{ width: 24, height: 24, objectFit: "contain" }} />}
                  <span>{u.description || u.name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>
          Төлбөрийн статус автоматаар шинэчлэгдэнэ...
        </p>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button style={BTN_GHOST} onClick={handleRestart}>Цуцлах</button>
        </div>
      </div>
    );
  }

  function renderStep6() {
    if (paymentStatus === "PAID") {
      return (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 20, color: "#15803d", marginBottom: 8 }}>Цаг амжилттай захиалагдлаа!</h2>
          <p style={{ color: "#374151", fontSize: 14, maxWidth: 360, margin: "0 auto 16px", lineHeight: 1.6 }}>
            Thanks for online appointment. Our staff will call you to remind your appointment.
          </p>
          {bookingSummary && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "14px 20px", display: "inline-block", textAlign: "left", marginBottom: 20, fontSize: 13 }}>
              <div><b>Эмч:</b> {bookingSummary.doctorName}</div>
              <div><b>Үйлчилгээ:</b> {bookingSummary.categoryLabel}</div>
              <div><b>Өдөр:</b> {bookingSummary.date}</div>
              <div><b>Цаг:</b> {bookingSummary.startTime}–{bookingSummary.endTime}</div>
            </div>
          )}
          <div>
            <button style={BTN_PRIMARY} onClick={handleRestart}>Шинэ цаг захиалах</button>
          </div>
        </div>
      );
    }

    // Expired
    return (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
        <h2 style={{ fontSize: 20, color: "#b91c1c", marginBottom: 8 }}>Хугацаа дуусав</h2>
        <p style={{ color: "#374151", fontSize: 14, marginBottom: 20 }}>
          Төлбөр хийгдээгүй тул цаг суллагдлаа. Дахин захиална уу.
        </p>
        <button style={BTN_PRIMARY} onClick={handleRestart}>Дахин захиалах</button>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <header style={{ background: "#061325", color: "#fff", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>M</div>
          <span style={{ fontWeight: 600, fontSize: 16 }}><span style={{ color: "#f97316" }}>M</span> Dent – Онлайн цаг захиалга</span>
        </div>
      </header>

      {/* Card */}
      <main style={{ maxWidth: 560, margin: "32px auto", padding: "0 16px" }}>
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", padding: "28px 28px 24px" }}>
          {step <= 5 && renderProgress()}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 16 }}>
          © 2025 M Dent Software Solution
        </p>
      </main>
    </div>
  );
}

// frontend/pages/reception/bookings.tsx
// Reception portal — Захиалгын жагсаалт (Booking list).
// Scope: own branch only (backend enforces branchId = req.user.branchId for receptionist).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import type { AuthUser } from "../../utils/auth";
import { getMe } from "../../utils/auth";
import ReceptionLayout from "../../components/ReceptionLayout";
import { pad2 } from "../../components/appointments/time";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "ONLINE_HELD"
  | "ONLINE_CONFIRMED"
  | "ONLINE_EXPIRED";

type Booking = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  note?: string | null;
  doctor: { id: number; name?: string | null; email: string };
  branch: { id: number; name: string };
  patient: { id: number; name?: string | null; regNo?: string | null; phone?: string | null };
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Хүлээгдэж байна",
  CONFIRMED: "Баталгаажсан",
  IN_PROGRESS: "Явагдаж байна",
  COMPLETED: "Дууссан",
  CANCELLED: "Цуцлагдсан",
  ONLINE_HELD: "Онлайн хүлээгдэж байна",
  ONLINE_CONFIRMED: "Онлайн баталгаажсан",
  ONLINE_EXPIRED: "Дуусгавар болсон",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#3b82f6",
  CONFIRMED: "#8b5cf6",
  IN_PROGRESS: "#f59e0b",
  COMPLETED: "#6b7280",
  CANCELLED: "#ef4444",
  ONLINE_HELD: "#06b6d4",
  ONLINE_CONFIRMED: "#22c55e",
  ONLINE_EXPIRED: "#94a3b8",
};

export default function ReceptionBookingsPage() {
  const router = useRouter();

  const [me, setMe] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((u) => {
        if (!u) { router.replace("/login"); return; }
        if (u.role !== "receptionist" && u.role !== "admin" && u.role !== "super_admin") {
          router.replace("/login");
          return;
        }
        setMe(u);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setAuthLoading(false));
  }, [router]);

  const [selectedDate, setSelectedDate] = useState<string>(todayYmd());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadBookings = useCallback(async (date: string) => {
    if (!date) return;
    setLoading(true);
    setError("");
    try {
      // For receptionist, backend ignores branchId query param and forces own branch.
      const params = new URLSearchParams({ date });
      const res = await fetch(`/api/bookings?${params.toString()}`);
      const data = await res.json().catch(() => []);
      if (!res.ok || !Array.isArray(data)) throw new Error("failed");
      setBookings(data);
    } catch {
      setError("Захиалгуудыг ачаалах үед алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings(selectedDate);
  }, [selectedDate, loadBookings]);

  const grouped = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of bookings) {
      const key = b.doctor?.id ? `doc_${b.doctor.id}` : "nodoc";
      if (!map[key]) map[key] = [];
      map[key].push(b);
    }
    return map;
  }, [bookings]);

  const doctorGroups = useMemo(() => {
    const seen = new Set<string>();
    const groups: { key: string; label: string }[] = [];
    for (const b of bookings) {
      const key = b.doctor?.id ? `doc_${b.doctor.id}` : "nodoc";
      if (!seen.has(key)) {
        seen.add(key);
        const name = b.doctor?.name || b.doctor?.email || "Эмч";
        groups.push({ key, label: b.doctor?.id ? name : "Эмч тогтоогдоогүй" });
      }
    }
    return groups;
  }, [bookings]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Ачаалж байна...</div>
      </div>
    );
  }

  return (
    <ReceptionLayout>
      <div style={{ marginTop: 12 }}>
        {/* Header */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
            Захиалгын жагсаалт
          </div>
          {me?.branchId && (
            <span style={{ fontSize: 12, color: "#374151", background: "#f3f4f6", borderRadius: 6, padding: "3px 8px" }}>
              Өөрийн салбар
            </span>
          )}
        </div>

        {/* Date picker */}
        <div style={{ marginBottom: 14 }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ borderRadius: 8, border: "1px solid #d1d5db", padding: "6px 10px", fontSize: 14, background: "#fff" }}
          />
        </div>

        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        {loading && <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>Ачаалж байна...</div>}

        {!loading && bookings.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: 40 }}>
            Тухайн өдөрт захиалга байхгүй.
          </div>
        )}

        {/* Bookings grouped by doctor */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {doctorGroups.map(({ key, label }) => {
            const group = (grouped[key] ?? []).sort(
              (a, b) => a.startTime.localeCompare(b.startTime)
            );
            return (
              <div key={key}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #e5e7eb" }}>
                  👨‍⚕️ {label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.map((b) => {
                    const patientName = b.patient?.name || "—";
                    const color = STATUS_COLOR[b.status] ?? "#94a3b8";
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          background: "#fff",
                          border: `1px solid ${color}40`,
                          borderLeft: `4px solid ${color}`,
                          borderRadius: 8,
                          padding: "8px 12px",
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, minWidth: 90, flexShrink: 0 }}>
                          {b.startTime}–{b.endTime}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            {patientName}
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            {[b.patient?.regNo, b.patient?.phone].filter(Boolean).join(" · ")}
                          </div>
                          {b.note && (
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{b.note}</div>
                          )}
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 11,
                            background: color,
                            color: "#fff",
                            borderRadius: 6,
                            padding: "2px 8px",
                            fontWeight: 600,
                          }}
                        >
                          {STATUS_LABELS[b.status] ?? b.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ReceptionLayout>
  );
}

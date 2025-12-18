// frontend/pages/bookings/index.tsx
import React, { useEffect, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  name?: string | null;
  email: string;
  branches?: Branch[];
  branch?: Branch | null;
};

type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type Booking = {
  id: number;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  status: BookingStatus;
  note?: string | null;
  doctor: { id: number; name?: string | null; email: string };
  branch: Branch;
  patient: { id: number; name?: string | null; regNo?: string | null; phone?: string | null };
};

export default function BookingsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load branches & doctors once
  useEffect(() => {
    async function loadInitial() {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch("/api/branches"),
          fetch("/api/users?role=doctor"),
        ]);

        const bData = await bRes.json();
        if (bRes.ok && Array.isArray(bData)) {
          setBranches(bData);
          if (!selectedBranchId && bData.length > 0) {
            setSelectedBranchId(String(bData[0].id));
          }
        }

        const dData = await dRes.json();
        if (dRes.ok && Array.isArray(dData)) {
          setDoctors(dData);
        }
      } catch (e) {
        console.error(e);
        setError("Сүлжээгээ шалгана уу");
      }
    }

    loadInitial();
  }, []);

  // Load bookings whenever branch/date change
  useEffect(() => {
    if (!selectedBranchId || !selectedDate) return;

    async function loadBookings() {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/bookings?branchId=${selectedBranchId}&date=${selectedDate}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          setError(data?.error || "Цаг захиалга ачаалж чадсангүй");
          setBookings([]);
          return;
        }

        if (!Array.isArray(data)) {
          setError("Алдаатай өгөгдөл ирлээ");
          setBookings([]);
          return;
        }

        setBookings(data);
      } catch (e) {
        console.error(e);
        setError("Сүлжээгээ шалгана уу");
        setBookings([]);
      } finally {
        setLoading(false);
      }
    }

    loadBookings();
  }, [selectedBranchId, selectedDate]);

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Цаг захиалга (шинэ Bookings)</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Эмч, салбар, өдрөөр цаг захиалгуудыг харах шинэ систем.
      </p>

      {/* Filters */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 8,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Шүүлтүүр</h2>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Огноо
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Салбар
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              <option value="">Салбар сонгох</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Debug list for now */}
      <section>
        <h2>Тухайн өдрийн цаг захиалгууд (debug list)</h2>
        {loading && <div>Ачааллаж байна...</div>}
        {error && <div style={{ color: "red" }}>{error}</div>}
        {!loading && !error && bookings.length === 0 && (
          <div style={{ color: "#888" }}>Энэ өдөрт цаг захиалга алга.</div>
        )}
        {!loading && !error && bookings.length > 0 && (
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 8,
              maxHeight: 400,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {JSON.stringify(bookings, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}

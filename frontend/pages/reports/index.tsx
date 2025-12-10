import React, { useEffect, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type DoctorRevenue = {
  id: number;
  name?: string | null;
  ovog?: string | null;
  email?: string | null;
  revenue: number;
};

type ServiceRevenue = {
  id: number;
  name: string;
  code?: string | null;
  revenue: number;
};

type ReportSummary = {
  from: string;
  to: string;
  branchId: number | null;
  newPatientsCount: number;
  encountersCount: number;
  totalInvoicesCount: number;
  totalInvoiceAmount: number;
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  topDoctors: DoctorRevenue[];
  topServices: ServiceRevenue[];
};

export default function ReportsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>(""); // "" = all
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load branches for filter
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await fetch("/api/branches");
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setBranches(data);
        }
      } catch {
        // ignore
      }
    };
    loadBranches();

    // Default date range: this month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setFrom(firstDay.toISOString().slice(0, 10));
    setTo(lastDay.toISOString().slice(0, 10));
  }, []);

  const loadSummary = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!from || !to) return;

    setLoading(true);
    setError("");
    setSummary(null);

    try {
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", to);
      if (branchId) params.set("branchId", branchId);

      const res = await fetch(`/api/reports/summary?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Тайлан ачааллах үед алдаа гарлаа");
      } else {
        setSummary(data);
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-load when default dates are set
    if (from && to) {
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h1>Тайлан</h1>

      <form
        onSubmit={loadSummary}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginTop: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>
            Эхлэх өдөр
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>
            Дуусах өдөр
          </label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>
            Салбар
          </label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">Бүх салбар</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Ачааллаж байна..." : "Шинэчлэх"}
        </button>
      </form>

      {error && <div style={{ color: "red", marginBottom: 16 }}>{error}</div>}

      {summary && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 32,
            }}
          >
            <StatCard
              label="Шинэ үйлчлүүлэгч"
              value={summary.newPatientsCount}
            />
            <StatCard label="Үзлэг" value={summary.encountersCount} />
            <StatCard
              label="Нийт нэхэмжлэл"
              value={summary.totalInvoicesCount}
            />
            <StatCard
              label="Нэхэмжлэлийн дүн"
              value={summary.totalInvoiceAmount}
              money
            />
            <StatCard
              label="Төлсөн дүн"
              value={summary.totalPaidAmount}
              money
            />
            <StatCard
              label="Үлдэгдэл"
              value={summary.totalUnpaidAmount}
              money
            />
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2>Үзлэгээр хамгийн их орлого олсон эмч нар</h2>
            {summary.topDoctors.length === 0 ? (
              <div style={{ color: "#777", marginTop: 8 }}>Мэдээлэл алга</div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: 8,
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Эмч</th>
                    <th style={{ textAlign: "left" }}>И-мэйл</th>
                    <th style={{ textAlign: "right" }}>Орлого (₮)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topDoctors.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {(d.ovog || "") +
                          (d.ovog ? " " : "") +
                          (d.name || "") || d.email}
                      </td>
                      <td>{d.email || "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        {d.revenue.toLocaleString("mn-MN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2>Хамгийн их орлого авчирсан үйлчилгээ</h2>
            {summary.topServices.length === 0 ? (
              <div style={{ color: "#777", marginTop: 8 }}>Мэдээлэл алга</div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: 8,
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Код</th>
                    <th style={{ textAlign: "left" }}>Үйлчилгээ</th>
                    <th style={{ textAlign: "right" }}>Орлого (₮)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topServices.map((s) => (
                    <tr key={s.id}>
                      <td>{s.code || "-"}</td>
                      <td>{s.name}</td>
                      <td style={{ textAlign: "right" }}>
                        {s.revenue.toLocaleString("mn-MN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {loading && !summary && (
        <div style={{ marginTop: 16 }}>Ачааллаж байна...</div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  money,
}: {
  label: string;
  value: number;
  money?: boolean;
}) {
  const formatted = money
    ? value.toLocaleString("mn-MN")
    : value.toLocaleString("mn-MN");
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        border: "1px solid #eee",
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>
        {formatted}
        {money ? " ₮" : ""}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  name?: string | null;
  ovog?: string | null;
  email?: string | null;
};

type Service = {
  id: number;
  name: string;
  code?: string | null;
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

type DoctorReport = {
  doctor: Doctor;
  from: string;
  to: string;
  branchId: number | null;
  totals: {
    encountersCount: number;
    invoiceCount: number;
    totalInvoiceAmount: number;
    totalPaidAmount: number;
    totalUnpaidAmount: number;
    newPatientsCount: number;
  };
  services: {
    serviceId: number;
    code?: string | null;
    name: string;
    totalQuantity: number;
    revenue: number;
  }[];
  daily: {
    date: string;
    encounters: number;
    revenue: number;
  }[];
};

type TabKey = "overview" | "doctor";

export default function ReportsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [branchId, setBranchId] = useState<string>(""); // "" = all
  const [doctorId, setDoctorId] = useState<string>(""); // "" = all / for doctor tab required
  const [serviceId, setServiceId] = useState<string>(""); // "" = all
  const [paymentMethod, setPaymentMethod] = useState<string>(""); // "" = all

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [error, setError] = useState("");
  const [doctorError, setDoctorError] = useState("");

  // Load branches, doctors, services for filters
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [bRes, dRes, sRes] = await Promise.all([
          fetch("/api/branches"),
          fetch("/api/users?role=doctor"),
          fetch("/api/services?onlyActive=true"),
        ]);

        const [bData, dData, sData] = await Promise.all([
          bRes.json(),
          dRes.json(),
          sRes.json(),
        ]);

        if (bRes.ok && Array.isArray(bData)) setBranches(bData);
        if (dRes.ok && Array.isArray(dData)) setDoctors(dData);
        if (sRes.ok && Array.isArray(sData)) setServices(sData);
      } catch {
        // ignore load errors for filters
      }
    };
    loadFilters();

    // Default date range: this month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setFrom(firstDay.toISOString().slice(0, 10));
    setTo(lastDay.toISOString().slice(0, 10));
  }, []);

  const buildCommonParams = () => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (branchId) params.set("branchId", branchId);
    if (doctorId) params.set("doctorId", doctorId);
    if (serviceId) params.set("serviceId", serviceId);
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    return params;
  };

  const loadSummary = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!from || !to) return;

    setLoading(true);
    setError("");
    setSummary(null);

    try {
      const params = buildCommonParams();
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

  // initial load of overview
  useEffect(() => {
    if (from && to) {
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const loadDoctorReport = async () => {
    if (!from || !to) return;
    if (!doctorId) {
      setDoctorError("Эмчийг сонгоно уу");
      setDoctorReport(null);
      return;
    }

    setDoctorLoading(true);
    setDoctorError("");
    setDoctorReport(null);

    try {
      const params = buildCommonParams();
      // For doctor report, doctorId MUST be set, but buildCommonParams already includes it.
      const res = await fetch(`/api/reports/doctor?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setDoctorError(data.error || "Эмчийн тайлан ачааллах үед алдаа гарлаа");
      } else {
        setDoctorReport(data);
      }
    } catch {
      setDoctorError("Сүлжээгээ шалгана уу");
    } finally {
      setDoctorLoading(false);
    }
  };

  // CSV download handler (uses same filters as overview)
  const downloadCsv = () => {
    if (!from || !to) {
      alert("Эхлэх ба дуусах өдрийг сонгоно уу");
      return;
    }
    const params = buildCommonParams();
    const url = `/api/reports/invoices.csv?${params.toString()}`;

    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const doctorLabel = (d: Doctor) =>
    (d.ovog ? d.ovog + " " : "") + (d.name || d.email || "");

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 24 }}>
      <h1>Тайлан</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "8px 16px",
            borderRadius: 4,
            border: activeTab === "overview" ? "2px solid #1976d2" : "1px solid #ccc",
            background: activeTab === "overview" ? "#e3f2fd" : "#f5f5f5",
            cursor: "pointer",
          }}
        >
          Ерөнхий тайлан
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("doctor")}
          style={{
            padding: "8px 16px",
            borderRadius: 4,
            border: activeTab === "doctor" ? "2px solid #1976d2" : "1px solid #ccc",
            background: activeTab === "doctor" ? "#e3f2fd" : "#f5f5f5",
            cursor: "pointer",
          }}
        >
          Эмчийн тайлан
        </button>
      </div>

      {/* Common filters */}
      <form
        onSubmit={activeTab === "overview" ? loadSummary : (e) => {
          e.preventDefault();
          loadDoctorReport();
        }}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
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
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
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

        {/* Doctor filter is common, but for doctor tab it's required */}
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>
            Эмч
          </label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">
              {activeTab === "doctor" ? "Эмч сонгох" : "Бүх эмч"}
            </option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {doctorLabel(d)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>
            Үйлчилгээ
          </label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Бүх үйлчилгээ</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.code ? s.code + " - " : "") + s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>
            Төлбөрийн төрөл
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="">Бүгд</option>
            <option value="CASH">Бэлэн</option>
            <option value="CARD">Карт</option>
            <option value="QPAY">QPay</option>
          </select>
        </div>

        <button type="submit" disabled={activeTab === "overview" ? loading : doctorLoading}>
          {activeTab === "overview"
            ? loading
              ? "Ачааллаж байна..."
              : "Шинэчлэх"
            : doctorLoading
            ? "Ачааллаж байна..."
            : "Эмчийн тайлан харах"}
        </button>

        {activeTab === "overview" && (
          <button
            type="button"
            onClick={downloadCsv}
            style={{ marginLeft: 8 }}
          >
            CSV татах (нэхэмжлэл)
          </button>
        )}
      </form>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <>
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
                  <div style={{ color: "#777", marginTop: 8 }}>
                    Мэдээлэл алга
                  </div>
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
                  <div style={{ color: "#777", marginTop: 8 }}>
                    Мэдээлэл алга
                  </div>
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
        </>
      )}

      {/* Doctor tab */}
      {activeTab === "doctor" && (
        <>
          {doctorError && (
            <div style={{ color: "red", marginBottom: 16 }}>{doctorError}</div>
          )}

          {doctorReport && (
            <>
              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                  marginBottom: 32,
                }}
              >
                <StatCard
                  label="Үзлэгийн тоо"
                  value={doctorReport.totals.encountersCount}
                />
                <StatCard
                  label="Нэхэмжлэл"
                  value={doctorReport.totals.invoiceCount}
                />
                <StatCard
                  label="Нэхэмжлэлийн дүн"
                  value={doctorReport.totals.totalInvoiceAmount}
                  money
                />
                <StatCard
                  label="Төлсөн дүн"
                  value={doctorReport.totals.totalPaidAmount}
                  money
                />
                <StatCard
                  label="Үлдэгдэл"
                  value={doctorReport.totals.totalUnpaidAmount}
                  money
                />
                <StatCard
                  label="Шинэ үйлчлүүлэгч"
                  value={doctorReport.totals.newPatientsCount}
                />
              </section>

              <section style={{ marginBottom: 32 }}>
                <h2>Эмчийн үйлчилгээний тайлан</h2>
                {doctorReport.services.length === 0 ? (
                  <div style={{ color: "#777", marginTop: 8 }}>
                    Мэдээлэл алга
                  </div>
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
                        <th style={{ textAlign: "right" }}>Тоо</th>
                        <th style={{ textAlign: "right" }}>Орлого (₮)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctorReport.services.map((s) => (
                        <tr key={s.serviceId}>
                          <td>{s.code || "-"}</td>
                          <td>{s.name}</td>
                          <td style={{ textAlign: "right" }}>
                            {s.totalQuantity.toLocaleString("mn-MN")}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {s.revenue.toLocaleString("mn-MN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section>
                <h2>Өдөр бүрийн тайлан</h2>
                {doctorReport.daily.length === 0 ? (
                  <div style={{ color: "#777", marginTop: 8 }}>
                    Мэдээлэл алга
                  </div>
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
                        <th style={{ textAlign: "left" }}>Огноо</th>
                        <th style={{ textAlign: "right" }}>Үзлэг</th>
                        <th style={{ textAlign: "right" }}>Орлого (₮)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctorReport.daily.map((d) => (
                        <tr key={d.date}>
                          <td>{d.date}</td>
                          <td style={{ textAlign: "right" }}>
                            {d.encounters.toLocaleString("mn-MN")}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {d.revenue.toLocaleString("mn-MN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}

          {doctorLoading && !doctorReport && (
            <div style={{ marginTop: 16 }}>Ачааллаж байна...</div>
          )}
        </>
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
  const formatted = value.toLocaleString("mn-MN");
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

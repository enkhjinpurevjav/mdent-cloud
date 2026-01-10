import React, { useState, useEffect } from "react";
import axios from "axios";

type DoctorSummary = {
  doctorId: number;
  doctorName: string;
  branchName: string;
  startDate: string;
  endDate: string;
  revenue: number;
  commission: number;
  monthlyGoal: number;
  progressPercent: number;
};

const IncomeReport = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DoctorSummary[]>([]);
  const [startDate, setStartDate] = useState<string>("2026-01-01");
  const [endDate, setEndDate] = useState<string>("2026-01-10");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/admin/doctors-income", {
        params: { startDate, endDate, branchId },
      });
      setData(response.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await axios.get("/api/admin/branches");
      setBranches(response.data);
    } catch (error) {
      console.error("Failed to fetch branches:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchBranches();
  }, [startDate, endDate, branchId]);

  return (
    <main style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>Эмчийн Орлогын Тайлан</h1>

      {/* Filters */}
      <section style={{ marginBottom: "24px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <label>Эхлэх:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: "8px", borderRadius: "8px", border: "1px solid #ccc", minWidth: "180px" }}
          />
        </div>
        <div>
          <label>Дуусах:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: "8px", borderRadius: "8px", border: "1px solid #ccc", minWidth: "180px" }}
          />
        </div>
        <div>
          <label>Салбар:</label>
          <select
            value={branchId || ""}
            onChange={(e) => setBranchId(Number(e.target.value) || null)}
            style={{ padding: "8px", borderRadius: "8px", border: "1px solid #ccc", minWidth: "200px" }}
          >
            <option value="">Бүх салбар</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Table */}
      <section>
        {loading ? (
          <p>Ачаалж байна...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb" }}>
                <th>Нэр</th>
                <th>Салбар</th>
                <th>Эхлэх</th>
                <th>Дуусах</th>
                <th>Борлуулалтын орлого</th>
                <th>Эмчийн хувь</th>
                <th>Сарын зорилт</th>
                <th>Зорилтын гүйцэтгэл</th>
                <th>Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {data.map((doctor) => (
                <tr key={doctor.doctorId}>
                  <td>{doctor.doctorName}</td>
                  <td>{doctor.branchName}</td>
                  <td>{doctor.startDate}</td>
                  <td>{doctor.endDate}</td>
                  <td>{doctor.revenue.toLocaleString("en-US")} ₮</td>
                  <td>{doctor.commission.toLocaleString("en-US")} ₮</td>
                  <td>{doctor.monthlyGoal.toLocaleString("en-US")} ₮</td>
                  <td>{doctor.progressPercent}%</td>
                  <td>
                    <button
                      onClick={() =>
                        window.location.href = `/admin/doctor/income/${doctor.doctorId}?startDate=${startDate}&endDate=${endDate}`
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        backgroundColor: "#2563eb",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Дэлгэрэнгүй
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
};

export default IncomeReport;

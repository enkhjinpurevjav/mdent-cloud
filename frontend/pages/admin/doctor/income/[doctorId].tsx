import React, { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";

type ProcedureBreakdown = {
  type: string;
  revenue: number;
  percent: number;
  doctorShare: number;
};

type DoctorIncomeDetails = {
  doctorName: string;
  startDate: string;
  endDate: string;
  breakdown: ProcedureBreakdown[];
  totals: {
    totalRevenue: number;
    totalCommission: number;
    monthlyGoal: number;
    progressPercent: number;
  };
};

const DoctorIncomeDetailsPage = () => {
  const router = useRouter();
  const { doctorId } = router.query;

  const [startDate, setStartDate] = useState<string>(router.query.startDate as string || "");
  const [endDate, setEndDate] = useState<string>(router.query.endDate as string || "");
  const [doctorIncome, setDoctorIncome] = useState<DoctorIncomeDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDoctorIncomeDetails = async () => {
    if (!doctorId || !startDate || !endDate) return;

    setLoading(true);
    try {
      const response = await axios.get(`/api/admin/doctors-income/${doctorId}/details`, {
        params: { startDate, endDate },
      });
      setDoctorIncome(response.data);
    } catch (error) {
      console.error("Failed to fetch doctor income details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorIncomeDetails();
  }, [doctorId, startDate, endDate]);

  return (
    <main style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>Дэлгэрэнгүй орлого</h1>

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
      </section>

      {/* Doctor Info Header */}
      {doctorIncome && (
        <header style={{ marginBottom: "24px", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold" }}>{doctorIncome.doctorName}</h2>
          <p>
            Хугацаа: {startDate} - {endDate}
          </p>
        </header>
      )}

      {/* Breakdown Table */}
      <section>
        {loading ? (
          <p>Ачаалж байна...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb" }}>
                <th>Төрөл</th>
                <th>Борлуулалт (₮)</th>
                <th>%</th>
                <th>Эмчийн хувь (₮)</th>
              </tr>
            </thead>
            <tbody>
              {doctorIncome &&
                doctorIncome.breakdown.map((item, index) => (
                  <tr key={index}>
                    <td>{item.type}</td>
                    <td>{item.revenue.toLocaleString("en-US")} ₮</td>
                    <td>{item.percent}%</td>
                    <td>{item.doctorShare.toLocaleString("en-US")} ₮</td>
                  </tr>
                ))}
            </tbody>
            {doctorIncome && (
              <>
                {/* Totals Footer */}
                <tfoot>
                  <tr>
                    <td><strong>Нийт борлуулалтын орлого</strong></td>
                    <td>{doctorIncome.totals.totalRevenue.toLocaleString("en-US")} ₮</td>
                    <td></td>
                    <td>{doctorIncome.totals.totalCommission.toLocaleString("en-US")} ₮</td>
                  </tr>
                  <tr>
                    <td><strong>Сарын зорилт</strong></td>
                    <td>{doctorIncome.totals.monthlyGoal.toLocaleString("en-US")} ₮</td>
                    <td></td>
                    <td></td>
                  </tr>
                  <tr>
                    <td><strong>Зорилтын гүйцэтгэл</strong></td>
                    <td>{doctorIncome.totals.progressPercent}%</td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              </>
            )}
          </table>
        )}
      </section>
    </main>
  );
};

export default DoctorIncomeDetailsPage;

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

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

export default function DoctorsIncomePage() {
  const router = useRouter();
  const [startDate, setStartDate] = useState<string>("2026-01-01");
  const [endDate, setEndDate] = useState<string>("2026-01-10");
  const [branchId, setBranchId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState<string>("");

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      setBranches(data || []);
    } catch (e) {
      console.error("Failed to load branches:", e);
      setBranches([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/doctors-income?startDate=${startDate}&endDate=${endDate}&branchId=${branchId || ""}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch doctors' income data");
      setDoctors(data);
    } catch (e: any) {
      console.error("Failed to fetch data:", e);
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchData();
  }, [startDate, endDate, branchId]);

  return (
    <main style={{ padding: "24px", fontFamily: "sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Эмчийн Орлогын Тайлан</h1>

      {/* Filters */}
      <section style={{ marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div>
          <label>Эхлэх:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: "8px", fontSize: 14, borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </div>
        <div>
          <label>Дуусах:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: "8px", fontSize: 14, borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </div>
        <div>
          <label>Салбар:</label>
          <select
            value={branchId || ""}
            onChange={(e) => setBranchId(Number(e.target.value) || null)}
            style={{ padding: "8px", fontSize: 14, borderRadius: 8, border: "1px solid #d1d5db" }}
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

      {/* Error message */}
      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            color: "#b91c1c",
            backgroundColor: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {/* Data Table */}
      <section>
        {loading ? (
          <p>Ачаалж байна...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb", textAlign: "left" }}>
                <th style={{ padding: "8px" }}>Нэр</th>
                <th style={{ padding: "8px" }}>Салбар</th>
                <th style={{ padding: "8px" }}>Эхлэх</th>
                <th style={{ padding: "8px" }}>Дуусах</th>
                <th style={{ padding: "8px", textAlign: "right" }}>Борлуулалтын орлого</th>
                <th style={{ padding: "8px", textAlign: "right" }}>Эмчийн хувь</th>
                <th style={{ padding: "8px", textAlign: "right" }}>Сарын зорилт</th>
                <th style={{ padding: "8px", textAlign: "right" }}>Гүйцэтгэл (%)</th>
                <th style={{ padding: "8px" }}></th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doctor) => (
                <tr key={doctor.doctorId} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px" }}>{doctor.doctorName}</td>
                  <td style={{ padding: "8px" }}>{doctor.branchName}</td>
                  <td style={{ padding: "8px" }}>{doctor.startDate}</td>
                  <td style={{ padding: "8px" }}>{doctor.endDate}</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    {doctor.revenue.toLocaleString("mn-MN")} ₮
                  </td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    {doctor.commission.toLocaleString("mn-MN")} ₮
                  </td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    {doctor.monthlyGoal.toLocaleString("mn-MN")} ₮
                  </td>
                  <td style={{ padding: "8px", textAlign: "right" }}>{doctor.progressPercent}%</td>
                  <td style={{ padding: "8px" }}>
                    <button
                      style={{
                        padding: "6px 12px",
                        fontSize: 14,
                        borderRadius: 6,
                        border: "1px solid #2563eb",
                        backgroundColor: "#eff6ff",
                        color: "#2563eb",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        router.push(
                          `/admin/doctor/income/${doctor.doctorId}?startDate=${startDate}&endDate=${endDate}`
                        )
                      }
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
}

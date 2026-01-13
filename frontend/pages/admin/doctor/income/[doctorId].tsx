import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

type CategoryRow = {
  key:
    | "IMAGING"
    | "ORTHODONTIC_TREATMENT"
    | "DEFECT_CORRECTION"
    | "SURGERY"
    | "GENERAL"
    | "BARTER_EXCESS";
  label: string;
  salesMnt: number;
  incomeMnt: number;
  pctUsed: number;
};

type DetailsResponse = {
  doctorId: number;
  startDate: string;
  endDate: string;
  categories: CategoryRow[];
  totals: {
    totalSalesMnt: number;
    totalIncomeMnt: number;
  };
};

function fmtMnt(v: number) {
  const n = Number(v || 0);
  return `${n.toLocaleString("mn-MN")} ₮`;
}

export default function DoctorIncomeDetailsPage() {
  const router = useRouter();
  const { doctorId, startDate: qsStart, endDate: qsEnd } = router.query;

  const startDate = useMemo(() => {
    if (typeof qsStart === "string" && qsStart) return qsStart;
    return "2026-01-01";
  }, [qsStart]);

  const endDate = useMemo(() => {
    if (typeof qsEnd === "string" && qsEnd) return qsEnd;
    return "2026-01-10";
  }, [qsEnd]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [error, setError] = useState<string>("");

  const fetchData = async () => {
    if (!doctorId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/doctors-income/${doctorId}/details?startDate=${startDate}&endDate=${endDate}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch doctor income details");
      setData(json);
    } catch (e: any) {
      console.error("Failed to fetch details:", e);
      setError(e?.message || "Failed to fetch details");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, startDate, endDate]);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: "6px 12px",
            fontSize: 14,
            borderRadius: 6,
            border: "1px solid #d1d5db",
            backgroundColor: "white",
            cursor: "pointer",
          }}
        >
          Буцах
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Эмчийн Орлогын Тайлан — Дэлгэрэнгүй</h1>
      </div>

      <div style={{ marginBottom: 16, color: "#374151", fontSize: 14 }}>
        <div>
          <b>Эхлэх:</b> {startDate} &nbsp; <b>Дуусах:</b> {endDate}
        </div>
        <div>
          <b>Doctor ID:</b> {String(doctorId || "")}
        </div>
      </div>

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

      {loading ? (
        <p>Ачаалж байна...</p>
      ) : !data ? (
        <p>Мэдээлэл олдсонгүй.</p>
      ) : (
        <>
          <section style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Нийт борлуулалт</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtMnt(data.totals.totalSalesMnt)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Нийт эмчийн хувь</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtMnt(data.totals.totalIncomeMnt)}</div>
              </div>
            </div>
          </section>

          <section>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>Ангилал</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>Хувь (%)</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>Борлуулалт</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>Эмчийн хувь</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((row) => (
                  <tr key={row.key} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "8px" }}>{row.label}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>{Number(row.pctUsed || 0)}%</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>{fmtMnt(row.salesMnt)}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>{fmtMnt(row.incomeMnt)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #e5e7eb" }}>
                  <td style={{ padding: "8px", fontWeight: 700 }}>Нийт</td>
                  <td style={{ padding: "8px" }}></td>
                  <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>
                    {fmtMnt(data.totals.totalSalesMnt)}
                  </td>
                  <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>
                    {fmtMnt(data.totals.totalIncomeMnt)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section style={{ marginTop: 16, fontSize: 13, color: "#6b7280" }}>
            Дараа нь “View more” товч нэмээд encounter/invoice жагсаалтаар дэлгэрэнгүй харах боломжтой.
          </section>
        </>
      )}
    </main>
  );
}

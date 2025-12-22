import React, { useEffect, useState } from "react";
import AppointmentFiltersBar from "../../components/AppointmentFiltersBar";
import {
  AppointmentFilters,
  AppointmentRow,
} from "../../types/appointments";

export default function CompletedVisitsPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [filters, setFilters] = useState<AppointmentFilters>({
    dateFrom: today,
    dateTo: today,
    status: "COMPLETED",
  });

  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("dateFrom", filters.dateFrom);
    params.set("dateTo", filters.dateTo);
    params.set("status", (filters.status ?? "COMPLETED") as string);
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.search) params.set("search", filters.search);

    setLoading(true);
    fetch(`/api/appointments?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setRows(data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        Дууссан
      </h1>

      <AppointmentFiltersBar
        value={filters}
        onChange={setFilters}
        showStatusFilter={true}
        statuses={[
          { value: "COMPLETED", label: "Дууссан" },
          { value: "CANCELLED", label: "Цуцлагдсан" },
        ]}
        branches={[] /* TODO: load from /api/branches */}
      />

      {loading ? (
        <div>Уншиж байна…</div>
      ) : rows.length === 0 ? (
        <div>Өнөөдрийн дууссан үзлэг олдсонгүй эсвэл API холболт хийгдээгүй байна.</div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "white",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Цаг</th>
              <th style={{ textAlign: "left", padding: 8 }}>Өвчтөн</th>
              <th style={{ textAlign: "left", padding: 8 }}>РД</th>
              <th style={{ textAlign: "left", padding: 8 }}>Салбар</th>
              <th style={{ textAlign: "left", padding: 8 }}>Эмч</th>
              <th style={{ textAlign: "left", padding: 8 }}>Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: 8 }}>
                  {new Date(row.startTime).toLocaleTimeString()}
                </td>
                <td style={{ padding: 8 }}>{row.patientName}</td>
                <td style={{ padding: 8 }}>{row.regNo}</td>
                <td style={{ padding: 8 }}>{row.branchName}</td>
                <td style={{ padding: 8 }}>{row.doctorName}</td>
                <td style={{ padding: 8 }}>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

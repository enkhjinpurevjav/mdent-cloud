import React, { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import AppointmentFiltersBar from "../../components/AppointmentFiltersBar";
import {
  AppointmentFilters,
  AppointmentRow,
} from "../../types/appointments";

export default function BookedVisitsPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [filters, setFilters] = useState<AppointmentFilters>({
    dateFrom: today,
    dateTo: today,
    status: "BOOKED",
    includeCancelled: true,
  });

  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: replace with real API
    // build query string for future /api/appointments
    const params = new URLSearchParams();
    params.set("dateFrom", filters.dateFrom);
    params.set("dateTo", filters.dateTo);
    params.set("status", filters.status || "BOOKED");
    if (filters.includeCancelled) params.set("includeCancelled", "true");
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.search) params.set("search", filters.search);

    setLoading(true);
    // placeholder: use local fake for now
    fetch(`/api/appointments?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setRows(data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        Цаг захиалсан
      </h1>

      <AppointmentFiltersBar
        value={filters}
        onChange={setFilters}
        showStatusFilter={true}
        statuses={[
          { value: "BOOKED", label: "Цаг захиалсан" },
          { value: "CANCELLED", label: "Цуцлагдсан" },
        ]}
        branches={[] /* TODO: load from /api/branches */}
      />

      {loading ? (
        <div>Уншиж байна…</div>
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
              <th style={{ textAlign: "left", padding: 8 }}>Өгөгдөл</th>
              <th style={{ textAlign: "left", padding: 8 }}>Өвчтөн</th>
              <th style={{ textAlign: "left", padding: 8 }}>Салбар</th>
              <th style={{ textAlign: "left", padding: 8 }}>Эмч</th>
              <th style={{ textAlign: "left", padding: 8 }}>Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: 8 }}>{new Date(row.startTime).toLocaleTimeString()}</td>
                <td style={{ padding: 8 }}>{row.patientName}</td>
                <td style={{ padding: 8 }}>{row.branchName}</td>
                <td style={{ padding: 8 }}>{row.doctorName}</td>
                <td style={{ padding: 8 }}>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminLayout>
  );
}

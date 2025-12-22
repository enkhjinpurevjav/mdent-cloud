import React, { useEffect, useState } from "react";
import AppointmentFiltersBar from "../../components/AppointmentFiltersBar";
import {
  AppointmentFilters,
  AppointmentRow,
} from "../../types/appointments";

export default function OngoingVisitsPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [filters, setFilters] = useState<AppointmentFilters>({
    dateFrom: today,
    dateTo: today,
    status: "ONGOING",
  });

  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Load branches
  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data) => {
        const mapped = (data || []).map((b: any) => ({
          id: String(b.id),
          name: b.name as string,
        }));
        setBranches(mapped);
      })
      .catch(() => setBranches([]));
  }, []);

  // Load ongoing appointments
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("dateFrom", filters.dateFrom);
    params.set("dateTo", filters.dateTo);
    params.set("status", (filters.status ?? "ONGOING") as string);
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.search) params.set("search", filters.search);

    setLoading(true);
    fetch(`/api/appointments?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        Үзлэг хийж буй
      </h1>

      <AppointmentFiltersBar
        value={filters}
        onChange={setFilters}
        showStatusFilter={false}
        branches={branches}
      />

      {loading ? (
        <div>Уншиж байна…</div>
      ) : rows.length === 0 ? (
        <div>Идэвхтэй үзлэг олдсонгүй эсвэл API холболт хийгдээгүй байна.</div>
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
              <th style={{ textAlign: "left", padding: 8 }}>Эхлэх цаг</th>
              <th style={{ textAlign: "left", padding: 8 }}>Өвчтөн</th>
              <th style={{ textAlign: "left", padding: 8 }}>РД</th>
              <th style={{ textAlign: "left", padding: 8 }}>Салбар</th>
              <th style={{ textAlign: "left", padding: 8 }}>Эмч</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: 8 }}>
                  {row.startTime
                    ? new Date(row.startTime).toLocaleTimeString()
                    : ""}
                </td>
                <td style={{ padding: 8 }}>{row.patientName}</td>
                <td style={{ padding: 8 }}>{row.regNo}</td>
                <td style={{ padding: 8 }}>{row.branchName}</td>
                <td style={{ padding: 8 }}>{row.doctorName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

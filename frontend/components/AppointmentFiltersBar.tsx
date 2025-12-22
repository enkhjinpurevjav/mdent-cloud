import React from "react";
import { AppointmentFilters } from "../types/appointments";

type Props = {
  value: AppointmentFilters;
  onChange: (next: AppointmentFilters) => void;
  showStatusFilter?: boolean;
  statuses?: { value: string; label: string }[];
  branches?: { id: string; name: string }[];
};

export default function AppointmentFiltersBar({
  value,
  onChange,
  showStatusFilter = true,
  statuses = [],
  branches = [],
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 16,
        alignItems: "center",
      }}
    >
      {/* Date range */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="date"
          value={value.dateFrom}
          onChange={(e) =>
            onChange({ ...value, dateFrom: e.target.value || value.dateFrom })
          }
        />
        <span>-</span>
        <input
          type="date"
          value={value.dateTo}
          onChange={(e) =>
            onChange({ ...value, dateTo: e.target.value || value.dateTo })
          }
        />
      </div>

      {/* Status selector */}
      {showStatusFilter && statuses.length > 0 && (
        <select
          value={value.status ?? "ALL"}
          onChange={(e) =>
            onChange({
              ...value,
              status:
                e.target.value === "ALL"
                  ? "ALL"
                  : (e.target.value as AppointmentFilters["status"]),
            })
          }
        >
          <option value="ALL">Бүгд</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {/* Branch switch */}
      <select
        value={value.branchId ?? "all"}
        onChange={(e) =>
          onChange({
            ...value,
            branchId: e.target.value === "all" ? undefined : e.target.value,
          })
        }
      >
        <option value="all">Бүх салбар</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      {/* Free text search */}
      <input
        type="text"
        placeholder="Нэр, РД, утас..."
        value={value.search ?? ""}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        style={{ minWidth: 220 }}
      />
    </div>
  );
}

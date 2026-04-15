import React from "react";
import type { BranchOption, PaymentMethod, PaymentStatus, PaymentsFilterState } from "./types";

type Props = {
  filters: PaymentsFilterState;
  branches: BranchOption[];
  patientInput: string;
  onPatientInputChange: (value: string) => void;
  onFilterChange: (patch: Partial<PaymentsFilterState>) => void;
  onClear: () => void;
};

const METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "", label: "Бүгд" },
  { value: "cash", label: "cash" },
  { value: "transfer", label: "transfer" },
  { value: "pos", label: "pos" },
  { value: "wallet", label: "wallet" },
  { value: "qpay", label: "qpay" },
  { value: "insurance", label: "insurance" },
  { value: "application", label: "application" },
];

const STATUS_OPTIONS: Array<{ value: PaymentStatus; label: string }> = [
  { value: "all", label: "Бүгд" },
  { value: "active", label: "Идэвхтэй" },
  { value: "reversed", label: "Буцаасан" },
];

export default function PaymentsFilters({
  filters,
  branches,
  patientInput,
  onPatientInputChange,
  onFilterChange,
  onClear,
}: Props) {
  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <label className="text-xs text-gray-600">
          Огнооны хүрээ
          <div className="mt-1 grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => onFilterChange({ from: e.target.value, page: 1 })}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => onFilterChange({ to: e.target.value, page: 1 })}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </label>

        <label className="text-xs text-gray-600">
          Салбар
          <select
            value={filters.branchId}
            onChange={(e) => onFilterChange({ branchId: e.target.value, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Бүгд</option>
            {branches.map((branch) => (
              <option key={branch.id} value={String(branch.id)}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Төлбөрийн хэлбэр
          <select
            value={filters.method}
            onChange={(e) => onFilterChange({ method: e.target.value as PaymentMethod, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {METHOD_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Төлөв
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value as PaymentStatus, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Өвчтөн хайх
          <input
            type="text"
            value={patientInput}
            onChange={(e) => onPatientInputChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Хайх..."
          />
        </label>

        <label className="text-xs text-gray-600">
          Нэхэмжлэлийн ID
          <input
            type="text"
            value={filters.invoiceId}
            onChange={(e) => onFilterChange({ invoiceId: e.target.value, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="ID"
          />
        </label>

        <label className="text-xs text-gray-600">
          Бүртгэсэн
          <input
            type="text"
            value={filters.createdBy}
            onChange={(e) => onFilterChange({ createdBy: e.target.value, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Нэр"
          />
        </label>

        <label className="text-xs text-gray-600">
          Хуудас хэмжээ
          <select
            value={String(filters.pageSize)}
            onChange={(e) => onFilterChange({ pageSize: Number(e.target.value), page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Цэвэрлэх
        </button>
      </div>
    </div>
  );
}

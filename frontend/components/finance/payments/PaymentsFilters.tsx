import React from "react";
import type { BranchOption, PaymentMethodOption, PaymentStatus, PaymentsFilterState } from "./types";

type Props = {
  filters: PaymentsFilterState;
  branches: BranchOption[];
  paymentMethods: PaymentMethodOption[];
  patientInput: string;
  onPatientInputChange: (value: string) => void;
  onFilterChange: (patch: Partial<PaymentsFilterState>) => void;
  onClear: () => void;
};

const STATUS_OPTIONS: Array<{ value: PaymentStatus; label: string }> = [
  { value: "all", label: "Бүгд" },
  { value: "active", label: "Идэвхтэй" },
  { value: "reversed", label: "Буцаасан" },
];

export default function PaymentsFilters({
  filters,
  branches,
  paymentMethods,
  patientInput,
  onPatientInputChange,
  onFilterChange,
  onClear,
}: Props) {
  const selectedPaymentMethodSet = new Set(filters.paymentMethods);
  const allPaymentMethodKeys = paymentMethods.map((method) => method.key);

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
        <div className="text-xs text-gray-600 sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span>Төлбөрийн хэрэгсэл</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onFilterChange({ paymentMethods: allPaymentMethodKeys, page: 1 })}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
              >
                Бүгд
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ paymentMethods: [], page: 1 })}
                className="text-[11px] font-medium text-gray-500 hover:text-gray-700"
              >
                Цэвэрлэх
              </button>
            </div>
          </div>
          <div className="max-h-28 overflow-y-auto rounded-md border border-gray-300 bg-white p-2">
            {paymentMethods.length === 0 ? (
              <p className="text-xs text-gray-400">Төлбөрийн хэрэгсэл олдсонгүй</p>
            ) : (
              <div className="grid gap-1 sm:grid-cols-2">
                {paymentMethods.map((method) => (
                  <label key={method.key} className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedPaymentMethodSet.has(method.key)}
                      onChange={(e) => {
                        const next = new Set(filters.paymentMethods);
                        if (e.target.checked) next.add(method.key);
                        else next.delete(method.key);
                        onFilterChange({ paymentMethods: Array.from(next), page: 1 });
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <span>{method.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
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

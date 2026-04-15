import React from "react";
import type {
  BranchOption,
  DoctorOption,
  InvoiceEbarimtStatus,
  InvoiceFilterState,
  InvoicePaymentStatus,
} from "./types";

type Props = {
  filters: InvoiceFilterState;
  branches: BranchOption[];
  doctors: DoctorOption[];
  patientInput: string;
  onFilterChange: (patch: Partial<InvoiceFilterState>) => void;
  onPatientInputChange: (value: string) => void;
  onClear: () => void;
};

const PAYMENT_STATUS_OPTIONS: Array<{ value: InvoicePaymentStatus; label: string }> = [
  { value: "all", label: "Бүгд" },
  { value: "paid", label: "Төлөгдсөн" },
  { value: "partial", label: "Хэсэгчлэн" },
  { value: "unpaid", label: "Төлөөгүй" },
  { value: "overpaid", label: "Илүү төлсөн" },
];

const EBARIMT_OPTIONS: Array<{ value: InvoiceEbarimtStatus; label: string }> = [
  { value: "all", label: "Бүгд" },
  { value: "issued", label: "Гаргасан" },
  { value: "not_issued", label: "Гаргаагүй" },
];

export default function InvoiceFilters({
  filters,
  branches,
  doctors,
  patientInput,
  onFilterChange,
  onPatientInputChange,
  onClear,
}: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <label className="text-xs text-gray-600">
          Эхлэх огноо
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onFilterChange({ from: e.target.value, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Дуусах огноо
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onFilterChange({ to: e.target.value, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Салбар
          <select
            value={filters.branchId}
            onChange={(e) => onFilterChange({ branchId: e.target.value, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Бүх салбар</option>
            {branches.map((branch) => (
              <option key={branch.id} value={String(branch.id)}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Эмч
          <select
            value={filters.doctorId}
            onChange={(e) => onFilterChange({ doctorId: e.target.value, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Бүгд</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={String(doctor.id)}>
                {doctor.ovog ? `${doctor.ovog[0]}. ${doctor.name || ""}` : doctor.name || `#${doctor.id}`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Төлбөрийн төлөв
          <select
            value={filters.paymentStatus}
            onChange={(e) =>
              onFilterChange({ paymentStatus: e.target.value as InvoicePaymentStatus, page: 1 })
            }
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          eBarimt
          <select
            value={filters.ebarimtStatus}
            onChange={(e) =>
              onFilterChange({ ebarimtStatus: e.target.value as InvoiceEbarimtStatus, page: 1 })
            }
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {EBARIMT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Үйлчлүүлэгч (нэр/утас/РД)
          <input
            type="text"
            value={patientInput}
            onChange={(e) => onPatientInputChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Хайх..."
          />
        </label>
        <label className="text-xs text-gray-600">
          Нэхэмжлэл №
          <input
            type="text"
            value={filters.invoiceId}
            onChange={(e) => onFilterChange({ invoiceId: e.target.value, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="ID"
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
          Шүүлтүүр цэвэрлэх
        </button>
      </div>
    </div>
  );
}

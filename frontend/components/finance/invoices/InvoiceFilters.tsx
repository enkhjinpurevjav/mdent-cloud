import React from "react";
import type {
  BranchOption,
  DoctorOption,
  InvoiceEbarimtStatus,
  InvoiceFilterState,
  InvoicePaymentStatus,
  PaymentMethodOption,
} from "./types";

type Props = {
  filters: InvoiceFilterState;
  branches: BranchOption[];
  doctors: DoctorOption[];
  paymentMethods: PaymentMethodOption[];
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
  paymentMethods,
  patientInput,
  onFilterChange,
  onPatientInputChange,
  onClear,
}: Props) {
  const selectedPaymentMethodSet = new Set(filters.paymentMethods);
  const allPaymentMethodKeys = paymentMethods.map((method) => method.key);

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
          Шүүлтүүр цэвэрлэх
        </button>
      </div>
    </div>
  );
}

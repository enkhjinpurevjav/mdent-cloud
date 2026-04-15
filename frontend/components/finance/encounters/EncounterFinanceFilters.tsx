import React from "react";
import type {
  BranchOption,
  DoctorOption,
  EncounterBillingStatus,
  EncounterFinanceFilterState,
  ServiceCategoryOption,
} from "./types";
import { formatEncounterStatus, formatBillingStatus } from "./formatters";

type Props = {
  filters: EncounterFinanceFilterState;
  branches: BranchOption[];
  doctors: DoctorOption[];
  billingStatusOptions: Array<Exclude<EncounterBillingStatus, "all">>;
  encounterStatusOptions: string[];
  serviceCategories: ServiceCategoryOption[];
  patientInput: string;
  onFilterChange: (patch: Partial<EncounterFinanceFilterState>) => void;
  onPatientInputChange: (value: string) => void;
  onClear: () => void;
};

export default function EncounterFinanceFilters({
  filters,
  branches,
  doctors,
  billingStatusOptions,
  encounterStatusOptions,
  serviceCategories,
  patientInput,
  onFilterChange,
  onPatientInputChange,
  onClear,
}: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <label className="text-xs text-gray-600">
          Огнооны хүрээ
          <div className="mt-1 flex items-center gap-2">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => onFilterChange({ from: e.target.value, page: 1 })}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <span className="text-gray-400">—</span>
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
          Үзлэгийн төлөв
          <select
            value={filters.encounterStatus}
            onChange={(e) => onFilterChange({ encounterStatus: e.target.value, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Бүгд</option>
            {encounterStatusOptions.map((status) => (
              <option key={status} value={status}>
                {formatEncounterStatus(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Төлөв
          <select
            value={filters.billingStatus}
            onChange={(e) => onFilterChange({ billingStatus: e.target.value as EncounterBillingStatus, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="all">Бүгд</option>
            {billingStatusOptions.map((status) => (
              <option key={status} value={status}>
                {formatBillingStatus(status)}
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
            placeholder="Нэр, утас"
          />
        </label>

        <label className="text-xs text-gray-600">
          Үзлэгийн ID
          <input
            type="text"
            value={filters.encounterId}
            onChange={(e) => onFilterChange({ encounterId: e.target.value, page: 1 })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="ID"
          />
        </label>

        <label className="text-xs text-gray-600">
          Үйлчилгээний төрөл
          <select
            multiple
            value={filters.serviceCategoryIds}
            onChange={(e) =>
              onFilterChange({
                serviceCategoryIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                page: 1,
              })
            }
            className="mt-1 min-h-[40px] w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {serviceCategories.map((category) => (
              <option key={category.category} value={category.category}>
                {category.category}
              </option>
            ))}
          </select>
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

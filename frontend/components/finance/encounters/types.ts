export type BranchOption = { id: number; name: string };
export type DoctorOption = { id: number; name: string | null; ovog?: string | null };
export type ServiceCategoryOption = { category: string };

export type EncounterBillingStatus =
  | "all"
  | "no_invoice"
  | "unpaid"
  | "partial"
  | "paid"
  | "free"
  | "close_without_payment";

export type EncounterFinanceFilterState = {
  from: string;
  to: string;
  branchId: string;
  doctorId: string;
  encounterStatus: string;
  billingStatus: EncounterBillingStatus;
  patient: string;
  encounterId: string;
  serviceCategoryIds: string[];
  page: number;
  pageSize: number;
};

export type EncounterFinanceRow = {
  id: number;
  status: string;
  appointment: {
    scheduledAt: string | null;
  };
  patient: {
    id: number | null;
    name: string | null;
    phone: string | null;
  };
  doctor: { id: number; name: string | null } | null;
  branch: { id: number; name: string } | null;
  invoice: {
    id: number;
    totalAmount: number;
    statusLegacy: string | null;
    isVoided: boolean;
  } | null;
  paidAmount: number;
  remainingAmount: number;
  billingStatus: Exclude<EncounterBillingStatus, "all">;
  closedWithoutPayment: {
    value: boolean;
    note: string | null;
    at: string | null;
  };
};

export type EncounterFinanceListResponse = {
  page: number;
  pageSize: number;
  total: number;
  summary: {
    totalEncounters: number;
    noInvoice: number;
    invoicedUnpaidOrPartial: number;
    freeEncounters: number;
    closedWithoutPayment: number;
  };
  billingStatusOptions: Array<Exclude<EncounterBillingStatus, "all">>;
  encounterStatusOptions: string[];
  items: EncounterFinanceRow[];
};

export type EncounterFinanceDetail = EncounterFinanceRow & {
  invoice: {
    id: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    statusLegacy: string | null;
    billingStatus: Exclude<EncounterBillingStatus, "all">;
    isVoided: boolean;
  } | null;
  clinical: {
    totalItems: number;
    services: Array<{
      id: number;
      serviceId: number;
      name: string;
      category: string | null;
      qty: number;
      price: number;
      total: number;
    }>;
  };
  payments: Array<{
    id: number;
    method: string;
    amount: number;
    timestamp: string | null;
    status: "active" | "reversed";
    reversal: {
      reversalPaymentId: number | null;
      reversedAt: string | null;
      reason: string | null;
    } | null;
  }>;
};

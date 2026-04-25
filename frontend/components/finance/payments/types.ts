export type BranchOption = { id: number; name: string };
export type PaymentMethodOption = { key: string; label: string };

export type PaymentStatus = "all" | "active" | "reversed";

export type PaymentsFilterState = {
  from: string;
  to: string;
  branchId: string;
  paymentMethods: string[];
  status: PaymentStatus;
  patientSearch: string;
  invoiceId: string;
  createdBy: string;
  page: number;
  pageSize: number;
};

export type PaymentUser = {
  id: number;
  name: string | null;
  ovog: string | null;
};

export type PaymentRow = {
  id: number;
  timestamp: string;
  method: string;
  amount: number;
  status: "active" | "reversed";
  reference: string | null;
  note: string | null;
  isWallet: boolean;
  invoice: {
    id: number;
    statusLegacy: string | null;
    encounter: {
      appointment: {
        scheduledAt: string | null;
      } | null;
    } | null;
  } | null;
  patient: {
    id: number | null;
    name: string | null;
    ovog: string | null;
    phone: string | null;
    regNo: string | null;
  };
  doctor: {
    id: number;
    name: string | null;
    ovog: string | null;
  } | null;
  branch: {
    id: number;
    name: string;
  } | null;
  createdByUser: PaymentUser | null;
  reversal: {
    reversalPaymentId: number | null;
    reversedAt: string | null;
    reversedByUser: PaymentUser | null;
    reason: string | null;
  } | null;
};

export type PaymentDetail = PaymentRow & {
  reversal: (PaymentRow["reversal"] & {
    reversalPayment?: {
      id: number;
      amount: number;
      method: string;
      timestamp: string;
    } | null;
  }) | null;
};

export type PaymentsListResponse = {
  page: number;
  pageSize: number;
  total: number;
  summary: {
    totalPayments: number;
    activeTotal: number;
    reversedTotal: number;
    netCollected: number;
  };
  items: PaymentRow[];
};

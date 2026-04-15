export type BranchOption = { id: number; name: string };
export type DoctorOption = { id: number; name: string | null; ovog: string | null };

export type InvoicePaymentStatus = "all" | "paid" | "partial" | "unpaid" | "overpaid";
export type InvoiceEbarimtStatus = "all" | "issued" | "not_issued";

export type InvoiceFilterState = {
  from: string;
  to: string;
  branchId: string;
  doctorId: string;
  paymentStatus: InvoicePaymentStatus;
  ebarimtStatus: InvoiceEbarimtStatus;
  patientSearch: string;
  invoiceId: string;
  page: number;
  pageSize: number;
};

export type InvoiceListRow = {
  id: number;
  encounterId: number | null;
  createdAt: string;
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
  total: number;
  paid: number;
  remaining: number;
  status: "paid" | "partial" | "unpaid" | "overpaid";
  paymentMethods: Array<{ method: string; amount: number; count: number }>;
  paymentMethodsLabel: string;
  hasWalletUsage: boolean;
  lastPaymentAt: string | null;
  ebarimt: {
    issued: boolean;
    status: string | null;
    receiptNumber: string | null;
  };
};

export type InvoiceListResponse = {
  page: number;
  pageSize: number;
  total: number;
  summary: {
    totalBilled: number;
    totalCollected: number;
    totalUnpaid: number;
    overpayments: number;
  };
  items: InvoiceListRow[];
};

export type InvoiceDetail = InvoiceListRow & {
  encounter?: {
    appointment?: {
      scheduledAt: string | null;
    } | null;
  } | null;
  items: Array<{
    id: number;
    itemType: string;
    serviceId: number | null;
    productId: number | null;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  payments: Array<{
    id: number;
    amount: number;
    method: string;
    timestamp: string;
    qpayTxnId: string | null;
    reference: string | null;
    note: string | null;
    createdByUser: { id: number; name: string | null; ovog: string | null } | null;
  }>;
  ebarimtReceipt: {
    id: number;
    status: string;
    ddtd: string | null;
    printedAtText: string | null;
    printedAt: string | null;
    totalAmount: number | null;
    qrData: string | null;
    lottery: string | null;
  } | null;
};

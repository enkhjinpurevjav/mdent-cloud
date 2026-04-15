import { formatFinanceDateTime } from "../invoices/formatters";

const METHOD_LABELS: Record<string, string> = {
  cash: "cash",
  transfer: "transfer",
  pos: "pos",
  wallet: "wallet",
  qpay: "qpay",
  insurance: "insurance",
  application: "application",
};

export function fmtMnt(value: number) {
  return `${Number(value || 0).toLocaleString("mn-MN")} ₮`;
}

export function formatPaymentDateTime(value: string | null | undefined): string {
  return formatFinanceDateTime(value);
}

export function formatPaymentMethod(value: string | null | undefined): string {
  if (!value) return "-";
  const method = String(value).trim().toLowerCase();
  return METHOD_LABELS[method] || method;
}

export function formatPaymentStatus(value: string | null | undefined): string {
  if (value === "reversed") return "Буцаасан";
  if (value === "active") return "Идэвхтэй";
  return "-";
}

export function formatPersonName(ovog: string | null | undefined, name: string | null | undefined): string {
  const n = (name || "").trim();
  const o = (ovog || "").trim();
  if (o && n) return `${o[0]}. ${n}`;
  return n || o || "-";
}

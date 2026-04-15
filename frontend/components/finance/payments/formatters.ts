import { formatFinanceDateTime, formatPaymentMethodLabel, formatScheduleDateTimeNaive } from "../invoices/formatters";

export function fmtMnt(value: number) {
  return `${Number(value || 0).toLocaleString("mn-MN")} ₮`;
}

export function formatPaymentDateTime(value: string | null | undefined): string {
  return formatFinanceDateTime(value);
}

export function formatPaymentMethod(value: string | null | undefined): string {
  return formatPaymentMethodLabel(value);
}

export function formatPaymentScheduleDateTime(value: string | null | undefined): string {
  return formatScheduleDateTimeNaive(value);
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

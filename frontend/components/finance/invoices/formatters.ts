import { formatAuditDateTime, formatNaiveDateTime } from "../../appointments/formatters";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Бэлэн",
  POS: "POS",
  QPAY: "QPay",
  WALLET: "Хэтэвч",
  TRANSFER: "Шилжүүлэг",
  INSURANCE: "Даатгал",
  APPLICATION: "Апп",
  EMPLOYEE_BENEFIT: "Ажилчдын хөнгөлөлт",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Төлөгдсөн",
  partial: "Хэсэгчлэн",
  unpaid: "Төлөгдөөгүй",
  overpaid: "Илүү төлсөн",
  voided: "Хүчингүй",
};

export function formatFinanceDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return formatNaiveDateTime(raw.replace("T", " "));
  }

  return formatAuditDateTime(raw);
}

export function formatPaymentMethodLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";

  const mixedMatch = raw.match(/^mixed\s*\((.*)\)$/i);
  if (mixedMatch) {
    const translated = mixedMatch[1]
      .split("/")
      .map((method) => formatPaymentMethodLabel(method))
      .join("/");
    return `Холимог (${translated})`;
  }

  if (/^mixed$/i.test(raw)) return "Холимог";

  const key = raw.toUpperCase();
  return METHOD_LABELS[key] || raw;
}

export function formatInvoiceStatusLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const key = String(value).trim().toLowerCase();
  return STATUS_LABELS[key] || value;
}

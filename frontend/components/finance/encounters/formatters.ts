import { formatStatus } from "../../appointments/formatters";

export function fmtMnt(value: number) {
  return `${Number(value || 0).toLocaleString("mn-MN")} ₮`;
}

export function formatEncounterStatus(value: string | null | undefined) {
  if (!value) return "-";
  return formatStatus(value);
}

export function formatBillingStatus(value: string | null | undefined) {
  switch (value) {
    case "no_invoice":
      return "Нэхэмжлэлгүй";
    case "unpaid":
      return "Төлөгдөөгүй";
    case "partial":
      return "Хэсэгчлэн төлсөн";
    case "paid":
      return "Төлөгдсөн";
    case "free":
      return "Төлбөргүй үзлэг";
    case "close_without_payment":
      return "Төлбөргүй хаасан";
    default:
      return "-";
  }
}

export function billingStatusClass(value: string | null | undefined) {
  switch (value) {
    case "no_invoice":
      return "bg-gray-100 text-gray-700";
    case "unpaid":
      return "bg-red-100 text-red-700";
    case "partial":
      return "bg-amber-100 text-amber-700";
    case "paid":
      return "bg-green-100 text-green-700";
    case "free":
      return "bg-blue-100 text-blue-700";
    case "close_without_payment":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

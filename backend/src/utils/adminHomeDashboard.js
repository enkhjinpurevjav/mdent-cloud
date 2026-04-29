import {
  ADMIN_HOME_EXCLUDED_APPOINTMENT_STATUSES,
  ADMIN_HOME_SLOT_MINUTES,
} from "../constants/dashboard.js";
import { discountPercentEnumToNumber } from "./incomeHelpers.js";

const EXCLUDED_STATUS_SET = new Set(ADMIN_HOME_EXCLUDED_APPOINTMENT_STATUSES);
const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VOIDED_INVOICE_STATUS_SET = new Set(["voided", "void", "canceled", "cancelled"]);

export function hmToMinutes(value) {
  if (!value) return 0;
  const [h, m] = String(value).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function computeScheduleStatsByBranch(schedules) {
  const branchStats = new Map();

  for (const sch of schedules) {
    const startMins = hmToMinutes(sch.startTime);
    const endMins = hmToMinutes(sch.endTime);
    const shiftMinutes = endMins - startMins;
    const possibleSlots = Math.floor(shiftMinutes / ADMIN_HOME_SLOT_MINUTES);
    if (possibleSlots <= 0) continue;

    if (!branchStats.has(sch.branchId)) {
      branchStats.set(sch.branchId, { possibleSlots: 0, doctorIds: new Set() });
    }
    const stat = branchStats.get(sch.branchId);
    stat.possibleSlots += possibleSlots;
    stat.doctorIds.add(sch.doctorId);
  }

  return branchStats;
}

export function computeFilledSlotsByBranch(appointments) {
  const seen = new Set();
  const filledByBranch = new Map();

  for (const appt of appointments) {
    const status = String(appt.status || "").toLowerCase();
    if (EXCLUDED_STATUS_SET.has(status)) continue;
    if (!appt.doctorId) continue;

    if (!(appt.scheduledAt instanceof Date) || Number.isNaN(appt.scheduledAt.getTime())) continue;

    const startAt = appt.scheduledAt;
    const endAt =
      appt.endAt instanceof Date && !Number.isNaN(appt.endAt.getTime()) ? appt.endAt : null;
    const durationMinutes = endAt ? (endAt.getTime() - startAt.getTime()) / 60000 : 0;
    const slotSpan = Math.max(1, Math.ceil(durationMinutes / ADMIN_HOME_SLOT_MINUTES));

    const dateKey = `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, "0")}-${String(
      startAt.getDate()
    ).padStart(2, "0")}`;
    const startSlotIndex = Math.floor(
      (startAt.getHours() * 60 + startAt.getMinutes()) / ADMIN_HOME_SLOT_MINUTES
    );
    const endSlotIndexExclusive = startSlotIndex + slotSpan;

    for (let slotIndex = startSlotIndex; slotIndex < endSlotIndexExclusive; slotIndex += 1) {
      const doctorSlotKey = `${appt.branchId}:${appt.doctorId}:${dateKey}:${slotIndex}`;
      if (seen.has(doctorSlotKey)) continue;
      seen.add(doctorSlotKey);
      filledByBranch.set(appt.branchId, (filledByBranch.get(appt.branchId) || 0) + 1);
    }
  }

  return filledByBranch;
}

export function getLocalDayRange(day) {
  if (!YMD_REGEX.test(String(day || ""))) return null;
  const [year, month, date] = String(day).split("-").map(Number);
  const start = new Date(year, month - 1, date, 0, 0, 0, 0);
  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== date
  ) {
    return null;
  }
  const endExclusive = new Date(year, month - 1, date + 1, 0, 0, 0, 0);
  return { start, endExclusive };
}

export function computeSalesTodayByBranch(payments) {
  const salesByBranch = new Map();

  for (const payment of payments) {
    const branchId = payment.invoice?.branchId;
    if (!branchId) continue;
    salesByBranch.set(branchId, (salesByBranch.get(branchId) || 0) + Number(payment.amount || 0));
  }

  return salesByBranch;
}

function resolveInvoicePayableAmount(invoice) {
  if (!invoice) return 0;
  const status = String(invoice.statusLegacy || "").trim().toLowerCase();
  if (VOIDED_INVOICE_STATUS_SET.has(status)) return 0;
  const payableRaw = invoice.finalAmount ?? invoice.totalAmount ?? 0;
  const payable = Number(payableRaw || 0);
  return Number.isFinite(payable) && payable > 0 ? payable : 0;
}

function normalizeTimestamp(value) {
  const dt = value instanceof Date ? value : new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function sortPaymentsAscending(a, b) {
  const aTs = normalizeTimestamp(a.timestamp)?.getTime() || 0;
  const bTs = normalizeTimestamp(b.timestamp)?.getTime() || 0;
  if (aTs !== bTs) return aTs - bTs;
  return Number(a.id || 0) - Number(b.id || 0);
}

export function computeImagingServiceSalesFromItems(items) {
  let total = 0;
  for (const item of items || []) {
    const discountPct = discountPercentEnumToNumber(item?.invoice?.discountPercent);
    const gross = Number(item?.lineTotal || (item?.unitPrice || 0) * (item?.quantity || 0) || 0);
    const net = Math.max(0, Math.round(gross * (1 - discountPct / 100)));
    if (net > 0) total += net;
  }
  return total;
}

export function computeImagingServiceCount(items) {
  let count = 0;
  for (const item of items || []) {
    const quantity = Number(item?.quantity || 0);
    if (Number.isFinite(quantity) && quantity > 0) count += quantity;
  }
  return Math.round(count);
}

export function computeRecognizedSalesFromPayments(
  payments,
  {
    windowStart,
    windowEnd,
    initialRecognizedByInvoice = new Map(),
    includedMethods = null,
  } = {}
) {
  const startMs = normalizeTimestamp(windowStart)?.getTime();
  const endMs = normalizeTimestamp(windowEnd)?.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return { total: 0, byBranch: new Map() };
  }

  const recognizedByInvoice = new Map(initialRecognizedByInvoice);
  const byBranch = new Map();
  let total = 0;
  const sortedPayments = [...(payments || [])].sort(sortPaymentsAscending);
  const normalizedIncludedMethods =
    includedMethods && typeof includedMethods[Symbol.iterator] === "function"
      ? new Set(Array.from(includedMethods).map((m) => String(m || "").toUpperCase()))
      : null;

  for (const payment of sortedPayments) {
    const ts = normalizeTimestamp(payment.timestamp);
    if (!ts) continue;
    const tsMs = ts.getTime();

    const amount = Number(payment.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const paymentMethod = String(payment.method || "").toUpperCase();

    const invoice = payment.invoice;
    const invoiceId = Number(invoice?.id || payment.invoiceId || 0);
    if (!invoiceId) continue;

    const payableAmount = resolveInvoicePayableAmount(invoice);
    if (payableAmount <= 0) continue;

    const recognizedSoFar = Number(recognizedByInvoice.get(invoiceId) || 0);
    const room = Math.max(0, payableAmount - recognizedSoFar);
    if (room <= 0) continue;

    const recognizedNow = Math.min(amount, room);
    recognizedByInvoice.set(invoiceId, recognizedSoFar + recognizedNow);

    if (tsMs < startMs || tsMs >= endMs) continue;
    if (normalizedIncludedMethods && !normalizedIncludedMethods.has(paymentMethod)) continue;
    total += recognizedNow;
    if (invoice?.branchId) {
      byBranch.set(invoice.branchId, (byBranch.get(invoice.branchId) || 0) + recognizedNow);
    }
  }

  return {
    total,
    byBranch,
  };
}

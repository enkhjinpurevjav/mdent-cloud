/**
 * Helper: compute paid total from a list of payments.
 */
export function computePaidTotal(payments) {
  return (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

/**
 * Helper: create SALE stock movements once when invoice becomes fully paid.
 * Idempotency keyed by (invoiceId, type=SALE).
 */
export async function ensureSaleStockMovementsOnce(trx, invoice, invoiceId, methodStr) {
  const productItems = (invoice?.items || []).filter(
    (it) => it.itemType === "PRODUCT" && it.productId && it.quantity
  );
  if (productItems.length === 0) return;

  const branchId = invoice.branchId ?? null;
  if (!branchId) {
    throw new Error("Cannot determine branchId for stock movement.");
  }

  const already = await trx.productStockMovement.findFirst({
    where: { invoiceId, type: "SALE" },
    select: { id: true },
  });
  if (already) return;

  await trx.productStockMovement.createMany({
    data: productItems.map((it) => ({
      branchId,
      productId: it.productId,
      type: "SALE",
      quantityDelta: -Math.abs(Math.trunc(it.quantity)),
      invoiceId,
      ledgerEntryId: null,
      note: `Auto SALE on invoice paid (method=${methodStr})`,
    })),
  });
}

/**
 * Apply a single payment to an invoice within a Prisma transaction.
 *
 * Handles: payment creation, invoice status update, stock movements,
 * e-Barimt creation, and appointment status update.
 *
 * The caller is responsible for:
 * - EMPLOYEE_BENEFIT balance deduction (before calling this)
 * - QPAY idempotency check (before calling this)
 * - Verifying the invoice is not already fully paid
 *
 * @param {object} trx         - Prisma transaction client
 * @param {object} options
 * @param {object} options.invoice      - Invoice including items, eBarimtReceipt, and
 *                                        encounter (with appointmentId)
 * @param {number} options.payAmount    - Amount to apply (> 0)
 * @param {string} options.methodStr    - Payment method (already uppercased)
 * @param {boolean} [options.issueEBarimt=false] - Issue e-Barimt if invoice becomes fully paid
 * @param {object|null} [options.meta=null]      - Optional payment metadata
 * @param {string|null} [options.qpayTxnId=null] - QPay transaction ID
 * @returns {{ updatedInvoice: object, paidTotal: number, newPayment: object }}
 */
export async function applyPaymentToInvoice(
  trx,
  { invoice, payAmount, methodStr, issueEBarimt = false, meta = null, qpayTxnId = null }
) {
  const invoiceId = invoice.id;

  const baseAmount =
    invoice.finalAmount != null
      ? Number(invoice.finalAmount)
      : Number(invoice.totalAmount || 0);

  // Create payment record
  const paymentData = {
    invoiceId,
    amount: payAmount,
    method: methodStr,
    meta: meta || null,
    timestamp: new Date(),
  };
  if (qpayTxnId) {
    paymentData.qpayTxnId = qpayTxnId;
  }

  const newPayment = await trx.payment.create({ data: paymentData });

  // Re-read all payments to compute fresh total within transaction
  const allPayments = await trx.payment.findMany({ where: { invoiceId } });
  const paidTotal = computePaidTotal(allPayments);

  // Compute new statusLegacy
  let statusLegacy;
  if (paidTotal >= baseAmount) {
    statusLegacy = "paid";
  } else if (paidTotal > 0) {
    statusLegacy = "partial";
  } else {
    statusLegacy = "unpaid";
  }

  // Stock movements when invoice becomes fully paid
  if (paidTotal >= baseAmount) {
    await ensureSaleStockMovementsOnce(trx, invoice, invoiceId, methodStr);
  }

  // e-Barimt when invoice fully paid and requested
  if (!invoice.eBarimtReceipt && paidTotal >= baseAmount && issueEBarimt === true) {
    const receiptNumber = `MDENT-${invoiceId}-${Date.now()}`;
    await trx.eBarimtReceipt.create({
      data: { invoiceId, receiptNumber, timestamp: new Date() },
    });
  }

  // Update invoice status
  const updatedInvoice = await trx.invoice.update({
    where: { id: invoiceId },
    data: { statusLegacy },
    include: { items: true, payments: true, eBarimtReceipt: true },
  });

  // Update appointment status
  const appointmentId = invoice.encounter?.appointmentId ?? null;
  if (appointmentId) {
    let newAppStatus;
    if (paidTotal >= baseAmount) {
      newAppStatus = "completed";
    } else if (paidTotal > 0) {
      newAppStatus = "partial_paid";
    } else {
      newAppStatus = "ready_to_pay";
    }
    await trx.appointment.update({
      where: { id: appointmentId },
      data: { status: newAppStatus },
    });
  }

  return { updatedInvoice, paidTotal, newPayment };
}

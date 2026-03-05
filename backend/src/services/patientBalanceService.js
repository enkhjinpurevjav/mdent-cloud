import prisma from "../db.js";

/**
 * Compute patient balance from all invoices + payments.
 * Returns { totalBilled, totalPaid, balance }.
 * balance = totalBilled - totalPaid
 *   > 0: patient owes money
 *   < 0: patient has credit / prepaid (wallet)
 */
export async function getPatientBalance(patientId) {
  const invoices = await prisma.invoice.findMany({
    where: { patientId },
    select: {
      id: true,
      finalAmount: true,
      totalAmount: true,
    },
  });

  if (invoices.length === 0) {
    return { totalBilled: 0, totalPaid: 0, balance: 0 };
  }

  const invoiceIds = invoices.map((inv) => inv.id);

  const payments = await prisma.payment.groupBy({
    by: ["invoiceId"],
    where: { invoiceId: { in: invoiceIds } },
    _sum: { amount: true },
  });

  const paidByInvoice = new Map();
  for (const p of payments) {
    paidByInvoice.set(p.invoiceId, Number(p._sum.amount || 0));
  }

  let totalBilled = 0;
  let totalPaid = 0;

  for (const inv of invoices) {
    const billed =
      inv.finalAmount != null ? Number(inv.finalAmount) : Number(inv.totalAmount || 0);
    const paid = paidByInvoice.get(inv.id) || 0;
    totalBilled += billed;
    totalPaid += paid;
  }

  totalBilled = Number(totalBilled.toFixed(2));
  totalPaid = Number(totalPaid.toFixed(2));
  const balance = Number((totalBilled - totalPaid).toFixed(2));

  return { totalBilled, totalPaid, balance };
}

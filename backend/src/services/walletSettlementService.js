import { applyPaymentToInvoice } from "./settlementService.js";

async function getPatientWalletAvailable(trx, patientId) {
  const invoices = await trx.invoice.findMany({
    where: { patientId },
    select: {
      id: true,
      finalAmount: true,
      totalAmount: true,
    },
  });

  const invoiceIds = invoices.map((inv) => inv.id);
  const [paymentGroups, adjustmentAgg] = await Promise.all([
    invoiceIds.length > 0
      ? trx.payment.groupBy({
          by: ["invoiceId"],
          where: { invoiceId: { in: invoiceIds } },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
    trx.balanceAdjustmentLog.aggregate({
      where: { patientId },
      _sum: { amount: true },
    }),
  ]);

  const paidByInvoice = new Map();
  for (const row of paymentGroups) {
    paidByInvoice.set(row.invoiceId, Number(row._sum.amount || 0));
  }

  let totalOverpaid = 0;
  for (const inv of invoices) {
    const billed =
      inv.finalAmount != null
        ? Number(inv.finalAmount)
        : Number(inv.totalAmount || 0);
    const paid = paidByInvoice.get(inv.id) || 0;
    totalOverpaid += Math.max(paid - billed, 0);
  }

  const totalAdjusted = Number(adjustmentAgg._sum.amount || 0);
  return Number(Math.max(totalOverpaid + totalAdjusted, 0).toFixed(2));
}

export async function applyWalletSettlement(
  trx,
  {
    invoice,
    payAmount,
    methodStr,
    meta = null,
    createdByUserId = null,
    applyPaymentFn = applyPaymentToInvoice,
  }
) {
  if (!invoice?.patientId) {
    throw new Error("Patient мэдээлэл олдсонгүй.");
  }
  if (!createdByUserId) {
    throw new Error("Төлбөр бүртгэж буй хэрэглэгчийн мэдээлэл олдсонгүй.");
  }

  const availableWallet = await getPatientWalletAvailable(trx, invoice.patientId);

  if (availableWallet < payAmount) {
    throw new Error(
      `Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна. Боломжит: ${availableWallet}₮, Шаардлагатай: ${payAmount}₮`
    );
  }

  const metaNote = meta && typeof meta.note === "string" ? meta.note.trim() : "";
  const reasonParts = [
    "Wallet settlement",
    `invoiceId=${invoice.id}`,
    `encounterId=${invoice.encounterId ?? "null"}`,
  ];
  if (metaNote) {
    reasonParts.push(`note=${metaNote}`);
  }

  await trx.balanceAdjustmentLog.create({
    data: {
      patientId: invoice.patientId,
      // Wallet consumption is tracked as a negative adjustment so patient balance
      // (billed - paid - adjustments) moves toward debt when prepaid credit is spent.
      amount: -payAmount,
      reason: reasonParts.join("; "),
      createdById: createdByUserId,
    },
  });

  return applyPaymentFn(trx, {
    invoice,
    payAmount,
    methodStr,
    meta,
    createdByUserId,
  });
}

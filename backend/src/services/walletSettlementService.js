import { applyPaymentToInvoice } from "./settlementService.js";

async function getPatientBalanceSummary(trx, patientId) {
  const invoices = await trx.invoice.findMany({
    where: { patientId },
    select: {
      id: true,
      finalAmount: true,
      totalAmount: true,
    },
  });

  if (invoices.length === 0) {
    return { totalBilled: 0, totalPaid: 0, totalAdjusted: 0, balance: 0 };
  }

  const invoiceIds = invoices.map((inv) => inv.id);
  const paymentAgg = await trx.payment.aggregate({
    where: { invoiceId: { in: invoiceIds } },
    _sum: { amount: true },
  });
  const adjustmentAgg = await trx.balanceAdjustmentLog.aggregate({
    where: { patientId },
    _sum: { amount: true },
  });

  let totalBilled = 0;
  for (const inv of invoices) {
    totalBilled +=
      inv.finalAmount != null
        ? Number(inv.finalAmount)
        : Number(inv.totalAmount || 0);
  }
  const totalPaid = Number(paymentAgg._sum.amount || 0);
  const totalAdjusted = Number(adjustmentAgg._sum.amount || 0);
  const balance = Number((totalBilled - totalPaid - totalAdjusted).toFixed(2));

  return { totalBilled, totalPaid, totalAdjusted, balance };
}

function buildWalletDeductionReason(invoice, meta) {
  const metaNote = meta && typeof meta.note === "string" ? meta.note.trim() : "";
  const parts = [
    "Wallet settlement",
    `invoiceId=${invoice.id}`,
    `encounterId=${invoice.encounterId ?? "null"}`,
  ];
  if (metaNote) {
    parts.push(`note=${metaNote}`);
  }
  return parts.join("; ");
}

function availableWalletFromPatientBalance(patientBalance) {
  return patientBalance < 0 ? Math.abs(patientBalance) : 0;
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

  const balanceSummary = await getPatientBalanceSummary(trx, invoice.patientId);
  const availableWallet = availableWalletFromPatientBalance(balanceSummary.balance);

  if (availableWallet < payAmount) {
    throw new Error(
      `Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна. Боломжит: ${availableWallet}₮, Шаардлагатай: ${payAmount}₮`
    );
  }

  await trx.balanceAdjustmentLog.create({
    data: {
      patientId: invoice.patientId,
      // Wallet consumption is tracked as a negative adjustment.
      amount: -payAmount,
      reason: buildWalletDeductionReason(invoice, meta),
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

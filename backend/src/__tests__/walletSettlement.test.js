import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyWalletSettlement } from "../routes/invoices.js";

describe("applyWalletSettlement", () => {
  it("creates BalanceAdjustmentLog deduction and applies payment in one flow", async () => {
    const createCalls = [];
    const applyCalls = [];
    const trx = {
      invoice: {
        findMany: async () => [{ id: 11, finalAmount: 1000, totalAmount: 1000 }],
      },
      payment: {
        aggregate: async () => ({ _sum: { amount: 1300 } }),
      },
      balanceAdjustmentLog: {
        aggregate: async () => ({ _sum: { amount: 0 } }),
        create: async (args) => {
          createCalls.push(args);
          return { id: 1, ...args.data };
        },
      },
    };
    const invoice = { id: 99, patientId: 7, encounterId: 21 };

    const result = await applyWalletSettlement(trx, {
      invoice,
      payAmount: 200,
      methodStr: "WALLET",
      meta: { note: "from wallet" },
      createdByUserId: 5,
      applyPaymentFn: async (_trx, payload) => {
        applyCalls.push(payload);
        return { updatedInvoice: { id: 99 }, paidTotal: 1200 };
      },
    });

    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0].data.patientId, 7);
    assert.equal(createCalls[0].data.amount, -200);
    assert.ok(createCalls[0].data.reason.includes("invoiceId=99"));
    assert.ok(createCalls[0].data.reason.includes("encounterId=21"));
    assert.equal(createCalls[0].data.createdById, 5);

    assert.equal(applyCalls.length, 1);
    assert.equal(applyCalls[0].payAmount, 200);
    assert.equal(applyCalls[0].methodStr, "WALLET");
    assert.equal(result.paidTotal, 1200);
  });

  it("throws when available wallet balance is insufficient", async () => {
    let createCalled = false;
    let applyCalled = false;
    const trx = {
      invoice: {
        findMany: async () => [{ id: 11, finalAmount: 1000, totalAmount: 1000 }],
      },
      payment: {
        aggregate: async () => ({ _sum: { amount: 1050 } }),
      },
      balanceAdjustmentLog: {
        aggregate: async () => ({ _sum: { amount: 0 } }),
        create: async () => {
          createCalled = true;
        },
      },
    };

    await assert.rejects(
      () =>
        applyWalletSettlement(trx, {
          invoice: { id: 99, patientId: 7, encounterId: null },
          payAmount: 100,
          methodStr: "WALLET",
          createdByUserId: 5,
          applyPaymentFn: async () => {
            applyCalled = true;
            return { updatedInvoice: { id: 99 }, paidTotal: 0 };
          },
        }),
      /Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна/
    );

    assert.equal(createCalled, false);
    assert.equal(applyCalled, false);
  });
});

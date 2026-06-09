import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ensureOnlineBookingDepositPaymentMethod } from "../services/paymentMethodConfigService.js";

describe("ensureOnlineBookingDepositPaymentMethod", () => {
  it("upserts ONLINE_BOOKING_DEPOSIT method as active with expected label", async () => {
    let capturedArgs = null;
    const prisma = {
      paymentMethodConfig: {
        upsert: async (args) => {
          capturedArgs = args;
          return { id: 1, key: "ONLINE_BOOKING_DEPOSIT" };
        },
      },
    };

    await ensureOnlineBookingDepositPaymentMethod(prisma);

    assert.ok(capturedArgs);
    assert.equal(capturedArgs.where.key, "ONLINE_BOOKING_DEPOSIT");
    assert.equal(capturedArgs.create.label, "онлайн цаг захиалга");
    assert.equal(capturedArgs.create.isActive, true);
    assert.equal(capturedArgs.update.isActive, true);
  });

  it("no-ops safely when prisma client is missing model", async () => {
    await ensureOnlineBookingDepositPaymentMethod({});
    await ensureOnlineBookingDepositPaymentMethod(null);
  });
});


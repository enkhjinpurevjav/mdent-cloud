import { beforeEach, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  __resetTokenCacheForTests,
  checkInvoicePaid,
  createInvoice,
  getAccessToken,
} from "../services/qpayService.js";

function makeJsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

describe("qpayService token caching", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    __resetTokenCacheForTests();
    process.env.QPAY_PERSIST_TOKEN_CACHE = "false";
    process.env.QPAY_ENV = "sandbox";
    process.env.QPAY_BASE_URL_SANDBOX = "https://merchant-sandbox.qpay.mn";
    process.env.QPAY_BASE_URL_LIVE = "https://merchant.qpay.mn";
    process.env.QPAY_CLIENT_ID = "client_a";
    process.env.QPAY_CLIENT_SECRET = "secret_a";
    process.env.QPAY_INVOICE_CODE = "INV_A";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
  });

  it("reuses token when expires_in is not returned (24h fallback)", async () => {
    let authCalls = 0;
    global.fetch = async (url) => {
      if (String(url).endsWith("/v2/auth/token")) {
        authCalls += 1;
        return makeJsonResponse(200, { access_token: "token-24h" });
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const first = await getAccessToken();
    const second = await getAccessToken();

    assert.equal(first, "token-24h");
    assert.equal(second, "token-24h");
    assert.equal(authCalls, 1);
  });

  it("deduplicates concurrent token requests", async () => {
    let authCalls = 0;
    let resolveAuth;
    const authPromise = new Promise((resolve) => {
      resolveAuth = resolve;
    });

    global.fetch = async (url) => {
      if (String(url).endsWith("/v2/auth/token")) {
        authCalls += 1;
        await authPromise;
        return makeJsonResponse(200, {
          access_token: "token-concurrent",
          expires_in: 86400,
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const requests = [getAccessToken(), getAccessToken(), getAccessToken()];
    resolveAuth();
    const tokens = await Promise.all(requests);

    assert.deepEqual(tokens, ["token-concurrent", "token-concurrent", "token-concurrent"]);
    assert.equal(authCalls, 1);
  });

  it("invalidates and retries once on invoice 401", async () => {
    let authCalls = 0;
    let invoiceCalls = 0;

    global.fetch = async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith("/v2/auth/token")) {
        authCalls += 1;
        return makeJsonResponse(200, {
          access_token: authCalls === 1 ? "token-old" : "token-new",
          expires_in: 86400,
        });
      }

      if (normalizedUrl.endsWith("/v2/invoice")) {
        invoiceCalls += 1;
        const authHeader = options?.headers?.Authorization;
        if (invoiceCalls === 1) {
          assert.equal(authHeader, "Bearer token-old");
          return makeJsonResponse(401, {
            error: "NO_CREDENTIALS",
          });
        }
        assert.equal(authHeader, "Bearer token-new");
        return makeJsonResponse(200, {
          invoice_id: "inv_1",
          qr_text: "qr",
          qr_image: "img",
          urls: [],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await createInvoice({
      sender_invoice_no: "BOOK-1",
      amount: 10,
      description: "test",
    });

    assert.equal(result.invoice_id, "inv_1");
    assert.equal(authCalls, 2);
    assert.equal(invoiceCalls, 2);
  });

  it("normalizes invoice deeplink payload and filters invalid links", async () => {
    global.fetch = async (url) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith("/v2/auth/token")) {
        return makeJsonResponse(200, {
          access_token: "token-1",
          expires_in: 86400,
        });
      }

      if (normalizedUrl.endsWith("/v2/invoice")) {
        return makeJsonResponse(200, {
          invoice_id: "inv_2",
          qr_text: "qr",
          qr_image: "img",
          qPay_deeplink: [
            { bank_name: "Bank A", url: "banka://pay?x=1", icon: "a.png" },
            { name: "Bank B", link: "" },
            { name: "Bank C", deep_link: "https://pay.example.com/c" },
          ],
          qPay_shortUrl: "https://qpay.mn/short/fallback",
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await createInvoice({
      sender_invoice_no: "BOOK-2",
      amount: 10,
      description: "test-links",
    });

    assert.deepEqual(result.urls, [
      {
        name: "Bank A",
        description: "Bank A",
        logo: "a.png",
        link: "banka://pay?x=1",
      },
      {
        name: "Bank C",
        description: "Bank C",
        logo: "",
        link: "https://pay.example.com/c",
      },
    ]);
  });

  it("parses payment check rows from nested payload shape", async () => {
    global.fetch = async (url) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith("/v2/auth/token")) {
        return makeJsonResponse(200, {
          access_token: "token-1",
          expires_in: 86400,
        });
      }

      if (normalizedUrl.endsWith("/v2/payment/check")) {
        return makeJsonResponse(200, {
          result: {
            rows: [
              {
                paymentId: "p-1",
                paymentStatus: "SUCCESS",
                paymentAmount: 20000,
                transactionType: "qpay",
                paidAt: "2026-06-09T00:00:00.000Z",
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await checkInvoicePaid("inv-nested", 1);

    assert.equal(result.paid, true);
    assert.equal(result.paidAmount, 20000);
    assert.equal(result.paymentId, "p-1");
    assert.equal(result.transactionType, "qpay");
    assert.equal(result.paidAt, "2026-06-09T00:00:00.000Z");
  });

  it("treats non-array payment rows as unpaid instead of throwing", async () => {
    global.fetch = async (url) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith("/v2/auth/token")) {
        return makeJsonResponse(200, {
          access_token: "token-1",
          expires_in: 86400,
        });
      }

      if (normalizedUrl.endsWith("/v2/payment/check")) {
        return makeJsonResponse(200, {
          rows: {
            payment_id: "p-bad-shape",
            payment_status: "PAID",
          },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await checkInvoicePaid("inv-bad-shape", 1);

    assert.equal(result.paid, false);
    assert.equal(result.paidAmount, 0);
    assert.equal(result.payments.length, 0);
  });
});

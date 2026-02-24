/**
 * POSAPI 3.0 Client
 *
 * Low-level HTTP wrapper for the Mongolian Tax Authority POSAPI 3.0 REST API.
 *
 * Environment variables:
 *   POSAPI_BASE_URL  – Base URL (e.g. https://api.ebarimt.mn)
 *   POSAPI_TIMEOUT   – Request timeout in ms (default: 15000)
 */

const BASE_URL = () =>
  (process.env.POSAPI_BASE_URL || "").replace(/\/$/, "");

const TIMEOUT = () => Number(process.env.POSAPI_TIMEOUT || 15000);

async function request(method, path, { body, headers = {} } = {}) {
  const url = `${BASE_URL()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT());

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { _raw: text };
    }

    if (!res.ok) {
      const err = new Error(
        `POSAPI ${method} ${path} failed (${res.status}): ${text || res.statusText}`
      );
      err.status = res.status;
      err.responseData = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /rest/receipt — Issue a receipt
 * @param {object} payload
 */
export async function issueReceipt(payload) {
  return request("POST", "/rest/receipt", { body: payload });
}

/**
 * DELETE /rest/receipt — Cancel/refund a receipt
 * @param {string} ddtd — receipt ID
 * @param {string} printedAt — "yyyy-MM-dd HH:mm:ss"
 */
export async function refundReceipt(ddtd, printedAt) {
  return request("DELETE", "/rest/receipt", {
    body: { id: ddtd, date: printedAt },
  });
}

/**
 * GET /rest/info — POS terminal info
 */
export async function getInfo() {
  return request("GET", "/rest/info");
}

/**
 * GET /rest/send — Send to unified system
 */
export async function sendToUnifiedSystem() {
  return request("GET", "/rest/send");
}

/**
 * GET /rest/bankAccounts?tin=... — Get bank accounts by TIN
 * @param {string} tin
 */
export async function getBankAccountsByTin(tin) {
  return request("GET", `/rest/bankAccounts?tin=${encodeURIComponent(tin)}`);
}

/**
 * POST to Operator Merchant API
 * @param {object} payload  { posNo, merchantTin, ... }
 * @param {string} token    Bearer token
 * @param {string} apiKey   X-API-KEY header
 */
export async function sendOperatorMerchantRequest(payload, token, apiKey) {
  const url =
    process.env.POSAPI_OPERATOR_BASE_URL ||
    "https://api.ebarimt.mn/api/tpi/receipt/saveOprMerchants";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT());

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { _raw: text };
    }

    if (!res.ok) {
      const err = new Error(
        `OperatorMerchant API failed (${res.status}): ${text || res.statusText}`
      );
      err.status = res.status;
      err.responseData = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

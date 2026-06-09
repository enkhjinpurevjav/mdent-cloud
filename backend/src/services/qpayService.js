/**
 * QPay Service Module
 * Handles QPay sandbox/live API integration for M Dent
 * - Token management with in-memory + DB-backed cache
 * - Invoice creation
 * - Payment status checking
 * - Branch-keyed credentials via QPAY_BRANCHES_JSON
 */
import prisma from "../db.js";

// In-memory token cache keyed by cacheKey
const tokenCacheMap = {};
const tokenRequestInFlightMap = {};
let persistentTokenCacheWarningLogged = false;

// Token expiry configuration (in milliseconds)
const DEFAULT_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h fallback
const TOKEN_EXPIRY_SKEW_MS = 30 * 1000; // refresh 30s before expiry

/**
 * Get QPay base URL based on environment
 */
export function getBaseUrl() {
  const env = (process.env.QPAY_ENV || "sandbox").toLowerCase();
  
  if (env === "live") {
    return (
      process.env.QPAY_BASE_URL_LIVE || "https://merchant.qpay.mn"
    );
  }
  
  return (
    process.env.QPAY_BASE_URL_SANDBOX || "https://merchant-sandbox.qpay.mn"
  );
}

function getEnvironment() {
  return (process.env.QPAY_ENV || "sandbox").toLowerCase();
}

function isPersistentTokenCacheEnabled() {
  return process.env.QPAY_PERSIST_TOKEN_CACHE !== "false";
}

function getTokenCacheKey(clientId) {
  return `${getEnvironment()}:${clientId}`;
}

function isTokenUsable(token, expiresAtMs, now = Date.now()) {
  if (!token || !expiresAtMs || Number.isNaN(Number(expiresAtMs))) return false;
  return Number(expiresAtMs) - TOKEN_EXPIRY_SKEW_MS > now;
}

function parseExpiryFromTokenResponse(data, nowMs) {
  const fromExpiresIn = Number(data?.expires_in);
  if (Number.isFinite(fromExpiresIn) && fromExpiresIn > 0) {
    return nowMs + (fromExpiresIn * 1000);
  }

  const rawAbsolute =
    data?.expires_at ??
    data?.expiresAt ??
    data?.expired_at ??
    data?.expiredAt ??
    null;

  if (rawAbsolute !== null && rawAbsolute !== undefined && rawAbsolute !== "") {
    const absoluteNum = Number(rawAbsolute);
    if (Number.isFinite(absoluteNum) && absoluteNum > 0) {
      // Heuristic: epoch seconds if below 1e12
      return absoluteNum < 1e12 ? absoluteNum * 1000 : absoluteNum;
    }

    const parsed = Date.parse(String(rawAbsolute));
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return nowMs + DEFAULT_TOKEN_EXPIRY_MS;
}

function normalizeInvoiceUrls(data) {
  const candidates =
    data?.urls ??
    data?.qPay_deeplink ??
    data?.qpay_deeplink ??
    data?.qpayDeepLink ??
    data?.qpay_deep_link ??
    [];

  let rawList = candidates;
  if (typeof rawList === "string") {
    try {
      rawList = JSON.parse(rawList);
    } catch {
      rawList = [];
    }
  }
  if (!Array.isArray(rawList)) rawList = [];

  const isValidLink = (value) => {
    const link = String(value || "").trim();
    if (!link) return false;
    return /^[a-z][a-z0-9+.-]*:\/\/.+/i.test(link);
  };

  const normalized = rawList
    .map((entry) => {
      const name = String(
        entry?.name ??
        entry?.bank_name ??
        entry?.bankName ??
        entry?.description ??
        ""
      ).trim();
      const description = String(entry?.description ?? name).trim();
      const logo = String(entry?.logo ?? entry?.icon ?? "").trim();
      const link = String(
        entry?.link ??
        entry?.url ??
        entry?.deeplink ??
        entry?.deep_link ??
        ""
      ).trim();

      if (!isValidLink(link)) return null;
      return {
        name: name || description || "QPay",
        description: description || name || "QPay",
        logo: logo || "",
        link,
      };
    })
    .filter(Boolean);

  if (normalized.length > 0) return normalized;

  const shortUrl = String(
    data?.qPay_shortUrl ??
    data?.qpay_short_url ??
    data?.short_url ??
    ""
  ).trim();
  if (shortUrl && /^https?:\/\/.+/i.test(shortUrl)) {
    return [{
      name: "QPay",
      description: "QPay линк",
      logo: "",
      link: shortUrl,
    }];
  }

  return [];
}

function logPersistentTokenCacheWarning(err) {
  if (persistentTokenCacheWarningLogged) return;
  persistentTokenCacheWarningLogged = true;
  console.warn("QPay token cache persistence unavailable; using in-memory cache only.", {
    code: err?.code,
    message: err?.message,
  });
}

async function readPersistedToken(cacheKey) {
  if (!isPersistentTokenCacheEnabled()) return null;
  try {
    const row = await prisma.qPayAuthToken.findUnique({
      where: { cacheKey },
      select: {
        accessToken: true,
        expiresAt: true,
      },
    });
    if (!row) return null;
    return {
      token: row.accessToken,
      expiresAtMs: row.expiresAt.getTime(),
    };
  } catch (err) {
    logPersistentTokenCacheWarning(err);
    return null;
  }
}

async function persistToken(cacheKey, clientId, token, expiresAtMs) {
  if (!isPersistentTokenCacheEnabled()) return;
  try {
    await prisma.qPayAuthToken.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        environment: getEnvironment(),
        clientId,
        accessToken: token,
        expiresAt: new Date(expiresAtMs),
      },
      update: {
        environment: getEnvironment(),
        clientId,
        accessToken: token,
        expiresAt: new Date(expiresAtMs),
      },
    });
  } catch (err) {
    logPersistentTokenCacheWarning(err);
  }
}

async function clearPersistedToken(cacheKey) {
  if (!isPersistentTokenCacheEnabled()) return;
  try {
    await prisma.qPayAuthToken.deleteMany({
      where: { cacheKey },
    });
  } catch (err) {
    logPersistentTokenCacheWarning(err);
  }
}

async function requestNewToken(clientId, clientSecret) {
  const baseUrl = getBaseUrl();
  const authUrl = `${baseUrl}/v2/auth/token`;
  const now = Date.now();

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `QPay auth failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("QPay auth response missing access_token");
  }

  return {
    token: data.access_token,
    expiresAtMs: parseExpiryFromTokenResponse(data, now),
  };
}

/**
 * Get QPay credentials for a branch.
 * Reads QPAY_BRANCHES_JSON which maps branchId (string) → { clientId, clientSecret, invoiceCode }
 * Falls back to default env vars (QPAY_CLIENT_ID, QPAY_CLIENT_SECRET, QPAY_INVOICE_CODE).
 * @param {number|string} [branchId]
 * @returns {{ clientId: string, clientSecret: string, invoiceCode: string }}
 */
export function getBranchCredentials(branchId) {
  const defaultCreds = {
    clientId: process.env.QPAY_CLIENT_ID,
    clientSecret: process.env.QPAY_CLIENT_SECRET,
    invoiceCode: process.env.QPAY_INVOICE_CODE,
  };

  if (!branchId) return defaultCreds;

  const json = process.env.QPAY_BRANCHES_JSON;
  if (!json) return defaultCreds;

  try {
    const map = JSON.parse(json);
    const key = String(branchId);
    if (map[key]) {
      return {
        clientId: map[key].clientId || defaultCreds.clientId,
        clientSecret: map[key].clientSecret || defaultCreds.clientSecret,
        invoiceCode: map[key].invoiceCode || defaultCreds.invoiceCode,
      };
    }
  } catch {
    // ignore parse errors, fall through to default
  }

  return defaultCreds;
}

/**
 * Get cached access token or request a new one
 * @param {number|string} [branchId] - optional branch ID for per-branch credentials
 * @param {{ forceRefresh?: boolean }} [options]
 */
export async function getAccessToken(branchId, options = {}) {
  const { forceRefresh = false } = options;
  const creds = getBranchCredentials(branchId);
  const { clientId, clientSecret } = creds;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing QPay credentials: QPAY_CLIENT_ID and QPAY_CLIENT_SECRET are required"
    );
  }

  const cacheKey = getTokenCacheKey(clientId);

  const now = Date.now();
  if (!forceRefresh) {
    const memoryCache = tokenCacheMap[cacheKey];
    if (isTokenUsable(memoryCache?.token, memoryCache?.expiresAtMs, now)) {
      return memoryCache.token;
    }

    const persisted = await readPersistedToken(cacheKey);
    if (isTokenUsable(persisted?.token, persisted?.expiresAtMs, now)) {
      tokenCacheMap[cacheKey] = persisted;
      return persisted.token;
    }
  }

  if (tokenRequestInFlightMap[cacheKey]) {
    return tokenRequestInFlightMap[cacheKey];
  }

  tokenRequestInFlightMap[cacheKey] = (async () => {
    let fallbackPersisted = null;
    if (!forceRefresh) {
      fallbackPersisted = await readPersistedToken(cacheKey);
    }

    try {
      const fresh = await requestNewToken(clientId, clientSecret);
      tokenCacheMap[cacheKey] = fresh;
      await persistToken(cacheKey, clientId, fresh.token, fresh.expiresAtMs);
      return fresh.token;
    } catch (err) {
      // If provider temporarily blocks re-auth, still try last persisted token.
      if (fallbackPersisted?.token) {
        tokenCacheMap[cacheKey] = {
          token: fallbackPersisted.token,
          expiresAtMs: now + (5 * 60 * 1000), // short local fallback TTL
        };
        return fallbackPersisted.token;
      }
      throw err;
    }
  })().finally(() => {
    delete tokenRequestInFlightMap[cacheKey];
  });

  return tokenRequestInFlightMap[cacheKey];
}

export async function invalidateAccessToken(branchId) {
  const creds = getBranchCredentials(branchId);
  const clientId = creds?.clientId;
  if (!clientId) return;

  const cacheKey = getTokenCacheKey(clientId);
  delete tokenCacheMap[cacheKey];
  delete tokenRequestInFlightMap[cacheKey];
  await clearPersistedToken(cacheKey);
}

async function authorizedFetchWithRetry({ branchId, url, method, payload }) {
  const makeRequest = async (token) => {
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    return fetch(url, {
      method,
      headers,
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });
  };

  const firstToken = await getAccessToken(branchId);
  let response = await makeRequest(firstToken);
  if (response.status !== 401) return response;

  await invalidateAccessToken(branchId);
  const refreshedToken = await getAccessToken(branchId, { forceRefresh: true });
  response = await makeRequest(refreshedToken);
  return response;
}

/**
 * Create QPay invoice
 * @param {Object} params
 * @param {string} params.sender_invoice_no - Unique invoice number from our system
 * @param {number} params.amount - Amount to charge
 * @param {string} params.description - Invoice description
 * @param {string} [params.receiver_code] - Optional receiver code (default: terminal)
 * @param {string} [params.callback_url] - Optional callback URL
 * @param {number|string} [params.branchId] - Optional branch ID for per-branch credentials
 * @returns {Promise<Object>} Normalized invoice response
 */
export async function createInvoice({
  sender_invoice_no,
  amount,
  description,
  receiver_code,
  callback_url,
  branchId,
}) {
  const creds = getBranchCredentials(branchId);
  if (!creds.invoiceCode) {
    throw new Error("Missing QPAY_INVOICE_CODE environment variable");
  }

  const baseUrl = getBaseUrl();
  const invoiceUrl = `${baseUrl}/v2/invoice`;

  const payload = {
    invoice_code: creds.invoiceCode,
    sender_invoice_no,
    invoice_receiver_code: receiver_code || process.env.QPAY_RECEIVER_CODE || "terminal",
    invoice_description: description,
    amount: Number(amount),
    callback_url: callback_url || process.env.QPAY_CALLBACK_URL,
  };

  const response = await authorizedFetchWithRetry({
    branchId,
    url: invoiceUrl,
    method: "POST",
    payload,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `QPay invoice creation failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  const data = await response.json();

  // Normalize response
  return {
    invoice_id: data.invoice_id,
    qr_text: data.qr_text,
    qr_image: data.qr_image,
    urls: normalizeInvoiceUrls(data),
    raw: data,
  };
}

/**
 * Check if invoice is paid
 * @param {string} qpayInvoiceId - QPay invoice ID
 * @param {number|string} [branchId] - Optional branch ID for per-branch credentials
 * @returns {Promise<Object>} Normalized payment status
 */
export async function checkInvoicePaid(qpayInvoiceId, branchId) {
  const baseUrl = getBaseUrl();
  const checkUrl = `${baseUrl}/v2/payment/check`;

  const payload = {
    object_type: "INVOICE",
    object_id: qpayInvoiceId,
    offset: {
      page_number: 1,
      page_limit: 100,
    },
  };

  const response = await authorizedFetchWithRetry({
    branchId,
    url: checkUrl,
    method: "POST",
    payload,
  });

  const rawText = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(
      `QPay check payment failed (${response.status}): ${rawText || response.statusText}`
    );
  }

  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (parseErr) {
    throw new Error(
      `QPay check payment returned invalid JSON: ${parseErr.message}`
    );
  }

  const rawRows =
    (Array.isArray(data?.rows) && data.rows)
    || (Array.isArray(data?.result?.rows) && data.result.rows)
    || (Array.isArray(data?.data?.rows) && data.data.rows)
    || (Array.isArray(data?.payments) && data.payments)
    || [];

  const normalizeRow = (row = {}) => ({
    payment_id:
      row.payment_id
      ?? row.paymentId
      ?? row.transaction_id
      ?? row.transactionId
      ?? null,
    payment_status: String(
      row.payment_status
      ?? row.paymentStatus
      ?? row.status
      ?? ""
    ).toUpperCase(),
    payment_amount: Number(
      row.payment_amount
      ?? row.paymentAmount
      ?? row.amount
      ?? row.paid_amount
      ?? 0
    ),
    transaction_type:
      row.payment_wallet
      ?? row.transaction_type
      ?? row.transactionType
      ?? row.wallet
      ?? null,
    payment_date:
      row.payment_date
      ?? row.paymentDate
      ?? row.paid_at
      ?? row.paidAt
      ?? null,
  });

  // Parse payment details
  const rows = rawRows.map(normalizeRow);
  const paidRows = rows.filter((r) => (
    r.payment_status === "PAID"
    || r.payment_status === "SUCCESS"
    || r.payment_status === "COMPLETED"
    || r.payment_status === "CONFIRMED"
  ));
  const paid = paidRows.length > 0;
  const paidAmount = paidRows.reduce((sum, r) => sum + Number(r.payment_amount || 0), 0);

  // Get latest payment details
  const latestPayment = paidRows.length > 0 ? paidRows[0] : null;

  return {
    paid,
    paidAmount,
    paymentId: latestPayment?.payment_id || null,
    transactionType: latestPayment?.transaction_type || null,
    paidAt: latestPayment?.payment_date || null,
    payments: rows,
    raw: data,
  };
}

/**
 * Cancel (delete) a QPay invoice
 * @param {string} qpayInvoiceId - QPay invoice ID to cancel
 * @param {number|string} [branchId] - Optional branch ID for per-branch credentials
 */
export async function cancelInvoice(qpayInvoiceId, branchId) {
  const baseUrl = getBaseUrl();
  const deleteUrl = `${baseUrl}/v2/invoice/${qpayInvoiceId}`;

  const response = await authorizedFetchWithRetry({
    branchId,
    url: deleteUrl,
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `QPay invoice cancellation failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  return true;
}

export function __resetTokenCacheForTests() {
  Object.keys(tokenCacheMap).forEach((k) => delete tokenCacheMap[k]);
  Object.keys(tokenRequestInFlightMap).forEach((k) => delete tokenRequestInFlightMap[k]);
  persistentTokenCacheWarningLogged = false;
}

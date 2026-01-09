/**
 * QPay Service Module
 * Handles QPay sandbox/live API integration for M Dent
 * - Token management with caching
 * - Invoice creation
 * - Payment status checking
 */

// In-memory token cache
let tokenCache = {
  token: null,
  expiresAt: null,
};

// Token expiry configuration (in milliseconds)
const DEFAULT_TOKEN_EXPIRY_MS = 50 * 60 * 1000; // 50 minutes

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

/**
 * Get cached access token or request a new one
 */
export async function getAccessToken() {
  // Check if we have a valid cached token
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }

  // Request new token
  const clientId = process.env.QPAY_CLIENT_ID;
  const clientSecret = process.env.QPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing QPay credentials: QPAY_CLIENT_ID and QPAY_CLIENT_SECRET are required"
    );
  }

  const baseUrl = getBaseUrl();
  const authUrl = `${baseUrl}/v2/auth/token`;

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

  // Cache token with expiry (default 50 minutes if not provided)
  const expiresIn = data.expires_in ? Number(data.expires_in) * 1000 : DEFAULT_TOKEN_EXPIRY_MS;
  tokenCache = {
    token: data.access_token,
    expiresAt: now + expiresIn,
  };

  return tokenCache.token;
}

/**
 * Create QPay invoice
 * @param {Object} params
 * @param {string} params.sender_invoice_no - Unique invoice number from our system
 * @param {number} params.amount - Amount to charge
 * @param {string} params.description - Invoice description
 * @param {string} [params.receiver_code] - Optional receiver code (default: terminal)
 * @param {string} [params.callback_url] - Optional callback URL
 * @returns {Promise<Object>} Normalized invoice response
 */
export async function createInvoice({
  sender_invoice_no,
  amount,
  description,
  receiver_code,
  callback_url,
}) {
  const invoiceCode = process.env.QPAY_INVOICE_CODE;
  if (!invoiceCode) {
    throw new Error("Missing QPAY_INVOICE_CODE environment variable");
  }

  const token = await getAccessToken();
  const baseUrl = getBaseUrl();
  const invoiceUrl = `${baseUrl}/v2/invoice`;

  const payload = {
    invoice_code: invoiceCode,
    sender_invoice_no,
    invoice_receiver_code: receiver_code || process.env.QPAY_RECEIVER_CODE || "terminal",
    invoice_description: description,
    amount: Number(amount),
    callback_url: callback_url || process.env.QPAY_CALLBACK_URL,
  };

  const response = await fetch(invoiceUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
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
    urls: data.urls || [],
    raw: data,
  };
}

/**
 * Check if invoice is paid
 * @param {string} qpayInvoiceId - QPay invoice ID
 * @returns {Promise<Object>} Normalized payment status
 */
export async function checkInvoicePaid(qpayInvoiceId) {
  const token = await getAccessToken();
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

  const response = await fetch(checkUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `QPay check payment failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  const data = await response.json();

  // Parse payment details
  const rows = data.rows || [];
  const paidRows = rows.filter((r) => r.payment_status === "PAID");
  const paid = paidRows.length > 0;
  const paidAmount = paidRows.reduce((sum, r) => sum + Number(r.payment_amount || 0), 0);

  // Get latest payment details
  const latestPayment = paidRows.length > 0 ? paidRows[0] : null;

  return {
    paid,
    paidAmount,
    paymentId: latestPayment?.payment_id || null,
    transactionType: latestPayment?.payment_wallet || null,
    paidAt: latestPayment?.payment_date || null,
    payments: rows.map((r) => ({
      payment_id: r.payment_id,
      payment_status: r.payment_status,
      payment_amount: r.payment_amount,
      transaction_type: r.payment_wallet,
      payment_date: r.payment_date,
    })),
    raw: data,
  };
}

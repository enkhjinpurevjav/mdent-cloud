/**
 * E-Barimt (DDTD) Integration Service
 *
 * Calls the Mongolian Tax Authority (DDTD) eBarimt REST API to issue
 * an electronic receipt (касс баримт) for a fully-paid invoice.
 *
 * Environment variables:
 *   EBARIMT_API_URL   – Base URL for the DDTD eBarimt API endpoint
 *   EBARIMT_API_KEY   – API key / bearer token
 *   EBARIMT_POS_ID    – POS / terminal ID assigned by DDTD
 *   EBARIMT_BRANCH_REG_NO – Branch TIN (РД) registered with DDTD
 *   EBARIMT_SKIP      – Set to "true" to skip external call (dev / CI)
 *
 * In test / CI environments (NODE_ENV=test or EBARIMT_SKIP=true) the
 * function returns a deterministic stub receipt number so unit tests
 * never hit the external API.
 */

/**
 * Issue an e-Barimt receipt for a fully-paid invoice.
 *
 * @param {object} params
 * @param {number}  params.invoiceId      – Our internal invoice ID
 * @param {number}  params.amount         – Total amount paid (₮)
 * @param {string}  [params.customerTin]  – Customer TIN (РД); omit for B2C
 * @returns {Promise<string>}             – Receipt number (billId) from DDTD
 * @throws {Error}                        – On API / network failure
 */
export async function issueEBarimt({ invoiceId, amount, customerTin }) {
  // Guard: skip external call in test / CI environments
  const skip =
    process.env.EBARIMT_SKIP === "true" ||
    process.env.NODE_ENV === "test";

  if (skip) {
    // Return a deterministic stub that is unique per invoice
    return `TEST-EBARIMT-${invoiceId}`;
  }

  const apiUrl = process.env.EBARIMT_API_URL;
  const apiKey = process.env.EBARIMT_API_KEY;
  const posId = process.env.EBARIMT_POS_ID;
  const branchRegNo = process.env.EBARIMT_BRANCH_REG_NO;

  if (!apiUrl || !apiKey || !posId || !branchRegNo) {
    throw new Error(
      "E-Barimt тохиргоо дутуу байна (EBARIMT_API_URL, EBARIMT_API_KEY, EBARIMT_POS_ID, EBARIMT_BRANCH_REG_NO шаардлагатай)."
    );
  }

  const payload = {
    // Standard DDTD eBarimt API fields
    billType: customerTin ? "3" : "1", // 1=B2C, 3=B2B
    posId,
    branchNo: branchRegNo,
    districtCode: process.env.EBARIMT_DISTRICT_CODE || "34",
    merchantTin: branchRegNo,
    customerTin: customerTin || null,
    invoiceId: String(invoiceId),
    amount: Number(amount),
    vat: Math.round(Number(amount) * 10 / 110), // 10% VAT (standard MN rate)
    cityTax: 0,
    taxType: "VAT_ABLE",
    payments: [{ code: "CASH", status: "PAID", amount: Number(amount) }],
  };

  const response = await fetch(`${apiUrl}/rest/receipt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `E-Barimt гаргахад алдаа гарлаа (${response.status}): ${text || response.statusText}`
    );
  }

  const data = await response.json();

  // The DDTD API returns billId as the unique receipt number
  const receiptNumber = data.billId || data.receiptNumber || data.id;
  if (!receiptNumber) {
    throw new Error(
      "E-Barimt хариунд тасалбарын дугаар байхгүй байна."
    );
  }

  return String(receiptNumber);
}

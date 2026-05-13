import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDetailedPaymentSummaryRows,
  buildIncomeDetailedPageSummaryRows,
} from "../routes/admin/income.js";

test("buildDetailedPaymentSummaryRows includes required methods with zeros", () => {
  const rows = buildDetailedPaymentSummaryRows([], []);
  const methods = rows.map((r) => r.method);

  assert.deepEqual(methods.slice(0, 7), [
    "CASH",
    "POS",
    "TRANSFER",
    "QPAY",
    "APPLICATION",
    "INSURANCE",
    "VOUCHER",
  ]);
  assert.ok(rows.every((r) => r.totalAmount === 0 && r.count === 0));
});

test("buildDetailedPaymentSummaryRows appends extra methods and uses labels", () => {
  const rows = buildDetailedPaymentSummaryRows(
    [
      { method: "CASH", _sum: { amount: 150000 }, _count: { _all: 2 } },
      { method: "OTHER", _sum: { amount: 25000 }, _count: { _all: 1 } },
    ],
    [
      { key: "CASH", label: "Бэлэн" },
      { key: "OTHER", label: "Бусад" },
    ]
  );

  const cash = rows.find((r) => r.method === "CASH");
  const other = rows.find((r) => r.method === "OTHER");

  assert.equal(cash?.label, "Бэлэн");
  assert.equal(cash?.totalAmount, 150000);
  assert.equal(cash?.count, 2);

  assert.equal(other?.label, "Бусад");
  assert.equal(other?.totalAmount, 25000);
  assert.equal(other?.count, 1);
  assert.equal(rows[rows.length - 1]?.method, "OTHER");
});

test("buildIncomeDetailedPageSummaryRows injects wallet when missing and places imaging before product", () => {
  const rows = buildIncomeDetailedPageSummaryRows(
    [
      { method: "CASH", label: "Бэлэн", totalAmount: 150000, count: 2 },
      { method: "POS", label: "POS", totalAmount: 450000, count: 6 },
    ],
    {
      imagingProductionTotal: 1082000,
      imagingCount: 14,
      productSalesTotal: 15000,
      productCount: 1,
    }
  );

  const walletIndex = rows.findIndex((r) => r.method === "WALLET");
  const imagingIndex = rows.findIndex((r) => r.method === "IMAGING_SALES");
  const productIndex = rows.findIndex((r) => r.method === "PRODUCT_SALES");

  assert.notEqual(walletIndex, -1);
  assert.equal(imagingIndex, walletIndex + 1);
  assert.equal(productIndex, rows.length - 1);
  assert.equal(rows[imagingIndex]?.totalAmount, 1082000);
  assert.equal(rows[imagingIndex]?.count, 14);
});

test("buildIncomeDetailedPageSummaryRows inserts imaging immediately after existing wallet row", () => {
  const rows = buildIncomeDetailedPageSummaryRows(
    [
      { method: "CASH", label: "Бэлэн", totalAmount: 100, count: 1 },
      { method: "WALLET", label: "Хэтэвч", totalAmount: 200, count: 2 },
      { method: "INSURANCE", label: "Даатгал", totalAmount: 300, count: 3 },
    ],
    {
      imagingProductionTotal: 777,
      imagingCount: 4,
      productSalesTotal: 555,
      productCount: 5,
    }
  );

  const walletIndex = rows.findIndex((r) => r.method === "WALLET");
  const imagingIndex = rows.findIndex((r) => r.method === "IMAGING_SALES");
  const productIndex = rows.findIndex((r) => r.method === "PRODUCT_SALES");

  assert.equal(imagingIndex, walletIndex + 1);
  assert.equal(rows[imagingIndex]?.count, 4);
  assert.equal(rows[productIndex]?.totalAmount, 555);
});

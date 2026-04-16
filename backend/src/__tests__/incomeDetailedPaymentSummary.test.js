import test from "node:test";
import assert from "node:assert/strict";
import { buildDetailedPaymentSummaryRows } from "../routes/admin/income.js";

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

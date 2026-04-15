import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isInvoiceVoidedStatus } from "../routes/invoices.js";

describe("isInvoiceVoidedStatus", () => {
  it("returns true for known void/cancel status variants", () => {
    assert.equal(isInvoiceVoidedStatus("voided"), true);
    assert.equal(isInvoiceVoidedStatus("VOID"), true);
    assert.equal(isInvoiceVoidedStatus("cancelled"), true);
    assert.equal(isInvoiceVoidedStatus("CANCELED"), true);
  });

  it("returns false for non-void statuses", () => {
    assert.equal(isInvoiceVoidedStatus("paid"), false);
    assert.equal(isInvoiceVoidedStatus("partial"), false);
    assert.equal(isInvoiceVoidedStatus("unpaid"), false);
    assert.equal(isInvoiceVoidedStatus(null), false);
  });
});

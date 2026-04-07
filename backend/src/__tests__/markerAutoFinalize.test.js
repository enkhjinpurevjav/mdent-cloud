/**
 * Unit tests for the marker-only encounter auto-finalization logic
 * in POST /api/billing/encounters/:id/batch-settlement.
 *
 * Because the live endpoint requires a database, these tests inline the pure
 * decision logic so the rules are regression-protected without a DB dependency.
 *
 * Scenarios validated:
 *  A) Marker-only invoice + old balance cleared → should auto-finalize
 *  B) Marker-only invoice + old balance still > 0 → should NOT auto-finalize
 *  C) Invoice with > 1 item → should NOT auto-finalize (not marker-only)
 *  D) Invoice has 1 item but it is a PRODUCT → should NOT auto-finalize
 *  E) Invoice has 1 SERVICE item but category is not PREVIOUS → should NOT auto-finalize
 *  F) Invoice base amount > 0 → should NOT auto-finalize
 *  G) amountForCurrent > 0 → should NOT auto-finalize
 *  H) Unauthorized role (doctor) → should NOT auto-finalize
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline the pure decision helpers (mirrors billing.js logic)
// ---------------------------------------------------------------------------

const MARKER_AUTO_FINALIZE_ROLES = ["receptionist", "admin", "superadmin"];

/**
 * Returns true when the current invoice qualifies as "marker-only":
 *  - base amount is 0
 *  - exactly one invoice item
 *  - that item is a SERVICE with category PREVIOUS
 */
function isMarkerOnlyInvoice(currentBaseAmount, items) {
  return (
    currentBaseAmount === 0 &&
    items.length === 1 &&
    items[0].itemType === "SERVICE" &&
    items[0].service?.category === "PREVIOUS"
  );
}

/**
 * Returns true when the auto-finalize conditions are all satisfied:
 *  1. No payment is being applied to the current invoice (amountForCurrent === 0)
 *  2. Invoice is marker-only
 *  3. Requesting user role is authorized
 *  4. Remaining old balance after FIFO is 0
 */
function shouldAutoFinalize({
  amountForCurrent,
  currentBaseAmount,
  items,
  userRole,
  remainingOldBalance,
}) {
  if (amountForCurrent !== 0) return false;
  if (!isMarkerOnlyInvoice(currentBaseAmount, items)) return false;
  if (!MARKER_AUTO_FINALIZE_ROLES.includes(userRole)) return false;
  if (remainingOldBalance !== 0) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Common fixtures
// ---------------------------------------------------------------------------

const PREVIOUS_ITEM = { itemType: "SERVICE", service: { category: "PREVIOUS" } };

const BASE_ARGS = {
  amountForCurrent: 0,
  currentBaseAmount: 0,
  items: [PREVIOUS_ITEM],
  userRole: "receptionist",
  remainingOldBalance: 0,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("marker auto-finalize: isMarkerOnlyInvoice detection", () => {
  it("single PREVIOUS SERVICE item + baseAmount 0 → marker-only", () => {
    assert.equal(isMarkerOnlyInvoice(0, [PREVIOUS_ITEM]), true);
  });

  it("baseAmount > 0 → not marker-only (has real charges)", () => {
    assert.equal(isMarkerOnlyInvoice(5000, [PREVIOUS_ITEM]), false);
  });

  it("more than 1 item → not marker-only", () => {
    const items = [
      PREVIOUS_ITEM,
      { itemType: "SERVICE", service: { category: "GENERAL" } },
    ];
    assert.equal(isMarkerOnlyInvoice(0, items), false);
  });

  it("single PRODUCT item → not marker-only", () => {
    const items = [{ itemType: "PRODUCT", service: null }];
    assert.equal(isMarkerOnlyInvoice(0, items), false);
  });

  it("single SERVICE item but category is GENERAL → not marker-only", () => {
    const items = [{ itemType: "SERVICE", service: { category: "GENERAL" } }];
    assert.equal(isMarkerOnlyInvoice(0, items), false);
  });

  it("empty items array → not marker-only", () => {
    assert.equal(isMarkerOnlyInvoice(0, []), false);
  });
});

describe("marker auto-finalize: shouldAutoFinalize gate", () => {
  it("Scenario A: all conditions met → should auto-finalize", () => {
    assert.equal(shouldAutoFinalize({ ...BASE_ARGS }), true);
  });

  it("Scenario B: old balance still > 0 → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalize({ ...BASE_ARGS, remainingOldBalance: 1000 }),
      false
    );
  });

  it("Scenario C: invoice has 2 items → should NOT auto-finalize", () => {
    const items = [
      PREVIOUS_ITEM,
      { itemType: "SERVICE", service: { category: "GENERAL" } },
    ];
    assert.equal(shouldAutoFinalize({ ...BASE_ARGS, items }), false);
  });

  it("Scenario D: single PRODUCT item → should NOT auto-finalize", () => {
    const items = [{ itemType: "PRODUCT", service: null }];
    assert.equal(shouldAutoFinalize({ ...BASE_ARGS, items }), false);
  });

  it("Scenario E: single non-PREVIOUS SERVICE → should NOT auto-finalize", () => {
    const items = [{ itemType: "SERVICE", service: { category: "IMPLANT" } }];
    assert.equal(shouldAutoFinalize({ ...BASE_ARGS, items }), false);
  });

  it("Scenario F: baseAmount > 0 → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalize({ ...BASE_ARGS, currentBaseAmount: 100 }),
      false
    );
  });

  it("Scenario G: amountForCurrent > 0 → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalize({ ...BASE_ARGS, amountForCurrent: 500 }),
      false
    );
  });

  it("Scenario H: role=doctor → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalize({ ...BASE_ARGS, userRole: "doctor" }),
      false
    );
  });

  it("role=admin → should auto-finalize", () => {
    assert.equal(shouldAutoFinalize({ ...BASE_ARGS, userRole: "admin" }), true);
  });

  it("role=superadmin → should auto-finalize", () => {
    assert.equal(
      shouldAutoFinalize({ ...BASE_ARGS, userRole: "superadmin" }),
      true
    );
  });

  it("role=undefined → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalize({ ...BASE_ARGS, userRole: undefined }),
      false
    );
  });
});

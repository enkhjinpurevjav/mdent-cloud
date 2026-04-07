/**
 * Unit tests for the marker-only encounter auto-finalization logic in:
 *  - POST /api/billing/encounters/:id/batch-settlement
 *  - GET  /api/billing/encounters/:id/invoice  (page-load auto-finalize)
 *
 * Because the live endpoint requires a database, these tests inline the pure
 * decision logic so the rules are regression-protected without a DB dependency.
 *
 * Scenarios validated for batch-settlement:
 *  A) Marker-only invoice + old balance cleared → should auto-finalize
 *  B) Marker-only invoice + old balance still > 0 → should NOT auto-finalize
 *  C) Invoice with > 1 item → should NOT auto-finalize (not marker-only)
 *  D) Invoice has 1 item but it is a PRODUCT → should NOT auto-finalize
 *  E) Invoice has 1 SERVICE item but category is not PREVIOUS → should NOT auto-finalize
 *  F) Invoice base amount > 0 → should NOT auto-finalize
 *  G) amountForCurrent > 0 → should NOT auto-finalize
 *  H) Unauthorized role (doctor) → should NOT auto-finalize
 *
 * Scenarios validated for GET invoice page-load auto-finalize:
 *  A) All conditions met (old balance = 0, ready_to_pay) → should auto-finalize
 *  B) Old balance > 0 → should NOT auto-finalize
 *  C) encounter has > 1 service → should NOT auto-finalize
 *  D) encounter service category is not PREVIOUS → should NOT auto-finalize
 *  E) invoice has > 1 item / PRODUCT item / non-PREVIOUS category → should NOT auto-finalize
 *  F) invoice base amount > 0 → should NOT auto-finalize
 *  G) appointment status is not ready_to_pay → should NOT auto-finalize
 *  H) Unauthorized role (doctor / undefined) → should NOT auto-finalize
 *  I) No appointmentId → should NOT auto-finalize
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

// ---------------------------------------------------------------------------
// GET /encounters/:id/invoice — page-load auto-finalize logic
// ---------------------------------------------------------------------------

/**
 * Returns true when all conditions for GET-route auto-finalization are met:
 *  1. userRole is billing-authorized
 *  2. encounter has an appointmentId
 *  3. encounterServices has exactly 1 entry with category PREVIOUS
 *  4. invoice items: exactly 1, SERVICE, category PREVIOUS
 *  5. invoice base amount === 0
 *  6. patientOldBalance === 0
 *  7. appointment.status === "ready_to_pay"
 */
function shouldAutoFinalizeOnGet({
  userRole,
  appointmentId,
  encounterServices,
  invoiceItems,
  invoiceBaseAmount,
  patientOldBalance,
  appointmentStatus,
}) {
  const ROLES = ["receptionist", "admin", "superadmin"];
  if (!ROLES.includes(userRole)) return false;
  if (!appointmentId) return false;

  const isMarkerOnlyEncounter =
    (encounterServices || []).length === 1 &&
    encounterServices[0].service?.category === "PREVIOUS";
  if (!isMarkerOnlyEncounter) return false;

  const isMarkerOnlyInv =
    invoiceBaseAmount === 0 &&
    invoiceItems.length === 1 &&
    invoiceItems[0].itemType === "SERVICE" &&
    invoiceItems[0].service?.category === "PREVIOUS";
  if (!isMarkerOnlyInv) return false;

  if (patientOldBalance !== 0) return false;
  if (appointmentStatus !== "ready_to_pay") return false;

  return true;
}

const PREVIOUS_ENCOUNTER_SERVICE = { service: { category: "PREVIOUS" } };
const PREVIOUS_INVOICE_ITEM = { itemType: "SERVICE", service: { category: "PREVIOUS" } };

const GET_BASE_ARGS = {
  userRole: "receptionist",
  appointmentId: 42,
  encounterServices: [PREVIOUS_ENCOUNTER_SERVICE],
  invoiceItems: [PREVIOUS_INVOICE_ITEM],
  invoiceBaseAmount: 0,
  patientOldBalance: 0,
  appointmentStatus: "ready_to_pay",
};

describe("GET invoice page-load auto-finalize: shouldAutoFinalizeOnGet", () => {
  it("Scenario A: all conditions met → should auto-finalize", () => {
    assert.equal(shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS }), true);
  });

  it("Scenario B: patientOldBalance > 0 → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, patientOldBalance: 5000 }),
      false
    );
  });

  it("Scenario C: encounter has 2 services → should NOT auto-finalize", () => {
    const services = [
      PREVIOUS_ENCOUNTER_SERVICE,
      { service: { category: "GENERAL" } },
    ];
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, encounterServices: services }),
      false
    );
  });

  it("Scenario D: encounter service category is not PREVIOUS → should NOT auto-finalize", () => {
    const services = [{ service: { category: "GENERAL" } }];
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, encounterServices: services }),
      false
    );
  });

  it("Scenario E: invoice has 2 items → should NOT auto-finalize", () => {
    const items = [
      PREVIOUS_INVOICE_ITEM,
      { itemType: "SERVICE", service: { category: "GENERAL" } },
    ];
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, invoiceItems: items }),
      false
    );
  });

  it("Scenario E2: invoice item is a PRODUCT → should NOT auto-finalize", () => {
    const items = [{ itemType: "PRODUCT", service: null }];
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, invoiceItems: items }),
      false
    );
  });

  it("Scenario E3: invoice item category is not PREVIOUS → should NOT auto-finalize", () => {
    const items = [{ itemType: "SERVICE", service: { category: "IMPLANT" } }];
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, invoiceItems: items }),
      false
    );
  });

  it("Scenario F: invoiceBaseAmount > 0 → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, invoiceBaseAmount: 100 }),
      false
    );
  });

  it("Scenario G: appointmentStatus is 'completed' → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, appointmentStatus: "completed" }),
      false
    );
  });

  it("Scenario G2: appointmentStatus is 'partial_paid' → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, appointmentStatus: "partial_paid" }),
      false
    );
  });

  it("Scenario H: role=doctor → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, userRole: "doctor" }),
      false
    );
  });

  it("Scenario H2: role=undefined → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, userRole: undefined }),
      false
    );
  });

  it("Scenario I: no appointmentId → should NOT auto-finalize", () => {
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, appointmentId: null }),
      false
    );
  });

  it("role=admin → should auto-finalize", () => {
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, userRole: "admin" }),
      true
    );
  });

  it("role=superadmin → should auto-finalize", () => {
    assert.equal(
      shouldAutoFinalizeOnGet({ ...GET_BASE_ARGS, userRole: "superadmin" }),
      true
    );
  });
});

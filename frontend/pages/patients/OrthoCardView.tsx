import React from "react";
import OrthoCardPage from "../../pages/ortho/[bookNumber]";

/**
 * OrthoCardView
 * Renders the existing Ortho card UI inside Patient Profile layout.
 *
 * This is a compatibility wrapper to keep behavior identical while we migrate
 * the ortho page into a reusable component.
 *
 * IMPORTANT:
 * - This assumes OrthoCardPage uses router param bookNumber.
 * - The patient profile route is /patients/[bookNumber], so the router param
 *   will already be present and OrthoCardPage will load correctly.
 */
export default function OrthoCardView() {
  return <OrthoCardPage embedded={true} />;
}

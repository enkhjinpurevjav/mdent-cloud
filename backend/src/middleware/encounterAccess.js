import prisma from "../db.js";
import { parseKioskToken } from "./auth.js";

/**
 * Returns an error object { status, error } if the caller does NOT have write access
 * to the given encounter, or null if access is granted.
 *
 * Mirrors the logic in requireEncounterWriteAccess (encounters.js) but accepts an
 * explicit encounterId so it can be used in route handlers that have already resolved
 * the encounter id from a related record (e.g. EncounterService, EncounterDiagnosis).
 *
 * Allowed roles and conditions:
 *   - admin / super_admin          → always allowed
 *   - doctor                       → must own the encounter + appointment status ongoing
 *   - doctor_kiosk (cookie-based)  → must own + status ongoing + branch match
 *   - all other roles              → 403
 */
export async function checkEncounterWriteAccess(req, encounterId) {
  if (process.env.DISABLE_AUTH === "true") return null;

  const user = req.user;
  if (!user) return { status: 401, error: "Authentication required." };

  const { role, id: userId } = user;

  if (role === "admin" || role === "super_admin") return null;

  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    select: {
      doctorId: true,
      appointment: { select: { status: true, branchId: true } },
    },
  });

  if (!encounter) return { status: 404, error: "Encounter not found." };

  const apptStatus = encounter.appointment?.status;

  if (role === "doctor") {
    if (encounter.doctorId !== userId)
      return { status: 403, error: "Forbidden. This encounter does not belong to you." };
    if (apptStatus !== "ongoing")
      return {
        status: 403,
        error: `Encounters can only be edited while the appointment is 'ongoing'. Current status: '${apptStatus ?? "unknown"}'.`,
      };
    return null;
  }

  const kioskUser = parseKioskToken(req);
  if (kioskUser && kioskUser.role === "doctor_kiosk") {
    if (encounter.doctorId !== kioskUser.id)
      return { status: 403, error: "Forbidden. This encounter does not belong to you." };
    if (apptStatus !== "ongoing")
      return {
        status: 403,
        error: `Encounters can only be edited while the appointment is 'ongoing'. Current status: '${apptStatus ?? "unknown"}'.`,
      };
    if (encounter.appointment?.branchId !== kioskUser.branchId)
      return { status: 403, error: "Forbidden. Branch mismatch." };
    return null;
  }

  return { status: 403, error: "Forbidden. Insufficient role." };
}

/**
 * Shared appointment formatting utilities.
 *
 * These helpers are used by multiple route handlers (appointments, patients)
 * so that every endpoint returns appointment timestamps in the same format.
 */

/**
 * Format a JavaScript Date as a naive timestamp string "YYYY-MM-DD HH:mm:ss"
 * in the server's local timezone (Asia/Ulaanbaatar).
 *
 * Use this instead of .toISOString() for appointment times so the value
 * returned to clients is a timezone-independent wall-clock string.
 */
function toNaiveTs(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/**
 * Shape a Prisma appointment record into the standard API response object.
 *
 * - scheduledAt / endAt  → naive wall-clock strings (no timezone offset)
 * - checkedInAt / createdAt / updatedAt → ISO strings (audit timestamps)
 *
 * The record `a` must include the relations: patient, doctor, branch.
 * Optional relations: createdBy, updatedBy, encounters.
 */
function formatApptForResponse(a) {
  const patient = a.patient;
  const doctor = a.doctor;
  const branch = a.branch;

  return {
    id: a.id,
    branchId: a.branchId,
    doctorId: a.doctorId,
    patientId: a.patientId,

    patientName: patient ? patient.name : null,
    patientOvog: patient ? patient.ovog || null : null,
    patientRegNo: patient ? patient.regNo || null : null,
    patientPhone: patient ? patient.phone || null : null,

    doctorName: doctor ? doctor.name || null : null,
    doctorOvog: doctor ? doctor.ovog || null : null,

    // Naive wall-clock timestamps — no timezone offset
    scheduledAt: a.scheduledAt ? toNaiveTs(a.scheduledAt) : null,
    endAt: a.endAt ? toNaiveTs(a.endAt) : null,

    status: a.status,
    notes: a.notes || null,

    createdByUserId: a.createdByUserId || null,
    source: a.source || null,
    sourceEncounterId: a.sourceEncounterId || null,

    // Audit timestamps remain as ISO (not appointment scheduling times)
    checkedInAt: a.checkedInAt ? a.checkedInAt.toISOString() : null,
    createdAt: a.createdAt ? a.createdAt.toISOString() : null,
    updatedAt: a.updatedAt ? a.updatedAt.toISOString() : null,
    updatedByUserId: a.updatedByUserId || null,

    createdByUser: a.createdBy
      ? { id: a.createdBy.id, name: a.createdBy.name || null, ovog: a.createdBy.ovog || null }
      : (a.createdByUser ?? null),
    updatedByUser: a.updatedBy
      ? { id: a.updatedBy.id, name: a.updatedBy.name || null, ovog: a.updatedBy.ovog || null }
      : (a.updatedByUser ?? null),

    patient: patient
      ? {
          id: patient.id,
          name: patient.name,
          ovog: patient.ovog || null,
          regNo: patient.regNo || null,
          phone: patient.phone || null,
          patientBook: patient.patientBook || null,
        }
      : null,

    branch: branch
      ? { id: branch.id, name: branch.name }
      : null,

    encounterId: Array.isArray(a.encounters) && a.encounters.length > 0
      ? a.encounters[0].id
      : (a.encounterId ?? null),
  };
}

export { toNaiveTs, formatApptForResponse };

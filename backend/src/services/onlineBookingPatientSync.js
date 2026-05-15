import { normalizeRegNo, parseRegNo } from "../utils/regno.js";

function isOnlinePlaceholderPatient(patient) {
  if (!patient) return false;
  return patient.name === "ONLINE" && patient.ovog === "BOOKING";
}

function parsePatientFieldsFromOnlineNote(noteValue) {
  const fields = {
    ovog: null,
    name: null,
    phone: null,
    regNoNormalized: null,
  };
  if (!noteValue) return fields;

  const lines = String(noteValue).split("\n");
  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (line.startsWith("Овог:")) fields.ovog = line.slice("Овог:".length).trim() || null;
    else if (line.startsWith("Нэр:")) fields.name = line.slice("Нэр:".length).trim() || null;
    else if (line.startsWith("Утас:")) fields.phone = line.slice("Утас:".length).trim() || null;
    else if (line.startsWith("РД:")) {
      const regNoRaw = line.slice("РД:".length).trim();
      fields.regNoNormalized = normalizeRegNo(regNoRaw);
    }
  }

  return fields;
}

async function findPatientIdsByNormalizedRegNo(tx, normalizedRegNo) {
  if (!normalizedRegNo) return [];

  const rows = await tx.$queryRaw`
    SELECT p.id
    FROM "Patient" p
    WHERE p."regNo" IS NOT NULL
      AND UPPER(REGEXP_REPLACE(TRIM(p."regNo"), E'\\\\s+', '', 'g')) = ${normalizedRegNo}
    ORDER BY p.id ASC
  `;

  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => Number(row?.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function createPatientFromOnlineFields(tx, branchId, fields) {
  const normalizedRegNo = normalizeRegNo(fields?.regNoNormalized);
  const parsedRegNo = normalizedRegNo ? parseRegNo(normalizedRegNo) : null;

  const data = {
    branchId,
    ovog: fields?.ovog || null,
    name: fields?.name || fields?.ovog || "UNKNOWN",
    phone: fields?.phone || null,
    regNo: normalizedRegNo || null,
  };

  if (parsedRegNo?.isValid) {
    data.birthDate = new Date(`${parsedRegNo.birthDate}T00:00:00`);
    data.gender = parsedRegNo.gender;
  }

  try {
    return await tx.patient.create({
      data,
      select: { id: true },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const target = Array.isArray(err?.meta?.target) ? err.meta.target : [err?.meta?.target];
      if (target.includes("regNo") && normalizedRegNo) {
        const existing = await tx.patient.findUnique({
          where: { regNo: normalizedRegNo },
          select: { id: true },
        });
        if (existing) return existing;
      }
    }
    throw err;
  }
}

async function ensurePatientBook(tx, patientId) {
  const existing = await tx.patientBook.findUnique({
    where: { patientId },
    select: { id: true },
  });
  if (existing) return existing.id;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const maxEntry = await tx.patientBook.findFirst({
      orderBy: { bookNumber: "desc" },
      select: { bookNumber: true },
    });

    let nextNum = 1;
    if (maxEntry?.bookNumber) {
      const parsed = parseInt(maxEntry.bookNumber, 10);
      if (!Number.isNaN(parsed)) nextNum = parsed + 1;
    }

    const nextBookNumber = String(nextNum).padStart(6, "0");

    try {
      const created = await tx.patientBook.create({
        data: {
          patientId,
          bookNumber: nextBookNumber,
        },
        select: { id: true },
      });
      return created.id;
    } catch (err) {
      if (err?.code !== "P2002") throw err;

      const target = Array.isArray(err?.meta?.target) ? err.meta.target : [err?.meta?.target];
      if (target.includes("patientId")) {
        const current = await tx.patientBook.findUnique({
          where: { patientId },
          select: { id: true },
        });
        if (current) return current.id;
        continue;
      }
      if (target.includes("bookNumber")) continue;
      throw err;
    }
  }

  throw new Error("Failed to create PatientBook after retries");
}

/**
 * Ensure online booking has a real patient (existing or newly created) after payment.
 * Keeps "existing regNo wins" behavior and links duplicate-normalized regNo to first match.
 */
export async function ensureOnlineBookingPatientForPayment(tx, bookingId, options = {}) {
  const bid = Number(bookingId);
  if (!bid || Number.isNaN(bid)) return null;

  const explicitDraftId = Number(options?.draftId);
  const hasExplicitDraftId = Number.isFinite(explicitDraftId) && explicitDraftId > 0;

  const booking = await tx.booking.findUnique({
    where: { id: bid },
    select: {
      id: true,
      branchId: true,
      patientId: true,
      note: true,
      patient: {
        select: { id: true, name: true, ovog: true },
      },
      onlineBookingDraft: {
        select: {
          id: true,
          matchedPatientId: true,
          matchStatus: true,
          ovog: true,
          name: true,
          phone: true,
          regNoRaw: true,
          regNoNormalized: true,
        },
      },
    },
  });
  if (!booking) return null;

  let draft = booking.onlineBookingDraft || null;
  if (!draft && hasExplicitDraftId) {
    draft = await tx.onlineBookingDraft.findUnique({
      where: { id: explicitDraftId },
      select: {
        id: true,
        matchedPatientId: true,
        matchStatus: true,
        ovog: true,
        name: true,
        phone: true,
        regNoRaw: true,
        regNoNormalized: true,
      },
    });
  }

  if (!isOnlinePlaceholderPatient(booking.patient)) {
    await ensurePatientBook(tx, booking.patientId);
    return booking.patientId;
  }

  let fields;
  if (draft) {
    fields = {
      ovog: draft.ovog || null,
      name: draft.name || null,
      phone: draft.phone || null,
      regNoNormalized: normalizeRegNo(draft.regNoNormalized || draft.regNoRaw),
    };
  } else {
    fields = parsePatientFieldsFromOnlineNote(booking.note);
  }

  let resolvedPatientId = null;

  if (draft?.matchedPatientId) {
    const matched = await tx.patient.findUnique({
      where: { id: draft.matchedPatientId },
      select: { id: true },
    });
    if (matched) resolvedPatientId = matched.id;
  }

  let matchedByRegNo = false;
  if (!resolvedPatientId && fields.regNoNormalized) {
    const regNoMatches = await findPatientIdsByNormalizedRegNo(tx, fields.regNoNormalized);
    if (regNoMatches.length > 0) {
      matchedByRegNo = true;
      resolvedPatientId = regNoMatches[0];
    }
  }

  if (!resolvedPatientId) {
    const created = await createPatientFromOnlineFields(tx, booking.branchId, fields);
    resolvedPatientId = created.id;
  }

  if (resolvedPatientId !== booking.patientId) {
    await tx.booking.update({
      where: { id: booking.id },
      data: { patientId: resolvedPatientId },
    });
  }

  await ensurePatientBook(tx, resolvedPatientId);

  if (draft) {
    const draftPatch = {};
    if (draft.matchedPatientId !== resolvedPatientId) {
      draftPatch.matchedPatientId = resolvedPatientId;
    }
    if (matchedByRegNo && draft.matchStatus === "NEW") {
      draftPatch.matchStatus = "EXISTING";
    }
    if (Object.keys(draftPatch).length > 0) {
      await tx.onlineBookingDraft.update({
        where: { id: draft.id },
        data: draftPatch,
      });
    }
  }

  return resolvedPatientId;
}

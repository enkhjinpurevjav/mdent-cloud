import express from "express";
import prisma from "../../db.js";
import { parseRegNo } from "../../utils/regno.js";

const router = express.Router();

const BATCH_SIZE = 200;

// POST /api/admin/patients/backfill-regno
// Backfills gender and birthDate for patients whose regNo is present but
// whose gender or birthDate was not derived (e.g. imported via direct CSV).
// Only fills fields that are currently null; does not overwrite existing values.
router.post("/patients/backfill-regno", async (req, res) => {
  try {
    let scanned = 0;
    let updated = 0;
    let skippedInvalid = 0;
    let skippedAlreadyFilled = 0;

    let cursor = undefined;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await prisma.patient.findMany({
        where: {
          regNo: { not: null },
          AND: [
            { regNo: { not: "" } },
            {
              OR: [{ gender: null }, { birthDate: null }],
            },
          ],
        },
        select: { id: true, regNo: true, gender: true, birthDate: true },
        take: BATCH_SIZE,
        ...(cursor !== undefined ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      });

      if (batch.length === 0) break;

      cursor = batch[batch.length - 1].id;
      scanned += batch.length;

      const updates = [];

      for (const patient of batch) {
        const parsed = parseRegNo(patient.regNo);

        if (!parsed.isValid) {
          skippedInvalid++;
          continue;
        }

        const needsGender = patient.gender === null;
        const needsBirthDate = patient.birthDate === null;

        if (!needsGender && !needsBirthDate) {
          // Both already filled – shouldn't reach here but guard anyway
          skippedAlreadyFilled++;
          continue;
        }

        const dataToUpdate = {};
        if (needsGender) {
          dataToUpdate.gender = parsed.gender;
        }
        if (needsBirthDate) {
          dataToUpdate.birthDate = new Date(
            `${parsed.birthDate}T00:00:00.000Z`
          );
        }

        updates.push(
          prisma.patient.update({
            where: { id: patient.id },
            data: dataToUpdate,
          })
        );

        updated++;
      }

      if (updates.length > 0) {
        await prisma.$transaction(updates);
      }

      // If we received fewer rows than the batch size we've reached the end
      if (batch.length < BATCH_SIZE) break;
    }

    return res.json({ scanned, updated, skippedInvalid, skippedAlreadyFilled });
  } catch (err) {
    console.error("Error in backfill-regno:", err);
    return res.status(500).json({ error: "Failed to backfill patient demographics" });
  }
});

export default router;

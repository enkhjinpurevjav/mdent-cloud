/**
 * V1 Sterilization Finalize Service
 * 
 * Handles finalization of draft sterilization attachments when an encounter is closed.
 * - Converts draft attachments to finalized usage (up to available quantity)
 * - Creates mismatch records for any shortfalls
 * - Ensures idempotency (won't double-finalize)
 */

import prisma from "../db.js";

/**
 * Finalize all draft sterilization attachments for an encounter
 * 
 * @param {number} encounterId - The encounter ID to finalize
 * @returns {Promise<Object>} Result containing finalized usages and mismatches created
 */
export async function finalizeSterilizationForEncounter(encounterId) {
  return await prisma.$transaction(async (tx) => {
    // Check if already finalized (idempotency)
    const existingFinalized = await tx.sterilizationFinalizedUsage.findFirst({
      where: { encounterId },
      select: { id: true },
    });

    if (existingFinalized) {
      // Already finalized, return empty result
      return {
        alreadyFinalized: true,
        finalizedUsages: [],
        mismatches: [],
      };
    }

    // Get encounter to extract branchId
    const encounter = await tx.encounter.findUnique({
      where: { id: encounterId },
      select: {
        id: true,
        patientBook: {
          select: {
            patient: { select: { branchId: true } },
          },
        },
      },
    });

    if (!encounter) {
      throw new Error("Encounter not found");
    }

    const branchId = encounter.patientBook?.patient?.branchId;
    if (!branchId) {
      throw new Error("Cannot determine branch for encounter");
    }

    // Get all draft attachments for this encounter
    const draftAttachments = await tx.sterilizationDraftAttachment.findMany({
      where: {
        encounterDiagnosis: {
          encounterId,
        },
      },
      include: {
        cycle: {
          include: {
            toolLines: {
              include: {
                finalizedUsages: {
                  select: { usedQty: true },
                },
              },
            },
          },
        },
        tool: {
          select: { id: true, name: true },
        },
      },
    });

    if (draftAttachments.length === 0) {
      // No drafts to finalize
      return {
        alreadyFinalized: false,
        finalizedUsages: [],
        mismatches: [],
      };
    }

    // Group drafts by (cycleId, toolId) to aggregate requested quantities
    const groupedDrafts = new Map();
    
    for (const draft of draftAttachments) {
      const key = `${draft.cycleId}-${draft.toolId}`;
      if (!groupedDrafts.has(key)) {
        groupedDrafts.set(key, {
          cycleId: draft.cycleId,
          toolId: draft.toolId,
          toolName: draft.tool.name,
          code: draft.cycle.code,
          requestedQty: 0,
          toolLineId: null,
          producedQty: 0,
          alreadyUsedQty: 0,
        });
      }
      
      const group = groupedDrafts.get(key);
      group.requestedQty += draft.requestedQty || 0;
      
      // Find the tool line for this cycle+tool
      const toolLine = draft.cycle.toolLines.find(tl => tl.toolId === draft.toolId);
      if (toolLine) {
        group.toolLineId = toolLine.id;
        group.producedQty = toolLine.producedQty || 0;
        group.alreadyUsedQty = (toolLine.finalizedUsages || [])
          .reduce((sum, u) => sum + (u.usedQty || 0), 0);
      }
    }

    const finalizedUsages = [];
    const mismatches = [];

    // For each group, finalize what we can and create mismatch for remainder
    for (const group of groupedDrafts.values()) {
      if (!group.toolLineId) {
        // Tool line not found - entire request becomes mismatch
        const mismatch = await tx.sterilizationMismatch.create({
          data: {
            encounterId,
            branchId,
            toolId: group.toolId,
            code: group.code,
            requiredQty: group.requestedQty,
            finalizedQty: 0,
            mismatchQty: group.requestedQty,
            status: "UNRESOLVED",
          },
        });
        mismatches.push(mismatch);
        continue;
      }

      const available = Math.max(0, group.producedQty - group.alreadyUsedQty);
      const toFinalize = Math.min(group.requestedQty, available);
      const shortfall = Math.max(0, group.requestedQty - toFinalize);

      // Create finalized usage if we can fulfill any
      if (toFinalize > 0) {
        const finalized = await tx.sterilizationFinalizedUsage.create({
          data: {
            encounterId,
            toolLineId: group.toolLineId,
            usedQty: toFinalize,
          },
        });
        finalizedUsages.push(finalized);
      }

      // Create mismatch if there's a shortfall
      if (shortfall > 0) {
        const mismatch = await tx.sterilizationMismatch.create({
          data: {
            encounterId,
            branchId,
            toolId: group.toolId,
            code: group.code,
            requiredQty: group.requestedQty,
            finalizedQty: toFinalize,
            mismatchQty: shortfall,
            status: "UNRESOLVED",
          },
        });
        mismatches.push(mismatch);
      }
    }

    return {
      alreadyFinalized: false,
      finalizedUsages,
      mismatches,
    };
  });
}

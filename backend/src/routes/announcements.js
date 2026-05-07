import { Router } from "express";
import {
  AnnouncementContentMode,
  AnnouncementType,
  UserRole,
} from "@prisma/client";
import prisma from "../db.js";

const router = Router();

router.use((req, res, next) => {
  if (!req.user?.id || !req.user?.role) {
    return res.status(401).json({ error: "Authentication required." });
  }
  return next();
});

const ANNOUNCEMENT_MANAGER_ROLES = new Set(["hr", "super_admin"]);

function canManageAnnouncements(user) {
  if (!user?.role) return false;
  return ANNOUNCEMENT_MANAGER_ROLES.has(user.role);
}

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function sanitizeTargetRoles(input) {
  if (!Array.isArray(input)) return [];
  const validRoles = new Set(Object.values(UserRole));
  return input
    .map((v) => String(v))
    .filter((v) => validRoles.has(v));
}

function sanitizeTargetBranchIds(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
}

function buildAudienceWhere(user) {
  const clauses = [
    {
      OR: [
        { targetRoles: { isEmpty: true } },
        { targetRoles: { has: user.role } },
      ],
    },
  ];

  if (user.branchId == null) {
    clauses.push({ targetBranchIds: { isEmpty: true } });
  } else {
    clauses.push({
      OR: [
        { targetBranchIds: { isEmpty: true } },
        { targetBranchIds: { has: Number(user.branchId) } },
      ],
    });
  }

  return clauses;
}

function buildLiveWindowWhere(now) {
  return [
    { isActive: true },
    {
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
    },
    {
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
  ];
}

function userMatchesAudience(user, announcement) {
  const roleMatches =
    !announcement.targetRoles?.length ||
    announcement.targetRoles.includes(user.role);
  const branchMatches =
    !announcement.targetBranchIds?.length ||
    (user.branchId != null &&
      announcement.targetBranchIds.includes(Number(user.branchId)));
  return roleMatches && branchMatches;
}

function normalizeAttachmentPayload(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => ({
      filePath: String(row?.filePath || "").trim(),
      fileName: String(row?.fileName || "").trim(),
      mimeType: String(row?.mimeType || "").trim(),
      sizeBytes:
        row?.sizeBytes == null || row?.sizeBytes === ""
          ? null
          : Number(row.sizeBytes),
    }))
    .filter(
      (row) =>
        row.filePath &&
        row.fileName &&
        row.mimeType &&
        (row.sizeBytes == null || Number.isFinite(row.sizeBytes))
    );
}

// ---------------------------------------------------------------------------
// Management endpoints (hr + super_admin)
// ---------------------------------------------------------------------------
router.get("/manage", async (req, res) => {
  if (!canManageAnnouncements(req.user)) {
    return res.status(403).json({ error: "Forbidden. Insufficient role." });
  }

  try {
    const rows = await prisma.announcement.findMany({
      include: {
        attachments: true,
        receipts: {
          select: {
            readAt: true,
            dontShowAgain: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const mapped = rows.map((row) => {
      const readCount = row.receipts.filter((r) => r.readAt != null).length;
      const dontShowAgainCount = row.receipts.filter(
        (r) => r.dontShowAgain
      ).length;
      return {
        ...row,
        readCount,
        dontShowAgainCount,
      };
    });

    return res.json({ announcements: mapped });
  } catch (err) {
    console.error("GET /api/announcements/manage error:", err);
    return res.status(500).json({ error: "Failed to load announcements." });
  }
});

router.post("/manage", async (req, res) => {
  if (!canManageAnnouncements(req.user)) {
    return res.status(403).json({ error: "Forbidden. Insufficient role." });
  }

  try {
    const {
      type,
      contentMode,
      title,
      body,
      imagePath,
      targetRoles,
      targetBranchIds,
      startsAt,
      endsAt,
      isActive,
      attachments,
    } = req.body || {};

    if (!Object.values(AnnouncementType).includes(type)) {
      return res.status(400).json({ error: "Invalid announcement type." });
    }

    const finalContentMode =
      type === AnnouncementType.LOGIN_POPUP
        ? contentMode || AnnouncementContentMode.TEXT
        : AnnouncementContentMode.TEXT;

    if (!Object.values(AnnouncementContentMode).includes(finalContentMode)) {
      return res.status(400).json({ error: "Invalid content mode." });
    }

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "title is required." });
    }

    if (finalContentMode === AnnouncementContentMode.TEXT) {
      if (!body || !String(body).trim()) {
        return res.status(400).json({ error: "body is required for text announcements." });
      }
    }

    if (
      type === AnnouncementType.LOGIN_POPUP &&
      finalContentMode === AnnouncementContentMode.IMAGE &&
      !String(imagePath || "").trim()
    ) {
      return res.status(400).json({ error: "imagePath is required for image popup announcements." });
    }

    const startsAtDate = parseDateOrNull(startsAt);
    const endsAtDate = parseDateOrNull(endsAt);
    if (startsAt && !startsAtDate) {
      return res.status(400).json({ error: "Invalid startsAt date." });
    }
    if (endsAt && !endsAtDate) {
      return res.status(400).json({ error: "Invalid endsAt date." });
    }
    if (startsAtDate && endsAtDate && startsAtDate > endsAtDate) {
      return res.status(400).json({ error: "startsAt must be before endsAt." });
    }

    const cleanedRoles = sanitizeTargetRoles(targetRoles);
    const cleanedBranchIds = sanitizeTargetBranchIds(targetBranchIds);
    const cleanedAttachments =
      type === AnnouncementType.ALERT_LIST
        ? normalizeAttachmentPayload(attachments)
        : [];

    const created = await prisma.announcement.create({
      data: {
        type,
        contentMode: finalContentMode,
        title: String(title).trim(),
        body: String(body || "").trim(),
        imagePath:
          finalContentMode === AnnouncementContentMode.IMAGE
            ? String(imagePath).trim()
            : null,
        targetRoles: cleanedRoles,
        targetBranchIds: cleanedBranchIds,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        createdByUserId: req.user.id,
        attachments:
          cleanedAttachments.length > 0
            ? {
                create: cleanedAttachments,
              }
            : undefined,
      },
      include: {
        attachments: true,
      },
    });

    return res.status(201).json({ announcement: created });
  } catch (err) {
    console.error("POST /api/announcements/manage error:", err);
    return res.status(500).json({ error: "Failed to create announcement." });
  }
});

router.patch("/manage/:id", async (req, res) => {
  if (!canManageAnnouncements(req.user)) {
    return res.status(403).json({ error: "Forbidden. Insufficient role." });
  }

  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid announcement id." });
    }

    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true, type: true, contentMode: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Announcement not found." });
    }

    const {
      title,
      body,
      contentMode,
      imagePath,
      targetRoles,
      targetBranchIds,
      startsAt,
      endsAt,
      isActive,
      attachments,
    } = req.body || {};

    const data = {};

    if (title !== undefined) {
      const cleanTitle = String(title).trim();
      if (!cleanTitle) {
        return res.status(400).json({ error: "title cannot be empty." });
      }
      data.title = cleanTitle;
    }

    if (body !== undefined) {
      data.body = String(body).trim();
    }

    if (contentMode !== undefined) {
      if (!Object.values(AnnouncementContentMode).includes(contentMode)) {
        return res.status(400).json({ error: "Invalid content mode." });
      }
      if (existing.type !== AnnouncementType.LOGIN_POPUP) {
        return res.status(400).json({ error: "Only login popup announcements support contentMode updates." });
      }
      data.contentMode = contentMode;
    }

    if (imagePath !== undefined) {
      data.imagePath = imagePath ? String(imagePath).trim() : null;
    }

    if (targetRoles !== undefined) {
      data.targetRoles = sanitizeTargetRoles(targetRoles);
    }

    if (targetBranchIds !== undefined) {
      data.targetBranchIds = sanitizeTargetBranchIds(targetBranchIds);
    }

    if (startsAt !== undefined) {
      if (startsAt === null || startsAt === "") {
        data.startsAt = null;
      } else {
        const parsed = parseDateOrNull(startsAt);
        if (!parsed) {
          return res.status(400).json({ error: "Invalid startsAt date." });
        }
        data.startsAt = parsed;
      }
    }

    if (endsAt !== undefined) {
      if (endsAt === null || endsAt === "") {
        data.endsAt = null;
      } else {
        const parsed = parseDateOrNull(endsAt);
        if (!parsed) {
          return res.status(400).json({ error: "Invalid endsAt date." });
        }
        data.endsAt = parsed;
      }
    }

    if (isActive !== undefined) {
      data.isActive = Boolean(isActive);
    }

    const cleanedAttachments = normalizeAttachmentPayload(attachments);

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.announcement.update({
        where: { id },
        data,
      });

      if (existing.type === AnnouncementType.ALERT_LIST && attachments !== undefined) {
        await tx.announcementAttachment.deleteMany({
          where: { announcementId: id },
        });
        if (cleanedAttachments.length > 0) {
          await tx.announcementAttachment.createMany({
            data: cleanedAttachments.map((row) => ({
              ...row,
              announcementId: id,
            })),
          });
        }
      }

      return tx.announcement.findUnique({
        where: { id: next.id },
        include: { attachments: true },
      });
    });

    return res.json({ announcement: updated });
  } catch (err) {
    console.error("PATCH /api/announcements/manage/:id error:", err);
    return res.status(500).json({ error: "Failed to update announcement." });
  }
});

// ---------------------------------------------------------------------------
// Employee consumption endpoints
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const unreadOnly = String(req.query.unreadOnly || "").toLowerCase() === "true";

    const unreadFilter = unreadOnly
      ? {
          OR: [
            { receipts: { none: { userId: req.user.id } } },
            { receipts: { some: { userId: req.user.id, readAt: null } } },
          ],
        }
      : {};

    const rows = await prisma.announcement.findMany({
      where: {
        type: AnnouncementType.ALERT_LIST,
        AND: [
          ...buildLiveWindowWhere(now),
          ...buildAudienceWhere(req.user),
          unreadFilter,
        ],
      },
      include: {
        attachments: true,
        receipts: {
          where: { userId: req.user.id },
          select: { readAt: true },
          take: 1,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });

    const announcements = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      imagePath: row.imagePath,
      contentMode: row.contentMode,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      attachments: row.attachments,
      readAt: row.receipts[0]?.readAt ?? null,
    }));

    return res.json({ announcements });
  } catch (err) {
    console.error("GET /api/announcements error:", err);
    return res.status(500).json({ error: "Failed to load announcements." });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const now = new Date();
    const count = await prisma.announcement.count({
      where: {
        type: AnnouncementType.ALERT_LIST,
        AND: [
          ...buildLiveWindowWhere(now),
          ...buildAudienceWhere(req.user),
          {
            OR: [
              { receipts: { none: { userId: req.user.id } } },
              { receipts: { some: { userId: req.user.id, readAt: null } } },
            ],
          },
        ],
      },
    });

    return res.json({ unreadCount: count });
  } catch (err) {
    console.error("GET /api/announcements/unread-count error:", err);
    return res.status(500).json({ error: "Failed to load unread count." });
  }
});

router.get("/login-popup", async (req, res) => {
  try {
    const now = new Date();
    const announcement = await prisma.announcement.findFirst({
      where: {
        type: AnnouncementType.LOGIN_POPUP,
        AND: [
          ...buildLiveWindowWhere(now),
          ...buildAudienceWhere(req.user),
          {
            OR: [
              { receipts: { none: { userId: req.user.id } } },
              {
                receipts: {
                  some: {
                    userId: req.user.id,
                    dontShowAgain: false,
                  },
                },
              },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        receipts: {
          where: { userId: req.user.id },
          select: {
            readAt: true,
            dontShowAgain: true,
            firstShownAt: true,
            lastShownAt: true,
          },
          take: 1,
        },
      },
    });

    if (!announcement) {
      return res.json({ announcement: null });
    }

    await prisma.announcementReceipt.upsert({
      where: {
        announcementId_userId: {
          announcementId: announcement.id,
          userId: req.user.id,
        },
      },
      create: {
        announcementId: announcement.id,
        userId: req.user.id,
        firstShownAt: now,
        lastShownAt: now,
      },
      update: {
        lastShownAt: now,
      },
    });

    const freshReceipt = await prisma.announcementReceipt.findUnique({
      where: {
        announcementId_userId: {
          announcementId: announcement.id,
          userId: req.user.id,
        },
      },
      select: {
        readAt: true,
        dontShowAgain: true,
        firstShownAt: true,
        lastShownAt: true,
      },
    });

    return res.json({
      announcement: {
        id: announcement.id,
        type: announcement.type,
        title: announcement.title,
        body: announcement.body,
        imagePath: announcement.imagePath,
        contentMode: announcement.contentMode,
        createdAt: announcement.createdAt,
        startsAt: announcement.startsAt,
        endsAt: announcement.endsAt,
        receipt: freshReceipt,
      },
    });
  } catch (err) {
    console.error("GET /api/announcements/login-popup error:", err);
    return res.status(500).json({ error: "Failed to load login popup announcement." });
  }
});

router.post("/:id/read", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid announcement id." });
    }

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        targetRoles: true,
        targetBranchIds: true,
      },
    });
    if (!announcement || announcement.type !== AnnouncementType.ALERT_LIST) {
      return res.status(404).json({ error: "Announcement not found." });
    }
    if (!userMatchesAudience(req.user, announcement)) {
      return res.status(404).json({ error: "Announcement not found." });
    }

    const now = new Date();
    const receipt = await prisma.announcementReceipt.upsert({
      where: {
        announcementId_userId: {
          announcementId: id,
          userId: req.user.id,
        },
      },
      create: {
        announcementId: id,
        userId: req.user.id,
        readAt: now,
      },
      update: {
        readAt: now,
      },
    });

    return res.json({ receipt });
  } catch (err) {
    console.error("POST /api/announcements/:id/read error:", err);
    return res.status(500).json({ error: "Failed to mark announcement as read." });
  }
});

router.post("/:id/acknowledge-popup", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid announcement id." });
    }

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        targetRoles: true,
        targetBranchIds: true,
      },
    });
    if (!announcement || announcement.type !== AnnouncementType.LOGIN_POPUP) {
      return res.status(404).json({ error: "Announcement not found." });
    }
    if (!userMatchesAudience(req.user, announcement)) {
      return res.status(404).json({ error: "Announcement not found." });
    }

    const dontShowAgain = Boolean(req.body?.dontShowAgain);
    const now = new Date();

    const receipt = await prisma.announcementReceipt.upsert({
      where: {
        announcementId_userId: {
          announcementId: id,
          userId: req.user.id,
        },
      },
      create: {
        announcementId: id,
        userId: req.user.id,
        firstShownAt: now,
        lastShownAt: now,
        readAt: now,
        dontShowAgain,
        dontShowAgainAt: dontShowAgain ? now : null,
      },
      update: {
        lastShownAt: now,
        readAt: now,
        dontShowAgain,
        dontShowAgainAt: dontShowAgain ? now : null,
      },
    });

    return res.json({ receipt });
  } catch (err) {
    console.error("POST /api/announcements/:id/acknowledge-popup error:", err);
    return res.status(500).json({ error: "Failed to acknowledge popup." });
  }
});

export default router;

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const MEDIA_UPLOAD_DIR = process.env.MEDIA_UPLOAD_DIR || "/data/media";

const IMAGE_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const IMAGE_MAX_SIZE = 2 * 1024 * 1024; // 2 MB

const IMAGE_MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const ANNOUNCEMENT_ATTACHMENT_ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const ANNOUNCEMENT_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function makeUploader({
  subDir,
  allowedTypes,
  maxSize,
  mimeToExt = {},
  fallbackExt = ".bin",
}) {
  const dir = path.resolve(MEDIA_UPLOAD_DIR, subDir);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const extFromMime = mimeToExt[file.mimetype];
      const extFromName = path.extname(file.originalname || "").toLowerCase();
      const ext = extFromMime || extFromName || fallbackExt;
      const rawUserId = req.query.userId;
      const userId =
        rawUserId && /^\d+$/.test(String(rawUserId))
          ? String(rawUserId)
          : null;
      const ts = Date.now();
      const rand = crypto.randomBytes(6).toString("hex");
      const prefix = userId ? `${userId}-` : "";
      cb(null, `${prefix}${ts}-${rand}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      if (allowedTypes.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("INVALID_TYPE"));
      }
    },
  });
}

function uploadHandler(uploader, urlPrefix, maxSizeMb) {
  return [
    (req, res, next) => {
      uploader.single("file")(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res
              .status(400)
              .json({ error: `File too large. Maximum size is ${maxSizeMb} MB.` });
          }
          if (err.message === "INVALID_TYPE") {
            return res.status(400).json({
              error: "Invalid file type.",
            });
          }
          return next(err);
        }
        next();
      });
    },
    (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }
      const filePath = `${urlPrefix}/${req.file.filename}`;
      return res.json({
        filePath,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      });
    },
  ];
}

const staffPhotoUploader = makeUploader({
  subDir: "staff-photos",
  allowedTypes: IMAGE_ALLOWED_TYPES,
  maxSize: IMAGE_MAX_SIZE,
  mimeToExt: IMAGE_MIME_TO_EXT,
  fallbackExt: ".jpg",
});
const stampUploader = makeUploader({
  subDir: "stamps",
  allowedTypes: IMAGE_ALLOWED_TYPES,
  maxSize: IMAGE_MAX_SIZE,
  mimeToExt: IMAGE_MIME_TO_EXT,
  fallbackExt: ".jpg",
});
const signatureUploader = makeUploader({
  subDir: "signatures",
  allowedTypes: IMAGE_ALLOWED_TYPES,
  maxSize: IMAGE_MAX_SIZE,
  mimeToExt: IMAGE_MIME_TO_EXT,
  fallbackExt: ".jpg",
});
const announcementImageUploader = makeUploader({
  subDir: "announcements/images",
  allowedTypes: IMAGE_ALLOWED_TYPES,
  maxSize: IMAGE_MAX_SIZE,
  mimeToExt: IMAGE_MIME_TO_EXT,
  fallbackExt: ".jpg",
});
const announcementAttachmentUploader = makeUploader({
  subDir: "announcements/attachments",
  allowedTypes: ANNOUNCEMENT_ATTACHMENT_ALLOWED_TYPES,
  maxSize: ANNOUNCEMENT_ATTACHMENT_MAX_SIZE,
  fallbackExt: ".bin",
});

const router = Router();

function requireAnnouncementManager(req, res, next) {
  if (req.user?.role === "hr" || req.user?.role === "super_admin") {
    return next();
  }
  return res.status(403).json({ error: "Forbidden. Insufficient role." });
}

router.post(
  "/staff-photo",
  ...uploadHandler(staffPhotoUploader, "/media/staff-photos", 2)
);

router.post(
  "/stamp",
  ...uploadHandler(stampUploader, "/media/stamps", 2)
);

router.post(
  "/signature",
  ...uploadHandler(signatureUploader, "/media/signatures", 2)
);

router.post(
  "/announcement-image",
  requireAnnouncementManager,
  ...uploadHandler(announcementImageUploader, "/media/announcements/images", 2)
);

router.post(
  "/announcement-attachment",
  requireAnnouncementManager,
  ...uploadHandler(
    announcementAttachmentUploader,
    "/media/announcements/attachments",
    10
  )
);

export default router;

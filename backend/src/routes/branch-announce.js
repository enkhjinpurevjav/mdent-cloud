import { Router } from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { requireRole } from "../middleware/auth.js";

const router = Router();

export const DOCTOR_NAMES = [
  "Бигэрмижид",
  "Дэлгэрмаа",
  "Мөнхсүлд",
  "Отгончимэг",
  "Хаш-Эрдэнэ",
  "Энхцэцэг",
];

export const DOCTOR_TEMPLATES = [
  "эмчийн үйлчлүүлэгч ирлээ",
  "эмчийг ресепшн дээр дуудаж байна",
];

export const FIXED_ANNOUNCEMENTS = [
  "Сувилагчийг эмчилгээний танхимд дуудаж байна",
  "Хоол ирлээ",
  "Хүргэлт ирлээ",
];

const CHIMEGE_SYNTHESIZE_URL = "https://api.chimege.com/v1.2/synthesize";
const DEFAULT_CACHE_DIR = "/data/media/branch-announce-audio";
const DEFAULT_VOICE_ID = "FEMALE3v2";
const DEFAULT_SPEED = "1";
const DEFAULT_PITCH = "1";
const DEFAULT_SAMPLE_RATE = "22050";
const AUDIO_MIME_TYPE = "audio/x-wav";

export function getAllowedBranchAnnouncementMessages() {
  const doctorMessages = DOCTOR_NAMES.flatMap((doctor) =>
    DOCTOR_TEMPLATES.map((template) => `${doctor} ${template}`)
  );
  return new Set([...doctorMessages, ...FIXED_ANNOUNCEMENTS]);
}

export function normalizeBranchAnnouncementMessage(input) {
  if (typeof input !== "string") {
    throw new Error("Announcement message is required.");
  }
  const message = input.replace(/\s+/g, " ").trim();
  if (!message) {
    throw new Error("Announcement message is required.");
  }
  if (!getAllowedBranchAnnouncementMessages().has(message)) {
    throw new Error("Unsupported announcement message.");
  }
  return message;
}

function getChimegeSettings(env = process.env) {
  return {
    token: env.CHIMEGE_API_TOKEN || "",
    voiceId: env.CHIMEGE_VOICE_ID || DEFAULT_VOICE_ID,
    speed: env.CHIMEGE_SPEED || DEFAULT_SPEED,
    pitch: env.CHIMEGE_PITCH || DEFAULT_PITCH,
    sampleRate: env.CHIMEGE_SAMPLE_RATE || DEFAULT_SAMPLE_RATE,
    cacheDir: env.BRANCH_ANNOUNCE_AUDIO_CACHE_DIR || DEFAULT_CACHE_DIR,
  };
}

export function createBranchAnnouncementCacheKey(message, settings) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        message,
        voiceId: settings.voiceId,
        speed: settings.speed,
        pitch: settings.pitch,
        sampleRate: settings.sampleRate,
      })
    )
    .digest("hex");
}

async function readCachedAudio(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

export async function synthesizeWithChimege(message, settings, fetchImpl = fetch) {
  if (!settings.token) {
    const err = new Error("Chimege API token is not configured.");
    err.code = "CHIMEGE_TOKEN_MISSING";
    throw err;
  }

  const res = await fetchImpl(CHIMEGE_SYNTHESIZE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      Token: settings.token,
      "voice-id": settings.voiceId,
      speed: settings.speed,
      pitch: settings.pitch,
      "sample-rate": settings.sampleRate,
    },
    body: message,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(body || `Chimege TTS failed with HTTP ${res.status}.`);
    err.code = "CHIMEGE_REQUEST_FAILED";
    err.status = res.status;
    throw err;
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function getOrCreateBranchAnnouncementAudio(
  message,
  {
    env = process.env,
    fetchImpl = fetch,
  } = {}
) {
  const normalizedMessage = normalizeBranchAnnouncementMessage(message);
  const settings = getChimegeSettings(env);
  const cacheKey = createBranchAnnouncementCacheKey(normalizedMessage, settings);
  const filePath = path.join(settings.cacheDir, `${cacheKey}.wav`);

  const cached = await readCachedAudio(filePath);
  if (cached) {
    return {
      audio: cached,
      cacheHit: true,
      message: normalizedMessage,
      cacheKey,
      mimeType: AUDIO_MIME_TYPE,
    };
  }

  const audio = await synthesizeWithChimege(normalizedMessage, settings, fetchImpl);
  await fs.mkdir(settings.cacheDir, { recursive: true });
  await fs.writeFile(filePath, audio);

  return {
    audio,
    cacheHit: false,
    message: normalizedMessage,
    cacheKey,
    mimeType: AUDIO_MIME_TYPE,
  };
}

router.post(
  "/audio",
  requireRole("receptionist", "super_admin"),
  async (req, res) => {
    try {
      const result = await getOrCreateBranchAnnouncementAudio(req.body?.message);
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.setHeader("X-Branch-Announce-Cache", result.cacheHit ? "HIT" : "MISS");
      res.setHeader("X-Branch-Announce-Message", encodeURIComponent(result.message));
      return res.status(200).send(result.audio);
    } catch (err) {
      if (
        err?.message === "Announcement message is required." ||
        err?.message === "Unsupported announcement message."
      ) {
        return res.status(400).json({ error: err.message });
      }
      if (err?.code === "CHIMEGE_TOKEN_MISSING") {
        return res.status(503).json({
          error: "Chimege API token is not configured.",
          code: err.code,
          missingConfig: ["CHIMEGE_API_TOKEN"],
        });
      }
      console.error("POST /api/branch-announce/audio error:", err);
      return res.status(502).json({
        error: "Failed to generate announcement audio.",
        code: err?.code || "CHIMEGE_REQUEST_FAILED",
      });
    }
  }
);

export default router;

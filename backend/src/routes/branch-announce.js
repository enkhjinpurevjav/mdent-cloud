import { Router } from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { requireRole } from "../middleware/auth.js";

const router = Router();

export const ANNOUNCEMENT_PHRASES = [
  {
    id: "doctor-patient-arrived",
    label: "эмчийн үйлчлүүлэгч ирлээ",
    requiresName: true,
  },
  {
    id: "call-doctor-reception",
    label: "эмчийг ресепшн дээр дуудаж байна",
    requiresName: true,
  },
  {
    id: "call-nurse-treatment-room",
    label: "сувилагчийг эмчилгээний танхимд дуудаж байна",
    requiresName: true,
  },
  {
    id: "call-nurse-reception",
    label: "сувилагчийг ресепшн дээр дуудаж байна",
    requiresName: true,
  },
  {
    id: "food-arrived",
    label: "Хоол ирлээ",
    requiresName: false,
  },
  {
    id: "sterilized-tools-arrived",
    label: "Ариутгалын багаж ирлээ",
    requiresName: false,
  },
  {
    id: "delivery-arrived",
    label: "Хүргэлт ирлээ",
    requiresName: false,
  },
];

const PHRASE_BY_ID = new Map(ANNOUNCEMENT_PHRASES.map((phrase) => [phrase.id, phrase]));
const CHIMEGE_SYNTHESIZE_URL = "https://api.chimege.com/v1.2/synthesize";
const DEFAULT_CACHE_DIR = "/data/media/branch-announce-audio";
const DEFAULT_VOICE_ID = "FEMALE3v2";
const DEFAULT_SPEED = "1";
const DEFAULT_PITCH = "1";
const DEFAULT_SAMPLE_RATE = "22050";
const AUDIO_MIME_TYPE = "audio/x-wav";
const MAX_NAME_LENGTH = 200;

export function normalizeAnnouncementName(input) {
  if (typeof input !== "string") {
    throw new Error("Name is required.");
  }
  const name = input.trim();
  if (!name) {
    throw new Error("Name is required.");
  }
  if (/\s/.test(name)) {
    throw new Error("Name must be one word.");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error("Name is too long.");
  }
  return name;
}

export function normalizeAnnouncementPart(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Announcement part is required.");
  }

  if (input.type === "name") {
    const text = normalizeAnnouncementName(input.text);
    return { type: "name", text };
  }

  if (input.type === "phrase") {
    const phrase = PHRASE_BY_ID.get(String(input.id || ""));
    if (!phrase) {
      throw new Error("Unsupported announcement phrase.");
    }
    return { type: "phrase", id: phrase.id, text: phrase.label };
  }

  throw new Error("Unsupported announcement part.");
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

export function createBranchAnnouncementPartCacheKey(part, settings) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        type: part.type,
        id: part.id || null,
        text: part.text,
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

export async function synthesizeWithChimege(text, settings, fetchImpl = fetch) {
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
    body: text,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(body || "Chimege TTS failed with HTTP " + res.status + ".");
    err.code = "CHIMEGE_REQUEST_FAILED";
    err.status = res.status;
    throw err;
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function getOrCreateBranchAnnouncementPartAudio(
  rawPart,
  {
    env = process.env,
    fetchImpl = fetch,
  } = {}
) {
  const part = normalizeAnnouncementPart(rawPart);
  const settings = getChimegeSettings(env);
  const cacheKey = createBranchAnnouncementPartCacheKey(part, settings);
  const filePath = path.join(settings.cacheDir, part.type, cacheKey + ".wav");

  const cached = await readCachedAudio(filePath);
  if (cached) {
    return {
      audio: cached,
      cacheHit: true,
      part,
      cacheKey,
      mimeType: AUDIO_MIME_TYPE,
    };
  }

  const audio = await synthesizeWithChimege(part.text, settings, fetchImpl);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, audio);

  return {
    audio,
    cacheHit: false,
    part,
    cacheKey,
    mimeType: AUDIO_MIME_TYPE,
  };
}

router.get("/phrases", requireRole("receptionist", "super_admin"), (_req, res) => {
  return res.json({ phrases: ANNOUNCEMENT_PHRASES });
});

router.post(
  "/part-audio",
  requireRole("receptionist", "super_admin"),
  async (req, res) => {
    try {
      const result = await getOrCreateBranchAnnouncementPartAudio(req.body?.part);
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.setHeader("X-Branch-Announce-Cache", result.cacheHit ? "HIT" : "MISS");
      res.setHeader("X-Branch-Announce-Part", encodeURIComponent(result.part.text));
      return res.status(200).send(result.audio);
    } catch (err) {
      if (
        err?.message === "Announcement part is required." ||
        err?.message === "Name is required." ||
        err?.message === "Name must be one word." ||
        err?.message === "Name is too long." ||
        err?.message === "Unsupported announcement phrase." ||
        err?.message === "Unsupported announcement part."
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
      console.error("POST /api/branch-announce/part-audio error:", err);
      return res.status(502).json({
        error: "Failed to generate announcement audio.",
        code: err?.code || "CHIMEGE_REQUEST_FAILED",
      });
    }
  }
);

export default router;

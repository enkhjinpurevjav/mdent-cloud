import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

const router = Router();

export const ANNOUNCE_PARTS = {
  doctor: [{ id: "khaliunaa", label: "Халиунаа" }],
  relation: [{ id: "doctor_possessive", label: "эмчийн" }],
  subject: [{ id: "patient", label: "үйлчлүүлэгч" }],
  status: [{ id: "arrived", label: "ирлээ" }],
};

const REQUIRED_PART_KEYS = ["doctor", "relation", "subject", "status"];

function findPart(groupKey, partId) {
  return ANNOUNCE_PARTS[groupKey]?.find((part) => part.id === partId) || null;
}

export function buildBranchAnnouncementMessage(parts) {
  if (!parts || typeof parts !== "object" || Array.isArray(parts)) {
    throw new Error("Invalid announcement parts.");
  }

  const selected = REQUIRED_PART_KEYS.map((key) => {
    const part = findPart(key, parts[key]);
    if (!part) {
      throw new Error("Invalid announcement parts.");
    }
    return part.label;
  });

  return selected.join(" ");
}

function getHomeAssistantConfig() {
  const baseUrl = (process.env.HOME_ASSISTANT_URL || "").replace(/\/+$/, "");
  const token = process.env.HOME_ASSISTANT_TOKEN || "";
  const ttsEntityId = process.env.HOME_ASSISTANT_TTS_ENTITY_ID || "";
  const mediaPlayerEntityId = process.env.HOME_ASSISTANT_MEDIA_PLAYER_ENTITY_ID || "";

  if (!baseUrl || !token || !ttsEntityId || !mediaPlayerEntityId) {
    return null;
  }

  return {
    baseUrl,
    token,
    ttsEntityId,
    mediaPlayerEntityId,
  };
}

export async function speakViaHomeAssistant(message, config = getHomeAssistantConfig()) {
  if (!config) {
    const err = new Error("Branch announcement speaker bridge is not configured.");
    err.code = "BRIDGE_NOT_CONFIGURED";
    throw err;
  }

  const res = await fetch(`${config.baseUrl}/api/services/tts/speak`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      entity_id: config.ttsEntityId,
      media_player_entity_id: config.mediaPlayerEntityId,
      message,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(
      body || `Home Assistant TTS request failed with HTTP ${res.status}.`
    );
    err.code = "BRIDGE_REQUEST_FAILED";
    err.status = res.status;
    throw err;
  }
}

router.post(
  "/",
  requireRole("receptionist", "super_admin"),
  async (req, res) => {
    let message;
    try {
      message = buildBranchAnnouncementMessage(req.body?.parts);
    } catch {
      return res.status(400).json({ error: "Invalid announcement parts." });
    }

    try {
      await speakViaHomeAssistant(message);
      return res.json({ ok: true, message });
    } catch (err) {
      if (err?.code === "BRIDGE_NOT_CONFIGURED") {
        return res.status(503).json({
          error: "Branch announcement speaker bridge is not configured.",
          code: err.code,
          message,
        });
      }

      console.error("POST /api/branch-announce error:", err);
      return res.status(502).json({
        error: "Failed to send announcement to speaker.",
        code: err?.code || "BRIDGE_REQUEST_FAILED",
        message,
      });
    }
  }
);

export default router;

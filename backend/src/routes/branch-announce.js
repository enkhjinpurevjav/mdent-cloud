import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

const router = Router();

export const ANNOUNCEMENT_MAX_LENGTH = 180;
const HOME_ASSISTANT_ENV_KEYS = [
  "HOME_ASSISTANT_URL",
  "HOME_ASSISTANT_TOKEN",
  "HOME_ASSISTANT_TTS_ENTITY_ID",
  "HOME_ASSISTANT_MEDIA_PLAYER_ENTITY_ID",
];

export function normalizeBranchAnnouncementMessage(input) {
  if (typeof input !== "string") {
    throw new Error("Announcement message is required.");
  }

  const message = input.replace(/\s+/g, " ").trim();
  if (!message) {
    throw new Error("Announcement message is required.");
  }
  if (message.length > ANNOUNCEMENT_MAX_LENGTH) {
    throw new Error("Announcement message is too long.");
  }

  return message;
}

export function getHomeAssistantConfigStatus(env = process.env) {
  const baseUrl = (env.HOME_ASSISTANT_URL || "").replace(/\/+$/, "");
  const token = env.HOME_ASSISTANT_TOKEN || "";
  const ttsEntityId = env.HOME_ASSISTANT_TTS_ENTITY_ID || "";
  const mediaPlayerEntityId = env.HOME_ASSISTANT_MEDIA_PLAYER_ENTITY_ID || "";
  const values = {
    HOME_ASSISTANT_URL: baseUrl,
    HOME_ASSISTANT_TOKEN: token,
    HOME_ASSISTANT_TTS_ENTITY_ID: ttsEntityId,
    HOME_ASSISTANT_MEDIA_PLAYER_ENTITY_ID: mediaPlayerEntityId,
  };
  const missing = HOME_ASSISTANT_ENV_KEYS.filter((key) => !values[key]);

  return {
    missing,
    config: missing.length
      ? null
      : {
          baseUrl,
          token,
          ttsEntityId,
          mediaPlayerEntityId,
        },
  };
}

export async function speakViaHomeAssistant(
  message,
  config = getHomeAssistantConfigStatus().config
) {
  if (!config) {
    const err = new Error("Branch announcement speaker bridge is not configured.");
    err.code = "BRIDGE_NOT_CONFIGURED";
    err.missingConfig = getHomeAssistantConfigStatus().missing;
    throw err;
  }

  const res = await fetch(config.baseUrl + "/api/services/tts/speak", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.token,
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
      body || "Home Assistant TTS request failed with HTTP " + res.status + "."
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
      message = normalizeBranchAnnouncementMessage(req.body?.message);
    } catch (err) {
      return res.status(400).json({ error: err?.message || "Invalid announcement message." });
    }

    try {
      await speakViaHomeAssistant(message);
      return res.json({ ok: true, message });
    } catch (err) {
      if (err?.code === "BRIDGE_NOT_CONFIGURED") {
        return res.status(503).json({
          error: "Branch announcement speaker bridge is not configured.",
          code: err.code,
          missingConfig: err.missingConfig || [],
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

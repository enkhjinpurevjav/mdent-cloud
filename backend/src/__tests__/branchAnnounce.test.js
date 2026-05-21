import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  getHomeAssistantConfigStatus,
  normalizeBranchAnnouncementMessage,
  speakViaHomeAssistant,
} from "../routes/branch-announce.js";

const defaultMessage = "Халиунаа эмчийн үйлчлүүлэгч ирлээ";

describe("branch announcement message validation", () => {
  it("accepts custom Mongolian announcement text", () => {
    assert.equal(
      normalizeBranchAnnouncementMessage("  Халиунаа эмчийн үйлчлүүлэгч ирлээ  "),
      defaultMessage
    );
  });

  it("normalizes repeated whitespace", () => {
    assert.equal(
      normalizeBranchAnnouncementMessage("Халиунаа\nэмчийн   үйлчлүүлэгч\tирлээ"),
      defaultMessage
    );
  });

  it("rejects blank text", () => {
    assert.throws(() => normalizeBranchAnnouncementMessage("   "), /required/);
  });

  it("rejects text over the maximum length", () => {
    assert.throws(() => normalizeBranchAnnouncementMessage("а".repeat(181)), /too long/);
  });
});

describe("branch announcement Home Assistant bridge", () => {
  it("reports missing speaker bridge environment keys", () => {
    const status = getHomeAssistantConfigStatus({
      HOME_ASSISTANT_URL: "http://homeassistant.local:8123",
      HOME_ASSISTANT_TOKEN: "test-token",
    });

    assert.equal(status.config, null);
    assert.deepEqual(status.missing, [
      "HOME_ASSISTANT_TTS_ENTITY_ID",
      "HOME_ASSISTANT_MEDIA_PLAYER_ENTITY_ID",
    ]);
  });

  it("posts the custom message to the configured tts.speak service", async () => {
    const requests = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        requests.push({
          method: req.method,
          url: req.url,
          auth: req.headers.authorization,
          body: JSON.parse(body),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("[]");
      });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      await speakViaHomeAssistant(defaultMessage, {
        baseUrl: `http://127.0.0.1:${port}`,
        token: "test-token",
        ttsEntityId: "tts.branch_mn",
        mediaPlayerEntityId: "media_player.doctors_room",
      });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "POST");
    assert.equal(requests[0].url, "/api/services/tts/speak");
    assert.equal(requests[0].auth, "Bearer test-token");
    assert.deepEqual(requests[0].body, {
      entity_id: "tts.branch_mn",
      media_player_entity_id: "media_player.doctors_room",
      message: defaultMessage,
    });
  });
});

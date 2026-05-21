import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  buildBranchAnnouncementMessage,
  speakViaHomeAssistant,
} from "../routes/branch-announce.js";

describe("branch announcement message builder", () => {
  it("builds the hard-coded Mongolian arrival sentence", () => {
    const message = buildBranchAnnouncementMessage({
      doctor: "khaliunaa",
      relation: "doctor_possessive",
      subject: "patient",
      status: "arrived",
    });

    assert.equal(message, "Халиунаа эмчийн үйлчлүүлэгч ирлээ");
  });

  it("rejects text that is not one of the hard-coded parts", () => {
    assert.throws(
      () =>
        buildBranchAnnouncementMessage({
          doctor: "custom_doctor",
          relation: "doctor_possessive",
          subject: "patient",
          status: "arrived",
        }),
      /Invalid announcement parts/
    );
  });
});

describe("branch announcement Home Assistant bridge", () => {
  it("posts the generated message to the configured tts.speak service", async () => {
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
      await speakViaHomeAssistant("Халиунаа эмчийн үйлчлүүлэгч ирлээ", {
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
      message: "Халиунаа эмчийн үйлчлүүлэгч ирлээ",
    });
  });
});

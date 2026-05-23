import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  getAllowedBranchAnnouncementMessages,
  getOrCreateBranchAnnouncementAudio,
  normalizeBranchAnnouncementMessage,
} from "../routes/branch-announce.js";

async function tempCacheDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "branch-announce-audio-"));
}

describe("branch announcement audio", () => {
  it("allows fixed doctor templates and fixed branch announcements", () => {
    const allowed = getAllowedBranchAnnouncementMessages();

    assert.equal(
      allowed.has("Хаш-Эрдэнэ эмчийн үйлчлүүлэгч ирлээ"),
      true
    );
    assert.equal(
      allowed.has("Энхцэцэг эмчийг ресепшн дээр дуудаж байна"),
      true
    );
    assert.equal(
      allowed.has("Сувилагчийг эмчилгээний танхимд дуудаж байна"),
      true
    );
    assert.equal(allowed.has("Хоол ирлээ"), true);
    assert.equal(allowed.has("Хүргэлт ирлээ"), true);
  });

  it("rejects unsupported custom text", () => {
    assert.throws(
      () => normalizeBranchAnnouncementMessage("дурын текст"),
      /Unsupported announcement message/
    );
  });

  it("generates audio once and reuses the cached WAV for the same sentence", async () => {
    const cacheDir = await tempCacheDir();
    const wav = Buffer.from("RIFF-test-wav");
    let fetchCalls = 0;
    const fetchImpl = async (_url, req) => {
      fetchCalls += 1;
      assert.equal(req.headers.Token, "test-token");
      assert.equal(req.headers["voice-id"], "FEMALE3v2");
      assert.equal(req.body, "Хаш-Эрдэнэ эмчийн үйлчлүүлэгч ирлээ");
      return {
        ok: true,
        arrayBuffer: async () =>
          wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
      };
    };
    const env = {
      CHIMEGE_API_TOKEN: "test-token",
      BRANCH_ANNOUNCE_AUDIO_CACHE_DIR: cacheDir,
    };

    const first = await getOrCreateBranchAnnouncementAudio(
      "Хаш-Эрдэнэ эмчийн үйлчлүүлэгч ирлээ",
      { env, fetchImpl }
    );
    const second = await getOrCreateBranchAnnouncementAudio(
      "Хаш-Эрдэнэ эмчийн үйлчлүүлэгч ирлээ",
      { env, fetchImpl }
    );

    assert.equal(first.cacheHit, false);
    assert.equal(second.cacheHit, true);
    assert.equal(fetchCalls, 1);
    assert.deepEqual(first.audio, wav);
    assert.deepEqual(second.audio, wav);
  });

  it("reports missing Chimege token before generating audio", async () => {
    await assert.rejects(
      () =>
        getOrCreateBranchAnnouncementAudio("Хоол ирлээ", {
          env: { BRANCH_ANNOUNCE_AUDIO_CACHE_DIR: "/tmp/unused" },
          fetchImpl: async () => {
            throw new Error("fetch should not be called");
          },
        }),
      /Chimege API token is not configured/
    );
  });
});

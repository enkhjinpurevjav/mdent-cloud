import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  ANNOUNCEMENT_PHRASES,
  getOrCreateBranchAnnouncementPartAudio,
  normalizeAnnouncementName,
  normalizeAnnouncementPart,
} from "../routes/branch-announce.js";

async function tempCacheDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "branch-announce-audio-"));
}

describe("branch announcement audio", () => {
  it("exposes the fixed phrase set", () => {
    assert.deepEqual(
      ANNOUNCEMENT_PHRASES.map((phrase) => phrase.id),
      [
        "doctor-patient-arrived",
        "call-doctor-reception",
        "call-nurse-treatment-room",
        "call-nurse-reception",
        "food-arrived",
        "sterilized-tools-arrived",
        "delivery-arrived",
      ]
    );
  });

  it("allows one-word names and rejects spaces", () => {
    assert.equal(normalizeAnnouncementName(" Хаш-Эрдэнэ "), "Хаш-Эрдэнэ");
    assert.throws(() => normalizeAnnouncementName("Хаш Эрдэнэ"), /one word/);
  });

  it("normalizes supported phrase parts", () => {
    assert.deepEqual(
      normalizeAnnouncementPart({ type: "phrase", id: "food-arrived" }),
      { type: "phrase", id: "food-arrived", text: "Хоол ирлээ" }
    );
    assert.throws(
      () => normalizeAnnouncementPart({ type: "phrase", id: "unknown" }),
      /Unsupported announcement phrase/
    );
  });

  it("generates a name once and reuses the cached WAV for that name", async () => {
    const cacheDir = await tempCacheDir();
    const wav = Buffer.from("RIFF-name-wav");
    let fetchCalls = 0;
    const fetchImpl = async (_url, req) => {
      fetchCalls += 1;
      assert.equal(req.headers.Token, "test-token");
      assert.equal(req.headers["voice-id"], "FEMALE3v2");
      assert.equal(req.body, "Хаш-Эрдэнэ");
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

    const first = await getOrCreateBranchAnnouncementPartAudio(
      { type: "name", text: "Хаш-Эрдэнэ" },
      { env, fetchImpl }
    );
    const second = await getOrCreateBranchAnnouncementPartAudio(
      { type: "name", text: "Хаш-Эрдэнэ" },
      { env, fetchImpl }
    );

    assert.equal(first.cacheHit, false);
    assert.equal(second.cacheHit, true);
    assert.equal(fetchCalls, 1);
    assert.deepEqual(first.audio, wav);
    assert.deepEqual(second.audio, wav);
  });

  it("caches phrase audio separately from name audio", async () => {
    const cacheDir = await tempCacheDir();
    const wav = Buffer.from("RIFF-phrase-wav");
    let requestedText = "";
    const fetchImpl = async (_url, req) => {
      requestedText = req.body;
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

    const result = await getOrCreateBranchAnnouncementPartAudio(
      { type: "phrase", id: "doctor-patient-arrived" },
      { env, fetchImpl }
    );

    assert.equal(result.cacheHit, false);
    assert.equal(result.part.text, "эмчийн үйлчлүүлэгч ирлээ");
    assert.equal(requestedText, "эмчийн үйлчлүүлэгч ирлээ");
  });

  it("reports missing Chimege token before generating audio", async () => {
    await assert.rejects(
      () =>
        getOrCreateBranchAnnouncementPartAudio(
          { type: "phrase", id: "food-arrived" },
          {
            env: { BRANCH_ANNOUNCE_AUDIO_CACHE_DIR: "/tmp/unused" },
            fetchImpl: async () => {
              throw new Error("fetch should not be called");
            },
          }
        ),
      /Chimege API token is not configured/
    );
  });
});

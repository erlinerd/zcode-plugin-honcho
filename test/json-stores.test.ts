import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonOutboxStore } from "../src/adapters/json-outbox-store.js";
import { JsonSessionStore } from "../src/adapters/json-session-store.js";
import type { MemoryTurn, SessionState } from "../src/domain/types.js";

function state(): SessionState {
  return {
    version: 1,
    sessionId: "session-1",
    turnId: "turn-1",
    prompt: "Remember this decision",
    startedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
  };
}

function turn(): MemoryTurn {
  return {
    idempotencyKey: "key-1",
    sourceSessionId: "session-1",
    honchoSessionId: "zcode-1",
    turnId: "turn-1",
    userPeerId: "lei",
    assistantPeerId: "zcode",
    prompt: "Remember this decision",
    assistantMessage: "Stored.",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:01:00.000Z",
  };
}

describe("JSON stores", () => {
  it("persists session state and clears it", async () => {
    const root = await mkdtemp(join(tmpdir(), "zcode-honcho-store-"));
    const store = new JsonSessionStore(root);

    await store.save(state());
    expect(await store.load("session-1")).toEqual(state());
    await store.clear("session-1");
    expect(await store.load("session-1")).toBeNull();
  });

  it("writes restrictive session files and hashes their names", async () => {
    const root = await mkdtemp(join(tmpdir(), "zcode-honcho-store-"));
    const store = new JsonSessionStore(root);

    await store.save(state());
    const sessions = join(root, "sessions");
    const files = await readdir(sessions);
    expect(files).toHaveLength(1);
    expect(files[0]).not.toContain("session-1");
    expect((await stat(join(sessions, files[0]))).mode & 0o777).toBe(0o600);
    expect(await readFile(join(sessions, files[0]), "utf8")).not.toContain(
      "secret",
    );
  });

  it("deduplicates outbox entries and removes delivered entries", async () => {
    const root = await mkdtemp(join(tmpdir(), "zcode-honcho-outbox-"));
    const store = new JsonOutboxStore(root);
    const value = turn();

    await store.enqueue(value);
    await store.enqueue(value);
    expect(await store.pending()).toEqual([value]);
    await store.remove(value.idempotencyKey);
    expect(await store.pending()).toEqual([]);
  });
});

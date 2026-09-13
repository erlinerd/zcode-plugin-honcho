import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withFileLock } from "./file-lock.js";
import { defaultDataDir, hashedKey } from "./paths.js";
import type { SessionState, SessionStore } from "../domain/types.js";

type NodeError = { code?: unknown };

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as NodeError).code;
  return typeof code === "string" ? code : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseState(value: unknown): SessionState | null {
  if (!isRecord(value)) return null;
  if (
    value.version !== 1 ||
    typeof value.sessionId !== "string" ||
    typeof value.turnId !== "string" ||
    (value.prompt !== null && typeof value.prompt !== "string") ||
    typeof value.startedAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    version: 1,
    sessionId: value.sessionId,
    turnId: value.turnId,
    prompt: value.prompt,
    startedAt: value.startedAt,
    updatedAt: value.updatedAt,
  };
}

export class JsonSessionStore implements SessionStore {
  private readonly dataDir: string;

  constructor(dataDir = defaultDataDir()) {
    this.dataDir = join(dataDir, "sessions");
  }

  async load(sessionId: string): Promise<SessionState | null> {
    let contents: string;
    try {
      contents = await readFile(this.statePath(sessionId), "utf8");
    } catch (error) {
      if (errorCode(error) === "ENOENT") return null;
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch (error) {
      throw new Error("Invalid session state JSON", { cause: error });
    }
    const state = parseState(parsed);
    if (!state) throw new Error("Invalid session state shape");
    return state;
  }

  async save(state: SessionState): Promise<void> {
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    const path = this.statePath(state.sessionId);
    const temporaryPath = `${path}.${process.pid}.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(state), {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, path);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  async clear(sessionId: string): Promise<void> {
    await rm(this.statePath(sessionId), { force: true });
  }

  async withSessionLock<T>(
    sessionId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    return withFileLock(this.lockPath(sessionId), task);
  }

  private statePath(sessionId: string): string {
    return join(this.dataDir, `${hashedKey(sessionId)}.json`);
  }

  private lockPath(sessionId: string): string {
    return join(this.dataDir, `${hashedKey(sessionId)}.lock`);
  }
}

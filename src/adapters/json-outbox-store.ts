import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { withFileLock } from "./file-lock.js";
import { defaultDataDir, hashedKey } from "./paths.js";
import type { MemoryTurn, OutboxStore } from "../domain/types.js";

type NodeError = { code?: unknown };

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as NodeError).code;
  return typeof code === "string" ? code : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTurn(value: unknown): MemoryTurn | null {
  if (!isRecord(value)) return null;
  const stringFields = [
    "idempotencyKey",
    "sourceSessionId",
    "honchoSessionId",
    "turnId",
    "userPeerId",
    "assistantPeerId",
    "startedAt",
    "endedAt",
  ];
  if (stringFields.some((field) => typeof value[field] !== "string"))
    return null;
  if (value.prompt !== null && typeof value.prompt !== "string") return null;
  if (
    value.assistantMessage !== null &&
    typeof value.assistantMessage !== "string"
  )
    return null;
  return {
    idempotencyKey: value.idempotencyKey as string,
    sourceSessionId: value.sourceSessionId as string,
    honchoSessionId: value.honchoSessionId as string,
    turnId: value.turnId as string,
    userPeerId: value.userPeerId as string,
    assistantPeerId: value.assistantPeerId as string,
    prompt: value.prompt as string | null,
    assistantMessage: value.assistantMessage as string | null,
    startedAt: value.startedAt as string,
    endedAt: value.endedAt as string,
  };
}

export class JsonOutboxStore implements OutboxStore {
  private readonly outboxDir: string;
  private readonly lockPath: string;

  constructor(dataDir = defaultDataDir()) {
    this.outboxDir = join(dataDir, "outbox");
    this.lockPath = join(dataDir, "outbox.lock");
  }

  async enqueue(turn: MemoryTurn): Promise<void> {
    await withFileLock(this.lockPath, async () => {
      await mkdir(this.outboxDir, { recursive: true, mode: 0o700 });
      const path = this.entryPath(turn.idempotencyKey);
      try {
        await stat(path);
        return;
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
      }
      const temporaryPath = `${path}.${process.pid}.tmp`;
      try {
        await writeFile(temporaryPath, JSON.stringify(turn), {
          encoding: "utf8",
          mode: 0o600,
        });
        await rename(temporaryPath, path);
      } finally {
        await rm(temporaryPath, { force: true });
      }
    });
  }

  async pending(): Promise<MemoryTurn[]> {
    let names: string[];
    try {
      names = await readdir(this.outboxDir);
    } catch (error) {
      if (errorCode(error) === "ENOENT") return [];
      throw error;
    }

    const entries: MemoryTurn[] = [];
    for (const name of names
      .filter((item) => item.endsWith(".json"))
      .sort((left, right) => left.localeCompare(right))) {
      const contents = await readFile(join(this.outboxDir, name), "utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(contents);
      } catch (error) {
        throw new Error("Invalid outbox JSON", { cause: error });
      }
      const turn = parseTurn(parsed);
      if (!turn) throw new Error("Invalid outbox entry shape");
      entries.push(turn);
    }
    return entries.sort((left, right) =>
      `${left.endedAt}:${left.idempotencyKey}`.localeCompare(
        `${right.endedAt}:${right.idempotencyKey}`,
      ),
    );
  }

  async remove(idempotencyKey: string): Promise<void> {
    await withFileLock(this.lockPath, async () => {
      await rm(this.entryPath(idempotencyKey), { force: true });
    });
  }

  private entryPath(idempotencyKey: string): string {
    return join(this.outboxDir, `${hashedKey(idempotencyKey)}.json`);
  }
}

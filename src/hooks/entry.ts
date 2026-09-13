import { randomUUID } from "node:crypto";
import { readConfig, isConfigured } from "../application/config.js";
import { MemoryTracker } from "../application/memory-tracker.js";
import {
  HonchoSdkClient,
  NoopHonchoClient,
} from "../adapters/honcho-sdk-client.js";
import { JsonOutboxStore } from "../adapters/json-outbox-store.js";
import { JsonSessionStore } from "../adapters/json-session-store.js";
import { eventName } from "../domain/extract.js";
import type { HookPayload, HookResult } from "../domain/types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePayload(raw: string): HookPayload {
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as HookPayload) : {};
  } catch {
    return {};
  }
}

async function readStdin(): Promise<string> {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

function diagnostics(enabled: boolean, message: string): void {
  if (enabled) process.stderr.write(`[zcode-plugin-honcho] ${message}\n`);
}

function protocolOutput(event: string | null, result: HookResult): string {
  if (event !== "SessionStart" || !result.additionalContext) return "{}\n";
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext: result.additionalContext,
    },
  })}\n`;
}

async function main(): Promise<void> {
  const config = readConfig();
  const payload = parsePayload(await readStdin());
  const event = eventName(payload);
  let result: HookResult = { additionalContext: null, warnings: [] };
  try {
    const configured = isConfigured(config);
    const client = configured
      ? new HonchoSdkClient(config)
      : new NoopHonchoClient();
    const tracker = new MemoryTracker(
      new JsonSessionStore(),
      new JsonOutboxStore(),
      client,
      { ...config, enabled: configured },
      { now: () => new Date() },
      { next: randomUUID },
    );
    result = await tracker.handle(payload);
  } catch (error) {
    const kind = error instanceof Error ? error.name : "unknown";
    result.warnings.push(`hook:${kind}`);
  }

  for (const warning of result.warnings)
    diagnostics(config.debug, `event=${event ?? "unknown"} ${warning}`);
  process.stdout.write(protocolOutput(event, result));
}

await main();

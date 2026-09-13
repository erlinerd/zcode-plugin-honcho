import { createHash } from "node:crypto";
import { sanitizeText } from "../domain/bounds.js";
import {
  assistantMessage,
  eventName,
  prompt,
  sessionId,
  turnId as payloadTurnId,
} from "../domain/extract.js";
import type {
  Clock,
  HookConfig,
  HookPayload,
  HookResult,
  HonchoClient,
  IdGenerator,
  MemoryTurn,
  OutboxStore,
  SessionState,
  SessionStore,
} from "../domain/types.js";

function createState(
  sourceSessionId: string,
  id: string,
  now: string,
  value: string | null,
): SessionState {
  return {
    version: 1,
    sessionId: sourceSessionId,
    turnId: id,
    prompt: value,
    startedAt: now,
    updatedAt: now,
  };
}

// Per-event flush budgets keep the serial retry loop inside the hook timeouts
// (SessionStart 5000ms total, Stop 20000ms total). A single in-flight addTurn
// can still take up to its 5000ms SDK timeout on top of the budget.
const SESSION_START_FLUSH_BUDGET_MS = 2_000;
const STOP_FLUSH_BUDGET_MS = 15_000;

function honchoSessionId(sourceSessionId: string): string {
  const digest = createHash("sha256").update(sourceSessionId).digest("hex");
  return `zcode-${digest.slice(0, 32)}`;
}

function idempotencyKey(sessionId: string, turnId: string): string {
  return createHash("sha256").update(`${sessionId}:${turnId}`).digest("hex");
}

function errorKind(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

export class MemoryTracker {
  constructor(
    private readonly sessions: SessionStore,
    private readonly outbox: OutboxStore,
    private readonly client: HonchoClient,
    private readonly config: HookConfig,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async handle(payload: HookPayload): Promise<HookResult> {
    const event = eventName(payload);
    if (!event) return { additionalContext: null, warnings: ["missing-event"] };
    if (!this.config.enabled) return { additionalContext: null, warnings: [] };
    if (!this.config.peerId)
      return { additionalContext: null, warnings: ["missing-peer"] };

    switch (event) {
      case "SessionStart":
        return this.onSessionStart();
      case "UserPromptSubmit":
        return this.onPrompt(payload);
      case "Stop":
        return this.onStop(payload);
      default:
        return { additionalContext: null, warnings: [] };
    }
  }

  private async onSessionStart(): Promise<HookResult> {
    const warnings: string[] = [];
    try {
      const failed = await this.flushPending(SESSION_START_FLUSH_BUDGET_MS);
      if (failed > 0) warnings.push(`outbox:pending-${failed}`);
    } catch (error) {
      warnings.push(`outbox:${errorKind(error)}`);
    }
    if (!this.config.injectContext || !this.config.peerId)
      return { additionalContext: null, warnings };

    try {
      const context = await this.client.getContext({
        peerId: this.config.peerId,
        assistantPeerId: this.config.assistantPeerId,
      });
      return {
        additionalContext: context
          ? sanitizeText(context, this.config.maxContextChars)
          : null,
        warnings,
      };
    } catch (error) {
      warnings.push(`recall:${errorKind(error)}`);
      return { additionalContext: null, warnings };
    }
  }

  private async onPrompt(payload: HookPayload): Promise<HookResult> {
    const sourceSessionId = sessionId(payload);
    if (!sourceSessionId)
      return { additionalContext: null, warnings: ["missing-session"] };
    return this.sessions.withSessionLock(sourceSessionId, async () => {
      const now = this.clock.now().toISOString();
      const current = await this.sessions.load(sourceSessionId);
      const value = this.config.capturePrompts
        ? sanitizeText(prompt(payload), this.config.maxCaptureChars)
        : null;
      const state = createState(
        sourceSessionId,
        payloadTurnId(payload) ?? this.ids.next(),
        current?.startedAt ?? now,
        value,
      );
      await this.sessions.save(state);
      return { additionalContext: null, warnings: [] };
    });
  }

  private async onStop(payload: HookPayload): Promise<HookResult> {
    const sourceSessionId = sessionId(payload);
    if (!sourceSessionId)
      return { additionalContext: null, warnings: ["missing-session"] };
    return this.sessions.withSessionLock(sourceSessionId, async () => {
      const state = await this.sessions.load(sourceSessionId);
      if (!state) return { additionalContext: null, warnings: [] };
      const endedAt = this.clock.now().toISOString();
      const turn: MemoryTurn = {
        idempotencyKey: idempotencyKey(sourceSessionId, state.turnId),
        sourceSessionId,
        honchoSessionId: honchoSessionId(sourceSessionId),
        turnId: state.turnId,
        userPeerId: this.config.peerId ?? "",
        assistantPeerId: this.config.assistantPeerId,
        prompt: state.prompt,
        assistantMessage: this.config.captureResponses
          ? sanitizeText(assistantMessage(payload), this.config.maxCaptureChars)
          : null,
        startedAt: state.startedAt,
        endedAt,
      };
      if (!turn.prompt && !turn.assistantMessage) {
        await this.sessions.clear(sourceSessionId);
        return { additionalContext: null, warnings: [] };
      }
      await this.outbox.enqueue(turn);
      await this.sessions.clear(sourceSessionId);
      const warnings: string[] = [];
      try {
        const failed = await this.flushPending(STOP_FLUSH_BUDGET_MS);
        if (failed > 0) warnings.push(`outbox:pending-${failed}`);
      } catch (error) {
        warnings.push(`outbox:${errorKind(error)}`);
      }
      return { additionalContext: null, warnings };
    });
  }

  private async flushPending(budgetMs: number): Promise<number> {
    const deadline = this.clock.now().getTime() + budgetMs;
    const entries = await this.outbox.pending();
    let delivered = 0;
    for (const entry of entries) {
      if (this.clock.now().getTime() >= deadline) break;
      try {
        await this.client.addTurn(entry);
        await this.outbox.remove(entry.idempotencyKey);
        delivered += 1;
      } catch {
        // Keep the failed entry pending and keep trying the rest while the
        // budget lasts, so one poisoned entry cannot starve the others.
      }
    }
    return entries.length - delivered;
  }
}

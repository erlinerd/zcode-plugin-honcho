import { describe, expect, it } from "vitest";
import { MemoryTracker } from "../src/application/memory-tracker.js";
import type {
  Clock,
  HookConfig,
  HookPayload,
  HonchoClient,
  MemoryTurn,
  OutboxStore,
  SessionState,
  SessionStore,
} from "../src/domain/types.js";

class MemorySessions implements SessionStore {
  private value: SessionState | null = null;

  async load(_sessionId: string): Promise<SessionState | null> {
    return this.value ? structuredClone(this.value) : null;
  }

  async save(value: SessionState): Promise<void> {
    this.value = structuredClone(value);
  }

  async clear(_sessionId: string): Promise<void> {
    this.value = null;
  }

  async withSessionLock<T>(_id: string, task: () => Promise<T>): Promise<T> {
    return task();
  }
}

class MemoryOutbox implements OutboxStore {
  readonly values: MemoryTurn[] = [];

  async enqueue(value: MemoryTurn): Promise<void> {
    if (
      !this.values.some((item) => item.idempotencyKey === value.idempotencyKey)
    )
      this.values.push(structuredClone(value));
  }

  async pending(): Promise<MemoryTurn[]> {
    return structuredClone(this.values);
  }

  async remove(key: string): Promise<void> {
    const index = this.values.findIndex(
      (value) => value.idempotencyKey === key,
    );
    if (index >= 0) this.values.splice(index, 1);
  }
}

class FixedClock implements Clock {
  now(): Date {
    return new Date("2026-01-01T00:00:00.000Z");
  }
}

class SteppingClock implements Clock {
  private current = 0;

  constructor(private readonly stepMs: number) {}

  now(): Date {
    const value = new Date(this.current);
    this.current += this.stepMs;
    return value;
  }
}

class FakeClient implements HonchoClient {
  readonly sent: MemoryTurn[] = [];
  context: string | null = null;
  fail = false;

  async addTurn(value: MemoryTurn): Promise<void> {
    if (this.fail) throw new Error("remote unavailable");
    this.sent.push(structuredClone(value));
  }

  async getContext(): Promise<string | null> {
    return this.context;
  }
}

const config: HookConfig = {
  apiKey: "key",
  baseURL: "https://example.test",
  workspaceId: "workspace",
  peerId: "lei",
  assistantPeerId: "zcode",
  enabled: true,
  injectContext: true,
  capturePrompts: true,
  captureResponses: true,
  maxContextChars: 80,
  maxCaptureChars: 200,
  debug: false,
};

function payload(
  event: string,
  fields: Record<string, unknown> = {},
): HookPayload {
  return { hook_event_name: event, session_id: "session-1", ...fields };
}

function createTracker() {
  const sessions = new MemorySessions();
  const outbox = new MemoryOutbox();
  const client = new FakeClient();
  const tracker = new MemoryTracker(
    sessions,
    outbox,
    client,
    config,
    new FixedClock(),
    { next: () => "turn-1" },
  );
  return { tracker, sessions, outbox, client };
}

describe("MemoryTracker", () => {
  it("correlates a prompt and final response into one delivered turn", async () => {
    const { tracker, outbox, client, sessions } = createTracker();

    await tracker.handle(
      payload("UserPromptSubmit", { prompt: "Remember this" }),
    );
    const result = await tracker.handle(
      payload("Stop", { last_assistant_message: "Stored." }),
    );

    expect(result.warnings).toEqual([]);
    expect(client.sent[0]).toMatchObject({
      prompt: "Remember this",
      assistantMessage: "Stored.",
      honchoSessionId: expect.stringMatching(/^zcode-/),
    });
    expect(outbox.values).toEqual([]);
    expect(await sessions.load("session-1")).toBeNull();
  });

  it("keeps failed deliveries pending and retries them at session start", async () => {
    const { tracker, outbox, client } = createTracker();
    client.fail = true;

    await tracker.handle(payload("UserPromptSubmit", { prompt: "Keep this" }));
    const stop = await tracker.handle(
      payload("Stop", { last_assistant_message: "Queued." }),
    );
    expect(stop.warnings).toContain("outbox:pending-1");
    expect(outbox.values).toHaveLength(1);

    client.fail = false;
    await tracker.handle(payload("SessionStart"));
    expect(outbox.values).toEqual([]);
    expect(client.sent).toHaveLength(1);
  });

  it("stops flushing pending turns once the time budget runs out", async () => {
    const outbox = new MemoryOutbox();
    const client = new FakeClient();
    // deadline consumes one step; each loop-entry check consumes one more.
    // SESSION_START budget 2000ms with 500ms steps allows exactly 3 deliveries.
    const tracker = new MemoryTracker(
      new MemorySessions(),
      outbox,
      client,
      config,
      new SteppingClock(500),
      { next: () => "turn-1" },
    );
    for (let i = 0; i < 5; i += 1) {
      await outbox.enqueue({
        idempotencyKey: `k${i}`,
        sourceSessionId: `session-${i}`,
        honchoSessionId: `zcode-${i}`,
        turnId: `turn-${i}`,
        userPeerId: "lei",
        assistantPeerId: "zcode",
        prompt: `p${i}`,
        assistantMessage: null,
        startedAt: "2026-01-01T00:00:00.000Z",
        endedAt: "2026-01-01T00:00:00.000Z",
      });
    }

    const result = await tracker.handle(payload("SessionStart"));

    expect(client.sent).toHaveLength(3);
    expect(outbox.values).toHaveLength(2);
    expect(result.warnings).toContain("outbox:pending-2");
  });

  it("injects bounded startup context and does not duplicate a stopped turn", async () => {
    const { tracker, client } = createTracker();
    client.context = "A".repeat(200);

    const start = await tracker.handle(payload("SessionStart"));
    expect(start.additionalContext).toHaveLength(80);

    await tracker.handle(payload("UserPromptSubmit", { prompt: "One" }));
    await tracker.handle(payload("Stop", { last_assistant_message: "Done" }));
    await tracker.handle(
      payload("Stop", { last_assistant_message: "Done again" }),
    );
    expect(client.sent).toHaveLength(1);
  });

  it("does not retain content when capture is disabled", async () => {
    const { outbox } = createTracker();
    const privateTracker = new MemoryTracker(
      new MemorySessions(),
      outbox,
      new FakeClient(),
      { ...config, capturePrompts: false, captureResponses: false },
      new FixedClock(),
      { next: () => "turn-2" },
    );

    await privateTracker.handle(
      payload("UserPromptSubmit", { prompt: "private" }),
    );
    await privateTracker.handle(
      payload("Stop", { last_assistant_message: "private response" }),
    );
    expect(outbox.values).toEqual([]);
  });
});

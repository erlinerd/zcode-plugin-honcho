import { describe, expect, it } from "vitest";
import { HonchoSdkClient } from "../src/adapters/honcho-sdk-client.js";
import type { HookConfig, MemoryTurn } from "../src/domain/types.js";

const config: HookConfig = {
  apiKey: "test-key",
  baseURL: "https://honcho.example",
  workspaceId: "workspace-1",
  peerId: "lei",
  assistantPeerId: "zcode",
  enabled: true,
  injectContext: true,
  capturePrompts: true,
  captureResponses: true,
  maxContextChars: 8000,
  maxCaptureChars: 20000,
  debug: false,
};

const turn: MemoryTurn = {
  idempotencyKey: "memory-key",
  sourceSessionId: "source-session",
  honchoSessionId: "zcode-session",
  turnId: "turn-1",
  userPeerId: "lei",
  assistantPeerId: "zcode",
  prompt: "I prefer concise answers.",
  assistantMessage: "Understood.",
  startedAt: "2026-01-01T00:00:00.000Z",
  endedAt: "2026-01-01T00:01:00.000Z",
};

describe("HonchoSdkClient", () => {
  it("attributes both sides of a turn and preserves the idempotency key", async () => {
    const messages: unknown[] = [];
    const sessionCalls: unknown[] = [];
    const peer = (id: string) => ({
      id,
      message: (content: string, options?: Record<string, unknown>) => ({
        peerId: id,
        content,
        options,
      }),
      context: async () => ({ representation: null, peerCard: null }),
    });
    const api = {
      peer: async (id: string) => peer(id),
      session: async (id: string, options?: Record<string, unknown>) => {
        sessionCalls.push({ id, options });
        return {
          addMessages: async (items: unknown[]) => messages.push(...items),
        };
      },
    };
    const client = new HonchoSdkClient(config, () => api);

    await client.addTurn(turn);

    expect(sessionCalls[0]).toMatchObject({
      id: "zcode-session",
      options: { metadata: { memoryKey: "memory-key" } },
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ peerId: "lei", content: turn.prompt });
    expect(messages[1]).toMatchObject({
      peerId: "zcode",
      content: turn.assistantMessage,
    });
  });

  it("formats peer card and representation for bounded startup context", async () => {
    const api = {
      peer: async () => ({
        id: "lei",
        message: () => ({}),
        context: async () => ({
          peerCard: ["Prefers concise answers"],
          representation: "Uses TypeScript and tests changes.",
        }),
      }),
      session: async () => ({ addMessages: async () => undefined }),
    };
    const client = new HonchoSdkClient(config, () => api);

    await expect(
      client.getContext({ peerId: "lei", assistantPeerId: "zcode" }),
    ).resolves.toContain("Known user context:");
    await expect(
      client.getContext({ peerId: "lei", assistantPeerId: "zcode" }),
    ).resolves.toContain("Learned representation:");
  });
});

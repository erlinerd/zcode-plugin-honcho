import { describe, expect, it } from "vitest";
import {
  assistantMessage,
  eventName,
  prompt,
  sessionId,
  turnId,
} from "../src/domain/extract.js";

describe("hook payload extraction", () => {
  it("supports documented snake_case and camelCase aliases", () => {
    const payload = {
      hookEventName: "UserPromptSubmit",
      sessionId: "session-1",
      userPrompt: "hello",
      lastAssistantMessage: "world",
      turnId: "turn-1",
    };

    expect(eventName(payload)).toBe("UserPromptSubmit");
    expect(sessionId(payload)).toBe("session-1");
    expect(prompt(payload)).toBe("hello");
    expect(assistantMessage(payload)).toBe("world");
    expect(turnId(payload)).toBe("turn-1");
  });

  it("serializes structured prompt values and rejects missing identifiers", () => {
    expect(prompt({ prompt: { request: "hello" } })).toBe(
      '{"request":"hello"}',
    );
    expect(sessionId({ session_id: "  " })).toBeNull();
    expect(eventName({})).toBeNull();
  });
});

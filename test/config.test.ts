import { describe, expect, it } from "vitest";
import { isConfigured, readConfig } from "../src/application/config.js";

describe("configuration", () => {
  it("prefers ZCode userConfig, then environment, over stored options", () => {
    const config = readConfig(
      {
        HONCHO_API_KEY: "environment-key",
        HONCHO_BASE_URL: "https://environment.example",
        ZCODE_USER_CONFIG_HONCHO_API_KEY: "user-config-key",
      },
      {
        honcho_api_key: "stored-key",
        honcho_base_url: "https://stored.example",
        honcho_workspace_id: "workspace",
        honcho_peer_id: "lei",
      },
    );

    expect(config.apiKey).toBe("user-config-key");
    expect(config.baseURL).toBe("https://environment.example");
    expect(config.workspaceId).toBe("workspace");
    expect(config.peerId).toBe("lei");
  });

  it("uses safe defaults and rejects invalid base URLs", () => {
    const config = readConfig({ HONCHO_BASE_URL: "file:///private" }, {});

    expect(config.baseURL).toBe("https://api.honcho.dev");
    expect(config.assistantPeerId).toBe("zcode");
    expect(config.maxContextChars).toBe(8000);
    expect(config.maxCaptureChars).toBe(20000);
    expect(isConfigured(config)).toBe(false);
  });

  it("requires all remote identity fields before enabling delivery", () => {
    const config = readConfig(
      {
        HONCHO_API_KEY: "key",
        HONCHO_WORKSPACE_ID: "workspace",
        HONCHO_PEER_ID: "lei",
        HONCHO_ENABLED: "true",
      },
      {},
    );

    expect(isConfigured(config)).toBe(true);
    expect(isConfigured({ ...config, peerId: null })).toBe(false);
    expect(isConfigured({ ...config, enabled: false })).toBe(false);
  });

  it("supports disabling capture and context injection", () => {
    const config = readConfig(
      {
        HONCHO_CAPTURE_PROMPTS: "false",
        HONCHO_CAPTURE_RESPONSES: "off",
        HONCHO_INJECT_CONTEXT: "0",
        HONCHO_MAX_CONTEXT_CHARS: "-1",
      },
      {},
    );

    expect(config.capturePrompts).toBe(false);
    expect(config.captureResponses).toBe(false);
    expect(config.injectContext).toBe(false);
    expect(config.maxContextChars).toBe(8000);
  });
});

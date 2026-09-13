import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isConfigured, readConfig } from "../src/application/config.js";
import { PLUGIN_ID } from "../src/domain/identity.js";

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

describe("stored options plugin-id matching", () => {
  const NEW_KEY = `${PLUGIN_ID}@${PLUGIN_ID}`;
  const OLD_KEY = "honcho-memory@zcode-honcho-community";
  const tempDirs: string[] = [];

  beforeEach(() => {
    // Isolate the homedir fallback in readStoredOptions from the real machine.
    const home = mkdtempSync(join(tmpdir(), "honcho-home-"));
    tempDirs.push(home);
    vi.stubEnv("HOME", home);
  });

  function writeConfigFile(options: Record<string, unknown>): string {
    const dir = mkdtempSync(join(tmpdir(), "honcho-config-"));
    tempDirs.push(dir);
    const file = join(dir, "config.json");
    writeFileSync(file, JSON.stringify({ plugins: { options } }));
    return file;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop() as string, { recursive: true, force: true });
    }
  });

  it("finds stored options by the current plugin-id prefix", () => {
    const file = writeConfigFile({
      [OLD_KEY]: { honcho_api_key: "old-key" },
      [NEW_KEY]: {
        honcho_api_key: "new-key",
        honcho_workspace_id: "workspace",
        honcho_peer_id: "lei",
      },
    });

    const config = readConfig({ ZCODE_CONFIG_PATH: file });

    expect(config.apiKey).toBe("new-key");
  });

  it("prefers the configured plugin id over the prefix scan", () => {
    const file = writeConfigFile({
      "zcode-plugin-honcho@other-marketplace": {
        honcho_api_key: "scan-order-key",
      },
      [NEW_KEY]: { honcho_api_key: "env-id-key" },
    });

    const config = readConfig({
      ZCODE_CONFIG_PATH: file,
      ZCODE_PLUGIN_ID: NEW_KEY,
    });

    expect(config.apiKey).toBe("env-id-key");
  });

  it("falls back to defaults for pre-rename keys (breaking change)", () => {
    const file = writeConfigFile({
      [OLD_KEY]: { honcho_api_key: "old-key" },
    });

    const config = readConfig({ ZCODE_CONFIG_PATH: file });

    expect(config.apiKey).toBeNull();
    expect(isConfigured(config)).toBe(false);
  });
});

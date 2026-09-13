import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { HookConfig } from "../domain/types.js";

const DEFAULT_BASE_URL = "https://api.honcho.dev";
const DEFAULT_ASSISTANT_PEER_ID = "zcode";
const DEFAULT_MAX_CONTEXT_CHARS = 8_000;
const DEFAULT_MAX_CAPTURE_CHARS = 20_000;

export type StoredOption = string | number | boolean;
export type StoredOptions = Record<string, StoredOption>;

type ConfigValue = StoredOption | undefined;

function asText(value: ConfigValue): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : String(value);
}

function firstNonEmpty(...values: ConfigValue[]): string | undefined {
  return values
    .map(asText)
    .find((value) => value !== undefined && value.trim().length > 0)
    ?.trim();
}

function userConfig(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const normalized = name.toUpperCase();
  return firstNonEmpty(
    env[`ZCODE_USER_CONFIG_${normalized}`],
    env[`ZCODE_PLUGIN_CONFIG_${normalized}`],
  );
}

function isStoredOption(value: unknown): value is StoredOption {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function parseStoredOptions(value: unknown): StoredOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return {};
  const options: StoredOptions = {};
  for (const [key, option] of Object.entries(value)) {
    if (isStoredOption(option)) options[key] = option;
  }
  return options;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStoredOptions(env: NodeJS.ProcessEnv): StoredOptions {
  const configPaths = [
    env.ZCODE_CONFIG_PATH,
    join(homedir(), ".zcode", "cli", "config.json"),
  ].filter((path): path is string => Boolean(path));
  const configuredPluginId = env.ZCODE_PLUGIN_ID;

  for (const configPath of configPaths) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
      if (!isRecord(parsed) || !isRecord(parsed.plugins)) continue;
      const options = parsed.plugins.options;
      if (!isRecord(options)) continue;
      const pluginId =
        configuredPluginId && options[configuredPluginId]
          ? configuredPluginId
          : Object.keys(options).find((key) =>
              key.startsWith("honcho-memory@"),
            );
      if (pluginId) return parseStoredOptions(options[pluginId]);
    } catch (error) {
      if (error instanceof SyntaxError) return {};
      const code =
        isRecord(error) && typeof error.code === "string" ? error.code : null;
      if (code === "ENOENT" || code === "EACCES") continue;
      return {};
    }
  }
  return {};
}

function option(
  env: NodeJS.ProcessEnv,
  storedOptions: StoredOptions,
  name: string,
  environmentName: string,
): string | undefined {
  return firstNonEmpty(
    userConfig(env, name),
    env[environmentName],
    storedOptions[name],
  );
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return fallback;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100_000);
}

function normalizeBaseURL(value: string | undefined): string {
  const candidate = value ?? DEFAULT_BASE_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return DEFAULT_BASE_URL;
    return candidate.replace(/\/+$/, "");
  } catch {
    return DEFAULT_BASE_URL;
  }
}

export function readConfig(
  env: NodeJS.ProcessEnv = process.env,
  storedOptions: StoredOptions = readStoredOptions(env),
): HookConfig {
  return {
    apiKey:
      option(env, storedOptions, "honcho_api_key", "HONCHO_API_KEY") ?? null,
    baseURL: normalizeBaseURL(
      option(env, storedOptions, "honcho_base_url", "HONCHO_BASE_URL"),
    ),
    workspaceId:
      option(
        env,
        storedOptions,
        "honcho_workspace_id",
        "HONCHO_WORKSPACE_ID",
      ) ?? null,
    peerId:
      option(env, storedOptions, "honcho_peer_id", "HONCHO_PEER_ID") ?? null,
    assistantPeerId:
      option(
        env,
        storedOptions,
        "honcho_assistant_peer_id",
        "HONCHO_ASSISTANT_PEER_ID",
      ) ?? DEFAULT_ASSISTANT_PEER_ID,
    enabled: parseBoolean(
      option(env, storedOptions, "enabled", "HONCHO_ENABLED"),
      true,
    ),
    injectContext: parseBoolean(
      option(env, storedOptions, "inject_context", "HONCHO_INJECT_CONTEXT"),
      true,
    ),
    capturePrompts: parseBoolean(
      option(env, storedOptions, "capture_prompts", "HONCHO_CAPTURE_PROMPTS"),
      true,
    ),
    captureResponses: parseBoolean(
      option(
        env,
        storedOptions,
        "capture_responses",
        "HONCHO_CAPTURE_RESPONSES",
      ),
      true,
    ),
    maxContextChars: parsePositiveInteger(
      option(
        env,
        storedOptions,
        "max_context_chars",
        "HONCHO_MAX_CONTEXT_CHARS",
      ),
      DEFAULT_MAX_CONTEXT_CHARS,
    ),
    maxCaptureChars: parsePositiveInteger(
      option(
        env,
        storedOptions,
        "max_capture_chars",
        "HONCHO_MAX_CAPTURE_CHARS",
      ),
      DEFAULT_MAX_CAPTURE_CHARS,
    ),
    debug: parseBoolean(
      option(env, storedOptions, "debug", "HONCHO_DEBUG"),
      false,
    ),
  };
}

export function isConfigured(config: HookConfig): boolean {
  return Boolean(
    config.enabled &&
      config.apiKey &&
      config.workspaceId &&
      config.peerId &&
      config.assistantPeerId,
  );
}

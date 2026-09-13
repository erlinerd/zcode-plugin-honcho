import type { HookEventName, HookPayload } from "./types.js";

type HookValue = string | number | boolean | object;

function valueAt(
  payload: HookPayload,
  ...keys: string[]
): HookValue | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        typeof value === "object")
    ) {
      return value;
    }
  }
  return undefined;
}

function stringifyValue(value: HookValue | undefined): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value === undefined || value === null) return null;
  const json = JSON.stringify(value);
  return json ?? null;
}

export function eventName(payload: HookPayload): HookEventName | null {
  return stringifyValue(
    valueAt(payload, "hook_event_name", "hookEventName", "event", "event_name"),
  ) as HookEventName | null;
}

export function sessionId(payload: HookPayload): string | null {
  const value = stringifyValue(valueAt(payload, "session_id", "sessionId"));
  return value?.trim() || null;
}

export function prompt(payload: HookPayload): string | null {
  return stringifyValue(
    valueAt(payload, "prompt", "user_prompt", "userPrompt", "message"),
  );
}

export function assistantMessage(payload: HookPayload): string | null {
  return stringifyValue(
    valueAt(payload, "last_assistant_message", "lastAssistantMessage"),
  );
}

export function turnId(payload: HookPayload): string | null {
  const value = stringifyValue(valueAt(payload, "turn_id", "turnId"));
  return value?.trim() || null;
}

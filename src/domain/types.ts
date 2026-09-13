export type HookEventName =
  | "SessionStart"
  | "UserPromptSubmit"
  | "Stop"
  | (string & {});

export type HookPayload = Record<string, unknown> & {
  hook_event_name?: unknown;
  hookEventName?: unknown;
  event?: unknown;
  event_name?: unknown;
  session_id?: unknown;
  sessionId?: unknown;
  prompt?: unknown;
  user_prompt?: unknown;
  userPrompt?: unknown;
  message?: unknown;
  last_assistant_message?: unknown;
  lastAssistantMessage?: unknown;
  turn_id?: unknown;
  turnId?: unknown;
};

export interface MemoryTurn {
  idempotencyKey: string;
  sourceSessionId: string;
  honchoSessionId: string;
  turnId: string;
  userPeerId: string;
  assistantPeerId: string;
  prompt: string | null;
  assistantMessage: string | null;
  startedAt: string;
  endedAt: string;
}

export interface SessionState {
  version: 1;
  sessionId: string;
  turnId: string;
  prompt: string | null;
  startedAt: string;
  updatedAt: string;
}

export interface HookConfig {
  apiKey: string | null;
  baseURL: string;
  workspaceId: string | null;
  peerId: string | null;
  assistantPeerId: string;
  enabled: boolean;
  injectContext: boolean;
  capturePrompts: boolean;
  captureResponses: boolean;
  maxContextChars: number;
  maxCaptureChars: number;
  debug: boolean;
}

export interface HonchoClient {
  addTurn(turn: MemoryTurn): Promise<void>;
  getContext(input: {
    peerId: string;
    assistantPeerId: string;
  }): Promise<string | null>;
}

export interface SessionStore {
  load(sessionId: string): Promise<SessionState | null>;
  save(state: SessionState): Promise<void>;
  clear(sessionId: string): Promise<void>;
  withSessionLock<T>(sessionId: string, task: () => Promise<T>): Promise<T>;
}

export interface OutboxStore {
  enqueue(turn: MemoryTurn): Promise<void>;
  pending(): Promise<MemoryTurn[]>;
  remove(idempotencyKey: string): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface HookResult {
  additionalContext: string | null;
  warnings: string[];
}

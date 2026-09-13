import { mkdir, open, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";

const LOCK_WAIT_MS = 25;
const LOCK_ATTEMPTS = 160;
const STALE_LOCK_MS = 60_000;

type NodeError = { code?: unknown };

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as NodeError).code;
  return typeof code === "string" ? code : null;
}

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_MS));
}

async function removeStaleLock(lockPath: string): Promise<void> {
  try {
    const details = await stat(lockPath);
    if (Date.now() - details.mtimeMs > STALE_LOCK_MS)
      await rm(lockPath, { force: true });
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

export async function withFileLock<T>(
  lockPath: string,
  task: () => Promise<T>,
): Promise<T> {
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
  let acquired = false;

  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.close();
      acquired = true;
      break;
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
      await removeStaleLock(lockPath);
      await wait();
    }
  }

  if (!acquired) throw new Error("Timed out acquiring the plugin state lock");

  try {
    return await task();
  } finally {
    await rm(lockPath, { force: true });
  }
}

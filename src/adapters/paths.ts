import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { PLUGIN_ID } from "../domain/identity.js";

export function defaultDataDir(): string {
  return (
    process.env.ZCODE_PLUGIN_DATA ||
    join(
      homedir() || tmpdir(),
      ".zcode",
      "cli",
      "plugins",
      "data",
      PLUGIN_ID,
    )
  );
}

export function hashedKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

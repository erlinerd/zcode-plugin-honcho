import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export function defaultDataDir(): string {
  return (
    process.env.ZCODE_PLUGIN_DATA ||
    join(
      homedir() || tmpdir(),
      ".zcode",
      "cli",
      "plugins",
      "data",
      "zcode-plugin-honcho",
    )
  );
}

export function hashedKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

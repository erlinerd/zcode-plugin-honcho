import { describe, expect, it } from "vitest";
import { readConfig } from "../src/application/config.js";

describe("default context cap", () => {
  it("keeps the default stdout context cap within ZCode's hook budget", () => {
    const config = readConfig({}, {});
    expect(config.maxContextChars).toBeLessThanOrEqual(8_000);
  });
});

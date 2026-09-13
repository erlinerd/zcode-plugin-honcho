import { basename } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDataDir } from "../src/adapters/paths.js";
import { PLUGIN_ID } from "../src/domain/identity.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("defaultDataDir", () => {
  it("uses the plugin id as the data-directory segment", () => {
    vi.stubEnv("ZCODE_PLUGIN_DATA", undefined);

    expect(basename(defaultDataDir())).toBe(PLUGIN_ID);
  });

  it("honors the ZCODE_PLUGIN_DATA override", () => {
    vi.stubEnv("ZCODE_PLUGIN_DATA", "/tmp/custom-data");

    expect(defaultDataDir()).toBe("/tmp/custom-data");
  });
});

import { describe, expect, it } from "vitest";
import {
  redactSensitiveText,
  sanitizeText,
  truncate,
} from "../src/domain/bounds.js";

describe("message bounds", () => {
  it("truncates content with an explicit marker", () => {
    expect(truncate("a".repeat(30), 20)).toBe("aaaaaaa… [truncated]");
    expect(truncate("abc", 8)).toBe("abc");
  });

  it("redacts common credentials before storage or injection", () => {
    const value = "Authorization: Bearer hch-secret-value-1234";
    expect(redactSensitiveText(value)).toBe("Authorization: Bearer [REDACTED]");
  });

  it("redacts and bounds a nullable message", () => {
    expect(sanitizeText("token=super-secret-value", 32)).toBe(
      "token=[REDACTED]",
    );
    expect(sanitizeText(null, 12)).toBeNull();
  });
});

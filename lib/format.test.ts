import { describe, expect, it } from "vitest";
import { formatDuration, formatScore } from "./format";

describe("formatScore", () => {
  it("formats numbers with default precision", () => {
    expect(formatScore(0.1234)).toBe("0.12");
  });

  it("returns dash for empty values", () => {
    expect(formatScore(null)).toBe("—");
    expect(formatScore(undefined)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("formats durations in minutes/seconds", () => {
    const start = "2026-02-28T10:00:00.000Z";
    const end = "2026-02-28T10:02:05.000Z";
    expect(formatDuration(start, end)).toBe("2m 5s");
  });

  it("returns dash when start or end missing", () => {
    expect(formatDuration(null, "2026-02-28T10:00:00.000Z")).toBe("—");
    expect(formatDuration("2026-02-28T10:00:00.000Z", null)).toBe("—");
  });
});

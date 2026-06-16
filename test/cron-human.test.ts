import { describe, it, expect } from "vitest";
import {
  buildCron,
  parseCron,
  humanizeCron,
  formatTime,
  type CronParts,
} from "@/lib/cron-human";

describe("buildCron", () => {
  it("daily ignores the day list and uses *", () => {
    expect(
      buildCron({ minute: 0, hour: 17, frequency: "daily", days: [1, 2] })
    ).toBe("0 17 * * *");
  });

  it("weekdays → 1-5", () => {
    expect(
      buildCron({ minute: 0, hour: 9, frequency: "weekdays", days: [] })
    ).toBe("0 9 * * 1-5");
  });

  it("weekends → 0,6", () => {
    expect(
      buildCron({ minute: 30, hour: 18, frequency: "weekends", days: [] })
    ).toBe("30 18 * * 0,6");
  });

  it("custom sorts + dedupes the day list", () => {
    expect(
      buildCron({ minute: 0, hour: 17, frequency: "custom", days: [5, 1, 3, 1] })
    ).toBe("0 17 * * 1,3,5");
  });

  it("custom with all seven days collapses to *", () => {
    expect(
      buildCron({
        minute: 0,
        hour: 17,
        frequency: "custom",
        days: [0, 1, 2, 3, 4, 5, 6],
      })
    ).toBe("0 17 * * *");
  });

  it("custom with no days falls back to *", () => {
    expect(
      buildCron({ minute: 0, hour: 17, frequency: "custom", days: [] })
    ).toBe("0 17 * * *");
  });

  it("clamps out-of-range minute/hour", () => {
    expect(
      buildCron({ minute: 99, hour: 30, frequency: "daily", days: [] })
    ).toBe("59 23 * * *");
  });
});

describe("parseCron", () => {
  it("parses the default daily 5pm", () => {
    expect(parseCron("0 17 * * *")).toEqual<CronParts>({
      minute: 0,
      hour: 17,
      frequency: "daily",
      days: [0, 1, 2, 3, 4, 5, 6],
    });
  });

  it("parses weekdays range", () => {
    expect(parseCron("0 17 * * 1-5")).toMatchObject({
      frequency: "weekdays",
      days: [1, 2, 3, 4, 5],
    });
  });

  it("recognises weekends from a list in any order", () => {
    expect(parseCron("0 9 * * 6,0")).toMatchObject({ frequency: "weekends" });
  });

  it("recognises a weekday list as weekdays", () => {
    expect(parseCron("0 9 * * 1,2,3,4,5")).toMatchObject({
      frequency: "weekdays",
    });
  });

  it("keeps an arbitrary list as custom", () => {
    expect(parseCron("15 8 * * 1,3,5")).toEqual<CronParts>({
      minute: 15,
      hour: 8,
      frequency: "custom",
      days: [1, 3, 5],
    });
  });

  it("normalises dow 7 to Sunday", () => {
    expect(parseCron("0 12 * * 7")).toMatchObject({
      frequency: "custom",
      days: [0],
    });
  });

  it("treats a full 0-6 list as daily", () => {
    expect(parseCron("0 12 * * 0,1,2,3,4,5,6")).toMatchObject({
      frequency: "daily",
    });
  });

  it("rejects shapes the builder can't model", () => {
    expect(parseCron("*/5 17 * * *")).toBeNull(); // step minute
    expect(parseCron("0 17 1 * *")).toBeNull(); // day-of-month set
    expect(parseCron("0 17 * 6 *")).toBeNull(); // month set
    expect(parseCron("0 17 * *")).toBeNull(); // wrong field count
    expect(parseCron("0 99 * * *")).toBeNull(); // hour out of range
    expect(parseCron("0 17 * * 9")).toBeNull(); // bad dow
  });

  it("round-trips build → parse → build", () => {
    for (const cron of [
      "0 17 * * *",
      "0 9 * * 1-5",
      "30 18 * * 0,6",
      "15 8 * * 1,3,5",
    ]) {
      const parts = parseCron(cron)!;
      expect(parts).not.toBeNull();
      expect(buildCron(parts)).toBe(cron);
    }
  });
});

describe("formatTime", () => {
  it.each([
    [0, 0, "12:00 AM"],
    [9, 5, "9:05 AM"],
    [12, 0, "12:00 PM"],
    [17, 0, "5:00 PM"],
    [23, 30, "11:30 PM"],
  ])("formats %i:%i", (h, m, expected) => {
    expect(formatTime(h, m)).toBe(expected);
  });
});

describe("humanizeCron", () => {
  it.each([
    ["0 17 * * *", "Every day at 5:00 PM"],
    ["0 9 * * 1-5", "Weekdays at 9:00 AM"],
    ["30 18 * * 0,6", "Weekends at 6:30 PM"],
    ["15 8 * * 1,3,5", "Mon, Wed, Fri at 8:15 AM"],
  ])("%s → %s", (cron, expected) => {
    expect(humanizeCron(cron)).toBe(expected);
  });

  it("falls back to the raw expression when unmodellable", () => {
    expect(humanizeCron("*/10 * * * *")).toBe("*/10 * * * *");
  });
});

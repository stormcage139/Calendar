import assert from "node:assert/strict";
import { test } from "node:test";
import { dateKey, monthDays, readableDate } from "../src/pages/plannerData.ts";

test("calendar aligns Monday-first months, leap years and year boundaries", () => {
  const october = monthDays(new Date(2026, 9, 1));
  assert.equal(october.length, 35);
  assert.deepEqual(october[0], { key: "2026-09-28", day: 28, outside: true });
  assert.deepEqual(october[3], { key: "2026-10-01", day: 1, outside: false });
  assert.equal(monthDays(new Date(2028, 1, 1)).filter((day) => !day.outside).length, 29);
  assert.equal(monthDays(new Date(2026, 2, 1)).length, 42);
  assert.equal(monthDays(new Date(2026, 0, 1))[0].key, "2025-12-29");
});

test("deadline dates do not shift to a different day for time zones", () => {
  assert.equal(dateKey(new Date(2026, 9, 11, 23, 30)), "2026-10-11");
  assert.equal(readableDate("2026-10-11T23:30:00-12:00"), readableDate("2026-10-11"));
});

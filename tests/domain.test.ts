import { test } from "node:test";
import assert from "node:assert/strict";
import { selectEvents, countdown } from "../web/src/lib/time";
import { splitAmount } from "../web/src/lib/money";
import { zonedInstant, localInput } from "../web/src/lib/zoned-input";
import { eventInput } from "./support/api";
import type { TripEvent } from "../web/src/lib/models";
test("日期由真实事项决定，空行程不会误报结束", () => {
  assert.equal(selectEvents([], Date.now()).finished, false);
  const e = { ...eventInput, id: "event", version: 1 } as TripEvent;
  assert.equal(selectEvents([e], Date.parse(e.start)).current?.id, e.id);
  assert.equal(selectEvents([e], Date.parse(e.end)).finished, true);
  assert.equal(countdown(e.start, Date.parse(e.start) - 1000), "00:00:01");
});
test("分摊整数分守恒，支持超过六人", () => {
  for (let n = 1; n < 30; n++) {
    const values = Object.values(
      splitAmount(
        10001,
        Array.from({ length: n }, (_, i) => String(i)),
      ),
    );
    assert.equal(
      values.reduce((a, b) => a + b, 0),
      10001,
    );
    assert.ok(Math.max(...values) - Math.min(...values) <= 1);
  }
});
test("跨时区输入和夏令时缺失、重复时刻", () => {
  assert.equal(
    zonedInstant("2030-06-01T09:00", "Asia/Shanghai"),
    "2030-06-01T01:00:00.000Z",
  );
  assert.equal(
    localInput("2030-06-01T01:00:00Z", "Asia/Shanghai"),
    "2030-06-01T09:00",
  );
  assert.throws(
    () => zonedInstant("2030-03-10T02:30", "America/New_York"),
    /不存在/,
  );
  assert.throws(
    () => zonedInstant("2030-11-03T01:30", "America/New_York"),
    /两次/,
  );
  assert.equal(
    zonedInstant("2030-11-03T01:30", "America/New_York", "-05:00"),
    "2030-11-03T06:30:00.000Z",
  );
});

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
test("结算按默认汇率折成人民币，分摊在人民币上守恒", async () => {
  const { toCnyFen, summarizeInCny, defaultCnyRates } = await import(
    "../web/src/lib/money"
  );
  assert.equal(toCnyFen(100, "NZD"), 400);
  assert.equal(toCnyFen(100, "USD"), 680);
  assert.equal(toCnyFen(250, "CNY"), 250);
  const members = [
    { id: "a", name: "甲", english_name: "A" },
    { id: "b", name: "乙", english_name: "B" },
  ];
  const result = summarizeInCny(
    [
      {
        id: "nzd",
        payer_id: "a",
        title: "午餐",
        amount: 10000,
        currency: "NZD",
        category: "餐饮",
        date: "2026-09-25",
        participants: ["a", "b"],
        note: "",
        source: "手动",
        version: 1,
      },
      {
        id: "usd",
        payer_id: "b",
        title: "门票",
        amount: 1000,
        currency: "USD",
        category: "活动",
        date: "2026-09-25",
        participants: ["a", "b"],
        note: "",
        source: "手动",
        version: 1,
      },
    ],
    members,
    defaultCnyRates,
  );
  assert.equal(result.total, 46800);
  assert.equal(
    result.rows.reduce((sum, row) => sum + row.share, 0),
    result.total,
  );
  assert.equal(
    result.rows.reduce((sum, row) => sum + row.balance, 0),
    0,
  );
});
test("转账不计入支出合计，只冲减待结算；按余额贪心配对给出转账建议", async () => {
  const { summarizeInCny, suggestSettlements, TRANSFER_CATEGORY } = await import(
    "../web/src/lib/money"
  );
  const members = [
    { id: "a", name: "甲", english_name: "A" },
    { id: "b", name: "乙", english_name: "B" },
    { id: "c", name: "丙", english_name: "C" },
    { id: "d", name: "丁", english_name: "D" },
  ];
  const expense = (
    id: string,
    payer: string,
    amount: number,
    participants: string[],
    category = "其他",
  ) => ({
    id,
    payer_id: payer,
    title: id,
    amount,
    currency: "CNY" as const,
    category,
    date: "2026-09-25",
    participants,
    note: "",
    source: "手动",
    version: 1,
  });
  const dinner = summarizeInCny(
    [expense("dinner", "a", 20000, ["a", "b"])],
    members.slice(0, 2),
  );
  assert.equal(dinner.total, 20000);
  assert.equal(dinner.rows.find((row) => row.id === "a")?.balance, 10000);
  assert.equal(dinner.rows.find((row) => row.id === "b")?.balance, -10000);
  const afterPay = summarizeInCny(
    [
      expense("dinner", "a", 20000, ["a", "b"]),
      expense("pay", "b", 4000, ["a"], TRANSFER_CATEGORY),
    ],
    members.slice(0, 2),
  );
  assert.equal(afterPay.total, 20000);
  assert.equal(afterPay.rows.find((row) => row.id === "a")?.paid, 20000);
  assert.equal(afterPay.rows.find((row) => row.id === "a")?.share, 10000);
  assert.equal(afterPay.rows.find((row) => row.id === "a")?.balance, 6000);
  assert.equal(afterPay.rows.find((row) => row.id === "b")?.balance, -6000);
  assert.deepEqual(suggestSettlements(afterPay.rows), [
    { from: "b", to: "a", amount: 6000 },
  ]);
  const four = summarizeInCny(
    [
      expense("one", "a", 10000, ["a"]),
      expense("two", "b", 5000, ["b"]),
      expense("three", "c", 8000, ["a"]),
      expense("four", "d", 7000, ["a"]),
    ],
    members,
  );
  assert.equal(four.total, 30000);
  const payments = suggestSettlements(four.rows);
  const remain = Object.fromEntries(four.rows.map((row) => [row.id, row.balance]));
  for (const payment of payments) {
    remain[payment.from] += payment.amount;
    remain[payment.to] -= payment.amount;
  }
  assert.equal(
    Object.values(remain).every((value) => value === 0),
    true,
  );
  assert.deepEqual(payments, [
    { from: "a", to: "c", amount: 8000 },
    { from: "a", to: "d", amount: 7000 },
  ]);
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
test("日期事项不产生虚假倒计时或提前结束，未知结束时间保留当天安排", () => {
  const dated = {
    ...eventInput,
    id: "date",
    version: 1,
    kind: "explore",
    timeMode: "date",
    start: "2030-06-01T00:00:00+08:00",
    end: "2030-06-02T00:00:00+08:00",
  } as TripEvent;
  const noon = Date.parse("2030-06-01T12:00:00+08:00");
  assert.equal(selectEvents([dated], noon).current, undefined);
  assert.equal(selectEvents([dated], noon).featured?.id, "date");
  assert.equal(selectEvents([dated], noon).finished, false);
  assert.equal(selectEvents([dated], Date.parse(dated.end)).finished, true);
  const partial = {
    ...dated,
    timeMode: "timed",
    endUnspecified: true,
    end: "2030-06-01T00:00:00.001+08:00",
  } as TripEvent;
  assert.equal(selectEvents([partial], noon).featured?.id, "date");
  assert.equal(selectEvents([partial], noon).current, undefined);
});

test("事项时间支持分钟、单点、跨日跨区时间段及待定日期", async () => {
  const { resolveTiming } =
    await import("../web/src/components/editors/event/timing");
  const base = {
    date: "2030-06-01",
    endDate: "2030-06-02",
    startTime: "23:47",
    endTime: "03:12",
    timezone: "Asia/Shanghai",
    endTimezone: "Asia/Tokyo",
    timeMode: "timed" as const,
    range: false,
    firstChoice: "",
    lastChoice: "",
  };
  const single = resolveTiming(base, "explore");
  assert.equal(single.start, "2030-06-01T15:47:00.000Z");
  assert.equal(single.endUnspecified, true);
  assert.equal(single.endTimezone, "Asia/Shanghai");
  assert.equal(single.dateEnd, "2030-06-01");
  const range = resolveTiming({ ...base, range: true }, "flight");
  assert.equal(range.end, "2030-06-01T18:12:00.000Z");
  assert.equal(range.endUnspecified, false);
  assert.throws(
    () => resolveTiming({ ...base, range: true, endTime: "" }, "flight"),
    /结束时间/,
  );
  assert.throws(
    () => resolveTiming({ ...base, range: true, endDate: base.date }, "flight"),
    /晚于/,
  );
  const dated = resolveTiming(
    { ...base, startTime: "", endTime: "", timeMode: "date", range: true },
    "stay",
  );
  assert.equal(dated.end, "2030-06-01T15:00:00.000Z");
});
test("地点坐标验证与导航保持 WGS84 坐标顺序", async () => {
  const { placeSchema, mapLink, mapSearchLink, mapCopyText } = await import(
    "../shared/places"
  );
  const p = {
    id: "test",
    name: "测试地点",
    address: "Paris",
    latitude: 48.85,
    longitude: 2.29,
    provider: "geoapify",
  };
  assert.equal(placeSchema.safeParse({ ...p, latitude: 91 }).success, false);
  const dir = new URL(mapLink(placeSchema.parse(p)));
  assert.equal(dir.hostname, "www.google.com");
  assert.equal(dir.searchParams.get("destination"), "48.85,2.29");
  assert.equal(
    new URL(mapSearchLink("Wharariki Beach")).searchParams.get("query"),
    "Wharariki Beach",
  );
  assert.equal(
    mapCopyText({
      name: "Wharariki Beach",
      address: "Puponga",
      latitude: -40.5,
      longitude: 172.68,
    }),
    "Wharariki Beach\nPuponga\n-40.5, 172.68",
  );
});

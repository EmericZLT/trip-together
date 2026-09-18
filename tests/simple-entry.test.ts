import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, tripInput, eventInput } from "./support/api";
import { currencies } from "../shared/travel-options";
import { money, splitAmount } from "../web/src/lib/money";
test("多个目的地、日元泰铢持久保存，日期事项与未知结束时间可重新读取", async () => {
  const c = await new Client().register();
  const destinations = [
    { name: "东京", timezone: "Asia/Tokyo", currency: "JPY" },
    { name: "曼谷", timezone: "Asia/Bangkok", currency: "THB" },
  ];
  const { id } = await c.request(
    "/trips",
    "POST",
    { ...tripInput, currency: "JPY", destinations },
    201,
  );
  let data = await c.request(`/trips/${id}/data`);
  assert.deepEqual(data.trip.destinations, destinations);
  assert.equal(data.trip.currency, "JPY");
  for (const currency of currencies) {
    await c.request(`/trips/${id}/expenses`, "POST", {
      id: crypto.randomUUID(),
      title: "测试支出",
      amount: 10001,
      currency,
      payerId: c.id,
      date: "2030-06-01",
      participants: [c.id],
      receiptIds: [],
    });
  }
  await c.request(`/trips/${id}/events`, "POST", {
    ...eventInput,
    kind: "explore",
    timeMode: "date",
    dateEnd: "2030-06-01",
    start: "2030-06-01T00:00:00+08:00",
    end: "2030-06-02T00:00:00+08:00",
  });
  data = await c.request(`/trips/${id}/data`);
  assert.equal(data.events[0].timeMode, "date");
  assert.equal(data.expenses.length, currencies.length);
  assert.deepEqual(
    (await c.request("/bootstrap")).trips[0].destinations,
    destinations,
  );
  const split = Object.values(splitAmount(10000, ["a", "b", "c"]));
  assert.equal(
    split.reduce((a, b) => a + b),
    10000,
  );
  assert.match(money(split[0], "JPY"), /33\.34/);
});

test("地点搜索需要登录；选择的坐标持久保存并校验边界", async () => {
  await new Client().request("/places?q=Paris", "GET", undefined, 401);
  const c = await new Client().register();
  await c.request("/places?q=x", "GET", undefined, 400);
  const { id } = await c.request("/trips", "POST", tripInput, 201);
  const location = {
    id: "test-location",
    name: "测试景点",
    address: "Paris, France",
    latitude: 48.85,
    longitude: 2.29,
    countryCode: "fr",
    provider: "geoapify",
  };
  await c.request(`/trips/${id}/events`, "POST", {
    ...eventInput,
    timeRange: true,
    location,
  });
  const data = await c.request(`/trips/${id}/data`);
  assert.deepEqual(data.events[0].location, location);
  assert.equal(data.events[0].timeRange, true);
  await c.request(
    `/trips/${id}/events`,
    "POST",
    { ...eventInput, location: { ...location, latitude: 99 } },
    400,
  );
});

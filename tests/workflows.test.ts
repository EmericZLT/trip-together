import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Client,
  base,
  createTrip,
  eventInput,
  tripInput,
  png,
} from "./support/api";
test("空白注册、多行程、邀请和完整旅行录入", async () => {
  const a = await new Client().register("创建者"),
    b = await new Client().register("同行人"),
    outsider = await new Client().register("其他旅客");
  assert.equal((await a.request("/bootstrap")).trips.length, 0);
  const trip = await createTrip(a),
    other = await createTrip(outsider),
    prefix = `/trips/${trip}`;
  let data = await a.request(prefix + "/data");
  assert.equal(data.events.length, 0);
  assert.equal(data.members.length, 1);
  assert.equal(data.expenses.length, 0);
  assert.equal(data.documents.length, 0);
  assert.equal(data.preparation.length, 0);
  const invite = await a.request(prefix + "/invites", "POST", {});
  await b.request("/join", "POST", { token: invite.token });
  await b.request("/join", "POST", { token: invite.token });
  await b.request(prefix + "/invites", "POST", {}, 403);
  await outsider.request(prefix + "/data", "GET", undefined, 404);
  const d = crypto.randomUUID();
  await a.upload(prefix + `/documents/${d}?category=交通`);
  assert.deepEqual(Buffer.from(await (await b.file(d)).arrayBuffer()), png);
  await outsider.file(d, 404);
  const personal = `personal-${crypto.randomUUID()}`;
  await a.upload(`/personal-documents/${personal}`);
  await b.file(personal, 404);
  await outsider.file(personal, 404);
  await a.upload("/avatar");
  assert.equal(
    (
      await fetch(`${base}/api/avatars/${a.id}`, {
        headers: { Cookie: b.cookie },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(`${base}/api/avatars/${a.id}`, {
        headers: { Cookie: outsider.cookie },
      })
    ).status,
    404,
  );
  const evt = await a.request(prefix + "/events", "POST", {
    ...eventInput,
    documents: [d],
  });
  data = await a.request(prefix + "/data");
  assert.equal(data.events[0].title, eventInput.title);
  await b.request(prefix + `/events/${evt.id}`, "PUT", {
    ...eventInput,
    title: "已修改航班",
    documents: [d],
    version: 1,
  });
  await a.request(
    prefix + `/events/${evt.id}`,
    "PUT",
    { ...eventInput, version: 1 },
    409,
  );
  await outsider.request(
    `/trips/${other}/events/${evt.id}`,
    "PUT",
    { ...eventInput, version: 2 },
    409,
  );
  const item = await a.request(prefix + "/preparation", "POST", {
    group_name: "行李",
    title: "雨伞",
  });
  await b.request(prefix + "/packing", "PUT", {
    itemId: item.id,
    checked: true,
  });
  assert.deepEqual((await a.request(prefix + "/data")).packing, []);
  assert.deepEqual((await b.request(prefix + "/data")).packing, [item.id]);
  const receipt = crypto.randomUUID();
  await a.upload(prefix + `/receipts/${receipt}`);
  await b.file(receipt, 404);
  const pending = await a.request(prefix + "/pending-costs", "POST", {
    title: "住宿预订",
    amount: 0,
    currency: "EUR",
    document_id: d,
  });
  const expense = {
    id: crypto.randomUUID(),
    title: "住宿费用",
    amount: 10001,
    currency: "EUR",
    date: "2030-06-01",
    payerId: b.id,
    participants: [a.id, b.id],
    note: "",
    pendingId: pending.id,
    receiptIds: [receipt],
  };
  await a.request(prefix + "/expenses", "POST", expense);
  await a.request(prefix + "/expenses", "POST", expense);
  await b.file(receipt);
  data = await b.request(prefix + "/data");
  assert.equal(data.expenses.length, 1);
  assert.equal(data.expenses[0].created_by, a.id);
  assert.equal(data.pendingCosts.length, 0);
  assert.ok(!data.documents.some((x: { id: string }) => x.id === personal));
  assert.ok(!("passport" in data.members[0]));
  await b.request(prefix + `/expenses/${expense.id}`, "PUT", {
    ...expense,
    amount: 9001,
    version: 1,
  });
  await a.request(
    prefix + `/expenses/${expense.id}`,
    "PUT",
    { ...expense, version: 1 },
    409,
  );
  await outsider.request(
    `/trips/${other}/expenses/${expense.id}`,
    "PUT",
    {
      ...expense,
      participants: [outsider.id],
      payerId: outsider.id,
      version: 2,
    },
    404,
  );
  await outsider.request(
    `/trips/${other}/expenses`,
    "POST",
    {
      ...expense,
      id: crypto.randomUUID(),
      participants: [outsider.id],
      payerId: outsider.id,
      pendingId: undefined,
    },
    403,
  );
  await b.request(prefix + `/expenses/${expense.id}`, "DELETE", { version: 2 });
  assert.equal((await a.request(prefix + "/data")).pendingCosts.length, 1);
  await b.file(receipt, 404);
  await a.file(receipt);
  await a.request(prefix + `/documents/${d}`, "DELETE");
  assert.deepEqual((await a.request(prefix + "/data")).events[0].documents, []);
  await a.file(d, 404);
  await a.request(prefix + "/invites", "DELETE");
  await outsider.request("/join", "POST", { token: invite.token }, 404);
  await b.request(prefix, "DELETE", { title: tripInput.title }, 403);
  await a.request(prefix, "DELETE", { title: tripInput.title });
  await b.request(prefix + "/data", "GET", undefined, 404);
  await a.file(personal);
  await a.file(receipt, 404);
  await outsider.request(`/trips/${other}`, "DELETE", {
    title: tripInput.title,
  });
  await a.request(`/personal-documents/${personal}`, "DELETE");
  await a.request("/avatar", "DELETE");
});
test("同行人数不再限制为六人，并发账本修改只接受一个版本", async () => {
  const a = await new Client().register(),
    trip = await createTrip(a),
    p = `/trips/${trip}`;
  const token = (await a.request(p + "/invites", "POST", {})).token,
    ids = [a.id];
  for (let i = 0; i < 6; i++) {
    const c = await new Client().register();
    await c.request("/join", "POST", { token });
    ids.push(c.id);
  }
  const expense = {
    id: crypto.randomUUID(),
    title: "七人晚餐",
    amount: 100,
    currency: "CNY",
    date: "2030-06-01",
    payerId: a.id,
    participants: ids,
    note: "",
  };
  await a.request(p + "/expenses", "POST", expense);
  const statuses = await Promise.all(
    [1, 2].map((n) =>
      fetch(`${base}/api${p}/expenses/${expense.id}`, {
        method: "PUT",
        headers: {
          Origin: base,
          Cookie: a.cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...expense, amount: 100 + n, version: 1 }),
      }).then((r) => r.status),
    ),
  );
  assert.deepEqual(statuses.sort(), [200, 409]);
  await a.request(p, "DELETE", { title: tripInput.title });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, base, createTrip, tripInput, eventInput } from "./support/api";
test("认证、大小写密码、CSRF、邮箱重置密码与会话注销", async () => {
  const a = await new Client().register();
  const original = a.cookie;
  const attacker = new Client();
  await attacker.request("/bootstrap", "GET", undefined, 401);
  await attacker.request(
    "/login",
    "POST",
    { email: a.email, password: a.password.toLowerCase() },
    401,
  );
  const cross = await fetch(base + "/api/trips", {
    method: "POST",
    headers: {
      Origin: "https://example.invalid",
      Cookie: a.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tripInput),
  });
  assert.equal(cross.status, 403);
  const unsigned = await fetch(base + "/api/bootstrap", {
    headers: { Cookie: a.cookie.split(".")[0] },
  });
  assert.equal(unsigned.status, 401);
  await a.request("/logout", "POST", {});
  a.cookie = original;
  await a.request("/bootstrap", "GET", undefined, 401);
  await a.request("/login", "POST", {
    email: a.email,
    password: a.password,
  });
  const profile = (await a.request("/bootstrap")).me;
  await a.request("/profile", "PUT", {
    ...profile,
    name: "新姓名",
    passport: "TEST-PASSPORT",
    identity_number: "TEST-ID",
    expiry: "2035-01-01",
  });
  await a.request("/profile", "PUT", profile, 409);
  const newPassword = `New-${crypto.randomUUID()}`;
  await a.request("/recover", "POST", {
    email: a.email,
    password: newPassword,
  });
  await a.request("/bootstrap", "GET", undefined, 401);
  await a.request("/login", "POST", {
    email: a.email,
    password: newPassword,
  });
  await a.request("/password", "PUT", {
    currentPassword: newPassword,
    password: a.password,
  });
  await a.request("/bootstrap", "GET", undefined, 401);
  await a.request("/login", "POST", {
    email: a.email,
    password: a.password,
  });
});
test("不能跨行程关联文件、预订、清单或他人私有文件", async () => {
  const a = await new Client().register(),
    trip = await createTrip(a),
    other = await createTrip(a),
    p = `/trips/${trip}`,
    q = `/trips/${other}`;
  const d = crypto.randomUUID();
  await a.upload(p + `/documents/${d}`);
  await a.request(
    q + "/events",
    "POST",
    { ...eventInput, documents: [d] },
    400,
  );
  const personal = crypto.randomUUID();
  await a.upload(p + `/documents/${personal}?private=1`);
  const privateEvent = await a.request(p + "/events", "POST", {
    ...eventInput,
    documents: [personal],
  });
  const b = await new Client().register();
  const invitation = await a.request(p + "/invites", "POST", {});
  await b.request("/join", "POST", { token: invitation.token });
  assert.deepEqual((await b.request(p + "/data")).events[0].documents, []);
  await b.request(p + `/events/${privateEvent.id}`, "PUT", {
    ...eventInput,
    version: 1,
  });
  assert.deepEqual((await a.request(p + "/data")).events[0].documents, [
    personal,
  ]);
  const item = await a.request(p + "/preparation", "POST", {
    group_name: "测试",
    title: "测试事项",
  });
  await a.request(
    q + "/packing",
    "PUT",
    { itemId: item.id, checked: true },
    400,
  );
  await a.request(p + "/pending-costs", "POST", {}, 404);
  await a.request(p, "DELETE", { title: tripInput.title });
  await a.request(q, "DELETE", { title: tripInput.title });
});
test("登录频率限制与输入校验", async () => {
  const a = new Client();
  for (let i = 0; i < 20; i++)
    await a.request(
      "/login",
      "POST",
      { email: "missing@example.test", password: "invalid-test-password" },
      401,
    );
  await a.request(
    "/login",
    "POST",
    { email: "missing@example.test", password: "invalid-test-password" },
    429,
  );
  const b = await new Client().register();
  await b.request(
    "/trips",
    "POST",
    { ...tripInput, timezone: "invalid-zone" },
    400,
  );
  await b.request(
    "/trips",
    "POST",
    { ...tripInput, end_date: "2020-01-01" },
    400,
  );
});
test("无行程账号可管理昵称与私人文件，bootstrap 不包含他人文件", async () => {
  const a = await new Client().register(),
    b = await new Client().register();
  const before = await a.request("/bootstrap");
  assert.equal(before.me.name, "旅行者");
  assert.deepEqual(before.trips, []);
  const personal = `personal-${crypto.randomUUID()}`;
  await a.upload(`/personal-documents/${personal}`);
  const own = await a.request("/bootstrap"),
    other = await b.request("/bootstrap");
  assert.equal(own.documents.length, 1);
  assert.equal(own.documents[0].id, personal);
  assert.equal(own.documents[0].owner_id, a.id);
  assert.equal("r2_key" in own.documents[0], false);
  assert.deepEqual(other.documents, []);
  await b.file(personal, 404);
  await a.request("/profile", "PUT", { ...own.me, name: "新的昵称" });
  assert.equal((await a.request("/bootstrap")).me.name, "新的昵称");
});

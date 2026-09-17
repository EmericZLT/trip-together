import assert from "node:assert/strict";
export const base = process.env.TEST_BASE_URL ?? "http://localhost:8791";
export const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6l9sAAAAASUVORK5CYII=",
  "base64",
);
export class Client {
  cookie = "";
  ip = `192.0.2.${Math.floor(Math.random() * 250) + 1}-${crypto.randomUUID()}`;
  id = "";
  email = `u${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}@example.test`;
  password = `Test-${crypto.randomUUID()}`;
  async request(path: string, method = "GET", data?: unknown, expected = 200) {
    const r = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        Cookie: this.cookie,
        "CF-Connecting-IP": this.ip,
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    const value = await r.json();
    assert.equal(
      r.status,
      expected,
      `${method} ${path}: ${JSON.stringify(value)}`,
    );
    const cookie = r.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    return value;
  }
  async register(name?: string) {
    await this.request("/register", "POST", {
      email: this.email,
      password: this.password,
    });
    const me = (await this.request("/bootstrap")).me;
    this.id = me.id;
    if (name) await this.request("/profile", "PUT", { ...me, name });
    return this;
  }
  async upload(path: string, expected = 200) {
    const r = await fetch(`${base}/api${path}`, {
      method: "PUT",
      headers: {
        Origin: base,
        Cookie: this.cookie,
        "Content-Type": "image/png",
        "X-File-Name": encodeURIComponent("测试图片.png"),
      },
      body: png,
    });
    assert.equal(r.status, expected, await r.text());
  }
  async file(id: string, expected = 200) {
    const r = await fetch(`${base}/api/files/${id}`, {
      headers: { Cookie: this.cookie },
    });
    assert.equal(r.status, expected);
    return r;
  }
}
export const tripInput = {
  title: "测试旅行",
  start_date: "2030-06-01",
  end_date: "2030-06-10",
  timezone: "Europe/Paris",
  home_timezone: "Asia/Shanghai",
  currency: "EUR",
  home_currency: "CNY",
};
export const eventInput = {
  title: "测试航班",
  subtitle: "用户填写的航程",
  kind: "flight",
  start: "2030-06-01T09:00:00+08:00",
  end: "2030-06-01T12:00:00+02:00",
  timezone: "Asia/Shanghai",
  endTimezone: "Europe/Paris",
  certainty: "confirmed",
  place: "测试机场",
  from: "出发机场",
  to: "到达机场",
  source: "自行录入",
  note: "携带行李",
  documents: [],
};
export async function createTrip(c: Client) {
  return (await c.request("/trips", "POST", tripInput, 201)).id as string;
}

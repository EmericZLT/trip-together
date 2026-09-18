export const currencies = [
  "CNY",
  "JPY",
  "THB",
  "KRW",
  "HKD",
  "TWD",
  "SGD",
  "MYR",
  "VND",
  "IDR",
  "PHP",
  "NZD",
  "AUD",
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "CHF",
  "AED",
  "INR",
] as const;
export type Currency = (typeof currencies)[number];
export const currencyNames: Record<Currency, string> = {
  CNY: "人民币",
  JPY: "日元",
  THB: "泰铢",
  KRW: "韩元",
  HKD: "港币",
  TWD: "新台币",
  SGD: "新加坡元",
  MYR: "马来西亚林吉特",
  VND: "越南盾",
  IDR: "印尼盾",
  PHP: "菲律宾比索",
  NZD: "新西兰元",
  AUD: "澳元",
  USD: "美元",
  EUR: "欧元",
  GBP: "英镑",
  CAD: "加拿大元",
  CHF: "瑞士法郎",
  AED: "阿联酋迪拉姆",
  INR: "印度卢比",
};
export type Destination = {
  name: string;
  timezone: string;
  currency: Currency;
};
const cities: [string, string, Currency][] = [
  ["北京 / 上海 · 中国", "Asia/Shanghai", "CNY"],
  ["东京 / 大阪 · 日本", "Asia/Tokyo", "JPY"],
  ["曼谷 / 清迈 / 普吉 · 泰国", "Asia/Bangkok", "THB"],
  ["首尔 · 韩国", "Asia/Seoul", "KRW"],
  ["香港 · 中国", "Asia/Hong_Kong", "HKD"],
  ["台北 · 中国台湾", "Asia/Taipei", "TWD"],
  ["新加坡", "Asia/Singapore", "SGD"],
  ["吉隆坡 · 马来西亚", "Asia/Kuala_Lumpur", "MYR"],
  ["河内 / 胡志明市 · 越南", "Asia/Ho_Chi_Minh", "VND"],
  ["巴厘岛 · 印度尼西亚", "Asia/Makassar", "IDR"],
  ["雅加达 · 印度尼西亚", "Asia/Jakarta", "IDR"],
  ["马尼拉 · 菲律宾", "Asia/Manila", "PHP"],
  ["奥克兰 / 皇后镇 · 新西兰", "Pacific/Auckland", "NZD"],
  ["悉尼 / 墨尔本 · 澳大利亚", "Australia/Sydney", "AUD"],
  ["布里斯班 · 澳大利亚", "Australia/Brisbane", "AUD"],
  ["珀斯 · 澳大利亚", "Australia/Perth", "AUD"],
  ["阿德莱德 · 澳大利亚", "Australia/Adelaide", "AUD"],
  ["伦敦 · 英国", "Europe/London", "GBP"],
  ["巴黎 · 法国", "Europe/Paris", "EUR"],
  ["罗马 · 意大利", "Europe/Rome", "EUR"],
  ["柏林 · 德国", "Europe/Berlin", "EUR"],
  ["马德里 · 西班牙", "Europe/Madrid", "EUR"],
  ["雅典 · 希腊", "Europe/Athens", "EUR"],
  ["苏黎世 · 瑞士", "Europe/Zurich", "CHF"],
  ["纽约 · 美国", "America/New_York", "USD"],
  ["洛杉矶 · 美国", "America/Los_Angeles", "USD"],
  ["芝加哥 · 美国", "America/Chicago", "USD"],
  ["丹佛 · 美国", "America/Denver", "USD"],
  ["檀香山 · 美国", "Pacific/Honolulu", "USD"],
  ["温哥华 · 加拿大", "America/Vancouver", "CAD"],
  ["多伦多 · 加拿大", "America/Toronto", "CAD"],
  ["迪拜 · 阿联酋", "Asia/Dubai", "AED"],
  ["新德里 · 印度", "Asia/Kolkata", "INR"],
];
export const destinations: Destination[] = cities.flatMap(
  ([label, timezone, currency]) => {
    const [names, country] = label.split(" · ");
    return names
      .split(" / ")
      .map((name) => ({
        name: country ? `${name} · ${country}` : name,
        timezone,
        currency,
      }));
  },
);
export function readableZone(zone: string) {
  const city = destinations.find((d) => d.timezone === zone);
  if (city) return city.name;
  if (zone === "UTC") return "世界协调时间";
  try {
    return (
      new Intl.DateTimeFormat("zh-CN", {
        timeZone: zone,
        timeZoneName: "longGeneric",
      })
        .formatToParts()
        .find((p) => p.type === "timeZoneName")?.value ?? "当地时间"
    );
  } catch {
    return "请选择当地城市";
  }
}

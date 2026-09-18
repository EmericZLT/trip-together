export type AnalyticsEnv = Env & {
  ANALYTICS_ENABLED?: string;
  ANALYTICS_HOSTNAME?: string;
  OPENPANEL_ORIGIN?: string;
  OPENPANEL_CLIENT_ID?: string;
  OPENPANEL_CLIENT_SECRET?: string;
  ANALYTICS_HASH_KEY?: string;
  ANALYTICS_READ_TOKEN?: string;
};
export function analyticsConfig(env: AnalyticsEnv) {
  if (env.APP_ENV !== "production" || env.ANALYTICS_ENABLED !== "true")
    return null;
  if (
    !env.ANALYTICS_HASH_KEY ||
    env.ANALYTICS_HASH_KEY.length < 32 ||
    !env.OPENPANEL_CLIENT_ID ||
    !env.OPENPANEL_CLIENT_SECRET ||
    !env.OPENPANEL_ORIGIN ||
    !env.ANALYTICS_HOSTNAME
  )
    return null;
  const origin = new URL(env.OPENPANEL_ORIGIN);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("Invalid analytics origin");
  if (!/^[a-z0-9.-]+$/i.test(env.ANALYTICS_HOSTNAME))
    throw new Error("Invalid analytics hostname");
  return {
    origin: origin.origin,
    clientId: env.OPENPANEL_CLIENT_ID,
    clientSecret: env.OPENPANEL_CLIENT_SECRET,
    hostname: env.ANALYTICS_HOSTNAME,
    key: env.ANALYTICS_HASH_KEY,
  };
}
export async function anonymousId(key: string, value: string) {
  const encoder = new TextEncoder();
  const secret = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", secret, encoder.encode(value));
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

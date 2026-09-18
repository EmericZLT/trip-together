import type { analyticsConfig } from "./config";

export function analyticsRequestOptions(
  config: NonNullable<ReturnType<typeof analyticsConfig>>,
  payload: unknown,
): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "TripTogether-Analytics/1.0",
      "openpanel-client-id": config.clientId,
      "openpanel-client-secret": config.clientSecret,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
    // Workers supports only follow/manual. Non-2xx is rejected by delivery.
    // Never forward client credentials to a redirect destination.
    redirect: "manual",
  };
}

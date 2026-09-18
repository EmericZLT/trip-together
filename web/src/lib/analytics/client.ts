"use client";
export type AnalyticsPage =
  | "login"
  | "register"
  | "recover"
  | "migrate"
  | "today"
  | "itinerary"
  | "documents"
  | "ledger"
  | "profile"
  | "trips";
let enabled: Promise<boolean> | undefined;
let anonymousId: string;
export function track(
  name:
    | "page_viewed"
    | "event_form_opened"
    | "event_step_viewed"
    | "document_upload_started",
  page: AnalyticsPage,
  step?: number,
) {
  // No URLs, form values, browser fingerprint, local credentials or account IDs.
  if (typeof window === "undefined" || navigator.doNotTrack === "1") return;
  try {
    if (localStorage.getItem("analytics-disabled") === "true") return;
  } catch {}
  anonymousId ??= crypto.randomUUID();
  enabled ??= fetch("/api/analytics/config")
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((r) => r.enabled === true)
    .catch(() => false);
  void enabled
    .then(async (active) => {
      if (!active) return;
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          anonymousId,
          name,
          page,
          ...(step ? { step } : {}),
        }),
        keepalive: true,
      });
    })
    .catch(() => {});
}

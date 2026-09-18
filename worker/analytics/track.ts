import { z } from "zod";
import { body, json } from "../http";
import { identity } from "../auth";
import { rateLimit } from "../security/rate-limit";
import { analyticsConfig, type AnalyticsEnv } from "./config";
const schema = z
  .object({
    id: z.string().uuid(),
    anonymousId: z.string().uuid(),
    name: z.enum([
      "page_viewed",
      "event_form_opened",
      "event_step_viewed",
      "document_upload_started",
    ]),
    page: z.enum([
      "login",
      "register",
      "recover",
      "migrate",
      "today",
      "itinerary",
      "documents",
      "ledger",
      "profile",
      "trips",
    ]),
    step: z.number().int().min(1).max(4).optional(),
  })
  .strict();
export async function trackResponse(request: Request, env: AnalyticsEnv) {
  if (!analyticsConfig(env) || request.headers.get("dnt") === "1")
    return json({ ok: true });
  const event = await body(request, schema);
  const member = await identity(request, env);
  await rateLimit(request, env, "analytics", 240, member ?? undefined);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO analytics_events(id,name,actor_id,data) VALUES (?,?,?,?)",
  )
    .bind(
      event.id,
      event.name,
      member ?? `anonymous:${event.anonymousId}`,
      JSON.stringify({
        page: event.page,
        ...(event.step ? { step: event.step } : {}),
      }),
    )
    .run();
  return json({ ok: true });
}

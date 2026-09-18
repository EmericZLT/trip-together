import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { handleApi } from "../worker/index.ts";
import { createEnv } from "./env.ts";

const port = Number(process.env.PORT || 8790);

function originAllowed(env: Env, origin: string | undefined) {
  if (!origin) return false;
  const extra = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return extra.includes(origin);
}

function corsHeaders(env: Env, request: Request) {
  const origin = request.headers.get("origin") || "";
  if (!originAllowed(env, origin) && origin !== new URL(request.url).origin)
    return new Headers();
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-File-Name",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, HEAD, OPTIONS",
    Vary: "Origin",
  });
}

function withCors(env: Env, request: Request, response: Response) {
  const headers = new Headers(response.headers);
  corsHeaders(env, request).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

async function toRequest(req: IncomingMessage, host: string): Promise<Request> {
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const url = new URL(req.url || "/", `${proto}://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const method = req.method || "GET";
  const hasBody = !["GET", "HEAD"].includes(method);
  return new Request(url, {
    method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  } as RequestInit);
}

async function send(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (cookies.length) res.setHeader("set-cookie", cookies);
  if (!response.body) {
    res.end();
    return;
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function main() {
  const env = await createEnv();
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host || `127.0.0.1:${port}`;
      const request = await toRequest(req, host);
      if (request.method === "OPTIONS") {
        await send(
          res,
          withCors(
            env,
            request,
            new Response(null, { status: 204, headers: corsHeaders(env, request) }),
          ),
        );
        return;
      }
      if (new URL(request.url).pathname === "/health") {
        await send(res, withCors(env, request, Response.json({ ok: true })));
        return;
      }
      await send(res, withCors(env, request, await handleApi(request, env)));
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "服务暂时不可用，请稍后重试" }));
    }
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`trip-together API listening on ${port}`);
  });
}

void main();

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { Miniflare } from "miniflare";

test("真实 Worker 运行时可以构造分析请求，且禁止自动转发凭据", async () => {
  const contents = stripTypeScriptTypes(
    await readFile("worker/analytics/request.ts", "utf8"),
  );
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: "analytics-request-runtime",
          type: "worker",
          compatibilityDate: "2026-09-17",
          manifest: {
            mainModule: "index.js",
            modules: {
              "request.js": { type: "esm", contents },
              "index.js": {
                type: "esm",
                contents: `
        import { analyticsRequestOptions } from './request.js';
        export default { async fetch() {
          const config = {clientId:'test-client',clientSecret:'test-secret'};
          const options = analyticsRequestOptions(config, {type:'track',payload:{name:'integration_check'}});
          // Actual workerd Request validation; a Node mock would miss unsupported redirect modes.
          const request = new Request('https://analytics.example.test/track', options);
          return Response.json({redirect:request.redirect,method:request.method,
            clientId:request.headers.get('openpanel-client-id'),body:await request.json()});
        }};`,
              },
            },
          },
        },
      },
    ],
  });
  try {
    const response = await mf.dispatchFetch("https://example.test");
    assert.equal(response.status, 200);
    const body = (await response.json()) as Record<string, any>;
    assert.equal(body.redirect, "manual");
    assert.equal(body.method, "POST");
    assert.equal(body.clientId, "test-client");
    assert.equal(body.body.payload.name, "integration_check");
  } finally {
    await mf.dispose();
  }
});

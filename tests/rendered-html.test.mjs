import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the MORPH Phase 6 adaptive compiler shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>MORPH \| Accessible runtime observatory<\/title>/i);
  assert.match(html, /Chaotic source/);
  assert.match(html, /MORPH runtime/);
  assert.match(html, /Low Vision/);
  assert.match(html, /One-Switch Motor/);
  assert.match(html, /Cognitive Load Reduction/);
  assert.match(html, /Agent Observatory/);
  assert.match(html, /Constraint ledger/);
  assert.match(html, /Under \u20B98,000/);
  assert.match(html, /Compiled adaptive surface/);
  assert.match(html, /Phase 8 \| durable SSE \+ redacted evidence/);
  assert.match(html, /data-adaptive-compiler="true"/);
  assert.match(html, /data-presentation-mode="one-switch"/);
  assert.match(html, /data-action-step-id="30000000-0000-4000-8000-000000000001"/);
  assert.match(html, /Every action enters RISK_GATE before one browser step can execute/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("publishes comparison, adaptive, and observatory landmarks", async () => {
  const html = await (await render()).text();

  assert.match(html, /<main\b/i);
  assert.match(html, /<header\b/i);
  assert.match(html, /<footer\b/i);
  assert.match(html, /aria-label="Source portal and MORPH comparison"/i);
  assert.match(html, /aria-labelledby="source-pane-title"/i);
  assert.match(html, /aria-labelledby="morph-pane-title"/i);
  assert.match(html, /role="tablist"/i);
  assert.match(html, /aria-labelledby="adaptive-surface-title"/i);
  assert.match(html, /aria-labelledby="observatory-title"/i);
  assert.match(html, /<iframe\b/i);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createHealthPayload, service } from "./index.js";

test("browser-worker exposes its Phase 5 execution boundary", () => {
  const health = createHealthPayload({});

  assert.equal(health.service, service.name);
  assert.equal(health.status, "ready");
  assert.equal(health.phase, 5);
  assert.equal(health.port, service.defaultPort);
});

test("browser-worker accepts an explicit positive port", () => {
  const health = createHealthPayload({ [service.portEnvironmentVariable]: "9100" });
  assert.equal(health.port, 9100);
});

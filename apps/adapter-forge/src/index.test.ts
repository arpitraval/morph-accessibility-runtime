import assert from "node:assert/strict";
import test from "node:test";
import { createHealthPayload, service } from "./index.js";

test("adapter-forge exposes deterministic Phase 7 health", () => {
  const health = createHealthPayload({});

  assert.equal(health.service, service.name);
  assert.equal(health.status, "ready");
  assert.equal(health.phase, 7);
  assert.equal(health.port, service.defaultPort);
});

test("adapter-forge accepts an explicit positive port", () => {
  const health = createHealthPayload({ [service.portEnvironmentVariable]: "9100" });
  assert.equal(health.port, 9100);
});

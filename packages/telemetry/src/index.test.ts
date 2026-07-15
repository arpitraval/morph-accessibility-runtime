import assert from "node:assert/strict";
import test from "node:test";
import { packageDescriptor } from "./index.js";

test("telemetry publishes its frozen Phase 1 seam", () => {
  assert.equal(packageDescriptor.name, "@morph/telemetry");
  assert.equal(packageDescriptor.phase, 1);
  assert.equal(packageDescriptor.status, "scaffolded");
  assert.ok(packageDescriptor.responsibility.length > 20);
});

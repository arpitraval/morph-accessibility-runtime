import assert from "node:assert/strict";
import test from "node:test";
import { packageDescriptor } from "./index.js";

test("agents publishes its Phase 4 intelligence boundary", () => {
  assert.equal(packageDescriptor.name, "@morph/agents");
  assert.equal(packageDescriptor.phase, 4);
  assert.equal(packageDescriptor.status, "implemented");
  assert.match(packageDescriptor.responsibility, /GPT-5\.6 Sol/);
});

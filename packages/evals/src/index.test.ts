import assert from "node:assert/strict";
import test from "node:test";
import { packageDescriptor } from "./index.js";

test("evals publishes its Phase 9 evaluation boundary", () => {
  assert.equal(packageDescriptor.name, "@morph/evals");
  assert.equal(packageDescriptor.phase, 9);
  assert.equal(packageDescriptor.status, "implemented");
  assert.ok(packageDescriptor.responsibility.length > 20);
});

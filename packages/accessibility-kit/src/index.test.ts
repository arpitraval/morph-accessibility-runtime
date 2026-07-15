import assert from "node:assert/strict";
import test from "node:test";
import {
  AdaptiveButton,
  AdaptiveList,
  AdaptiveModal,
  AdaptiveText,
  orderAdaptiveComponents,
  packageDescriptor,
} from "./index.js";

test("accessibility-kit publishes its Phase 6 compiler grammar", () => {
  assert.equal(packageDescriptor.name, "@morph/accessibility-kit");
  assert.equal(packageDescriptor.phase, 6);
  assert.equal(packageDescriptor.status, "implemented");
});

test("adaptive components use stable order and id tie-breaking", () => {
  const components = orderAdaptiveComponents([
    {
      id: "second",
      kind: "ACTION",
      order: 2,
      label: "Second",
      description: null,
      importance: "SECONDARY",
      enabled: true,
    },
    {
      id: "alpha",
      kind: "STATUS",
      order: 1,
      label: "Alpha",
      description: null,
      importance: "CONTEXT",
      enabled: true,
    },
    {
      id: "beta",
      kind: "STATUS",
      order: 1,
      label: "Beta",
      description: null,
      importance: "CONTEXT",
      enabled: true,
    },
  ]);

  assert.deepEqual(components.map((component) => component.id), ["alpha", "beta", "second"]);
});


test("exports the complete constrained component grammar", () => {
  assert.equal(typeof AdaptiveButton, "object");
  assert.equal(typeof AdaptiveList, "function");
  assert.equal(typeof AdaptiveModal, "function");
  assert.equal(typeof AdaptiveText, "function");
});
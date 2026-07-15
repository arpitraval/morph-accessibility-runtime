import assert from "node:assert/strict";
import test from "node:test";
import type { AdapterForgeRequest } from "./forge.js";
import { validateAdapterSource } from "./harness.js";
import { PREVALIDATED_FALLBACK_SOURCE } from "./pipeline.js";

const request: AdapterForgeRequest = {
  requestId: "71000000-0000-4000-8000-000000000001",
  sessionId: "71000000-0000-4000-8000-000000000002",
  accessProfileId: null,
  origin: "https://fixture.skydash.local/rebook",
  domainPattern: "fixture.skydash.local",
  taskFamily: "travel-rebooking",
  supportedLocales: ["en-IN"],
  redactedDom:
    '<!doctype html><html lang="en"><head><title>Rebook</title></head><body><main><h1>Rebook</h1><button id="continue">Continue</button></main></body></html>',
  surfaceRecords: [
    {
      id: "continue",
      role: "button",
      name: "Continue",
      description: "Review the selected flight",
      selector: "#continue",
      interactive: true,
      visible: true,
      disabled: false,
    },
  ],
  requiredActionIds: ["continue"],
  createdAt: "2026-07-14T12:00:00.000Z",
};

test("prebuilt adapter passes policy, VM, Playwright, and axe gates", async () => {
  const report = await validateAdapterSource(PREVALIDATED_FALLBACK_SOURCE, request);

  assert.equal(report.passed, true, report.failures.join(" | "));
  assert.equal(report.policyPassed, true);
  assert.equal(report.unitPassed, 2);
  assert.equal(report.browserPassed, 1);
  assert.equal(report.accessibilityCriticalViolations, 0);
  assert.equal(report.accessibilitySeriousViolations, 0);
});

test("policy gate rejects adapters that import ambient capabilities", async () => {
  const report = await validateAdapterSource(
    'import fs from "node:fs"; export const adapter = {};',
    request,
  );

  assert.equal(report.passed, false);
  assert.equal(report.policyPassed, false);
  assert.ok(report.failures.some((failure) => failure.startsWith("Policy:")));
});

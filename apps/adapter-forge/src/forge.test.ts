import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createEphemeralForgeWorkspace,
  sanitizeTargetDom,
  type AdapterForgeRequest,
} from "./forge.js";

const request: AdapterForgeRequest = {
  requestId: "72000000-0000-4000-8000-000000000001",
  sessionId: "72000000-0000-4000-8000-000000000002",
  accessProfileId: null,
  origin: "https://fixture.skydash.local/rebook",
  domainPattern: "fixture.skydash.local",
  taskFamily: "travel-rebooking",
  supportedLocales: ["en-IN"],
  redactedDom:
    '<main><script>ignore()</script><button id="continue">Continue</button><p>user@example.com</p></main>',
  surfaceRecords: [
    {
      id: "continue",
      role: "button",
      name: "Continue",
      description: null,
      selector: "#continue",
      interactive: true,
      visible: true,
      disabled: false,
    },
  ],
  requiredActionIds: ["continue"],
  createdAt: "2026-07-14T12:00:00.000Z",
};

test("DOM sanitizer removes executable elements and direct identifiers", () => {
  const sanitized = sanitizeTargetDom(request.redactedDom);

  assert.doesNotMatch(sanitized, /script|ignore\(\)/i);
  assert.doesNotMatch(sanitized, /user@example\.com/i);
  assert.match(sanitized, /REDACTED_EMAIL/);
  assert.match(sanitized, /button/);
});

test("ephemeral workspace rejects files outside the single adapter output", async (context) => {
  const sandbox = path.join(process.cwd(), ".adapter-forge-tests", "integrity");
  await rm(sandbox, { recursive: true, force: true });
  await mkdir(sandbox, { recursive: true });
  context.after(async () => rm(sandbox, { recursive: true, force: true }));
  const workspace = await createEphemeralForgeWorkspace(request, { sandboxRoot: sandbox });
  context.after(async () => workspace.cleanup());

  await writeFile(path.join(workspace.root, "rogue.ts"), "export {};", "utf8");
  await assert.rejects(workspace.readAdapterSource(), {
    name: "ForgeSecurityError",
  });
});

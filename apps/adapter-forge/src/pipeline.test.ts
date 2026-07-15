import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type {
  AdapterForgeRequest,
  AdapterGenerator,
  ForgeStatusEvent,
} from "./forge.js";
import {
  Ed25519ArtifactSigner,
  PREVALIDATED_FALLBACK_SOURCE,
  forgeAdapter,
  type AdapterEmbeddingProvider,
  type AdapterPublisher,
  type VerifiedAdapterArtifact,
} from "./pipeline.js";
import type { ForgeTestReport } from "./harness.js";

const request: AdapterForgeRequest = {
  requestId: "70000000-0000-4000-8000-000000000001",
  sessionId: "70000000-0000-4000-8000-000000000002",
  accessProfileId: "70000000-0000-4000-8000-000000000003",
  origin: "https://fixture.skydash.local/rebook",
  domainPattern: "fixture.skydash.local",
  taskFamily: "travel-rebooking",
  supportedLocales: ["en-IN"],
  redactedDom: '<main><h1>Rebook</h1><button id="continue">Continue</button></main>',
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

const passedReport: ForgeTestReport = {
  passed: true,
  unitPassed: 2,
  browserPassed: 1,
  accessibilityCriticalViolations: 0,
  accessibilitySeriousViolations: 0,
  policyPassed: true,
  failures: [],
};

const failedReport: ForgeTestReport = {
  passed: false,
  unitPassed: 0,
  browserPassed: 0,
  accessibilityCriticalViolations: 0,
  accessibilitySeriousViolations: 0,
  policyPassed: false,
  failures: ["Policy: invalid generated adapter."],
};

function signer(): Ed25519ArtifactSigner {
  const pair = generateKeyPairSync("ed25519");
  return new Ed25519ArtifactSigner({
    privateKeyPem: pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    keyId: "test-key-v1",
  });
}

class FakeEmbeddingProvider implements AdapterEmbeddingProvider {
  public readonly model = "deterministic-test-embedding";
  public async embedRoutingText(): Promise<readonly number[]> {
    return Array.from({ length: 1536 }, (_, index) => index / 1536);
  }
}

class RecordingPublisher implements AdapterPublisher {
  public readonly artifacts: VerifiedAdapterArtifact[] = [];
  public async publish(artifact: VerifiedAdapterArtifact): Promise<void> {
    this.artifacts.push(artifact);
  }
}

async function sandboxRoot(name: string): Promise<string> {
  const root = path.join(process.cwd(), ".adapter-forge-tests", name);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  return root;
}

test("pipeline repairs once, verifies, signs, and publishes generated code", async (context) => {
  const root = await sandboxRoot("repair");
  context.after(async () => rm(root, { recursive: true, force: true }));
  const validSource = "export const adapter = { valid: true };";
  const generator: AdapterGenerator = {
    async open(workspace) {
      return {
        async generate() {
          await writeFile(workspace.adapterPath, "export const adapter = null;", "utf8");
        },
        async repair() {
          await writeFile(workspace.adapterPath, validSource, "utf8");
        },
      };
    },
  };
  const publisher = new RecordingPublisher();
  const events: ForgeStatusEvent[] = [];

  const result = await forgeAdapter(request, {
    generator,
    signer: signer(),
    embeddingProvider: new FakeEmbeddingProvider(),
    publisher,
    sandboxRoot: root,
    createId: () => "70000000-0000-4000-8000-000000000010",
    now: () => new Date("2026-07-14T12:00:05.000Z"),
    validate: async (source) => source === validSource ? passedReport : failedReport,
    statusSink: (event) => {
      events.push(event);
    },
  });

  assert.equal(result.usedFallback, false);
  assert.equal(result.attemptsUsed, 2);
  assert.equal(result.artifact.provenance, "CODEX_GENERATED");
  assert.equal(result.artifact.embedding.length, 1536);
  assert.equal(publisher.artifacts.length, 1);
  assert.ok(events.some((event) => event.type === "ADAPTER_FORGE_REPAIRING"));
  assert.equal(events.at(-1)?.type, "ADAPTER_FORGE_PUBLISHED");
});

test("pipeline falls back deterministically when the Codex session cannot open", async (context) => {
  const root = await sandboxRoot("fallback");
  context.after(async () => rm(root, { recursive: true, force: true }));
  const generator: AdapterGenerator = {
    async open() {
      throw new Error("Codex unavailable in deterministic test.");
    },
  };
  const publisher = new RecordingPublisher();
  const events: ForgeStatusEvent[] = [];

  const result = await forgeAdapter(request, {
    generator,
    signer: signer(),
    embeddingProvider: new FakeEmbeddingProvider(),
    publisher,
    sandboxRoot: root,
    createId: () => "70000000-0000-4000-8000-000000000011",
    validate: async (source) =>
      source === PREVALIDATED_FALLBACK_SOURCE ? passedReport : failedReport,
    statusSink: (event) => {
      events.push(event);
    },
  });

  assert.equal(result.usedFallback, true);
  assert.equal(result.artifact.provenance, "PREBUILT_FALLBACK");
  assert.ok(events.some((event) => event.type === "ADAPTER_FORGE_FALLBACK"));
  assert.equal(publisher.artifacts.length, 1);
});

test("pipeline stops safely when generated and prebuilt adapters both fail validation", async (context) => {
  const root = await sandboxRoot("stop-safe");
  context.after(async () => rm(root, { recursive: true, force: true }));
  const generator: AdapterGenerator = {
    async open() {
      throw new Error("Codex unavailable in deterministic test.");
    },
  };
  const publisher = new RecordingPublisher();
  const events: ForgeStatusEvent[] = [];

  await assert.rejects(
    forgeAdapter(request, {
      generator,
      signer: signer(),
      embeddingProvider: new FakeEmbeddingProvider(),
      publisher,
      sandboxRoot: root,
      validate: async () => failedReport,
      statusSink: (event) => {
        events.push(event);
      },
    }),
    { name: "AdapterForgeStoppedSafeError" },
  );
  assert.equal(publisher.artifacts.length, 0);
  assert.equal(events.at(-1)?.type, "ADAPTER_FORGE_STOPPED_SAFE");
});

test("generated artifact ids can be supplied by a cryptographic id source", () => {
  assert.match(randomUUID(), /^[a-f0-9-]{36}$/);
});

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createExecutionEngine, ExecutionPolicyError } from "./executor.js";
import { captureAndVerify, verificationToMachineSignal } from "./verifier.js";
import { PlaywrightBrowserWorker } from "./worker.js";
import type { ActionStep } from "@morph/contracts";

const PORTAL_DIST = fileURLToPath(new URL("../../demo-portal/dist/", import.meta.url));

const CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
});

async function startFixtureServer(): Promise<{ server: Server; origin: string }> {
  const root = resolve(PORTAL_DIST);
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://fixture.invalid").pathname;
      let filePath = resolve(root, `.${pathname}`);
      if (!filePath.startsWith(`${root}${sep}`) && filePath !== root) {
        response.writeHead(403).end();
        return;
      }
      if (pathname === "/" || (await stat(filePath).catch(() => null))?.isDirectory()) {
        filePath = join(root, "index.html");
      }
      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Fixture server did not expose a TCP port.");
  }
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function stopFixtureServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error === undefined ? resolveClose() : reject(error)));
  });
}

function findSkyDashChooseTarget(
  records: Awaited<ReturnType<PlaywrightBrowserWorker["readSurfaceRecords"]>>["records"],
): string {
  const byId = new Map(records.map((record) => [record.recordId, record]));
  const candidates = records.filter(
    (record) => record.visible && record.name?.trim().toLocaleLowerCase() === "choose",
  );
  for (const candidate of candidates) {
    let parentId = candidate.parentRecordId;
    while (parentId !== null) {
      const parent = byId.get(parentId);
      if (parent === undefined) break;
      const name = parent.name ?? "";
      if (name.includes("SD-482") && !name.includes("SD-211") && !name.includes("SD-903")) {
        return candidate.recordId;
      }
      parentId = parent.parentRecordId;
    }
  }
  throw new Error("Could not identify the SkyDash choose control from normalized DOM evidence.");
}

test(
  "executes one real portal click and catches a fresh-state verification mismatch",
  { timeout: 90_000 },
  async () => {
    const fixture = await startFixtureServer();
    const profile = await mkdtemp(join(tmpdir(), "morph-browser-worker-test-"));
    const sessionId = randomUUID();
    const worker = await PlaywrightBrowserWorker.launch({
      userDataDir: profile,
      allowedOrigins: [fixture.origin],
      headless: true,
    });

    try {
      await worker.open(`${fixture.origin}/?variant=0`);
      const before = await worker.captureFreshState();
      const dom = await worker.readSurfaceRecords({
        snapshotId: before.snapshotId,
        channel: "DOM",
        cursor: 0,
        limit: 500,
      });
      const targetNodeId = findSkyDashChooseTarget(dom.records);
      const authority = {
        async readAuthorization(actionStep: ActionStep) {
          return {
            sessionId,
            workflowState: "EXECUTE_ONE_STEP" as const,
            currentPageVersion: actionStep.pageVersion,
            simulationPassed: true,
            consentTransitionObserved: false,
            consentRecord: null,
          };
        },
      };
      const engine = createExecutionEngine(worker, authority);

      const irreversibleStep: ActionStep = {
        id: randomUUID(),
        ordinal: 1,
        targetNodeId,
        command: { kind: "SUBMIT", formPurpose: "Commit replacement booking" },
        riskClass: "R4",
        reversible: false,
        executionPolicy: "REQUIRE_CONSENT",
        preconditions: ["Fresh fare is selected"],
        expectedPostconditions: ["VISIBLE_TEXT:Booking confirmed"],
        evidenceRequirements: ["Fresh confirmation evidence"],
        compensationCommand: null,
        idempotencyKey: "phase5-consent-negative-boundary",
        pageVersion: before.pageVersion,
      };
      await assert.rejects(
        engine.executeOneStep(irreversibleStep),
        (error: unknown) =>
          error instanceof ExecutionPolicyError && error.message.includes("REQUIRE_CONSENT"),
      );

      const selectStep: ActionStep = {
        id: randomUUID(),
        ordinal: 1,
        targetNodeId,
        command: { kind: "SELECT", valueToken: "SD-482" },
        riskClass: "R2",
        reversible: true,
        executionPolicy: "ALLOW_AFTER_SIMULATION",
        preconditions: ["Target is visible in the fresh surface"],
        expectedPostconditions: [
          "VISIBLE_TEXT:SELECTED!",
          "ABSENT_VISIBLE_TEXT:Flex+ silently included",
        ],
        evidenceRequirements: ["Fresh screenshot, DOM snapshot, and accessibility tree"],
        compensationCommand: { kind: "REMOVE_OPTION", optionToken: "SD-482" },
        idempotencyKey: "phase5-select-skydash-fare-step",
        pageVersion: before.pageVersion,
      };
      const receipt = await engine.executeOneStep(selectStep);
      assert.equal(receipt.commandKind, "SELECT");
      assert.ok(receipt.locatorStrategy?.startsWith("css:"));
      assert.equal(
        await worker.currentPage().getByText("SELECTED!", { exact: true }).isVisible(),
        true,
      );

      const verification = await captureAndVerify(worker, selectStep, sessionId);
      assert.equal(verification.result.outcome, "MISMATCH");
      assert.deepEqual(verification.result.satisfiedPostconditions, ["VISIBLE_TEXT:SELECTED!"]);
      assert.match(verification.result.mismatches[0] ?? "", /Flex\+ silently included/);
      assert.equal(verificationToMachineSignal(verification.result).type, "VERIFICATION_MISMATCH");
      assert.equal(verification.freshState.pageVersion, before.pageVersion + 1);
      assert.equal(verification.freshState.artifacts.domSnapshot.untrusted.trust, "UNTRUSTED_PAGE_DATA");
      assert.equal(
        verification.freshState.artifacts.accessibilityTree.untrusted.trust,
        "UNTRUSTED_PAGE_DATA",
      );
      assert.ok(verification.freshState.artifacts.screenshot.byteLength > 0);
    } finally {
      await worker.close();
      await stopFixtureServer(fixture.server);
      await rm(profile, { recursive: true, force: true });
    }
  },
);

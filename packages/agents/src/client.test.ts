import assert from "node:assert/strict";
import test from "node:test";
import type {
  Response as OpenAIResponse,
  ResponseCreateParamsNonStreaming,
  ResponseOutputItem,
} from "openai/resources/responses/responses";
import {
  MORPH_REASONING_MODEL,
  MorphResponsesClient,
  PROGRAMMATIC_SURFACE_TOOLS,
  resolveAgentRoute,
  routeSubagents,
  toMachineSignal,
} from "./index.js";

const SESSION_ID = "10000000-0000-4000-8000-000000000001";
const PROFILE_ID = "10000000-0000-4000-8000-000000000002";
const NOW = "2026-07-14T12:00:00.000Z";

const accessProfile = {
  id: PROFILE_ID,
  version: 1,
  label: "One-switch traveller",
  locale: "en-IN",
  preset: "ONE_SWITCH",
  vision: { textScale: 1.25, zoomPercent: 125, contrast: "HIGH", reduceMotion: true },
  motor: {
    inputMode: "SWITCH",
    minimumTargetSizePx: 64,
    scanIntervalMs: 1_500,
    dwellTimeMs: null,
  },
  cognitive: {
    plainLanguage: true,
    stepAtATime: true,
    maxChoices: 3,
    confirmationCadence: "ONLY_RISK_BOUNDARIES",
  },
  speech: { enabled: false, rate: 1 },
  createdAt: NOW,
  updatedAt: NOW,
} as const;

function task(state: string, snapshotId: string | null = null) {
  return {
    sessionId: SESSION_ID,
    state,
    objective: "Rebook below INR 8,000 without purchasing.",
    snapshotId,
    pageVersion: 1,
    evidenceSummary: ["Fixture snapshot is immutable."],
    artifactRefs: [],
    userInputSummary: null,
  };
}

const intentGraph = {
  id: "20000000-0000-4000-8000-000000000001",
  sessionId: SESSION_ID,
  goal: "Find a safe replacement flight.",
  taskFamily: "travel_rebooking",
  invariants: ["Total price must remain below INR 8,000."],
  prohibitions: ["Do not purchase without confirmation."],
  ambiguities: [],
  successEvidence: ["A matching replacement option is visible."],
  consentBoundaries: [],
  createdAt: NOW,
};

const surfaceGraph = {
  id: "20000000-0000-4000-8000-000000000002",
  sessionId: SESSION_ID,
  pageVersion: 1,
  url: "https://fixture.skydash.local/rebook",
  title: "SkyDash rebook",
  rootNodeIds: ["root"],
  nodes: [
    {
      id: "root",
      role: "document",
      name: "Rebook",
      description: null,
      value: null,
      parentId: null,
      childIds: [],
      interactive: false,
      hidden: false,
      disabled: false,
      states: {
        checked: null,
        selected: null,
        expanded: null,
        pressed: null,
        busy: false,
        current: false,
        required: false,
        invalid: false,
      },
      bounds: { x: 0, y: 0, width: 1280, height: 720 },
      evidenceIds: ["30000000-0000-4000-8000-000000000001"],
    },
  ],
  evidence: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      modality: "ACCESSIBILITY_TREE",
      locator: "snapshot:fixture-1:a11y:root",
      contentHash: "a".repeat(64),
      capturedAt: NOW,
    },
  ],
  conflicts: [],
  stateHash: "b".repeat(64),
  capturedAt: NOW,
};

function response(
  id: string,
  outputText: string,
  output: ResponseOutputItem[] = [],
): OpenAIResponse {
  return {
    id,
    status: "completed",
    output_text: outputText,
    output,
    usage: null,
  } as unknown as OpenAIResponse;
}

test("routes four specialists only when the feature flag is enabled", () => {
  assert.equal(resolveAgentRoute("SURFACE_GRAPH", false).role, "ROOT");
  assert.equal(resolveAgentRoute("SURFACE_GRAPH", true).role, "PERCEPTION");
  assert.deepEqual(
    routeSubagents(
      ["SURFACE_GRAPH", "ADAPTIVE_UI_MANIFEST", "ACTION_PLAN", "VERIFICATION_RESULT"],
      true,
    ).map((route) => route.role),
    ["PERCEPTION", "ADAPTIVE_DESIGN", "PLANNER", "CRITIC"],
  );
});

test("publishes official programmatic-only tool definitions", () => {
  const functions = PROGRAMMATIC_SURFACE_TOOLS.filter((tool) => tool.type === "function");
  assert.equal(functions.length, 2);
  for (const tool of functions) {
    assert.deepEqual(tool.allowed_callers, ["programmatic"]);
    assert.ok(tool.output_schema);
  }
  assert.ok(PROGRAMMATIC_SURFACE_TOOLS.some((tool) => tool.type === "programmatic_tool_calling"));
  assert.doesNotMatch(JSON.stringify(PROGRAMMATIC_SURFACE_TOOLS), /code_execution_20260120/);
});

test("creates a high-reasoning cached Responses request and validates its artifact", async () => {
  const requests: ResponseCreateParamsNonStreaming[] = [];
  const client = new MorphResponsesClient({
    multiAgentEnabled: true,
    createResponse: async (params) => {
      requests.push(params);
      return response("resp_intent", JSON.stringify(intentGraph));
    },
  });

  const result = await client.run({
    outputKind: "INTENT_GRAPH",
    accessProfile,
    task: task("ROUTE"),
  });

  assert.equal(result.artifact.goal, intentGraph.goal);
  assert.equal(result.role, "ROOT");
  assert.equal(requests[0]!.model, MORPH_REASONING_MODEL);
  assert.deepEqual(requests[0]!.reasoning, {
    effort: "high",
    context: "current_turn",
    summary: "auto",
  });
  assert.deepEqual(requests[0]!.prompt_cache_options, { mode: "explicit", ttl: "30m" });
  assert.equal((requests[0]!.text?.format as { type?: string }).type, "json_schema");
  assert.equal((JSON.stringify(requests[0]!.input).match(/prompt_cache_breakpoint/g) ?? []).length, 3);
  assert.equal(requests[0]!.store, false);
  assert.equal(toMachineSignal(result).type, "STAGE_SUCCEEDED");
});

test("uses all-turn reasoning context when opaque continuation items are supplied", async () => {
  const requests: ResponseCreateParamsNonStreaming[] = [];
  const client = new MorphResponsesClient({
    createResponse: async (params) => {
      requests.push(params);
      return response("resp_next", JSON.stringify(intentGraph));
    },
  });
  await client.run({
    outputKind: "INTENT_GRAPH",
    accessProfile,
    task: task("ROUTE"),
    continuation: {
      items: [
        {
          type: "message",
          role: "assistant",
          status: "completed",
          id: "msg_previous",
          content: [],
        },
      ],
    },
  });
  assert.equal(requests[0]!.reasoning?.context, "all_turns");
});

test("executes programmatic surface tools and keeps raw records out of final input", async () => {
  const requests: ResponseCreateParamsNonStreaming[] = [];
  let call = 0;
  const client = new MorphResponsesClient({
    multiAgentEnabled: true,
    createResponse: async (params) => {
      requests.push(params);
      call += 1;
      if (call === 1) {
        return response("resp_tool", "", [
          {
            type: "function_call",
            name: "read_surface_records",
            call_id: "call_surface_1",
            arguments: JSON.stringify({
              snapshotId: "fixture-1",
              channel: "ACCESSIBILITY_TREE",
              cursor: 0,
              limit: 100,
            }),
            caller: { type: "program", caller_id: "program_1" },
            status: "completed",
          },
        ]);
      }
      return response("resp_surface", JSON.stringify(surfaceGraph));
    },
  });

  const result = await client.run({
    outputKind: "SURFACE_GRAPH",
    accessProfile,
    task: task("CAPTURE", "fixture-1"),
    toolRuntime: {
      readSurfaceRecords: async () => ({
        snapshotId: "fixture-1",
        pageVersion: 1,
        totalRecords: 0,
        nextCursor: null,
        records: [],
      }),
      querySurfaceRecords: async () => {
        throw new Error("Unexpected query");
      },
    },
  });

  assert.equal(result.role, "PERCEPTION");
  assert.equal(result.artifact.stateHash, surfaceGraph.stateHash);
  assert.equal(requests.length, 2);
  assert.ok(requests[0]!.tools?.some((tool) => tool.type === "programmatic_tool_calling"));
  assert.match(JSON.stringify(requests[1]!.input), /function_call_output/);
  assert.equal(requests[1]!.reasoning?.context, "all_turns");
});

test("rejects output that does not satisfy the closed Phase 2 schema", async () => {
  const client = new MorphResponsesClient({
    createResponse: async () =>
      response("resp_invalid", JSON.stringify({ ...intentGraph, unexpected: true })),
  });
  await assert.rejects(
    client.run({ outputKind: "INTENT_GRAPH", accessProfile, task: task("ROUTE") }),
  );
});

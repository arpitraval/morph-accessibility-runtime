import assert from "node:assert/strict";
import test from "node:test";
import type { AgentEvent } from "@morph/contracts";
import {
  createSessionEventStream,
  projectSessionEvent,
  UnsafeSessionEventError,
  type SessionEventReader,
} from "./stream.js";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";
const EVENT_ID = "00000000-0000-4000-8000-000000000002";
const CORRELATION_ID = "00000000-0000-4000-8000-000000000003";

function stateEvent(sequence = 4): AgentEvent {
  return {
    id: EVENT_ID,
    sessionId: SESSION_ID,
    sequence,
    version: 1,
    actor: "ORCHESTRATOR",
    idempotencyKey: "stream-test-state-0001",
    correlationId: CORRELATION_ID,
    causationId: null,
    occurredAt: "2026-07-15T10:00:00.000Z",
    type: "STATE_TRANSITIONED",
    data: {
      from: "VERIFY",
      to: "CAPTURE",
      reason: "VERIFICATION_MISMATCH",
      resumeState: null,
      detail: "The source date control changed; stale target evidence was rejected.",
    },
  };
}

test("public projection exposes only the closed observatory contract", () => {
  const event: AgentEvent = {
    ...stateEvent(5),
    type: "AGENT_ACTIVITY_RECORDED",
    actor: "AGENT",
    data: {
      agent: "PERCEPTION",
      status: "PROCESSING",
      toolName: null,
      summary: "Capturing a fresh surface after the mismatch.",
      evidenceIds: [],
    },
  };
  const projected = projectSessionEvent(event);

  assert.equal(projected?.kind, "AGENT_ACTIVITY");
  assert.equal(projected?.redaction.reasoningExcluded, true);
  assert.equal(JSON.stringify(projected).includes("reasoning_context"), false);

  assert.throws(
    () => projectSessionEvent({ ...event, encrypted_reasoning: "must-never-stream" }),
    UnsafeSessionEventError,
  );
});

test("stream fails closed before opening an unauthorized session", async () => {
  const response = await createSessionEventStream(
    new Request("http://localhost/v1/sessions/" + SESSION_ID + "/events"),
    SESSION_ID,
    {
      authorizeSession: () => false,
      reader: { readAfter: async () => [] },
    },
  );

  assert.equal(response.status, 403);
  assert.equal(await response.text(), "Forbidden");
});

test("Last-Event-ID resumes after the durable cursor and cancellation releases the subscriber", async () => {
  const cursors: number[] = [];
  let subscriberClosed = 0;
  const event = stateEvent();
  const eventReader: SessionEventReader = {
    async readAfter(_sessionId, sequence) {
      cursors.push(sequence);
      return sequence < event.sequence ? [event] : [];
    },
  };

  const response = await createSessionEventStream(
    new Request("http://localhost/v1/sessions/" + SESSION_ID + "/events", {
      headers: { "last-event-id": "3" },
    }),
    SESSION_ID,
    {
      authorizeSession: () => true,
      reader: eventReader,
      pollIntervalMs: 1,
      onSubscriberClosed: () => {
        subscriberClosed += 1;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = "";
  for (let index = 0; index < 5 && !output.includes("VERIFICATION_MISMATCH"); index += 1) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    output += decoder.decode(chunk.value, { stream: true });
  }
  await reader.cancel();
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(cursors[0], 3);
  assert.match(output, /id: 4/);
  assert.match(output, /event: observatory/);
  assert.match(output, /VERIFICATION_MISMATCH/);
  assert.equal(subscriberClosed, 1);
});
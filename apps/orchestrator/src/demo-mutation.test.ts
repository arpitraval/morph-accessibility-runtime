import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMutationEvents,
  createDemoMutationResponse,
  type DemoMutationWriter,
} from "./demo-mutation.js";

const SESSION_ID = "10000000-0000-4000-8000-000000000001";
const MUTATION_ID = "50000000-0000-4000-8000-000000000001";

test("demo mutation endpoint authorizes before accepting a signal", async () => {
  let appended = false;
  const writer: DemoMutationWriter = {
    async append() {
      appended = true;
      return { firstSequence: 17, lastSequence: 32, replayed: false };
    },
  };
  const request = new Request("http://localhost/v1/demo/sessions/" + SESSION_ID + "/mutate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      mutationId: MUTATION_ID,
      mutationKind: "DATE_PICKER_TO_TEXT_INPUT",
      sourceVariant: 0,
      targetVariant: 1,
    }),
  });

  const response = await createDemoMutationResponse(request, SESSION_ID, {
    authorizeSession: () => false,
    writer,
  });

  assert.equal(response.status, 403);
  assert.equal(appended, false);
});

test("valid source mutation appends the durable recovery sequence", async () => {
  let appendedSession: string | null = null;
  const writer: DemoMutationWriter = {
    async append(request) {
      appendedSession = request.sessionId;
      return { firstSequence: 17, lastSequence: 32, replayed: false };
    },
  };
  const response = await createDemoMutationResponse(
    new Request("http://localhost/v1/demo/sessions/" + SESSION_ID + "/mutate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        mutationId: MUTATION_ID,
        mutationKind: "DATE_PICKER_TO_TEXT_INPUT",
        sourceVariant: 0,
        targetVariant: 1,
      }),
    }),
    SESSION_ID,
    {
      authorizeSession: () => true,
      writer,
    },
  );

  assert.equal(response.status, 202);
  assert.equal(appendedSession, SESSION_ID);
  assert.deepEqual(await response.json(), {
    firstSequence: 17,
    lastSequence: 32,
    replayed: false,
  });
});

test("unknown mutation fields fail closed", async () => {
  const response = await createDemoMutationResponse(
    new Request("http://localhost/v1/demo/sessions/" + SESSION_ID + "/mutate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        mutationId: MUTATION_ID,
        mutationKind: "DATE_PICKER_TO_TEXT_INPUT",
        sourceVariant: 0,
        targetVariant: 1,
        encryptedReasoning: "never accepted",
      }),
    }),
    SESSION_ID,
    {
      authorizeSession: () => true,
      writer: {
        async append() {
          throw new Error("must not run");
        },
      },
    },
  );

  assert.equal(response.status, 409);
});
test("mutation recovery factory emits a closed 16-event repair sequence", () => {
  const events = buildMutationEvents(
    {
      sessionId: SESSION_ID,
      mutationId: MUTATION_ID,
      mutationKind: "DATE_PICKER_TO_TEXT_INPUT",
      sourceVariant: 0,
      targetVariant: 1,
    },
    17,
    "60000000-0000-4000-8000-000000000001",
  );

  assert.equal(events.length, 16);
  assert.equal(events[0]?.type, "VERIFICATION_EVIDENCE_RECORDED");
  assert.equal(events[2]?.type, "STATE_TRANSITIONED");
  assert.equal(events[15]?.type, "STATE_TRANSITIONED");
  assert.deepEqual(
    events.filter((event) => event.type === "STATE_TRANSITIONED").map((event) => event.data.to),
    ["CAPTURE", "NORMALIZE", "ROUTE", "PARALLEL_REASON", "COMPILE"],
  );
});
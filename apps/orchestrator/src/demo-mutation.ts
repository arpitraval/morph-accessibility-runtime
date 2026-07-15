import { randomUUID } from "node:crypto";
import { AgentEventSchema } from "@morph/contracts";
import type { AgentEvent } from "@morph/contracts";
import { replaySessionEvents } from "@morph/state-machine";
import type { Pool, PoolClient } from "pg";

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DemoMutationRequest {
  readonly sessionId: string;
  readonly mutationId: string;
  readonly mutationKind: "DATE_PICKER_TO_TEXT_INPUT";
  readonly sourceVariant: number;
  readonly targetVariant: number;
}

export interface MutationAppendResult {
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly replayed: boolean;
}

export interface DemoMutationWriter {
  append(request: DemoMutationRequest): Promise<MutationAppendResult>;
}

export interface DemoMutationDependencies {
  readonly authorizeSession: (
    request: Request,
    sessionId: string,
  ) => boolean | Promise<boolean>;
  readonly writer: DemoMutationWriter;
  readonly allowedOrigin?: string;
}

function parseRequest(value: unknown, sessionId: string): DemoMutationRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Mutation body must be an object");
  }
  const record = value as Record<string, unknown>;
  const allowedKeys = new Set([
    "sessionId",
    "mutationId",
    "mutationKind",
    "sourceVariant",
    "targetVariant",
  ]);
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    throw new Error("Mutation body contains unknown fields");
  }
  if (
    record.sessionId !== sessionId ||
    record.mutationKind !== "DATE_PICKER_TO_TEXT_INPUT" ||
    typeof record.mutationId !== "string" ||
    !SESSION_ID_PATTERN.test(record.mutationId) ||
    !Number.isInteger(record.sourceVariant) ||
    !Number.isInteger(record.targetVariant) ||
    Number(record.sourceVariant) < 0 ||
    Number(record.sourceVariant) > 4 ||
    Number(record.targetVariant) < 0 ||
    Number(record.targetVariant) > 4 ||
    record.sourceVariant === record.targetVariant
  ) {
    throw new Error("Mutation body failed the closed demo contract");
  }
  return record as unknown as DemoMutationRequest;
}

function corsHeaders(request: Request, allowedOrigin?: string): Headers {
  const headers = new Headers({ "cache-control": "no-store" });
  if (allowedOrigin && request.headers.get("origin") === allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "origin");
  }
  return headers;
}

export async function createDemoMutationResponse(
  request: Request,
  sessionId: string,
  dependencies: DemoMutationDependencies,
): Promise<Response> {
  const headers = corsHeaders(request, dependencies.allowedOrigin);
  if (request.method === "OPTIONS") {
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("access-control-allow-headers", "content-type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers });
  }
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return new Response("Invalid session id", { status: 400, headers });
  }
  if (!(await dependencies.authorizeSession(request, sessionId))) {
    return new Response("Forbidden", { status: 403, headers });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > 2_048) {
    return new Response("Payload too large", { status: 413, headers });
  }

  try {
    const mutation = parseRequest(await request.json(), sessionId);
    const result = await dependencies.writer.append(mutation);
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(result), { status: result.replayed ? 200 : 202, headers });
  } catch {
    return new Response("Mutation rejected safely", { status: 409, headers });
  }
}

function eventFactory(
  sessionId: string,
  startSequence: number,
  correlationId: string,
  initialCausationId: string | null,
  mutationId: string,
) {
  const events: AgentEvent[] = [];
  return {
    push(
      type: AgentEvent["type"],
      actor: AgentEvent["actor"],
      data: AgentEvent["data"],
    ) {
      const sequence = startSequence + events.length;
      const event = AgentEventSchema.parse({
        id: randomUUID(),
        sessionId,
        sequence,
        version: 1,
        actor,
        idempotencyKey:
          "demo-mutation-" + mutationId + "-" + String(events.length + 1).padStart(2, "0"),
        correlationId,
        causationId: events.at(-1)?.id ?? initialCausationId,
        occurredAt: new Date(Date.now() + events.length).toISOString(),
        type,
        data,
      });
      events.push(event);
      return event;
    },
    events,
  };
}

export function buildMutationEvents(
  request: DemoMutationRequest,
  firstSequence: number,
  previousEventId: string | null,
): readonly AgentEvent[] {
  const correlationId = randomUUID();
  const verificationResultId = randomUUID();
  const actionStepId = "30000000-0000-4000-8000-000000000001";
  const evidenceId = randomUUID();
  const planId = randomUUID();
  const factory = eventFactory(
    request.sessionId,
    firstSequence,
    correlationId,
    previousEventId,
    request.mutationId,
  );

  factory.push("VERIFICATION_EVIDENCE_RECORDED", "BROWSER_WORKER", {
    verificationResultId,
    actionStepId,
    outcome: "MISMATCH",
    summary: "Expected calendar control is absent; a text date field appeared.",
    evidence: [
      {
        evidenceId,
        kind: "DOM",
        digest: "a".repeat(64),
        summary: "Fresh DOM hash proves the date-control mutation.",
      },
    ],
    redaction: { rawScreenshotExcluded: true, reasoningExcluded: true },
  });
  factory.push("VERIFICATION_RECORDED", "BROWSER_WORKER", {
    verificationResultId,
    actionStepId,
    outcome: "MISMATCH",
  });
  factory.push("STATE_TRANSITIONED", "ORCHESTRATOR", {
    from: "VERIFY",
    to: "CAPTURE",
    reason: "VERIFICATION_MISMATCH",
    resumeState: null,
    detail: "Stale target evidence rejected; replan attempt begins from fresh capture.",
  });
  factory.push("AGENT_ACTIVITY_RECORDED", "AGENT", {
    agent: "PERCEPTION",
    status: "PROCESSING",
    toolName: null,
    summary: "Recapturing the mutated source before any further action.",
    evidenceIds: [],
  });
  factory.push("AGENT_ACTIVITY_RECORDED", "AGENT", {
    agent: "PERCEPTION",
    status: "TOOL_CALLED",
    toolName: "read_surface_records",
    summary: "Reading the replacement text-date field through the isolated runtime.",
    evidenceIds: [evidenceId],
  });
  factory.push("STATE_TRANSITIONED", "ORCHESTRATOR", {
    from: "CAPTURE",
    to: "NORMALIZE",
    reason: "STAGE_SUCCEEDED",
    resumeState: null,
    detail: "Mutated source captured as a fresh page version.",
  });
  factory.push("AGENT_ACTIVITY_RECORDED", "AGENT", {
    agent: "PERCEPTION",
    status: "SUCCEEDED",
    toolName: null,
    summary: "Calendar drift normalized into a new SurfaceGraph.",
    evidenceIds: [evidenceId],
  });
  factory.push("STATE_TRANSITIONED", "ORCHESTRATOR", {
    from: "NORMALIZE",
    to: "ROUTE",
    reason: "STAGE_SUCCEEDED",
    resumeState: null,
    detail: "Fresh semantic nodes are ready for routing.",
  });
  factory.push("STATE_TRANSITIONED", "ORCHESTRATOR", {
    from: "ROUTE",
    to: "PARALLEL_REASON",
    reason: "STAGE_SUCCEEDED",
    resumeState: null,
    detail: "Planner and Critic are replanning from fresh evidence.",
  });
  factory.push("AGENT_ACTIVITY_RECORDED", "AGENT", {
    agent: "PLANNER",
    status: "PROCESSING",
    toolName: null,
    summary: "Rebinding the date intent to the replacement text field.",
    evidenceIds: [evidenceId],
  });
  factory.push("AGENT_ACTIVITY_RECORDED", "AGENT", {
    agent: "CRITIC",
    status: "PROCESSING",
    toolName: null,
    summary: "Checking that the repair preserves all locked constraints.",
    evidenceIds: [evidenceId],
  });
  factory.push("CANDIDATE_PLAN_RECORDED", "AGENT", {
    planId,
    candidateKey: "text-date-rebind-v2",
    rank: 1,
    status: "SELECTED",
    summary: "Bind the date intent to the fresh text input and preserve the safe fare path.",
    constraintResults: [
      { constraint: "Under INR 8,000", outcome: "PASS" },
      { constraint: "No purchase without consent", outcome: "PASS" },
    ],
  });
  factory.push("HYPOTHESIS_REJECTED", "AGENT", {
    agent: "CRITIC",
    hypothesisId: randomUUID(),
    summary: "Rejected reuse of the stale calendar locator.",
    reasonCode: "STALE_SURFACE",
    evidenceIds: [evidenceId],
  });
  factory.push("AGENT_ACTIVITY_RECORDED", "AGENT", {
    agent: "PLANNER",
    status: "SUCCEEDED",
    toolName: null,
    summary: "A page-version-bound repaired plan is ready.",
    evidenceIds: [evidenceId],
  });
  factory.push("AGENT_ACTIVITY_RECORDED", "AGENT", {
    agent: "CRITIC",
    status: "SUCCEEDED",
    toolName: null,
    summary: "The repair preserves budget, route, and consent invariants.",
    evidenceIds: [evidenceId],
  });
  factory.push("STATE_TRANSITIONED", "ORCHESTRATOR", {
    from: "PARALLEL_REASON",
    to: "COMPILE",
    reason: "STAGE_SUCCEEDED",
    resumeState: null,
    detail: "Safe replan selected from fresh evidence.",
  });

  return factory.events;
}

async function insertEvent(client: PoolClient, event: AgentEvent): Promise<void> {
  await client.query(
    [
      "INSERT INTO session_events",
      "(id, session_id, sequence, event_version, event_type, actor, idempotency_key,",
      "correlation_id, causation_id, payload, occurred_at)",
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)",
    ].join(" "),
    [
      event.id,
      event.sessionId,
      event.sequence,
      event.version,
      event.type,
      event.actor,
      event.idempotencyKey,
      event.correlationId,
      event.causationId,
      JSON.stringify(event),
      event.occurredAt,
    ],
  );
}

export class PostgresDemoMutationWriter implements DemoMutationWriter {
  constructor(private readonly pool: Pool) {}

  async append(request: DemoMutationRequest): Promise<MutationAppendResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const session = await client.query<{ id: string }>(
        "SELECT id FROM sessions WHERE id = $1 FOR UPDATE",
        [request.sessionId],
      );
      if (session.rowCount !== 1) {
        throw new Error("Unknown session");
      }

      const idempotencyPrefix = "demo-mutation-" + request.mutationId + "-01";
      const prior = await client.query<{ sequence: number }>(
        "SELECT sequence FROM session_events WHERE session_id = $1 AND idempotency_key = $2",
        [request.sessionId, idempotencyPrefix],
      );
      if (prior.rowCount === 1) {
        await client.query("COMMIT");
        const firstSequence = prior.rows[0]!.sequence;
        return { firstSequence, lastSequence: firstSequence + 15, replayed: true };
      }

      const result = await client.query<{ payload: unknown }>(
        "SELECT payload FROM session_events WHERE session_id = $1 ORDER BY sequence ASC",
        [request.sessionId],
      );
      const rawEvents = result.rows.map((row) => row.payload);
      const snapshot = replaySessionEvents(rawEvents);
      if (snapshot.state !== "VERIFY" || snapshot.replanAttempts >= 3) {
        throw new Error("Mutation demo requires VERIFY with retry capacity");
      }

      const firstSequence = snapshot.lastSequence + 1;
      const events = buildMutationEvents(request, firstSequence, snapshot.lastEventId);
      for (const event of events) {
        await insertEvent(client, event);
      }
      await client.query("COMMIT");
      return {
        firstSequence,
        lastSequence: events.at(-1)!.sequence,
        replayed: false,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
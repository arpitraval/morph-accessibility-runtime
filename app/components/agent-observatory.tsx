"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdaptiveExecutionIntent, ObservatoryEvent, SpecialistAgent } from "../../packages/contracts/src/index.js";
import { ObservatoryEventSchema } from "../../packages/contracts/src/index.js";
import {
  CONSTRAINT_FIXTURES,
  MUTATION_REPLAY_EVENTS,
  OBSERVATORY_REPLAY_EVENTS,
} from "../demo-fixtures.js";

const MAX_CLIENT_EVENTS = 120;
const AGENTS: readonly SpecialistAgent[] = [
  "PERCEPTION",
  "ADAPTIVE_DESIGN",
  "PLANNER",
  "CRITIC",
];

type StreamMode = "live" | "replay";
type StreamStatus = "connecting" | "live" | "reconnecting" | "replay";

function mergeEvent(
  current: readonly ObservatoryEvent[],
  incoming: ObservatoryEvent,
): readonly ObservatoryEvent[] {
  if (current.some((event) => event.eventId === incoming.eventId)) {
    return current;
  }
  return [...current, incoming]
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-MAX_CLIENT_EVENTS);
}

function resolveStreamUrl(template: string, sessionId: string): string {
  return template.includes("{sessionId}")
    ? template.replace("{sessionId}", encodeURIComponent(sessionId))
    : template;
}

export function useObservatoryStream({
  mode,
  mutationEpoch,
  sessionId,
  streamUrl,
}: {
  readonly mode: StreamMode;
  readonly mutationEpoch: number;
  readonly sessionId: string;
  readonly streamUrl: string;
}) {
  const [events, setEvents] = useState<readonly ObservatoryEvent[]>(
    mode === "replay" ? OBSERVATORY_REPLAY_EVENTS : [],
  );
  const [status, setStatus] = useState<StreamStatus>(
    mode === "replay" ? "replay" : "connecting",
  );

  useEffect(() => {
    if (mode === "replay") {
      return;
    }

    const source = new EventSource(resolveStreamUrl(streamUrl, sessionId), {
      withCredentials: true,
    });

    const onOpen = () => setStatus("live");
    const onError = () => setStatus("reconnecting");
    const onEvent = (message: Event) => {
      if (!(message instanceof MessageEvent) || typeof message.data !== "string") {
        return;
      }

      try {
        const parsed = ObservatoryEventSchema.safeParse(JSON.parse(message.data));
        if (parsed.success && parsed.data.sessionId === sessionId) {
          setEvents((current) => mergeEvent(current, parsed.data));
        }
      } catch {
        // Untrusted or malformed stream data never enters UI state.
      }
    };

    source.addEventListener("open", onOpen);
    source.addEventListener("error", onError);
    source.addEventListener("observatory", onEvent);

    return () => {
      source.removeEventListener("open", onOpen);
      source.removeEventListener("error", onError);
      source.removeEventListener("observatory", onEvent);
      source.close();
    };
  }, [mode, sessionId, streamUrl]);

  useEffect(() => {
    if (mode !== "replay" || mutationEpoch === 0) {
      return;
    }

    const resetTimer = window.setTimeout(() => {
      setEvents(OBSERVATORY_REPLAY_EVENTS);
    }, 0);
    const timers = MUTATION_REPLAY_EVENTS.map((event, index) =>
      window.setTimeout(() => {
        setEvents((current) => mergeEvent(current, event));
      }, 180 * (index + 1)),
    );

    return () => {
      window.clearTimeout(resetTimer);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [mode, mutationEpoch]);

  return { events, status };
}

export function ConstraintLedger() {
  return (
    <aside className="constraint-ledger" aria-labelledby="constraint-ledger-title">
      <div className="panel-title-row">
        <div>
          <span className="panel-kicker">Intent contract</span>
          <h2 id="constraint-ledger-title">Constraint ledger</h2>
        </div>
        <span className="ledger-lock">6 locked</span>
      </div>
      <dl>
        {CONSTRAINT_FIXTURES.map((constraint) => (
          <div data-state={constraint.state} key={constraint.label}>
            <dt>{constraint.label}</dt>
            <dd>{constraint.value}</dd>
            <span aria-hidden="true">{"✓"}</span>
          </div>
        ))}
      </dl>
      <div className="consent-guard">
        <span className="guard-icon" aria-hidden="true">!</span>
        <div>
          <strong>Purchase gate armed</strong>
          <p>One exact action. Fresh confirmation. State-bound.</p>
        </div>
      </div>
    </aside>
  );
}

function AdapterForgeStream({
  event,
}: {
  readonly event: Extract<ObservatoryEvent, { kind: "ADAPTER_FORGE_STATUS" }>;
}) {
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="forge-stream-card"
      data-forge-status={event.data.type}
      role="status"
    >
      <span className="forge-code-glyph" aria-hidden="true">{"</>"}</span>
      <div className="forge-stream-copy">
        <span>Sandboxed background build</span>
        <strong>{event.data.type}</strong>
        <p>{event.data.detail}</p>
      </div>
      <span className="forge-attempt">Attempt {event.data.attempt}/3</span>
    </div>
  );
}

function agentLabel(agent: SpecialistAgent): string {
  return agent === "ADAPTIVE_DESIGN"
    ? "Adaptive Design"
    : agent[0] + agent.slice(1).toLowerCase();
}

function timelinePresentation(event: ObservatoryEvent) {
  switch (event.kind) {
    case "STATE_TRANSITION":
      return {
        source: event.data.to,
        title: event.data.from + " → " + event.data.to,
        detail: event.data.detail,
        tone: event.data.reason === "VERIFICATION_MISMATCH"
          ? "mismatch"
          : event.data.reason === "STAGE_SUCCEEDED"
            ? "succeeded"
            : "neutral",
        badge: event.data.reason,
      };
    case "VERIFICATION_EVIDENCE":
      return {
        source: "VERIFIER",
        title: "Fresh evidence: " + event.data.outcome,
        detail: event.data.summary,
        tone: event.data.outcome === "MISMATCH" ? "mismatch" : "succeeded",
        badge: event.data.outcome,
      };
    case "AGENT_ACTIVITY":
      return {
        source: event.data.agent,
        title: event.data.status.replace("_", " "),
        detail: event.data.summary,
        tone: event.data.status === "FAILED"
          ? "mismatch"
          : event.data.status === "SUCCEEDED"
            ? "succeeded"
            : "active",
        badge: event.data.toolName ?? event.data.status,
      };
    case "CANDIDATE_PLAN":
      return {
        source: "PLANNER",
        title: "Candidate #" + event.data.rank + " " + event.data.status,
        detail: event.data.summary,
        tone: event.data.status === "REJECTED" ? "rejected" : "succeeded",
        badge: event.data.candidateKey,
      };
    case "HYPOTHESIS_REJECTED":
      return {
        source: "CRITIC",
        title: "Hypothesis rejected",
        detail: event.data.summary,
        tone: "rejected",
        badge: event.data.reasonCode,
      };
    case "ADAPTER_FORGE_STATUS":
      return {
        source: "FORGE",
        title: event.data.type,
        detail: event.data.detail,
        tone: "active",
        badge: "ATTEMPT " + event.data.attempt,
      };
  }
}

function formatClock(timestamp: string): string {
  return new Intl.DateTimeFormat("en", {
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 1,
  }).format(new Date(timestamp));
}

export function AgentObservatory({
  latestIntent,
  mode,
  mutationEpoch,
  sessionId,
  streamUrl,
}: {
  readonly latestIntent: AdaptiveExecutionIntent | null;
  readonly mode: StreamMode;
  readonly mutationEpoch: number;
  readonly sessionId: string;
  readonly streamUrl: string;
}) {
  const { events, status } = useObservatoryStream({
    mode,
    mutationEpoch,
    sessionId,
    streamUrl,
  });

  const agentState = useMemo(
    () =>
      AGENTS.map((agent) => {
        const event = [...events]
          .reverse()
          .find(
            (candidate): candidate is Extract<ObservatoryEvent, { kind: "AGENT_ACTIVITY" }> =>
              candidate.kind === "AGENT_ACTIVITY" && candidate.data.agent === agent,
          );
        return {
          agent,
          status: event?.data.status ?? "IDLE",
          summary: event?.data.summary ?? "Waiting for schema-scoped work.",
        };
      }),
    [events],
  );
  const forgeEvent = [...events]
    .reverse()
    .find(
      (event): event is Extract<ObservatoryEvent, { kind: "ADAPTER_FORGE_STATUS" }> =>
        event.kind === "ADAPTER_FORGE_STATUS",
    );
  const timeline = events.slice(-10).reverse();

  return (
    <section className="observatory" aria-labelledby="observatory-title">
      <div className="panel-title-row observatory-heading">
        <div>
          <span className="panel-kicker">Durable state → redacted evidence stream</span>
          <h2 id="observatory-title">Agent Observatory</h2>
        </div>
        <div className="stream-badge" data-status={status} role="status">
          <span aria-hidden="true" />
          {status === "replay" ? "Labeled judge replay" : "SSE " + status}
        </div>
      </div>

      {forgeEvent ? <AdapterForgeStream event={forgeEvent} /> : null}

      {latestIntent ? (
        <div className="compiler-intent" role="status">
          <span>UI intent</span>
          <strong>{latestIntent.componentId}</strong>
          <p>{latestIntent.entryState} -&gt; {latestIntent.requestedState} | {latestIntent.target}</p>
        </div>
      ) : null}

      <div className="agent-constellation" aria-label="Live specialist agent constellation">
        <div className="constellation-core" aria-hidden="true">
          <span>M</span>
          <small>ROOT</small>
        </div>
        {agentState.map((agent, index) => {
          const isActive = agent.status === "PROCESSING" || agent.status === "TOOL_CALLED";
          return (
            <article
              className={"constellation-agent constellation-agent-" + (index + 1)}
              data-active={isActive}
              data-status={agent.status}
              key={agent.agent}
            >
              <div>
                <span aria-hidden="true" />
                <strong>{agentLabel(agent.agent)}</strong>
                <small>{agent.status.replace("_", " ")}</small>
              </div>
              <p>{agent.summary}</p>
            </article>
          );
        })}
      </div>

      <div className="action-timeline">
        <div className="timeline-heading">
          <strong>Action timeline</strong>
          <span>{events.length} validated events | cursor {events.at(-1)?.sequence ?? 0}</span>
        </div>
        <ol aria-live="polite">
          {timeline.map((event) => {
            const item = timelinePresentation(event);
            return (
              <li data-tone={item.tone} key={event.eventId}>
                <time dateTime={event.occurredAt}>{formatClock(event.occurredAt)}</time>
                <div>
                  <span>{item.source}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <small>{item.badge}</small>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
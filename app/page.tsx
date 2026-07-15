"use client";

import { useMemo, useState } from "react";
import type { AdaptiveProfileKey } from "../packages/accessibility-kit/src/components.js";
import type { AdaptiveExecutionIntent } from "../packages/contracts/src/index.js";
import { AdaptiveCompiler } from "./components/adaptive-compiler.js";
import { AgentObservatory, ConstraintLedger } from "./components/agent-observatory.js";
import { DEMO_SESSION_ID, PROFILE_FIXTURES } from "./demo-fixtures.js";

const PORTAL_VARIANTS = [
  "Dense grid",
  "Sidebar flip",
  "Banner stack",
  "Card reversal",
  "Floating filters",
] as const;

export default function Home() {
  const [profileKey, setProfileKey] = useState<AdaptiveProfileKey>("one-switch");
  const [variant, setVariant] = useState(0);
  const [frameEpoch, setFrameEpoch] = useState(0);
  const [mutationEpoch, setMutationEpoch] = useState(0);
  const [lastAction, setLastAction] = useState("Awaiting a safe selection");
  const [latestIntent, setLatestIntent] = useState<AdaptiveExecutionIntent | null>(null);

  const activeProfile =
    PROFILE_FIXTURES.find((profile) => profile.key === profileKey) ?? PROFILE_FIXTURES[1]!;
  const observatoryMode =
    process.env.NEXT_PUBLIC_MORPH_OBSERVATORY_MODE === "live" ? "live" : "replay";
  const streamUrl =
    process.env.NEXT_PUBLIC_ORCHESTRATOR_SSE_URL ??
    "http://127.0.0.1:8788/v1/sessions/{sessionId}/events";
  const mutationUrlTemplate =
    process.env.NEXT_PUBLIC_ORCHESTRATOR_MUTATION_URL ??
    "http://127.0.0.1:8788/v1/demo/sessions/{sessionId}/mutate";

  const portalUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_DEMO_PORTAL_URL ?? "http://127.0.0.1:4173";
    return base + "?variant=" + variant + "&epoch=" + frameEpoch;
  }, [frameEpoch, variant]);

  function selectProfile(nextProfile: AdaptiveProfileKey) {
    setProfileKey(nextProfile);
    setLatestIntent(null);
    setLastAction("Adaptive surface recompiled from the same intent");
  }

  function mutateSource() {
    const nextVariant = (variant + 1) % PORTAL_VARIANTS.length;
    setVariant(nextVariant);
    setFrameEpoch((current) => current + 1);
    setMutationEpoch((current) => current + 1);
    setLastAction("Source UI mutated; verification is invalidating stale evidence");

    if (observatoryMode === "live") {
      const endpoint = mutationUrlTemplate.includes("{sessionId}")
        ? mutationUrlTemplate.replace("{sessionId}", DEMO_SESSION_ID)
        : mutationUrlTemplate;
      void fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: DEMO_SESSION_ID,
          mutationId: crypto.randomUUID(),
          mutationKind: "DATE_PICKER_TO_TEXT_INPUT",
          sourceVariant: variant,
          targetVariant: nextVariant,
        }),
      }).catch(() => {
        setLastAction("Source mutated; durable stream reconnect is pending");
      });
    }
  }

  function dispatchExecutionIntent(intent: AdaptiveExecutionIntent) {
    setLatestIntent(intent);
    setLastAction(
      "Typed intent " + intent.componentId + " dispatched to RISK_GATE; one browser step is queued.",
    );
  }

  return (
    <main className="demo-shell">
      <header className="mission-header">
        <div className="brand-lockup">
          <span className="brand-orbit" aria-hidden="true">
            <span />
          </span>
          <div>
            <strong>MORPH</strong>
            <span>Personal accessibility runtime</span>
          </div>
        </div>

        <div className="mission-intent">
          <span>Active intent</span>
          <p>
            Move tomorrow&apos;s disrupted journey below {"\u20B9"}8,000.
            <strong> Do not purchase without confirmation.</strong>
          </p>
        </div>

        <div className="runtime-status" role="status">
          <span className="runtime-pulse" aria-hidden="true" />
          <div>
            <strong>Adaptive runtime + Adapter Forge</strong>
            <small>Phase 8 | durable SSE + redacted evidence</small>
          </div>
        </div>
      </header>

      <section className="comparison-stage" aria-label="Source portal and MORPH comparison">
        <section className="source-pane" aria-labelledby="source-pane-title">
          <div className="pane-toolbar source-toolbar">
            <div>
              <span className="pane-number">01</span>
              <div>
                <strong id="source-pane-title">Chaotic source</strong>
                <small>SkyDash disruption portal</small>
              </div>
            </div>
            <div className="source-controls">
              <label>
                Layout
                <select
                  onChange={(event) => {
                    setVariant(Number(event.currentTarget.value));
                    setFrameEpoch((current) => current + 1);
                  }}
                  value={variant}
                >
                  {PORTAL_VARIANTS.map((label, index) => (
                    <option key={label} value={index}>
                      {index + 1}. {label}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={mutateSource} type="button">
                Mutate source UI
              </button>
            </div>
          </div>

          <div className="source-frame-wrap">
            <div className="browser-chrome" aria-hidden="true">
              <div><span /><span /><span /></div>
              <p>fixture.skydash.local/rebook?disrupted=true</p>
              <span>Unsafe density</span>
            </div>
            <iframe
              key={portalUrl}
              className="source-frame"
              src={portalUrl}
              title="Intentionally inaccessible travel booking fixture"
            />
            <div className="source-health">
              <span aria-hidden="true">{"\u2713"}</span>
              37 controls | 14 low-contrast labels | layout variant {variant + 1}
            </div>
          </div>
        </section>

        <section className="morph-pane" aria-labelledby="morph-pane-title">
          <div className="pane-toolbar morph-toolbar">
            <div>
              <span className="pane-number">02</span>
              <div>
                <strong id="morph-pane-title">MORPH runtime</strong>
                <small>Same task | compiled for this person</small>
              </div>
            </div>
            <div className="verified-chip">
              <span aria-hidden="true">{"\u2713"}</span>
              Contract validated
            </div>
          </div>

          <div className="profile-switcher-wrap">
            <div className="profile-switcher-label">
              <span>Access profile</span>
              <strong>{activeProfile.cue}</strong>
            </div>
            <div className="profile-switcher" role="tablist" aria-label="Adaptive access profile">
              {PROFILE_FIXTURES.map((profile) => (
                <button
                  aria-selected={profile.key === profileKey}
                  className={profile.key === profileKey ? "profile-active" : ""}
                  key={profile.key}
                  onClick={() => selectProfile(profile.key)}
                  role="tab"
                  type="button"
                >
                  <span className={"profile-glyph profile-glyph-" + profile.key} aria-hidden="true" />
                  <span>
                    <strong>{profile.label}</strong>
                    <small>{profile.cue}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="runtime-grid">
            <div className="adaptive-column">
              <AdaptiveCompiler
                accessProfile={activeProfile.accessProfile}
                footer={
                  <div className="adaptive-footer-content">
                    <div>
                      <span aria-hidden="true">{"\u2713"}</span>
                      <p>
                        <strong>{lastAction}</strong>
                        <small>No purchase can bypass explicit consent.</small>
                      </p>
                    </div>
                  </div>
                }
                manifest={activeProfile.manifest}
                onIntent={dispatchExecutionIntent}
              />
            </div>
            <ConstraintLedger />
          </div>

          <AgentObservatory
            latestIntent={latestIntent}
            mode={observatoryMode}
            mutationEpoch={mutationEpoch}
            sessionId={DEMO_SESSION_ID}
            streamUrl={streamUrl}
          />
        </section>
      </section>

      <footer className="demo-footer">
        <span>MORPH | Apps for Your Life</span>
        <span>Raw interface is untrusted evidence | irreversible actions remain blocked</span>
        <span>Build Week 2026</span>
      </footer>
    </main>
  );
}
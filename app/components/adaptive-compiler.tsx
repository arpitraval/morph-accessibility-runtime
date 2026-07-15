"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AccessProfileSchema,
  AdaptiveExecutionIntentSchema,
  AdaptiveUIManifestSchema,
  type AccessProfile,
  type AdaptiveExecutionIntent,
  type AdaptiveUIManifest,
} from "../../packages/contracts/src/index.js";
import {
  AdaptiveButton,
  AdaptiveList,
  AdaptiveModal,
  AdaptiveText,
  type AdaptiveFontScale,
  type AdaptivePresentationMode,
  type AdaptiveProfileKey,
} from "../../packages/accessibility-kit/src/components.js";

type ManifestNode = AdaptiveUIManifest["components"][number];

const ACTION_KINDS = new Set<ManifestNode["kind"]>(["ACTION", "CHOICE", "CONSENT"]);

export interface AdaptiveCompilerProps {
  readonly manifest: AdaptiveUIManifest;
  readonly accessProfile: AccessProfile;
  readonly onIntent: (intent: AdaptiveExecutionIntent) => void | Promise<void>;
  readonly footer?: ReactNode;
}

export interface CompiledManifestGraph {
  readonly roots: readonly ManifestNode[];
  readonly componentsById: ReadonlyMap<string, ManifestNode>;
  readonly childrenByParentId: ReadonlyMap<string, readonly ManifestNode[]>;
}

function sortNodes(nodes: readonly ManifestNode[]): readonly ManifestNode[] {
  return [...nodes].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

export function compileManifestGraph(manifest: AdaptiveUIManifest): CompiledManifestGraph {
  const componentsById = new Map(manifest.components.map((component) => [component.id, component]));
  const children = new Map<string, ManifestNode[]>();

  for (const component of manifest.components) {
    if (component.parentId !== null && !componentsById.has(component.parentId)) {
      throw new Error("Component " + component.id + " references missing parent " + component.parentId + ".");
    }
    if (component.parentId !== null) {
      const siblings = children.get(component.parentId) ?? [];
      siblings.push(component);
      children.set(component.parentId, siblings);
    }
  }

  for (const [parentId, childNodes] of children) {
    const parent = componentsById.get(parentId);
    if (parent?.kind !== "GROUP") {
      throw new Error("Only GROUP nodes may contain children; " + parentId + " is " + parent?.kind + ".");
    }
    children.set(parentId, [...sortNodes(childNodes)]);
  }

  const actualRootIds = new Set(manifest.components.filter((component) => component.parentId === null).map((item) => item.id));
  const declaredRootIds = new Set(manifest.rootComponentIds);
  if (
    actualRootIds.size !== declaredRootIds.size ||
    [...actualRootIds].some((componentId) => !declaredRootIds.has(componentId))
  ) {
    throw new Error("rootComponentIds must exactly match components with parentId=null.");
  }

  const focusIds = new Set(manifest.focusOrder);
  if (focusIds.size !== manifest.focusOrder.length) {
    throw new Error("focusOrder may not contain duplicate component ids.");
  }

  const actionable = manifest.components.filter((component) => ACTION_KINDS.has(component.kind) && component.enabled);
  for (const component of actionable) {
    if (component.actionStepId === null) {
      throw new Error("Enabled action " + component.id + " requires an actionStepId.");
    }
    if (!focusIds.has(component.id)) {
      throw new Error("Enabled action " + component.id + " must occur in focusOrder.");
    }
  }
  for (const componentId of manifest.focusOrder) {
    const component = componentsById.get(componentId);
    if (!component || !ACTION_KINDS.has(component.kind) || !component.enabled) {
      throw new Error("focusOrder may reference only enabled ACTION, CHOICE, or CONSENT nodes.");
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (componentId: string) => {
    if (visiting.has(componentId)) throw new Error("Manifest component graph contains a cycle at " + componentId + ".");
    if (visited.has(componentId)) return;
    visiting.add(componentId);
    for (const child of children.get(componentId) ?? []) visit(child.id);
    visiting.delete(componentId);
    visited.add(componentId);
  };
  for (const rootId of manifest.rootComponentIds) visit(rootId);
  if (visited.size !== manifest.components.length) {
    throw new Error("Every manifest component must be reachable from a declared root.");
  }

  return Object.freeze({
    roots: sortNodes(manifest.components.filter((component) => component.parentId === null)),
    componentsById,
    childrenByParentId: new Map(
      [...children].map(([parentId, childNodes]) => [parentId, Object.freeze([...childNodes])]),
    ),
  });
}

function presentationFor(profile: AccessProfile): AdaptivePresentationMode {
  if (profile.preset === "ONE_SWITCH" || profile.motor.inputMode === "SWITCH") return "one-switch";
  if (profile.preset === "COGNITIVE_LOAD") return "cognitive-load";
  if (profile.preset === "LOW_VISION" || profile.vision.contrast !== "STANDARD") return "high-contrast";
  return "standard";
}

function profileKeyFor(profile: AccessProfile): AdaptiveProfileKey {
  if (profile.preset === "ONE_SWITCH" || profile.motor.inputMode === "SWITCH") return "one-switch";
  if (profile.preset === "COGNITIVE_LOAD") return "cognitive-load";
  return "low-vision";
}

function fontScaleFor(profile: AccessProfile): AdaptiveFontScale {
  if (profile.vision.textScale >= 2 || profile.vision.zoomPercent >= 200) return "x-large";
  if (profile.vision.textScale >= 1.5 || profile.vision.zoomPercent >= 150) return "large";
  return "base";
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown manifest compilation error.";
}

export function AdaptiveCompiler({ manifest, accessProfile, onIntent, footer }: AdaptiveCompilerProps) {
  const validation = useMemo(() => {
    try {
      const parsedManifest = AdaptiveUIManifestSchema.parse(manifest);
      const parsedProfile = AccessProfileSchema.parse(accessProfile);
      if (parsedManifest.accessProfileId !== parsedProfile.id) {
        throw new Error("Manifest and AccessProfile identifiers do not match.");
      }
      const graph = compileManifestGraph(parsedManifest);
      const enabledChoices = parsedManifest.components.filter(
        (component) => component.enabled && component.kind === "CHOICE",
      ).length;
      if (parsedProfile.cognitive.stepAtATime && enabledChoices > parsedProfile.cognitive.maxChoices) {
        throw new Error(
          "Manifest exceeds this profile's maximum of " + parsedProfile.cognitive.maxChoices + " choices.",
        );
      }
      return { ok: true as const, manifest: parsedManifest, profile: parsedProfile, graph };
    } catch (error) {
      return { ok: false as const, message: readableError(error) };
    }
  }, [accessProfile, manifest]);

  const [scanIndex, setScanIndex] = useState(0);
  const [pendingActionStepId, setPendingActionStepId] = useState<string | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState("Ready for a safe selection.");
  const actionRefs = useRef(new Map<string, HTMLButtonElement>());

  const presentationMode = validation.ok ? presentationFor(validation.profile) : "standard";
  const profileKey = validation.ok ? profileKeyFor(validation.profile) : "low-vision";
  const fontScale = validation.ok ? fontScaleFor(validation.profile) : "base";
  const focusOrder = validation.ok ? validation.manifest.focusOrder : [];
  const activeFocusId = focusOrder[scanIndex % Math.max(focusOrder.length, 1)];

  useEffect(() => {
    if (!validation.ok || presentationMode !== "one-switch") return;
    const frame = window.requestAnimationFrame(() => {
      setScanIndex(0);
      const firstActionId = validation.manifest.focusOrder[0];
      if (firstActionId) actionRefs.current.get(firstActionId)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [presentationMode, validation]);

  useEffect(() => {
    if (!validation.ok || presentationMode !== "one-switch" || focusOrder.length === 0) return;
    const intervalMs = validation.profile.motor.scanIntervalMs ?? 1_200;
    const timer = window.setInterval(() => {
      setScanIndex((current) => (current + 1) % focusOrder.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [focusOrder.length, presentationMode, validation]);

  useEffect(() => {
    if (presentationMode !== "one-switch" || !activeFocusId) return;
    actionRefs.current.get(activeFocusId)?.focus();
  }, [activeFocusId, presentationMode]);

  const dispatchAction = useCallback(
    async (component: ManifestNode) => {
      if (!validation.ok || component.actionStepId === null || pendingActionStepId !== null) return;
      const rawIntent: AdaptiveExecutionIntent = {
        type: "ADAPTIVE_ACTION_REQUESTED",
        sessionId: validation.manifest.sessionId,
        manifestId: validation.manifest.id,
        manifestVersion: validation.manifest.version,
        accessProfileId: validation.profile.id,
        componentId: component.id,
        actionStepId: component.actionStepId,
        sourceNodeIds: component.sourceNodeIds,
        entryState: "RISK_GATE",
        requestedState: "EXECUTE_ONE_STEP",
        target: "BROWSER_WORKER",
        idempotencyKey:
          validation.manifest.sessionId +
          ":" +
          validation.manifest.id +
          ":v" +
          validation.manifest.version +
          ":" +
          component.actionStepId,
        occurredAt: new Date().toISOString(),
      };
      const intent = AdaptiveExecutionIntentSchema.parse(rawIntent);
      setPendingActionStepId(intent.actionStepId);
      setDispatchStatus("Sending " + component.label + " to the risk gate.");
      try {
        await onIntent(intent);
        setDispatchStatus("Risk-gated EXECUTE_ONE_STEP request accepted for " + component.label + ".");
      } catch (error) {
        setDispatchStatus("Execution request stopped safely: " + readableError(error));
      } finally {
        setPendingActionStepId(null);
      }
    },
    [onIntent, pendingActionStepId, validation],
  );

  const handleCompilerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (presentationMode !== "one-switch" || focusOrder.length === 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setScanIndex((current) => (current + 1) % focusOrder.length);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setScanIndex((current) => (current - 1 + focusOrder.length) % focusOrder.length);
    }
  };

  if (!validation.ok) {
    return (
      <section
        aria-labelledby="adaptive-surface-title"
        className="adaptive-surface adaptive-compiler adaptive-compiler-error"
        data-adaptive-compiler="true"
      >
        <div className="adaptive-surface-intro">
          <span className="adaptive-kicker">Compiler stopped safely</span>
          <h2 id="adaptive-surface-title">Adaptive surface unavailable</h2>
          <p role="alert">{validation.message}</p>
        </div>
      </section>
    );
  }

  const styleProps = {
    presentationMode,
    fontScale,
    reduceMotion: validation.profile.vision.reduceMotion,
  } as const;

  const renderNode = (node: ManifestNode): ReactNode => {
    const childNodes = validation.graph.childrenByParentId.get(node.id) ?? [];
    if (node.kind === "HEADING") {
      return (
        <AdaptiveText
          {...styleProps}
          description={node.description}
          headingLevel={3}
          id={"adaptive-node-" + node.id}
          label={node.label}
          variant="heading"
        />
      );
    }
    if (node.kind === "STATUS") {
      return <AdaptiveText {...styleProps} description={node.description} label={node.label} variant="status" />;
    }
    if (node.kind === "TEXT" || node.kind === "FIELD" || node.kind === "SUMMARY") {
      return (
        <AdaptiveText
          {...styleProps}
          description={node.description}
          label={node.label}
          variant={node.kind === "SUMMARY" ? "summary" : "body"}
        />
      );
    }
    if (node.kind === "GROUP") {
      return (
        <section aria-label={node.label} className="adaptive-group">
          <AdaptiveText {...styleProps} description={node.description} label={node.label} variant="heading" />
          <AdaptiveList {...styleProps} label={node.label + " options"}>
            {childNodes.map((child) => (
              <li className="adaptive-list-item" key={child.id}>
                {renderNode(child)}
              </li>
            ))}
          </AdaptiveList>
        </section>
      );
    }

    const actionButton = (
      <AdaptiveButton
        {...styleProps}
        actionStepId={node.actionStepId}
        aria-keyshortcuts="Enter Space"
        description={node.description}
        disabled={!node.enabled || pendingActionStepId !== null}
        importance={node.importance}
        label={node.label}
        onClick={() => void dispatchAction(node)}
        ref={(element) => {
          if (element) actionRefs.current.set(node.id, element);
          else actionRefs.current.delete(node.id);
        }}
        scanActive={presentationMode === "one-switch" && activeFocusId === node.id}
        tabIndex={presentationMode === "one-switch" ? (activeFocusId === node.id ? 0 : -1) : 0}
      />
    );

    if (node.kind === "CONSENT") {
      return (
        <AdaptiveModal
          {...styleProps}
          description={node.description ?? "Review the exact irreversible action before continuing."}
          open={node.enabled}
          required
          title={node.label}
        >
          {actionButton}
        </AdaptiveModal>
      );
    }
    return actionButton;
  };

  return (
    <section
      aria-labelledby="adaptive-surface-title"
      className="adaptive-surface adaptive-compiler"
      data-adaptive-compiler="true"
      data-contrast={validation.profile.vision.contrast.toLowerCase()}
      data-font-scale={fontScale}
      data-plain-language={validation.profile.cognitive.plainLanguage ? "true" : "false"}
      data-presentation-mode={presentationMode}
      data-profile={profileKey}
      data-reduce-motion={validation.profile.vision.reduceMotion ? "true" : "false"}
      data-step-at-a-time={validation.profile.cognitive.stepAtATime ? "true" : "false"}
      onKeyDown={handleCompilerKeyDown}
    >
      <div className="adaptive-surface-intro">
        <span className="adaptive-kicker">Compiled adaptive surface</span>
        <h2 id="adaptive-surface-title">{validation.manifest.title}</h2>
        <p aria-live="polite">{validation.manifest.announcement}</p>
      </div>

      <AdaptiveList {...styleProps} label={validation.manifest.title} layout="component-stack">
        {validation.graph.roots.map((node) => (
          <li className="adaptive-list-item" key={node.id}>
            {renderNode(node)}
          </li>
        ))}
      </AdaptiveList>

      {presentationMode === "one-switch" && focusOrder.length > 0 ? (
        <div aria-atomic="true" aria-live="polite" className="adaptive-scan-status" role="status">
          Scan stop {scanIndex % focusOrder.length + 1} of {focusOrder.length}
        </div>
      ) : null}

      <footer className="adaptive-surface-footer">
        <div className="adaptive-dispatch-status" role="status">
          <span aria-hidden="true">{"\u2713"}</span>
          <p>
            <strong>{dispatchStatus}</strong>
            <small>Every action enters RISK_GATE before one browser step can execute.</small>
          </p>
        </div>
        {footer}
      </footer>
    </section>
  );
}
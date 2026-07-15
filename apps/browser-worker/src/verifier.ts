import { randomUUID } from "node:crypto";
import {
  ActionStepSchema,
  VerificationResultSchema,
  type ActionStep,
  type VerificationResult,
} from "@morph/contracts";
import type { MachineSignal } from "@morph/state-machine";
import {
  PlaywrightBrowserWorker,
  type FreshStateCapture,
} from "./worker.js";

interface PostconditionEvaluation {
  readonly condition: string;
  readonly status: "SATISFIED" | "MISMATCH" | "UNSUPPORTED";
  readonly detail: string;
}

export interface VerificationBundle {
  readonly freshState: FreshStateCapture;
  readonly result: VerificationResult;
}

function normalized(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function visibleSurfaceText(freshState: FreshStateCapture): readonly string[] {
  return freshState.records
    .filter((record) => record.visible)
    .flatMap((record) => [record.name, record.value])
    .filter((value): value is string => value !== null)
    .map(normalized);
}

function payload(condition: string, prefix: string): string | null {
  if (!condition.startsWith(prefix)) return null;
  const value = condition.slice(prefix.length).trim();
  return value.length === 0 ? null : value;
}

function evaluatePostcondition(
  condition: string,
  freshState: FreshStateCapture,
  visibleText: readonly string[],
): PostconditionEvaluation {
  const visible = payload(condition, "VISIBLE_TEXT:");
  if (visible !== null) {
    const expected = normalized(visible);
    const matched = visibleText.some((text) => text.includes(expected));
    return {
      condition,
      status: matched ? "SATISFIED" : "MISMATCH",
      detail: matched
        ? `Fresh evidence contains visible text: ${visible}`
        : `Fresh evidence does not contain visible text: ${visible}`,
    };
  }

  const absent = payload(condition, "ABSENT_VISIBLE_TEXT:");
  if (absent !== null) {
    const unexpected = visibleText.some((text) => text.includes(normalized(absent)));
    return {
      condition,
      status: unexpected ? "MISMATCH" : "SATISFIED",
      detail: unexpected
        ? `Unexpected visible text appeared: ${absent}`
        : `Fresh evidence confirms visible text is absent: ${absent}`,
    };
  }

  const url = payload(condition, "URL_EQUALS:");
  if (url !== null) {
    const matches = freshState.url === url;
    return {
      condition,
      status: matches ? "SATISFIED" : "MISMATCH",
      detail: matches ? `URL equals ${url}` : `Observed URL ${freshState.url} does not equal ${url}`,
    };
  }

  const title = payload(condition, "TITLE_EQUALS:");
  if (title !== null) {
    const matches = normalized(freshState.title) === normalized(title);
    return {
      condition,
      status: matches ? "SATISFIED" : "MISMATCH",
      detail: matches
        ? `Title equals ${title}`
        : `Observed title ${freshState.title} does not equal ${title}`,
    };
  }

  if (condition === "NO_VISIBLE_DIALOG") {
    const dialog = freshState.records.find(
      (record) => record.visible && record.role?.toLocaleLowerCase() === "dialog",
    );
    return {
      condition,
      status: dialog === undefined ? "SATISFIED" : "MISMATCH",
      detail:
        dialog === undefined
          ? "No visible dialog exists in fresh accessibility evidence."
          : `Unexpected dialog appeared: ${dialog.name ?? dialog.recordId}`,
    };
  }

  return {
    condition,
    status: "UNSUPPORTED",
    detail: `Unsupported deterministic postcondition grammar: ${condition}`,
  };
}

export function verifyPostConditions(
  actionStepValue: ActionStep,
  freshState: FreshStateCapture,
  sessionId: string,
): VerificationResult {
  const actionStep = ActionStepSchema.parse(actionStepValue);
  const text = visibleSurfaceText(freshState);
  const evaluations = actionStep.expectedPostconditions.map((condition) =>
    evaluatePostcondition(condition, freshState, text),
  );
  const mismatches = evaluations
    .filter((evaluation) => evaluation.status === "MISMATCH")
    .map((evaluation) => evaluation.detail);
  if (freshState.pageVersion <= actionStep.pageVersion) {
    mismatches.unshift(
      `Verification requires a fresh page version after ${actionStep.pageVersion}; observed ${freshState.pageVersion}.`,
    );
  }
  const unsupported = evaluations
    .filter((evaluation) => evaluation.status === "UNSUPPORTED")
    .map((evaluation) => evaluation.detail);
  const satisfied = evaluations
    .filter((evaluation) => evaluation.status === "SATISFIED")
    .map((evaluation) => evaluation.condition);
  const outcome =
    mismatches.length > 0 ? "MISMATCH" : unsupported.length > 0 ? "INCONCLUSIVE" : "MATCH";

  return VerificationResultSchema.parse({
    id: randomUUID(),
    sessionId,
    actionStepId: actionStep.id,
    expectedPageVersion: actionStep.pageVersion,
    observedPageVersion: freshState.pageVersion,
    outcome,
    evidenceIds: [
      freshState.artifacts.screenshot.evidenceId,
      freshState.artifacts.domSnapshot.evidenceId,
      freshState.artifacts.accessibilityTree.evidenceId,
    ],
    satisfiedPostconditions: satisfied,
    mismatches: outcome === "INCONCLUSIVE" ? unsupported : mismatches,
    verifier: "DETERMINISTIC",
    verifiedAt: new Date().toISOString(),
  });
}

export function verificationToMachineSignal(
  resultValue: VerificationResult,
  hasNextStep = false,
): MachineSignal {
  const result = VerificationResultSchema.parse(resultValue);
  if (result.outcome === "MATCH") {
    return {
      type: "VERIFICATION_MATCH",
      hasNextStep,
      detail: "Deterministic fresh-state verification matched.",
    };
  }
  if (result.outcome === "MISMATCH") {
    return {
      type: "VERIFICATION_MISMATCH",
      detail: result.mismatches.join(" "),
    };
  }
  return {
    type: "VERIFICATION_INCONCLUSIVE",
    ambiguityIds: [result.id],
    question: "Fresh evidence was insufficient for deterministic verification. Review before continuing.",
    detail: result.mismatches.join(" ") || "Deterministic verification was inconclusive.",
  };
}
export async function captureAndVerify(
  worker: PlaywrightBrowserWorker,
  actionStep: ActionStep,
  sessionId: string,
): Promise<VerificationBundle> {
  const freshState = await worker.captureFreshState();
  return Object.freeze({
    freshState,
    result: verifyPostConditions(actionStep, freshState, sessionId),
  });
}

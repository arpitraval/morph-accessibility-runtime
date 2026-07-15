import { createHash } from "node:crypto";
import {
  ACTION_OPERATION_CLASS,
  ALLOWED_RISK_CLASSES_BY_OPERATION,
  ActionStepSchema,
  ConsentRecordSchema,
  type ActionOperationClass,
  type ActionStep,
  type ConsentRecord,
  type WorkflowState,
} from "@morph/contracts";
import {
  PlaywrightBrowserWorker,
  type ResolvedTarget,
} from "./worker.js";

type CommandKind = ActionStep["command"]["kind"];
type OperationClass = ActionOperationClass;

export interface ExecutionAuthorization {
  readonly sessionId: string;
  readonly workflowState: WorkflowState;
  readonly currentPageVersion: number;
  readonly simulationPassed: boolean;
  /** Must be derived from replaying the durable event log, never a mutable in-process flag. */
  readonly consentTransitionObserved: boolean;
  readonly consentRecord: unknown | null;
}

export interface ExecutionAuthority {
  readAuthorization(actionStep: ActionStep): Promise<ExecutionAuthorization>;
}

export interface ExecutionReceipt {
  readonly actionStepId: string;
  readonly commandKind: CommandKind;
  readonly targetNodeId: string | null;
  readonly pageVersion: number;
  readonly locatorStrategy: string | null;
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface ExecutionEngine {
  executeOneStep(actionStep: ActionStep): Promise<ExecutionReceipt>;
}

export class ExecutionPolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ExecutionPolicyError";
  }
}

export function actionStepHash(actionStep: ActionStep): string {
  const parsed = ActionStepSchema.parse(actionStep);
  return createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
}

function assertRiskClassification(actionStep: ActionStep): OperationClass {
  const operationClass = ACTION_OPERATION_CLASS[actionStep.command.kind];
  const allowedRiskClasses = ALLOWED_RISK_CLASSES_BY_OPERATION[operationClass] as readonly string[];
  if (!allowedRiskClasses.includes(actionStep.riskClass)) {
    throw new ExecutionPolicyError(
      `${actionStep.command.kind} is ${operationClass} and cannot execute as ${actionStep.riskClass}.`,
    );
  }
  if (actionStep.riskClass === "RX" || actionStep.executionPolicy === "DENY") {
    throw new ExecutionPolicyError("Denied actions may never reach the browser worker.");
  }
  if (operationClass === "IRREVERSIBLE") {
    if (actionStep.reversible || actionStep.executionPolicy !== "REQUIRE_CONSENT") {
      throw new ExecutionPolicyError("Irreversible actions must be R4 and REQUIRE_CONSENT.");
    }
  } else if (!actionStep.reversible || actionStep.executionPolicy !== "ALLOW_AFTER_SIMULATION") {
    throw new ExecutionPolicyError(
      "Read and reversible-write actions must be reversible and allowed only after simulation.",
    );
  }
  return operationClass;
}

function assertConsent(
  actionStep: ActionStep,
  authorization: ExecutionAuthorization,
): ConsentRecord {
  if (!authorization.consentTransitionObserved) {
    throw new ExecutionPolicyError(
      "Irreversible execution bypassed the durable REQUIRE_CONSENT transition.",
    );
  }
  const consent = ConsentRecordSchema.parse(authorization.consentRecord);
  if (
    consent.sessionId !== authorization.sessionId ||
    consent.actionStepId !== actionStep.id ||
    consent.pageVersion !== actionStep.pageVersion ||
    consent.status !== "GRANTED"
  ) {
    throw new ExecutionPolicyError("Consent does not authorize this exact action and page version.");
  }
  if (consent.exactActionHash !== actionStepHash(actionStep)) {
    throw new ExecutionPolicyError("Consent action hash does not match the proposed ActionStep.");
  }
  if (Date.parse(consent.expiresAt) <= Date.now()) {
    throw new ExecutionPolicyError("Consent expired before browser execution.");
  }
  return consent;
}

async function requiredTarget(
  worker: PlaywrightBrowserWorker,
  actionStep: ActionStep,
): Promise<ResolvedTarget> {
  if (actionStep.targetNodeId === null) {
    throw new ExecutionPolicyError(`${actionStep.command.kind} requires a targetNodeId.`);
  }
  return worker.resolveTarget(actionStep.targetNodeId, actionStep.pageVersion);
}

async function executeMappedCommand(
  worker: PlaywrightBrowserWorker,
  actionStep: ActionStep,
): Promise<string | null> {
  const { command } = actionStep;
  if (command.kind === "OBSERVE") {
    if (command.scope === "TARGET") {
      const target = await requiredTarget(worker, actionStep);
      await target.locator.waitFor({ state: "visible" });
      return target.strategy;
    }
    await worker.currentPage().waitForLoadState("domcontentloaded");
    return null;
  }

  if (command.kind === "NAVIGATE") {
    if (command.destination === "BACK") {
      await worker.currentPage().goBack({ waitUntil: "domcontentloaded" });
    } else if (command.destination === "FORWARD") {
      await worker.currentPage().goForward({ waitUntil: "domcontentloaded" });
    } else {
      if (command.url === null) {
        throw new ExecutionPolicyError("URL navigation requires a destination URL.");
      }
      await worker.navigateTo(command.url);
    }
    return null;
  }

  const target = await requiredTarget(worker, actionStep);
  switch (command.kind) {
    case "FOCUS":
      await target.locator.focus();
      break;
    case "EXPAND":
      await target.locator.click();
      break;
    case "INPUT_TEXT":
      await target.locator.fill(command.valueToken);
      break;
    case "SELECT": {
      const tagName = await target.locator.evaluate((element) => element.tagName.toLowerCase());
      if (tagName === "select") {
        let selected = await target.locator.selectOption({ label: command.valueToken });
        if (selected.length === 0) selected = await target.locator.selectOption(command.valueToken);
        if (selected.length === 0) {
          throw new ExecutionPolicyError("No select option matched the supplied value token.");
        }
      } else {
        await target.locator.click();
      }
      break;
    }
    case "ADD_OPTION": {
      const type = await target.locator.getAttribute("type");
      if (type === "checkbox" || type === "radio") await target.locator.check();
      else await target.locator.click();
      break;
    }
    case "REMOVE_OPTION": {
      const type = await target.locator.getAttribute("type");
      if (type === "checkbox") await target.locator.uncheck();
      else await target.locator.click();
      break;
    }
    case "SUBMIT":
      await target.locator.click();
      break;

  }
  return target.strategy;
}

export function createExecutionEngine(
  worker: PlaywrightBrowserWorker,
  authority: ExecutionAuthority,
): ExecutionEngine {
  let active = false;

  return Object.freeze({
    async executeOneStep(actionStepValue: ActionStep): Promise<ExecutionReceipt> {
      const actionStep = ActionStepSchema.parse(actionStepValue);
      const operationClass = assertRiskClassification(actionStep);
      if (active) {
        throw new ExecutionPolicyError("Only one browser action may execute at a time.");
      }
      active = true;
      try {
        const authorization = await authority.readAuthorization(actionStep);
        if (authorization.workflowState !== "EXECUTE_ONE_STEP") {
          throw new ExecutionPolicyError(
            `Durable workflow state is ${authorization.workflowState}, not EXECUTE_ONE_STEP.`,
          );
        }
        if (!authorization.simulationPassed) {
          throw new ExecutionPolicyError("ActionPlan simulation has not passed.");
        }
        if (
          authorization.currentPageVersion !== actionStep.pageVersion ||
          worker.currentPageVersion !== actionStep.pageVersion
        ) {
          throw new ExecutionPolicyError("ActionStep page version is stale.");
        }
        if (operationClass === "IRREVERSIBLE") {
          assertConsent(actionStep, authorization);
        }

        const startedAt = new Date().toISOString();
        const locatorStrategy = await executeMappedCommand(worker, actionStep);
        return Object.freeze({
          actionStepId: actionStep.id,
          commandKind: actionStep.command.kind,
          targetNodeId: actionStep.targetNodeId,
          pageVersion: actionStep.pageVersion,
          locatorStrategy,
          startedAt,
          completedAt: new Date().toISOString(),
        });
      } finally {
        active = false;
      }
    },
  });
}

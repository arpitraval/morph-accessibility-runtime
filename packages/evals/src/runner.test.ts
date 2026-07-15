import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_PROFILE_EVAL_FIXTURES,
  assertNoUnconsentedIrreversibleActions,
  EvaluationSafetyError,
  LAYOUT_EVAL_FIXTURES,
  runEvaluationMatrix,
  TASK_INTENT_FIXTURES,
} from "./runner.js";

test("runs the complete deterministic 5 x 3 x 2 evaluation matrix", () => {
  const report = runEvaluationMatrix();
  const expectedCases =
    LAYOUT_EVAL_FIXTURES.length *
    ACCESS_PROFILE_EVAL_FIXTURES.length *
    TASK_INTENT_FIXTURES.length;

  assert.equal(expectedCases, 30);
  assert.equal(report.cases.length, 30);
  assert.equal(new Set(report.cases.map((scenario) => scenario.scenarioId)).size, 30);
  assert.equal(report.summary.scenarioCount, 30);
  assert.equal(report.summary.taskCompletionRate, 1);
  assert.equal(report.summary.constraintSatisfactionRate, 1);
  assert.equal(report.summary.accessibilityViolations, 0);
  assert.equal(report.summary.sourceAccessibilityViolations, 480);
  assert.equal(report.summary.totalRetries, 12);
  assert.equal(report.summary.meanRetries, 0.4);
  assert.equal(report.summary.unconsentedIrreversibleActions, 0);
});

test("evaluation output is byte-reproducible for the frozen seed", () => {
  const first = runEvaluationMatrix();
  const second = runEvaluationMatrix();

  assert.deepEqual(second, first);
  assert.equal(
    first.fingerprint,
    "7b9e3c1d5eaf9571553b7a0ca45c72c0047f10a2e58c728d91568a10be6291c3",
  );
});

test("any unconsented irreversible action fails the build gate", () => {
  const report = runEvaluationMatrix();
  assert.throws(
    () =>
      assertNoUnconsentedIrreversibleActions({
        summary: {
          ...report.summary,
          unconsentedIrreversibleActions: 1,
        },
      }),
    EvaluationSafetyError,
  );
});
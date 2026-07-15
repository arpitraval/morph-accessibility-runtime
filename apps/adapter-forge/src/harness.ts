import vm from "node:vm";
import axe from "axe-core";
import { chromium, type Locator, type Page } from "playwright";
import ts from "typescript";
import { z } from "zod";
import {
  AdapterProjectionSchema,
  sanitizeTargetDom,
  type AdapterForgeRequest,
  type AdapterProjection,
  type LocatorSpec,
} from "./forge.js";

const MAX_POLICY_NODES = 2_500;
const VM_TIMEOUT_MS = 250;

const FailureSchema = z.string().trim().min(1).max(2_000);

export const ForgeTestReportSchema = z
  .object({
    passed: z.boolean(),
    unitPassed: z.number().int().nonnegative(),
    browserPassed: z.number().int().nonnegative(),
    accessibilityCriticalViolations: z.number().int().nonnegative(),
    accessibilitySeriousViolations: z.number().int().nonnegative(),
    policyPassed: z.boolean(),
    failures: z.array(FailureSchema).max(30),
  })
  .strict();
export type ForgeTestReport = z.infer<typeof ForgeTestReportSchema>;

interface RuntimeAdapter {
  readonly name: string;
  readonly version: number;
  matches(fixture: SurfaceFixture): boolean;
  project(fixture: SurfaceFixture): unknown;
}

interface SurfaceFixture {
  readonly origin: string;
  readonly taskFamily: string;
  readonly records: AdapterForgeRequest["surfaceRecords"];
  readonly requiredActionIds: readonly string[];
}

interface PolicyResult {
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly transpiledSource: string | null;
}

const FORBIDDEN_IDENTIFIERS = new Set([
  "Atomics",
  "Bun",
  "Date",
  "Deno",
  "Function",
  "SharedArrayBuffer",
  "Worker",
  "WebSocket",
  "XMLHttpRequest",
  "eval",
  "fetch",
  "global",
  "globalThis",
  "process",
  "crypto",
  "performance",
  "require",
  "setImmediate",
  "setInterval",
  "setTimeout",
]);

const FORBIDDEN_PROPERTIES = new Set([
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  "__proto__",
  "constructor",
  "prototype",
]);

const ALLOWED_METHOD_CALLS = new Set([
  "endsWith",
  "every",
  "filter",
  "find",
  "includes",
  "map",
  "slice",
  "some",
  "startsWith",
  "toLowerCase",
  "trim",
]);

const ALLOWED_ARIA_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "listbox",
  "menuitem",
  "option",
  "radio",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
]);

function boundedFailure(message: string): string {
  const trimmed = message
    .replace(/[A-Za-z]:\\[^\r\n]+/g, "[LOCAL_PATH]")
    .replace(/https?:\/\/[^\s]+/g, "[URL]")
    .trim()
    .slice(0, 2_000);
  return trimmed.length > 0 ? trimmed : "Unspecified validation failure.";
}

function inspectPolicy(source: string): PolicyResult {
  const failures: string[] = [];
  const sourceFile = ts.createSourceFile(
    "adapter.ts",
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );

  if (sourceFile.statements.length !== 1) {
    failures.push("Policy: adapter.ts must contain exactly one top-level declaration.");
  }

  const statement = sourceFile.statements[0];
  if (!statement || !ts.isVariableStatement(statement)) {
    failures.push("Policy: the sole declaration must be export const adapter.");
  } else {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ) ?? false;
    const isConst =
      (statement.declarationList.flags & ts.NodeFlags.Const) === ts.NodeFlags.Const;
    const declarations = statement.declarationList.declarations;
    const declaration = declarations[0];
    if (
      !exported ||
      !isConst ||
      declarations.length !== 1 ||
      !declaration ||
      !ts.isIdentifier(declaration.name) ||
      declaration.name.text !== "adapter" ||
      !declaration.initializer ||
      !ts.isObjectLiteralExpression(declaration.initializer)
    ) {
      failures.push("Policy: export exactly one object literal named adapter.");
    }
  }

  let visited = 0;
  const visit = (node: ts.Node): void => {
    visited += 1;
    if (visited > MAX_POLICY_NODES) return;

    if (
      ts.isImportDeclaration(node) ||
      ts.isImportEqualsDeclaration(node) ||
      ts.isExportDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isNewExpression(node) ||
      ts.isAwaitExpression(node) ||
      ts.isYieldExpression(node) ||
      ts.isWithStatement(node) ||
      ts.isDeleteExpression(node)
    ) {
      failures.push("Policy: imports, classes, constructors, async control, and dynamic mutation are forbidden.");
    }

    if (ts.isIdentifier(node) && FORBIDDEN_IDENTIFIERS.has(node.text)) {
      failures.push("Policy: forbidden capability identifier: " + node.text + ".");
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      FORBIDDEN_PROPERTIES.has(node.name.text)
    ) {
      failures.push("Policy: prototype or constructor access is forbidden.");
    }
    if (ts.isPropertyAssignment(node)) {
      const propertyName =
        ts.isIdentifier(node.name) ||
        ts.isStringLiteral(node.name) ||
        ts.isNumericLiteral(node.name) ||
        ts.isNoSubstitutionTemplateLiteral(node.name)
          ? node.name.text
          : null;
      if (propertyName !== null && FORBIDDEN_PROPERTIES.has(propertyName)) {
        failures.push("Policy: prototype or constructor access is forbidden.");
      }
    }

    if (ts.isElementAccessExpression(node)) {
      const argument = node.argumentExpression;
      if (!argument || (!ts.isStringLiteral(argument) && !ts.isNumericLiteral(argument))) {
        failures.push("Policy: computed property access must use a literal key.");
      }
      if (argument && ts.isStringLiteral(argument) && FORBIDDEN_PROPERTIES.has(argument.text)) {
        failures.push("Policy: prototype or constructor access is forbidden.");
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      failures.push("Policy: assignments are forbidden; adapters must be pure projections.");
    }
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
      if (
        node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken
      ) {
        failures.push("Policy: update operators are forbidden.");
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (!ALLOWED_METHOD_CALLS.has(method)) {
        failures.push("Policy: method call is not allowlisted: " + method + ".");
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (visited > MAX_POLICY_NODES) {
    failures.push("Policy: adapter AST exceeds the bounded complexity limit.");
  }

  const uniqueFailures = [...new Set(failures)].slice(0, 30);
  if (uniqueFailures.length > 0) {
    return { passed: false, failures: uniqueFailures, transpiledSource: null };
  }

  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      isolatedModules: true,
      removeComments: true,
    },
    fileName: "adapter.ts",
    reportDiagnostics: true,
  });
  const diagnostics = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (diagnostics.length > 0) {
    return {
      passed: false,
      failures: diagnostics.slice(0, 20).map((diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
        return boundedFailure("TypeScript: " + message);
      }),
      transpiledSource: null,
    };
  }

  return { passed: true, failures: [], transpiledSource: compiled.outputText };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function fixtureFor(request: AdapterForgeRequest): SurfaceFixture {
  return deepFreeze({
    origin: request.origin,
    taskFamily: request.taskFamily,
    records: structuredClone(request.surfaceRecords),
    requiredActionIds: [...request.requiredActionIds],
  });
}

function executeAdapter(
  transpiledSource: string,
  fixture: SurfaceFixture,
): { adapter: RuntimeAdapter; projection: AdapterProjection } {
  const sandbox = Object.create(null) as {
    exports: Record<string, unknown>;
    fixture?: SurfaceFixture;
  };
  sandbox.exports = Object.create(null) as Record<string, unknown>;
  const context = vm.createContext(sandbox, {
    name: "morph-adapter-policy-vm",
    codeGeneration: { strings: false, wasm: false },
  });
  new vm.Script(transpiledSource, { filename: "adapter.compiled.js" }).runInContext(context, {
    timeout: VM_TIMEOUT_MS,
    breakOnSigint: true,
  });

  const candidate = sandbox.exports.adapter;
  if (candidate === null || typeof candidate !== "object") {
    throw new Error("Unit: compiled module did not export an adapter object.");
  }
  const adapter = candidate as RuntimeAdapter;
  if (
    typeof adapter.name !== "string" ||
    adapter.name.trim().length === 0 ||
    adapter.name.length > 120 ||
    adapter.version !== 1 ||
    typeof adapter.matches !== "function" ||
    typeof adapter.project !== "function"
  ) {
    throw new Error("Unit: adapter metadata or callable contract is invalid.");
  }

  sandbox.fixture = fixture;
  const matches = new vm.Script(
    "Boolean(exports.adapter.matches(fixture))",
    { filename: "adapter.matches.js" },
  ).runInContext(context, { timeout: VM_TIMEOUT_MS, breakOnSigint: true });
  if (matches !== true) {
    throw new Error("Unit: adapter.matches rejected its own target fixture.");
  }

  const rawProjection = new vm.Script(
    "exports.adapter.project(fixture)",
    { filename: "adapter.project.js" },
  ).runInContext(context, { timeout: VM_TIMEOUT_MS, breakOnSigint: true });
  delete sandbox.fixture;
  return { adapter, projection: AdapterProjectionSchema.parse(rawProjection) };
}

function validateProjection(
  projection: AdapterProjection,
  request: AdapterForgeRequest,
): readonly string[] {
  const failures: string[] = [];
  const records = new Map(request.surfaceRecords.map((record) => [record.id, record]));
  const actionIds = new Set<string>();
  const projectedSourceIds = new Set<string>();

  for (const action of projection.actions) {
    if (actionIds.has(action.id)) {
      failures.push("Unit: projected action ids must be unique.");
    }
    actionIds.add(action.id);
    projectedSourceIds.add(action.sourceNodeId);
    const source = records.get(action.sourceNodeId);
    if (!source) {
      failures.push("Unit: action " + action.id + " references an unknown source node.");
      continue;
    }
    if (!source.interactive || !source.visible || source.disabled) {
      failures.push("Unit: action " + action.id + " references an unavailable source node.");
    }
    if (action.target.strategy === "CSS") {
      if (action.target.value !== source.selector) {
        failures.push("Policy: CSS targets must equal the redacted source record selector.");
      }
      if (/^(?:internal:|role=|text=|xpath=)|>>/i.test(action.target.value)) {
        failures.push("Policy: CSS targets cannot invoke a Playwright selector engine.");
      }
    }
    if (action.target.strategy === "ROLE") {
      if (!source.role || action.target.value !== source.role) {
        failures.push("Policy: ROLE targets must equal the redacted source role.");
      }
      if (action.target.accessibleName !== source.name) {
        failures.push("Policy: ROLE accessible names must equal the redacted source name.");
      }
    }
    if (action.target.strategy === "TEXT" && action.target.value !== source.name) {
      failures.push("Policy: TEXT targets must equal the redacted source name.");
    }
  }

  for (const requiredId of request.requiredActionIds) {
    if (!projectedSourceIds.has(requiredId)) {
      failures.push("Unit: required surface action was not projected: " + requiredId + ".");
    }
  }
  return [...new Set(failures)];
}

function resolveLocator(page: Page, target: LocatorSpec): Locator {
  if (target.strategy === "CSS") return page.locator(target.value);
  if (target.strategy === "TEXT") return page.getByText(target.value, { exact: true });
  if (!ALLOWED_ARIA_ROLES.has(target.value)) {
    throw new Error("Browser: generated ROLE target is not allowlisted.");
  }
  const role = target.value as Parameters<Page["getByRole"]>[0];
  return target.accessibleName === null
    ? page.getByRole(role, { exact: true })
    : page.getByRole(role, { name: target.accessibleName, exact: true });
}

const AxeResultSchema = z
  .object({
    violations: z.array(
      z
        .object({
          id: z.string(),
          impact: z.enum(["minor", "moderate", "serious", "critical"]).nullable(),
          nodes: z.array(z.unknown()),
        })
        .passthrough(),
    ),
  })
  .passthrough();

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function previewHtml(projection: AdapterProjection): string {
  const actions = projection.actions
    .map(
      (action) =>
        '<li><button type="button" aria-label="' +
        escapeHtml(action.label) +
        '">' +
        escapeHtml(action.label) +
        "</button><p>" +
        escapeHtml(action.description) +
        "</p></li>",
    )
    .join("");
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' +
    escapeHtml(projection.heading) +
    "</title></head><body><main><h1>" +
    escapeHtml(projection.heading) +
    "</h1><p>" +
    escapeHtml(projection.summary) +
    "</p><ul>" +
    actions +
    "</ul></main></body></html>"
  );
}

async function runBrowserAndAxe(
  projection: AdapterProjection,
  request: AdapterForgeRequest,
): Promise<{
  browserPassed: number;
  accessibilityCriticalViolations: number;
  accessibilitySeriousViolations: number;
  failures: readonly string[];
}> {
  const failures: string[] = [];
  let browserPassed = 0;
  let accessibilityCriticalViolations = 0;
  let accessibilitySeriousViolations = 0;
  const browser = await chromium.launch({ headless: true, timeout: 10_000 });
  try {
    const context = await browser.newContext({
      javaScriptEnabled: true,
      permissions: [],
      serviceWorkers: "block",
    });
    await context.route("**/*", async (route) => {
      await route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    await page.setContent(sanitizeTargetDom(request.redactedDom), {
      waitUntil: "domcontentloaded",
      timeout: 5_000,
    });

    for (const action of projection.actions) {
      try {
        const locator = resolveLocator(page, action.target);
        const count = await locator.count();
        if (count !== 1) {
          failures.push(
            "Browser: action " + action.id + " resolved to " + String(count) + " nodes; exactly one is required.",
          );
          continue;
        }
        if (!(await locator.isVisible())) {
          failures.push("Browser: action " + action.id + " resolved to a hidden node.");
          continue;
        }
        browserPassed += 1;
      } catch (error) {
        failures.push(
          boundedFailure(
            "Browser: action " +
              action.id +
              " failed locator validation: " +
              (error instanceof Error ? error.message : "unknown error"),
          ),
        );
      }
    }

    await page.setContent(previewHtml(projection), {
      waitUntil: "domcontentloaded",
      timeout: 5_000,
    });
    await page.addScriptTag({ content: axe.source });
    const axeResult = AxeResultSchema.parse(
      await page.evaluate("axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })"),
    );
    for (const violation of axeResult.violations) {
      const nodeCount = Math.max(1, violation.nodes.length);
      if (violation.impact === "critical") accessibilityCriticalViolations += nodeCount;
      if (violation.impact === "serious") accessibilitySeriousViolations += nodeCount;
    }
    if (accessibilityCriticalViolations > 0 || accessibilitySeriousViolations > 0) {
      failures.push(
        "Accessibility: axe found " +
          String(accessibilityCriticalViolations) +
          " critical and " +
          String(accessibilitySeriousViolations) +
          " serious violations.",
      );
    }
    await context.close();
  } finally {
    await browser.close();
  }
  return {
    browserPassed,
    accessibilityCriticalViolations,
    accessibilitySeriousViolations,
    failures,
  };
}

export async function validateAdapterSource(
  source: string,
  request: AdapterForgeRequest,
): Promise<ForgeTestReport> {
  const policy = inspectPolicy(source);
  if (!policy.passed || policy.transpiledSource === null) {
    return ForgeTestReportSchema.parse({
      passed: false,
      unitPassed: 0,
      browserPassed: 0,
      accessibilityCriticalViolations: 0,
      accessibilitySeriousViolations: 0,
      policyPassed: false,
      failures: policy.failures,
    });
  }

  let projection: AdapterProjection;
  try {
    const executed = executeAdapter(policy.transpiledSource, fixtureFor(request));
    projection = executed.projection;
  } catch (error) {
    return ForgeTestReportSchema.parse({
      passed: false,
      unitPassed: 0,
      browserPassed: 0,
      accessibilityCriticalViolations: 0,
      accessibilitySeriousViolations: 0,
      policyPassed: true,
      failures: [
        boundedFailure(
          error instanceof z.ZodError
            ? "Unit: adapter projection failed the closed schema."
            : error instanceof Error
              ? error.message
              : "Unit: adapter execution failed.",
        ),
      ],
    });
  }

  const projectionFailures = validateProjection(projection, request);
  if (projectionFailures.length > 0) {
    return ForgeTestReportSchema.parse({
      passed: false,
      unitPassed: 1,
      browserPassed: 0,
      accessibilityCriticalViolations: 0,
      accessibilitySeriousViolations: 0,
      policyPassed: true,
      failures: projectionFailures,
    });
  }

  try {
    const browser = await runBrowserAndAxe(projection, request);
    const passed =
      browser.failures.length === 0 &&
      browser.browserPassed === projection.actions.length &&
      browser.accessibilityCriticalViolations === 0 &&
      browser.accessibilitySeriousViolations === 0;
    return ForgeTestReportSchema.parse({
      passed,
      unitPassed: 2,
      browserPassed: browser.browserPassed,
      accessibilityCriticalViolations: browser.accessibilityCriticalViolations,
      accessibilitySeriousViolations: browser.accessibilitySeriousViolations,
      policyPassed: true,
      failures: browser.failures,
    });
  } catch (error) {
    return ForgeTestReportSchema.parse({
      passed: false,
      unitPassed: 2,
      browserPassed: 0,
      accessibilityCriticalViolations: 0,
      accessibilitySeriousViolations: 0,
      policyPassed: true,
      failures: [
        boundedFailure(
          "Harness: Playwright or axe-core failed closed: " +
            (error instanceof Error ? error.message : "unknown error"),
        ),
      ],
    });
  }
}

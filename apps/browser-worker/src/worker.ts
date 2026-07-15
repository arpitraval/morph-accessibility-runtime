import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  QuerySurfaceRecordsInputSchema,
  QuerySurfaceRecordsOutputSchema,
  ReadSurfaceRecordsInputSchema,
  ReadSurfaceRecordsOutputSchema,
  type QuerySurfaceRecordsInput,
  type QuerySurfaceRecordsOutput,
  type ReadSurfaceRecordsInput,
  type ReadSurfaceRecordsOutput,
  type SurfaceToolRuntime,
} from "@morph/agents";
import {
  chromium,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from "playwright";

const UNTRUSTED_PAGE_DATA = "UNTRUSTED_PAGE_DATA" as const;
const MAX_SNAPSHOTS = 8;
const MAX_RECORD_TEXT = 500;
const DEFAULT_TIMEOUT_MS = 10_000;

type SurfaceRecord = ReadSurfaceRecordsOutput["records"][number];
type PlaywrightRole = Parameters<Page["getByRole"]>[0];

const SAFE_ROLE_FALLBACKS = new Set<PlaywrightRole>([
  "button",
  "checkbox",
  "combobox",
  "link",
  "option",
  "radio",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
]);

interface LocatorHint {
  readonly snapshotId: string;
  readonly pageVersion: number;
  readonly documentEpoch: number;
  readonly selectors: readonly string[];
  readonly role: string | null;
  readonly name: string | null;
  readonly text: string | null;
  readonly tagName: string | null;
}

interface SnapshotEntry {
  readonly snapshotId: string;
  readonly pageVersion: number;
  readonly documentEpoch: number;
  readonly records: readonly SurfaceRecord[];
  readonly locatorHints: ReadonlyMap<string, LocatorHint>;
}

export interface UntrustedArtifact<T> {
  readonly trust: typeof UNTRUSTED_PAGE_DATA;
  readonly value: T;
}

export interface CapturedArtifact<T> {
  readonly evidenceId: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly untrusted: UntrustedArtifact<T>;
}

export interface FreshStateCapture {
  readonly snapshotId: string;
  readonly pageVersion: number;
  readonly capturedAt: string;
  readonly url: string;
  readonly title: string;
  readonly stateHash: string;
  readonly records: readonly SurfaceRecord[];
  readonly artifacts: {
    readonly screenshot: CapturedArtifact<Uint8Array>;
    readonly domSnapshot: CapturedArtifact<unknown>;
    readonly accessibilityTree: CapturedArtifact<unknown>;
  };
}

export interface ResolvedTarget {
  readonly locator: Locator;
  readonly strategy: string;
}

export interface BrowserWorkerOptions {
  readonly userDataDir?: string | undefined;
  readonly allowedOrigins: readonly string[];
  readonly headless?: boolean | undefined;
  readonly timeoutMs?: number | undefined;
  readonly viewport?: { readonly width: number; readonly height: number } | undefined;
}

export class BrowserIsolationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BrowserIsolationError";
  }
}

export class StaleSurfaceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "StaleSurfaceError";
  }
}

export class TargetResolutionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TargetResolutionError";
  }
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

function clip(value: string | null | undefined, maximum: number): string | null {
  if (value == null) {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length === 0 ? null : normalized.slice(0, maximum);
}

function stringAt(strings: readonly string[], index: number | undefined): string {
  return index === undefined ? "" : (strings[index] ?? "");
}

function attributesAt(
  strings: readonly string[],
  flattened: readonly number[] | undefined,
): Readonly<Record<string, string>> {
  const attributes: Record<string, string> = {};
  for (let index = 0; index < (flattened?.length ?? 0); index += 2) {
    const name = stringAt(strings, flattened?.[index]).toLowerCase();
    if (name.length > 0) {
      attributes[name] = stringAt(strings, flattened?.[index + 1]);
    }
  }
  return attributes;
}

function rareBooleanAt(
  sparse: { readonly index: readonly number[] } | undefined,
  nodeIndex: number,
): boolean {
  return sparse?.index.includes(nodeIndex) ?? false;
}

function rareStringAt(
  strings: readonly string[],
  sparse: { readonly index: readonly number[]; readonly value: readonly number[] } | undefined,
  nodeIndex: number,
): string | null {
  const sparseIndex = sparse?.index.indexOf(nodeIndex) ?? -1;
  return sparseIndex < 0 ? null : clip(stringAt(strings, sparse?.value[sparseIndex]), 1_000);
}

function inferRole(tagName: string, attributes: Readonly<Record<string, string>>): string | null {
  if (attributes["role"]) {
    return attributes["role"]!.slice(0, 80);
  }
  switch (tagName) {
    case "button":
      return "button";
    case "a":
      return attributes["href"] ? "link" : null;
    case "select":
      return "combobox";
    case "textarea":
      return "textbox";
    case "input": {
      const type = attributes["type"]?.toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "range") return "slider";
      if (type === "button" || type === "submit") return "button";
      return "textbox";
    }
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "heading";
    default:
      return null;
  }
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n\f]/g, " ");
}

function recordId(
  snapshotId: string,
  backendNodeId: number | undefined,
  nodeIndex: number,
): string {
  return `dom:${snapshotId}:${backendNodeId ?? `index-${nodeIndex}`}`;
}

function cssPathFor(
  nodeIndex: number,
  names: readonly string[],
  parents: readonly number[],
): string | null {
  const segments: string[] = [];
  let current = nodeIndex;
  for (let depth = 0; depth < 64 && current >= 0; depth += 1) {
    const tag = names[current]?.toLowerCase() ?? "";
    if (!/^[a-z][a-z0-9-]*$/.test(tag)) {
      current = parents[current] ?? -1;
      continue;
    }
    const parent = parents[current] ?? -1;
    let ordinal = 1;
    if (parent >= 0) {
      for (let sibling = 0; sibling < current; sibling += 1) {
        if (parents[sibling] === parent && names[sibling]?.toLowerCase() === tag) {
          ordinal += 1;
        }
      }
    }
    segments.unshift(tag === "html" || tag === "body" ? tag : `${tag}:nth-of-type(${ordinal})`);
    current = parent;
  }
  return segments.length === 0 ? null : segments.join(" > ");
}

function buildDomRecords(
  snapshotId: string,
  pageVersion: number,
  documentEpoch: number,
  evidenceId: string,
  snapshot: unknown,

): { records: SurfaceRecord[]; hints: Map<string, LocatorHint>; backendHints: Map<number, LocatorHint> } {
  // CDP return types are validated structurally by Playwright; page-provided strings remain untrusted.
  const payload = snapshot as {
    strings: string[];
    documents: Array<{
      nodes: {
        parentIndex?: number[];
        nodeName?: number[];
        nodeValue?: number[];
        backendNodeId?: number[];
        attributes?: number[][];
        inputValue?: { index: number[]; value: number[] };
        textValue?: { index: number[]; value: number[] };
        isClickable?: { index: number[] };
      };
      layout: { nodeIndex: number[]; bounds: number[][] };
    }>;
  };
  const records: SurfaceRecord[] = [];
  const hints = new Map<string, LocatorHint>();
  const backendHints = new Map<number, LocatorHint>();

  for (const document of payload.documents) {
    const nodes = document.nodes;
    const parents = nodes.parentIndex ?? [];
    const names = (nodes.nodeName ?? []).map((index) => stringAt(payload.strings, index));
    const backendIds = nodes.backendNodeId ?? [];
    const childCounts = new Map<number, number>();
    const textParts = new Map<number, string[]>();
    const layoutBounds = new Map<number, readonly number[]>();

    document.layout.nodeIndex.forEach((index, layoutIndex) => {
      layoutBounds.set(index, document.layout.bounds[layoutIndex] ?? []);
    });
    parents.forEach((parent) => {
      if (parent >= 0) childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);
    });

    names.forEach((name, index) => {
      if (name !== "#text") return;
      const text = clip(stringAt(payload.strings, nodes.nodeValue?.[index]), MAX_RECORD_TEXT);
      if (text === null) return;
      let ancestor = parents[index] ?? -1;
      for (let depth = 0; depth < 16 && ancestor >= 0; depth += 1) {
        const values = textParts.get(ancestor) ?? [];
        if (values.join(" ").length < MAX_RECORD_TEXT) values.push(text);
        textParts.set(ancestor, values);
        ancestor = parents[ancestor] ?? -1;
      }
    });

    names.forEach((rawName, index) => {
      const tagName = /^[A-Z][A-Z0-9-]*$/.test(rawName) ? rawName.toLowerCase() : null;
      const attributes = attributesAt(payload.strings, nodes.attributes?.[index]);
      const aggregateText = clip(textParts.get(index)?.join(" "), MAX_RECORD_TEXT);
      const accessibleName = clip(
        attributes["aria-label"] ?? attributes["title"] ?? aggregateText,
        MAX_RECORD_TEXT,
      );
      const nodeValue = clip(stringAt(payload.strings, nodes.nodeValue?.[index]), 1_000);
      const value =
        rareStringAt(payload.strings, nodes.inputValue, index) ??
        rareStringAt(payload.strings, nodes.textValue, index) ??
        clip(attributes["value"], 1_000) ??
        nodeValue;
      const backendNodeId = backendIds[index];
      const id = recordId(snapshotId, backendNodeId, index);
      const parentIndex = parents[index] ?? -1;
      const bounds = layoutBounds.get(index);
      const normalizedBounds =
        bounds !== undefined && bounds.length >= 4
          ? {
              x: bounds[0] ?? 0,
              y: bounds[1] ?? 0,
              width: Math.max(0, bounds[2] ?? 0),
              height: Math.max(0, bounds[3] ?? 0),
            }
          : null;
      const role = tagName === null ? null : inferRole(tagName, attributes);
      const interactive =
        rareBooleanAt(nodes.isClickable, index) ||
        role === "button" ||
        role === "link" ||
        role === "checkbox" ||
        role === "radio" ||
        role === "combobox" ||
        role === "textbox" ||
        role === "slider";

      records.push({
        recordId: id,
        channel: "DOM",
        tagName,
        role,
        name: accessibleName,
        value,
        parentRecordId:
          parentIndex < 0
            ? null
            : recordId(snapshotId, backendIds[parentIndex], parentIndex),
        childCount: childCounts.get(index) ?? 0,
        interactive,
        visible:
          normalizedBounds !== null &&
          normalizedBounds.width > 0 &&
          normalizedBounds.height > 0,
        disabled: "disabled" in attributes || attributes["aria-disabled"] === "true",
        bounds: normalizedBounds,
        evidenceId,
      });

      if (tagName !== null) {
        const selectors: string[] = [];
        if (attributes["data-testid"]) {
          selectors.push(`[data-testid="${escapeCssString(attributes["data-testid"]!)}"]`);
        }
        if (attributes["id"]) {
          selectors.push(`[id="${escapeCssString(attributes["id"]!)}"]`);
        }
        if (attributes["name"]) {
          selectors.push(`${tagName}[name="${escapeCssString(attributes["name"]!)}"]`);
        }
        const path = cssPathFor(index, names, parents);
        if (path !== null) selectors.push(path);
        const hint: LocatorHint = {
          snapshotId,
          pageVersion,
          documentEpoch,
          selectors,
          role,
          name: accessibleName,
          text: aggregateText,
          tagName,
        };
        hints.set(id, hint);
        if (backendNodeId !== undefined) backendHints.set(backendNodeId, hint);
      }
    });
  }

  return { records, hints, backendHints };
}

function axValue(value: { readonly value?: unknown } | undefined, maximum: number): string | null {
  return typeof value?.value === "string" ? clip(value.value, maximum) : null;
}

function axBooleanProperty(
  properties: readonly { readonly name: string; readonly value: { readonly value?: unknown } }[] | undefined,
  name: string,
): boolean {
  return properties?.some(
    (property) => property.name === name && property.value.value === true,
  ) ?? false;
}

function buildAccessibilityRecords(
  snapshotId: string,
  pageVersion: number,
  documentEpoch: number,
  evidenceId: string,
  tree: unknown,
  backendHints: ReadonlyMap<number, LocatorHint>,
): { records: SurfaceRecord[]; hints: Map<string, LocatorHint> } {
  const payload = tree as {
    nodes: Array<{
      nodeId: string;
      parentId?: string;
      childIds?: string[];
      backendDOMNodeId?: number;
      ignored: boolean;
      role?: { value?: unknown };
      name?: { value?: unknown };
      value?: { value?: unknown };
      properties?: Array<{ name: string; value: { value?: unknown } }>;
    }>;
  };
  const records: SurfaceRecord[] = [];
  const hints = new Map<string, LocatorHint>();

  for (const node of payload.nodes) {
    const id = `ax:${snapshotId}:${node.nodeId}`;
    const role = axValue(node.role, 80);
    const name = axValue(node.name, MAX_RECORD_TEXT);
    records.push({
      recordId: id,
      channel: "ACCESSIBILITY_TREE",
      tagName: null,
      role,
      name,
      value: axValue(node.value, 1_000),
      parentRecordId: node.parentId === undefined ? null : `ax:${snapshotId}:${node.parentId}`,
      childCount: node.childIds?.length ?? 0,
      interactive: ["button", "link", "checkbox", "radio", "combobox", "textbox", "slider", "option"].includes(
        role ?? "",
      ),
      visible: !node.ignored,
      disabled: axBooleanProperty(node.properties, "disabled"),
      bounds: null,
      evidenceId,
    });
    const domHint =
      node.backendDOMNodeId === undefined ? undefined : backendHints.get(node.backendDOMNodeId);
    if (domHint !== undefined) {
      hints.set(id, {
        ...domHint,
        snapshotId,
        pageVersion,
        documentEpoch,
        role: role ?? domHint.role,
        name: name ?? domHint.name,
      });
    }
  }
  return { records, hints };
}

function originFor(url: URL): string {
  if (url.protocol === "blob:") {
    return new URL(url.pathname).origin;
  }
  return url.origin;
}

function isSafeRoleFallback(value: string): value is PlaywrightRole {
  return SAFE_ROLE_FALLBACKS.has(value as PlaywrightRole);
}

export class PlaywrightBrowserWorker implements SurfaceToolRuntime {
  readonly #context: BrowserContext;
  readonly #page: Page;
  readonly #allowedOrigins: ReadonlySet<string>;
  readonly #snapshots = new Map<string, SnapshotEntry>();
  readonly #snapshotOrder: string[] = [];
  #pageVersion = 0;
  #documentEpoch = 0;
  #activeSnapshotId: string | null = null;

  private constructor(context: BrowserContext, page: Page, allowedOrigins: ReadonlySet<string>) {
    this.#context = context;
    this.#page = page;
    this.#allowedOrigins = allowedOrigins;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) this.#documentEpoch += 1;
    });
  }

  public static async launch(options: BrowserWorkerOptions): Promise<PlaywrightBrowserWorker> {
    if (options.allowedOrigins.length === 0) {
      throw new BrowserIsolationError("At least one target origin must be explicitly allowed.");
    }
    const allowedOrigins = new Set(
      options.allowedOrigins.map((origin) => {
        const parsed = new URL(origin);
        if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
          throw new BrowserIsolationError(`Allowed origin must not contain a path: ${origin}`);
        }
        return parsed.origin;
      }),
    );
    const userDataDir =
      options.userDataDir ?? join(tmpdir(), "morph-browser-worker", randomUUID());
    await mkdir(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: options.headless ?? true,
      viewport: options.viewport ?? { width: 1440, height: 1000 },
      acceptDownloads: false,
      serviceWorkers: "block",
      permissions: [],
      ignoreHTTPSErrors: false,
    });
    context.setDefaultTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    await context.clearCookies();
    await context.route("**/*", async (route) => {
      await PlaywrightBrowserWorker.routeAllowedRequest(route, allowedOrigins);
    });
    const pages = context.pages();
    const page = pages[0] ?? (await context.newPage());
    return new PlaywrightBrowserWorker(context, page, allowedOrigins);
  }

  private static async routeAllowedRequest(
    route: Route,
    allowedOrigins: ReadonlySet<string>,
  ): Promise<void> {
    const url = new URL(route.request().url());
    if (["about:", "data:"].includes(url.protocol) || allowedOrigins.has(originFor(url))) {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  }

  public get currentPageVersion(): number {
    return this.#pageVersion;
  }

  public currentPage(): Page {
    return this.#page;
  }

  public async open(url: string): Promise<void> {
    this.assertAllowedUrl(url);
    await this.#page.goto(url, { waitUntil: "domcontentloaded" });
  }

  public async navigateTo(url: string): Promise<void> {
    this.assertAllowedUrl(url);
    await this.#page.goto(url, { waitUntil: "domcontentloaded" });
  }

  public assertAllowedUrl(url: string): void {
    const parsed = new URL(url);
    if (!this.#allowedOrigins.has(originFor(parsed))) {
      throw new BrowserIsolationError(`Navigation to ${parsed.origin} is outside the worker allowlist.`);
    }
  }

  public async captureFreshState(): Promise<FreshStateCapture> {
    await this.#page.waitForLoadState("domcontentloaded");
    await this.#page.waitForTimeout(16);

    const cdp = await this.#context.newCDPSession(this.#page);
    const snapshotId = randomUUID();
    const pageVersion = this.#pageVersion + 1;
    const screenshotEvidenceId = randomUUID();
    const domEvidenceId = randomUUID();
    const axEvidenceId = randomUUID();
    try {
      await cdp.send("Accessibility.enable");
      const [domSnapshot, accessibilityTree, screenshot] = await Promise.all([
        cdp.send("DOMSnapshot.captureSnapshot", {
          computedStyles: [],
          includeDOMRects: true,
          includePaintOrder: false,
        }),
        cdp.send("Accessibility.getFullAXTree"),
        this.#page.screenshot({
          type: "png",
          fullPage: true,
          animations: "disabled",
          caret: "hide",
        }),
      ]);
      const dom = buildDomRecords(
        snapshotId,
        pageVersion,
        this.#documentEpoch,
        domEvidenceId,
        domSnapshot,
      );
      const ax = buildAccessibilityRecords(
        snapshotId,
        pageVersion,
        this.#documentEpoch,
        axEvidenceId,
        accessibilityTree,
        dom.backendHints,
      );
      const records = [...dom.records, ...ax.records];
      const hints = new Map([...dom.hints, ...ax.hints]);
      const domRecords = records.filter((record) => record.channel === "DOM");
      const axRecords = records.filter((record) => record.channel === "ACCESSIBILITY_TREE");

      for (const channelRecords of [domRecords, axRecords]) {
        for (let cursor = 0; cursor < channelRecords.length; cursor += 500) {
          const batch = channelRecords.slice(cursor, cursor + 500);
          const nextCursor = cursor + batch.length;
          ReadSurfaceRecordsOutputSchema.parse({
            snapshotId,
            pageVersion,
            totalRecords: channelRecords.length,
            nextCursor: nextCursor < channelRecords.length ? nextCursor : null,
            records: batch,
          });
        }
      }

      const domSerialized = serialized(domSnapshot);
      const axSerialized = serialized(accessibilityTree);
      const screenshotBytes = new Uint8Array(screenshot);
      const title = await this.#page.title();
      const url = this.#page.url();
      const domHash = sha256(domSerialized);
      const axHash = sha256(axSerialized);
      const screenshotHash = sha256(screenshotBytes);
      const stateHash = sha256(serialized({ url, title, domHash, axHash }));
      const entry: SnapshotEntry = Object.freeze({
        snapshotId,
        pageVersion,
        documentEpoch: this.#documentEpoch,
        records: Object.freeze(records),
        locatorHints: hints,
      });
      this.#snapshots.set(snapshotId, entry);
      this.#snapshotOrder.push(snapshotId);
      while (this.#snapshotOrder.length > MAX_SNAPSHOTS) {
        const expired = this.#snapshotOrder.shift();
        if (expired !== undefined) this.#snapshots.delete(expired);
      }
      this.#activeSnapshotId = snapshotId;
      this.#pageVersion = pageVersion;

      return Object.freeze({
        snapshotId,
        pageVersion,
        capturedAt: new Date().toISOString(),
        url,
        title,
        stateHash,
        records: Object.freeze(records),
        artifacts: Object.freeze({
          screenshot: Object.freeze({
            evidenceId: screenshotEvidenceId,
            sha256: screenshotHash,
            byteLength: screenshotBytes.byteLength,
            untrusted: Object.freeze({ trust: UNTRUSTED_PAGE_DATA, value: screenshotBytes }),
          }),
          domSnapshot: Object.freeze({
            evidenceId: domEvidenceId,
            sha256: domHash,
            byteLength: Buffer.byteLength(domSerialized),
            untrusted: Object.freeze({ trust: UNTRUSTED_PAGE_DATA, value: domSnapshot }),
          }),
          accessibilityTree: Object.freeze({
            evidenceId: axEvidenceId,
            sha256: axHash,
            byteLength: Buffer.byteLength(axSerialized),
            untrusted: Object.freeze({ trust: UNTRUSTED_PAGE_DATA, value: accessibilityTree }),
          }),
        }),
      });
    } finally {
      await cdp.send("Accessibility.disable").catch(() => undefined);
      await cdp.detach().catch(() => undefined);
    }
  }

  private snapshot(snapshotId: string): SnapshotEntry {
    const snapshot = this.#snapshots.get(snapshotId);
    if (snapshot === undefined) {
      throw new StaleSurfaceError(`Unknown or expired snapshot ${snapshotId}.`);
    }
    return snapshot;
  }

  public async readSurfaceRecords(inputValue: ReadSurfaceRecordsInput): Promise<ReadSurfaceRecordsOutput> {
    const input = ReadSurfaceRecordsInputSchema.parse(inputValue);
    const snapshot = this.snapshot(input.snapshotId);
    const channelRecords = snapshot.records.filter((record) => record.channel === input.channel);
    const records = channelRecords.slice(input.cursor, input.cursor + input.limit);
    const next = input.cursor + records.length;
    return ReadSurfaceRecordsOutputSchema.parse({
      snapshotId: input.snapshotId,
      pageVersion: snapshot.pageVersion,
      totalRecords: channelRecords.length,
      nextCursor: next < channelRecords.length ? next : null,
      records,
    });
  }

  public async querySurfaceRecords(inputValue: QuerySurfaceRecordsInput): Promise<QuerySurfaceRecordsOutput> {
    const input = QuerySurfaceRecordsInputSchema.parse(inputValue);
    const snapshot = this.snapshot(input.snapshotId);
    const query = input.query?.toLocaleLowerCase() ?? null;
    const roleSet = new Set(input.roles.map((role) => role.toLocaleLowerCase()));
    const matched = snapshot.records.filter((record) => {
      if (input.interactiveOnly && !record.interactive) return false;
      if (input.visibleOnly && !record.visible) return false;
      if (roleSet.size > 0 && (record.role === null || !roleSet.has(record.role.toLocaleLowerCase()))) {
        return false;
      }
      if (query === null) return true;
      return [record.tagName, record.role, record.name, record.value]
        .filter((value): value is string => value !== null)
        .some((value) => value.toLocaleLowerCase().includes(query));
    });
    return QuerySurfaceRecordsOutputSchema.parse({
      snapshotId: input.snapshotId,
      pageVersion: snapshot.pageVersion,
      totalMatched: matched.length,
      truncated: matched.length > input.limit,
      records: matched.slice(0, input.limit),
    });
  }

  public assertCurrentPageVersion(expectedPageVersion: number): void {
    if (expectedPageVersion !== this.#pageVersion) {
      throw new StaleSurfaceError(
        `Action targets page version ${expectedPageVersion}; current captured version is ${this.#pageVersion}.`,
      );
    }
  }

  public async resolveTarget(targetNodeId: string, expectedPageVersion: number): Promise<ResolvedTarget> {
    this.assertCurrentPageVersion(expectedPageVersion);
    const activeSnapshot =
      this.#activeSnapshotId === null ? null : this.#snapshots.get(this.#activeSnapshotId);
    const hint = activeSnapshot?.locatorHints.get(targetNodeId);
    if (hint === undefined) {
      throw new TargetResolutionError(`Target ${targetNodeId} is absent from the active snapshot.`);
    }
    if (hint.pageVersion !== expectedPageVersion || hint.documentEpoch !== this.#documentEpoch) {
      throw new StaleSurfaceError(`Target ${targetNodeId} belongs to a stale document or page version.`);
    }

    const candidates: Array<{ strategy: string; locator: Locator }> = hint.selectors.map((selector) => ({
      strategy: `css:${selector}`,
      locator: this.#page.locator(selector),
    }));
    if (hint.role !== null && hint.name !== null && isSafeRoleFallback(hint.role)) {
      candidates.push({
        strategy: `role:${hint.role}:${hint.name}`,
        locator: this.#page.getByRole(hint.role, { name: hint.name, exact: true }),
      });
    }
    if (hint.text !== null) {
      candidates.push({
        strategy: `text:${hint.text}`,
        locator: this.#page.getByText(hint.text, { exact: true }),
      });
    }

    const diagnostics: string[] = [];
    for (const candidate of candidates) {
      const count = await candidate.locator.count();
      const visible = count === 1 && (await candidate.locator.isVisible());
      diagnostics.push(`${candidate.strategy.split(":", 1)[0]} => count=${count}, visible=${visible}`);
      if (visible) {
        return Object.freeze(candidate);
      }
    }
    throw new TargetResolutionError(
      `No unique visible locator matched target ${targetNodeId}; execution stopped instead of guessing. ${diagnostics.join(" | ")}`,
    );
  }

  public async close(): Promise<void> {
    await this.#context.close();
  }
}

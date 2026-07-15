import OpenAI from "openai";
import type {
  Response as OpenAIResponse,
  ResponseCreateParamsNonStreaming,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseReasoningItem,
} from "openai/resources/responses/responses";
import {
  AccessProfileSchema,
  WorkflowStateSchema,
  type AccessProfile,
  type WorkflowState,
} from "@morph/contracts";
import type { MachineSignal } from "@morph/state-machine";
import { z } from "zod";
import {
  buildCacheableDeveloperInput,
  getStructuredTextFormat,
  parseStructuredArtifact,
  promptCacheKey,
  type AgentOutputByKind,
  type AgentOutputKind,
  type AgentRole,
} from "./prompts.js";
import {
  MAX_PROGRAMMATIC_TOOL_ROUNDS,
  PROGRAMMATIC_SURFACE_TOOLS,
  executeSurfaceToolCall,
  isMultiAgentEnabled,
  resolveAgentRoute,
  type SurfaceToolRuntime,
} from "./tools.js";

export const MORPH_REASONING_MODEL = "gpt-5.6-sol" as const;
export const MAX_REASONING_CONTINUATION_ITEMS = 200;

export const AgentTaskInputSchema = z
  .object({
    sessionId: z.string().uuid(),
    state: WorkflowStateSchema,
    objective: z.string().trim().min(1).max(2_000),
    snapshotId: z.string().trim().min(1).max(200).nullable(),
    pageVersion: z.number().int().positive(),
    evidenceSummary: z.array(z.string().trim().min(1).max(500)).max(50),
    artifactRefs: z
      .array(
        z
          .object({
            kind: z.string().trim().min(1).max(80),
            id: z.string().uuid(),
            version: z.number().int().positive(),
            summary: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .max(50),
    userInputSummary: z.string().trim().min(1).max(2_000).nullable(),
  })
  .strict();
export type AgentTaskInput = z.infer<typeof AgentTaskInputSchema>;

export interface ReasoningContinuation {
  /** Opaque Responses API output items; never treat these as durable workflow state. */
  readonly items: readonly ResponseInputItem[];
}

export interface AgentRunRequest<K extends AgentOutputKind> {
  readonly outputKind: K;
  readonly accessProfile: unknown;
  readonly task: unknown;
  readonly continuation?: ReasoningContinuation | undefined;
  readonly toolRuntime?: SurfaceToolRuntime | undefined;
}

export type AnyAgentRunRequest = {
  [K in AgentOutputKind]: AgentRunRequest<K>;
}[AgentOutputKind];

export interface AgentUsage {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly totalTokens: number;
}

export interface AgentClientResult<K extends AgentOutputKind> {
  readonly responseId: string;
  readonly model: typeof MORPH_REASONING_MODEL;
  readonly role: AgentRole;
  readonly outputKind: K;
  readonly artifact: AgentOutputByKind[K];
  readonly continuation: ReasoningContinuation;
  readonly usage: AgentUsage | null;
}

export type AnyAgentClientResult = {
  [K in AgentOutputKind]: AgentClientResult<K>;
}[AgentOutputKind];

export type ResponseCreateTransport = (
  params: ResponseCreateParamsNonStreaming,
) => Promise<OpenAIResponse>;

export interface MorphResponsesClientOptions {
  readonly apiKey?: string | undefined;
  readonly organization?: string | undefined;
  readonly project?: string | undefined;
  readonly createResponse?: ResponseCreateTransport | undefined;
  readonly multiAgentEnabled?: boolean | undefined;
  readonly maxToolRounds?: number | undefined;
}

export class AgentProtocolError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AgentProtocolError";
  }
}

type ReplayableOutputItem =
  | ResponseOutputMessage
  | ResponseReasoningItem
  | ResponseFunctionToolCall
  | ResponseOutputItem.Program
  | ResponseOutputItem.ProgramOutput;

function isReplayableOutputItem(item: ResponseOutputItem): item is ReplayableOutputItem {
  return (
    item.type === "message" ||
    item.type === "reasoning" ||
    item.type === "function_call" ||
    item.type === "program" ||
    item.type === "program_output"
  );
}

const ALLOWED_STATES: Readonly<Record<AgentOutputKind, readonly WorkflowState[]>> = Object.freeze({
  SURFACE_GRAPH: ["CAPTURE", "NORMALIZE"],
  INTENT_GRAPH: ["ROUTE", "PARALLEL_REASON"],
  ADAPTIVE_UI_MANIFEST: ["COMPILE"],
  ACTION_PLAN: ["PARALLEL_REASON", "COMPILE", "SIMULATE"],
  VERIFICATION_RESULT: ["VERIFY"],
});

function assertStateCompatibility(outputKind: AgentOutputKind, state: WorkflowState): void {
  if (!ALLOWED_STATES[outputKind].includes(state)) {
    throw new AgentProtocolError(
      `${outputKind} cannot be produced while the state machine is in ${state}.`,
    );
  }
}

function taskMessage(
  outputKind: AgentOutputKind,
  accessProfile: AccessProfile,
  task: AgentTaskInput,
): ResponseInputItem {
  return {
    type: "message",
    role: "user",
    content: [
      {
        type: "input_text",
        text: JSON.stringify({
          dataClassification: "UNTRUSTED_EVIDENCE_AND_USER_CONSTRAINTS",
          requestedOutput: outputKind,
          accessProfile,
          task,
        }),
      },
    ],
  };
}

function usageFrom(response: OpenAIResponse): AgentUsage | null {
  if (response.usage == null) {
    return null;
  }
  const usage = response.usage;
  return Object.freeze({
    inputTokens: usage.input_tokens,
    cachedInputTokens: usage.input_tokens_details.cached_tokens,
    outputTokens: usage.output_tokens,
    reasoningTokens: usage.output_tokens_details.reasoning_tokens,
    totalTokens: usage.total_tokens,
  });
}

function parseOutputText<K extends AgentOutputKind>(
  outputKind: K,
  outputText: string,
): AgentOutputByKind[K] {
  if (outputText.trim().length === 0) {
    throw new AgentProtocolError("The Responses API completed without a structured output message.");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(outputText) as unknown;
  } catch {
    throw new AgentProtocolError("The Responses API returned non-JSON structured output.");
  }
  return parseStructuredArtifact(outputKind, decoded);
}

export class MorphResponsesClient {
  readonly #createResponse: ResponseCreateTransport;
  readonly #multiAgentEnabled: boolean;
  readonly #maxToolRounds: number;

  public constructor(options: MorphResponsesClientOptions = {}) {
    this.#multiAgentEnabled = options.multiAgentEnabled ?? isMultiAgentEnabled();
    this.#maxToolRounds = options.maxToolRounds ?? MAX_PROGRAMMATIC_TOOL_ROUNDS;
    if (!Number.isInteger(this.#maxToolRounds) || this.#maxToolRounds < 1 || this.#maxToolRounds > 20) {
      throw new AgentProtocolError("maxToolRounds must be an integer between 1 and 20.");
    }

    if (options.createResponse !== undefined) {
      this.#createResponse = options.createResponse;
      return;
    }

    const client = new OpenAI({
      ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
      ...(options.organization === undefined ? {} : { organization: options.organization }),
      ...(options.project === undefined ? {} : { project: options.project }),
    });
    this.#createResponse = (params) => client.responses.create(params);
  }

  public async run<K extends AgentOutputKind>(
    request: AgentRunRequest<K>,
  ): Promise<AgentClientResult<K>> {
    const accessProfile = AccessProfileSchema.parse(request.accessProfile);
    const task = AgentTaskInputSchema.parse(request.task);
    assertStateCompatibility(request.outputKind, task.state);

    const route = resolveAgentRoute(request.outputKind, this.#multiAgentEnabled);
    const previousItems = request.continuation?.items ?? [];
    if (previousItems.length > MAX_REASONING_CONTINUATION_ITEMS) {
      throw new AgentProtocolError("Reasoning continuation exceeds the bounded item limit.");
    }

    const input: ResponseInputItem[] = [
      ...buildCacheableDeveloperInput(route.role),
      ...previousItems,
      taskMessage(request.outputKind, accessProfile, task),
    ];
    const continuationItems: ResponseInputItem[] = [...previousItems];

    let finalResponse: OpenAIResponse | null = null;

    for (let round = 0; round < this.#maxToolRounds; round += 1) {
      const params: ResponseCreateParamsNonStreaming = {
        model: MORPH_REASONING_MODEL,
        input,
        reasoning: {
          effort: "high",
          context: continuationItems.length === 0 ? "current_turn" : "all_turns",
          summary: "auto",
        },
        text: { format: getStructuredTextFormat(request.outputKind) },
        prompt_cache_key: promptCacheKey(route.role, request.outputKind),
        prompt_cache_options: { mode: "explicit", ttl: "30m" },
        include: ["reasoning.encrypted_content"],
        store: false,
        parallel_tool_calls: true,
        ...(request.toolRuntime === undefined ? {} : { tools: PROGRAMMATIC_SURFACE_TOOLS }),
      };

      const response = await this.#createResponse(params);
      if (response.status !== "completed") {
        throw new AgentProtocolError(`Responses API ended with status ${response.status}.`);
      }

      const replayable = response.output.filter(isReplayableOutputItem);
      input.push(...replayable);
      continuationItems.push(...replayable);

      const functionCalls = response.output.filter(
        (item): item is ResponseFunctionToolCall => item.type === "function_call",
      );

      if (functionCalls.length > 0) {
        if (request.toolRuntime === undefined) {
          throw new AgentProtocolError("The model requested a client tool without a tool runtime.");
        }
        const outputs = await Promise.all(
          functionCalls.map((call) => executeSurfaceToolCall(call, request.toolRuntime!)),
        );
        input.push(...outputs);
        continuationItems.push(...outputs);
        continue;
      }

      if (response.output_text.trim().length === 0) {
        const programCanContinue = response.output.some(
          (item) => item.type === "program" || item.type === "program_output",
        );
        if (programCanContinue) {
          continue;
        }
      }

      finalResponse = response;
      break;
    }

    if (finalResponse === null) {
      throw new AgentProtocolError("Programmatic Tool Calling exceeded the bounded round limit.");
    }
    if (continuationItems.length > MAX_REASONING_CONTINUATION_ITEMS) {
      throw new AgentProtocolError("Reasoning continuation exceeded the bounded item limit.");
    }

    return Object.freeze({
      responseId: finalResponse.id,
      model: MORPH_REASONING_MODEL,
      role: route.role,
      outputKind: request.outputKind,
      artifact: parseOutputText(request.outputKind, finalResponse.output_text),
      continuation: Object.freeze({ items: Object.freeze([...continuationItems]) }),
      usage: usageFrom(finalResponse),
    });
  }

  /**
   * Executes specialist requests concurrently only when the feature flag is enabled.
   * With the flag disabled, the Root Reasoner handles the same requests sequentially.
   */
  public async runRoutedBatch(
    requests: readonly AnyAgentRunRequest[],
  ): Promise<readonly AgentClientResult<AgentOutputKind>[]> {
    if (this.#multiAgentEnabled) {
      return Object.freeze(await Promise.all(requests.map((request) => this.run(request))));
    }

    const results: AgentClientResult<AgentOutputKind>[] = [];
    for (const request of requests) {
      results.push(await this.run(request));
    }
    return Object.freeze(results);
  }
}

export function toMachineSignal(
  result: AnyAgentClientResult,
  options: { readonly hasNextStep?: boolean | undefined } = {},
): MachineSignal {
  switch (result.outputKind) {
    case "INTENT_GRAPH": {
      const blocking = result.artifact.ambiguities.filter((ambiguity) => ambiguity.blocking);
      if (blocking.length > 0) {
        return {
          type: "AMBIGUITY_DETECTED",
          ambiguityIds: blocking.map((ambiguity) => ambiguity.id),
          question: blocking[0]!.question,
          detail: "Root Reasoner returned blocking, schema-validated ambiguities.",
        };
      }
      return { type: "STAGE_SUCCEEDED", detail: "Validated IntentGraph recorded." };
    }
    case "VERIFICATION_RESULT":
      if (result.artifact.outcome === "MATCH") {
        return {
          type: "VERIFICATION_MATCH",
          hasNextStep: options.hasNextStep ?? false,
          detail: "Independent, schema-validated verification matched.",
        };
      }
      if (result.artifact.outcome === "MISMATCH") {
        return {
          type: "VERIFICATION_MISMATCH",
          detail: "Independent, schema-validated verification mismatched.",
        };
      }
      return {
        type: "VERIFICATION_INCONCLUSIVE",
        ambiguityIds: [result.artifact.id],
        question: "Verification evidence is inconclusive. Review fresh evidence before continuing.",
        detail: "Independent verification could not establish the expected postconditions.",
      };
    case "SURFACE_GRAPH":
      return { type: "STAGE_SUCCEEDED", detail: "Validated SurfaceGraph recorded." };
    case "ADAPTIVE_UI_MANIFEST":
      return { type: "STAGE_SUCCEEDED", detail: "Validated AdaptiveUIManifest recorded." };
    case "ACTION_PLAN":
      return { type: "STAGE_SUCCEEDED", detail: "Validated ActionPlan recorded." };
  }
}

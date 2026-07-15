import type {
  ResponseCreateParamsNonStreaming,
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import { z } from "zod";
import {
  PROMPT_VERSION,
  type AgentOutputKind,
  type AgentRole,
} from "./prompts.js";

export const PROGRAMMATIC_CALLER = "programmatic" as const;
export const MULTI_AGENT_FEATURE_FLAG = "MORPH_MULTI_AGENT_ENABLED";
export const MAX_PROGRAMMATIC_TOOL_ROUNDS = 8;

export const SurfaceChannelSchema = z.enum(["DOM", "ACCESSIBILITY_TREE"]);

export const ReadSurfaceRecordsInputSchema = z
  .object({
    snapshotId: z.string().trim().min(1).max(200),
    channel: SurfaceChannelSchema,
    cursor: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(500),
  })
  .strict();
export type ReadSurfaceRecordsInput = z.infer<typeof ReadSurfaceRecordsInputSchema>;

export const QuerySurfaceRecordsInputSchema = z
  .object({
    snapshotId: z.string().trim().min(1).max(200),
    query: z.string().trim().max(300).nullable(),
    roles: z.array(z.string().trim().min(1).max(80)).max(30),
    interactiveOnly: z.boolean(),
    visibleOnly: z.boolean(),
    limit: z.number().int().min(1).max(200),
  })
  .strict();
export type QuerySurfaceRecordsInput = z.infer<typeof QuerySurfaceRecordsInputSchema>;

const SurfaceRecordSchema = z
  .object({
    recordId: z.string().trim().min(1).max(160),
    channel: SurfaceChannelSchema,
    tagName: z.string().trim().min(1).max(80).nullable(),
    role: z.string().trim().min(1).max(80).nullable(),
    name: z.string().max(500).nullable(),
    value: z.string().max(1_000).nullable(),
    parentRecordId: z.string().trim().min(1).max(160).nullable(),
    childCount: z.number().int().nonnegative(),
    interactive: z.boolean(),
    visible: z.boolean(),
    disabled: z.boolean(),
    bounds: z
      .object({
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().finite().nonnegative(),
        height: z.number().finite().nonnegative(),
      })
      .strict()
      .nullable(),
    evidenceId: z.string().uuid(),
  })
  .strict();

export const ReadSurfaceRecordsOutputSchema = z
  .object({
    snapshotId: z.string().trim().min(1).max(200),
    pageVersion: z.number().int().positive(),
    totalRecords: z.number().int().nonnegative(),
    nextCursor: z.number().int().nonnegative().nullable(),
    records: z.array(SurfaceRecordSchema).max(500),
  })
  .strict();
export type ReadSurfaceRecordsOutput = z.infer<typeof ReadSurfaceRecordsOutputSchema>;

export const QuerySurfaceRecordsOutputSchema = z
  .object({
    snapshotId: z.string().trim().min(1).max(200),
    pageVersion: z.number().int().positive(),
    totalMatched: z.number().int().nonnegative(),
    truncated: z.boolean(),
    records: z.array(SurfaceRecordSchema).max(200),
  })
  .strict();
export type QuerySurfaceRecordsOutput = z.infer<typeof QuerySurfaceRecordsOutputSchema>;

type ResponseTools = NonNullable<ResponseCreateParamsNonStreaming["tools"]>;

/**
 * These client-owned functions expose bounded structural records, never raw HTML.
 * `allowed_callers: ["programmatic"]` keeps large results inside the isolated V8
 * program unless the program deliberately emits a compact result.
 */
export const PROGRAMMATIC_SURFACE_TOOLS: ResponseTools = [
  {
    type: "function",
    name: "read_surface_records",
    description:
      "Read one bounded page of normalized DOM or accessibility-tree records from an immutable snapshot.",
    strict: true,
    parameters: z.toJSONSchema(ReadSurfaceRecordsInputSchema),
    output_schema: z.toJSONSchema(ReadSurfaceRecordsOutputSchema),
    allowed_callers: [PROGRAMMATIC_CALLER],
  },
  {
    type: "function",
    name: "query_surface_records",
    description:
      "Filter normalized surface records by text, role, visibility, and interactivity without returning raw markup.",
    strict: true,
    parameters: z.toJSONSchema(QuerySurfaceRecordsInputSchema),
    output_schema: z.toJSONSchema(QuerySurfaceRecordsOutputSchema),
    allowed_callers: [PROGRAMMATIC_CALLER],
  },
  { type: "programmatic_tool_calling" },
];

export interface SurfaceToolRuntime {
  readSurfaceRecords(input: ReadSurfaceRecordsInput): Promise<unknown>;
  querySurfaceRecords(input: QuerySurfaceRecordsInput): Promise<unknown>;
}

export class AgentToolProtocolError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AgentToolProtocolError";
  }
}

function parseArguments(call: ResponseFunctionToolCall): unknown {
  try {
    return JSON.parse(call.arguments) as unknown;
  } catch {
    throw new AgentToolProtocolError(`Tool ${call.name} supplied invalid JSON arguments.`);
  }
}

export async function executeSurfaceToolCall(
  call: ResponseFunctionToolCall,
  runtime: SurfaceToolRuntime,
): Promise<ResponseInputItem.FunctionCallOutput> {
  if (call.caller?.type !== "program") {
    throw new AgentToolProtocolError(
      `Tool ${call.name} was rejected because it did not originate from a program item.`,
    );
  }

  const rawArguments = parseArguments(call);
  let output: ReadSurfaceRecordsOutput | QuerySurfaceRecordsOutput;

  switch (call.name) {
    case "read_surface_records": {
      const input = ReadSurfaceRecordsInputSchema.parse(rawArguments);
      output = ReadSurfaceRecordsOutputSchema.parse(await runtime.readSurfaceRecords(input));
      break;
    }
    case "query_surface_records": {
      const input = QuerySurfaceRecordsInputSchema.parse(rawArguments);
      output = QuerySurfaceRecordsOutputSchema.parse(await runtime.querySurfaceRecords(input));
      break;
    }
    default:
      throw new AgentToolProtocolError(`Unknown client-owned tool: ${call.name}`);
  }

  return {
    type: "function_call_output",
    call_id: call.call_id,
    caller: { type: "program", caller_id: call.caller.caller_id },
    output: JSON.stringify(output),
    status: "completed",
  };
}

export const MORPH_SUBAGENT_ROLES = Object.freeze([
  "PERCEPTION",
  "ADAPTIVE_DESIGN",
  "PLANNER",
  "CRITIC",
] as const satisfies readonly AgentRole[]);

const SPECIALIST_BY_OUTPUT: Readonly<Record<AgentOutputKind, AgentRole>> = Object.freeze({
  SURFACE_GRAPH: "PERCEPTION",
  INTENT_GRAPH: "ROOT",
  ADAPTIVE_UI_MANIFEST: "ADAPTIVE_DESIGN",
  ACTION_PLAN: "PLANNER",
  VERIFICATION_RESULT: "CRITIC",
});

export interface AgentRoute {
  readonly outputKind: AgentOutputKind;
  readonly role: AgentRole;
  readonly mode: "ROOT_ONLY" | "SPECIALIST";
  readonly promptVersion: typeof PROMPT_VERSION;
}

export function isMultiAgentEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment[MULTI_AGENT_FEATURE_FLAG]?.trim().toLowerCase() === "true";
}

export function resolveAgentRoute(
  outputKind: AgentOutputKind,
  multiAgentEnabled: boolean = isMultiAgentEnabled(),
): AgentRoute {
  const specialist = SPECIALIST_BY_OUTPUT[outputKind];
  const useSpecialist = multiAgentEnabled && specialist !== "ROOT";
  return Object.freeze({
    outputKind,
    role: useSpecialist ? specialist : "ROOT",
    mode: useSpecialist ? "SPECIALIST" : "ROOT_ONLY",
    promptVersion: PROMPT_VERSION,
  });
}

/** Returns a deterministic, duplicate-free routing plan for parallel orchestration. */
export function routeSubagents(
  outputKinds: readonly AgentOutputKind[],
  multiAgentEnabled: boolean = isMultiAgentEnabled(),
): readonly AgentRoute[] {
  return Object.freeze(
    [...new Set(outputKinds)].map((outputKind) =>
      resolveAgentRoute(outputKind, multiAgentEnabled),
    ),
  );
}

import { AIChatAgent } from "@cloudflare/ai-chat";
import type { OnChatMessageOptions } from "@cloudflare/ai-chat";
import { Agent, routeAgentRequest, type AgentContext } from "agents";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  isTextUIPart,
  isToolUIPart,
  stepCountIs,
  streamText,
  tool,
  type StreamTextOnFinishCallback,
  type StreamTextTransform,
  type TextStreamPart,
  type ToolSet,
  type UIMessageChunk,
  type UIMessageStreamWriter,
  type UIMessage
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import {
  buildOrchestratorSystemPrompt,
  createProposePr,
  gateToolCall,
  handleSlashCommand,
  initOrchestrator,
  recordTraceAndMaybeEvolve,
  type AgentDescriptor,
  type OrchestratorEnvBase,
  type OrchestratorRuntime
} from "./orchestrator-runtime";

interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatementLike;
}

interface KvNamespaceLike {
  get(key: string, options?: { type?: "text" | "json" | "arrayBuffer" | "stream" }): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

interface SandboxBindingLike {
  run(input: {
    code: string;
    bindings: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<{ stdout: string; exitCode: number }>;
}

interface BrowserBindingLike {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>;
}

type RuntimeEnv = Record<string, unknown> & {
  AI: unknown;
  ASSETS?: AssetBinding;
  DB?: D1DatabaseLike;
  WORKSPACE_FILES?: KvNamespaceLike;
  SANDBOX?: SandboxBindingLike;
  BROWSER?: BrowserBindingLike;
  OPEN_THINK_AGENT_NAME?: string;
  OPEN_THINK_CF_ACCOUNT_ID?: string;
  OPEN_THINK_CF_API_TOKEN?: string;
  OPEN_THINK_DEFAULT_MODEL?: string;
  OPEN_THINK_DEPLOYMENT_ID?: string;
  OPEN_THINK_PERSONAL_AGENT_CONFIG?: string;
  OPEN_THINK_TOOL_APPROVAL_POLICY?: string;
  OPEN_THINK_LAUNCH_BRIEF?: string;
  OPEN_THINK_SOUL_PROMPT?: string;
  OPEN_THINK_EXECUTOR_MCP_URL?: string;
  OPEN_THINK_EXECUTOR_AUTH_TOKEN?: string;
  OPEN_THINK_EXECUTOR_MCP_AUTO?: string;
  OPEN_THINK_SANDBOX_STATUS?: string;
  OPEN_THINK_CONTAINER_STATUS?: string;
  OPEN_THINK_GITHUB_TOKEN?: string;
  OPEN_THINK_PR_TARGET_OWNER?: string;
  OPEN_THINK_PR_TARGET_REPO?: string;
  OPEN_THINK_PR_BASE_BRANCH?: string;
  OPEN_THINK_PR_AUTHOR_NAME?: string;
  OPEN_THINK_PR_AUTHOR_EMAIL?: string;
  Sandbox?: unknown;
};

type ToolApprovalPolicy = "auto" | "ask-every-time" | "allow-all";
type SubAgentStatus = "ready" | "working" | "paused" | "archived";
type SubAgentMode = "agents-sdk" | "executor" | "hybrid";

type SubAgent = {
  id: string;
  name: string;
  purpose: string;
  status: SubAgentStatus;
  mode: SubAgentMode;
  model: string;
  brain: string;
  systemPrompt: string;
  skills: string[];
  summary: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

type SubAgentMessage = {
  id: string;
  subAgentId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

const generatedAgentName = "Local SDK Agent";
const generatedDeploymentId = "agent-local-build-test";
const generatedDefaultModel = "@cf/moonshotai/kimi-k2.6";
const workersAiFallbackModel = "@cf/moonshotai/kimi-k2.6";
const generatedCloudflareAccountId = "account-id";
const generatedPersonalAgentConfig = {"enabled":true,"presetId":"openthink-gbrain-gstack","label":"OpenThink gbrain + gstack","stack":"gstack","brain":"gbrain","summary":"Cloudflare-native second brain using D1 memory, R2 files, Queue tasks, Vectorize semantic recall, MCP tools, and runtime setup state.","setupKind":"native","advancedMode":false,"features":{"coreMemory":true,"profileMemory":true,"episodicMemory":true,"semanticMemory":true,"knowledgeGraph":false,"mcpBridge":true,"taskQueue":true,"fileWorkspace":true,"proactiveRoutines":true,"browserAutomation":false,"multiAgent":false,"localFirst":false,"healthTracking":false},"enabledFeatures":["coreMemory","profileMemory","episodicMemory","semanticMemory","mcpBridge","taskQueue","fileWorkspace","proactiveRoutines"],"setupSteps":["Create personal_agent_setup in D1","Seed the selected brain/stack profile into D1 memory","Expose the profile through health, manifest, runtime context, and chat instructions"],"setupStatus":"complete","toolApprovalPolicy":"ask-every-time","soulPromptConfigured":false,"launchBriefConfigured":false};
const generatedPublicPersonalAgentConfig = {"enabled":true,"presetId":"openthink-gbrain-gstack","label":"OpenThink gbrain + gstack","stack":"gstack","brain":"gbrain","summary":"Cloudflare-native second brain using D1 memory, R2 files, Queue tasks, Vectorize semantic recall, MCP tools, and runtime setup state.","setupKind":"native","advancedMode":false,"features":{"coreMemory":true,"profileMemory":true,"episodicMemory":true,"semanticMemory":true,"knowledgeGraph":false,"mcpBridge":true,"taskQueue":true,"fileWorkspace":true,"proactiveRoutines":true,"browserAutomation":false,"multiAgent":false,"localFirst":false,"healthTracking":false},"enabledFeatures":["coreMemory","profileMemory","episodicMemory","semanticMemory","mcpBridge","taskQueue","fileWorkspace","proactiveRoutines"],"setupSteps":["Create personal_agent_setup in D1","Seed the selected brain/stack profile into D1 memory","Expose the profile through health, manifest, runtime context, and chat instructions"],"setupStatus":"complete","toolApprovalPolicy":"ask-every-time","soulPromptConfigured":false,"launchBriefConfigured":false};
const generatedToolApprovalPolicy = "ask-every-time";
const generatedCloudAgentInstance = {"schemaVersion":"2026-05-10","id":"agent-local-build-test","label":"Local SDK Agent","kind":"cloud-agent-instance","chat":{"primaryRuntime":"cloudflare-agents-sdk","transport":"websocket","persistence":"sqlite"},"brain":{"id":"openthink-gbrain-gstack","label":"OpenThink gbrain + gstack","stack":"gstack","enabledFeatures":["coreMemory","profileMemory","episodicMemory","semanticMemory","mcpBridge","taskQueue","fileWorkspace","proactiveRoutines"]},"prompts":{"systemPromptConfigurable":true,"soulPromptConfigured":false,"launchBriefConfigured":false},"skills":[{"id":"gskills","label":"Goal, planning, memory, files, tasks, and Cloudflare operations","source":"built-in","enabled":true},{"id":"cloudflare-mcp","label":"Cloudflare API and docs MCP","source":"cloudflare","enabled":true},{"id":"executor-mcp","label":"Executor MCP execution plane","source":"executor","enabled":true}],"execution":{"agentsSdk":{"role":"chat-streaming-state-and-tool-orchestration","enabled":true},"executor":{"role":"external-execution-plane","enabled":true,"default":true,"configured":false,"status":"default-pending","mcpServerEnv":"OPEN_THINK_EXECUTOR_MCP_URL","authTokenEnv":"OPEN_THINK_EXECUTOR_AUTH_TOKEN","defaultTarget":"first-party Cloudflare Sandbox bridge or self-hosted Executor MCP endpoint","recommendedFor":["code execution","filesystem work","browser automation","OpenAPI tool execution","subprocesses","long-running workflow workers"]},"sandbox":{"role":"cloudflare-sandbox-execution","enabled":true,"default":true,"configured":false,"status":"default-pending"},"containers":{"role":"custom-runtime-and-long-running-services","enabled":true,"default":true,"configured":false,"status":"default-pending"}},"goal":{"command":"/goal","firstClass":true,"persistence":"D1 memory when DB is bound, otherwise chat state","executorAware":true},"subAgents":{"firstClass":true,"persistence":"D1 sub_agents and sub_agent_messages when DB is bound","modes":["agents-sdk","executor","hybrid"],"controls":["create","pause","resume","archive","summarize","message","brief-main-chat"]},"sdk":{"packageName":"@open-think/core","version":"0.3.0","clientFactory":"createHostedCloudAgentClient","profileEndpoint":"/cloud-agent/profile","endpoints":{"health":"/health","manifest":"/manifest","goal":"/goal","subAgents":"/subagents","runtimeContext":"/runtime/context","personalAgentSetup":"/personal-agent/setup"}},"customization":{"deployTime":["agentName","defaultModel","thinkingLevel","personalAgent preset","enabled gbrain/gstack features","tool approval policy"],"runtimeEnv":["OPEN_THINK_DEFAULT_MODEL","OPEN_THINK_TOOL_APPROVAL_POLICY","OPEN_THINK_EXECUTOR_MCP_URL","OPEN_THINK_EXECUTOR_AUTH_TOKEN","Cloudflare resource bindings"],"personalAgent":["system prompt","soul prompt","launch brief","brain preset","memory/task/file/MCP feature mix"],"subAgent":["name","purpose","mode","brain","skills","system prompt","model"]}};
const generatedCloudAgentGoalInstruction = "Cloud agent instance profile:\n{\n  \"schemaVersion\": \"2026-05-10\",\n  \"id\": \"agent-local-build-test\",\n  \"label\": \"Local SDK Agent\",\n  \"kind\": \"cloud-agent-instance\",\n  \"chat\": {\n    \"primaryRuntime\": \"cloudflare-agents-sdk\",\n    \"transport\": \"websocket\",\n    \"persistence\": \"sqlite\"\n  },\n  \"brain\": {\n    \"id\": \"openthink-gbrain-gstack\",\n    \"label\": \"OpenThink gbrain + gstack\",\n    \"stack\": \"gstack\",\n    \"enabledFeatures\": [\n      \"coreMemory\",\n      \"profileMemory\",\n      \"episodicMemory\",\n      \"semanticMemory\",\n      \"mcpBridge\",\n      \"taskQueue\",\n      \"fileWorkspace\",\n      \"proactiveRoutines\"\n    ]\n  },\n  \"prompts\": {\n    \"systemPromptConfigurable\": true,\n    \"soulPromptConfigured\": false,\n    \"launchBriefConfigured\": false\n  },\n  \"skills\": [\n    {\n      \"id\": \"gskills\",\n      \"label\": \"Goal, planning, memory, files, tasks, and Cloudflare operations\",\n      \"source\": \"built-in\",\n      \"enabled\": true\n    },\n    {\n      \"id\": \"cloudflare-mcp\",\n      \"label\": \"Cloudflare API and docs MCP\",\n      \"source\": \"cloudflare\",\n      \"enabled\": true\n    },\n    {\n      \"id\": \"executor-mcp\",\n      \"label\": \"Executor MCP execution plane\",\n      \"source\": \"executor\",\n      \"enabled\": true\n    }\n  ],\n  \"execution\": {\n    \"agentsSdk\": {\n      \"role\": \"chat-streaming-state-and-tool-orchestration\",\n      \"enabled\": true\n    },\n    \"executor\": {\n      \"role\": \"external-execution-plane\",\n      \"enabled\": true,\n      \"default\": true,\n      \"configured\": false,\n      \"status\": \"default-pending\",\n      \"mcpServerEnv\": \"OPEN_THINK_EXECUTOR_MCP_URL\",\n      \"authTokenEnv\": \"OPEN_THINK_EXECUTOR_AUTH_TOKEN\",\n      \"defaultTarget\": \"first-party Cloudflare Sandbox bridge or self-hosted Executor MCP endpoint\",\n      \"recommendedFor\": [\n        \"code execution\",\n        \"filesystem work\",\n        \"browser automation\",\n        \"OpenAPI tool execution\",\n        \"subprocesses\",\n        \"long-running workflow workers\"\n      ]\n    },\n    \"sandbox\": {\n      \"role\": \"cloudflare-sandbox-execution\",\n      \"enabled\": true,\n      \"default\": true,\n      \"configured\": false,\n      \"status\": \"default-pending\"\n    },\n    \"containers\": {\n      \"role\": \"custom-runtime-and-long-running-services\",\n      \"enabled\": true,\n      \"default\": true,\n      \"configured\": false,\n      \"status\": \"default-pending\"\n    }\n  },\n  \"goal\": {\n    \"command\": \"/goal\",\n    \"firstClass\": true,\n    \"persistence\": \"D1 memory when DB is bound, otherwise chat state\",\n    \"executorAware\": true\n  },\n  \"subAgents\": {\n    \"firstClass\": true,\n    \"persistence\": \"D1 sub_agents and sub_agent_messages when DB is bound\",\n    \"modes\": [\n      \"agents-sdk\",\n      \"executor\",\n      \"hybrid\"\n    ],\n    \"controls\": [\n      \"create\",\n      \"pause\",\n      \"resume\",\n      \"archive\",\n      \"summarize\",\n      \"message\",\n      \"brief-main-chat\"\n    ]\n  },\n  \"sdk\": {\n    \"packageName\": \"@open-think/core\",\n    \"version\": \"0.3.0\",\n    \"clientFactory\": \"createHostedCloudAgentClient\",\n    \"profileEndpoint\": \"/cloud-agent/profile\",\n    \"endpoints\": {\n      \"health\": \"/health\",\n      \"manifest\": \"/manifest\",\n      \"goal\": \"/goal\",\n      \"subAgents\": \"/subagents\",\n      \"runtimeContext\": \"/runtime/context\",\n      \"personalAgentSetup\": \"/personal-agent/setup\"\n    }\n  },\n  \"customization\": {\n    \"deployTime\": [\n      \"agentName\",\n      \"defaultModel\",\n      \"thinkingLevel\",\n      \"personalAgent preset\",\n      \"enabled gbrain/gstack features\",\n      \"tool approval policy\"\n    ],\n    \"runtimeEnv\": [\n      \"OPEN_THINK_DEFAULT_MODEL\",\n      \"OPEN_THINK_TOOL_APPROVAL_POLICY\",\n      \"OPEN_THINK_EXECUTOR_MCP_URL\",\n      \"OPEN_THINK_EXECUTOR_AUTH_TOKEN\",\n      \"Cloudflare resource bindings\"\n    ],\n    \"personalAgent\": [\n      \"system prompt\",\n      \"soul prompt\",\n      \"launch brief\",\n      \"brain preset\",\n      \"memory/task/file/MCP feature mix\"\n    ],\n    \"subAgent\": [\n      \"name\",\n      \"purpose\",\n      \"mode\",\n      \"brain\",\n      \"skills\",\n      \"system prompt\",\n      \"model\"\n    ]\n  }\n}\nUse Cloudflare Agents SDK for chat streaming, resumable state, message persistence, MCP orchestration, and human approvals.\nExecutor is the default execution-plane contract, but it is callable only when OPEN_THINK_EXECUTOR_MCP_URL is configured or an executor MCP server is connected.\nIn the default OpenThink architecture, executor MCP points at a first-party Cloudflare Sandbox bridge backed by Containers. It can also point at a self-hosted RhysSullivan/executor MCP endpoint.\nUse executor when it is configured and the goal needs code execution, filesystem work, browser automation, subprocesses, OpenAPI execution, or long-running workflow workers.\nTreat sub-agents as scoped child Cloud Agent Instances with their own purpose, brain, prompt, skills, status, summary, and interaction thread.\nIf the executor URL is missing, say the executor plane is enabled by default but not connected yet; do not claim live command/filesystem/browser access.\nAgents can be customized through the cloud agent profile: system prompt, soul prompt, launch brief, brain preset, enabled features, skills, and execution plane.\nExternal products can plug in through the hosted agent SDK: @open-think/core createHostedCloudAgentClient.";
const docsMcpServerUrl = "https://docs.mcp.cloudflare.com/mcp";
const cloudflareMcpServerUrl = "https://mcp.cloudflare.com/mcp";

async function prepareModelMessages(messages: UIMessage[]) {
  return convertToModelMessages(sanitizeMessagesForModel(messages), { ignoreIncompleteToolCalls: true });
}

function suppressToolInputStreamingTransform<TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> {
  return () =>
    new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type === "tool-input-start" || part.type === "tool-input-delta") return;
        controller.enqueue(part);
      }
    });
}

function sanitizeMessagesForModel(messages: UIMessage[]): UIMessage[] {
  const activeApprovalIndex = activeApprovalContinuationIndex(messages);

  const strippedMessages = messages
    .map((message, messageIndex) => {
      const shouldKeepToolParts = messageIndex === activeApprovalIndex;
      if (shouldKeepToolParts || !message.parts.some(isToolUIPart)) return stripEmptyTextParts(message);

      return {
        ...message,
        parts: message.parts.filter((part) => !isToolUIPart(part) && !isEmptyTextPart(part))
      } as UIMessage;
    })
    .filter((message) => message.role === "user" || message.parts.length > 0);

  return mergeAdjacentUserMessages(strippedMessages);
}

function stripEmptyTextParts(message: UIMessage): UIMessage {
  return {
    ...message,
    parts: message.parts.filter((part) => !isEmptyTextPart(part))
  } as UIMessage;
}

function isEmptyTextPart(part: UIMessage["parts"][number]) {
  return isTextUIPart(part) && part.text.trim().length === 0;
}

function mergeAdjacentUserMessages(messages: UIMessage[]): UIMessage[] {
  const merged: UIMessage[] = [];
  for (const message of messages) {
    const previous = merged[merged.length - 1];
    if (previous?.role === "user" && message.role === "user") {
      merged[merged.length - 1] = mergeUserMessages(previous, message);
      continue;
    }
    merged.push(message);
  }
  return merged;
}

function mergeUserMessages(left: UIMessage, right: UIMessage): UIMessage {
  const text = [textPartContent(left.parts), textPartContent(right.parts)].filter(Boolean).join("\n\n");
  const nonTextParts = [...left.parts, ...right.parts].filter((part) => !isTextUIPart(part));
  return {
    ...right,
    parts: [
      ...(text ? [{ type: "text", text } as UIMessage["parts"][number]] : []),
      ...nonTextParts
    ]
  } as UIMessage;
}

function textPartContent(parts: UIMessage["parts"]) {
  return parts
    .filter(isTextUIPart)
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

function isRenderableUiChunk(chunk: UIMessageChunk) {
  if (chunk.type === "text-delta") return chunk.delta.trim().length > 0;
  return (
    chunk.type === "tool-input-available" ||
    chunk.type === "tool-input-error" ||
    chunk.type === "tool-approval-request" ||
    chunk.type === "tool-output-available" ||
    chunk.type === "tool-output-error" ||
    chunk.type === "tool-output-denied"
  );
}

function writeTextFallback(writer: UIMessageStreamWriter<UIMessage>, text: string) {
  const id = "fallback-" + crypto.randomUUID();
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

function activeApprovalContinuationIndex(messages: UIMessage[]) {
  let lastMessageIndex = -1;
  let lastMessage: UIMessage | undefined;
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (!message) continue;
    if (message.role === "user") return -1;
    if (message.role === "assistant" && message.parts.length > 0) {
      lastMessageIndex = messageIndex;
      lastMessage = message;
      break;
    }
  }
  if (!lastMessage) return -1;

  const toolParts = lastMessage.parts.filter(isToolUIPart);
  if (toolParts.length === 0) return -1;

  const lastToolPartIndex = lastMessage.parts.reduce((lastIndex, part, partIndex) => {
    return isToolUIPart(part) ? partIndex : lastIndex;
  }, -1);
  const hasAssistantTextAfterLastTool = lastMessage.parts.slice(lastToolPartIndex + 1).some((part) => {
    return isTextUIPart(part) && part.text.trim().length > 0;
  });
  if (hasAssistantTextAfterLastTool) return -1;

  const hasApprovalResponse = toolParts.some((part) => {
    const state = uiToolState(part);
    return state === "approval-responded" || state === "approved";
  });
  if (!hasApprovalResponse) return -1;

  const allApprovalsSettled = toolParts.every((part) => {
    const state = uiToolState(part);
    return state === "approval-responded" || state === "approved" || state === "output-available" || state === "output-error";
  });

  return allApprovalsSettled ? lastMessageIndex : -1;
}

function uiToolState(part: UIMessage["parts"][number]) {
  return typeof (part as { state?: unknown }).state === "string"
    ? String((part as { state: string }).state)
    : "";
}

export class PersonalChatAgent extends AIChatAgent<RuntimeEnv> {
  maxPersistedMessages = 200;
  waitForMcpConnections = { timeout: 10_000 };
  private readonly agentEnv: RuntimeEnv;

  constructor(ctx: AgentContext, env: RuntimeEnv) {
    super(ctx, env);
    this.agentEnv = env;
  }

  async onStart(): Promise<void> {
    await this.ensureDefaultMcpServers();
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/health")) {
      return Response.json({
        ok: true,
        runtime: "cloudflare-agents-sdk",
        agent: "PersonalChatAgent",
        defaultModel: this.runtimeEnv.OPEN_THINK_DEFAULT_MODEL ?? generatedDefaultModel,
        personalAgent: this.publicPersonalAgentConfig(),
        cloudAgentInstance: cloudAgentInstanceState(this.runtimeEnv),
        toolApprovalPolicy: this.toolApprovalPolicy(),
        slashCommands: {
          goal: goalCommandPayload("", this.runtimeEnv)
        },
        subAgents: subAgentCapabilityState(this.runtimeEnv),
        mcpServers: this.getMcpServers()
      });
    }

    if (url.pathname.endsWith("/goal")) {
      return handleGoalRequest(request, this.runtimeEnv);
    }

    if (url.pathname.endsWith("/mcp/add") && request.method === "POST") {
      const payload = await request.json().catch(() => ({}));
      const name = sanitizeMcpName(payload.name);
      const serverUrl = sanitizeHttpsUrl(payload.url ?? payload.serverUrl);
      if (!name) return Response.json({ error: "name is required" }, { status: 400 });
      if (!serverUrl) return Response.json({ error: "url must be HTTPS" }, { status: 400 });

      const headers = sanitizeHeaders(payload.headers);
      const result = await this.addMcpServer(
        name,
        serverUrl,
        headers ? { transport: { headers } } : undefined
      );

      return Response.json({
        id: result.id,
        state: result.state,
        authUrl: "authUrl" in result ? result.authUrl : null
      });
    }

    if (url.pathname.endsWith("/mcp/state")) {
      return Response.json(this.getMcpServers());
    }

    if (url.pathname.endsWith("/personal-agent/setup")) {
      return Response.json({
        enabled: Boolean(this.personalAgentConfig().enabled),
        config: this.publicPersonalAgentConfig(),
        toolApprovalPolicy: this.toolApprovalPolicy(),
        setup: {
          status: "agents-sdk-runtime",
          note: "Package-style runtime reads OPEN_THINK_PERSONAL_AGENT_CONFIG, OPEN_THINK_SOUL_PROMPT, and OPEN_THINK_LAUNCH_BRIEF; D1 setup bootstrap is handled by the raw Worker deployment path."
        }
      });
    }

    return Response.json({
      runtime: "cloudflare-agents-sdk",
      websocket: "/agents/personal-chat-agent/default",
      chatProtocol: "AIChatAgent/useAgentChat",
      chat: {
        transport: "websocket",
        streaming: "resumable-ui-message-stream",
        persistence: "AIChatAgent SQLite",
        clientHooks: ["useAgent", "useAgentChat"],
        streamResponse: "toUIMessageStreamResponse"
      },
      cloudAgentInstance: cloudAgentInstanceState(this.runtimeEnv),
      slashCommands: {
        goal: goalCommandPayload("", this.runtimeEnv)
      },
      subAgents: subAgentCapabilityState(this.runtimeEnv),
      mcp: {
        state: "mcp/state",
        add: "mcp/add",
        toolApprovalPolicy: this.toolApprovalPolicy()
      }
    });
  }

  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: OnChatMessageOptions
  ): Promise<Response> {
    await this.ensureDefaultMcpServers();

    const env = this.runtimeEnv;
    const workersai = createWorkersAI({ binding: env.AI as never });
    const model = workersai(env.OPEN_THINK_DEFAULT_MODEL ?? generatedDefaultModel);
    const system = [
      "You are " + (env.OPEN_THINK_AGENT_NAME ?? generatedAgentName) + ", an open-think personal agent running on Cloudflare Agents SDK.",
      this.personalAgentSystemInstruction(),
      "Use the native AIChatAgent chat protocol for resumable WebSocket streaming and SQLite message persistence.",
      "If several user messages are queued without an assistant answer, treat them as one latest turn and answer the newest actionable request first.",
      "Do not continue stale deployment or tool work unless the newest user message explicitly asks you to continue it.",
      cloudAgentInstanceInstruction(env),
      goalCommandInstruction(),
      "You can create, brief, pause, resume, archive, summarize, and message Cloud Agent Instance sub-agents through built-in sub-agent tools when the owner asks for delegated work.",
      "Use connected MCP tools when they are relevant. Current MCP tool approval policy: " + this.toolApprovalPolicy() + ".",
      "Deployment id: " + (env.OPEN_THINK_DEPLOYMENT_ID ?? generatedDeploymentId),
      "Cloudflare account id: " + ((env.OPEN_THINK_CF_ACCOUNT_ID ?? generatedCloudflareAccountId) || "not configured")
    ].join("\n");
    const modelMessages = await prepareModelMessages(this.messages);
    const result = streamText({
      model,
      system,
      messages: modelMessages,
      tools: {
        ...this.mcpToolsWithApprovalPolicy(),
        ...this.builtinTools()
      },
      experimental_transform: suppressToolInputStreamingTransform(),
      stopWhen: stepCountIs(5),
      ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {}),
      onFinish
    });

    const stream = createUIMessageStream<UIMessage>({
      execute: async ({ writer }) => {
        const delayedFinishChunks: UIMessageChunk[] = [];
        let sawRenderableChunk = false;
        for await (const chunk of result.toUIMessageStream<UIMessage>({ sendReasoning: false })) {
          if (chunk.type === "finish") {
            delayedFinishChunks.push(chunk);
            continue;
          }
          if (isRenderableUiChunk(chunk)) sawRenderableChunk = true;
          writer.write(chunk);
        }

        if (!sawRenderableChunk && !options?.abortSignal?.aborted) {
          const fallback = await generateText({
            model,
            system,
            messages: modelMessages,
            maxOutputTokens: 256,
            temperature: 0.2,
            ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {})
          });
          writeTextFallback(
            writer,
            fallback.text.trim() || "I did not receive model output. Send the request again if needed."
          );
        }

        for (const chunk of delayedFinishChunks) writer.write(chunk);
      }
    });

    return createUIMessageStreamResponse({ stream });
  }

  private async ensureDefaultMcpServers(): Promise<void> {
    await this.addMcpServer("cloudflare-docs", docsMcpServerUrl).catch(() => undefined);

    if (this.runtimeEnv.OPEN_THINK_CF_API_TOKEN) {
      await this.addMcpServer("cloudflare-api", cloudflareMcpServerUrl, {
        transport: {
          headers: {
            Authorization: `Bearer ${this.runtimeEnv.OPEN_THINK_CF_API_TOKEN}`
          }
        }
      }).catch(() => undefined);
    }

    const executorUrl = sanitizeHttpsUrl(this.runtimeEnv.OPEN_THINK_EXECUTOR_MCP_URL);
    if (executorUrl) {
      const executorHeaders = this.runtimeEnv.OPEN_THINK_EXECUTOR_AUTH_TOKEN
        ? { Authorization: `Bearer ${this.runtimeEnv.OPEN_THINK_EXECUTOR_AUTH_TOKEN}` }
        : undefined;
      await this.addMcpServer(
        "executor",
        executorUrl,
        executorHeaders ? { transport: { headers: executorHeaders } } : undefined
      ).catch(() => undefined);
    }
  }

  private builtinTools(): ToolSet {
    return {
      getUserTimezone: tool({
        description: "Get the owner's browser timezone, locale, and local time from the connected client.",
        inputSchema: z.object({})
      }),
      setActiveGoal: tool({
        description: "Persist the owner's active /goal brief into D1 memory when the DB binding is available.",
        inputSchema: z.object({
          goal: z.string().min(1).describe("The active goal objective."),
          successCriteria: z.array(z.string()).default([]).describe("How the owner and agent will know the goal is complete."),
          milestones: z.array(z.string()).default([]).describe("Major checkpoints for the goal."),
          nextActions: z.array(z.string()).default([]).describe("Concrete next actions to take."),
          notes: z.string().optional().describe("Optional constraints, risks, or context.")
        }),
        execute: async (input) => this.setActiveGoal(input)
      }),
      createSubAgent: tool({
        description: "Create a D1-tracked Cloud Agent Instance sub-agent for delegated work.",
        inputSchema: z.object({
          name: z.string().min(1).describe("Short sub-agent name."),
          purpose: z.string().min(1).describe("The delegated mission or responsibility."),
          systemPrompt: z.string().optional().describe("Optional custom operating instructions."),
          brain: z.string().optional().describe("Brain or skill preset, for example gbrain + gskills."),
          skills: z.array(z.string()).default([]).describe("Enabled skills or capabilities."),
          mode: z.enum(["agents-sdk", "executor", "hybrid"]).default("hybrid").describe("Preferred execution mode."),
          model: z.string().optional().describe("Optional model override.")
        }),
        execute: async (input) => createSubAgent(this.runtimeEnv, input)
      }),
      updateSubAgentStatus: tool({
        description: "Pause, resume, mark working, or archive a tracked sub-agent.",
        inputSchema: z.object({
          id: z.string().min(1),
          status: z.enum(["ready", "working", "paused", "archived"])
        }),
        execute: async ({ id, status }) => updateSubAgentStatus(this.runtimeEnv, id, status)
      }),
      summarizeSubAgent: tool({
        description: "Refresh and return a concise summary for a tracked sub-agent.",
        inputSchema: z.object({
          id: z.string().min(1)
        }),
        execute: async ({ id }) => refreshSubAgentSummary(this.runtimeEnv, id)
      }),
      sendSubAgentMessage: tool({
        description: "Send a message to a tracked sub-agent and receive its response.",
        inputSchema: z.object({
          id: z.string().min(1),
          message: z.string().min(1)
        }),
        execute: async ({ id, message }) => sendSubAgentMessage(this.runtimeEnv, id, message)
      }),
      confirmCloudflareOperation: tool({
        description: "Request owner approval before a destructive, expensive, or security-sensitive Cloudflare operation. This checkpoint does not execute the operation by itself.",
        inputSchema: z.object({
          operation: z.string().describe("The Cloudflare operation that needs approval"),
          risk: z.string().describe("Why approval is needed"),
          resources: z.array(z.string()).default([]).describe("Cloudflare resources affected by the operation")
        }),
        needsApproval: async () => true,
        execute: async ({ operation, risk, resources }) => ({
          approved: true,
          operation,
          risk,
          resources,
          approvedAt: new Date().toISOString()
        })
      })
    };
  }

  private async setActiveGoal(input: {
    goal: string;
    successCriteria: string[];
    milestones: string[];
    nextActions: string[];
    notes?: string | undefined;
  }): Promise<Record<string, unknown>> {
    const db = this.runtimeEnv.DB;
    const text = formatActiveGoalMemory(input);
    if (!db) {
      return {
        stored: false,
        goal: input.goal,
        memory: text,
        error: "D1 DB binding is not configured; goal remains in conversation state."
      };
    }

    await db.prepare(
      "create table if not exists memories (id text primary key, text text not null, created_at text not null)"
    ).run();
    const storedAt = new Date().toISOString();
    await db.prepare("insert into memories (id, text, created_at) values (?, ?, ?)")
      .bind(crypto.randomUUID(), text, storedAt)
      .run();
    return {
      stored: true,
      table: "memories",
      goal: input.goal,
      memory: text,
      storedAt
    };
  }

  private mcpToolsWithApprovalPolicy(): ToolSet {
    const policy = this.toolApprovalPolicy();
    const tools = this.mcp.getAITools();
    return Object.fromEntries(
      Object.entries(tools).map(([name, definition]) => {
        if (policy === "allow-all") {
          const { needsApproval: _needsApproval, ...withoutApproval } = definition;
          return [name, withoutApproval];
        }
        return [
          name,
          {
            ...definition,
            needsApproval: async () =>
              policy === "ask-every-time" || shouldAutoRequireToolApproval(name, definition)
          }
        ];
      })
    ) as ToolSet;
  }

  private toolApprovalPolicy(): ToolApprovalPolicy {
    return normalizeToolApprovalPolicy(
      this.runtimeEnv.OPEN_THINK_TOOL_APPROVAL_POLICY ??
        this.personalAgentConfig().toolApprovalPolicy ??
        generatedToolApprovalPolicy
    );
  }

  private personalAgentConfig(): Record<string, unknown> {
    const raw = this.runtimeEnv.OPEN_THINK_PERSONAL_AGENT_CONFIG;
    let config: Record<string, unknown> = generatedPersonalAgentConfig;
    if (raw) {
      try {
        config = JSON.parse(raw);
      } catch {
        config = generatedPersonalAgentConfig;
      }
    }
    config = { ...config };
    config.toolApprovalPolicy = normalizeToolApprovalPolicy(
      this.runtimeEnv.OPEN_THINK_TOOL_APPROVAL_POLICY ?? config.toolApprovalPolicy
    );
    const enabled = Boolean(config.enabled);
    config.soulPromptConfigured = Boolean(enabled && (config.soulPromptConfigured || config.soulPrompt));
    config.launchBriefConfigured = Boolean(enabled && (config.launchBriefConfigured || config.launchBrief));
    if (enabled && config.soulPromptConfigured && typeof this.runtimeEnv.OPEN_THINK_SOUL_PROMPT === "string" && this.runtimeEnv.OPEN_THINK_SOUL_PROMPT.trim()) {
      config.soulPrompt = this.runtimeEnv.OPEN_THINK_SOUL_PROMPT.trim();
    }
    if (enabled && config.launchBriefConfigured && typeof this.runtimeEnv.OPEN_THINK_LAUNCH_BRIEF === "string" && this.runtimeEnv.OPEN_THINK_LAUNCH_BRIEF.trim()) {
      config.launchBrief = this.runtimeEnv.OPEN_THINK_LAUNCH_BRIEF.trim();
    }
    return config;
  }

  private publicPersonalAgentConfig(): Record<string, unknown> {
    const config = this.personalAgentConfig();
    const copy = { ...config };
    const soulPromptConfigured = Boolean(copy.soulPromptConfigured || copy.soulPrompt);
    const launchBriefConfigured = Boolean(copy.launchBriefConfigured || copy.launchBrief);
    delete copy.soulPrompt;
    delete copy.launchBrief;
    return {
      ...generatedPublicPersonalAgentConfig,
      ...copy,
      soulPromptConfigured,
      launchBriefConfigured,
      toolApprovalPolicy: this.toolApprovalPolicy()
    };
  }

  private personalAgentSystemInstruction(): string {
    const config = this.personalAgentConfig();
    if (!config.enabled) {
      return "Personal agent subsystem setup is disabled. Use the built-in OpenThink runtime defaults.";
    }
    const enabledFeatures = Array.isArray(config.enabledFeatures)
      ? config.enabledFeatures.join(", ")
      : "none";
    return [
      "Personal agent subsystem: " + String(config.label ?? "OpenThink gbrain + gstack") + ".",
      "Stack: " + String(config.stack ?? "gstack") + ". Brain: " + String(config.brain ?? "gbrain") + ".",
      "Setup status: " + String(config.setupStatus ?? "complete") + ". Enabled features: " + enabledFeatures + ".",
      "MCP tool approval policy: " + this.toolApprovalPolicy() + ".",
      typeof config.soulPrompt === "string" && config.soulPrompt.trim()
        ? "Owner soul prompt:\n" + config.soulPrompt.trim()
        : "",
      typeof config.launchBrief === "string" && config.launchBrief.trim()
        ? "Initial launch brief:\n" + config.launchBrief.trim()
        : ""
    ].filter(Boolean).join("\n");
  }

  private get runtimeEnv(): RuntimeEnv {
    return this.agentEnv;
  }
}

/**
 * Default child agent descriptors registered on the orchestrator. Each
 * descriptor's bindingName must match a wrangler durable_objects binding;
 * unknown bindings are silently skipped by wireOrchestratorMcpRpc().
 */
const defaultChildDescriptors: AgentDescriptor[] = [
  {
    id: "child-coder",
    workspaceId: "default",
    role: "coder",
    name: "coder",
    description: "Writes and edits code; runs typecheck/test loops.",
    bindingName: "AGENT_CODER",
    enabledSkillIds: [],
    pinned: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "child-researcher",
    workspaceId: "default",
    role: "researcher",
    name: "researcher",
    description: "Investigates topics; gathers and summarizes sources.",
    bindingName: "AGENT_RESEARCHER",
    enabledSkillIds: [],
    pinned: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "child-browser",
    workspaceId: "default",
    role: "browser",
    name: "browser",
    description: "Navigates the web, fetches pages, takes screenshots, and extracts text.",
    bindingName: "AGENT_BROWSER",
    enabledSkillIds: [],
    pinned: true,
    createdAt: new Date(0).toISOString()
  }
];

type OrchestratorEnv = RuntimeEnv & OrchestratorEnvBase;

/**
 * OrchestratorAgent — extends the Cloudflare Agents SDK Agent class so
 * the openthink2 orchestrator layer (skills + approval + code-mode +
 * executor + sub-agents + goals + evolve) is live in deployed agents.
 *
 * The class is intentionally thin: onStart() boots the runtime via
 * initOrchestrator(), onMessage() routes /goal slash commands, and
 * onRequest() exposes the /learning/* and /goals control endpoints.
 */
export class OrchestratorAgent extends Agent<OrchestratorEnv> {
  private runtime: OrchestratorRuntime<OrchestratorEnv> | null = null;

  async onStart(): Promise<void> {
    this.runtime = await initOrchestrator<OrchestratorEnv>({
      agent: {
        env: this.env,
        ctx: { storage: this.ctx.storage as never },
        addMcpServer: (name: string, binding: unknown) =>
          this.addMcpServer(name, binding as never)
      },
      children: defaultChildDescriptors
    });
  }

  async onMessage(connection: { send(message: string): void }, message: unknown): Promise<void> {
    if (!this.runtime) await this.onStart();
    const text = typeof message === "string" ? message : "";
    if (text) {
      const slash = await handleSlashCommand(text, this.runtime!);
      if (slash.handled) {
        connection.send(JSON.stringify({ type: "slash-command", message: slash.message ?? "" }));
        return;
      }
    }
  }

  async onRequest(request: Request): Promise<Response> {
    if (!this.runtime) await this.onStart();
    const runtime = this.runtime!;
    const url = new URL(request.url);

    if (url.pathname.endsWith("/learning/pending")) {
      const suggestions = (await this.ctx.storage.get<unknown[]>("ws:suggestions")) ?? [];
      return Response.json({ suggestions });
    }

    if (url.pathname.endsWith("/learning/decisions") && request.method === "GET") {
      const decisions = (await this.ctx.storage.get<unknown[]>("ws:decisions")) ?? [];
      return Response.json({ decisions });
    }

    if (url.pathname.endsWith("/learning/decisions") && request.method === "POST") {
      const payload = await request.json().catch(() => ({}));
      const decisions = ((await this.ctx.storage.get<unknown[]>("ws:decisions")) ?? []) as unknown[];
      decisions.push({ ...(payload as Record<string, unknown>), recordedAt: new Date().toISOString() });
      await this.ctx.storage.put("ws:decisions", decisions);
      return Response.json({ ok: true, count: decisions.length });
    }

    if (url.pathname.endsWith("/learning/summary")) {
      const suggestions = ((await this.ctx.storage.get<unknown[]>("ws:suggestions")) ?? []) as unknown[];
      const decisions = ((await this.ctx.storage.get<unknown[]>("ws:decisions")) ?? []) as unknown[];
      const traces = ((await this.ctx.storage.get<unknown[]>("ws:traces")) ?? []) as unknown[];
      const systemPrompt = await buildOrchestratorSystemPrompt(runtime);
      return Response.json({
        pendingSuggestions: suggestions.length,
        decisionCount: decisions.length,
        traceCount: traces.length,
        systemPromptPreview: systemPrompt.slice(0, 4000)
      });
    }

    if (url.pathname.endsWith("/goals") && request.method === "GET") {
      return Response.json({ goals: await runtime.goals.list() });
    }

    if (url.pathname.endsWith("/goals") && request.method === "POST") {
      const payload = await request.json().catch(() => ({}));
      const text = String((payload as { goal?: unknown; text?: unknown; message?: unknown }).goal ??
        (payload as { goal?: unknown; text?: unknown; message?: unknown }).text ??
        (payload as { goal?: unknown; text?: unknown; message?: unknown }).message ?? "");
      const slash = await handleSlashCommand("/goal " + text, runtime);
      return Response.json({ ok: slash.handled, message: slash.message ?? "" });
    }

    if (url.pathname.endsWith("/orchestrator/state")) {
      return Response.json(await runtime.store.getContext());
    }

    if (url.pathname.endsWith("/orchestrator/approval/check") && request.method === "POST") {
      const payload = await request.json().catch(() => ({}));
      const toolName = String((payload as { toolName?: unknown }).toolName ?? "");
      const decision = await gateToolCall(runtime, { toolName });
      return Response.json(decision);
    }

    return Response.json({
      runtime: "orchestrator-agent",
      endpoints: [
        "/learning/pending",
        "/learning/decisions",
        "/learning/summary",
        "/goals",
        "/orchestrator/state",
        "/orchestrator/approval/check"
      ]
    });
  }

  async recordTrace(trace: Parameters<typeof recordTraceAndMaybeEvolve>[2]): Promise<{ evolved: boolean; suggestionCount: number }> {
    if (!this.runtime) await this.onStart();
    const llm = {
      async summarize(_args: { system: string; user: string }) {
        return JSON.stringify({ skills: [], rubrics: [], prompts: [] });
      }
    };
    return recordTraceAndMaybeEvolve(this.runtime!, this.ctx.storage as never, trace, llm);
  }
}

/**
 * Helper: produce a tool result with a single text part. Keeps tool
 * handlers schema-conformant whether they succeed or degrade.
 */
function mcpTextResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    ...(isError ? { isError: true } : {})
  };
}

const WORKSPACE_KEY_PREFIX = "workspace/";

function workspaceKey(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  return WORKSPACE_KEY_PREFIX + trimmed;
}

/**
 * Child agent: scoped coder. Registers file-system, sandbox, and
 * pull-request tools that the orchestrator can call over RPC MCP.
 *
 * Every tool degrades gracefully when its required binding is missing:
 * the handler returns a clear error message instead of throwing.
 */
export class AgentCoder extends McpAgent<RuntimeEnv> {
  server = new McpServer({ name: "agent-coder", version: "0.1.0" });

  async init(): Promise<void> {
    const server = this.server;

    server.tool(
      "read_file",
      "Read a file from the per-agent workspace KV namespace.",
      { path: z.string() },
      async (args) => {
        const kv = this.env.WORKSPACE_FILES;
        if (!kv) {
          return mcpTextResult(
            "WORKSPACE_FILES KV binding is not configured for this agent.",
            true
          );
        }
        try {
          const value = await kv.get(workspaceKey(args.path));
          if (value === null) {
            return mcpTextResult("File not found: " + args.path, true);
          }
          return mcpTextResult(value);
        } catch (error) {
          return mcpTextResult(
            "read_file failed: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );

    server.tool(
      "write_file",
      "Write (or overwrite) a file in the per-agent workspace KV namespace.",
      { path: z.string(), content: z.string() },
      async (args) => {
        const kv = this.env.WORKSPACE_FILES;
        if (!kv) {
          return mcpTextResult(
            "WORKSPACE_FILES KV binding is not configured for this agent.",
            true
          );
        }
        try {
          await kv.put(workspaceKey(args.path), args.content);
          return mcpTextResult("wrote " + args.content.length + " chars to " + args.path);
        } catch (error) {
          return mcpTextResult(
            "write_file failed: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );

    server.tool(
      "list_files",
      "List files in the per-agent workspace KV namespace, optionally filtered by prefix.",
      { prefix: z.string().optional() },
      async (args) => {
        const kv = this.env.WORKSPACE_FILES;
        if (!kv) {
          return mcpTextResult(
            "WORKSPACE_FILES KV binding is not configured for this agent.",
            true
          );
        }
        try {
          const prefix = workspaceKey(args.prefix ?? "");
          const result = await kv.list({ prefix, limit: 1000 });
          const paths = result.keys
            .map((key) => key.name.slice(WORKSPACE_KEY_PREFIX.length))
            .filter((name) => name.length > 0);
          if (paths.length === 0) {
            return mcpTextResult("(no files)");
          }
          return mcpTextResult(paths.join("\n"));
        } catch (error) {
          return mcpTextResult(
            "list_files failed: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );

    server.tool(
      "propose_pr",
      "Open a GitHub pull request with the supplied file contents against the configured target repository.",
      {
        title: z.string(),
        body: z.string(),
        branch: z.string(),
        files: z.record(z.string())
      },
      async (args) => {
        const token = this.env.OPEN_THINK_GITHUB_TOKEN;
        const owner = this.env.OPEN_THINK_PR_TARGET_OWNER;
        const repo = this.env.OPEN_THINK_PR_TARGET_REPO;
        const baseBranch = this.env.OPEN_THINK_PR_BASE_BRANCH ?? "main";
        if (!token || !owner || !repo) {
          return mcpTextResult(
            "propose_pr requires OPEN_THINK_GITHUB_TOKEN, OPEN_THINK_PR_TARGET_OWNER, and OPEN_THINK_PR_TARGET_REPO to be set.",
            true
          );
        }
        try {
          const proposePr = createProposePr({
            ...(this.env.SANDBOX ? { sandbox: this.env.SANDBOX } : {})
          });
          const result = await proposePr({
            target: { owner, repo, baseBranch },
            headBranch: args.branch,
            title: args.title,
            body: args.body,
            files: args.files,
            githubToken: token,
            author: {
              name: this.env.OPEN_THINK_PR_AUTHOR_NAME ?? "OpenThink Agent",
              email: this.env.OPEN_THINK_PR_AUTHOR_EMAIL ?? "agent@openthink.local"
            }
          });
          if (!result.ok) {
            return mcpTextResult(
              "propose_pr failed on branch " + result.headBranch + ": " + (result.error ?? "unknown error"),
              true
            );
          }
          const summary = "PR #" + result.prNumber + " opened at " + result.prUrl + " (branch " + result.headBranch + ").";
          return mcpTextResult(summary);
        } catch (error) {
          return mcpTextResult(
            "propose_pr threw: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );

    server.tool(
      "run_in_sandbox",
      "Execute code in the Sandbox-GA isolate (when bound) and return stdout + exitCode.",
      { code: z.string(), timeoutMs: z.number().optional() },
      async (args) => {
        const sandbox = this.env.SANDBOX;
        if (!sandbox) {
          return mcpTextResult(
            "SANDBOX binding is not configured for this agent.",
            true
          );
        }
        try {
          const result = await sandbox.run({
            code: args.code,
            bindings: {},
            ...(typeof args.timeoutMs === "number" ? { timeoutMs: args.timeoutMs } : {})
          });
          return mcpTextResult(
            "exitCode=" + result.exitCode + "\nstdout:\n" + result.stdout
          );
        } catch (error) {
          return mcpTextResult(
            "run_in_sandbox failed: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );
  }
}

/**
 * Child agent: scoped researcher. Registers tools that gather and
 * distill external information via Workers AI / fetch.
 */
export class AgentResearcher extends McpAgent<RuntimeEnv> {
  server = new McpServer({ name: "agent-researcher", version: "0.1.0" });

  async init(): Promise<void> {
    const server = this.server;

    server.tool(
      "web_search",
      "Search the web for the supplied query. Falls back to a Workers-AI prompt when no dedicated search provider is bound.",
      {
        query: z.string(),
        limit: z.number().int().min(1).max(20).default(5)
      },
      async (args) => {
        const ai = this.env.AI as
          | { run(model: string, input: unknown): Promise<unknown> }
          | undefined;
        if (!ai) {
          return mcpTextResult(
            "Web search requires AI_GATEWAY or BROWSER binding.",
            true
          );
        }
        try {
          const systemPrompt =
            "You are a web search assistant. Return up to " +
            args.limit +
            " plain-text results for the user's query, each on its own line in the form: '<title> — <url> — <one-sentence summary>'. Do not hallucinate URLs; if you cannot answer with confidence, say so.";
          const response = (await ai.run(
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            {
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: args.query }
              ]
            }
          )) as { response?: string } | string;
          const text =
            typeof response === "string"
              ? response
              : typeof response?.response === "string"
                ? response.response
                : JSON.stringify(response);
          return mcpTextResult(text);
        } catch (error) {
          return mcpTextResult(
            "web_search failed: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );

    server.tool(
      "fetch_url",
      "Fetch an http(s) URL and return the response body (trimmed to 32 KB) with its content-type.",
      { url: z.string().url() },
      async (args) => {
        let parsed: URL;
        try {
          parsed = new URL(args.url);
        } catch {
          return mcpTextResult("fetch_url: invalid URL.", true);
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return mcpTextResult(
            "fetch_url: only http(s) URLs are supported (got " + parsed.protocol + ").",
            true
          );
        }
        try {
          const response = await fetch(parsed.toString(), {
            headers: { "User-Agent": "openthink2-agent-researcher" }
          });
          const contentType = response.headers.get("content-type") ?? "(unknown)";
          const body = await response.text();
          const limit = 32 * 1024;
          const trimmed = body.length > limit ? body.slice(0, limit) + "…(truncated)" : body;
          return mcpTextResult(
            "status=" + response.status + " content-type=" + contentType + "\n\n" + trimmed
          );
        } catch (error) {
          return mcpTextResult(
            "fetch_url failed: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );

    server.tool(
      "summarize",
      "Summarize the supplied text using Workers AI. Caps the response at the requested max word count.",
      {
        text: z.string(),
        maxWords: z.number().int().min(20).max(2000).default(200)
      },
      async (args) => {
        const ai = this.env.AI as
          | { run(model: string, input: unknown): Promise<unknown> }
          | undefined;
        if (!ai) {
          return mcpTextResult("summarize requires the AI binding.", true);
        }
        try {
          const systemPrompt =
            "Summarize the user's text in at most " +
            args.maxWords +
            " words. Keep technical names, numbers, and dates verbatim. Plain prose; no bullet list unless the source clearly is one.";
          const response = (await ai.run(
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            {
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: args.text }
              ]
            }
          )) as { response?: string } | string;
          const text =
            typeof response === "string"
              ? response
              : typeof response?.response === "string"
                ? response.response
                : JSON.stringify(response);
          return mcpTextResult(text);
        } catch (error) {
          return mcpTextResult(
            "summarize failed: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );
  }
}

/**
 * Child agent: scoped browser. Wraps Cloudflare's Browser Rendering
 * binding when configured; otherwise tools degrade with a clear error.
 */
export class AgentBrowser extends McpAgent<RuntimeEnv> {
  server = new McpServer({ name: "agent-browser", version: "0.1.0" });

  async init(): Promise<void> {
    const server = this.server;

    server.tool(
      "navigate",
      "Fetch the supplied URL via the Browser Rendering binding and return the rendered HTML.",
      { url: z.string().url() },
      async (args) => {
        const browser = this.env.BROWSER;
        if (!browser) {
          return mcpTextResult(
            "navigate requires the BROWSER binding (Cloudflare Browser Rendering).",
            true
          );
        }
        try {
          const response = await browser.fetch(args.url);
          const html = await response.text();
          const limit = 64 * 1024;
          const trimmed = html.length > limit ? html.slice(0, limit) + "…(truncated)" : html;
          return mcpTextResult("status=" + response.status + "\n\n" + trimmed);
        } catch (error) {
          return mcpTextResult(
            "navigate failed: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );

    server.tool(
      "screenshot",
      "Capture a screenshot of the supplied URL via the Browser Rendering /screenshot endpoint and return it as base64.",
      { url: z.string().url() },
      async (args) => {
        const browser = this.env.BROWSER;
        if (!browser) {
          return mcpTextResult(
            "screenshot requires the BROWSER binding (Cloudflare Browser Rendering).",
            true
          );
        }
        try {
          const endpoint = "https://browser-rendering.local/screenshot?url=" + encodeURIComponent(args.url);
          const response = await browser.fetch(endpoint);
          if (!response.ok) {
            return mcpTextResult(
              "screenshot failed with status " + response.status,
              true
            );
          }
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (const byte of bytes) {
            binary += String.fromCharCode(byte);
          }
          const base64 = btoa(binary);
          return mcpTextResult(
            "image/png base64 length=" + base64.length + "\n" + base64
          );
        } catch (error) {
          return mcpTextResult(
            "screenshot failed: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );

    server.tool(
      "extract_text",
      "Strip HTML tags from the supplied markup and return the visible text.",
      { html: z.string() },
      async (args) => {
        try {
          const withoutScripts = args.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
          const withoutStyles = withoutScripts.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
          const stripped = withoutStyles.replace(/<[^>]+>/g, " ");
          const decoded = stripped
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
          const collapsed = decoded.replace(/\s+/g, " ").trim();
          return mcpTextResult(collapsed);
        } catch (error) {
          return mcpTextResult(
            "extract_text failed: " + (error instanceof Error ? error.message : String(error)),
            true
          );
        }
      }
    );
  }
}

export default {
  async fetch(request: Request, env: Record<string, unknown>) {
    const routed = await routeAgentRequest(request, env, { cors: true });
    if (routed) return routed;

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json(hostedAgentHealth(env as RuntimeEnv));
    }

    if (url.pathname === "/manifest") {
      return Response.json(hostedAgentManifest(env as RuntimeEnv));
    }

    if (url.pathname === "/cloud-agent/profile") {
      return Response.json(cloudAgentInstanceState(env as RuntimeEnv));
    }

    if (url.pathname === "/personal-agent/setup") {
      return Response.json({
        status: "ready",
        cloudAgentInstance: cloudAgentInstanceState(env as RuntimeEnv),
        customization: cloudAgentInstanceState(env as RuntimeEnv).customization
      });
    }

    if (url.pathname === "/runtime/context") {
      return Response.json({
        runtime: "cloudflare-agents-sdk",
        cloudAgentInstance: cloudAgentInstanceState(env as RuntimeEnv),
        sdk: cloudAgentInstanceState(env as RuntimeEnv).sdk,
        subAgents: subAgentCapabilityState(env as RuntimeEnv)
      });
    }

    if (url.pathname === "/goal") {
      return handleGoalRequest(request, env as RuntimeEnv);
    }

    if (url.pathname === "/subagents" && request.method === "GET") {
      return handleSubAgentsList(env as RuntimeEnv);
    }

    if (url.pathname === "/subagents" && request.method === "POST") {
      return handleSubAgentCreate(request, env as RuntimeEnv);
    }

    const subAgentRoute = parseSubAgentRoute(url.pathname);
    if (subAgentRoute) {
      return handleSubAgentRoute(request, env as RuntimeEnv, subAgentRoute);
    }

    if (
      env.ASSETS &&
      (url.pathname === "/" ||
        url.pathname === "/index.html" ||
        url.pathname.startsWith("/assets/") ||
        url.pathname.endsWith(".js") ||
        url.pathname.endsWith(".css"))
    ) {
      return (env.ASSETS as AssetBinding).fetch(request);
    }

    if (url.pathname === "/") {
      return Response.json(hostedAgentManifest(env as RuntimeEnv));
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
};

function hostedAgentHealth(env: RuntimeEnv) {
  return {
    ok: true,
    runtime: "cloudflare-agents-sdk",
    agent: "PersonalChatAgent",
    defaultModel: env.OPEN_THINK_DEFAULT_MODEL ?? generatedDefaultModel,
    cloudAgentInstance: cloudAgentInstanceState(env),
    sdk: cloudAgentInstanceState(env).sdk,
    slashCommands: {
      goal: goalCommandPayload("", env)
    },
    subAgents: subAgentCapabilityState(env),
    mcp: {
      toolApprovalPolicy: normalizeToolApprovalPolicy(env.OPEN_THINK_TOOL_APPROVAL_POLICY)
    }
  };
}

function hostedAgentManifest(env: RuntimeEnv) {
  return {
    ...hostedAgentHealth(env),
    status: "ready",
    websocket: "/agents/personal-chat-agent/default",
    chatProtocol: "AIChatAgent/useAgentChat",
    chat: {
      transport: "websocket",
      streaming: "resumable-ui-message-stream",
      persistence: "AIChatAgent SQLite",
      clientHooks: ["useAgent", "useAgentChat"]
    },
    endpoints: [
      "/health",
      "/manifest",
      "/cloud-agent/profile",
      "/goal",
      "/subagents",
      "/subagents/{id}",
      "/subagents/{id}/messages",
      "/subagents/{id}/control",
      "/subagents/{id}/summary",
      "/personal-agent/setup",
      "/runtime/context"
    ]
  };
}

async function handleSubAgentsList(env: RuntimeEnv): Promise<Response> {
  if (!env.DB) {
    return Response.json({
      available: false,
      subAgents: [],
      error: "D1 DB binding is not configured."
    });
  }
  return Response.json({
    available: true,
    subAgents: await listSubAgents(env)
  });
}

async function handleSubAgentCreate(request: Request, env: RuntimeEnv): Promise<Response> {
  const result = await createSubAgent(env, await request.json().catch(() => ({})));
  return Response.json(result, { status: result.ok === false ? 400 : 201 });
}

function parseSubAgentRoute(pathname: string): { id: string; action: string } | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "subagents" || !parts[1] || parts.length > 3) return null;
  return {
    id: decodeURIComponent(parts[1]),
    action: parts[2] ?? "detail"
  };
}

async function handleSubAgentRoute(
  request: Request,
  env: RuntimeEnv,
  route: { id: string; action: string }
): Promise<Response> {
  if (route.action === "detail" && request.method === "GET") {
    const subAgent = await getSubAgent(env, route.id);
    if (!subAgent) return Response.json({ error: "Sub-agent not found." }, { status: 404 });
    return Response.json({ subAgent });
  }

  if (route.action === "messages" && request.method === "GET") {
    const subAgent = await getSubAgent(env, route.id);
    if (!subAgent) return Response.json({ error: "Sub-agent not found." }, { status: 404 });
    return Response.json({ subAgent, messages: await listSubAgentMessages(env, route.id) });
  }

  if (route.action === "messages" && request.method === "POST") {
    const payload = await request.json().catch(() => ({}));
    const result = await sendSubAgentMessage(env, route.id, String(payload.message ?? payload.text ?? ""));
    return Response.json(result, { status: result.ok === false ? 400 : 200 });
  }

  if (route.action === "control" && request.method === "POST") {
    const payload = await request.json().catch(() => ({}));
    const status = normalizeSubAgentStatus(payload.status ?? payload.action, "ready");
    const result = await updateSubAgentStatus(env, route.id, status);
    return Response.json(result, { status: result.ok === false ? 400 : 200 });
  }

  if (route.action === "summary" && request.method === "POST") {
    const result = await refreshSubAgentSummary(env, route.id);
    return Response.json(result, { status: result.ok === false ? 400 : 200 });
  }

  return Response.json({ error: "Unsupported sub-agent route." }, { status: 404 });
}

async function ensureSubAgentTables(env: RuntimeEnv): Promise<boolean> {
  if (!env.DB) return false;
  await env.DB.prepare(
    "create table if not exists sub_agents (id text primary key, name text not null, purpose text not null, status text not null, mode text not null, model text not null, brain text not null, system_prompt text not null, skills_json text not null, summary text not null, created_at text not null, updated_at text not null)"
  ).run();
  await env.DB.prepare(
    "create table if not exists sub_agent_messages (id text primary key, sub_agent_id text not null, role text not null, content text not null, created_at text not null)"
  ).run();
  return true;
}

async function createSubAgent(env: RuntimeEnv, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!(await ensureSubAgentTables(env))) {
    return { ok: false, error: "D1 DB binding is not configured." };
  }

  const now = new Date().toISOString();
  const id = "subagent-" + crypto.randomUUID();
  const name = normalizeShortText(input.name, "Research Agent");
  const purpose = normalizeLongText(input.purpose, "Help the main personal agent investigate and advance a delegated objective.");
  const brain = normalizeShortText(input.brain, "gbrain + gskills");
  const mode = normalizeSubAgentMode(input.mode);
  const skills = normalizeStringArray(input.skills);
  const model = normalizeShortText(input.model, String(env.OPEN_THINK_DEFAULT_MODEL ?? generatedDefaultModel));
  const systemPrompt = normalizeLongText(
    input.systemPrompt,
    defaultSubAgentSystemPrompt(name, purpose, brain, skills, mode)
  );
  const summary = "Ready. " + purpose;

  await env.DB!.prepare(
    "insert into sub_agents (id, name, purpose, status, mode, model, brain, system_prompt, skills_json, summary, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, name, purpose, "ready", mode, model, brain, systemPrompt, JSON.stringify(skills), summary, now, now)
    .run();

  const subAgent = await getSubAgent(env, id);
  return { ok: true, subAgent };
}

async function listSubAgents(env: RuntimeEnv): Promise<SubAgent[]> {
  if (!(await ensureSubAgentTables(env))) return [];
  const rows = await env.DB!.prepare(
    "select a.*, (select count(*) from sub_agent_messages m where m.sub_agent_id = a.id) as message_count from sub_agents a order by datetime(a.updated_at) desc limit 100"
  ).all<Record<string, unknown>>();
  return (rows.results ?? []).map(rowToSubAgent);
}

async function getSubAgent(env: RuntimeEnv, id: string): Promise<SubAgent | null> {
  if (!(await ensureSubAgentTables(env))) return null;
  const row = await env.DB!.prepare(
    "select a.*, (select count(*) from sub_agent_messages m where m.sub_agent_id = a.id) as message_count from sub_agents a where a.id = ? limit 1"
  ).bind(id).first<Record<string, unknown>>();
  return row ? rowToSubAgent(row) : null;
}

async function listSubAgentMessages(env: RuntimeEnv, id: string): Promise<SubAgentMessage[]> {
  if (!(await ensureSubAgentTables(env))) return [];
  const rows = await env.DB!.prepare(
    "select id, sub_agent_id, role, content, created_at from sub_agent_messages where sub_agent_id = ? order by datetime(created_at) asc limit 80"
  ).bind(id).all<Record<string, unknown>>();
  return (rows.results ?? []).map(rowToSubAgentMessage);
}

async function updateSubAgentStatus(
  env: RuntimeEnv,
  id: string,
  status: SubAgentStatus
): Promise<Record<string, unknown>> {
  const subAgent = await getSubAgent(env, id);
  if (!subAgent) return { ok: false, error: "Sub-agent not found." };
  const now = new Date().toISOString();
  await env.DB!.prepare("update sub_agents set status = ?, updated_at = ? where id = ?")
    .bind(status, now, id)
    .run();
  return { ok: true, subAgent: await getSubAgent(env, id) };
}

async function sendSubAgentMessage(
  env: RuntimeEnv,
  id: string,
  rawMessage: string
): Promise<Record<string, unknown>> {
  const subAgent = await getSubAgent(env, id);
  if (!subAgent) return { ok: false, error: "Sub-agent not found." };
  if (subAgent.status === "archived") return { ok: false, error: "Archived sub-agents cannot receive new messages." };
  if (subAgent.status === "paused") return { ok: false, error: "Paused sub-agents must be resumed before receiving messages." };

  const message = rawMessage.trim();
  if (!message) return { ok: false, error: "Message is required." };

  await setSubAgentStatusOnly(env, id, "working");
  const now = new Date().toISOString();
  await env.DB!.prepare(
    "insert into sub_agent_messages (id, sub_agent_id, role, content, created_at) values (?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), id, "user", message, now).run();

  const history = await listSubAgentMessages(env, id);
  const reply = await runSubAgentModel(env, subAgent, history);
  const repliedAt = new Date().toISOString();
  await env.DB!.prepare(
    "insert into sub_agent_messages (id, sub_agent_id, role, content, created_at) values (?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), id, "assistant", reply, repliedAt).run();
  await env.DB!.prepare(
    "update sub_agents set status = ?, summary = ?, updated_at = ? where id = ?"
  ).bind("ready", deriveSubAgentSummary(subAgent, message, reply), repliedAt, id).run();

  return {
    ok: true,
    subAgent: await getSubAgent(env, id),
    message: reply,
    messages: await listSubAgentMessages(env, id)
  };
}

async function refreshSubAgentSummary(env: RuntimeEnv, id: string): Promise<Record<string, unknown>> {
  const subAgent = await getSubAgent(env, id);
  if (!subAgent) return { ok: false, error: "Sub-agent not found." };
  const messages = await listSubAgentMessages(env, id);
  const summary = await summarizeSubAgentMessages(env, subAgent, messages);
  const now = new Date().toISOString();
  await env.DB!.prepare("update sub_agents set summary = ?, updated_at = ? where id = ?")
    .bind(summary, now, id)
    .run();
  return { ok: true, summary, subAgent: await getSubAgent(env, id) };
}

async function setSubAgentStatusOnly(env: RuntimeEnv, id: string, status: SubAgentStatus): Promise<void> {
  await env.DB!.prepare("update sub_agents set status = ?, updated_at = ? where id = ?")
    .bind(status, new Date().toISOString(), id)
    .run();
}

async function runSubAgentModel(
  env: RuntimeEnv,
  subAgent: SubAgent,
  history: SubAgentMessage[]
): Promise<string> {
  if (!env.AI) {
    return "I am configured as " + subAgent.name + ", but the Workers AI binding is not available for sub-agent responses.";
  }

  const workersai = createWorkersAI({ binding: env.AI as never });
  const transcript = history
    .slice(-12)
    .map((message) => message.role.toUpperCase() + ": " + message.content)
    .join("\n\n");
  const result = await generateText({
    model: workersai(resolveSubAgentWorkersAiModel(env, subAgent.model)),
    system: subAgentSystemInstruction(subAgent, env),
    prompt: [
      "Conversation so far:",
      transcript || "No prior messages.",
      "",
      "Respond as the sub-agent. Be concise, concrete, and include next action if useful."
    ].join("\n")
  });
  return result.text.trim() || "No response generated.";
}

async function summarizeSubAgentMessages(
  env: RuntimeEnv,
  subAgent: SubAgent,
  messages: SubAgentMessage[]
): Promise<string> {
  if (!env.AI || messages.length === 0) return deriveSubAgentSummary(subAgent);
  const workersai = createWorkersAI({ binding: env.AI as never });
  const transcript = messages
    .slice(-20)
    .map((message) => message.role.toUpperCase() + ": " + message.content)
    .join("\n\n");
  const result = await generateText({
    model: workersai(resolveSubAgentWorkersAiModel(env, subAgent.model)),
    system: "Summarize this sub-agent state for an operator dashboard in two compact sentences.",
    prompt: transcript
  });
  return result.text.trim() || deriveSubAgentSummary(subAgent);
}

function resolveSubAgentWorkersAiModel(env: RuntimeEnv, requestedModel?: string): string {
  const requested = String(requestedModel ?? "").trim();
  if (requested.startsWith("@cf/")) return requested;

  const configured = String(env.OPEN_THINK_DEFAULT_MODEL ?? generatedDefaultModel).trim();
  if (configured.startsWith("@cf/")) return configured;

  return generatedDefaultModel.startsWith("@cf/") ? generatedDefaultModel : workersAiFallbackModel;
}

function subAgentSystemInstruction(subAgent: SubAgent, env: RuntimeEnv): string {
  return [
    subAgent.systemPrompt,
    "You are a child Cloud Agent Instance coordinated by the main OpenThink personal agent.",
    "Brain: " + subAgent.brain + ". Mode: " + subAgent.mode + ". Skills: " + (subAgent.skills.join(", ") || "none") + ".",
    "Use Agents SDK semantics for chat/state. Use executor-oriented reasoning only when the main runtime exposes OPEN_THINK_EXECUTOR_MCP_URL.",
    sanitizeHttpsUrl(env.OPEN_THINK_EXECUTOR_MCP_URL)
      ? "Executor MCP is configured for execution-heavy work."
      : "Executor MCP is not configured; plan execution but do not claim external executor access."
  ].join("\n");
}

function defaultSubAgentSystemPrompt(
  name: string,
  purpose: string,
  brain: string,
  skills: string[],
  mode: SubAgentMode
): string {
  return [
    "You are " + name + ", a scoped Cloud Agent Instance sub-agent.",
    "Purpose: " + purpose,
    "Use the " + brain + " brain profile with " + (skills.join(", ") || "general reasoning") + ".",
    "Mode: " + mode + ". Keep work bounded, report blockers, and hand concise summaries back to the main personal agent."
  ].join("\n");
}

function deriveSubAgentSummary(subAgent: SubAgent, lastUser?: string, lastReply?: string): string {
  if (lastUser && lastReply) {
    return "Last task: " + compactText(lastUser, 90) + " Response: " + compactText(lastReply, 140);
  }
  return subAgent.summary || "Ready. " + subAgent.purpose;
}

function rowToSubAgent(row: Record<string, unknown>): SubAgent {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Sub-agent"),
    purpose: String(row.purpose ?? ""),
    status: normalizeSubAgentStatus(row.status, "ready"),
    mode: normalizeSubAgentMode(row.mode),
    model: String(row.model ?? generatedDefaultModel),
    brain: String(row.brain ?? "gbrain + gskills"),
    systemPrompt: String(row.system_prompt ?? ""),
    skills: parseJsonArray(row.skills_json),
    summary: String(row.summary ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    messageCount: Number(row.message_count ?? 0)
  };
}

function rowToSubAgentMessage(row: Record<string, unknown>): SubAgentMessage {
  const role = String(row.role ?? "assistant");
  return {
    id: String(row.id ?? ""),
    subAgentId: String(row.sub_agent_id ?? ""),
    role: role === "user" || role === "system" ? role : "assistant",
    content: String(row.content ?? ""),
    createdAt: String(row.created_at ?? "")
  };
}

async function handleGoalRequest(request: Request, env?: RuntimeEnv): Promise<Response> {
  if (request.method === "GET") {
    return Response.json(goalCommandPayload("", env));
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const payload = await request.json().catch(() => ({}));
  const goal = String(
    (payload as { goal?: unknown; text?: unknown; message?: unknown }).goal ??
      (payload as { goal?: unknown; text?: unknown; message?: unknown }).text ??
      (payload as { goal?: unknown; text?: unknown; message?: unknown }).message ??
      ""
  ).trim();
  return Response.json(goalCommandPayload(goal, env));
}

function goalCommandPayload(goal = "", env?: RuntimeEnv) {
  const trimmedGoal = goal.trim();
  return {
    enabled: true,
    command: "/goal",
    endpoint: "/goal",
    cloudAgentInstance: env ? cloudAgentInstanceState(env) : generatedCloudAgentInstance,
    usage: ["/goal Ship the deployment updater", "/goal"],
    behavior:
      "Turns a requested objective into an active goal brief with success criteria, milestones, next actions, risks, and a resume prompt.",
    prompt: goalCommandPrompt(trimmedGoal)
  };
}

function goalCommandPrompt(goal: string): string {
  if (!goal) {
    return [
      "Goal command received with no goal text.",
      "Review active goals from this conversation and any available memory.",
      "If no active goal is clear, ask the owner for the objective in one concise question."
    ].join("\n");
  }

  return [
    "Goal command received.",
    "",
    "Active goal: " + goal,
    "",
    "Create a concise goal brief with objective, success criteria, constraints, milestones, next actions, risks, and a resume prompt.",
    "Use available memory, task, file, or MCP tools when helpful to persist or advance the goal. If those tools are unavailable, keep the goal in conversation state and say what would be persisted when available."
  ].join("\n");
}

function goalCommandInstruction(): string {
  return [
    "Slash command /goal is enabled.",
    "When the owner's message begins with /goal, treat the remaining text as an active goal setup or update.",
    "If the command includes a goal, respond with a compact goal brief: objective, success criteria, constraints, milestones, next actions, risks, and a resume prompt.",
    "If the command has no goal text, review active goals from conversation and memory when available, then ask for the missing objective only if needed.",
    "Call setActiveGoal after drafting or updating a goal so the brief is persisted when D1 is bound.",
    "Use available memory, task, file, or MCP tools when helpful to persist or advance the goal; otherwise keep the goal anchored in the chat state."
  ].join("\n");
}

function cloudAgentInstanceState(env: RuntimeEnv): Record<string, unknown> {
  const executorUrl = sanitizeHttpsUrl(env.OPEN_THINK_EXECUTOR_MCP_URL);
  const sandboxConfigured =
    Boolean(env.Sandbox) || runtimeFlagEnabled(env.OPEN_THINK_SANDBOX_STATUS);
  const containersConfigured =
    Boolean(env.Sandbox) || runtimeFlagEnabled(env.OPEN_THINK_CONTAINER_STATUS);
  const base = generatedCloudAgentInstance as Record<string, unknown>;
  const skills = Array.isArray(base.skills) ? (base.skills as Array<Record<string, unknown>>) : [];
  const execution = base.execution as Record<string, Record<string, unknown>>;
  return {
    ...base,
    skills: skills.map((skill) =>
      skill.id === "executor-mcp"
        ? {
            ...skill,
            enabled: true,
            configured: Boolean(executorUrl),
            status: executorUrl ? "configured" : "default-pending"
          }
        : skill
    ),
    execution: {
      ...execution,
      executor: {
        ...execution.executor,
        enabled: true,
        configured: Boolean(executorUrl),
        status: executorUrl ? "configured" : "default-pending",
        mcpServerUrl: executorUrl ? "configured" : null,
        authTokenConfigured: Boolean(env.OPEN_THINK_EXECUTOR_AUTH_TOKEN),
        pointsTo:
          "OPEN_THINK_EXECUTOR_MCP_URL. In the OpenThink default architecture this should be a same-account Sandbox/Containers MCP bridge; it may also point to a self-hosted Executor deployment."
      },
      sandbox: {
        ...execution.sandbox,
        enabled: true,
        configured: sandboxConfigured,
        status: sandboxConfigured ? "configured" : "default-pending"
      },
      containers: {
        ...execution.containers,
        enabled: true,
        configured: containersConfigured,
        status: containersConfigured ? "configured" : "default-pending"
      }
    }
  };
}

function cloudAgentInstanceInstruction(env: RuntimeEnv): string {
  return [
    generatedCloudAgentGoalInstruction,
    "Runtime cloud agent instance state:",
    JSON.stringify(cloudAgentInstanceState(env), null, 2)
  ].join("\n\n");
}

function subAgentCapabilityState(env: RuntimeEnv) {
  return {
    enabled: true,
    persistence: env.DB ? "D1 sub_agents and sub_agent_messages" : "unavailable until DB binding is configured",
    endpoints: ["/subagents", "/subagents/{id}", "/subagents/{id}/messages", "/subagents/{id}/control", "/subagents/{id}/summary"],
    controls: ["create", "pause", "resume", "archive", "summarize", "message", "brief-main-chat"],
    modes: ["agents-sdk", "executor", "hybrid"],
    templates: ["research-scout", "builder", "reviewer", "cloud-operator"]
  };
}

function runtimeFlagEnabled(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "enabled" || normalized === "configured" || normalized === "ready";
}

function formatActiveGoalMemory(input: {
  goal: string;
  successCriteria?: string[];
  milestones?: string[];
  nextActions?: string[];
  notes?: string | undefined;
}): string {
  const lines = [
    "Active goal: " + input.goal.trim(),
    listSection("Success criteria", input.successCriteria),
    listSection("Milestones", input.milestones),
    listSection("Next actions", input.nextActions),
    input.notes?.trim() ? "Notes: " + input.notes.trim() : ""
  ].filter(Boolean);
  return lines.join("\n");
}

function listSection(label: string, values?: string[]): string {
  const items = (values ?? []).map((value) => value.trim()).filter(Boolean);
  if (items.length === 0) return "";
  return label + ": " + items.join("; ");
}

function normalizeShortText(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return compactText(text || fallback, 96);
}

function normalizeLongText(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return compactText(text || fallback, 2000);
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeShortText(item, "")).filter(Boolean).slice(0, 12);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => normalizeShortText(item, "")).filter(Boolean).slice(0, 12);
  }
  return [];
}

function normalizeSubAgentMode(value: unknown): SubAgentMode {
  const mode = String(value ?? "").trim().toLowerCase();
  if (mode === "agents-sdk" || mode === "executor" || mode === "hybrid") return mode;
  return "hybrid";
}

function normalizeSubAgentStatus(value: unknown, fallback: SubAgentStatus): SubAgentStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "pause") return "paused";
  if (status === "resume") return "ready";
  if (status === "start") return "working";
  if (status === "archive") return "archived";
  if (status === "ready" || status === "working" || status === "paused" || status === "archived") return status;
  return fallback;
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeStringArray(value);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    return normalizeStringArray(JSON.parse(value));
  } catch {
    return normalizeStringArray(value);
  }
}

function compactText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - 3)).trimEnd() + "...";
}

function sanitizeMcpName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function sanitizeHttpsUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeHeaders(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const headers: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (!/^[a-z0-9-]+$/i.test(key)) continue;
    if (typeof rawValue !== "string") continue;
    headers[key] = rawValue;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function normalizeToolApprovalPolicy(value: unknown): ToolApprovalPolicy {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (normalized === "ask-every-time" || normalized === "ask-everytime") return "ask-every-time";
  if (normalized === "allow-all" || normalized === "allowall") return "allow-all";
  return "auto";
}

function shouldAutoRequireToolApproval(name: string, definition: ToolSet[string]): boolean {
  const description =
    typeof (definition as { description?: unknown }).description === "string"
      ? String((definition as { description?: unknown }).description)
      : "";
  const normalizedName = name
    .replace(/^tool_[a-z0-9]+_/i, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  const descriptionText = description.toLowerCase();
  const safeReadPattern =
    /\b(get|list|read|search|find|lookup|describe|inspect|query|fetch|check|status|audit|analyze|summarize)\b/;
  const riskyActionPattern =
    /\b(create|update|delete|remove|purge|deploy|upload|write|apply|patch|edit|set|enable|disable|restart|rotate|revoke|invalidate|execute|run|mutate|provision|install|uninstall|bind|unbind|billing|payment|secret|token|permission|policy)\b/;
  const riskyPattern =
    /\b(create|update|delete|remove|purge|deploy|upload|write|apply|patch|edit|set|enable|disable|restart|rotate|revoke|invalidate|execute|run|mutate|provision|install|uninstall|bind|unbind|billing|payment|secret|token|permission|policy|access|dns|route|worker|r2|d1|queue|vectorize)\b/;

  if (safeReadPattern.test(normalizedName) && !riskyActionPattern.test(normalizedName)) return false;
  if (riskyPattern.test(normalizedName + " " + descriptionText)) return true;
  return !safeReadPattern.test(descriptionText);
}

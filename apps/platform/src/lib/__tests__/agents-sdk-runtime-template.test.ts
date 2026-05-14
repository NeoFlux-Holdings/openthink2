import { describe, expect, it } from "vitest";
import ts from "typescript";
import { renderAgentsSdkPersonalAgentRuntime } from "../agents-sdk-runtime-template";
import { buildDeploymentRequest } from "../deployment-engine";

describe("renderAgentsSdkPersonalAgentRuntime", () => {
  it("renders a package-style Cloudflare Agents SDK runtime", () => {
    const files = renderAgentsSdkPersonalAgentRuntime({
      deploymentId: "agent-test123",
      request: buildDeploymentRequest("self", {
        userId: "user-1",
        agentName: "Ada",
        cloudflareAccountId: "acct",
        cfApiToken: "token",
        acceptedTerms: true,
        personalAgent: {
          enabled: true,
          presetId: "custom",
          toolApprovalPolicy: "ask-every-time",
          customName: "Ada Brain",
          soulPrompt: "Prefer short answers.",
          launchBrief: "Start with the inbox triage."
        }
      }),
      bindings: {
        scriptName: "open-think-ada",
        databaseName: "open-think-ada-db",
        databaseId: "d1-id",
        bucketName: "open-think-ada-artifacts",
        queueName: "open-think-ada-tasks",
        vectorizeName: "open-think-ada-memory"
      }
    });

    expect(files.map((file) => file.path)).toEqual([
      "package.json",
      "tsconfig.json",
      "wrangler.jsonc",
      "index.html",
      "src/client-env.d.ts",
      "src/client.css",
      "src/client.tsx",
      "src/orchestrator-runtime.ts",
      "src/server.ts"
    ]);

    const packageJson = JSON.parse(files.find((file) => file.path === "package.json")?.contents ?? "{}");
    expect(packageJson.dependencies).toMatchObject({
      "@ai-sdk/react": "^3.0.0",
      "@cloudflare/ai-chat": "^0.6.2",
      "@cloudflare/think": "^0.4.2",
      "@modelcontextprotocol/sdk": "^1.20.0",
      agents: "^0.12.4",
      ai: "^6.0.174",
      react: "^19.2.5",
      "react-dom": "^19.2.5",
      streamdown: "^2.5.0",
      zod: "^4.4.2",
      "workers-ai-provider": "^3.1.13"
    });

    const wrangler = JSON.parse(files.find((file) => file.path === "wrangler.jsonc")?.contents ?? "{}");
    expect(wrangler.main).toBe("src/server.ts");
    expect(wrangler.assets).toMatchObject({
      directory: "dist/client",
      binding: "ASSETS"
    });
    expect(JSON.parse(wrangler.vars.OPEN_THINK_PERSONAL_AGENT_CONFIG)).toMatchObject({
      label: "Ada Brain",
      soulPromptConfigured: true,
      launchBriefConfigured: true,
      toolApprovalPolicy: "ask-every-time"
    });
    expect(wrangler.vars.OPEN_THINK_TOOL_APPROVAL_POLICY).toBe("ask-every-time");
    expect(wrangler.vars.OPEN_THINK_PERSONAL_AGENT_CONFIG).not.toContain("Prefer short answers.");
    expect(wrangler.vars.OPEN_THINK_PERSONAL_AGENT_CONFIG).not.toContain("inbox triage");
    expect(wrangler.durable_objects.bindings).toEqual([
      { name: "PersonalChatAgent", class_name: "PersonalChatAgent" },
      { name: "ORCHESTRATOR", class_name: "OrchestratorAgent" },
      { name: "AGENT_CODER", class_name: "AgentCoder" },
      { name: "AGENT_RESEARCHER", class_name: "AgentResearcher" },
      { name: "AGENT_BROWSER", class_name: "AgentBrowser" },
      { name: "VOICE", class_name: "VoiceAgent" }
    ]);
    expect(wrangler.migrations[0].new_sqlite_classes).toEqual([
      "PersonalChatAgent",
      "OrchestratorAgent",
      "AgentCoder",
      "AgentResearcher",
      "AgentBrowser",
      "VoiceAgent"
    ]);
    expect(wrangler.kv_namespaces).toEqual([
      { binding: "WORKSPACE_FILES", id: "replace-me" }
    ]);
    expect(wrangler["//browser"]).toContain("Browser Rendering");

    const client = files.find((file) => file.path === "src/client.tsx")?.contents ?? "";
    expect(client).toContain('import { useAgent } from "agents/react"');
    expect(client).toContain("getToolApproval");
    expect(client).toContain("getAgentMessages");
    expect(client).toContain('await import("streamdown")');
    expect(client).toContain("<Streamdown controls={false}>");
    expect(client).toContain("<MarkdownRenderer>{part.text}</MarkdownRenderer>");
    expect(client).toContain('useAgentChat({');
    expect(client).toContain("autoContinueAfterToolResult: false");
    expect(client).toContain("resume: false");
    expect(client).not.toContain("sendAutomaticallyWhen");
    expect(client).not.toContain("approvalContinuationSignature");
    expect(client).toContain("pendingManualContinuationRef");
    expect(client).toContain("toolContinuationCandidate");
    expect(client).toContain("pendingToolContinuationMarkerMatches");
    expect(client).toContain("latestRenderableAssistantTurn");
    expect(client).toContain("hasUnsettledToolInput");
    expect(client).toContain('if (!connected) return;');
    expect(client).toContain("mcpServerSnapshotsEqual");
    expect(client).toContain("addToolApprovalResponse({ id: approvalId, approved })");
    expect(client).toContain("indexActivePendingApprovals");
    expect(client).toContain("activeApprovalIds");
    expect(client).toContain("expired-approval");
    expect(client).toContain("isNearScrollBottom");
    expect(client).toContain("stickToBottomRef");
    expect(client).toContain("onScroll={onMessageListScroll}");
    expect(client).toContain("isProtocolRecoveryError");
    expect(client).toContain("sessionApprovalIds");
    expect(client).toContain("compactMessageParts");
    expect(client).toContain("ToolPartGroup");
    expect(client).toContain("messageRenderBlocks");
    expect(client).toContain("summarizeToolGroup");
    expect(client).toContain("summarizeToolPart");
    expect(client).toContain("toolDisplayTitle");
    expect(client).toContain("Search Cloudflare docs");
    expect(client).toContain("Raw details");
    expect(client).toContain('className="tool-group"');
    expect(client).toContain("open={summary.defaultOpen ? true : undefined}");
    expect(client).toContain('summary.state !== "streaming"');
    expect(client).toContain("Details are available when this tool call settles.");
    expect(client).toContain("agentMessagesUrl");
    expect(client).toContain("setMessages(refreshedMessages)");
    expect(client).toContain("latestUserTextMessageAfter");
    expect(client).toContain("No assistant output was received. Retry the last message when ready.");
    expect(client).toContain("sendMessage({ text: retryTarget.text, messageId: retryTarget.id })");
    expect(client).toContain("shouldRenderMessagePart");
    expect(client).toContain("indexPendingApprovalIdsAfter");
    expect(client).toContain("PendingMessage");
    expect(client).toContain("messagesContainUserTextAfter");
    expect(client).toContain("pendingAssistantMessage");
    expect(client).toContain("messagesContainRenderableAssistantAfter");
    expect(client).toContain("partHasVisibleContent");
    expect(client).toContain("messageVisibleSignature");
    expect(client).toContain("No assistant output was received.");
    expect(client).toContain("visibleMessages");
    expect(client).toContain("compactVisibleMessages");
    expect(client).toContain("messageHasRenderableParts");
    expect(client).toContain('displayState !== "expired-approval"');
    expect(client).toContain("function onRetry()");
    expect(client).toContain('if (toolCall.toolName !== "getUserTimezone") return;');
    expect(client).not.toContain("Unhandled browser tool");
    expect(client).toContain("Approve once");
    expect(client).toContain("Always allow tool");
    expect(client).toContain("readAlwaysAllowedTools");
    expect(client).toContain("Tool allowlist");
    expect(client).toContain("Clear tool allowlist");
    expect(client).toContain("Use /goal to set an active objective");
    expect(client).toContain('Metric label="Slash commands" value="/goal enabled"');
    expect(client).toContain("SubAgentConsole");
    expect(client).toContain("Agent Workstreams");
    expect(client).toContain("subAgentTemplates");
    expect(client).toContain("Create sub-agent");
    expect(client).toContain("HostedAgentPanel");
    expect(client).toContain("Copy SDK snippet");
    expect(client).toContain("createHostedCloudAgentClient");
    expect(client).toContain('"/subagents"');
    expect(client).toContain('clearHistory');
    expect(client).toContain('onMcpUpdate');
    expect(client).toContain("Executor MCP");
    expect(client).toContain("formatExecutionPlane");
    expect(client).toContain('agent.reconnect()');
    expect(client).toContain('stop,');
    expect(client).toContain('toolApprovalPolicy');
    expect(client).toContain('agent: "PersonalChatAgent"');
    expect(
      ts.transpileModule(client, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022
        },
        reportDiagnostics: true
      }).diagnostics ?? []
    ).toEqual([]);

    const source = files.find((file) => file.path === "src/server.ts")?.contents ?? "";
    expect(source).toContain('import { AIChatAgent } from "@cloudflare/ai-chat"');
    expect(source).toContain('from "agents"');
    expect(source).toContain('from "zod"');
    expect(source).toContain("this.addMcpServer(");
    expect(source).toContain("this.mcp.getAITools()");
    expect(source).toContain("mcpToolsWithApprovalPolicy()");
    expect(source).toContain("shouldAutoRequireToolApproval");
    expect(source).toContain('replace(/[_-]+/g, " ")');
    expect(source).toContain("safeReadPattern.test(normalizedName)");
    expect(source).toContain('type ToolApprovalPolicy = "auto" | "ask-every-time" | "allow-all"');
    expect(source).toContain("getUserTimezone: tool(");
    expect(source).toContain("confirmCloudflareOperation: tool(");
    expect(source).toContain("needsApproval: async () => true");
    expect(source).toContain("handleGoalRequest");
    expect(source).toContain('url.pathname === "/health"');
    expect(source).toContain('url.pathname === "/manifest"');
    expect(source).toContain('url.pathname === "/cloud-agent/profile"');
    expect(source).toContain("hostedAgentManifest");
    expect(source).toContain("goalCommandInstruction");
    expect(source).toContain("Slash command /goal is enabled.");
    expect(source).toContain('command: "/goal"');
    expect(source).toContain('slashCommands');
    expect(source).toContain("generatedCloudAgentInstance");
    expect(source).toContain('"profileEndpoint":"/cloud-agent/profile"');
    expect(source).toContain("cloudAgentInstanceState");
    expect(source).toContain("OPEN_THINK_EXECUTOR_MCP_URL");
    expect(source).toContain("executorUrl");
    expect(source).toContain("default-pending");
    expect(source).toContain("pointsTo");
    expect(source).toContain('"executor"');
    expect(source).toContain("setActiveGoal: tool(");
    expect(source).toContain("formatActiveGoalMemory");
    expect(source).toContain("createSubAgent: tool(");
    expect(source).toContain("sendSubAgentMessage: tool(");
    expect(source).toContain("handleSubAgentRoute");
    expect(source).toContain("subAgentCapabilityState");
    expect(source).toContain("research-scout");
    expect(source).toContain("sub_agents");
    expect(source).toContain("waitForMcpConnections = { timeout: 10_000 }");
    expect(source).toContain("prepareModelMessages(this.messages)");
    expect(source).toContain("sanitizeMessagesForModel");
    expect(source).toContain("mergeAdjacentUserMessages");
    expect(source).toContain("mergeUserMessages");
    expect(source).toContain("newest actionable request first");
    expect(source).toContain("isRenderableUiChunk");
    expect(source).toContain("writeTextFallback");
    expect(source).toContain("createUIMessageStream<UIMessage>");
    expect(source).toContain("createUIMessageStreamResponse({ stream })");
    expect(source).toContain("stripEmptyTextParts");
    expect(source).toContain("isEmptyTextPart");
    expect(source).toContain("activeApprovalContinuationIndex");
    expect(source).toContain("ignoreIncompleteToolCalls: true");
    expect(source).toContain("suppressToolInputStreamingTransform");
    expect(source).toContain('part.type === "tool-input-start" || part.type === "tool-input-delta"');
    expect(source).not.toContain("pruneMessages");
    expect(source).toContain("experimental_transform: suppressToolInputStreamingTransform()");
    expect(source).toContain("stopWhen: stepCountIs(5)");
    expect(source).toContain("toUIMessageStream<UIMessage>({ sendReasoning: false })");
    expect(source).toContain('transport: "websocket"');
    expect(source).toContain("Personal agent subsystem:");
    expect(source).toContain("/personal-agent/setup");
    expect(source).toContain('import { Agent, routeAgentRequest, type AgentContext } from "agents"');
    expect(source).toContain('import { McpAgent } from "agents/mcp"');
    expect(source).toContain('from "./orchestrator-runtime"');
    expect(source).toContain('initOrchestrator');
    expect(source).toContain('handleSlashCommand');
    expect(source).toContain('export class OrchestratorAgent extends Agent<OrchestratorEnv>');
    expect(source).toContain('export class AgentCoder extends McpAgent<RuntimeEnv>');
    expect(source).toContain('export class AgentResearcher extends McpAgent<RuntimeEnv>');
    expect(source).toContain('export class AgentBrowser extends McpAgent<RuntimeEnv>');
    expect(source).toContain('from "@modelcontextprotocol/sdk/server/mcp.js"');
    expect(source).toContain('new McpServer({ name: "agent-coder"');
    expect(source).toContain('new McpServer({ name: "agent-researcher"');
    expect(source).toContain('new McpServer({ name: "agent-browser"');
    expect(source).toContain('createProposePr');
    expect(source).toContain('server.tool(\n      "read_file"');
    expect(source).toContain('server.tool(\n      "write_file"');
    expect(source).toContain('server.tool(\n      "list_files"');
    expect(source).toContain('server.tool(\n      "propose_pr"');
    expect(source).toContain('server.tool(\n      "run_in_sandbox"');
    expect(source).toContain('server.tool(\n      "web_search"');
    expect(source).toContain('server.tool(\n      "fetch_url"');
    expect(source).toContain('server.tool(\n      "summarize"');
    expect(source).toContain('server.tool(\n      "navigate"');
    expect(source).toContain('server.tool(\n      "screenshot"');
    expect(source).toContain('server.tool(\n      "extract_text"');
    expect(source).toContain('WORKSPACE_FILES KV binding is not configured');
    expect(source).toContain('SANDBOX binding is not configured');
    expect(source).toContain('BROWSER binding (Cloudflare Browser Rendering)');
    expect(source).toContain('Web search requires AI_GATEWAY or BROWSER binding');
    expect(source).toContain('OPEN_THINK_GITHUB_TOKEN');
    expect(source).toContain('OPEN_THINK_PR_TARGET_OWNER');
    expect(source).toContain('OPEN_THINK_PR_TARGET_REPO');
    expect(source).toContain('OPEN_THINK_PR_BASE_BRANCH');
    expect(source).toContain('AGENT_BROWSER');
    expect(source).toContain('child-browser');
    expect(source).toContain('defaultChildDescriptors');
    expect(source).toContain('/learning/pending');
    expect(source).toContain('/learning/decisions');
    expect(source).toContain('/learning/summary');
    expect(source).toContain('/goals');
    expect(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022
        },
        reportDiagnostics: true
      }).diagnostics ?? []
    ).toEqual([]);

    const orchestratorRuntime = files.find((file) => file.path === "src/orchestrator-runtime.ts")?.contents ?? "";
    expect(orchestratorRuntime).toContain("export async function initOrchestrator");
    expect(orchestratorRuntime).toContain("export async function handleSlashCommand");
    expect(orchestratorRuntime).toContain("export async function buildOrchestratorSystemPrompt");
    expect(orchestratorRuntime).toContain("export async function gateToolCall");
    expect(orchestratorRuntime).toContain("export async function recordTraceAndMaybeEvolve");
    expect(orchestratorRuntime).toContain("export interface AgentDescriptor");
  });
});

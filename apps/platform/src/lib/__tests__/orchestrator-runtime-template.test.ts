import { describe, expect, it } from "vitest";
import ts from "typescript";
import { renderAgentsSdkPersonalAgentRuntime } from "../agents-sdk-runtime-template";
import { buildDeploymentRequest } from "../deployment-engine";

describe("orchestrator-runtime template emission", () => {
  it("emits a syntactically valid orchestrator-runtime.ts alongside server.ts", () => {
    const files = renderAgentsSdkPersonalAgentRuntime({
      deploymentId: "agent-orchestrator-smoke",
      request: buildDeploymentRequest("self", {
        userId: "user-orchestrator",
        agentName: "Orchestrator Smoke",
        cloudflareAccountId: "acct",
        cfApiToken: "token",
        acceptedTerms: true,
        personalAgent: {
          enabled: true,
          presetId: "custom",
          toolApprovalPolicy: "auto",
          customName: "Smoke",
          soulPrompt: "be helpful",
          launchBrief: "ship the orchestrator"
        }
      }),
      bindings: {
        scriptName: "open-think-orchestrator-smoke",
        databaseName: "open-think-orchestrator-smoke-db",
        databaseId: "d1-orch",
        bucketName: "open-think-orchestrator-smoke-artifacts",
        queueName: "open-think-orchestrator-smoke-tasks",
        vectorizeName: "open-think-orchestrator-smoke-memory"
      }
    });

    const orchestratorRuntime =
      files.find((file) => file.path === "src/orchestrator-runtime.ts")?.contents ?? "";
    const server = files.find((file) => file.path === "src/server.ts")?.contents ?? "";

    // Sanity: both files were emitted with content.
    expect(orchestratorRuntime.length).toBeGreaterThan(0);
    expect(server.length).toBeGreaterThan(0);

    // The runtime module re-exports the same surface the generated server
    // expects (initOrchestrator + four helpers + AgentDescriptor).
    expect(orchestratorRuntime).toContain("export async function initOrchestrator");
    expect(orchestratorRuntime).toContain("export async function handleSlashCommand");
    expect(orchestratorRuntime).toContain("export async function buildOrchestratorSystemPrompt");
    expect(orchestratorRuntime).toContain("export async function gateToolCall");
    expect(orchestratorRuntime).toContain("export async function recordTraceAndMaybeEvolve");
    expect(orchestratorRuntime).toContain("export interface AgentDescriptor");
    expect(orchestratorRuntime).toContain("export interface OrchestratorEnvBase");
    expect(orchestratorRuntime).toContain("export interface OrchestratorRuntime");

    // The runtime should not import from a workspace package — it must be
    // standalone except for the small `zod` runtime dep already declared
    // by the generated worker's package.json. Match real import statements
    // (not the comment that documents what the bundle is mirroring).
    expect(orchestratorRuntime).not.toMatch(/from\s+["']@open-think\//);
    expect(orchestratorRuntime).toMatch(/import \{ z \} from "zod";/);

    // server.ts imports from the sibling module — same shape the starter
    // uses internally, so the inlining is the only thing that changes.
    expect(server).toContain('from "./orchestrator-runtime"');
    expect(server).toContain('export class OrchestratorAgent extends Agent<OrchestratorEnv>');

    // Each emitted file must be valid TypeScript. We compile the runtime
    // module with ts.transpileModule (the same harness the existing
    // template test uses) and expect zero diagnostics.
    const runtimeDiagnostics = ts.transpileModule(orchestratorRuntime, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true
      },
      reportDiagnostics: true
    }).diagnostics ?? [];
    expect(runtimeDiagnostics).toEqual([]);

    const serverDiagnostics = ts.transpileModule(server, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true
      },
      reportDiagnostics: true
    }).diagnostics ?? [];
    expect(serverDiagnostics).toEqual([]);
  });
});

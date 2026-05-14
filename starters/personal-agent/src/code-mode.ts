/**
 * Code-mode MCP wrapper.
 *
 * Cloudflare's "code-mode" pattern lets an agent express a multi-step
 * tool plan as a single TypeScript snippet that runs inside an isolate.
 * Instead of round-tripping each tool call through the LLM, the LLM
 * emits a chunk of code that calls the bound MCP tools directly.
 *
 * Reference: https://blog.cloudflare.com/code-mode-mcp/
 *
 * We expose code-mode as an *advanced* feature with three modes:
 *   - off            : standard one-tool-per-turn calls (default for new users)
 *   - assisted       : LLM may choose code-mode for batch plans
 *   - always         : LLM always emits code-mode for tool execution
 */

import type { ApprovalConfig } from "./approval";

export const codeModePolicies = ["off", "assisted", "always"] as const;
export type CodeModePolicy = (typeof codeModePolicies)[number];

export interface CodeModeConfig {
  policy: CodeModePolicy;
  sandboxBinding?: string;
  maxRunMs: number;
  allowFetch: boolean;
  allowMcpTools: string[];
}

export const defaultCodeModeConfig: CodeModeConfig = {
  policy: "assisted",
  maxRunMs: 30_000,
  allowFetch: true,
  allowMcpTools: ["*"]
};

export interface CodeModePromptInjection {
  enabled: boolean;
  systemPromptFragment: string;
}

export function buildCodeModeInjection(
  config: CodeModeConfig,
  approval: ApprovalConfig
): CodeModePromptInjection {
  if (config.policy === "off") {
    return { enabled: false, systemPromptFragment: "" };
  }
  const lines = [
    "## Code-mode tool execution",
    "When several tool calls share inputs or you need to fan out, you may emit a single fenced",
    "```code-mode\\nasync function plan({ tools, fetch }) { /* … */ }\\n```",
    "block. The harness will run it inside a sandboxed isolate with",
    `a ${config.maxRunMs}ms budget. Bound tools: ${config.allowMcpTools.join(", ")}.`,
    approval.mode === "manual"
      ? "Approval mode is manual — the code-mode plan will still be reviewed before execution."
      : `Approval mode is ${approval.mode} — code-mode runs follow the same allow/deny rules.`
  ];
  if (config.policy === "assisted") {
    lines.push("Use code-mode when it is clearly more efficient; otherwise call tools one at a time.");
  } else {
    lines.push("Always emit a code-mode plan for tool execution.");
  }
  return { enabled: true, systemPromptFragment: lines.join("\n") };
}

export interface CodeModeRunner {
  run(args: { code: string; bindings: Record<string, unknown> }): Promise<{
    ok: boolean;
    output: string;
    durationMs: number;
    diagnostics?: string;
  }>;
}

/**
 * Sandbox-GA runner (Cloudflare Sandbox). Falls back to a stub that
 * refuses execution if the sandbox binding is missing.
 *
 * See https://blog.cloudflare.com/sandbox-ga/
 */
export function createSandboxCodeModeRunner(
  sandbox: { run(input: { code: string; bindings: Record<string, unknown>; timeoutMs?: number }): Promise<{ stdout: string; exitCode: number; }> } | undefined,
  config: CodeModeConfig
): CodeModeRunner {
  if (!sandbox) {
    return {
      async run() {
        return {
          ok: false,
          output: "",
          durationMs: 0,
          diagnostics:
            "Cloudflare Sandbox binding not configured. Bind a sandbox in wrangler.jsonc to enable code-mode execution."
        };
      }
    };
  }
  return {
    async run({ code, bindings }) {
      const started = Date.now();
      try {
        const result = await sandbox.run({ code, bindings, timeoutMs: config.maxRunMs });
        return {
          ok: result.exitCode === 0,
          output: result.stdout,
          durationMs: Date.now() - started
        };
      } catch (error) {
        return {
          ok: false,
          output: "",
          durationMs: Date.now() - started,
          diagnostics: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

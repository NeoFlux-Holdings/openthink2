import { describe, expect, it } from "vitest";
import {
  buildCodeModeInjection,
  createSandboxCodeModeRunner,
  defaultCodeModeConfig
} from "../code-mode";
import { defaultApprovalConfig } from "../approval";
import { buildExecutorMcpServerConfig, DEFAULT_EXECUTOR_ENDPOINT, probeExecutor } from "../executor";

describe("code-mode injection", () => {
  it("returns disabled fragment when policy is off", () => {
    const result = buildCodeModeInjection(
      { ...defaultCodeModeConfig, policy: "off" },
      defaultApprovalConfig
    );
    expect(result.enabled).toBe(false);
    expect(result.systemPromptFragment).toEqual("");
  });

  it("returns an assisted fragment by default", () => {
    const result = buildCodeModeInjection(defaultCodeModeConfig, defaultApprovalConfig);
    expect(result.enabled).toBe(true);
    expect(result.systemPromptFragment).toContain("code-mode");
    expect(result.systemPromptFragment).toContain("more efficient");
  });

  it("uses an always-emit fragment when policy is always", () => {
    const result = buildCodeModeInjection(
      { ...defaultCodeModeConfig, policy: "always" },
      defaultApprovalConfig
    );
    expect(result.systemPromptFragment).toContain("Always emit");
  });
});

describe("sandbox runner fallback", () => {
  it("refuses execution when no sandbox binding is supplied", async () => {
    const runner = createSandboxCodeModeRunner(undefined, defaultCodeModeConfig);
    const result = await runner.run({ code: "noop()", bindings: {} });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContain("Sandbox binding not configured");
  });

  it("runs through the sandbox binding when provided", async () => {
    let captured: { code: string; bindings: Record<string, unknown>; timeoutMs?: number } | null =
      null;
    const fakeSandbox = {
      async run(input: { code: string; bindings: Record<string, unknown>; timeoutMs?: number }) {
        captured = input;
        return { stdout: "ok", exitCode: 0 };
      }
    };
    const runner = createSandboxCodeModeRunner(fakeSandbox, defaultCodeModeConfig);
    const result = await runner.run({ code: "do()", bindings: { x: 1 } });
    expect(result.ok).toBe(true);
    expect(result.output).toBe("ok");
    expect(captured).not.toBeNull();
    expect(captured!.timeoutMs).toBe(defaultCodeModeConfig.maxRunMs);
  });
});

describe("executor.sh client", () => {
  it("builds the bearer header config", () => {
    const cfg = buildExecutorMcpServerConfig({
      endpoint: "",
      workosToken: "ws_abc"
    });
    expect(cfg.url).toBe(DEFAULT_EXECUTOR_ENDPOINT);
    expect(cfg.headers.Authorization).toBe("Bearer ws_abc");
    expect(cfg.headers.Accept).toBe("text/event-stream");
  });

  it("throws if no WorkOS token is provided", () => {
    expect(() =>
      buildExecutorMcpServerConfig({ endpoint: "", workosToken: "" })
    ).toThrow(/WorkOS/);
  });

  it("probeExecutor returns missing-token when no token configured", async () => {
    const result = await probeExecutor({ endpoint: "", workosToken: "" });
    expect(result.ready).toBe(false);
    expect(result.message).toContain("missing WorkOS token");
  });

  it("probeExecutor reports auth failure on 401", async () => {
    const fakeFetch = async () => new Response("nope", { status: 401 });
    const result = await probeExecutor(
      { endpoint: "https://executor.sh/mcp", workosToken: "stale" },
      { fetchImpl: fakeFetch as unknown as typeof fetch }
    );
    expect(result.ready).toBe(false);
    expect(result.message).toContain("auth rejected");
  });
});

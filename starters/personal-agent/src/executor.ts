/**
 * executor.sh MCP client.
 *
 * Connects a Cloudflare-hosted agent to the public executor cloud MCP
 * gateway at https://executor.sh/mcp. The gateway is itself a CF Worker;
 * auth is a WorkOS Bearer JWT. The user authenticates once through the
 * executor web app (WorkOS AuthKit) and the resulting session token is
 * stored as the OPEN_THINK_EXECUTOR_WORKOS_TOKEN secret on the deployed
 * agent Worker.
 *
 * Wire-up (from the openthink2 brief):
 *
 *     Your CF Agent Worker
 *           │  POST https://executor.sh/mcp
 *           │  Authorization: Bearer <workos-token>
 *           ▼
 *      executor.sh (CF Worker)
 *           │  mcpFetch → verifyBearer → McpSessionDO
 *           ▼
 *      McpSessionDO (Durable Object)
 *           │  DynamicWorkerExecutor (sandboxed isolate)
 *           ▼
 *      Tool execution result (SSE stream)
 */

export interface ExecutorClientConfig {
  endpoint: string;
  workosToken: string;
  defaultHeaders?: Record<string, string>;
}

export interface ExecutorMcpServerConfig {
  url: string;
  headers: { Authorization: string } & Record<string, string>;
}

export const DEFAULT_EXECUTOR_ENDPOINT = "https://executor.sh/mcp";

export function buildExecutorMcpServerConfig(
  config: ExecutorClientConfig
): ExecutorMcpServerConfig {
  if (!config.workosToken) {
    throw new Error(
      "executor.sh requires a WorkOS bearer token. Set OPEN_THINK_EXECUTOR_WORKOS_TOKEN on the Worker."
    );
  }
  return {
    url: config.endpoint || DEFAULT_EXECUTOR_ENDPOINT,
    headers: {
      Authorization: `Bearer ${config.workosToken}`,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      ...(config.defaultHeaders ?? {})
    }
  };
}

export interface ExecutorReadiness {
  ready: boolean;
  endpoint: string;
  message: string;
}

export async function probeExecutor(
  config: ExecutorClientConfig,
  options: { fetchImpl?: typeof fetch } = {}
): Promise<ExecutorReadiness> {
  const endpoint = config.endpoint || DEFAULT_EXECUTOR_ENDPOINT;
  if (!config.workosToken) {
    return {
      ready: false,
      endpoint,
      message: "missing WorkOS token (OPEN_THINK_EXECUTOR_WORKOS_TOKEN)"
    };
  }
  const f = options.fetchImpl ?? fetch;
  try {
    const response = await f(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.workosToken}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: {} })
    });
    if (response.status === 401 || response.status === 403) {
      return {
        ready: false,
        endpoint,
        message: `auth rejected (HTTP ${response.status}) — log in at executor.sh and refresh the token`
      };
    }
    return {
      ready: response.ok,
      endpoint,
      message: response.ok ? "ok" : `unexpected status ${response.status}`
    };
  } catch (error) {
    return {
      ready: false,
      endpoint,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

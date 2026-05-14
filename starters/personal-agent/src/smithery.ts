/**
 * Smithery client — the third execution lane.
 *
 * openthink2 mounts three classes of MCP servers:
 *
 *   1. In-Worker McpAgents      — RPC transport, zero network hop.
 *                                  This is the default for our own
 *                                  specialist sub-agents (coder,
 *                                  researcher, browser, …).
 *   2. executor.sh               — Cloud MCP gateway over HTTPS,
 *                                  WorkOS JWT auth. Useful when the
 *                                  user wants the executor.sh tool
 *                                  surface alongside Sandbox.
 *   3. Smithery (this module)    — The MCP server registry at
 *                                  smithery.ai. Over 7,000 servers,
 *                                  hosted by Smithery, mounted via
 *                                  Streamable-HTTP transport from
 *                                  inside the agent. Auth is a
 *                                  per-user Smithery API key.
 *
 * This file is a typed client + a `buildSmitheryServerConfig` helper
 * that returns the `{ url, headers }` shape `addMcpServer()` accepts.
 *
 * Per-server install state (api keys, server settings) lives in
 * Durable Object storage via SmitheryStore.
 */

export interface SmitheryServerDescriptor {
  /** Stable id used in URL paths, e.g. "@smithery-ai/github". */
  qualifiedName: string;
  /** Human-friendly display name. */
  displayName: string;
  /** Short description from the registry. */
  description: string;
  /** Marketing tags ("github", "developer-tools", "communication"). */
  tags: string[];
  /** True when Smithery hosts the server for you. */
  hosted: boolean;
  /** Latest version string from the registry, if known. */
  version?: string;
  /** Author / publisher. */
  author?: string;
  /** Direct URL of the canonical hosted endpoint, if known. Falls back
   * to the convention `https://server.smithery.ai/<qualifiedName>/mcp`. */
  endpointUrl?: string;
}

export interface SmitheryInstallation {
  qualifiedName: string;
  /** Per-server configuration (e.g. `{ token: "ghp_…" }`). Encrypted
   *  at rest by the deploying Worker — never stored in plaintext D1. */
  config: Record<string, unknown>;
  enabled: boolean;
  installedAt: string;
}

export interface SmitheryClientConfig {
  /** User's Smithery API key. Sent as `Authorization: Bearer …`. */
  apiKey: string;
  /** Registry endpoint. Defaults to https://server.smithery.ai. */
  registryBase?: string;
  /** Custom fetch (used by tests). */
  fetchImpl?: typeof fetch;
}

export const DEFAULT_SMITHERY_REGISTRY = "https://server.smithery.ai";

/** Build the MCP server config to hand to Agent.addMcpServer(). */
export function buildSmitheryServerConfig(input: {
  qualifiedName: string;
  apiKey: string;
  registryBase?: string;
  installation?: SmitheryInstallation;
}): { url: string; headers: Record<string, string> } {
  if (!input.apiKey) {
    throw new Error("Smithery requires an API key — set OPEN_THINK_SMITHERY_API_KEY on the Worker.");
  }
  const base = input.registryBase ?? DEFAULT_SMITHERY_REGISTRY;
  const url = new URL(`${base.replace(/\/$/, "")}/${input.qualifiedName}/mcp`);
  if (input.installation && Object.keys(input.installation.config).length > 0) {
    // Smithery accepts JSON-encoded base64 config as a query param so the
    // server knows what credentials to use without persisting state.
    const cfg = btoa(JSON.stringify(input.installation.config));
    url.searchParams.set("config", cfg);
  }
  return {
    url: url.toString(),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      Accept: "text/event-stream",
      "Content-Type": "application/json"
    }
  };
}

export interface SmitheryClient {
  /** Search the registry. Empty query returns the curated front page. */
  search(query: string, opts?: { limit?: number }): Promise<SmitheryServerDescriptor[]>;
  /** Fetch a single server's metadata. */
  get(qualifiedName: string): Promise<SmitheryServerDescriptor | null>;
}

export function createSmitheryClient(config: SmitheryClientConfig): SmitheryClient {
  const f = config.fetchImpl ?? fetch;
  const base = config.registryBase ?? DEFAULT_SMITHERY_REGISTRY;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json"
  };
  return {
    async search(query, opts = {}) {
      const url = new URL(`${base.replace(/\/$/, "")}/registry/search`);
      if (query) url.searchParams.set("q", query);
      url.searchParams.set("limit", String(opts.limit ?? 24));
      const res = await f(url.toString(), { headers });
      if (!res.ok) throw new Error(`Smithery search failed: ${res.status}`);
      const body = (await res.json()) as { servers?: SmitheryServerDescriptor[] };
      return body.servers ?? [];
    },
    async get(qualifiedName) {
      const url = `${base.replace(/\/$/, "")}/registry/servers/${encodeURIComponent(qualifiedName)}`;
      const res = await f(url, { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Smithery get failed: ${res.status}`);
      return (await res.json()) as SmitheryServerDescriptor;
    }
  };
}

/**
 * Durable Object–backed store of which Smithery servers a workspace
 * has installed and how they're configured.
 */
export interface SmitheryStore {
  list(): Promise<SmitheryInstallation[]>;
  get(qualifiedName: string): Promise<SmitheryInstallation | null>;
  install(record: Omit<SmitheryInstallation, "installedAt">): Promise<SmitheryInstallation>;
  uninstall(qualifiedName: string): Promise<void>;
  setEnabled(qualifiedName: string, enabled: boolean): Promise<SmitheryInstallation | null>;
}

interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

const SMITHERY_PREFIX = "smithery:";

export function createSmitheryStore(storage: DoStorageLike): SmitheryStore {
  return {
    async list() {
      const map = await storage.list<SmitheryInstallation>({ prefix: SMITHERY_PREFIX });
      return Array.from(map.values());
    },
    async get(qualifiedName) {
      const value = await storage.get<SmitheryInstallation>(SMITHERY_PREFIX + qualifiedName);
      return value ?? null;
    },
    async install(record) {
      const stamped: SmitheryInstallation = { ...record, installedAt: new Date().toISOString() };
      await storage.put(SMITHERY_PREFIX + record.qualifiedName, stamped);
      return stamped;
    },
    async uninstall(qualifiedName) {
      await storage.delete(SMITHERY_PREFIX + qualifiedName);
    },
    async setEnabled(qualifiedName, enabled) {
      const existing = await this.get(qualifiedName);
      if (!existing) return null;
      const next: SmitheryInstallation = { ...existing, enabled };
      await storage.put(SMITHERY_PREFIX + qualifiedName, next);
      return next;
    }
  };
}

/**
 * Build the addMcpServer() calls for every enabled Smithery
 * installation on a workspace. Used by the OrchestratorAgent at
 * startup to mount the user's curated Smithery servers as MCP clients.
 */
export interface SmitheryMountCall {
  name: string;
  url: string;
  headers: Record<string, string>;
}

export async function buildSmitheryMountCalls(input: {
  store: SmitheryStore;
  apiKey: string;
  registryBase?: string;
}): Promise<SmitheryMountCall[]> {
  if (!input.apiKey) return [];
  const installations = await input.store.list();
  return installations
    .filter((i) => i.enabled)
    .map((i) => {
      const cfg: { qualifiedName: string; apiKey: string; registryBase?: string; installation: SmitheryInstallation } = {
        qualifiedName: i.qualifiedName,
        apiKey: input.apiKey,
        installation: i
      };
      if (input.registryBase) cfg.registryBase = input.registryBase;
      const built = buildSmitheryServerConfig(cfg);
      return {
        name: `smithery:${i.qualifiedName}`,
        url: built.url,
        headers: built.headers
      };
    });
}

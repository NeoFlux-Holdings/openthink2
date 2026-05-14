import { describe, expect, it } from "vitest";
import {
  buildSmitheryMountCalls,
  buildSmitheryServerConfig,
  createSmitheryClient,
  createSmitheryStore,
  DEFAULT_SMITHERY_REGISTRY
} from "../smithery";

function makeStorage() {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return map.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      map.set(key, value);
    },
    async delete(key: string) {
      return map.delete(key);
    },
    async list<T>(options?: { prefix?: string }) {
      const out = new Map<string, T>();
      for (const [k, v] of map) {
        if (!options?.prefix || k.startsWith(options.prefix)) out.set(k, v as T);
      }
      return out;
    }
  };
}

describe("buildSmitheryServerConfig", () => {
  it("builds the URL + bearer header for a hosted server", () => {
    const cfg = buildSmitheryServerConfig({
      qualifiedName: "@smithery-ai/github",
      apiKey: "sm_abc"
    });
    expect(cfg.url).toBe(`${DEFAULT_SMITHERY_REGISTRY}/@smithery-ai/github/mcp`);
    expect(cfg.headers.Authorization).toBe("Bearer sm_abc");
  });

  it("encodes per-install config into the URL", () => {
    const cfg = buildSmitheryServerConfig({
      qualifiedName: "@smithery-ai/github",
      apiKey: "sm_abc",
      installation: {
        qualifiedName: "@smithery-ai/github",
        config: { token: "ghp_xyz" },
        enabled: true,
        installedAt: ""
      }
    });
    const u = new URL(cfg.url);
    const decoded = JSON.parse(atob(u.searchParams.get("config")!));
    expect(decoded).toEqual({ token: "ghp_xyz" });
  });

  it("throws on missing API key", () => {
    expect(() =>
      buildSmitheryServerConfig({ qualifiedName: "@x/y", apiKey: "" })
    ).toThrow(/API key/);
  });
});

describe("createSmitheryClient", () => {
  it("hits the registry search endpoint with a bearer header", async () => {
    let captured: { url: string; auth?: string } | null = null;
    const fakeFetch: typeof fetch = async (input, init) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      const entry: { url: string; auth?: string } = { url: String(input) };
      if (auth) entry.auth = auth;
      captured = entry;
      return new Response(
        JSON.stringify({
          servers: [
            {
              qualifiedName: "@smithery-ai/github",
              displayName: "GitHub",
              description: "GitHub MCP server",
              tags: ["github"],
              hosted: true
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const client = createSmitheryClient({ apiKey: "sm_abc", fetchImpl: fakeFetch });
    const results = await client.search("github");
    expect(results).toHaveLength(1);
    expect(results[0]!.qualifiedName).toBe("@smithery-ai/github");
    expect(captured!.url).toContain("/registry/search?q=github");
    expect(captured!.auth).toBe("Bearer sm_abc");
  });

  it("returns null on 404 for get()", async () => {
    const fakeFetch: typeof fetch = async () => new Response("", { status: 404 });
    const client = createSmitheryClient({ apiKey: "sm_abc", fetchImpl: fakeFetch });
    const result = await client.get("@nope/missing");
    expect(result).toBeNull();
  });
});

describe("Smithery store + mount calls", () => {
  it("installs, lists, toggles, and uninstalls", async () => {
    const store = createSmitheryStore(makeStorage());
    await store.install({
      qualifiedName: "@smithery-ai/github",
      config: { token: "ghp_xyz" },
      enabled: true
    });
    const listed = await store.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.installedAt).toBeTruthy();

    const toggled = await store.setEnabled("@smithery-ai/github", false);
    expect(toggled?.enabled).toBe(false);

    await store.uninstall("@smithery-ai/github");
    expect(await store.list()).toHaveLength(0);
  });

  it("only mounts enabled installations and skips when no API key is set", async () => {
    const store = createSmitheryStore(makeStorage());
    await store.install({
      qualifiedName: "@smithery-ai/github",
      config: { token: "x" },
      enabled: true
    });
    await store.install({
      qualifiedName: "@smithery-ai/linear",
      config: {},
      enabled: false
    });

    const empty = await buildSmitheryMountCalls({ store, apiKey: "" });
    expect(empty).toHaveLength(0);

    const calls = await buildSmitheryMountCalls({ store, apiKey: "sm_abc" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.name).toBe("smithery:@smithery-ai/github");
  });
});

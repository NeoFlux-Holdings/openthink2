import { describe, expect, it, vi } from "vitest";
import {
  createProposePr,
  type ProposePrInput,
  type ProposePrSandbox,
  type ProposePrIdempotencyStore
} from "../propose-pr";

/**
 * Minimal in-memory fake of the GitHub REST API.
 *
 * Each handler returns either a Response or `undefined` (= continue
 * trying handlers). The default fallback fails the test with a clear
 * error so unexpected requests do not silently pass.
 */
interface FakeHandler {
  match: (method: string, path: string) => boolean;
  respond: (
    method: string,
    path: string,
    body: unknown
  ) => Promise<Response> | Response;
}

function makeFakeFetch(handlers: FakeHandler[], requestLog: Array<{ method: string; path: string; body: unknown }>) {
  return async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace("https://api.github.com", "");
    let body: unknown = undefined;
    if (init?.body !== undefined && typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    requestLog.push({ method, path, body });
    for (const h of handlers) {
      if (h.match(method, path)) {
        return h.respond(method, path, body);
      }
    }
    throw new Error(`fake fetch: no handler for ${method} ${path}`);
  } as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function baseInput(overrides: Partial<ProposePrInput> = {}): ProposePrInput {
  return {
    target: {
      owner: "octo",
      repo: "demo",
      baseBranch: "main"
    },
    headBranch: "claude/add-feature",
    title: "Add a feature",
    body: "Adds the requested feature.",
    files: { "src/feature.ts": "export const x = 1;\n" },
    githubToken: "ghp_token",
    author: { name: "Bot", email: "bot@example.com" },
    ...overrides
  };
}

function happyPathHandlers(opts: {
  branchExistsInitially?: boolean;
  branchExistingShaIsBase?: boolean;
} = {}): FakeHandler[] {
  const branchExistsInitially = opts.branchExistsInitially ?? false;
  const branchExistingShaIsBase = opts.branchExistingShaIsBase ?? false;
  const branchProbeCalls = { count: 0 };

  return [
    // base ref
    {
      match: (m, p) => m === "GET" && p === "/repos/octo/demo/git/ref/heads/main",
      respond: () =>
        jsonResponse(200, {
          ref: "refs/heads/main",
          object: { sha: "basesha000000000000000000000000000000aaaa", type: "commit" }
        })
    },
    // base commit (to get tree sha)
    {
      match: (m, p) => m === "GET" && p.startsWith("/repos/octo/demo/git/commits/"),
      respond: () =>
        jsonResponse(200, {
          sha: "basesha000000000000000000000000000000aaaa",
          tree: { sha: "basetree00000000000000000000000000000bbbb" }
        })
    },
    // probe candidate head branch
    {
      match: (m, p) =>
        m === "GET" && p.startsWith("/repos/octo/demo/git/ref/heads/claude/add-feature"),
      respond: () => {
        branchProbeCalls.count += 1;
        if (branchExistsInitially && branchProbeCalls.count === 1) {
          return jsonResponse(200, {
            ref: "refs/heads/claude/add-feature",
            object: {
              sha: branchExistingShaIsBase
                ? "basesha000000000000000000000000000000aaaa"
                : "deadbeef000000000000000000000000000000ff",
              type: "commit"
            }
          });
        }
        return jsonResponse(404, { message: "Not Found" });
      }
    },
    // create branch
    {
      match: (m, p) => m === "POST" && p === "/repos/octo/demo/git/refs",
      respond: () =>
        jsonResponse(201, {
          ref: "refs/heads/claude/add-feature",
          object: { sha: "basesha000000000000000000000000000000aaaa", type: "commit" }
        })
    },
    // create blob(s)
    {
      match: (m, p) => m === "POST" && p === "/repos/octo/demo/git/blobs",
      respond: () => jsonResponse(201, { sha: "blob0000", url: "u" })
    },
    // create tree
    {
      match: (m, p) => m === "POST" && p === "/repos/octo/demo/git/trees",
      respond: () => jsonResponse(201, { sha: "newtree0" })
    },
    // create commit
    {
      match: (m, p) => m === "POST" && p === "/repos/octo/demo/git/commits",
      respond: () => jsonResponse(201, { sha: "commit00", tree: { sha: "newtree0" } })
    },
    // update head ref
    {
      match: (m, p) => m === "PATCH" && p.startsWith("/repos/octo/demo/git/refs/heads/"),
      respond: () =>
        jsonResponse(200, {
          ref: "refs/heads/claude/add-feature",
          object: { sha: "commit00", type: "commit" }
        })
    },
    // open PR
    {
      match: (m, p) => m === "POST" && p === "/repos/octo/demo/pulls",
      respond: () =>
        jsonResponse(201, {
          html_url: "https://github.com/octo/demo/pull/42",
          number: 42
        })
    }
  ];
}

describe("createProposePr", () => {
  it("happy path: walks Git Data API and opens a PR, invoking the sandbox pre-check hook", async () => {
    const requestLog: Array<{ method: string; path: string; body: unknown }> = [];
    const sandboxRun = vi
      .fn<NonNullable<ProposePrSandbox>["run"]>()
      .mockResolvedValue({ stdout: "", exitCode: 0 });
    const sandbox: ProposePrSandbox = { run: sandboxRun };
    const propose = createProposePr({
      sandbox,
      fetchImpl: makeFakeFetch(happyPathHandlers(), requestLog)
    });

    const result = await propose(baseInput());

    expect(result.ok).toBe(true);
    expect(result.prUrl).toBe("https://github.com/octo/demo/pull/42");
    expect(result.prNumber).toBe(42);
    expect(result.headBranch).toBe("claude/add-feature");
    expect(sandboxRun).toHaveBeenCalledTimes(1);
    expect(result.log.some((e) => e.step === "sandbox-pre-checks" && e.status === "ok")).toBe(
      true
    );

    // Verify the request sequence
    const sequence = requestLog.map((r) => `${r.method} ${r.path}`);
    expect(sequence[0]).toBe("GET /repos/octo/demo/git/ref/heads/main");
    expect(sequence).toContain("POST /repos/octo/demo/git/refs");
    expect(sequence).toContain("POST /repos/octo/demo/git/blobs");
    expect(sequence).toContain("POST /repos/octo/demo/git/trees");
    expect(sequence).toContain("POST /repos/octo/demo/git/commits");
    expect(sequence).toContain("POST /repos/octo/demo/pulls");
    expect(sequence[sequence.length - 1]).toBe("POST /repos/octo/demo/pulls");

    // PR body uses head = headBranch (no fork prefix)
    const prCall = requestLog.find((r) => r.path === "/repos/octo/demo/pulls");
    expect((prCall?.body as { head?: string })?.head).toBe("claude/add-feature");
    expect((prCall?.body as { base?: string })?.base).toBe("main");
  });

  it("cross-repo fork path uses 'forkOwner:branch' for head and ensures the fork exists", async () => {
    const requestLog: Array<{ method: string; path: string; body: unknown }> = [];
    const handlers: FakeHandler[] = [
      // fork (idempotent: returns 202)
      {
        match: (m, p) => m === "POST" && p === "/repos/octo/demo/forks",
        respond: () => new Response("", { status: 202 })
      },
      // base ref on upstream
      {
        match: (m, p) => m === "GET" && p === "/repos/octo/demo/git/ref/heads/main",
        respond: () =>
          jsonResponse(200, {
            ref: "refs/heads/main",
            object: { sha: "basesha000000000000000000000000000000aaaa", type: "commit" }
          })
      },
      // base commit
      {
        match: (m, p) => m === "GET" && p.startsWith("/repos/octo/demo/git/commits/"),
        respond: () =>
          jsonResponse(200, {
            sha: "basesha000000000000000000000000000000aaaa",
            tree: { sha: "basetree00000000000000000000000000000bbbb" }
          })
      },
      // probe head on fork: 404 (free)
      {
        match: (m, p) =>
          m === "GET" && p.startsWith("/repos/fork-user/demo/git/ref/heads/claude/add-feature"),
        respond: () => jsonResponse(404, { message: "Not Found" })
      },
      // create branch on fork
      {
        match: (m, p) => m === "POST" && p === "/repos/fork-user/demo/git/refs",
        respond: () =>
          jsonResponse(201, {
            ref: "refs/heads/claude/add-feature",
            object: { sha: "basesha000000000000000000000000000000aaaa", type: "commit" }
          })
      },
      // blobs/trees/commits/refs on fork
      {
        match: (m, p) => m === "POST" && p === "/repos/fork-user/demo/git/blobs",
        respond: () => jsonResponse(201, { sha: "blob0000", url: "u" })
      },
      {
        match: (m, p) => m === "POST" && p === "/repos/fork-user/demo/git/trees",
        respond: () => jsonResponse(201, { sha: "newtree0" })
      },
      {
        match: (m, p) => m === "POST" && p === "/repos/fork-user/demo/git/commits",
        respond: () => jsonResponse(201, { sha: "commit00", tree: { sha: "newtree0" } })
      },
      {
        match: (m, p) =>
          m === "PATCH" && p.startsWith("/repos/fork-user/demo/git/refs/heads/"),
        respond: () =>
          jsonResponse(200, {
            ref: "refs/heads/claude/add-feature",
            object: { sha: "commit00", type: "commit" }
          })
      },
      // PR opens on the upstream repo
      {
        match: (m, p) => m === "POST" && p === "/repos/octo/demo/pulls",
        respond: () =>
          jsonResponse(201, {
            html_url: "https://github.com/octo/demo/pull/77",
            number: 77
          })
      }
    ];

    const propose = createProposePr({
      fetchImpl: makeFakeFetch(handlers, requestLog)
    });
    const result = await propose(
      baseInput({ target: { owner: "octo", repo: "demo", baseBranch: "main", fork: { owner: "fork-user" } } })
    );

    expect(result.ok).toBe(true);
    expect(result.prNumber).toBe(77);
    const prCall = requestLog.find((r) => r.path === "/repos/octo/demo/pulls");
    expect((prCall?.body as { head?: string })?.head).toBe("fork-user:claude/add-feature");
    expect(requestLog.some((r) => r.method === "POST" && r.path === "/repos/octo/demo/forks")).toBe(
      true
    );
  });

  it("idempotency cache hit short-circuits and performs zero fetches", async () => {
    const requestLog: Array<{ method: string; path: string; body: unknown }> = [];
    const fakeFetch = vi.fn(async () => {
      throw new Error("fetch must not be called on cache hit");
    }) as unknown as typeof fetch;

    const cache = new Map<string, { prUrl: string; prNumber: number }>();
    const input = baseInput();

    // Pre-populate cache using the same hashing scheme: we run a first
    // call against a real handler set to learn the key, then assert
    // the second call hits the cache without any fetches.
    const realHandlers = happyPathHandlers();
    const realPropose = createProposePr({
      fetchImpl: makeFakeFetch(realHandlers, requestLog),
      idempotencyStore: makeStore(cache)
    });
    const first = await realPropose(input);
    expect(first.ok).toBe(true);
    expect(cache.size).toBe(1);

    // Second call uses a fetch that throws if invoked.
    const propose = createProposePr({
      fetchImpl: fakeFetch,
      idempotencyStore: makeStore(cache)
    });
    const second = await propose(input);
    expect(second.ok).toBe(true);
    expect(second.prUrl).toBe(first.prUrl);
    expect(second.prNumber).toBe(first.prNumber);
    expect(fakeFetch).not.toHaveBeenCalled();
    expect(second.log[0]?.step).toBe("idempotency-cache");
    expect(second.log[0]?.status).toBe("ok");
    expect(second.log[0]?.detail).toContain("cache hit");
  });

  it("sandbox pre-check failure is logged but does not block PR creation", async () => {
    const requestLog: Array<{ method: string; path: string; body: unknown }> = [];
    const sandbox: ProposePrSandbox = {
      run: vi.fn().mockRejectedValue(new Error("sandbox blew up"))
    };
    const propose = createProposePr({
      sandbox,
      fetchImpl: makeFakeFetch(happyPathHandlers(), requestLog)
    });

    const result = await propose(baseInput());

    expect(result.ok).toBe(true);
    expect(result.prUrl).toBe("https://github.com/octo/demo/pull/42");
    const sandboxLog = result.log.find((e) => e.step === "sandbox-pre-checks");
    expect(sandboxLog?.status).toBe("error");
    expect(sandboxLog?.detail).toContain("sandbox blew up");
    // PR creation continued
    expect(result.log.some((e) => e.step === "open-pr" && e.status === "ok")).toBe(true);
  });

  it("GitHub API failure on commit returns ok=false with the failing step recorded", async () => {
    const requestLog: Array<{ method: string; path: string; body: unknown }> = [];
    const handlers = happyPathHandlers();
    // Replace the create-commit handler with a 422
    const commitIdx = handlers.findIndex(
      (h) => h.match("POST", "/repos/octo/demo/git/commits")
    );
    handlers[commitIdx] = {
      match: (m, p) => m === "POST" && p === "/repos/octo/demo/git/commits",
      respond: () => jsonResponse(422, { message: "Unprocessable" })
    };
    const propose = createProposePr({
      fetchImpl: makeFakeFetch(handlers, requestLog)
    });

    const result = await propose(baseInput());

    expect(result.ok).toBe(false);
    expect(result.prUrl).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toContain("422");
    const failing = result.log.find((e) => e.step === "create-commit");
    expect(failing?.status).toBe("error");
    expect(failing?.detail).toContain("422");
    // open-pr must NOT have been attempted
    expect(requestLog.find((r) => r.path === "/repos/octo/demo/pulls")).toBeUndefined();
  });

  it("branch collision bumps the head suffix to a free name", async () => {
    const requestLog: Array<{ method: string; path: string; body: unknown }> = [];
    let probeCalls = 0;
    const handlers: FakeHandler[] = [
      {
        match: (m, p) => m === "GET" && p === "/repos/octo/demo/git/ref/heads/main",
        respond: () =>
          jsonResponse(200, {
            ref: "refs/heads/main",
            object: { sha: "basesha000000000000000000000000000000aaaa", type: "commit" }
          })
      },
      {
        match: (m, p) => m === "GET" && p.startsWith("/repos/octo/demo/git/commits/"),
        respond: () =>
          jsonResponse(200, {
            sha: "basesha000000000000000000000000000000aaaa",
            tree: { sha: "basetree00000000000000000000000000000bbbb" }
          })
      },
      // First probe (claude/add-feature): collides with a different sha
      // Second probe (claude/add-feature-1): collides with a different sha
      // Third probe (claude/add-feature-2): 404, free
      // Then a follow-up GET to confirm the chosen branch is still
      // free before we create it: also 404.
      {
        match: (m, p) =>
          m === "GET" && p.startsWith("/repos/octo/demo/git/ref/heads/claude/add-feature"),
        respond: (_m, p) => {
          probeCalls += 1;
          // Return collision for the first two probes; 404 thereafter.
          if (p === "/repos/octo/demo/git/ref/heads/claude/add-feature") {
            return jsonResponse(200, {
              ref: "refs/heads/claude/add-feature",
              object: {
                sha: "deadbeef000000000000000000000000000000ff",
                type: "commit"
              }
            });
          }
          if (p === "/repos/octo/demo/git/ref/heads/claude/add-feature-1") {
            return jsonResponse(200, {
              ref: "refs/heads/claude/add-feature-1",
              object: {
                sha: "deadbeef000000000000000000000000000000aa",
                type: "commit"
              }
            });
          }
          return jsonResponse(404, { message: "Not Found" });
        }
      },
      {
        match: (m, p) => m === "POST" && p === "/repos/octo/demo/git/refs",
        respond: () =>
          jsonResponse(201, {
            ref: "refs/heads/claude/add-feature-2",
            object: { sha: "basesha000000000000000000000000000000aaaa", type: "commit" }
          })
      },
      {
        match: (m, p) => m === "POST" && p === "/repos/octo/demo/git/blobs",
        respond: () => jsonResponse(201, { sha: "blob0000", url: "u" })
      },
      {
        match: (m, p) => m === "POST" && p === "/repos/octo/demo/git/trees",
        respond: () => jsonResponse(201, { sha: "newtree0" })
      },
      {
        match: (m, p) => m === "POST" && p === "/repos/octo/demo/git/commits",
        respond: () => jsonResponse(201, { sha: "commit00", tree: { sha: "newtree0" } })
      },
      {
        match: (m, p) => m === "PATCH" && p.startsWith("/repos/octo/demo/git/refs/heads/"),
        respond: () =>
          jsonResponse(200, {
            ref: "refs/heads/claude/add-feature-2",
            object: { sha: "commit00", type: "commit" }
          })
      },
      {
        match: (m, p) => m === "POST" && p === "/repos/octo/demo/pulls",
        respond: () =>
          jsonResponse(201, {
            html_url: "https://github.com/octo/demo/pull/99",
            number: 99
          })
      }
    ];

    const propose = createProposePr({
      fetchImpl: makeFakeFetch(handlers, requestLog)
    });
    const result = await propose(baseInput());

    expect(result.ok).toBe(true);
    expect(result.headBranch).toBe("claude/add-feature-2");
    expect(probeCalls).toBeGreaterThanOrEqual(3);
    const pickStep = result.log.find((e) => e.step === "pick-head-branch");
    expect(pickStep?.detail).toContain("claude/add-feature-2");
  });
});

function makeStore(
  inner: Map<string, { prUrl: string; prNumber: number }>
): ProposePrIdempotencyStore {
  return {
    async get(key) {
      return inner.get(key);
    },
    async put(key, value) {
      inner.set(key, value);
    }
  };
}

/**
 * propose-pr — agent-authored GitHub pull-request automation.
 *
 * Lives in the deployed-agent runtime so a user's own agent can open
 * PRs against any repo their GitHub token has access to. The platform
 * itself never sees the token.
 *
 * Strategy: rather than shelling out to `git` (the Sandbox-GA isolate
 * doesn't ship it), we drive GitHub's low-level Git Data API — blob /
 * tree / commit / ref. That lets us assemble a single commit with N
 * file writes + M deletions atomically, without any local checkout.
 *
 * The Contents API would have been simpler per-file, but it requires
 * one PUT per file and serializes the SHA chain awkwardly when we want
 * a multi-file commit. Git Data API gives us one commit per call.
 *
 * The Sandbox-GA binding is wired in as an *advisory* pre-check hook —
 * future plans will run `npm test` / linters in the isolate before
 * we publish a PR. Failures there are logged but never block the PR;
 * the orchestrator surfaces them to the user.
 */

export interface PrAuthor {
  name: string;
  email: string;
}

export interface PrTarget {
  owner: string;
  repo: string;
  baseBranch: string;
  /**
   * When set, push the branch to the fork and open the PR
   * cross-repo. The fork is auto-created (idempotent on GitHub's side).
   */
  fork?: { owner: string };
}

export interface ProposePrInput {
  target: PrTarget;
  /** Branch name to create on the head ref. Will be unique-suffixed if needed. */
  headBranch: string;
  /** PR title. */
  title: string;
  /** PR body (markdown). */
  body: string;
  /** Map of repo-relative paths → new file content. */
  files: Record<string, string>;
  /** Files to delete from the head branch, if any. */
  deletePaths?: string[];
  /** GitHub token with repo + workflow scopes. */
  githubToken: string;
  /** Commit author. */
  author: PrAuthor;
  /** Optional commit message; defaults to the title. */
  commitMessage?: string;
}

export interface ProposePrLogEntry {
  step: string;
  status: "ok" | "skipped" | "error";
  detail: string;
}

export interface ProposePrResult {
  ok: boolean;
  prUrl?: string;
  prNumber?: number;
  headBranch: string;
  error?: string;
  /** Run log: each entry is one step (clone, write, commit, push, open). */
  log: ProposePrLogEntry[];
}

export interface ProposePrSandbox {
  run(input: {
    code: string;
    bindings: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<{ stdout: string; exitCode: number }>;
}

export interface ProposePrIdempotencyStore {
  get(key: string): Promise<{ prUrl: string; prNumber: number } | undefined>;
  put(key: string, value: { prUrl: string; prNumber: number }): Promise<void>;
}

export interface ProposePrConfig {
  /** Sandbox binding (same shape as code-mode.ts uses). Optional. */
  sandbox?: ProposePrSandbox;
  /** GitHub API base. Defaults to https://api.github.com. */
  githubApiBase?: string;
  /** Custom fetch (tests inject). */
  fetchImpl?: typeof fetch;
  /**
   * Idempotency hook — if the same (target, headBranch, title) was
   * already opened, return the existing PR instead of opening a
   * duplicate.
   */
  idempotencyStore?: ProposePrIdempotencyStore;
}

const DEFAULT_GITHUB_API = "https://api.github.com";
const MAX_BRANCH_SUFFIX_TRIES = 32;

interface GitRefResponse {
  ref: string;
  object: { sha: string; type: string };
}

interface GitCommitResponse {
  sha: string;
  tree: { sha: string };
}

interface GitBlobResponse {
  sha: string;
  url: string;
}

interface GitTreeResponse {
  sha: string;
}

interface GitNewCommitResponse {
  sha: string;
}

interface GitHubPullResponse {
  html_url: string;
  number: number;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  acceptStatuses?: readonly number[];
}

class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseText: string
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export function createProposePr(
  config: ProposePrConfig
): (input: ProposePrInput) => Promise<ProposePrResult> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const apiBase = (config.githubApiBase ?? DEFAULT_GITHUB_API).replace(/\/+$/, "");
  const sandbox = config.sandbox;
  const idempotencyStore = config.idempotencyStore;

  async function request<T>(
    token: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<{ data: T; status: number }> {
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "openthink2-propose-pr"
    };
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    const response = await fetchImpl(`${apiBase}${path}`, init);
    const text = await response.text();
    const allowed = options.acceptStatuses;
    const ok =
      (response.status >= 200 && response.status < 300) ||
      (allowed !== undefined && allowed.includes(response.status));
    if (!ok) {
      throw new GitHubApiError(
        `GitHub ${method} ${path} failed with ${response.status}`,
        response.status,
        text
      );
    }
    let data: unknown = undefined;
    if (text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { data: data as T, status: response.status };
  }

  async function tryGetRef(
    token: string,
    owner: string,
    repo: string,
    branch: string
  ): Promise<GitRefResponse | undefined> {
    const { data, status } = await request<GitRefResponse>(
      token,
      `/repos/${enc(owner)}/${enc(repo)}/git/ref/heads/${encBranch(branch)}`,
      { acceptStatuses: [404] }
    );
    if (status === 404) return undefined;
    return data;
  }

  async function ensureFork(
    token: string,
    upstreamOwner: string,
    repo: string,
    forkOwner: string
  ): Promise<void> {
    // POST /repos/{owner}/{repo}/forks is idempotent: returns 202 if a
    // fork already exists for the authenticated user. We don't need
    // forkOwner for the call itself — it's reserved for the future
    // case where we fork into an org.
    void forkOwner;
    await request<unknown>(
      token,
      `/repos/${enc(upstreamOwner)}/${enc(repo)}/forks`,
      { method: "POST", acceptStatuses: [202] }
    );
  }

  /** Hash the idempotency key with crypto.subtle.digest (Workers global). */
  async function hashTitle(title: string): Promise<string> {
    const bytes = new TextEncoder().encode(title);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return bufferToHex(digest);
  }

  function idempotencyKey(
    target: PrTarget,
    headBranch: string,
    titleHash: string
  ): string {
    return `${target.owner}/${target.repo}#${headBranch}#${titleHash}`;
  }

  return async function proposePr(input: ProposePrInput): Promise<ProposePrResult> {
    const log: ProposePrLogEntry[] = [];
    const finalize = (
      ok: boolean,
      headBranch: string,
      extras: Partial<ProposePrResult> = {}
    ): ProposePrResult => {
      const result: ProposePrResult = { ok, headBranch, log };
      if (extras.prUrl !== undefined) result.prUrl = extras.prUrl;
      if (extras.prNumber !== undefined) result.prNumber = extras.prNumber;
      if (extras.error !== undefined) result.error = extras.error;
      return result;
    };

    // ----- Step 0: idempotency cache lookup -----
    let cacheKey: string | undefined;
    if (idempotencyStore) {
      try {
        const titleHash = await hashTitle(input.title);
        cacheKey = idempotencyKey(input.target, input.headBranch, titleHash);
        const cached = await idempotencyStore.get(cacheKey);
        if (cached) {
          log.push({
            step: "idempotency-cache",
            status: "ok",
            detail: `cache hit: ${cached.prUrl}`
          });
          return finalize(true, input.headBranch, {
            prUrl: cached.prUrl,
            prNumber: cached.prNumber
          });
        }
        log.push({
          step: "idempotency-cache",
          status: "skipped",
          detail: "no cached PR for this (target, branch, title)"
        });
      } catch (error) {
        log.push({
          step: "idempotency-cache",
          status: "error",
          detail: stringifyError(error)
        });
        // continue — cache failures must never block PR creation
      }
    }

    // ----- Step 1: sandbox pre-checks (advisory only) -----
    // Pre-checks are advisory: failures here are logged but do not
    // block PR creation. We still run them so the orchestrator can
    // surface lint/test results in the PR body or as a separate
    // notification.
    if (sandbox) {
      try {
        await sandbox.run({
          code: "/* propose-pr sandbox pre-check hook (no-op) */",
          bindings: { files: input.files },
          timeoutMs: 5_000
        });
        log.push({
          step: "sandbox-pre-checks",
          status: "ok",
          detail: "sandbox pre-check hook completed"
        });
      } catch (error) {
        log.push({
          step: "sandbox-pre-checks",
          status: "error",
          detail: `advisory failure: ${stringifyError(error)}`
        });
        // intentionally do not return — see comment above
      }
    } else {
      log.push({
        step: "sandbox-pre-checks",
        status: "skipped",
        detail: "no sandbox binding configured"
      });
    }

    const token = input.githubToken;
    const headOwner = input.target.fork?.owner ?? input.target.owner;
    const repo = input.target.repo;

    let baseSha: string;
    let baseTreeSha: string;

    // ----- Step 2: resolve base branch SHA on the upstream -----
    try {
      const baseRef = await tryGetRef(
        token,
        input.target.owner,
        repo,
        input.target.baseBranch
      );
      if (!baseRef) {
        const detail = `base branch '${input.target.baseBranch}' not found on ${input.target.owner}/${repo}`;
        log.push({ step: "resolve-base", status: "error", detail });
        return finalize(false, input.headBranch, { error: detail });
      }
      baseSha = baseRef.object.sha;
      log.push({
        step: "resolve-base",
        status: "ok",
        detail: `base ${input.target.baseBranch}@${shortSha(baseSha)}`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "resolve-base", status: "error", detail });
      return finalize(false, input.headBranch, { error: detail });
    }

    // ----- Step 2.5: fetch base commit's tree SHA (we need it to compose the new tree) -----
    try {
      const { data: baseCommit } = await request<GitCommitResponse>(
        token,
        `/repos/${enc(input.target.owner)}/${enc(repo)}/git/commits/${enc(baseSha)}`
      );
      baseTreeSha = baseCommit.tree.sha;
      log.push({
        step: "resolve-base-tree",
        status: "ok",
        detail: `base tree ${shortSha(baseTreeSha)}`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "resolve-base-tree", status: "error", detail });
      return finalize(false, input.headBranch, { error: detail });
    }

    // ----- Step 3: ensure fork exists if we're pushing to one -----
    if (input.target.fork) {
      try {
        await ensureFork(token, input.target.owner, repo, input.target.fork.owner);
        log.push({
          step: "ensure-fork",
          status: "ok",
          detail: `fork ${input.target.fork.owner}/${repo}`
        });
      } catch (error) {
        const detail = stringifyError(error);
        log.push({ step: "ensure-fork", status: "error", detail });
        return finalize(false, input.headBranch, { error: detail });
      }
    }

    // ----- Step 4: pick a non-colliding head branch name -----
    let headBranch = input.headBranch;
    try {
      let suffix = 0;
      while (suffix < MAX_BRANCH_SUFFIX_TRIES) {
        const candidate = suffix === 0 ? input.headBranch : `${input.headBranch}-${suffix}`;
        const existing = await tryGetRef(token, headOwner, repo, candidate);
        if (!existing) {
          headBranch = candidate;
          break;
        }
        // Branch already exists. If it points at baseSha we could
        // reuse it, but to keep semantics simple we always bump the
        // suffix so we get a clean ref to update.
        if (existing.object.sha === baseSha) {
          headBranch = candidate;
          break;
        }
        suffix += 1;
        headBranch = `${input.headBranch}-${suffix}`;
      }
      if (suffix >= MAX_BRANCH_SUFFIX_TRIES) {
        const detail = `could not find a free branch name within ${MAX_BRANCH_SUFFIX_TRIES} tries (last tried: ${headBranch})`;
        log.push({ step: "pick-head-branch", status: "error", detail });
        return finalize(false, headBranch, { error: detail });
      }
      log.push({
        step: "pick-head-branch",
        status: "ok",
        detail: `head ${headOwner}/${repo}:${headBranch}`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "pick-head-branch", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 5: ensure the branch exists, pointing at baseSha -----
    try {
      const existing = await tryGetRef(token, headOwner, repo, headBranch);
      if (!existing) {
        await request<GitRefResponse>(
          token,
          `/repos/${enc(headOwner)}/${enc(repo)}/git/refs`,
          {
            method: "POST",
            body: { ref: `refs/heads/${headBranch}`, sha: baseSha }
          }
        );
        log.push({
          step: "create-branch",
          status: "ok",
          detail: `created ${headBranch} @ ${shortSha(baseSha)}`
        });
      } else {
        log.push({
          step: "create-branch",
          status: "skipped",
          detail: `${headBranch} already exists @ ${shortSha(existing.object.sha)}`
        });
      }
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "create-branch", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 6: create blobs for each new/changed file -----
    const fileEntries = Object.entries(input.files);
    const blobShas: Array<{ path: string; sha: string }> = [];
    try {
      for (const [path, content] of fileEntries) {
        const { data: blob } = await request<GitBlobResponse>(
          token,
          `/repos/${enc(headOwner)}/${enc(repo)}/git/blobs`,
          {
            method: "POST",
            body: {
              content: base64Encode(content),
              encoding: "base64"
            }
          }
        );
        blobShas.push({ path, sha: blob.sha });
      }
      log.push({
        step: "create-blobs",
        status: fileEntries.length > 0 ? "ok" : "skipped",
        detail:
          fileEntries.length > 0
            ? `created ${fileEntries.length} blob(s)`
            : "no files to write"
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "create-blobs", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 7: assemble a new tree -----
    let newTreeSha: string;
    try {
      const treeEntries: Array<{
        path: string;
        mode: string;
        type: "blob";
        sha: string | null;
      }> = [];
      for (const entry of blobShas) {
        treeEntries.push({
          path: entry.path,
          mode: "100644",
          type: "blob",
          sha: entry.sha
        });
      }
      for (const deletePath of input.deletePaths ?? []) {
        treeEntries.push({
          path: deletePath,
          mode: "100644",
          type: "blob",
          sha: null
        });
      }
      if (treeEntries.length === 0) {
        const detail = "nothing to commit (no files and no deletions)";
        log.push({ step: "create-tree", status: "error", detail });
        return finalize(false, headBranch, { error: detail });
      }
      const { data: tree } = await request<GitTreeResponse>(
        token,
        `/repos/${enc(headOwner)}/${enc(repo)}/git/trees`,
        {
          method: "POST",
          body: {
            base_tree: baseTreeSha,
            tree: treeEntries
          }
        }
      );
      newTreeSha = tree.sha;
      log.push({
        step: "create-tree",
        status: "ok",
        detail: `tree ${shortSha(newTreeSha)} (${treeEntries.length} entries)`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "create-tree", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 8: create the commit -----
    let commitSha: string;
    try {
      const message = input.commitMessage ?? input.title;
      const { data: commit } = await request<GitNewCommitResponse>(
        token,
        `/repos/${enc(headOwner)}/${enc(repo)}/git/commits`,
        {
          method: "POST",
          body: {
            message,
            tree: newTreeSha,
            parents: [baseSha],
            author: {
              name: input.author.name,
              email: input.author.email
            }
          }
        }
      );
      commitSha = commit.sha;
      log.push({
        step: "create-commit",
        status: "ok",
        detail: `commit ${shortSha(commitSha)}`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "create-commit", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 9: update the head ref to point at the new commit -----
    try {
      await request<GitRefResponse>(
        token,
        `/repos/${enc(headOwner)}/${enc(repo)}/git/refs/heads/${encBranch(headBranch)}`,
        {
          method: "PATCH",
          body: { sha: commitSha, force: false }
        }
      );
      log.push({
        step: "update-ref",
        status: "ok",
        detail: `${headBranch} → ${shortSha(commitSha)}`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "update-ref", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 10: open the PR on the upstream -----
    let prUrl: string;
    let prNumber: number;
    try {
      const head = input.target.fork ? `${input.target.fork.owner}:${headBranch}` : headBranch;
      const { data: pr } = await request<GitHubPullResponse>(
        token,
        `/repos/${enc(input.target.owner)}/${enc(repo)}/pulls`,
        {
          method: "POST",
          body: {
            title: input.title,
            body: input.body,
            head,
            base: input.target.baseBranch
          }
        }
      );
      prUrl = pr.html_url;
      prNumber = pr.number;
      log.push({
        step: "open-pr",
        status: "ok",
        detail: `#${prNumber} ${prUrl}`
      });
    } catch (error) {
      const detail = stringifyError(error);
      log.push({ step: "open-pr", status: "error", detail });
      return finalize(false, headBranch, { error: detail });
    }

    // ----- Step 11: persist idempotency entry (best-effort) -----
    if (idempotencyStore && cacheKey) {
      try {
        await idempotencyStore.put(cacheKey, { prUrl, prNumber });
        log.push({
          step: "idempotency-store",
          status: "ok",
          detail: `cached PR #${prNumber}`
        });
      } catch (error) {
        log.push({
          step: "idempotency-store",
          status: "error",
          detail: stringifyError(error)
        });
        // do not fail the overall PR for a cache write error
      }
    }

    return finalize(true, headBranch, { prUrl, prNumber });
  };
}

// ----- helpers -----

function enc(segment: string): string {
  return encodeURIComponent(segment);
}

/**
 * Encode a branch name for a URL path. Slashes inside the branch
 * (e.g. `claude/foo-bar`) must be preserved.
 */
function encBranch(branch: string): string {
  return branch
    .split("/")
    .map((piece) => encodeURIComponent(piece))
    .join("/");
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function stringifyError(error: unknown): string {
  if (error instanceof GitHubApiError) {
    const tail = error.responseText ? ` body=${truncate(error.responseText, 200)}` : "";
    return `${error.message}${tail}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Base64-encode a UTF-8 string. GitHub's blob API expects the file
 * payload to be base64; we always send `encoding: "base64"` so binary
 * content survives the round-trip.
 */
function base64Encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  // btoa is available in Workers + browsers + modern Node.
  return btoa(binary);
}

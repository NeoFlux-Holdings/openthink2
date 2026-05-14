#!/usr/bin/env node
/**
 * Regenerate apps/platform/src/lib/orchestrator-runtime-source.ts.
 *
 * The platform's agent-worker template emits the orchestrator runtime
 * as a sibling file in every generated user-agent bundle so the
 * deployed Worker doesn't depend on the workspace package. The source
 * for that emitted file is held as a giant string constant in
 * orchestrator-runtime-source.ts.
 *
 * Single source of truth: starters/personal-agent/src/orchestrator-runtime.ts
 * (and its transitive `export * from "./x"` imports).
 *
 * Run after editing any module that orchestrator-runtime.ts re-exports
 * from:
 *
 *   node tools/regen-orchestrator-runtime-source.mjs
 *
 * The script:
 *   1. reads orchestrator-runtime.ts
 *   2. follows each `export * from "./<x>"`
 *   3. for each target, reads the module file (and any internal
 *      sub-paths it pulls in, e.g. `./orchestrator/agent`)
 *   4. strips its imports of any module already inlined elsewhere in
 *      the bundle (skills, approval, etc.)
 *   5. concatenates everything into one TS source string and writes
 *      it as the exported constant
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const STARTER_SRC = path.join(repoRoot, "starters/personal-agent/src");
const OUT_FILE = path.join(repoRoot, "apps/platform/src/lib/orchestrator-runtime-source.ts");
const ENTRY = path.join(STARTER_SRC, "orchestrator-runtime.ts");

/**
 * Walk the export * chain. Returns an ordered list of absolute file
 * paths whose contents should be concatenated.
 */
function collectModules(entry) {
  const queue = [entry];
  const seen = new Set();
  const ordered = [];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    ordered.push(file);
    const re = /export\s+\*\s+from\s+["']([^"']+)["'];?/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const target = resolveRelative(file, match[1]);
      if (target) queue.push(target);
    }
  }
  return ordered;
}

function resolveRelative(from, spec) {
  if (!spec.startsWith(".")) return null; // ignore external imports
  const dir = path.dirname(from);
  const candidates = [
    path.join(dir, spec + ".ts"),
    path.join(dir, spec, "index.ts"),
    path.join(dir, spec)
  ];
  for (const c of candidates) {
    if (existsSync(c) && c.endsWith(".ts")) return c;
  }
  return null;
}

/** Strip internal `import`s and `export * from`s (only `./` and `../`
 *  paths) so the inlined bundle doesn't reference modules that no
 *  longer exist as files. */
function stripInternalImports(text) {
  let out = text.replace(/^import\s+[^;]*?\s+from\s+["']\.[^"']+["'];?\s*$/gm, "");
  out = out.replace(/^export\s+\*\s+from\s+["']\.[^"']+["'];?\s*$/gm, "");
  // Also drop named re-exports of internal paths, e.g.
  //   export { foo } from "./bar";
  out = out.replace(/^export\s+\{[^}]*\}\s+from\s+["']\.[^"']+["'];?\s*$/gm, "");
  return out;
}

/** Hoist any `import { z } from "zod"` to a single top-level import.
 *  Strip subsequent duplicates so the bundle compiles. */
function consolidateImports(modules) {
  const externalImports = new Set();
  const cleaned = [];
  for (const m of modules) {
    const text = readFileSync(m, "utf8");
    const stripped = stripInternalImports(text);
    const re = /^import\s+[^;]+?\s+from\s+["']([^."'][^"']*)["'];?\s*$/gm;
    let match;
    while ((match = re.exec(stripped)) !== null) {
      externalImports.add(match[0].trim().replace(/^\s+/, ""));
    }
    const withoutExternal = stripped.replace(re, "");
    cleaned.push({ path: m, body: withoutExternal });
  }
  return { externalImports: Array.from(externalImports), cleaned };
}

function rel(p) {
  return path.relative(repoRoot, p).replace(/\\/g, "/");
}

const modules = collectModules(ENTRY);
const { externalImports, cleaned } = consolidateImports(modules);

const sections = cleaned.map(({ path: p, body }) => {
  return `// === ${rel(p)} ===\n${body.trim()}\n`;
});

const sharedHoist = `
/**
 * Shared Durable Object storage shape used by every internal module.
 * Hoisted to the top so the inlined modules don't redeclare it.
 */
interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}
`.trim();

const bundleHeader = `/**
 * orchestrator-runtime — bundled, standalone runtime module emitted into
 * generated user-agent Workers.
 *
 * Mirrors starters/personal-agent/src/orchestrator-runtime.ts but inlines
 * the source so the deployed Worker bundle does not require a workspace
 * dependency on @open-think/starter-personal-agent.
 *
 * Re-exports: orchestrator (types, store, mcp-rpc, agent), goal, skills,
 * approval, code-mode, executor, evolve, smithery, learning-routes.
 *
 * Do not edit by hand — this file is produced by
 * tools/regen-orchestrator-runtime-source.mjs.
 */`;

const bundleBody = [bundleHeader, externalImports.join("\n"), sharedHoist, ...sections]
  .join("\n\n")
  .replace(/\n{3,}/g, "\n\n");

// Strip internal DoStorageLike redeclarations (the hoisted one wins).
const deduped = bundleBody.replace(
  /interface DoStorageLike\s*\{[^}]*?\n\}\n/g,
  ""
);
// Re-insert the hoisted DoStorageLike once after the imports.
const final = deduped.replace(
  /(import\s+\{[^}]+\}\s+from\s+"zod";\n)/,
  `$1\n${sharedHoist}\n\n`
);

const escaped = final
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\${/g, "\\${");

const out = `// Auto-generated. Do not edit by hand.
// Run \`node tools/regen-orchestrator-runtime-source.mjs\` to regenerate.
// Source: starters/personal-agent/src/orchestrator-runtime.ts and its transitive
//         \`export *\` imports.
//
// This module exports the inlined source text of the orchestrator runtime
// that the agents-sdk-runtime-template emits into generated user-agent
// Workers. Keeping the source as a single TypeScript string constant lets
// the template renderer ship the runtime without taking a workspace
// dependency on @open-think/starter-personal-agent.

export const ORCHESTRATOR_RUNTIME_SOURCE = \`${escaped}\`;
`;

writeFileSync(OUT_FILE, out);
console.log(`Wrote ${rel(OUT_FILE)} from ${modules.length} module(s).`);

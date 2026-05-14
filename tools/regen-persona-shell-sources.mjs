#!/usr/bin/env node
/**
 * Regenerate apps/platform/src/lib/persona-shell-sources.ts.
 *
 * The platform's agent-worker template emits the Persona shell, app
 * wrapper, home, thread feed, and composer as separate TypeScript and
 * CSS files in every deployed user-agent bundle. The source for each
 * one is held as a TypeScript string constant in
 * `apps/platform/src/lib/persona-shell-sources.ts`.
 *
 * Single source of truth: the per-component files under
 *   starters/personal-agent/src/persona-shell.tsx
 *   starters/personal-agent/src/persona-shell.css
 *   starters/personal-agent/src/persona-app.tsx
 *   starters/personal-agent/src/persona-pages/persona-home.tsx
 *   starters/personal-agent/src/persona-pages/persona-thread-feed.tsx
 *   starters/personal-agent/src/persona-pages/persona-composer.tsx
 *   starters/personal-agent/src/persona-pages/persona-pages.css
 *
 * Run after editing any of the above:
 *
 *   node tools/regen-persona-shell-sources.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const STARTER_SRC = path.join(repoRoot, "starters/personal-agent/src");
const OUT_FILE = path.join(repoRoot, "apps/platform/src/lib/persona-shell-sources.ts");

const FILES = [
  { key: "PERSONA_SHELL_TSX", path: "persona-shell.tsx" },
  { key: "PERSONA_SHELL_CSS", path: "persona-shell.css" },
  { key: "PERSONA_APP_TSX", path: "persona-app.tsx" },
  { key: "PERSONA_HOME_TSX", path: "persona-pages/persona-home.tsx" },
  { key: "PERSONA_THREAD_FEED_TSX", path: "persona-pages/persona-thread-feed.tsx" },
  { key: "PERSONA_COMPOSER_TSX", path: "persona-pages/persona-composer.tsx" },
  { key: "PERSONA_PAGES_INDEX_TS", path: "persona-pages/index.ts" },
  { key: "PERSONA_PAGES_CSS", path: "persona-pages/persona-pages.css" }
];

function escape(text) {
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

const exportBlocks = FILES.map(({ key, path: rel }) => {
  const text = readFileSync(path.join(STARTER_SRC, rel), "utf8");
  return `// === Source: starters/personal-agent/src/${rel} ===\nexport const ${key} = \`${escape(text)}\`;\n`;
});

const header = `// Auto-generated. Do not edit by hand.
// Run \`node tools/regen-persona-shell-sources.mjs\` to regenerate.
//
// These string constants hold the source of the Persona UI files that
// the deployed-agent template emits into generated user-agent Workers.
// Keeping the source as compiled-in TypeScript string constants lets
// the template renderer ship the Persona shell without a workspace
// dependency on @open-think/starter-personal-agent at deploy time.

`;

writeFileSync(OUT_FILE, header + exportBlocks.join("\n"));
console.log(`Wrote ${path.relative(repoRoot, OUT_FILE)} from ${FILES.length} file(s).`);

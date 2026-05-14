/**
 * Skill registry — named, reusable, swappable agent capabilities.
 *
 * A skill is a unit of agent know-how: a system-prompt snippet, a set
 * of tool bindings, a markdown playbook, or any combination. Skills can
 * be authored locally, pulled from a curated pack, or learned via
 * train-mode.
 *
 * Built-in packs are loaded from constants in this file. Custom skills
 * are persisted in the agent's Durable Object state via SkillStore.
 */

import { z } from "zod";

export const skillSourceKinds = [
  "builtin",
  "cloudflare",
  "anthropic",
  "openai",
  "ai-hero",
  "user",
  "learned"
] as const;
export type SkillSourceKind = (typeof skillSourceKinds)[number];

export const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.enum(skillSourceKinds),
  description: z.string(),
  enabled: z.boolean().default(true),
  pinned: z.boolean().default(false),
  systemPromptFragment: z.string().optional(),
  toolBindings: z.array(z.string()).default([]),
  knowledgeUrls: z.array(z.string().url()).default([]),
  playbookMarkdown: z.string().optional(),
  tags: z.array(z.string()).default([]),
  version: z.string().default("1.0.0"),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type Skill = z.infer<typeof skillSchema>;

export interface SkillPack {
  id: string;
  label: string;
  source: SkillSourceKind;
  description: string;
  skills: Skill[];
}

const now = () => new Date().toISOString();

const cloudflareSkills: Skill[] = [
  {
    id: "cf.workers-best-practices",
    name: "Cloudflare Workers — best practices",
    source: "cloudflare",
    description:
      "Keep Worker handlers small, externalize state to Durable Objects / KV / D1, prefer streaming, mind isolate startup and the 30s CPU budget.",
    enabled: true,
    pinned: true,
    toolBindings: ["workers.deploy", "wrangler.run"],
    systemPromptFragment:
      "When writing Cloudflare Workers: keep handlers thin, externalize durable state, prefer streaming responses, watch CPU budget, never block the event loop on synchronous work.",
    knowledgeUrls: [
      "https://developers.cloudflare.com/workers/best-practices/workers-best-practices/",
      "https://developers.cloudflare.com/agents/",
      "https://developers.cloudflare.com/workflows/build/events-and-parameters/"
    ],
    tags: ["cloudflare", "workers", "infrastructure"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "cf.agents-sdk",
    name: "Cloudflare Agents SDK",
    source: "cloudflare",
    description:
      "Use the Agents SDK Agent / McpAgent classes, addMcpServer for in-worker RPC, and stateful Durable Objects for thread state.",
    enabled: true,
    pinned: true,
    knowledgeUrls: [
      "https://github.com/cloudflare/agents",
      "https://github.com/cloudflare/agents-starter",
      "https://developers.cloudflare.com/agents/api-reference/sub-agents/"
    ],
    toolBindings: ["agents.spawn", "agents.message"],
    tags: ["cloudflare", "agents", "mcp"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "cf.mcp-toolkit",
    name: "Cloudflare MCP toolkit",
    source: "cloudflare",
    description:
      "Build MCP servers on Workers with the cloudflare/mcp toolkit. Prefer RPC transport for same-Worker traffic, Streamable HTTP for cross-account.",
    enabled: true,
    pinned: false,
    toolBindings: [],
    knowledgeUrls: ["https://github.com/cloudflare/mcp", "https://blog.cloudflare.com/code-mode-mcp/"],
    tags: ["cloudflare", "mcp"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  }
];

const anthropicSkills: Skill[] = [
  {
    id: "anthropic.tool-use",
    name: "Anthropic tool-use patterns",
    source: "anthropic",
    description: "Best practices for Claude tool-use: tight schemas, idempotent tools, retry-on-shape-mismatch.",
    enabled: true,
    pinned: false,
    toolBindings: [],
    knowledgeUrls: ["https://github.com/anthropics/skills"],
    tags: ["anthropic", "tool-use"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "anthropic.coding",
    name: "Anthropic — coding playbook",
    source: "anthropic",
    description:
      "Iterative coding: read before edit, prefer Edit over Write, keep comments minimal, run tests before claiming done.",
    enabled: true,
    pinned: false,
    toolBindings: [],
    knowledgeUrls: ["https://github.com/anthropics/skills"],
    tags: ["anthropic", "coding"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  }
];

const openaiSkills: Skill[] = [
  {
    id: "openai.self-evolving",
    name: "OpenAI self-evolving agents",
    source: "openai",
    description:
      "Autonomous retraining loop: collect run traces, score outcomes, summarize wins/regressions, propose prompt+skill updates.",
    enabled: false,
    pinned: false,
    toolBindings: [],
    knowledgeUrls: [
      "https://developers.openai.com/cookbook/examples/partners/self_evolving_agents/autonomous_agent_retraining",
      "https://github.com/openai/skills"
    ],
    tags: ["openai", "evolve", "training"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  }
];

const aiHeroSkills: Skill[] = [
  {
    id: "ai-hero.starter",
    name: "AI Hero — starter skill pack",
    source: "ai-hero",
    description: "Curated starter playbooks for research, summarization, transcription, and ETL flows.",
    enabled: false,
    pinned: false,
    toolBindings: [],
    knowledgeUrls: ["https://www.aihero.dev/skills.md"],
    tags: ["ai-hero", "starter"],
    version: "1.0.0",
    createdAt: now(),
    updatedAt: now()
  }
];

export const builtinSkillPacks: SkillPack[] = [
  {
    id: "cloudflare",
    label: "Cloudflare",
    source: "cloudflare",
    description: "Cloudflare Workers, Agents SDK, MCP, and platform best practices — preloaded by default.",
    skills: cloudflareSkills
  },
  {
    id: "anthropic",
    label: "Anthropic",
    source: "anthropic",
    description: "Anthropic-curated agent skills (tool-use, coding playbooks).",
    skills: anthropicSkills
  },
  {
    id: "openai",
    label: "OpenAI",
    source: "openai",
    description: "OpenAI-curated agent skills (self-evolving loop).",
    skills: openaiSkills
  },
  {
    id: "ai-hero",
    label: "AI Hero",
    source: "ai-hero",
    description: "Community-curated AI Hero starter pack.",
    skills: aiHeroSkills
  }
];

export interface SkillStore {
  list(): Promise<Skill[]>;
  get(id: string): Promise<Skill | null>;
  put(skill: Skill): Promise<Skill>;
  remove(id: string): Promise<void>;
  preload(packIds: string[]): Promise<void>;
}

export function buildSystemPromptFromSkills(skills: Skill[]): string {
  const enabled = skills.filter((s) => s.enabled && s.systemPromptFragment);
  if (enabled.length === 0) return "";
  const lines = ["# Active skills"];
  for (const skill of enabled) {
    lines.push(`## ${skill.name}`);
    lines.push(skill.systemPromptFragment!);
    lines.push("");
  }
  return lines.join("\n");
}

export function flattenPacks(packs: SkillPack[]): Skill[] {
  return packs.flatMap((pack) => pack.skills);
}

export function defaultPreloadPackIds(): string[] {
  // Cloudflare loads by default for everyone; the rest are opt-in.
  return ["cloudflare"];
}

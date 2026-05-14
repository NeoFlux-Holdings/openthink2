/**
 * The evolve loop. Reads recent RunTraces, asks the model to summarize
 * wins, regressions, and learnable patterns, and emits suggestions for
 * the user (or auto-applies them in auto-evolve mode).
 *
 * Designed to be invoked from a cron trigger or via /goal evolve.
 */

import type { OrchestratorTrainingMode } from "../orchestrator/types";
import type { Skill } from "../skills/registry";
import type {
  EvolveSuggestion,
  PromptSuggestion,
  RubricSuggestion,
  RunTrace,
  SkillSuggestion
} from "./types";

export interface EvolveInputs {
  traces: RunTrace[];
  existingSkills: Skill[];
  trainingMode: OrchestratorTrainingMode;
  llm: {
    summarize(args: {
      system: string;
      user: string;
    }): Promise<string>;
  };
}

const SYSTEM_PROMPT = `You are an agent retraining auditor. Given a batch
of run traces, identify three things:

  1. Patterns the agent should turn into a reusable skill (with a clean
     system-prompt fragment and which tools to bind).
  2. Quality rubrics that would have caught failures earlier.
  3. Prompt edits — what to keep, what to drop, what to clarify.

Return a JSON object with keys: skills, rubrics, prompts. Each value is
an array. Skip the surrounding markdown fence.`;

export async function runEvolveLoop(inputs: EvolveInputs): Promise<EvolveSuggestion[]> {
  if (inputs.traces.length === 0) return [];

  const userPrompt = JSON.stringify(
    {
      existingSkills: inputs.existingSkills.map((s) => ({
        id: s.id,
        name: s.name,
        systemPromptFragment: s.systemPromptFragment
      })),
      traces: inputs.traces.map((t) => ({
        id: t.id,
        goal: t.goal,
        toolsUsed: t.toolsUsed,
        outcome: t.outcome,
        userFeedback: t.userFeedback,
        notes: t.notes
      }))
    },
    null,
    2
  );

  const raw = await inputs.llm.summarize({ system: SYSTEM_PROMPT, user: userPrompt });
  const parsed = safeParse(raw);
  if (!parsed) return [];

  const evidenceIds = inputs.traces.map((t) => t.id);

  const skills: SkillSuggestion[] = (parsed.skills ?? []).map(
    (s: Partial<SkillSuggestion>, i: number) => ({
      id: `sug-skill-${Date.now()}-${i}`,
      kind: "skill",
      name: s.name ?? `Learned skill ${i + 1}`,
      summary: s.summary ?? "",
      systemPromptFragment: s.systemPromptFragment ?? "",
      toolBindings: s.toolBindings ?? [],
      evidenceTraceIds: evidenceIds,
      confidence: typeof s.confidence === "number" ? clamp01(s.confidence) : 0.5,
      status: "pending"
    })
  );

  const rubrics: RubricSuggestion[] = (parsed.rubrics ?? []).map(
    (r: Partial<RubricSuggestion>, i: number) => ({
      id: `sug-rubric-${Date.now()}-${i}`,
      kind: "rubric",
      name: r.name ?? `Learned rubric ${i + 1}`,
      criteria: r.criteria ?? [],
      evidenceTraceIds: evidenceIds,
      confidence: typeof r.confidence === "number" ? clamp01(r.confidence) : 0.5,
      status: "pending"
    })
  );

  const prompts: PromptSuggestion[] = (parsed.prompts ?? []).map(
    (p: Partial<PromptSuggestion>, i: number) => ({
      id: `sug-prompt-${Date.now()}-${i}`,
      kind: "prompt",
      scope: p.scope ?? "orchestrator",
      before: p.before ?? "",
      after: p.after ?? "",
      rationale: p.rationale ?? "",
      evidenceTraceIds: evidenceIds,
      confidence: typeof p.confidence === "number" ? clamp01(p.confidence) : 0.5,
      status: "pending"
    })
  );

  const all: EvolveSuggestion[] = [...skills, ...rubrics, ...prompts];

  // In auto-evolve mode, mark high-confidence + low-blast-radius
  // suggestions as applied. Anything touching workspace-scoped prompts
  // or money-adjacent tools stays pending.
  if (inputs.trainingMode === "auto-evolve") {
    for (const sug of all) {
      const safe = sug.confidence >= 0.8 && !blastRadiusHigh(sug);
      if (safe) sug.status = "applied";
    }
  }

  return all;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function blastRadiusHigh(sug: EvolveSuggestion): boolean {
  if (sug.kind === "prompt" && sug.scope === "workspace") return true;
  if (sug.kind === "skill") {
    return sug.toolBindings.some((t) => /stripe|billing|payments|dns|access/.test(t));
  }
  return false;
}

function safeParse(raw: string): { skills?: unknown[]; rubrics?: unknown[]; prompts?: unknown[] } | null {
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    return JSON.parse(trimmed) as { skills?: unknown[]; rubrics?: unknown[]; prompts?: unknown[] };
  } catch {
    return null;
  }
}

/**
 * Self-evolve / train mode types.
 *
 * Closely follows the OpenAI cookbook pattern at
 * https://developers.openai.com/cookbook/examples/partners/self_evolving_agents/autonomous_agent_retraining
 *
 * Lifecycle:
 *   1. The agent runs as usual; each turn logs a RunTrace.
 *   2. Periodically (cron or user-triggered) the evolve loop reviews
 *      traces, scores outcomes, and emits SkillSuggestions /
 *      RubricSuggestions / PromptSuggestions.
 *   3. Suggestions land in the Learning page for user review.
 *   4. In auto-evolve training mode, low-risk suggestions auto-apply.
 */

export interface RunTrace {
  id: string;
  threadId: string;
  agentId: string;
  startedAt: string;
  endedAt?: string;
  goal: string;
  toolsUsed: string[];
  outcome: "success" | "partial" | "failure" | "abandoned";
  selfScore?: number;
  userFeedback?: "thumbs-up" | "thumbs-down" | "edit" | undefined;
  notes?: string;
}

export interface SkillSuggestion {
  id: string;
  kind: "skill";
  name: string;
  summary: string;
  systemPromptFragment: string;
  toolBindings: string[];
  evidenceTraceIds: string[];
  confidence: number;
  status: "pending" | "applied" | "rejected";
}

export interface RubricSuggestion {
  id: string;
  kind: "rubric";
  name: string;
  criteria: { name: string; weight: number; description: string }[];
  evidenceTraceIds: string[];
  confidence: number;
  status: "pending" | "applied" | "rejected";
}

export interface PromptSuggestion {
  id: string;
  kind: "prompt";
  scope: "orchestrator" | "child" | "workspace";
  before: string;
  after: string;
  rationale: string;
  evidenceTraceIds: string[];
  confidence: number;
  status: "pending" | "applied" | "rejected";
}

export type EvolveSuggestion = SkillSuggestion | RubricSuggestion | PromptSuggestion;

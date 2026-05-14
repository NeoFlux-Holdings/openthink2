/**
 * Orchestrator agent — the workspace-level "always-on" agent.
 *
 * Owns:
 *   - the user's main thread feed
 *   - shared memory (Vectorize) read/write coordination
 *   - dispatch to child specialist agents over RPC MCP
 *   - the "working doc" / current-context summary that survives compaction
 *   - the global to-do / project board across threads
 *
 * Implemented as a thin convention layer on top of the Cloudflare
 * Agents SDK Agent class. The actual class lives in agents-sdk.ts so
 * Durable Object bindings stay co-located with the rest of the runtime.
 */

import type {
  AgentDescriptor,
  OrchestratorTrainingMode,
  WorkspaceDescriptor
} from "./types";

export interface OrchestratorContextSnapshot {
  workspaceId: string;
  activeThreadId: string | undefined;
  recentThreadIds: string[];
  workingDoc: string;
  goals: { id: string; title: string; status: "active" | "done" | "blocked"; updatedAt: string }[];
  trainingMode: OrchestratorTrainingMode;
  pinnedSkillIds: string[];
  childAgents: { id: string; name: string; status: "idle" | "running" | "blocked" }[];
}

export interface OrchestratorStateStore {
  getWorkspace(): Promise<WorkspaceDescriptor>;
  setWorkspace(patch: Partial<WorkspaceDescriptor>): Promise<WorkspaceDescriptor>;
  getContext(): Promise<OrchestratorContextSnapshot>;
  setWorkingDoc(text: string): Promise<void>;
  setActiveThread(threadId: string | undefined): Promise<void>;
  recordChildStatus(childId: string, status: "idle" | "running" | "blocked"): Promise<void>;
  upsertGoal(goal: OrchestratorContextSnapshot["goals"][number]): Promise<void>;
  listChildren(): Promise<AgentDescriptor[]>;
  upsertChild(descriptor: AgentDescriptor): Promise<AgentDescriptor>;
  removeChild(childId: string): Promise<void>;
}

const KEY = {
  workspace: "ws:descriptor",
  workingDoc: "ws:workingDoc",
  activeThread: "ws:activeThread",
  recentThreads: "ws:recentThreads",
  goals: "ws:goals",
  childStatuses: "ws:childStatuses",
  childPrefix: "child:"
} as const;

interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

export function createOrchestratorStore(
  storage: DoStorageLike,
  bootstrap: { workspaceId: string; ownerEmail: string }
): OrchestratorStateStore {
  return {
    async getWorkspace() {
      const existing = await storage.get<WorkspaceDescriptor>(KEY.workspace);
      if (existing) return existing;
      const fresh: WorkspaceDescriptor = {
        id: bootstrap.workspaceId,
        name: "Default workspace",
        ownerEmail: bootstrap.ownerEmail,
        orchestratorId: "orchestrator-" + bootstrap.workspaceId,
        childAgentIds: [],
        trainingMode: "review",
        defaultModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        createdAt: new Date().toISOString()
      };
      await storage.put(KEY.workspace, fresh);
      return fresh;
    },
    async setWorkspace(patch) {
      const current = await this.getWorkspace();
      const next = { ...current, ...patch };
      await storage.put(KEY.workspace, next);
      return next;
    },
    async getContext() {
      const ws = await this.getWorkspace();
      const workingDoc = (await storage.get<string>(KEY.workingDoc)) ?? "";
      const activeThread = await storage.get<string>(KEY.activeThread);
      const recent = (await storage.get<string[]>(KEY.recentThreads)) ?? [];
      const goals =
        (await storage.get<OrchestratorContextSnapshot["goals"]>(KEY.goals)) ?? [];
      const statuses =
        (await storage.get<Record<string, "idle" | "running" | "blocked">>(KEY.childStatuses)) ??
        {};
      const children = await this.listChildren();
      return {
        workspaceId: ws.id,
        activeThreadId: activeThread,
        recentThreadIds: recent.slice(0, 7),
        workingDoc,
        goals,
        trainingMode: ws.trainingMode,
        pinnedSkillIds: [],
        childAgents: children.map((c) => ({
          id: c.id,
          name: c.name,
          status: statuses[c.id] ?? "idle"
        }))
      };
    },
    async setWorkingDoc(text) {
      await storage.put(KEY.workingDoc, text);
    },
    async setActiveThread(threadId) {
      if (threadId) await storage.put(KEY.activeThread, threadId);
      else await storage.delete(KEY.activeThread);
      const recent = (await storage.get<string[]>(KEY.recentThreads)) ?? [];
      if (threadId && !recent.includes(threadId)) {
        const next = [threadId, ...recent].slice(0, 14);
        await storage.put(KEY.recentThreads, next);
      }
    },
    async recordChildStatus(childId, status) {
      const statuses =
        (await storage.get<Record<string, "idle" | "running" | "blocked">>(KEY.childStatuses)) ??
        {};
      statuses[childId] = status;
      await storage.put(KEY.childStatuses, statuses);
    },
    async upsertGoal(goal) {
      const goals =
        (await storage.get<OrchestratorContextSnapshot["goals"]>(KEY.goals)) ?? [];
      const i = goals.findIndex((g) => g.id === goal.id);
      if (i === -1) goals.unshift(goal);
      else goals[i] = goal;
      await storage.put(KEY.goals, goals.slice(0, 50));
    },
    async listChildren() {
      const map = await storage.list<AgentDescriptor>({ prefix: KEY.childPrefix });
      return Array.from(map.values());
    },
    async upsertChild(descriptor) {
      await storage.put(KEY.childPrefix + descriptor.id, descriptor);
      const ws = await this.getWorkspace();
      if (!ws.childAgentIds.includes(descriptor.id)) {
        await this.setWorkspace({ childAgentIds: [...ws.childAgentIds, descriptor.id] });
      }
      return descriptor;
    },
    async removeChild(childId) {
      await storage.delete(KEY.childPrefix + childId);
      const ws = await this.getWorkspace();
      await this.setWorkspace({
        childAgentIds: ws.childAgentIds.filter((id) => id !== childId)
      });
    }
  };
}

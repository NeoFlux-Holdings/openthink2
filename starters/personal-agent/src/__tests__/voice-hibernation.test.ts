import { describe, expect, it } from "vitest";
import {
  attachConnectionMetadata,
  patchConnectionMetadata,
  readConnectionMetadata,
  supportsHibernation
} from "../hibernation";
import {
  buildVoiceAttachment,
  buildVoiceTurnHandler,
  clampVoiceSettings,
  defaultVoiceSettings
} from "../voice";
import type { OrchestratorRuntime, OrchestratorEnvBase } from "../orchestrator/agent";

function makeFakeWebSocket() {
  let attachment: unknown = null;
  return {
    serializeAttachment(value: unknown) {
      attachment = value;
    },
    deserializeAttachment() {
      return attachment;
    }
  };
}

describe("hibernation attachment", () => {
  it("supportsHibernation detects the API surface", () => {
    expect(supportsHibernation(makeFakeWebSocket())).toBe(true);
    expect(supportsHibernation({})).toBe(false);
    expect(supportsHibernation(null)).toBe(false);
  });

  it("attach + read round-trips metadata", () => {
    const ws = makeFakeWebSocket();
    attachConnectionMetadata(ws, {
      workspaceId: "ws-1",
      threadId: "thread-42",
      ownerEmail: "ada@example.com"
    });
    const meta = readConnectionMetadata(ws);
    expect(meta?.workspaceId).toBe("ws-1");
    expect(meta?.threadId).toBe("thread-42");
    expect(meta?.attachedAt).toBeTypeOf("string");
  });

  it("patch merges fields without dropping the existing ones", () => {
    const ws = makeFakeWebSocket();
    attachConnectionMetadata(ws, {
      workspaceId: "ws-1",
      ownerEmail: "ada@example.com",
      extras: { lastMessageId: "m1" }
    });
    patchConnectionMetadata(ws, { threadId: "thread-7", extras: { model: "kimi" } });
    const meta = readConnectionMetadata(ws);
    expect(meta?.workspaceId).toBe("ws-1");
    expect(meta?.ownerEmail).toBe("ada@example.com");
    expect(meta?.threadId).toBe("thread-7");
    expect(meta?.extras).toEqual({ lastMessageId: "m1", model: "kimi" });
  });

  it("read returns null when the attachment isn't ours", () => {
    const ws = makeFakeWebSocket();
    ws.serializeAttachment({ foo: "bar" });
    expect(readConnectionMetadata(ws)).toBeNull();
  });
});

describe("voice settings clamp", () => {
  it("falls back to defaults for missing keys", () => {
    expect(clampVoiceSettings({})).toEqual(defaultVoiceSettings);
  });

  it("clamps numeric ranges and rejects unknown audio formats", () => {
    const clamped = clampVoiceSettings({
      silenceThreshold: 5,
      silenceDurationMs: 50,
      interruptThreshold: -1,
      interruptChunks: 99,
      historyLimit: 200,
      audioFormat: "flac" as unknown as "mp3"
    });
    expect(clamped.silenceThreshold).toBe(1);
    expect(clamped.silenceDurationMs).toBe(100);
    expect(clamped.interruptThreshold).toBe(0);
    expect(clamped.interruptChunks).toBe(10);
    expect(clamped.historyLimit).toBe(100);
    expect(clamped.audioFormat).toBe("mp3");
  });
});

describe("buildVoiceAttachment", () => {
  it("packs the workspace + thread + voice settings", () => {
    const runtime = {
      env: {
        OPEN_THINK_WORKSPACE_ID: "ws-9",
        OPEN_THINK_OWNER_EMAIL: "ada@example.com"
      } as OrchestratorEnvBase
    } as unknown as OrchestratorRuntime<OrchestratorEnvBase>;
    const attachment = buildVoiceAttachment(runtime, "thread-3", defaultVoiceSettings);
    expect(attachment).toEqual({
      workspaceId: "ws-9",
      threadId: "thread-3",
      ownerEmail: "ada@example.com",
      voiceSettings: defaultVoiceSettings
    });
  });
});

describe("buildVoiceTurnHandler", () => {
  it("intercepts /goal commands without calling the LLM", async () => {
    const llm = {
      async stream() {
        throw new Error("should not be called");
      }
    };
    const goals: { id: string; title: string; status: "active"; updatedAt: string }[] = [];
    const runtime = {
      env: {} as OrchestratorEnvBase,
      skills: { async list() { return []; } },
      store: { async getContext() { return { workingDoc: "", goals: [] }; } },
      approval: { async get() { return { mode: "smart-auto" as const, spend: { kind: "cap-per-task" as const }, alwaysAllow: [], neverAllow: [] }; } },
      goals: {
        async list() { return goals; },
        async upsert(record: { id: string; title: string; status: "active"; updatedAt: string }) {
          goals.push(record);
          return record;
        }
      }
    } as unknown as OrchestratorRuntime<OrchestratorEnvBase>;
    const handler = buildVoiceTurnHandler({ runtime, llm });
    const result = await handler("/goal Ship voice", {
      connection: {},
      messages: [],
      signal: new AbortController().signal
    });
    const chunks: string[] = [];
    for await (const chunk of result) chunks.push(chunk);
    expect(chunks.join("")).toContain("Goal set");
    expect(goals.length).toBe(1);
  });

  it("aborts the stream when the signal fires", async () => {
    const controller = new AbortController();
    const llm = {
      async stream() {
        async function* gen() {
          yield "one";
          yield "two";
          yield "three";
        }
        return gen();
      }
    };
    const runtime = {
      env: {} as OrchestratorEnvBase,
      skills: { async list() { return []; } },
      store: { async getContext() { return { workingDoc: "", goals: [] }; } },
      approval: { async get() { return { mode: "smart-auto" as const, spend: { kind: "cap-per-task" as const }, alwaysAllow: [], neverAllow: [] }; } },
      goals: { async list() { return []; }, async upsert(r: never) { return r; } }
    } as unknown as OrchestratorRuntime<OrchestratorEnvBase>;
    const handler = buildVoiceTurnHandler({ runtime, llm });
    const result = await handler("plain question", {
      connection: {},
      messages: [],
      signal: controller.signal
    });
    const chunks: string[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
      if (chunks.length === 1) controller.abort();
    }
    expect(chunks).toEqual(["one"]);
  });
});

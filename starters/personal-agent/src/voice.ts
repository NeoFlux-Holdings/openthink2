/**
 * Voice agent — wires Cloudflare's @cloudflare/voice into the
 * openthink2 orchestrator.
 *
 * Architecture:
 *
 *   [Browser]                                [Worker]
 *   useVoiceAgent  ──── WebSocket ───▶  VoiceAgent extends withVoice(Agent)
 *      • mic capture                        • Workers AI STT (transcribe)
 *      • audio playback                     • orchestrator.onTurn(text)
 *      • interim transcript                 • Workers AI TTS (speak)
 *      • interrupt detection                • interruption / mute / end
 *
 * The voice agent reuses the orchestrator runtime — same skills,
 * approval modes, working doc, /goal handler. Voice is just an
 * alternate input/output channel.
 *
 * v0.12.4 Voice connection control: the client passes `enabled: false`
 * until mic permission is granted, so the WebSocket only opens once
 * the user has actually consented to record audio.
 */

import type { OrchestratorRuntime, OrchestratorEnvBase } from "./orchestrator/agent";
import { buildOrchestratorSystemPrompt, handleSlashCommand } from "./orchestrator/agent";

/** Minimal shape of the connection handle @cloudflare/voice gives us. */
export interface VoiceConnectionLike {
  id?: string;
  send?(message: string | ArrayBuffer): void;
}

export interface VoiceTurnContextLike {
  connection: VoiceConnectionLike;
  messages: { role: string; content: string }[];
  signal: AbortSignal;
}

export interface VoiceTurnLLM {
  /** Stream a completion as `AsyncIterable<string>` so withVoice can
   *  start the TTS pipe before the model is done. */
  stream(input: { system: string; messages: { role: string; content: string }[] }): Promise<AsyncIterable<string>>;
}

export interface VoiceTurnHandlerInput<TEnv extends OrchestratorEnvBase> {
  runtime: OrchestratorRuntime<TEnv>;
  llm: VoiceTurnLLM;
}

/**
 * Build the onTurn handler the VoiceAgent class will use. Separates
 * the wiring from the Agents SDK subclassing so the same logic can
 * be exercised in unit tests without instantiating an Agent.
 */
export function buildVoiceTurnHandler<TEnv extends OrchestratorEnvBase>(
  input: VoiceTurnHandlerInput<TEnv>
): (transcript: string, ctx: VoiceTurnContextLike) => Promise<AsyncIterable<string>> {
  return async (transcript, ctx) => {
    // /goal works inside voice too — handle the command before the
    // text reaches the model.
    const slash = await handleSlashCommand(transcript, input.runtime);
    if (slash.handled && slash.message) {
      return stringToAsyncIterable(slash.message);
    }

    const system = await buildOrchestratorSystemPrompt(input.runtime);
    const messages = [...ctx.messages, { role: "user", content: transcript }];

    const stream = await input.llm.stream({ system, messages });
    return abortableStream(stream, ctx.signal);
  };
}

async function* stringToAsyncIterable(text: string): AsyncIterable<string> {
  yield text;
}

async function* abortableStream(
  stream: AsyncIterable<string>,
  signal: AbortSignal
): AsyncIterable<string> {
  for await (const chunk of stream) {
    if (signal.aborted) return;
    yield chunk;
  }
}

/**
 * Pipeline tuning that maps to the @cloudflare/voice client + server
 * options. Surfaced on the Settings page so users can dial it in for
 * their environment.
 */
export interface VoicePipelineSettings {
  /** Microphone volume below which is considered silence. */
  silenceThreshold: number;
  /** How long silence must persist before the turn closes. */
  silenceDurationMs: number;
  /** Volume that triggers a user interruption mid-speech. */
  interruptThreshold: number;
  /** How many consecutive interrupt-loud chunks before we accept. */
  interruptChunks: number;
  /** Cap conversation history sent to the model. */
  historyLimit: number;
  /** Audio format produced by the TTS step. */
  audioFormat: "mp3" | "wav" | "opus";
}

export const defaultVoiceSettings: VoicePipelineSettings = {
  silenceThreshold: 0.04,
  silenceDurationMs: 500,
  interruptThreshold: 0.05,
  interruptChunks: 2,
  historyLimit: 20,
  audioFormat: "mp3"
};

/** Validation guard surfaced in the client + server: keeps settings
 *  inside the ranges @cloudflare/voice will accept. */
export function clampVoiceSettings(input: Partial<VoicePipelineSettings>): VoicePipelineSettings {
  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  return {
    silenceThreshold: clamp(input.silenceThreshold ?? defaultVoiceSettings.silenceThreshold, 0, 1),
    silenceDurationMs: clamp(
      input.silenceDurationMs ?? defaultVoiceSettings.silenceDurationMs,
      100,
      5000
    ),
    interruptThreshold: clamp(
      input.interruptThreshold ?? defaultVoiceSettings.interruptThreshold,
      0,
      1
    ),
    interruptChunks: clamp(input.interruptChunks ?? defaultVoiceSettings.interruptChunks, 1, 10),
    historyLimit: clamp(input.historyLimit ?? defaultVoiceSettings.historyLimit, 1, 100),
    audioFormat: (["mp3", "wav", "opus"] as const).includes(
      (input.audioFormat ?? defaultVoiceSettings.audioFormat) as "mp3" | "wav" | "opus"
    )
      ? (input.audioFormat ?? defaultVoiceSettings.audioFormat)
      : defaultVoiceSettings.audioFormat
  };
}

/**
 * Hibernation attachment for the voice connection: when the agent's
 * Durable Object hibernates, the per-connection workspace + thread
 * id is preserved via `serializeAttachment` so reconnection lands in
 * the same context. The attachment must be JSON-serialisable.
 */
export interface VoiceConnectionAttachment {
  workspaceId: string;
  threadId?: string;
  ownerEmail?: string;
  voiceSettings: VoicePipelineSettings;
}

export function buildVoiceAttachment(
  runtime: OrchestratorRuntime<OrchestratorEnvBase>,
  threadId: string | undefined,
  voiceSettings: VoicePipelineSettings
): VoiceConnectionAttachment {
  const ws = (runtime.env.OPEN_THINK_WORKSPACE_ID as string | undefined) ?? "default";
  const att: VoiceConnectionAttachment = {
    workspaceId: ws,
    voiceSettings
  };
  if (threadId) att.threadId = threadId;
  if (runtime.env.OPEN_THINK_OWNER_EMAIL) att.ownerEmail = String(runtime.env.OPEN_THINK_OWNER_EMAIL);
  return att;
}

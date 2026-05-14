/**
 * Voice console — push-to-talk + always-listening interface for the
 * Persona shell, built on `useVoiceAgent` from `@cloudflare/voice`.
 *
 * The component is lazy-loaded so a deployed agent without voice
 * enabled doesn't pay the bundle cost. `enabled` (v0.12.4) only flips
 * to true once the user has consented to mic access — the WebSocket
 * to the server VoiceAgent stays closed until then.
 *
 * UX:
 *   - Big push-to-talk button that hold-to-talk OR toggles in
 *     hands-free mode.
 *   - Audio-level ring that grows with mic volume.
 *   - Status pill: idle / listening / thinking / speaking.
 *   - Live interim transcript above the button; settled transcript
 *     in a scrollable list below.
 *   - Mute / end-call / hands-free toggle in a small row.
 *   - Surface metrics (latency, audio-level) via title attributes
 *     so the chrome stays clean for normies.
 *
 * The component degrades cleanly when @cloudflare/voice isn't
 * installed in the host bundle (returns a stub explaining how to
 * enable). That mirrors how the deployed agent template gates voice
 * behind a Settings toggle.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export interface VoiceConsoleSettings {
  silenceThreshold: number;
  silenceDurationMs: number;
  interruptThreshold: number;
  interruptChunks: number;
}

export interface VoiceConsoleProps {
  agent: string;
  name?: string;
  host?: string;
  /** Lazy factory so the host doesn't bundle @cloudflare/voice
   *  unless voice is on. The factory's return shape mirrors
   *  useVoiceAgent's documented return value. */
  useVoiceAgent?: (input: UseVoiceAgentInput) => UseVoiceAgentOutput;
  settings?: VoiceConsoleSettings;
  /** "push" = hold-to-talk (default); "hands-free" = open mic that
   *  closes on silence detection. */
  defaultMode?: "push" | "hands-free";
  onTranscript?: (text: string, role: "user" | "assistant") => void;
}

export interface UseVoiceAgentInput {
  agent: string;
  name?: string | undefined;
  host?: string | undefined;
  enabled: boolean;
  silenceThreshold?: number | undefined;
  silenceDurationMs?: number | undefined;
  interruptThreshold?: number | undefined;
  interruptChunks?: number | undefined;
}

export interface UseVoiceAgentOutput {
  status: "idle" | "listening" | "thinking" | "speaking";
  transcript: { role: "user" | "assistant"; content: string; ts?: number }[];
  interimTranscript: string | null;
  audioLevel: number;
  isMuted: boolean;
  connected: boolean;
  error: string | null;
  startCall: () => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  sendText: (text: string) => void;
}

/**
 * Permission gate — wraps `navigator.mediaDevices.getUserMedia` so
 * the WebSocket only opens once the user has agreed. Returns a tuple
 * `[micGranted, requestMic]` so callers can render their own affordance.
 */
export function useMicPermission(): [boolean, () => Promise<boolean>] {
  const [granted, setGranted] = useState(false);
  const request = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setGranted(true);
      return true;
    } catch {
      setGranted(false);
      return false;
    }
  }, []);
  return [granted, request];
}

/** Stub used when `useVoiceAgent` isn't provided — returns idle state
 *  so the component still renders for tests / SSR. */
function stubVoiceAgent(_input: UseVoiceAgentInput): UseVoiceAgentOutput {
  return {
    status: "idle",
    transcript: [],
    interimTranscript: null,
    audioLevel: 0,
    isMuted: false,
    connected: false,
    error: "Voice is not enabled. Pass `useVoiceAgent` from @cloudflare/voice/react.",
    async startCall() {},
    endCall() {},
    toggleMute() {},
    sendText() {}
  };
}

const statusLabel: Record<UseVoiceAgentOutput["status"], string> = {
  idle: "Ready",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking"
};

const statusTone: Record<UseVoiceAgentOutput["status"], string> = {
  idle: "var(--ink-soft, #2f2f37)",
  listening: "var(--accent, #3a5bd7)",
  thinking: "var(--orange, #f17105)",
  speaking: "var(--green, #176f49)"
};

export function VoiceConsole(props: VoiceConsoleProps) {
  const [mode, setMode] = useState<"push" | "hands-free">(props.defaultMode ?? "push");
  const [micGranted, requestMic] = useMicPermission();
  const enabled = micGranted;
  const lastTranscriptRef = useRef<number>(-1);

  const useVoice = props.useVoiceAgent ?? stubVoiceAgent;
  const voice = useVoice({
    agent: props.agent,
    name: props.name,
    host: props.host,
    enabled,
    silenceThreshold: props.settings?.silenceThreshold,
    silenceDurationMs: props.settings?.silenceDurationMs,
    interruptThreshold: props.settings?.interruptThreshold,
    interruptChunks: props.settings?.interruptChunks
  });

  // Fire onTranscript only for newly-settled messages.
  useEffect(() => {
    if (!props.onTranscript) return;
    const next = voice.transcript.slice(lastTranscriptRef.current + 1);
    next.forEach((message) => {
      props.onTranscript!(message.content, message.role);
    });
    lastTranscriptRef.current = voice.transcript.length - 1;
  }, [voice.transcript, props.onTranscript, props]);

  const ringStyle = useMemo<CSSProperties>(() => {
    const level = Math.min(1, Math.max(0, voice.audioLevel));
    const scale = 1 + level * 0.45;
    return {
      transform: `scale(${scale})`,
      transition: "transform 60ms linear",
      boxShadow: `0 0 0 ${Math.round(level * 16)}px rgba(58, 91, 215, 0.18)`
    };
  }, [voice.audioLevel]);

  const startOrToggle = useCallback(async () => {
    if (!enabled) {
      const granted = await requestMic();
      if (!granted) return;
    }
    if (voice.connected) {
      voice.endCall();
    } else {
      await voice.startCall();
    }
  }, [enabled, requestMic, voice]);

  const onPointerDown = useCallback(async () => {
    if (mode !== "push") return;
    if (!enabled) {
      const granted = await requestMic();
      if (!granted) return;
    }
    if (!voice.connected) await voice.startCall();
  }, [enabled, mode, requestMic, voice]);

  const onPointerUp = useCallback(() => {
    if (mode !== "push") return;
    if (voice.connected) voice.endCall();
  }, [mode, voice]);

  return (
    <section className="persona-voice" aria-label="Voice console">
      <header className="persona-voice__header">
        <span className="persona-voice__status" style={{ color: statusTone[voice.status] }} aria-live="polite">
          <span className="persona-voice__status-dot" />
          {statusLabel[voice.status]}
        </span>
        <div className="persona-voice__mode">
          {(["push", "hands-free"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`persona-voice__mode-btn${mode === m ? " is-active" : ""}`}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
            >
              {m === "push" ? "Push to talk" : "Hands free"}
            </button>
          ))}
        </div>
      </header>

      {voice.interimTranscript && (
        <div className="persona-voice__interim" aria-live="polite">
          “{voice.interimTranscript}…”
        </div>
      )}

      <div className="persona-voice__center">
        <button
          type="button"
          className="persona-voice__push"
          aria-pressed={voice.connected}
          aria-label={voice.connected ? "End call" : "Start call"}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={mode === "hands-free" ? startOrToggle : undefined}
          style={ringStyle}
          disabled={!!voice.error && !enabled}
        >
          {voice.connected ? "●" : "🎙"}
        </button>
      </div>

      <div className="persona-voice__controls">
        <button
          type="button"
          onClick={voice.toggleMute}
          disabled={!voice.connected}
          aria-pressed={voice.isMuted}
          title={voice.isMuted ? "Unmute" : "Mute"}
          className="persona-voice__control"
        >
          {voice.isMuted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          onClick={voice.endCall}
          disabled={!voice.connected}
          title="End call"
          className="persona-voice__control persona-voice__control--end"
        >
          End
        </button>
        {!enabled && (
          <button
            type="button"
            onClick={requestMic}
            className="persona-voice__control persona-voice__control--mic-grant"
          >
            Allow microphone
          </button>
        )}
      </div>

      <ol className="persona-voice__transcript" aria-label="Voice transcript">
        {voice.transcript.map((message, i) => (
          <li key={`${message.role}-${i}-${message.ts ?? i}`} data-role={message.role}>
            <span className="persona-voice__role">{message.role === "user" ? "You" : "Agent"}</span>
            <span className="persona-voice__content">{message.content}</span>
          </li>
        ))}
      </ol>

      {voice.error && (
        <p className="persona-voice__error" role="alert">
          {voice.error}
        </p>
      )}
    </section>
  );
}

# Voice + Hibernation

Two production wins that ship with every openthink2 deploy.

## Voice

Talk to the agent. The deployed Worker now includes a `VoiceAgent`
Durable Object built on `@cloudflare/voice`'s `withVoice(Agent)` mixin
— STT and TTS both run inside Workers AI, so there's no third-party
provider in the loop.

### Pipeline

```
[Browser]                                  [Worker]
useVoiceAgent({enabled:micGranted})        VoiceAgent extends withVoice(Agent)
   • mic capture (after permission)   ──▶  • WorkersAIFluxSTT transcribes
   • interim transcript display              chunks as they land
   • audio playback                          • onTurn() reuses the orchestrator
   • interrupt detection              ◀──     system prompt (skills, working
                                              doc, active goals)
                                            • Workers AI llama-3.3-70b answers
                                            • WorkersAITTS streams MP3 back
```

### Settings → Voice

- **Enable voice console** — flips the Persona shell to surface the
  voice button. Off by default; user must opt in.
- **Silence threshold** (0.00–0.50) — mic volume below this counts as
  silence. Lower = pickier.
- **End turn after silence** (100–3000 ms) — how long silence persists
  before the turn closes.
- **Interrupt threshold** (0.00–0.50) — how loud the user has to talk
  to barge in while the agent is speaking.

All four flow into both the React `useVoiceAgent({...})` options and
the server-side pipeline (`silenceThreshold`, `silenceDurationMs`,
`interruptThreshold`, `interruptChunks`).

### Connection control (v0.12.4)

`useVoiceAgent` accepts `enabled: boolean`. The Persona `VoiceConsole`
component keeps `enabled = false` until `navigator.mediaDevices
.getUserMedia({ audio: true })` resolves — so the WebSocket to the
deployed `VoiceAgent` only opens after explicit user consent. This is
the **v0.12.4 voice connection control** feature, applied verbatim.

### Push-to-talk vs hands-free

The console exposes both modes:

- **Push to talk** (default) — `pointerdown` opens the call,
  `pointerup` closes it. No idle WebSocket while you're not talking.
- **Hands free** — click to start, click again to end. Server's
  `silenceDurationMs` decides when each turn closes.

### Slash commands work in voice

`/goal …` works the same in voice as in chat — the orchestrator's
slash-command handler runs before the model call.

### Plug your own client

`VoiceConsole` accepts a `useVoiceAgent` factory prop. The deployed
template wires `import { useVoiceAgent } from "@cloudflare/voice/react"`
through it. The component degrades gracefully (renders an explanatory
stub) when the factory is missing — useful for SSR and unit tests.

## Hibernation

Cloudflare's WebSocket Hibernation API is **on by default in the CF
Agents SDK**. The Durable Object goes idle when no frames are flowing;
billable GB-s stops; the next incoming message wakes the DO with
client connections still open. Our compat date (≥ 2026-04-20) also
gives us automatic Close-frame replies without code.

The win openthink2 adds: workspace metadata survives hibernation
cycles without a DO storage read.

### How

`starters/personal-agent/src/hibernation.ts` exposes three helpers:

- `attachConnectionMetadata(ws, { workspaceId, threadId, ownerEmail, voice, extras })`
  — calls `serializeAttachment` on the WebSocket. The attachment
  survives hibernation.
- `readConnectionMetadata(ws)` — `deserializeAttachment` + type
  validation. Returns `null` if the socket has never been tagged or
  someone else's attachment is in the slot.
- `patchConnectionMetadata(ws, patch)` — merge-and-reserialize for
  updates during long-lived sessions (e.g. user starts a new thread).

The `VoiceAgent`'s `onCallStart` hook attaches the workspace id +
voice settings to each new socket — so after a hibernation wakeup the
agent can read who the caller is without touching DO sqlite.

```ts
async onCallStart(connection) {
  if (supportsHibernation(connection.socket)) {
    attachConnectionMetadata(connection.socket, {
      workspaceId: env.OPEN_THINK_WORKSPACE_ID ?? "default",
      voice: defaultVoiceSettings
    });
  }
}
```

### What we don't do

- **Outbound WebSocket hibernation** doesn't exist yet (open Cloudflare
  feature request). If a sub-agent maintains a persistent outbound
  socket (e.g. to executor.sh), that DO stays pinned in memory. The
  orchestrator's RPC MCP sub-agents are inbound-only and hibernate
  normally.
- We don't try to encrypt attachment payloads — workspace ids + voice
  tuning are not secrets. If you stash a token in `extras`, encrypt
  it first.

## Verify

```bash
pnpm typecheck
pnpm test
```

210+ tests cover both surfaces. The voice runtime is exercised
through `buildVoiceTurnHandler` unit tests (slash-command
interception, abort-signal handling) plus the `VoiceAgent` template
emission test. The hibernation module is covered through fake-WebSocket
round-trip tests.

## See also

- [@cloudflare/voice](https://www.npmjs.com/package/@cloudflare/voice)
- [Voice agents docs](https://developers.cloudflare.com/agents/api-reference/voice/)
- [Agents SDK v0.12.4 changelog](https://developers.cloudflare.com/changelog/post/2026-05-13-agents-sdk-v0124/)
- [WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

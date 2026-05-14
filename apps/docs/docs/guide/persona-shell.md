# Persona shell

The agent's web UI ships as a three-column shell inspired by the
[Persona product spec](https://github.com/NeoFlux-Holdings/openthink2/blob/main/README.md):

```
 ┌──────────────────┬───────────────────────┬───────────────────────────┐
 │ Sidebar (220px)  │ Thread feed (~40%)    │ Artifact canvas (~55%)    │
 │ ✦ New Task       │ Header + status pill  │ Windowing single/grid/stack│
 │ 🔍 Search        │ Working doc chip      │ Artifact viewers           │
 │ 📚 Library       │ Streamed messages     │ Thumbnail strip            │
 │ 🧠 Learning •2   │ Inline tool chips     │                            │
 │ ⚡ Skills        │ Composer + Plan toggle│                            │
 │ Recent threads   │                       │                            │
 │ ⚙ Settings       │                       │                            │
 └──────────────────┴───────────────────────┴───────────────────────────┘
```

The shell lives in `starters/personal-agent/src/persona-shell.tsx` and
its styles in `persona-shell.css`. Both are designed to plug into the
existing single-pane chat surface as a non-breaking upgrade: render
your current thread feed into the `threadView` prop and your composer
into the `composer` prop. The shell handles sidebar nav, working-doc
chip, windowing modes, and the artifact thumbnail strip.

```tsx
import "./persona-shell.css";
import { PersonaShell } from "./persona-shell";

<PersonaShell
  workspaceName="amber-otter"
  ownerEmail="ada@example.com"
  recentThreads={recent}
  artifacts={artifacts}
  workingDoc="Drafting the Q3 retrospective; waiting on numbers from finance."
  pendingLearningCount={pending.learning}
  pendingSkillsCount={pending.skills}
  activeThreadId={activeId}
  onSelectThread={selectThread}
  onNewTask={() => router.push("/new")}
  onOpenSearch={openSearchPalette}
  onOpenLibrary={() => router.push("/library")}
  onOpenLearning={() => router.push("/learning")}
  onOpenSkills={() => router.push("/skills")}
  onOpenSettings={() => router.push("/settings")}
  threadView={<ChatThread ... />}
  composer={<Composer ... />}
/>
```

## Design principles

- **Progressive disclosure.** Normies see the chat. Advanced affordances
  (Plan mode, Train mode, code-mode toggle, model picker, spend cap)
  live behind an "Advanced" disclosure in Settings.
- **Artifacts are first-class.** Documents, browser sessions, code,
  slides, images, tables, and charts all render inline. The canvas
  supports single / grid / stack windowing modes.
- **Working doc survives compaction.** The orchestrator maintains a
  short text summary in Durable Object storage that re-grounds the
  agent after long runs. The UI surfaces it as a pinned chip above the
  thread feed.
- **Train mode is one click away.** Toggle on, the next response
  externalizes its plan as a numbered editable step list. After a
  successful run, the agent offers "Save this as a skill?" — see
  `evolve/loop.ts`.
- **Cost is visible but not anxious.** A subtle `~$0.04` chip appears
  on the composer for advanced users; hidden by default.

## Open work

The shell is a structural skeleton — every column is wired but the
artifact viewers, search palette, and Learning page each have their
own follow-up tickets. The Streamdown markdown renderer, the existing
chat thread component, and the sub-agent management surface from the
current `client.tsx` all plug in cleanly. See the embedded TODO
comments in `persona-shell.tsx` for the per-section hand-off points.

import { defineConfig } from "vitepress";

export default defineConfig({
  title: "openthink2",
  description: "Cloudflare-native Personal Agent OS",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/architecture" },
      { text: "Deployment", link: "/guide/deployment" },
      { text: "Security", link: "/guide/security" }
    ],
    sidebar: [
      {
        text: "Platform",
        items: [
          { text: "Architecture", link: "/guide/architecture" },
          { text: "Deployment", link: "/guide/deployment" },
          { text: "Artifacts Sync", link: "/guide/artifacts-sync" },
          { text: "Cloudflare Token", link: "/guide/cloudflare-token" },
          { text: "Runtime Packages", link: "/guide/packages" },
          { text: "Security", link: "/guide/security" }
        ]
      },
      {
        text: "Agent",
        items: [
          { text: "Orchestrator & Sub-agents", link: "/guide/orchestrator-and-subagents" },
          { text: "Skills, Approval, Code-mode", link: "/guide/skills-and-approval" },
          { text: "Workflows (JSX + Effect)", link: "/guide/workflows" },
          { text: "Persona Shell (UI)", link: "/guide/persona-shell" },
          { text: "Smithery (MCP registry)", link: "/guide/smithery" },
          { text: "Voice + Hibernation", link: "/guide/voice-and-hibernation" },
          { text: "Hosted Cloud Agent", link: "/guide/hosted-cloud-agent" },
          { text: "Effect Executor", link: "/guide/effect-executor" }
        ]
      }
    ]
  }
});

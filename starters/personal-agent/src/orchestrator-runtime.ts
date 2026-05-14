/**
 * orchestrator-runtime — single-file re-export hub for the generated
 * user-agent Worker.
 *
 * The generated agent Worker (see apps/platform/src/lib/agents-sdk-runtime-template.ts)
 * imports the orchestrator runtime helpers from a sibling `./orchestrator-runtime`
 * module. This file is the in-starter source of truth for those re-exports;
 * the platform's runtime template emits a standalone copy alongside the
 * generated server.ts so the deployed bundle does not depend on the
 * `@open-think/starter-personal-agent` workspace package.
 *
 * Keep this file as a single barrel — no logic — so the template renderer
 * can predict its shape and so additions on the orchestrator side flow
 * straight through to the generated Worker.
 */

export * from "./orchestrator/agent";
export * from "./orchestrator";
export * from "./goal";
export * from "./skills";
export * from "./approval";
export * from "./code-mode";
export * from "./executor";
export * from "./smithery";
export * from "./learning-routes";
export * from "./document-stream";
export * from "./workflows";

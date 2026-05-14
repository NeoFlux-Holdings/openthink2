/**
 * Barrel exports for the Persona shell's supporting pages.
 *
 * These pages mount inside the agent's web UI in response to the
 * sidebar callbacks (`onOpenLibrary`, `onOpenSkills`, `onOpenSettings`,
 * `onOpenSearch`) on the main `PersonaShell` component.
 */
export {
  LibraryPage,
  bucketFor,
  filterArtifacts,
  type LibraryAgeBucket,
  type LibraryArtifactKind,
  type LibraryArtifactSource,
  type LibraryFilters,
  type LibraryPageProps,
  type PersonaArtifact
} from "./library-page";

export {
  SkillsPage,
  type SkillsPageProps,
  type SkillsTabId
} from "./skills-page";

export {
  SettingsPage,
  THINKING_BUDGET_MAX,
  THINKING_BUDGET_MIN,
  THINKING_BUDGET_STEP,
  approvalModeOptions,
  buildSettingsPatch,
  codeModePolicies,
  defaultPersonaSettings,
  modelProviders,
  trainingModes,
  type CodeModePolicy,
  type ModelProvider,
  type PersonaSettings,
  type SettingsApprovalMode,
  type SettingsPageProps,
  type TrainingMode
} from "./settings-page";

export {
  SearchPalette,
  ageBucket,
  filterArtifacts as filterSearchArtifacts,
  filterMemories,
  filterThreads,
  groupByAge,
  matchesQuery,
  type AgeBucket,
  type SearchArtifactHit,
  type SearchMemoryHit,
  type SearchPaletteProps,
  type SearchTab,
  type SearchThreadHit
} from "./search-palette";

/**
 * Settings page — controls for the Persona shell's "Advanced" surface.
 *
 * Every field is fully controlled. Changes flow up through `onUpdate`
 * as a partial patch so the parent reducer can decide whether to persist
 * locally, sync to the Durable Object, or both.
 *
 * Sections:
 *   - Model picker (workers-ai / openrouter / anthropic / openai)
 *   - Extended thinking toggle + budget slider (1k–32k tokens)
 *   - Approval mode (full-auto / smart-auto / manual) + spend cap
 *   - Code-mode policy (off / assisted / always)
 *   - Training mode (off / review / auto-evolve)
 */
import { useId, type ChangeEvent } from "react";

export const modelProviders = ["workers-ai", "openrouter", "anthropic", "openai"] as const;
export type ModelProvider = (typeof modelProviders)[number];

export const approvalModeOptions = ["full-auto", "smart-auto", "manual"] as const;
export type SettingsApprovalMode = (typeof approvalModeOptions)[number];

export const codeModePolicies = ["off", "assisted", "always"] as const;
export type CodeModePolicy = (typeof codeModePolicies)[number];

export const trainingModes = ["off", "review", "auto-evolve"] as const;
export type TrainingMode = (typeof trainingModes)[number];

export interface PersonaSettings {
  modelProvider: ModelProvider;
  extendedThinking: boolean;
  thinkingBudgetTokens: number;
  approvalMode: SettingsApprovalMode;
  spendCapUsd: number;
  codeModePolicy: CodeModePolicy;
  trainingMode: TrainingMode;
}

export const defaultPersonaSettings: PersonaSettings = {
  modelProvider: "anthropic",
  extendedThinking: true,
  thinkingBudgetTokens: 8_000,
  approvalMode: "smart-auto",
  spendCapUsd: 5,
  codeModePolicy: "assisted",
  trainingMode: "review"
};

export const THINKING_BUDGET_MIN = 1_000;
export const THINKING_BUDGET_MAX = 32_000;
export const THINKING_BUDGET_STEP = 500;

export interface SettingsPageProps {
  settings: PersonaSettings;
  onUpdate: (patch: Partial<PersonaSettings>) => void;
}

/**
 * Build a single-key patch suitable for the `onUpdate` callback. Extracted
 * so unit tests can verify shape without rendering React; the input handlers
 * below call into this when constructing their patches.
 */
export function buildSettingsPatch<K extends keyof PersonaSettings>(
  key: K,
  value: PersonaSettings[K]
): Partial<PersonaSettings> {
  return { [key]: value } as Partial<PersonaSettings>;
}

export function SettingsPage({ settings, onUpdate }: SettingsPageProps) {
  const ids = {
    model: useId(),
    thinking: useId(),
    budget: useId(),
    approval: useId(),
    spend: useId(),
    code: useId(),
    train: useId()
  };

  const onSelectChange =
    <K extends keyof PersonaSettings>(key: K) =>
    (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      onUpdate(buildSettingsPatch(key, event.target.value as PersonaSettings[K]));
    };

  const onCheckboxChange =
    <K extends keyof PersonaSettings>(key: K) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onUpdate(buildSettingsPatch(key, event.target.checked as PersonaSettings[K]));
    };

  const onNumberChange =
    <K extends keyof PersonaSettings>(key: K) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value)) {
        onUpdate(buildSettingsPatch(key, value as PersonaSettings[K]));
      }
    };

  return (
    <section className="persona-page persona-settings" aria-label="Settings">
      <header className="persona-page__header">
        <h1>Settings</h1>
        <p className="persona-page__subtitle">
          Advanced controls. Most users can leave the defaults alone — change one knob at a time.
        </p>
      </header>

      <div className="persona-settings__group">
        <h2>Model</h2>
        <label className="persona-settings__field" htmlFor={ids.model}>
          <span>Provider</span>
          <select
            id={ids.model}
            value={settings.modelProvider}
            onChange={onSelectChange("modelProvider")}
          >
            {modelProviders.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="persona-settings__group">
        <h2>Reasoning</h2>
        <label className="persona-settings__field persona-settings__field--inline" htmlFor={ids.thinking}>
          <input
            id={ids.thinking}
            type="checkbox"
            checked={settings.extendedThinking}
            onChange={onCheckboxChange("extendedThinking")}
          />
          <span>Extended thinking</span>
        </label>
        <label className="persona-settings__field" htmlFor={ids.budget}>
          <span>
            Thinking budget · <strong>{settings.thinkingBudgetTokens.toLocaleString()} tokens</strong>
          </span>
          <input
            id={ids.budget}
            type="range"
            min={THINKING_BUDGET_MIN}
            max={THINKING_BUDGET_MAX}
            step={THINKING_BUDGET_STEP}
            value={settings.thinkingBudgetTokens}
            disabled={!settings.extendedThinking}
            onChange={onNumberChange("thinkingBudgetTokens")}
          />
        </label>
      </div>

      <div className="persona-settings__group">
        <h2>Approvals</h2>
        <label className="persona-settings__field" htmlFor={ids.approval}>
          <span>Approval mode</span>
          <select
            id={ids.approval}
            value={settings.approvalMode}
            onChange={onSelectChange("approvalMode")}
          >
            {approvalModeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="persona-settings__field" htmlFor={ids.spend}>
          <span>Spend cap (USD)</span>
          <input
            id={ids.spend}
            type="number"
            min={0}
            step={0.5}
            value={settings.spendCapUsd}
            onChange={onNumberChange("spendCapUsd")}
          />
        </label>
      </div>

      <div className="persona-settings__group">
        <h2>Code mode</h2>
        <fieldset className="persona-settings__radios">
          <legend>How aggressively to use sandboxed code execution.</legend>
          {codeModePolicies.map((option) => (
            <label key={option} className="persona-settings__radio">
              <input
                type="radio"
                name={ids.code}
                value={option}
                checked={settings.codeModePolicy === option}
                onChange={onSelectChange("codeModePolicy")}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="persona-settings__group">
        <h2>Training</h2>
        <fieldset className="persona-settings__radios">
          <legend>How the agent learns from completed runs.</legend>
          {trainingModes.map((option) => (
            <label key={option} className="persona-settings__radio">
              <input
                type="radio"
                name={ids.train}
                value={option}
                checked={settings.trainingMode === option}
                onChange={onSelectChange("trainingMode")}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </section>
  );
}

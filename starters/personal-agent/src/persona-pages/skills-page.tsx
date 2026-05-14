/**
 * Skills page — built-in / active / pending tabs over the skill registry.
 *
 * Each skill row exposes:
 *   - an enable/disable toggle that fires `onToggleSkill(id, enabled)`
 *   - a pin button that fires `onPinSkill(id, pinned)`
 *
 * Reads the static built-in packs from `../skills` but lets the parent
 * pass in *runtime* skill state for the Active and Pending tabs — these
 * live in Durable Object storage and are sourced via the SkillStore.
 */
import { useMemo, useState } from "react";
import { builtinSkillPacks, flattenPacks, type Skill, type SkillPack } from "../skills";

export type SkillsTabId = "builtin" | "active" | "pending";

export interface SkillsPageProps {
  activeSkills: Skill[];
  pendingSkills: Skill[];
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  onPinSkill: (skillId: string, pinned: boolean) => void;
  initialTab?: SkillsTabId;
}

const TABS: ReadonlyArray<{ id: SkillsTabId; label: string }> = [
  { id: "builtin", label: "Built-in" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" }
];

export function SkillsPage(props: SkillsPageProps) {
  const [tab, setTab] = useState<SkillsTabId>(props.initialTab ?? "builtin");

  const builtinFlat = useMemo(() => flattenPacks(builtinSkillPacks), []);

  const counts = useMemo(
    () => ({
      builtin: builtinFlat.length,
      active: props.activeSkills.length,
      pending: props.pendingSkills.length
    }),
    [builtinFlat, props.activeSkills, props.pendingSkills]
  );

  return (
    <section className="persona-page persona-skills" aria-label="Skills">
      <header className="persona-page__header">
        <h1>Skills</h1>
        <p className="persona-page__subtitle">
          Reusable units of agent know-how — system prompt snippets, tool bindings, playbooks.
        </p>
      </header>

      <div className="persona-skills__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`persona-skills__tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.label}</span>
            <span className="persona-skills__count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="persona-skills__body">
        {tab === "builtin" && (
          <BuiltinList
            packs={builtinSkillPacks}
            onToggleSkill={props.onToggleSkill}
            onPinSkill={props.onPinSkill}
          />
        )}
        {tab === "active" && (
          <FlatList
            skills={props.activeSkills}
            emptyText="No skills active yet. Enable a built-in pack to get started."
            onToggleSkill={props.onToggleSkill}
            onPinSkill={props.onPinSkill}
          />
        )}
        {tab === "pending" && (
          <FlatList
            skills={props.pendingSkills}
            emptyText="No pending suggestions. The training loop will surface candidate skills here."
            onToggleSkill={props.onToggleSkill}
            onPinSkill={props.onPinSkill}
          />
        )}
      </div>
    </section>
  );
}

interface ListSharedProps {
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  onPinSkill: (skillId: string, pinned: boolean) => void;
}

function BuiltinList(props: { packs: SkillPack[] } & ListSharedProps) {
  return (
    <div className="persona-skills__packs">
      {props.packs.map((pack) => (
        <section key={pack.id} className="persona-skills__pack">
          <header>
            <h2>{pack.label}</h2>
            <p>{pack.description}</p>
          </header>
          <ul className="persona-skills__list">
            {pack.skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                onToggleSkill={props.onToggleSkill}
                onPinSkill={props.onPinSkill}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FlatList(
  props: { skills: Skill[]; emptyText: string } & ListSharedProps
) {
  if (props.skills.length === 0) {
    return <div className="persona-skills__empty">{props.emptyText}</div>;
  }
  return (
    <ul className="persona-skills__list">
      {props.skills.map((skill) => (
        <SkillRow
          key={skill.id}
          skill={skill}
          onToggleSkill={props.onToggleSkill}
          onPinSkill={props.onPinSkill}
        />
      ))}
    </ul>
  );
}

interface SkillRowProps extends ListSharedProps {
  skill: Skill;
}

function SkillRow({ skill, onToggleSkill, onPinSkill }: SkillRowProps) {
  return (
    <li className="persona-skills__row">
      <div className="persona-skills__row-main">
        <div className="persona-skills__row-head">
          <strong>{skill.name}</strong>
          <span className="persona-skills__source">{skill.source}</span>
        </div>
        <p>{skill.description}</p>
        {skill.tags.length > 0 && (
          <div className="persona-skills__tags">
            {skill.tags.map((tag) => (
              <span key={tag} className="persona-skills__tag">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="persona-skills__row-actions">
        <button
          type="button"
          className={`persona-skills__pin${skill.pinned ? " is-active" : ""}`}
          onClick={() => onPinSkill(skill.id, !skill.pinned)}
          aria-pressed={skill.pinned}
          aria-label={skill.pinned ? "Unpin skill" : "Pin skill"}
          title={skill.pinned ? "Unpin" : "Pin"}
        >
          {skill.pinned ? "★" : "☆"}
        </button>
        <label className="persona-skills__toggle">
          <input
            type="checkbox"
            checked={skill.enabled}
            onChange={(event) => onToggleSkill(skill.id, event.target.checked)}
          />
          <span>{skill.enabled ? "On" : "Off"}</span>
        </label>
      </div>
    </li>
  );
}

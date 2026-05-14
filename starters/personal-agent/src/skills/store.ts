/**
 * Durable Object–backed SkillStore.
 *
 * Skills are stored as JSON in the DO's sqlite-backed key/value storage
 * so they survive restarts and migrate with the agent.
 */

import {
  type Skill,
  type SkillPack,
  type SkillStore,
  builtinSkillPacks,
  flattenPacks
} from "./registry";

const PREFIX = "skill:";

interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

export function createDoSkillStore(storage: DoStorageLike): SkillStore {
  return {
    async list() {
      const map = await storage.list<Skill>({ prefix: PREFIX });
      return Array.from(map.values());
    },
    async get(id) {
      const value = await storage.get<Skill>(PREFIX + id);
      return value ?? null;
    },
    async put(skill) {
      const stamped: Skill = {
        ...skill,
        createdAt: skill.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await storage.put(PREFIX + stamped.id, stamped);
      return stamped;
    },
    async remove(id) {
      await storage.delete(PREFIX + id);
    },
    async preload(packIds) {
      const wanted = new Set(packIds);
      const packs: SkillPack[] = builtinSkillPacks.filter((p) => wanted.has(p.id));
      const existing = await storage.list<Skill>({ prefix: PREFIX });
      const have = new Set(Array.from(existing.keys()));
      for (const skill of flattenPacks(packs)) {
        const key = PREFIX + skill.id;
        if (have.has(key)) continue;
        await storage.put(key, {
          ...skill,
          createdAt: skill.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
  };
}

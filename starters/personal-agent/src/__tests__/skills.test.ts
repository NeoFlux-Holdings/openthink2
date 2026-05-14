import { describe, expect, it } from "vitest";
import {
  builtinSkillPacks,
  buildSystemPromptFromSkills,
  createDoSkillStore,
  defaultPreloadPackIds,
  flattenPacks,
  type Skill
} from "../skills";

function makeFakeStorage() {
  const map = new Map<string, unknown>();
  return {
    async get<T = unknown>(key: string) {
      return map.get(key) as T | undefined;
    },
    async put<T = unknown>(key: string, value: T) {
      map.set(key, value);
    },
    async delete(key: string) {
      return map.delete(key);
    },
    async list<T = unknown>(options?: { prefix?: string }) {
      const out = new Map<string, T>();
      for (const [k, v] of map) {
        if (!options?.prefix || k.startsWith(options.prefix)) {
          out.set(k, v as T);
        }
      }
      return out;
    }
  };
}

describe("built-in skill packs", () => {
  it("ships exactly the four expected packs", () => {
    expect(builtinSkillPacks.map((p) => p.id).sort()).toEqual([
      "ai-hero",
      "anthropic",
      "cloudflare",
      "openai"
    ]);
  });

  it("default preload is the cloudflare pack only", () => {
    expect(defaultPreloadPackIds()).toEqual(["cloudflare"]);
  });

  it("every skill carries valid metadata", () => {
    const all = flattenPacks(builtinSkillPacks);
    for (const skill of all) {
      expect(skill.id).toBeTruthy();
      expect(skill.name.length).toBeGreaterThan(0);
      expect(skill.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(Array.isArray(skill.toolBindings)).toBe(true);
    }
  });
});

describe("buildSystemPromptFromSkills", () => {
  it("returns an empty string when no fragments are present", () => {
    expect(buildSystemPromptFromSkills([])).toEqual("");
  });

  it("concatenates fragments for enabled skills only", () => {
    const skills: Skill[] = [
      {
        id: "a",
        name: "Alpha",
        source: "user",
        description: "",
        enabled: true,
        pinned: false,
        systemPromptFragment: "Always speak in lowercase.",
        toolBindings: [],
        knowledgeUrls: [],
        tags: [],
        version: "1.0.0"
      },
      {
        id: "b",
        name: "Beta",
        source: "user",
        description: "",
        enabled: false,
        pinned: false,
        systemPromptFragment: "DO NOT SHOUT.",
        toolBindings: [],
        knowledgeUrls: [],
        tags: [],
        version: "1.0.0"
      }
    ];
    const prompt = buildSystemPromptFromSkills(skills);
    expect(prompt).toContain("Alpha");
    expect(prompt).toContain("lowercase");
    expect(prompt).not.toContain("Beta");
    expect(prompt).not.toContain("DO NOT SHOUT");
  });
});

describe("createDoSkillStore", () => {
  it("preloads the requested packs but does not overwrite existing skills", async () => {
    const storage = makeFakeStorage();
    const store = createDoSkillStore(storage);
    await store.preload(["cloudflare"]);
    const after = await store.list();
    expect(after.length).toBeGreaterThan(0);

    const first = after[0]!;
    await store.put({ ...first, description: "edited" });
    await store.preload(["cloudflare"]);
    const reread = await store.get(first.id);
    expect(reread?.description).toEqual("edited");
  });

  it("removes by id", async () => {
    const storage = makeFakeStorage();
    const store = createDoSkillStore(storage);
    await store.put({
      id: "test.thing",
      name: "Test thing",
      source: "user",
      description: "",
      enabled: true,
      pinned: false,
      toolBindings: [],
      knowledgeUrls: [],
      tags: [],
      version: "1.0.0"
    });
    expect(await store.get("test.thing")).toBeTruthy();
    await store.remove("test.thing");
    expect(await store.get("test.thing")).toBeNull();
  });
});

/**
 * Deterministic + random "fun" agent name generator.
 *
 * Format: <adjective>-<noun>, e.g. "amber-otter", "loyal-comet".
 * The pools are deliberately short and curated so:
 *   - the result *can* be meaningful ("brave-fox") but doesn't have to be
 *   - subdomain-safe: only lowercase a-z (no digits, no diacritics)
 *   - never collides with Cloudflare reserved subdomains
 */

const adjectives = [
  "amber",
  "arctic",
  "aurora",
  "bashful",
  "bold",
  "bouncy",
  "brave",
  "breezy",
  "bronze",
  "candid",
  "cerulean",
  "clever",
  "cosmic",
  "crimson",
  "curious",
  "daring",
  "dapper",
  "dewy",
  "dreamy",
  "dusky",
  "eager",
  "earnest",
  "electric",
  "emerald",
  "feisty",
  "frosty",
  "gentle",
  "gilded",
  "glassy",
  "graceful",
  "happy",
  "hazel",
  "honest",
  "humble",
  "indigo",
  "jolly",
  "kindly",
  "lively",
  "loyal",
  "lucid",
  "lunar",
  "merry",
  "mighty",
  "mossy",
  "neon",
  "nimble",
  "opal",
  "patient",
  "peachy",
  "plucky",
  "polite",
  "quiet",
  "quirky",
  "rapid",
  "rosy",
  "ruby",
  "scarlet",
  "silken",
  "silver",
  "sleepy",
  "snappy",
  "solar",
  "spry",
  "stormy",
  "sunny",
  "sweet",
  "swift",
  "tender",
  "tidy",
  "tiny",
  "topaz",
  "tranquil",
  "twilight",
  "vivid",
  "warm",
  "whimsical",
  "wild",
  "witty",
  "woven",
  "zesty"
];

const nouns = [
  "albatross",
  "anchor",
  "arrow",
  "atlas",
  "badger",
  "beacon",
  "bison",
  "blossom",
  "boulder",
  "cactus",
  "canyon",
  "cedar",
  "comet",
  "compass",
  "cypress",
  "dolphin",
  "dragonfly",
  "echo",
  "ember",
  "fawn",
  "ferret",
  "finch",
  "flamingo",
  "fox",
  "garnet",
  "glider",
  "harbor",
  "harvest",
  "heron",
  "iris",
  "jasper",
  "kestrel",
  "lantern",
  "lemur",
  "lichen",
  "lighthouse",
  "lynx",
  "magpie",
  "mango",
  "marbles",
  "meadow",
  "mesa",
  "milkweed",
  "minnow",
  "moss",
  "mustang",
  "nebula",
  "nutmeg",
  "oasis",
  "ocelot",
  "olive",
  "orchard",
  "otter",
  "owl",
  "panda",
  "pebble",
  "pelican",
  "petal",
  "phoenix",
  "pioneer",
  "quasar",
  "quail",
  "raccoon",
  "raven",
  "reef",
  "ripple",
  "river",
  "robin",
  "salmon",
  "satellite",
  "saturn",
  "seagrass",
  "sequoia",
  "skylark",
  "sloth",
  "sparrow",
  "specter",
  "spruce",
  "starling",
  "sundial",
  "swallow",
  "tarsier",
  "thicket",
  "thunder",
  "tide",
  "topaz",
  "tortoise",
  "tundra",
  "valley",
  "violet",
  "voyager",
  "walnut",
  "wanderer",
  "waterfall",
  "willow",
  "wolfpup",
  "wombat",
  "yarrow",
  "zephyr"
];

export function randomFunAgentName(seed?: () => number): string {
  const rand = seed ?? Math.random;
  const a = adjectives[Math.floor(rand() * adjectives.length)];
  const n = nouns[Math.floor(rand() * nouns.length)];
  return `${a}-${n}`;
}

/**
 * Stable variant — same input string always produces the same name.
 * Useful for "suggest a name from this email" UX.
 */
export function deterministicFunAgentName(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash = Math.abs(hash);
  const a = adjectives[hash % adjectives.length];
  const n = nouns[Math.floor(hash / adjectives.length) % nouns.length];
  return `${a}-${n}`;
}

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "dashboard",
  "dash",
  "console",
  "workers",
  "pages",
  "cloudflare",
  "cf"
]);

export function isValidAgentSlug(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 40) return false;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  if (slug.startsWith("-") || slug.endsWith("-")) return false;
  if (RESERVED_SUBDOMAINS.has(slug)) return false;
  return true;
}

export function suggestAgentSlug(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (isValidAgentSlug(normalized)) return normalized;
  return randomFunAgentName();
}

export { adjectives as funAdjectives, nouns as funNouns };

/**
 * App-level state — screen navigation + profile + settings.
 */
import type { PersonaProfile } from "@meport/core/types";

export type Screen = "home" | "profiling" | "reveal" | "profile" | "export" | "settings";

let screen = $state<Screen>("home");
let transitioning = $state(false);

// ─── Profile persistence ───
function loadProfile(): PersonaProfile | null {
  try {
    const raw = localStorage.getItem("meport:profile");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

let profile = $state<PersonaProfile | null>(loadProfile());

// ─── Settings ───
let apiKey = $state(localStorage.getItem("meport:apiKey") || "");
let apiProvider = $state<"anthropic" | "openai">(
  (localStorage.getItem("meport:apiProvider") as "anthropic" | "openai") || "anthropic"
);

// ─── Getters ───
export function getScreen() { return screen; }
export function getProfile() { return profile; }
export function isTransitioning() { return transitioning; }
export function getApiKey() { return apiKey; }
export function getApiProvider() { return apiProvider; }
export function hasApiKey() { return apiKey.length > 10; }
export function hasProfile() { return profile !== null; }

// ─── Navigation ───
export async function goTo(next: Screen) {
  if (next === screen) return;
  transitioning = true;
  await new Promise(r => setTimeout(r, 250));
  screen = next;
  await new Promise(r => setTimeout(r, 50));
  transitioning = false;
}

// ─── Profile ───
export function setProfile(p: PersonaProfile) {
  profile = p;
  localStorage.setItem("meport:profile", JSON.stringify(p));
}

export function clearProfile() {
  profile = null;
  localStorage.removeItem("meport:profile");
}

/** Import a profile from a JSON file (e.g. from CLI export) */
export function importProfile(json: string): boolean {
  try {
    const p = JSON.parse(json) as PersonaProfile;
    if (!p.explicit || !p.meta) return false;
    setProfile(p);
    return true;
  } catch { return false; }
}

// ─── Settings ───
export function setApiKey(key: string) {
  apiKey = key;
  localStorage.setItem("meport:apiKey", key);
}

export function setApiProvider(provider: "anthropic" | "openai") {
  apiProvider = provider;
  localStorage.setItem("meport:apiProvider", provider);
}

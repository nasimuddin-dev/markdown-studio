import type { Settings } from "../types";

/**
 * Managed settings: an IT administrator can preset settings for everyone on
 * a computer, and lock some of them, with a `policy.json` file:
 *
 *     { "settings": { "aiEnabled": false, "exportPageSize": "letter" },
 *       "locked": ["aiEnabled"] }
 *
 * `settings` are defaults a user can still change (unless locked); `locked`
 * settings always have the policy's value (or the built-in default when the
 * policy gives none) and can't be changed in the app.
 */
export interface Policy {
  settings: Partial<Settings>;
  locked: Array<keyof Settings>;
}

export const NO_POLICY: Policy = { settings: {}, locked: [] };

/**
 * Validates a policy file's contents. Unknown keys and invalid values are
 * dropped (the same rules as the user's own settings); `session` can't be managed.
 */
export function parsePolicy(raw: unknown, sanitize: (raw: unknown) => Settings, defaults: Settings): Policy {
  if (!raw || typeof raw !== "object") return NO_POLICY;
  const r = raw as { settings?: unknown; locked?: unknown };
  const given = r.settings && typeof r.settings === "object" ? (r.settings as Record<string, unknown>) : {};
  const valid = sanitize(given);
  const keys: Array<keyof Settings> = (Object.keys(defaults) as Array<keyof Settings>).filter((k) => k !== "session");
  const settings: Partial<Settings> = {};
  for (const k of keys) {
    // A value that sanitizing replaced with the default was invalid, so it's ignored.
    if (Object.hasOwn(given, k) && JSON.stringify(valid[k]) === JSON.stringify(given[k])) {
      (settings as Record<string, unknown>)[k] = valid[k];
    }
  }
  const locked = Array.isArray(r.locked) ? r.locked.filter((k): k is keyof Settings => typeof k === "string" && keys.includes(k as keyof Settings)) : [];
  return { settings, locked: [...new Set(locked)] };
}

/** The user's stored settings with the policy applied (defaults under them, locks over them). */
export function applyPolicy(userRaw: unknown, policy: Policy, sanitize: (raw: unknown) => Settings, defaults: Settings): Settings {
  const user = userRaw && typeof userRaw === "object" ? (userRaw as Record<string, unknown>) : {};
  const merged = sanitize({ ...policy.settings, ...user });
  for (const k of policy.locked) {
    (merged as unknown as Record<string, unknown>)[k] = Object.hasOwn(policy.settings, k) ? policy.settings[k] : defaults[k];
  }
  return merged;
}

/** Drops changes to locked settings from a patch. */
export function withoutLocked(patch: Partial<Settings>, locked: ReadonlyArray<keyof Settings>): Partial<Settings> {
  const out = { ...patch };
  for (const k of locked) delete out[k];
  return out;
}

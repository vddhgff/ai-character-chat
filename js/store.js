// Persistence layer. Everything is stored on the user's own device via the
// kv-plugin (IndexedDB), keyed by generator, and survives reloads.
//
// Folders:
//   characters     id -> character object
//   threads        id -> thread metadata (title, participants, rolling summary)
//   threadMessages threadId -> [message objects]
//   userCharacters id -> "you" persona
//   misc           app-level odds and ends (seed flag, settings, ...)

import { presetCharacters } from "./presets.js";

const folder = (name) => window.root.kv[name];

export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const now = () => Date.now();

export const DEFAULT_SETTINGS = {
  theme: "dark",
  fontSize: 15,
  enterToSend: true,
  streaming: true,
  autoSummarize: true,
  showTimestamps: false,
  activeUserCharacterId: "user-default",
};

export function newCharacter(overrides = {}) {
  const t = now();
  return {
    id: uid(),
    name: "New Character",
    tagline: "",
    description: "",
    avatarUrl: "",
    roleInstruction: "",
    greeting: "",
    exampleDialogue: "",
    tags: [],
    customCode: "",
    autoImage: "never", // never | sometimes | always
    imageStyle: "",
    metaTitle: "",
    metaDescription: "",
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

export function newUserCharacter(overrides = {}) {
  return {
    id: uid(),
    name: "You",
    description: "",
    avatarUrl: "",
    ...overrides,
  };
}

export function newMessage(overrides = {}) {
  return {
    id: uid(),
    role: "char", // char | user | system
    authorId: "",
    authorName: "",
    content: "",
    images: [],
    createdAt: now(),
    ...overrides,
  };
}

export function newThread(characterIds, overrides = {}) {
  const t = now();
  return {
    id: uid(),
    title: "",
    characterIds: [...characterIds],
    summary: "",
    summaryUpTo: 0,
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

export async function initStore() {
  const misc = folder("misc");
  const seeded = await misc.get("seeded");
  if (!seeded && window.root.config?.seedPresetCharacters !== false) {
    for (const preset of presetCharacters) {
      const existing = await folder("characters").get(preset.id);
      if (!existing) {
        await folder("characters").set(
          preset.id,
          newCharacter({ ...preset, presetAvatarPrompt: preset.avatarPrompt })
        );
      }
    }
    await misc.set("seeded", true);
  }

  // One-time backfill: pre-rendered preset portraits were added after the first
  // release, so stores seeded before that get the artwork filled in here.
  if ((await misc.get("presetAvatarsBackfilled")) !== true) {
    if (window.root.config?.seedPresetCharacters !== false) {
      for (const preset of presetCharacters) {
        if (!preset.avatarUrl) continue;
        const existing = await folder("characters").get(preset.id);
        if (existing && !existing.avatarUrl) {
          await folder("characters").set(preset.id, { ...existing, avatarUrl: preset.avatarUrl });
        }
      }
    }
    await misc.set("presetAvatarsBackfilled", true);
  }

  let settings = await misc.get("settings");
  if (!settings) settings = { ...DEFAULT_SETTINGS };
  settings = { ...DEFAULT_SETTINGS, ...settings };
  await misc.set("settings", settings);

  const users = await folder("userCharacters").entries();
  if (users.length === 0) {
    await folder("userCharacters").set(
      "user-default",
      newUserCharacter({ id: "user-default" })
    );
  }
  return settings;
}

export async function getSettings() {
  const s = await folder("misc").get("settings");
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await folder("misc").set("settings", next);
  return next;
}

// characters ----------------------------------------------------------------

export async function listCharacters() {
  const entries = await folder("characters").entries();
  return entries
    .map(([, v]) => v)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getCharacter(id) {
  return await folder("characters").get(id);
}

export async function saveCharacter(char) {
  char.updatedAt = now();
  await folder("characters").set(char.id, char);
  return char;
}

export async function deleteCharacter(id) {
  await folder("characters").delete(id);
  const threads = await listThreads();
  for (const t of threads) {
    if (t.characterIds.includes(id)) {
      t.characterIds = t.characterIds.filter((x) => x !== id);
      if (t.characterIds.length === 0) await deleteThread(t.id);
      else await saveThread(t);
    }
  }
}

// threads -------------------------------------------------------------------

export async function listThreads() {
  const entries = await folder("threads").entries();
  return entries
    .map(([, v]) => v)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getThread(id) {
  return await folder("threads").get(id);
}

export async function saveThread(thread) {
  thread.updatedAt = now();
  await folder("threads").set(thread.id, thread);
  return thread;
}

export async function deleteThread(id) {
  await folder("threads").delete(id);
  await folder("threadMessages").delete(id);
}

export async function findThreadForCharacters(characterIds) {
  const threads = await listThreads();
  const key = [...characterIds].sort().join(",");
  return threads.find((t) => [...t.characterIds].sort().join(",") === key);
}

export async function getMessages(threadId) {
  return (await folder("threadMessages").get(threadId)) || [];
}

export async function setMessages(threadId, messages) {
  await folder("threadMessages").set(threadId, messages);
}

export async function addMessage(threadId, message) {
  const messages = await getMessages(threadId);
  messages.push(message);
  await setMessages(threadId, messages);
  return messages;
}

// user personas -------------------------------------------------------------

export async function listUserCharacters() {
  const entries = await folder("userCharacters").entries();
  return entries.map(([, v]) => v);
}

export async function getUserCharacter(id) {
  return (await folder("userCharacters").get(id)) || null;
}

export async function saveUserCharacter(user) {
  await folder("userCharacters").set(user.id, user);
  return user;
}

export async function deleteUserCharacter(id) {
  const all = await listUserCharacters();
  if (all.length <= 1) return false;
  await folder("userCharacters").delete(id);
  return true;
}

export async function getActiveUserCharacter() {
  const settings = await getSettings();
  let user = await getUserCharacter(settings.activeUserCharacterId);
  if (!user) {
    user = (await listUserCharacters())[0];
  }
  return user;
}

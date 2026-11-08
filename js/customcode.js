// Per-character custom code.
//
// A character can carry a small JavaScript snippet that runs automatically
// after every reply that character writes. It receives a single object, `oc`,
// and can inspect the conversation, rewrite the reply, attach images, add
// extra messages, or generate new pictures. See the "Custom code" help panel
// in the character editor for the full API and examples.

import { escapeHtml } from "./markdown.js";
import { characterAppearance, generateImageFor } from "./ai.js";

export function createOc({
  character,
  characters,
  user,
  thread,
  messages,
  message,
}) {
  const self = character;
  let stopped = false;

  const oc = {
    character: { ...self },
    characters: characters.map((c) => ({ ...c })),
    user: { ...user },
    thread: {
      messages,
      get lastMessages() {
        return messages.slice(-6);
      },
    },
    message,
    console: {
      log: (...args) => console.log(`[${self.name} code]`, ...args),
      warn: (...args) => console.warn(`[${self.name} code]`, ...args),
      error: (...args) => console.error(`[${self.name} code]`, ...args),
    },
    utils: {
      escapeHtml,
      random: Math.random,
      pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
      fetch: (...args) => fetch(...args),
    },
    threadId: thread?.id,
    stop() {
      stopped = true;
      throw new Error("__oc_stop__");
    },
  };

  oc.setMessageContent = (text) => {
    message.content = String(text ?? "");
    return message;
  };
  oc.appendMessageContent = (text) => {
    message.content = `${message.content || ""}${String(text ?? "")}`;
    return message;
  };
  oc.setAuthorName = (name) => {
    message.authorName = String(name ?? "");
  };
  oc.addImage = (url) => {
    if (!url) return;
    if (!message.images) message.images = [];
    message.images.push(url);
    return url;
  };
  oc.generateImage = async (prompt, opts = {}) => {
    const dataUrl = await generateImageFor(prompt, self.imageStyle || "", characterAppearance(self, user), opts);
    return { dataUrl };
  };
  oc.sendImage = async (prompt) => {
    const { dataUrl } = await oc.generateImage(prompt);
    if (dataUrl) oc.addImage(dataUrl);
    return dataUrl;
  };
  oc.addMessage = (opts = {}) => {
    const msg = {
      id: Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4),
      role: opts.role || "char",
      authorId: opts.authorId || self.id,
      authorName: opts.authorName || self.name,
      content: opts.content || "",
      images: opts.images ? [...opts.images] : [],
      createdAt: Date.now(),
    };
    messages.push(msg);
    return msg;
  };
  oc.deleteMessage = (target) => {
    const id = typeof target === "string" ? target : target?.id;
    const index = messages.findIndex((m) => m.id === id);
    if (index >= 0) messages.splice(index, 1);
  };
  oc.delay = (ms) => new Promise((r) => setTimeout(r, Math.min(Number(ms) || 0, 20000)));
  oc.isStopped = () => stopped;

  return oc;
}

export async function runCustomCode(code, oc) {
  if (!code || !String(code).trim()) return { ok: true };
  let fn;
  try {
    fn = new Function("oc", `"use strict";\nreturn (async () => {\n${String(code)}\n})();`);
  } catch (error) {
    return { ok: false, error: `Syntax error: ${error.message}` };
  }
  try {
    await fn(oc);
    return { ok: true };
  } catch (error) {
    if (String(error?.message) === "__oc_stop__") return { ok: true };
    return { ok: false, error: String(error?.message || error) };
  }
}

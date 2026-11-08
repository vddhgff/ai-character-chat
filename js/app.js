import { escapeHtml, renderMessage } from "./markdown.js";
import * as store from "./store.js";
import {
  newCharacter,
  newMessage,
  newThread,
  newUserCharacter,
  uid,
} from "./store.js";
import {
  characterAppearance,
  countTokens,
  extractImageRequest,
  generateImageFor,
  idealMaxContextTokens,
  makeImagePrompt,
  promptTokenCount,
  requestReply,
  summarizeThread,
} from "./ai.js";
import { createOc, runCustomCode } from "./customcode.js";
import { presetCharacters } from "./presets.js";
import { createAutoTalkController } from "./autotalk.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Dev marker: bumped on every edit to this file. Lets a test harness confirm
// the live preview is running the current source rather than a stale module.
window.__accBuild = "perchance-source-v1";


const ICON = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  send: '<path d="M4 12l16-8-6 16-2.6-6.4L4 12z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.7" cy="9.7" r="1.6"/><path d="M20 16.5l-5-5-9 9"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5.5 15V5.5A2 2 0 0 1 7.5 3.5H15"/>',
  refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.4-5.9M20.5 4v5h-5"/>',
  download: '<path d="M12 4v11m0 0l-4.2-4.2M12 15l4.2-4.2M5 19.5h14"/>',
  upload: '<path d="M12 20V9m0 0L7.8 13.2M12 9l4.2 4.2M5 4.5h14"/>',
  link: '<path d="M10.5 13.5a4.2 4.2 0 0 0 6.2.4l1.8-1.8a4.2 4.2 0 0 0-6-6l-1 1M13.5 10.5a4.2 4.2 0 0 0-6.2-.4l-1.8 1.8a4.2 4.2 0 0 0 6 6l1-1"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2"/>',
  users: '<path d="M16 20v-1.4a4 4 0 0 0-4-4H6.5a4 4 0 0 0-4 4V20M9.2 10.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM22 20v-1.4a4 4 0 0 0-3-3.9M16 3.5a3.6 3.6 0 0 1 0 7.1"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  sparkles: '<path d="M11 3l1.5 4.2L16.7 8.7l-4.2 1.5L11 14.4 9.5 10.2 5.3 8.7l4.2-1.5L11 3zM18 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>',
  book: '<path d="M4 5.5A2 2 0 0 1 6 3.5h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 20.5A2 2 0 0 1 6 18.5h13"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0"/>',
};
const svg = (name) => `<svg class="i" viewBox="0 0 24 24">${ICON[name] || ""}</svg>`;

// ---------------------------------------------------------------------------
// state

const state = {
  settings: store.DEFAULT_SETTINGS,
  characters: [],
  threads: [],
  userCharacters: [],
  userCharacter: null,
  thread: null,
  messages: [],
  generating: false,
  streamingId: null,
  stopCurrent: null,
  generationStopped: false,
  sidebarOpen: false,
  view: "empty",
  characterSearch: "",
  threadSearch: "",
  summarizing: false,
  composerDrafts: new Map(),
  autoTalkOptions: { maxMessages: 25, pauseMs: 2000 },
};

const config = () => window.root.config || {};
const charById = (id) => state.characters.find((c) => c.id === id) || null;
const threadCharacters = () => {
  if (!state.thread) return [];
  return state.thread.characterIds.map(charById).filter(Boolean);
};

// ---------------------------------------------------------------------------
// small ui helpers

let toastTimer = null;
function toast(message, kind = "") {
  const root = $("#toastRoot");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  root.append(el);
  setTimeout(() => el.remove(), 4200);
}

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) % 360;
  return h;
}
function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}
function avatarHtml(name, url, size = 38, cls = "", id = "") {
  const hue = hashHue(name || "?");
  const safeUrl = String(url || "")
    .replace(/'/g, "%27")
    .replace(/\s/g, "%20");
  const style = safeUrl
    ? `background-image:url('${safeUrl.replace(/"/g, "%22")}')`
    : `background:linear-gradient(140deg,hsl(${hue},60%,48%),hsl(${(hue + 48) % 360},58%,36%))`;
  return `<span ${id ? `id="${id}"` : ""} class="avatar ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.round(
    size * 0.38
  )}px;${style}">${safeUrl ? "" : escapeHtml(initials(name))}</span>`;
}

let currentPopover = null;
function closePopover() {
  if (currentPopover) {
    currentPopover.remove();
    currentPopover = null;
  }
}
function onDocClickClosePopover(e) {
  if (currentPopover && !currentPopover.contains(e.target)) closePopover();
}
function showPopover(anchor, items) {
  closePopover();
  const el = document.createElement("div");
  el.className = "popover";
  el.innerHTML = items
    .map((it, i) =>
      it === "hr"
        ? "<hr>"
        : `<button type="button" data-i="${i}" class="${it.danger ? "danger" : ""}" ${it.disabled ? "disabled" : ""} title="${escapeHtml(it.title || "")}">${escapeHtml(
            it.label
          )}</button>`
    )
    .join("");
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.right - el.offsetWidth), window.innerWidth - el.offsetWidth - 8);
  let top = r.bottom + 6;
  if (top + el.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - el.offsetHeight - 6);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    const item = items[Number(b.dataset.i)];
    closePopover();
    if (!item?.disabled) item?.onSelect?.();
  });
  currentPopover = el;
  setTimeout(() => document.addEventListener("click", onDocClickClosePopover, { once: true }), 0);
}

function showModal({ title, body, footer = "", wide = false, onMount, icon = "" }) {
  const scrim = document.createElement("div");
  scrim.className = "modal-scrim";
  scrim.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
    <div class="modal-head">${icon ? `<span class="head-icon">${svg(icon)}</span>` : ""}<h3>${escapeHtml(
    title
  )}</h3><button class="icon-btn" data-close aria-label="Close">${svg("x")}</button></div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ""}
  </div>`;
  $("#modalRoot").append(scrim);
  const el = $(".modal", scrim);
  const close = () => {
    scrim.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  scrim.addEventListener("click", (e) => {
    if (e.target === scrim || e.target.closest("[data-close]")) close();
  });
  onMount?.(el, close);
  const first = $("input, textarea, select", el);
  if (first) setTimeout(() => first.focus(), 30);
  return { el, close };
}

function confirmDialog({ title, message, confirmText = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const { close } = showModal({
      title,
      body: `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>`,
      footer: `<button class="btn" data-cancel>Cancel</button><button class="btn ${
        danger ? "danger" : "primary"
      }" data-ok>${escapeHtml(confirmText)}</button>`,
      onMount: (el) => {
        $("[data-cancel]", el).onclick = () => {
          close();
          resolve(false);
        };
        $("[data-ok]", el).onclick = () => {
          close();
          resolve(true);
        };
      },
    });
  });
}

function promptDialog({ title, label, value = "", multiline = false, confirmText = "Save" }) {
  return new Promise((resolve) => {
    const field = multiline
      ? `<textarea class="textarea" data-input>${escapeHtml(value)}</textarea>`
      : `<input class="input" data-input value="${escapeHtml(value)}">`;
    const { close } = showModal({
      title,
      body: `<div class="field"><label>${escapeHtml(label)}</label>${field}</div>`,
      footer: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>${escapeHtml(
        confirmText
      )}</button>`,
      onMount: (el) => {
        const input = $("[data-input]", el);
        $("[data-cancel]", el).onclick = () => {
          close();
          resolve(null);
        };
        $("[data-ok]", el).onclick = () => {
          close();
          resolve(input.value.trim());
        };
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !multiline) {
            e.preventDefault();
            close();
            resolve(input.value.trim());
          }
        });
      },
    });
  });
}

function openLightbox(src) {
  const el = document.createElement("div");
  el.className = "lightbox";
  el.innerHTML = `<img src="${String(src).replace(/"/g, "%22")}" alt="">`;
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  const close = () => {
    el.remove();
    document.removeEventListener("keydown", onKey);
  };
  el.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.append(el);
}

// ---------------------------------------------------------------------------
// rendering: sidebar

function threadTitle(thread) {
  if (thread.title) return thread.title;
  const names = thread.characterIds.map((id) => charById(id)?.name).filter(Boolean);
  return names.join(" & ") || "New chat";
}

function renderSidebar() {
  const threadsEl = $("#threadList");
  $("#threadSearchCtn").hidden = state.threads.length < 3 && !state.threadSearch;
  const search = state.threadSearch.trim().toLowerCase();
  threadsEl.innerHTML = state.threads.filter(t => !search || `${threadTitle(t)} ${t.preview || ""}`.toLowerCase().includes(search)).map((t, i) => {
    const first = charById(t.characterIds[0]);
    return `<div class="side-row ${state.thread?.id === t.id ? "active" : ""}" data-action="open-thread" data-id="${t.id}" role="button" tabindex="0">
      ${avatarHtml(first?.name || "?", first?.avatarUrl, 50)}
      <span class="side-row-text"><b>${escapeHtml(t.title || "Unnamed Thread")}</b><span>${escapeHtml(first?.name || "Character")} #${i + 1}</span><span class="thread-id">🧵#${i + 1}</span></span>
      <span class="thread-tools"><button data-action="thread-card-menu" data-id="${t.id}" title="Thread options">⿻</button><button data-action="rename-thread" data-id="${t.id}" title="Rename thread">🏷️</button><button data-action="export-thread-card" data-id="${t.id}" title="Export thread">💾</button><button data-action="delete-thread" data-id="${t.id}" title="Delete thread">🗑️</button></span>
    </div>`;
  }).join("") + `<div class="data-notice"><p style="margin-top:0">Note: Your chat data is stored <b>completely privately</b> in your browser storage — <b>not</b> on a server. If you clear your browser data, your chats will be lost.</p><p>Use the <b>export</b> button below to regularly save backups to your downloads folder.</p><p>Only messages you choose to generate are sent to your configured AI provider.</p></div>`;

  const charsEl = $("#characterList");
  const q = state.characterSearch.trim().toLowerCase();
  const filtered = state.characters.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.tagline || "").toLowerCase().includes(q) ||
      (c.tags || []).some((t) => t.toLowerCase().includes(q))
  );
  if (filtered.length === 0) {
    charsEl.innerHTML = `<div class="side-empty">${
      state.characters.length === 0 ? "No characters yet." : "No matches."
    }</div>`;
  } else {
    charsEl.innerHTML = filtered
      .map(
        (c) => `<div class="side-row" data-action="start-chat" data-id="${c.id}" role="button" tabindex="0">
          ${avatarHtml(c.name, c.avatarUrl, 32)}
          <span class="side-row-text"><b>${escapeHtml(c.name)}</b><span>${escapeHtml(
          c.tagline || "character"
        )}</span></span>
          <button class="side-row-x" data-action="edit-character" data-id="${
            c.id
          }" title="Edit">✏️</button>
        </div>`
      )
      .join("");
  }

  const user = state.userCharacter;
  if (user) {
    $("#userChipAvatar").outerHTML = avatarHtml(user.name, user.avatarUrl, 32, "mini-avatar", "userChipAvatar");
    $("#userChipName").textContent = user.name;
    $("#userChipDesc").textContent = user.description
      ? user.description.slice(0, 42)
      : "tap to edit your persona";
  }
}

function setSidebarOpen(open) {
  state.sidebarOpen = open;
  $("#sidebar").classList.toggle("open", open);
  $("#app").classList.toggle("sidebar-open", open);
}

// ---------------------------------------------------------------------------
// rendering: main

function renderHeader() {
  const header = $("#chatHeader");
  if (state.view !== "chat" || !state.thread) {
    const titles = { discover: "Discover", settings: "Settings" };
    if (state.view === "empty") {
      header.innerHTML = "";
      return;
    }
    header.innerHTML = `
      <button class="icon-btn" id="menuBtn" data-action="toggle-sidebar" aria-label="Menu">${svg("menu")}</button>
      <div class="chat-header-info">
        <div class="chat-header-text"><b>${escapeHtml(titles[state.view] ?? "")}</b></div>
      </div>
    `;
    return;
  }
  const first = threadCharacters()[0];
  header.innerHTML = `<button class="icon-btn" id="menuBtn" data-action="toggle-sidebar" aria-label="Menu">☰</button>
    <div class="reference-header-buttons"><button data-action="edit-character" data-id="${first?.id || ""}">edit character</button><button data-action="edit-user">describe yourself</button></div>${featureToolbarHtml()}`;
  $("#app").classList.toggle("hide-chat-avatars", !!state.thread.hideAvatars);
}

function featureToolbarHtml() {
  const offline = "This Perchance feature is not connected in this project.";
  return `<div id="threadFeatureToolbar" aria-label="Thread feature toolbar">
    <div id="threadWebCtn" class="threadFeatureGroup" title="${offline}"><span>🔎<span class="internet-label"> internet</span></span><button disabled title="${offline}">⚙️</button></div><div class="threadFeatureSep"></div>
    <div id="threadArtStyleCtn" class="threadFeatureGroup"><span>🎨</span><select data-character-art-style title="Art style saved on the current character"><option value="">default</option>${["anime", "photorealistic", "watercolor", "oil painting", "pixel art"].map(v => `<option value="${v}" ${threadCharacters()[0]?.imageStyle === v ? "selected" : ""}>${v}</option>`).join("")}${threadCharacters()[0]?.imageStyle && !["anime", "photorealistic", "watercolor", "oil painting", "pixel art"].includes(threadCharacters()[0].imageStyle) ? `<option selected value="${escapeHtml(threadCharacters()[0].imageStyle)}">custom style</option>` : ""}</select><button disabled title="Perchance's example-image gallery is not connected.">🖼️</button><button data-action="random-art-style" title="Pick a random art style">🎲</button></div><div class="threadFeatureSep"></div>
    <div id="threadImaginationCtn" class="threadFeatureGroup" title="${offline}"><span>✨</span><select disabled aria-label="Imagination flavor"><option>imagination</option></select><button disabled>🎲</button><button disabled>⚙️</button></div><div class="threadFeatureSep"></div>
    <div id="threadNarratorCtn" class="threadFeatureGroup"><span>🎭</span><select disabled title="Advanced narrator voices are not connected."><option>Narrator</option></select><button data-action="narrator-info" title="Narrator information">⚙️</button></div><div class="threadFeatureSep"></div>
    <div id="threadMindCtn" class="threadFeatureGroup" title="${offline}"><span>🧠</span><button disabled>💭</button></div><div class="threadFeatureSep"></div>
    <div id="threadNeedsCtn" class="threadFeatureGroup" title="${offline}"><span>🍗💧</span></div><div class="threadFeatureSep"></div>
    <div id="threadFreeWillCtn" class="threadFeatureGroup" title="${offline}"><span>🕊️</span></div></div>`;
}

function messageHtml(m) {
  const isUser = m.role === "user";
  const cls = m.role === "user" ? "msg-user" : m.role === "system" ? "msg-system" : "msg-char";
  const pics = [];
  if (m.painting) {
    pics.push(`<div class="painting-indicator"><span class="spinner"></span> painting a picture…</div>`);
  }
  for (const src of m.images || []) {
    const safe = String(src).replace(/"/g, "%22");
    pics.push(`<img src="${safe}" data-action="view-image" data-src="${safe}" alt="picture">`);
  }
  const imagesHtml = pics.length ? `<div class="msg-images">${pics.join("")}</div>` : "";
  const time =
    state.settings.showTimestamps && m.createdAt
      ? `<span class="msg-time">${new Date(m.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}</span>`
      : "";
  const head =
    m.role === "system"
      ? ""
      : `<div class="msg-head"><span class="msg-name">${escapeHtml(
          m.authorName || (isUser ? "You" : "Character")
        )}</span>${time}</div>`;
  const avatar =
    m.role === "system"
      ? ""
      : `<div class="msg-avatar">${avatarHtml(
          isUser ? state.userCharacter?.name || "You" : m.authorName || "?",
          isUser ? state.userCharacter?.avatarUrl : charById(m.authorId)?.avatarUrl,
          34
        )}</div>`;
  const body = m.streaming && !m.content ? typingBubble() : renderMessage(m.content);

  return `<div class="msg ${cls}" data-msg-id="${m.id}">
    ${avatar}
    <div class="msg-main">
      ${head}
      <div class="msg-bubble"><div class="msg-content">${body}</div></div>
      ${imagesHtml}
      <div class="msg-actions">
        ${
          m.role === "char" && !m.streaming
            ? `<button class="msg-action" data-action="msg-reroll" title="Write a different reply">🔁</button>`
            : ""
        }
        <button class="msg-action" data-action="msg-illustrate" title="Add a picture">🖼️</button>
        <button class="msg-action" data-action="msg-copy" title="Copy">📋</button>
        <button class="msg-action" data-action="msg-edit" title="Edit">✏️</button>
        <button class="msg-action" data-action="msg-delete" title="Delete">🗑️</button>
      </div>
    </div>
  </div>`;
}

function typingBubble() {
  return `<span class="typing-bubble"><i></i><i></i><i></i></span>`;
}

function emptyThreadHtml() {
  const chars = threadCharacters();
  return `<div class="view"><div class="banner">${
    chars[0] ? `${escapeHtml(chars[0].name)} is waiting for you to say something.` : ""
  }</div></div>`;
}

function renderMessages({ scroll = true } = {}) {
  const el = $("#messages");
  el.className = "messages";
  el.innerHTML = state.messages.map(messageHtml).join("");
  if (scroll) requestAnimationFrame(() => (el.parentElement.scrollTop = el.parentElement.scrollHeight));
}

function isNearBottom() {
  const b = $("#chatBody");
  return b.scrollHeight - b.scrollTop - b.clientHeight < 160;
}
function scrollChatToBottom(smooth = false) {
  const b = $("#chatBody");
  if (smooth) b.scrollTo({ top: b.scrollHeight, behavior: "smooth" });
  else b.scrollTop = b.scrollHeight;
}

function composerHtml() {
  const chars = threadCharacters();
  const talk = autoTalk.state();
  const userName = state.userCharacter?.name || "Anon";
  return `<div id="autoTalkBar"><button data-action="autotalk-start" ${talk.running ? "disabled" : ""}>🎭 let them talk</button>
    ${talk.running ? `<button data-action="autotalk-pause">${talk.paused ? "▶ resume" : "⏸ pause"}</button>` : ""}
    <button data-action="autotalk-settings" title="Auto-talk settings">⚙️</button>
    <span id="autoTalkStatus">${talk.running ? `${talk.paused ? "Paused · " : ""}${talk.completed}/${talk.maxMessages} messages` : `${escapeHtml(chars.map(c => c.name).join(", "))} · up to ${state.autoTalkOptions.maxMessages} messages`}</span></div>
    <div id="shortcutButtonsCtn"><button data-action="shortcut-menu" title="Edit shortcuts">✏️</button>
      ${chars.map(c => `<button data-action="speaker-reply" data-id="${c.id}" ${state.generating ? "disabled" : ""}>🗣️ ${escapeHtml(c.name)}</button>`).join("")}
      <button data-action="speaker-user" ${state.generating ? "disabled" : ""}>🗣️ ${escapeHtml(userName)}</button><button data-action="speaker-narrator" ${state.generating ? "disabled" : ""}>🗣️ Narrator</button><button data-action="composer-image" ${state.generating ? "disabled" : ""}>🖼️ Image</button></div>
    <div class="composer-inner"><textarea id="composerInput" data-thread-id="${state.thread?.id || ""}" rows="3" placeholder="Type your reply here..." autocomplete="off"></textarea>
      <div class="reference-send-column">${state.generating || talk.running
        ? `<button class="send-control" data-action="stop">⏹ stop</button>`
        : `<button class="send-control" data-action="send">send ➡️</button>`}
        <button class="options-control" data-action="thread-menu">⚒️ options</button></div></div>`;
}

function renderComposer() {
  const composer = $("#composer");
  const old = $("#composerInput");
  if (old?.dataset.threadId) state.composerDrafts.set(old.dataset.threadId, old.value);
  const hadFocus = old && document.activeElement === old;
  const selection = old ? [old.selectionStart, old.selectionEnd] : [0, 0];
  if (state.view !== "chat") { composer.innerHTML = ""; composer.hidden = true; return; }
  composer.hidden = false; composer.innerHTML = composerHtml();
  const input = $("#composerInput");
  input.value = state.composerDrafts.get(state.thread?.id) || "";
  const resize = () => { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, window.innerHeight * .6)}px`; };
  resize();
  input.addEventListener("input", () => { state.composerDrafts.set(input.dataset.threadId, input.value); resize(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && state.settings.enterToSend) { e.preventDefault(); sendCurrent(); }
  });
  if (hadFocus) { input.focus(); input.setSelectionRange(...selection); }
}

const autoTalk = createAutoTalkController({
  step: async (character, threadId) => {
    if (state.thread?.id !== threadId || state.view !== "chat") return false;
    setGenerating(true);
    try { return await generateFor(character); }
    finally { setGenerating(false); renderSidebar(); }
  },
  abort: () => { state.generationStopped = true; state.stopCurrent?.(); window.root.stopAllTextGenerations?.(); },
  onChange: () => { if (state.view === "chat") renderComposer(); },
  onError: (error) => { console.error(error); toast("Auto-talk stopped after an error.", "error"); },
});

async function generateSpeaker(character, speakerRole = "char") {
  if (state.generating || !state.thread) return;
  await autoTalk.stop();
  setGenerating(true);
  try { await generateFor(character, { speakerRole }); }
  finally { setGenerating(false); renderSidebar(); }
  if (!state.generationStopped) backgroundSummarize().catch(console.error);
}

function openAutoTalkSettings() {
  showModal({ title: "🎭 Let them talk", body: `<p>Characters take turns without a user message. Each generated reply uses your configured AI provider and may incur its usual charges. Nothing starts until you press Start.</p>
    <p>Current participants: ${escapeHtml(threadCharacters().map(c => c.name).join(", ") || "none")}. Add characters from ⚒️ options.</p>
    <div class="field"><label>Maximum messages (1–100)</label><input class="input" id="autoTalkMax" type="number" min="1" max="100" value="${state.autoTalkOptions.maxMessages}"></div>
    <div class="field"><label>Pause between replies (0–60 seconds)</label><input class="input" id="autoTalkDelay" type="number" min="0" max="60" value="${state.autoTalkOptions.pauseMs / 1000}"></div>
    <p>Pause suspends the next turn. Stop cancels the current request. Switching chats or pages also stops the run. Runs never resume after a reload.</p>`,
    footer: `<button class="btn" data-close>Cancel</button><button class="btn" data-save>Save</button>`,
    onMount: (el, close) => { $("[data-save]", el).onclick = () => {
      const maxMessages = Number($("#autoTalkMax", el).value), seconds = Number($("#autoTalkDelay", el).value);
      if (!Number.isInteger(maxMessages) || maxMessages < 1 || maxMessages > 100 || !Number.isFinite(seconds) || seconds < 0 || seconds > 60) { toast("Choose 1–100 messages and a pause of 0–60 seconds.", "error"); return; }
      state.autoTalkOptions = { maxMessages, pauseMs: seconds * 1000 }; close(); renderComposer();
    }; },
  });
}

async function startAutoTalk() {
  if (state.generating || autoTalk.state().running || !state.thread) return;
  const characters = threadCharacters();
  if (characters.length < 2) { toast("Add a second character from ⚒️ options → Add a character first."); return; }
  const threadId = state.thread.id;
  if (!await confirmDialog({ title: "🎭 Let them talk", message: `Generate up to ${state.autoTalkOptions.maxMessages} alternating character replies? Your configured provider may charge for each reply. Pause or Stop at any time.`, confirmText: "Start" })) return;
  if (state.thread?.id !== threadId || state.generating || state.view !== "chat") return;
  await autoTalk.start({ characters, threadId, ...state.autoTalkOptions });
  if (state.thread?.id === threadId && !state.generationStopped) backgroundSummarize().catch(console.error);
}

function openSettingsDialog() {
  showModal({ title: "⚙️ Settings", body: `<div class="settings-dialog">${settingsHtml()}</div>`, wide: true });
}

function renderMain() {
  renderHeader();
  renderComposer();
  const el = $("#messages");
  if (state.view === "chat") {
    renderMessages();
    return;
  }
  el.className = "messages view-host";
  if (state.view === "discover") el.innerHTML = discoverHtml();
  else if (state.view === "settings") el.innerHTML = settingsHtml();
  else if (state.view === "character") el.innerHTML = "";
  else el.innerHTML = welcomeHtml();
  $("#chatBody").scrollTop = 0;
}

// ---------------------------------------------------------------------------
// views

function welcomeHtml() {
  return `<div class="view">
    <h2>Your characters</h2>
    <p class="sub">Everything here is saved privately on this device. No account, no limits.</p>
    <div class="card-grid">
      <button class="char-card" data-action="new-character">
        <div class="char-card-top">${svg("plus")}<b>Create a character</b></div>
        <p>Give them a name, a personality, and a look. Takes a minute.</p>
      </button>
      <button class="char-card" data-action="discover">
        <div class="char-card-top">${svg("sparkles")}<b>Browse starters</b></div>
        <p>Companions, adventurers, detectives and more - ready to chat.</p>
      </button>
    </div>
  </div>`;
}

function discoverHtml() {
  const owned = new Set(state.characters.map((c) => c.name.toLowerCase()));
  return `<div class="view">
    <h2>Starter characters</h2>
    <p class="sub">Click one to copy it into your library and start chatting. You can edit anything about it afterwards.</p>
    <div class="card-grid"><button class="char-card" data-action="new-character"><b>✏️ create a character</b></button>
      ${state.characters.map(c => `<div class="char-card"><button data-action="start-chat" data-id="${c.id}">${avatarHtml(c.name, c.avatarUrl, 50)} ${escapeHtml(c.name)}</button><p>${escapeHtml(c.tagline || "Saved character")}</p><button data-action="edit-character" data-id="${c.id}">edit character</button></div>`).join("")}</div>
    <h3>Character templates</h3><div class="card-grid">
      ${presetCharacters
        .map(
          (p) => `<button class="char-card" data-action="add-preset" data-id="${p.id}">
            <div class="char-card-top">${avatarHtml(p.name, p.avatarUrl, 40)}<b>${escapeHtml(
            p.name
          )}</b></div>
            <p>${escapeHtml(p.description)}</p>
            <div class="tag-row">${(p.tags || [])
              .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
              .join("")}</div>
          </button>`
        )
        .join("")}
      <button class="char-card" data-action="new-character">
        <div class="char-card-top">${svg("plus")}<b>Start from scratch</b></div>
        <p>Build a character with your own personality, greeting and custom code.</p>
      </button>
    </div>
    <h2 style="margin-top:28px;">Bring your own</h2>
    <p class="sub">Import a character someone shared with you as a JSON file or pasted text.</p>
    <button class="btn" data-action="import-character">${svg("upload")} Import character JSON</button>
  </div>`;
}

function settingsHtml() {
  const s = state.settings;
  return `<div class="view">
    <h2>Settings</h2>
    <p class="sub">Applies to this device only.</p>

    <div class="field">
      <label>Appearance</label>
      <div class="row">
        <select class="input" data-setting="theme">
          <option value="dark" ${s.theme === "dark" ? "selected" : ""}>Dark</option>
          <option value="light" ${s.theme === "light" ? "selected" : ""}>Light</option>
        </select>
        <select class="input" data-setting="fontSize">
          ${[13, 14, 15, 16, 17, 18]
            .map((n) => `<option value="${n}" ${Number(s.fontSize) === n ? "selected" : ""}>${n}px text</option>`)
            .join("")}
        </select>
      </div>
    </div>

    <div class="field">
      <label>Behaviour</label>
      <div class="checkbox-row"><input type="checkbox" data-setting="enterToSend" ${
        s.enterToSend ? "checked" : ""
      }> <span>Enter sends the message (Shift+Enter for a new line)</span></div>
      <div class="checkbox-row"><input type="checkbox" data-setting="showTimestamps" ${
        s.showTimestamps ? "checked" : ""
      }> <span>Show timestamps on messages</span></div>
      <div class="checkbox-row"><input type="checkbox" data-setting="autoSummarize" ${
        s.autoSummarize ? "checked" : ""
      }> <span>Keep long chats coherent (fold old messages into a summary in the background)</span></div>
      <div class="help">Long conversations eventually outgrow what the model can read at once. When that happens, older
      messages are quietly summarized into a paragraph the character still remembers. It makes an additional AI request, which may be billed by your provider.</div>
    </div>

    <div class="field">
      <label>Your data</label>
      <div class="row">
        <button class="btn" data-action="export-data">${svg("download")} Export everything</button>
        <button class="btn" data-action="import-data">${svg("upload")} Import backup</button>
      </div>
      <div class="help">Exports every character, chat, and persona as a single JSON file.</div>
    </div>

    <div class="field">
      <label>Danger zone</label>
      <button class="btn danger" data-action="wipe-data">${svg("trash")} Delete all characters and chats</button>
    </div>

    <p class="sub" style="margin-top:26px;font-size:12px;">Built on Perchance · ${escapeHtml(
      window.generatorName || ""
    )}</p>
  </div>`;
}

// ---------------------------------------------------------------------------
// data flow

async function reloadAll() {
  state.characters = await store.listCharacters();
  state.threads = await store.listThreads();
  state.userCharacters = await store.listUserCharacters();
  state.userCharacter = await store.getActiveUserCharacter();
}

async function persistMessages({ preview = true } = {}) {
  if (!state.thread) return;
  await store.setMessages(state.thread.id, state.messages);
  if (preview) {
    const last = [...state.messages].reverse().find((m) => m.content);
    state.thread.preview = last ? `${last.content}`.replace(/\s+/g, " ").slice(0, 70) : "";
  }
  state.thread.updatedAt = Date.now();
  await store.saveThread(state.thread);
  const i = state.threads.findIndex((t) => t.id === state.thread.id);
  if (i >= 0) state.threads[i] = state.thread;
  else state.threads.unshift(state.thread);
  state.threads.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function openThread(id) {
  await autoTalk.stop();
  const thread = await store.getThread(id);
  if (!thread) return;
  state.thread = thread;
  state.messages = await store.getMessages(id);
  state.view = "chat";
  setSidebarOpen(false);
  renderSidebar();
  renderMain();
}

async function startChat(characterIds, { open = true } = {}) {
  await autoTalk.stop();
  const ids = [...new Set(characterIds)].filter(Boolean);
  if (ids.length === 0) return null;
  let thread = await store.findThreadForCharacters(ids);
  if (!thread) {
    thread = newThread(ids);
    await store.saveThread(thread);
    const chars = ids.map(charById).filter(Boolean);
    const messages = [];
    for (const c of chars) {
      if (c.greeting) {
        messages.push(
          newMessage({
            role: "char",
            authorId: c.id,
            authorName: c.name,
            content: c.greeting.replaceAll("{{char}}", c.name).replaceAll("{{user}}", state.userCharacter?.name || "You"),
          })
        );
      }
    }
    if (messages.length) await store.setMessages(thread.id, messages);
    await reloadAll();
  }
  if (open) await openThread(thread.id);
  else renderSidebar();
  return thread;
}

async function newCharAndEdit() {
  const draft = newCharacter();
  await store.saveCharacter(draft);
  await reloadAll();
  openCharacterEditor(charById(draft.id));
}

function openThreadMenu(anchor) {
  showPopover(anchor, [
    { label: "🚫👤 toggle pics", onSelect: async () => { state.thread.hideAvatars = !state.thread.hideAvatars; await store.saveThread(state.thread); renderHeader(); } },
    { label: "🪪 describe yourself…", onSelect: openPersonaEditor },
    { label: "👤 change user pic", onSelect: openPersonaEditor },
    { label: `🗣️ toggle autoreply (${state.thread.autoReply === false ? "off" : "on"})`, onSelect: async () => { state.thread.autoReply = state.thread.autoReply === false; await store.saveThread(state.thread); } },
    { label: "🎭 auto-talk & who talks…", onSelect: openAutoTalkSettings },
    { label: "✨ imagination…", disabled: true, title: "Perchance imagination is not connected." },
    { label: "🎭 narrator…", onSelect: () => CLICK_ACTIONS["narrator-info"]() },
    { label: "🎬 image direction…", disabled: true, title: "Standing image-direction instructions are not implemented." },
    { label: "🔎 image research…", disabled: true, title: "Perchance image research is not connected." },
    { label: "🧠 inner lives…", disabled: true, title: "Perchance inner-life simulation is not connected." },
    { label: "🕊️ free will…", disabled: true, title: "Background autonomous activity is not implemented; use bounded auto-talk." },
    { label: "📏 response length…", disabled: true, title: "Reply maximum is 2,048 tokens; source response-length profiles are not implemented." },
    { label: "✏️ edit character", onSelect: () => { const c = threadCharacters()[0]; if (c) openCharacterEditor(c); } },
    { label: "💬 reply as…", onSelect: () => toast("Use the 🗣️ buttons above the composer to choose a speaker.") },
    "hr",
    {
      label: "🏷️ Rename chat",
      onSelect: async () => {
        const title = await promptDialog({
          title: "Rename chat",
          label: "Chat name",
          value: state.thread.title || "",
        });
        if (title === null) return;
        state.thread.title = title;
        await persistMessages({ preview: false });
        renderHeader();
        renderSidebar();
      },
    },
    {
      label: "➕ add character",
      onSelect: () =>
        openCharacterPicker({
          multi: true,
          exclude: state.thread.characterIds,
          onPick: (ids) => addCharactersToThread(ids),
        }),
    },
    { label: "💾 export transcript", onSelect: exportThread },
    "hr",
    {
      label: "Clear all messages",
      danger: true,
      onSelect: async () => {
        if (
          !(await confirmDialog({
            title: "Clear messages",
            message: "Delete every message in this chat?",
            confirmText: "Clear",
            danger: true,
          }))
        )
          return;
        state.messages = [];
        state.thread.summary = "";
        state.thread.summaryUpTo = 0;
        state.thread.preview = "";
        await persistMessages();
        renderMessages();
      },
    },
    {
      label: "Delete chat",
      danger: true,
      onSelect: async () => {
        if (
          !(await confirmDialog({
            title: "Delete chat",
            message: "Delete this chat and its messages?",
            confirmText: "Delete",
            danger: true,
          }))
        )
          return;
        await store.deleteThread(state.thread.id);
        state.thread = null;
        state.messages = [];
        state.view = state.characters.length ? "empty" : "empty";
        await reloadAll();
        renderSidebar();
        renderMain();
      },
    },
  ]);
}

function exportThread() {
  const lines = [];
  for (const c of threadCharacters()) {
    const descBits = [];
    if (c.tagline) descBits.push(`*${c.tagline}*`);
    if (c.description) descBits.push(c.description);
    if (c.roleInstruction) descBits.push(c.roleInstruction);
    lines.push(`# ${c.name}\n${descBits.join("\n")}`);
  }
  lines.push("\n---\n");
  for (const m of state.messages) {
    lines.push(`${m.role === "user" ? m.authorName : m.authorName}: ${m.content}`);
  }
  const blob = new Blob([lines.join("\n\n")], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${threadTitle(state.thread).replace(/[^\w-]+/g, "_")}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function openCharacterPicker({ multi, exclude = [], onPick }) {
  const available = state.characters.filter((c) => !exclude.includes(c.id));
  if (available.length === 0) {
    toast("You have no other characters yet.", "error");
    return;
  }
  const body = `<div class="side-list">${available
    .map(
      (c) => `<label class="side-row" style="cursor:pointer;">
        ${avatarHtml(c.name, c.avatarUrl, 36)}
        <span class="side-row-text"><b>${escapeHtml(c.name)}</b><span>${escapeHtml(
        c.tagline || ""
      )}</span></span>
        <input type="checkbox" value="${c.id}" ${
        multi ? "" : `name="single"`
      } style="width:17px;height:17px;accent-color:var(--accent);">
      </label>`
    )
    .join("")}</div>`;
  showModal({
    title: multi ? "Choose characters" : "Choose a character",
    body,
    footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>${
      multi ? "Start chat" : "Start chat"
    }</button>`,
    onMount: (el, close) => {
      $("[data-ok]", el).onclick = () => {
        const checked = $$("input[type=checkbox]:checked", el).map((i) => i.value);
        if (checked.length === 0) {
          toast("Pick at least one character.", "error");
          return;
        }
        close();
        onPick?.(multi ? checked : checked[0]);
      };
    },
  });
}

async function addCharactersToThread(ids) {
  if (!state.thread) return;
  const merged = [...new Set([...state.thread.characterIds, ...ids])];
  const added = merged.filter((id) => !state.thread.characterIds.includes(id));
  if (added.length === 0) return;
  state.thread.characterIds = merged;
  for (const id of added) {
    const c = charById(id);
    state.messages.push(newMessage({ role: "system", content: `${c.name} joined the chat.` }));
  }
  await persistMessages({ preview: false });
  renderHeader();
  renderSidebar();
  renderMessages();
  renderComposer();
}

// ---------------------------------------------------------------------------
// generation

function setGenerating(on) {
  state.generating = on;
  if (on) state.generationStopped = false;
  renderComposer();
}

async function generateFor(character, { replaceMessageId = null, speakerRole = "char" } = {}) {
  if (!state.thread) return;
  const cast = threadCharacters();
  const chars = speakerRole === "system" ? [...cast, character] : cast;
  const user = state.userCharacter || { name: "You", description: "" };

  let placeholder;
  if (replaceMessageId) {
    placeholder = state.messages.find((m) => m.id === replaceMessageId);
    placeholder.content = "";
    placeholder.images = [];
  } else {
    placeholder = newMessage({ role: speakerRole, authorId: character.id, authorName: character.name });
    state.messages.push(placeholder);
  }
  placeholder.streaming = true;
  state.streamingId = placeholder.id;
  renderMessages();

  const context = state.messages.filter((m) => m.id !== placeholder.id);
  let painted = "";
  let cancelled = false;
  let failed = false;
  let lastPaint = 0;

  try {
    const { text } = await requestReply({
      focusCharacter: character,
      speakerRole,
      characters: chars,
      user,
      messages: context,
      summary: state.thread.summary || "",
      summaryUpTo: state.thread.summaryUpTo || 0,
      onStart: (promise) => {
        state.stopCurrent = () => promise.stop?.();
      },
      onChunk: (full) => {
        if (state.generationStopped) return;
        painted = full;
        const t = performance.now();
        if (t - lastPaint > 70) {
          lastPaint = t;
          paintStreaming(placeholder.id, painted, character.name);
        }
      },
    });
    if (state.generationStopped) throw new DOMException("Generation stopped", "AbortError");
    placeholder.content = text || painted || "";
  } catch (error) {
    cancelled = error.name === "AbortError" || state.generationStopped;
    failed = !cancelled;
    placeholder.content = placeholder.content || "";
    if (!cancelled) {
      console.error(error);
      toast("The message could not be generated. Try again.", "error");
    }
  }
  delete placeholder.streaming;
  state.streamingId = null;
  state.stopCurrent = null;

  if (cancelled || failed) {
    if (!placeholder.content) state.messages = state.messages.filter((m) => m.id !== placeholder.id);
    renderMessages();
    await persistMessages();
    return false;
  }

  // Inline picture requests: [[image: a castle at dusk]]
  const extracted = extractImageRequest(placeholder.content);
  placeholder.content = extracted.text;
  let imagePrompt = extracted.imagePrompt;
  const auto = character.autoImage || "never";
  if (!imagePrompt && auto === "always") imagePrompt = "";
  else if (!imagePrompt && auto === "sometimes" && Math.random() < 0.34) imagePrompt = "";

  renderMessages();
  await persistMessages();

  if (imagePrompt !== null && imagePrompt !== undefined) {
    placeholder.painting = true;
    renderMessages();
    try {
      const prompt = imagePrompt || (await makeImagePrompt({ messages: state.messages, characters: chars, user, summary: state.thread.summary || "", summaryUpTo: state.thread.summaryUpTo || 0 }));
      if (state.generationStopped) throw new DOMException("Generation stopped", "AbortError");
      const url = await generateImageFor(prompt, character.imageStyle || "", characterAppearance(character, user));
      if (url && !state.generationStopped) placeholder.images.push(url);
    } catch (error) {
      if (error.name !== "AbortError" && !state.generationStopped) {
        console.error(error);
        toast("Image generation failed.", "error");
      }
    }
    delete placeholder.painting;
    renderMessages();
    await persistMessages();
  }

  if (state.generationStopped) return false;

  if (character.customCode && character.customCode.trim()) {
    const oc = createOc({
      character,
      characters: chars,
      user,
      thread: state.thread,
      messages: state.messages,
      message: placeholder,
    });
    const res = await runCustomCode(character.customCode, oc);
    if (!res.ok) {
      toast(`Custom code error in ${character.name}: ${res.error}`, "error");
      console.error(res.error);
    }
    renderMessages();
    await persistMessages();
  }

  scrollChatToBottom();
}

function paintStreaming(id, full, name) {
  const node = document.querySelector(`[data-msg-id="${id}"] .msg-content`);
  if (!node) return;
  const text = full.replace(new RegExp(`^\\s*\\*{0,2}${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*{0,2}\\s*:\\s*`, "i"), "");
  node.innerHTML = text ? renderMessage(text) : typingBubble();
  if (isNearBottom()) scrollChatToBottom();
}

async function sendCurrent() {
  if (autoTalk.state().running) await autoTalk.stop();
  if (state.generating || !state.thread) return;
  const input = $("#composerInput");
  const text = (input?.value || "").trim();
  if (!text) return;
  input.value = "";
  state.composerDrafts.delete(state.thread.id);
  input.style.height = "auto";
  await sendMessage(text);
}

async function sendMessage(text) {
  const chars = threadCharacters();
  if (chars.length === 0) {
    toast("This chat has no characters left.", "error");
    return;
  }
  state.messages.push(
    newMessage({
      role: "user",
      authorId: state.userCharacter?.id,
      authorName: state.userCharacter?.name || "You",
      content: text,
    })
  );
  await persistMessages();
  renderMessages();
  renderSidebar();
  if (state.thread.autoReply === false) return;
  setGenerating(true);
  try {
    for (const character of chars) {
      if (state.generationStopped || (await generateFor(character)) === false) break;
    }
  } finally {
    setGenerating(false);
    renderSidebar();
  }
  if (!state.generationStopped) backgroundSummarize();
}

async function reroll(messageId) {
  if (state.generating) return;
  const message = state.messages.find((m) => m.id === messageId);
  if (!message) return;
  const character = charById(message.authorId) || threadCharacters()[0];
  if (!character) return;
  const index = state.messages.indexOf(message);
  state.messages = state.messages.slice(0, index);
  renderMessages();
  setGenerating(true);
  try {
    await generateFor(character);
  } finally {
    setGenerating(false);
  }
}

async function backgroundSummarize() {
  if (!state.settings.autoSummarize || state.summarizing || !state.thread || state.generationStopped) return;
  const thread = state.thread;
  const chars = threadCharacters();
  const user = state.userCharacter || { name: "You", description: "" };
  const snapshot = state.messages.slice();
  const keep = Number(config().verbatimMessageCount) || 12;
  if (snapshot.length <= keep + 4) return;

  const tokens = promptTokenCount({
    characters: chars,
    user,
    messages: snapshot,
    summary: thread.summary,
    summaryUpTo: thread.summaryUpTo,
  });
  const fraction = Number(config().summaryTriggerFraction) || 0.75;
  if (tokens < idealMaxContextTokens() * fraction) return;

  state.summarizing = true;
  renderComposer();
  try {
    const result = await summarizeThread({
      characters: chars,
      user,
      messages: snapshot,
      summary: thread.summary,
      summaryUpTo: thread.summaryUpTo,
      keepVerbatim: keep,
    });
    if (result && !state.generationStopped && state.thread && state.thread.id === thread.id) {
      state.thread.summary = result.summary;
      state.thread.summaryUpTo = result.summaryUpTo;
      await store.saveThread(state.thread);
    }
  } catch (error) {
    if (error.name !== "AbortError") console.error("Summarization failed", error);
  } finally {
    state.summarizing = false;
    renderComposer();
  }
}

async function illustrate(messageId) {
  if (state.generating) return;
  const chars = threadCharacters();
  const user = state.userCharacter || { name: "You", description: "" };
  const target =
    state.messages.find((m) => m.id === messageId) ||
    [...state.messages].reverse().find((m) => m.role === "char");
  if (!target) {
    toast("Nothing to illustrate yet.", "error");
    return;
  }
  target.painting = true;
  renderMessages();
  try {
    const prompt = await makeImagePrompt({
      messages: state.messages.slice(0, state.messages.indexOf(target) + 1),
      characters: chars,
      user,
      summary: state.thread.summary || "",
      summaryUpTo: state.thread.summaryUpTo || 0,
    });
    const url = await generateImageFor(prompt, charById(target.authorId)?.imageStyle || "", characterAppearance(charById(target.authorId) || {}, user));
    if (url) {
      if (!target.images) target.images = [];
      target.images.push(url);
    }
  } catch (error) {
    console.error(error);
    toast("Image generation failed.", "error");
  }
  delete target.painting;
  renderMessages();
  await persistMessages();
}

async function imageFromPrompt() {
  const prompt = await promptDialog({
    title: "Generate a picture",
    label: "Describe the picture",
    multiline: true,
    confirmText: "Generate",
  });
  if (!prompt) return;
  const msg = newMessage({
    role: "system",
    content: `*${prompt}*`,
  });
  msg.painting = true;
  state.messages.push(msg);
  renderMessages();
  try {
    const user = state.userCharacter || { name: "You", description: "" };
    const castLooks = threadCharacters().map((c) => characterAppearance(c, user)).filter(Boolean).join("; ");
    const url = await generateImageFor(prompt, "", castLooks);
    if (url) msg.images.push(url);
  } catch (error) {
    console.error(error);
    toast("Image generation failed.", "error");
  }
  delete msg.painting;
  renderMessages();
  await persistMessages();
}

// ---------------------------------------------------------------------------
// character editor

function openCharacterEditor(character) {
  const isNew = !character.createdAt || character.__draft;
  const draft = { ...character, tags: [...(character.tags || [])] };
  const body = `
    <div class="field">
      <label>Avatar</label>
      <div class="avatar-picker">
        <span id="avatarPreview">${avatarHtml(draft.name, draft.avatarUrl, 66)}</span>
        <div class="avatar-picker-controls">
          <div class="row">
            <button class="btn" data-avatar-generate>${svg("sparkles")} Generate</button>
            <button class="btn" data-avatar-upload>${svg("upload")} Upload</button>
          </div>
          <input class="input" data-field="avatarUrl" placeholder="…or paste an image URL" value="${escapeHtml(
            draft.avatarUrl || ""
          )}">
          <input type="file" accept="image/*" data-avatar-file hidden>
        </div>
      </div>
      <div class="help">Not sure what to write? Leave the prompt empty and I'll make one from the name and tagline.</div>
    </div>

    <div class="row">
      <div class="field"><label>Name</label><input class="input" data-field="name" value="${escapeHtml(
        draft.name
      )}"></div>
      <div class="field"><label>Tagline</label><input class="input" data-field="tagline" placeholder="A few words" value="${escapeHtml(
        draft.tagline || ""
      )}"></div>
    </div>

    <div class="field"><label>Tags</label><input class="input" data-field="tags" placeholder="fantasy, mentor, comedy" value="${escapeHtml(
      (draft.tags || []).join(", ")
    )}"><div class="help">Comma separated. Used for search.</div></div>

    <div class="field">
      <label>Personality &amp; instructions</label>
      <textarea class="textarea" data-field="roleInstruction" style="min-height:150px;" placeholder="Describe who they are, how they speak, what they care about, and how they should behave.">${escapeHtml(
        draft.roleInstruction || ""
      )}</textarea>
      <div class="help">This is the character's soul. Use <code>{{char}}</code> for their name and <code>{{user}}</code> for yours. Written in second person ("You are…") or third person ("Bob is…") - both work.</div>
    </div>

    <div class="field">
      <label>Greeting</label>
      <textarea class="textarea" data-field="greeting" placeholder="What they say when the chat opens.">${escapeHtml(
        draft.greeting || ""
      )}</textarea>
    </div>

    <details class="field">
      <summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--muted);">Example dialogue (optional)</summary>
      <textarea class="textarea" data-field="exampleDialogue" style="margin-top:8px;min-height:110px;" placeholder="{{user}}: Hello!&#10;{{char}}: *She waves.* Well, look who it is.">${escapeHtml(
        draft.exampleDialogue || ""
      )}</textarea>
      <div class="help">A short exchange showing how they write. Great for locking in a voice.</div>
    </details>

    <details class="field">
      <summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--muted);">Pictures</summary>
      <div style="margin-top:10px;">
        <div class="field">
          <label>Let them send pictures</label>
          <select class="input" data-field="autoImage">
            <option value="never" ${draft.autoImage === "never" ? "selected" : ""}>Never (only when I ask)</option>
            <option value="sometimes" ${
              draft.autoImage === "sometimes" ? "selected" : ""
            }>Occasionally, when it fits</option>
            <option value="always" ${draft.autoImage === "always" ? "selected" : ""}>With every reply</option>
          </select>
        </div>
        <div class="field">
          <label>Image style</label>
          <input class="input" data-field="imageStyle" placeholder="anime key visual, soft lighting" value="${escapeHtml(
            draft.imageStyle || ""
          )}">
          <div class="help">Appended to any picture this character makes. In a reply they can also ask for one directly with <code>[[image: a cat on a throne]]</code>.</div>
        </div>
      </div>
    </details>

    <details class="field">
      <summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--muted);">Custom code (advanced)</summary>
      <div style="margin-top:10px;">
        <div class="banner">Runs after every reply this character writes. It can rewrite the reply, attach generated
        pictures, add extra messages, or react to what you said.</div>
        <textarea class="textarea code" data-field="customCode" placeholder="// e.g.&#10;if (Math.random() &lt; 0.3) {&#10;  await oc.sendImage(&quot;a polaroid of a rainy street at night&quot;);&#10;}">${escapeHtml(
          draft.customCode || ""
        )}</textarea>
        <div class="help">
          <b>oc.message</b> - the reply just written. <b>oc.thread.messages</b> - the whole conversation
          (<code>{role, authorName, content, images}</code>). <b>oc.character</b> / <b>oc.user</b> /
          <b>oc.characters</b>.<br>
          <b>oc.setMessageContent(text)</b>, <b>oc.appendMessageContent(text)</b>, <b>oc.addImage(url)</b>,
          <b>oc.sendImage(prompt)</b> (generate + attach), <b>oc.generateImage(prompt)</b>,
          <b>oc.addMessage({content, role, authorName})</b>, <b>oc.deleteMessage(id)</b>, <b>oc.delay(ms)</b>,
          <b>oc.utils.pick(array)</b>, <b>oc.utils.random()</b>, <b>oc.console.log(…)</b>.
        </div>
      </div>
    </details>
  `;

  const footer = `
    <button class="btn danger" data-delete>Delete</button>
    <button class="btn" data-share>${svg("link")} Share</button>
    <button class="btn" data-export>${svg("download")} Export</button>
    <span class="spacer"></span>
    <button class="btn" data-close>Cancel</button>
    <button class="btn primary" data-save>Save</button>
  `;

  const { el, close } = showModal({
    title: isNew ? "New character" : `Edit ${character.name}`,
    body,
    footer,
    wide: true,
    onMount: (root) => {
      const val = (field) => $(`[data-field="${field}"]`, root).value.trim();
      const refreshPreview = () => {
        const name = val("name") || "?";
        $("#avatarPreview", root).outerHTML = avatarHtml(val("name") || name, val("avatarUrl"), 66, "", "avatarPreview");
      };
      $$("[data-field]", root).forEach((input) => input.addEventListener("input", refreshPreview));

      $("[data-avatar-generate]", root).onclick = async () => {
        const btn = $("[data-avatar-generate]", root);
        const bits = [val("name") || "a character"];
        if (val("tagline")) bits.push(val("tagline"));
        if (draft.description) bits.push(String(draft.description).replace(/\s+/g, " "));
        if (val("tags")) bits.push(val("tags"));
        if (val("roleInstruction")) bits.push(val("roleInstruction").replace(/\s+/g, " "));
        const prompt = `${bits.join(", ")}, character portrait, head and shoulders, centered, simple background, digital painting`;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Painting…`;
        try {
          const url = await generateImageFor(prompt, "", undefined, { resolution: "512x512" });
          $('[data-field="avatarUrl"]', root).value = url;
          refreshPreview();
        } catch (error) {
          console.error(error);
          toast("Couldn't generate an avatar.", "error");
        }
        btn.disabled = false;
        btn.innerHTML = `${svg("sparkles")} Generate`;
      };

      const fileInput = $('[data-avatar-file]', root);
      $("[data-avatar-upload]", root).onclick = () => fileInput.click();
      fileInput.onchange = () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          $('[data-field="avatarUrl"]', root).value = reader.result;
          refreshPreview();
        };
        reader.readAsDataURL(file);
      };

      $("[data-save]", root).onclick = async () => {
        const updated = {
          ...draft,
          name: val("name") || "Unnamed",
          tagline: val("tagline"),
          avatarUrl: val("avatarUrl"),
          roleInstruction: $('[data-field="roleInstruction"]', root).value,
          greeting: $('[data-field="greeting"]', root).value,
          exampleDialogue: $('[data-field="exampleDialogue"]', root).value,
          customCode: $('[data-field="customCode"]', root).value,
          autoImage: $('[data-field="autoImage"]', root).value,
          imageStyle: val("imageStyle"),
          tags: val("tags")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        };
        delete updated.__draft;
        await store.saveCharacter(updated);
        await reloadAll();
        close();
        renderSidebar();
        renderHeader();
        if (state.view === "chat") renderMessages();
      };

      $("[data-delete]", root).onclick = async () => {
        if (
          !(await confirmDialog({
            title: `Delete ${character.name}?`,
            message: "This removes the character and every chat with them. It cannot be undone.",
            confirmText: "Delete",
            danger: true,
          }))
        )
          return;
        await store.deleteCharacter(character.id);
        await reloadAll();
        close();
        if (state.thread && !state.thread.characterIds.length) {
          state.thread = null;
          state.messages = [];
          state.view = "empty";
        }
        renderSidebar();
        renderMain();
      };

      $("[data-export]", root).onclick = () => {
        const json = JSON.stringify({ type: "perchance-character", version: 1, character: draft }, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${(draft.name || "character").replace(/[^\w-]+/g, "_")}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      };

      $("[data-share]", root).onclick = () => shareCharacter(draft);
    },
  });
  return { el, close };
}

// ---------------------------------------------------------------------------
// personas

function openPersonaEditor() {
  const user = state.userCharacter || newUserCharacter();
  const isNew = !state.userCharacter;
  const body = `
    <div class="field">
      <label>Avatar</label>
      <div class="avatar-picker">
        <span id="personaPreview">${avatarHtml(user.name, user.avatarUrl, 66)}</span>
        <div class="avatar-picker-controls">
          <input class="input" data-field="avatarUrl" placeholder="Paste an image URL" value="${escapeHtml(
            user.avatarUrl || ""
          )}">
          <button class="btn" data-avatar-upload>${svg("upload")} Upload an image</button>
          <input type="file" accept="image/*" data-avatar-file hidden>
        </div>
      </div>
    </div>
    <div class="field"><label>Your name</label><input class="input" data-field="name" value="${escapeHtml(
      user.name
    )}"></div>
    <div class="field">
      <label>About you</label>
      <textarea class="textarea" data-field="description" placeholder="Anything the characters should know about you - your appearance, your role in the story, your pronouns…">${escapeHtml(
        user.description || ""
      )}</textarea>
      <div class="help">Characters see this, so it's the best place to establish who you are in a roleplay.</div>
    </div>
    ${
      state.userCharacters.length > 1
        ? `<div class="field"><label>Other personas</label><div class="side-list">${state.userCharacters
            .filter((u) => u.id !== user.id)
            .map(
              (u) => `<div class="side-row" data-use-persona="${u.id}" role="button" tabindex="0">
              ${avatarHtml(u.name, u.avatarUrl, 32)}
              <span class="side-row-text"><b>${escapeHtml(u.name)}</b></span>
              ${svg("chevron")}
            </div>`
            )
            .join("")}</div></div>`
        : ""
    }
  `;
  showModal({
    title: "Your persona",
    body,
    footer: `<button class="btn" data-new-persona>${svg("plus")} Add persona</button><span class="spacer"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button>`,
    onMount: (root, close) => {
      const val = (f) => $(`[data-field="${f}"]`, root).value.trim();
      const refresh = () => {
        $("#personaPreview", root).outerHTML = avatarHtml(
          val("name") || "You",
          val("avatarUrl"),
          66,
          "",
          "personaPreview"
        );
      };
      $$("[data-field]", root).forEach((i) => i.addEventListener("input", refresh));
      const fileInput = $("[data-avatar-file]", root);
      $("[data-avatar-upload]", root).onclick = () => fileInput.click();
      fileInput.onchange = () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          $('[data-field="avatarUrl"]', root).value = reader.result;
          refresh();
        };
        reader.readAsDataURL(file);
      };
      $$("[data-use-persona]", root).forEach((row) => {
        row.onclick = async () => {
          await store.saveSettings({ activeUserCharacterId: row.dataset.usePersona });
          state.settings = await store.getSettings();
          await reloadAll();
          close();
          renderSidebar();
          toast("Persona switched");
        };
      });
      $("[data-new-persona]", root).onclick = async () => {
        const fresh = newUserCharacter({ name: "New persona" });
        await store.saveUserCharacter(fresh);
        await store.saveSettings({ activeUserCharacterId: fresh.id });
        await reloadAll();
        close();
        renderSidebar();
        openPersonaEditor();
      };
      $("[data-save]", root).onclick = async () => {
        const updated = {
          ...user,
          name: val("name") || "You",
          avatarUrl: val("avatarUrl"),
          description: $('[data-field="description"]', root).value,
        };
        await store.saveUserCharacter(updated);
        await store.saveSettings({ activeUserCharacterId: updated.id });
        state.settings = await store.getSettings();
        await reloadAll();
        close();
        renderSidebar();
        if (state.view === "chat") renderMessages();
        void isNew;
      };
    },
  });
}

// ---------------------------------------------------------------------------
// share / import

async function gzip(text) {
  if (!window.CompressionStream) return null;
  const stream = new Blob([text], { type: "text/plain" }).stream().pipeThrough(new CompressionStream("gzip"));
  return await new Response(stream).blob();
}
async function gunzip(blob) {
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

async function shareCharacter(character) {
  const payload = JSON.stringify({ type: "perchance-character", version: 1, character });
  const gz = await gzip(payload);
  if (!gz) {
    toast("Sharing needs a modern browser.", "error");
    return;
  }
  const { close } = showModal({
    title: "Share character",
    body: `<div class="banner"><span class="spinner"></span> Uploading a share link…</div>`,
  });

  let url = "";
  try {
    const res = await window.root.uploadPlugin(gz);
    if (res?.error) throw new Error(res.error);
    url = `https://perchance.org/${window.generatorName}?data=${encodeURIComponent(
      (character.name || "character").replace(/\s+/g, "_")
    )}~${(res.url || "").split("/").pop()}`;
  } catch (error) {
    console.warn("Upload failed, falling back to an inline link", error);
    const bytes = new Uint8Array(await gz.arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    url = `https://perchance.org/${window.generatorName}?data=${encodeURIComponent(
      (character.name || "character").replace(/\s+/g, "_")
    )}~inline~${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  }

  close();
  showModal({
    title: "Share character",
    body: `<p class="sub" style="margin-top:0;">Anyone with this link can add ${escapeHtml(
      character.name
    )} to their own library.</p>
      <div class="row"><input class="input" readonly value="${escapeHtml(url)}" data-share-url>
      <button class="btn primary" data-copy style="flex:0 0 auto;">Copy</button></div>
      <div class="help">Custom code is included - only share characters you trust.</div>`,
    onMount: (root) => {
      $("[data-copy]", root).onclick = () => {
        const input = $("[data-share-url]", root);
        input.select();
        navigator.clipboard?.writeText(input.value).catch(() => document.execCommand("copy"));
        toast("Link copied");
      };
    },
  });
}

async function characterFromShareParam(dataParam) {
  const parts = dataParam.split("~");
  const tail = parts[parts.length - 1];
  let text = null;
  if (parts.includes("inline") || !/\.gz$/.test(tail)) {
    const b64 = tail.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    text = await gunzip(new Blob([bytes], { type: "application/gzip" }));
  } else {
    const res = await fetch(`https://user.uploads.dev/file/${tail}`);
    if (!res.ok) throw new Error("That share file no longer exists.");
    text = await gunzip(await res.blob());
  }
  const parsed = JSON.parse(text);
  return parsed.character || parsed;
}

function importCharacterObject(character) {
  return new Promise((resolve) => {
    const hasCode = !!(character.customCode && character.customCode.trim());
    showModal({
      title: "Add this character?",
      body: `<div class="row" style="align-items:center;gap:14px;">
        ${avatarHtml(character.name, character.avatarUrl, 58)}
        <div><b style="font-size:15px;">${escapeHtml(character.name)}</b>
        <p style="margin:4px 0 0;color:var(--muted);font-size:13px;">${escapeHtml(
          character.tagline || character.description || ""
        )}</p></div></div>
      <div class="help" style="margin-top:12px;">${escapeHtml(
        (character.roleInstruction || "").slice(0, 260)
      )}${(character.roleInstruction || "").length > 260 ? "…" : ""}</div>
      ${
        hasCode
          ? `<div class="banner warn" style="margin-top:14px;">This character contains custom code that runs in your
             browser when it replies. Only continue if you trust the person who shared it.</div>
             <pre class="md-pre" style="max-height:170px;overflow:auto;"><code>${escapeHtml(
               character.customCode
             )}</code></pre>`
          : ""
      }`,
      footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Add to library</button>`,
      onMount: (root, close) => {
        $("[data-ok]", root).onclick = async () => {
          close();
          const copy = { ...character, id: uid(), createdAt: Date.now(), updatedAt: Date.now() };
          await store.saveCharacter(copy);
          await reloadAll();
          renderSidebar();
          resolve(copy);
        };
      },
    });
  });
}

function importCharacterJsonDialog() {
  showModal({
    title: "Import character",
    body: `<div class="field"><label>Paste character JSON</label><textarea class="textarea code" data-json placeholder='{"type":"perchance-character","character":{…}}'></textarea></div>
      <div class="help">You can export a character from the editor at any time, or from another Perchance character chat.</div>`,
    footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-import>Import</button>`,
    onMount: (root, close) => {
      $("[data-import]", root).onclick = async () => {
        try {
          const parsed = JSON.parse($("[data-json]", root).value);
          const character = parsed.character || parsed;
          if (!character.name) throw new Error("That doesn't look like a character.");
          close();
          const added = await importCharacterObject(character);
          if (added) await startChat([added.id]);
        } catch (error) {
          toast(String(error.message || error), "error");
        }
      };
    },
  });
}

async function exportAllData() {
  const characters = await store.listCharacters();
  const userCharacters = await store.listUserCharacters();
  const threads = await store.listThreads();
  const threadsWithMessages = [];
  for (const t of threads) threadsWithMessages.push({ ...t, messages: await store.getMessages(t.id) });
  const payload = {
    type: "perchance-character-chat-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    characters,
    userCharacters,
    threads: threadsWithMessages,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `character-chat-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function importAllDataDialog() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.characters) throw new Error("Not a backup file.");
      if (
        !(await confirmDialog({
          title: "Import backup",
          message: `Add ${data.characters.length} character(s) and ${data.threads?.length || 0} chat(s) to this device?`,
          confirmText: "Import",
        }))
      )
        return;
      for (const c of data.characters) {
        if (!(await store.getCharacter(c.id))) await store.saveCharacter(c);
      }
      for (const u of data.userCharacters || []) await store.saveUserCharacter(u);
      for (const t of data.threads || []) {
        const { messages, ...thread } = t;
        if (!(await store.getThread(thread.id))) {
          await store.saveThread(thread);
          await store.setMessages(thread.id, messages || []);
        }
      }
      await reloadAll();
      renderSidebar();
      renderMain();
      toast("Backup imported");
    } catch (error) {
      toast(`Import failed: ${error.message || error}`, "error");
    }
  };
  input.click();
}

// ---------------------------------------------------------------------------
// global events

async function saveArtStyle(value) {
  const character = threadCharacters()[0]; if (!character) return;
  character.imageStyle = value; await store.saveCharacter(character); renderHeader();
}

const CLICK_ACTIONS = {
  "search-threads": () => { state.threadSearch = $("#threadSearchInput").value; renderSidebar(); },
  "random-art-style": () => saveArtStyle(["anime", "photorealistic", "watercolor", "oil painting", "pixel art"][Math.floor(Math.random() * 5)]),
  "narrator-info": () => showModal({ title: "🎭 Narrator", body: `<p>The 🗣️ Narrator shortcut writes a single scene narration using your configured provider. Advanced Perchance narrator voices, pacing and powers are not connected.</p>` }),
  "autotalk-start": startAutoTalk,
  "autotalk-pause": () => autoTalk.pause(),
  "autotalk-settings": openAutoTalkSettings,
  "speaker-reply": (el) => { const c = charById(el.dataset.id); if (c) return generateSpeaker(c); },
  "speaker-user": () => generateSpeaker({ ...state.userCharacter, autoImage: "never", customCode: "" }, "user"),
  "speaker-narrator": () => generateSpeaker({ id: "narrator", name: "Narrator", description: "Narrate the scene and surroundings without speaking for the user.", autoImage: "never", customCode: "" }, "system"),
  "shortcut-menu": (el) => showPopover(el, [{ label: "Add a character to this chat", onSelect: () => openCharacterPicker({ multi: true, exclude: state.thread?.characterIds || [], onPick: addCharactersToThread }) }, { label: "Describe yourself", onSelect: openPersonaEditor }]),
  "tips": () => showModal({ title: "❓ Tips", body: `<p>Type a reply and press send ➡️. Shift+Enter starts a new line. Speaker buttons request one reply from that participant; 🖼️ Image opens illustration choices.</p><p>Add at least two characters using ⚒️ options, then press 🎭 let them talk to alternate a bounded number of replies. API generation uses your configured provider. No text or image request is made just by opening this page.</p><p>Back up browser-local data with 💾 export. Perchance community comments, living-world simulation, and its image-research tools are not connected here.</p>` }),
  "fullscreen": async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast("Fullscreen isn't available in this browser."); } },
  "rename-thread": async el => { const t = state.threads.find(t => t.id === el.dataset.id); if (!t) return; const name = await promptDialog({ title: "🏷️ Thread name", label: "Name", value: t.title || "" }); if (name === null) return; t.title = name; await store.saveThread(t); if (state.thread?.id === t.id) state.thread.title = name; renderSidebar(); },
  "thread-card-menu": async el => { await openThread(el.dataset.id); openThreadMenu(el); },
  "export-thread-card": async el => { await openThread(el.dataset.id); exportThread(); },
  "toggle-sidebar": () => { if (window.innerWidth <= 700) setSidebarOpen(!state.sidebarOpen); else $("#app").classList.toggle("sidebar-collapsed"); },
  "new-character": () => newCharAndEdit(),
  "add-preset": async (el) => {
    const preset = presetCharacters.find((p) => p.id === el.dataset.id);
    if (!preset) return;
    const created = newCharacter({ ...preset, id: uid() });
    await store.saveCharacter(created);
    await reloadAll();
    renderSidebar();
    await startChat([created.id]);
  },
  discover: () => {
    state.view = "discover";
    renderMain();
    setSidebarOpen(false);
  },
  settings: async () => { await autoTalk.stop(); openSettingsDialog(); setSidebarOpen(false); },
  "start-chat": async (el) => {
    await startChat([el.dataset.id]);
  },
  "edit-character": (el, e) => {
    e.stopPropagation();
    const c = charById(el.dataset.id);
    if (c) openCharacterEditor(c);
  },
  "open-thread": (el) => openThread(el.dataset.id),
  "delete-thread": async (el, e) => {
    e.stopPropagation();
    const thread = state.threads.find((t) => t.id === el.dataset.id);
    if (
      !(await confirmDialog({
        title: "Delete chat",
        message: `Delete the chat "${threadTitle(thread)}" and its messages?`,
        confirmText: "Delete",
        danger: true,
      }))
    )
      return;
    await store.deleteThread(el.dataset.id);
    if (state.thread?.id === el.dataset.id) {
      state.thread = null;
      state.messages = [];
      state.view = "empty";
    }
    await reloadAll();
    renderSidebar();
    renderMain();
  },
  "edit-user": () => openPersonaEditor(),
  "new-chat": async () => { await autoTalk.stop(); state.view = "discover"; renderMain(); setSidebarOpen(false); },
  "thread-menu": (el) => openThreadMenu(el),
  send: () => sendCurrent(),
  stop: () => {
    autoTalk.stop();
    state.generationStopped = true;
    state.stopCurrent?.();
    window.root.stopAllTextGenerations?.();
  },
  "composer-image": (el) =>
    showPopover(el, [
      { label: "Illustrate the scene", onSelect: () => illustrate(null) },
      { label: "Generate from a prompt…", onSelect: () => imageFromPrompt() },
    ]),
  "msg-copy": (el) => {
    const m = state.messages.find((x) => x.id === el.closest("[data-msg-id]").dataset.msgId);
    navigator.clipboard?.writeText(m.content).then(() => toast("Copied")).catch(() => {});
  },
  "msg-delete": async (el) => {
    const id = el.closest("[data-msg-id]").dataset.msgId;
    state.messages = state.messages.filter((m) => m.id !== id);
    renderMessages();
    await persistMessages();
  },
  "msg-edit": async (el) => {
    const id = el.closest("[data-msg-id]").dataset.msgId;
    const m = state.messages.find((x) => x.id === id);
    const next = await promptDialog({ title: "Edit message", label: "Message", value: m.content, multiline: true });
    if (next === null) return;
    m.content = next;
    renderMessages();
    await persistMessages();
  },
  "msg-reroll": (el) => reroll(el.closest("[data-msg-id]").dataset.msgId),
  "msg-illustrate": (el) => illustrate(el.closest("[data-msg-id]").dataset.msgId),
  "view-image": (el) => openLightbox(el.dataset.src),
  "export-data": () => exportAllData(),
  "import-data": () => importAllDataDialog(),
  "import-character": () => importCharacterJsonDialog(),
  "wipe-data": async () => {
    if (
      !(await confirmDialog({
        title: "Delete everything?",
        message:
          "This permanently deletes every character, persona and chat stored on this device.\n\nExport a backup first if you might want them back.",
        confirmText: "Delete everything",
        danger: true,
      }))
    )
      return;
    const folders = ["characters", "threads", "threadMessages", "userCharacters"];
    for (const f of folders) {
      const keys = await window.root.kv[f].keys();
      await window.root.kv[f].deleteMany(keys);
    }
    await window.root.kv.misc.set("seeded", false);
    await store.initStore();
    await reloadAll();
    state.thread = null;
    state.messages = [];
    state.view = "empty";
    renderSidebar();
    renderMain();
    toast("Everything deleted");
  },
};

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const handler = CLICK_ACTIONS[action];
  if (!handler) return;
  e.preventDefault();
  if (autoTalk.state().running && ["new-chat", "new-character", "start-chat", "open-thread", "delete-thread", "edit-character", "edit-user", "wipe-data", "import-data", "import-character"].includes(action)) await autoTalk.stop();
  try { await handler(el, e); } catch (error) { console.error(error); toast("That action could not be completed.", "error"); }
});

document.addEventListener("change", async (e) => {
  if (e.target.matches("[data-character-art-style]")) { await saveArtStyle(e.target.value); return; }
  const el = e.target.closest("[data-setting]");
  if (!el) return;
  const key = el.dataset.setting;
  const value = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
  state.settings = await store.saveSettings({ [key]: value });
  applySettings();
  if (key === "showTimestamps" || key === "fontSize") renderMain();
});

$("#threadSearchInput").addEventListener("input", e => { state.threadSearch = e.target.value; renderSidebar(); });

$("#characterSearchInput").addEventListener("input", (e) => {
  state.characterSearch = e.target.value;
  renderSidebar();
});

$("#sidebarScrim").addEventListener("click", () => setSidebarOpen(false));
$("#userChipBtn").addEventListener("click", () => openPersonaEditor());
$("#newCharacterBtn").addEventListener("click", () => newCharAndEdit());
$("#discoverBtn").addEventListener("click", () => CLICK_ACTIONS.discover());
$("#settingsBtn").addEventListener("click", () => CLICK_ACTIONS.settings());
$("#newChatBtn").addEventListener("click", () => CLICK_ACTIONS["new-chat"]());

function applySettings() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.documentElement.classList.toggle("light", state.settings.theme !== "dark");
  document.body.style.fontSize = `${state.settings.fontSize}px`;
}

// ---------------------------------------------------------------------------
// boot

async function boot() {
  try {
    state.settings = await store.initStore();
    // Apply the requested visual redesign once, without touching chats or API keys.
    if (state.settings.interfaceStyle !== "perchance-source-v1") {
      state.settings = await store.saveSettings({ theme: "light", fontSize: 16, interfaceStyle: "perchance-source-v1" });
    }
    applySettings();
    await reloadAll();
    window.__acc = state;

    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get("data");
    const charParam = params.get("char");

    renderSidebar();
    state.view = "empty";
    renderMain();

    if (dataParam) {
      try {
        const character = await characterFromShareParam(dataParam);
        const added = await importCharacterObject(character);
        if (added) await startChat([added.id]);
      } catch (error) {
        console.error(error);
        toast(`Couldn't load that share link: ${error.message || error}`, "error");
      }
    } else if (charParam) {
      const match =
        state.characters.find((c) => c.id === charParam) ||
        state.characters.find((c) => c.name.toLowerCase() === charParam.toLowerCase());
      if (match) await startChat([match.id]);
      else toast(`No character called "${charParam}" yet.`, "error");
    } else if (state.threads.length > 0) {
      await openThread(state.threads[0].id);
    } else {
      state.view = "discover";
      renderMain();
    }
  } catch (error) {
    console.error(error);
    $("#loadingText").textContent = `Something went wrong while loading: ${error.message || error}`;
    return;
  }
  $("#loadingOverlay").hidden = true;
  $("#app").hidden = false;
  window.__acc_ready = true;
}

boot();

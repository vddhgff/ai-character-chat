import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = (name) => readFileSync(new URL(`../js/${name}`, import.meta.url), "utf8");
const load = (text) => import(`data:text/javascript;base64,${Buffer.from(text).toString("base64")}`);
const { createTextAdapter } = await load(source("llm.js"));
const ai = await load(source("ai.js"));
function storage() {
  const values = new Map([["acc_api_key", "test-only-not-a-real-key"]]);
  return { getItem: (k) => values.get(k), setItem: (k,v) => values.set(k,v) };
}
const response = (text = "hello", finish = "stop") => ({ ok: true, json: async () => ({ choices: [{ message: { content: text }, finish_reason: finish }] }) });
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test("synchronous metadata, reserved context, validation and model defaults", async () => {
  const store = storage(); let body;
  const adapter = createTextAdapter({ storage: store, fetchImpl: async (_, opts) => { body = JSON.parse(opts.body); return response(); } });
  globalThis.window = { root: adapter };
  const meta = adapter.generateText({ getMetaObject: true });
  assert.equal(meta.then, undefined);
  assert.equal(meta.contextWindowTokens, 9000);
  assert.equal(meta.idealMaxContextTokens, 6952);
  assert.equal(ai.idealMaxContextTokens(), 6952);
  assert.equal(ai.countTokens("12345"), 2);
  await adapter.generateText({ instruction: "test" });
  assert.equal(body.max_tokens, 2048);
  assert.equal(body.model, "google/gemini-2.0-flash-exp:free");
  adapter.setLimits({ contextTokens: 16000, maxOutputTokens: 4096 });
  assert.equal(adapter.generateText({ getMetaObject: true }).idealMaxContextTokens, 11904);
  store.setItem("acc_provider", "groq");
  await adapter.generateText({ instruction: "test" });
  assert.equal(body.max_tokens, 4096);
  assert.equal(body.model, "llama-3.1-8b-instant");
  assert.throws(() => adapter.setLimits({ contextTokens: 12000, maxOutputTokens: 12000 }), RangeError);
});

test("reply caller preserves stoppable promise; finish reason and single completed chunk", async () => {
  const adapter = createTextAdapter({ storage: storage(), fetchImpl: async () => response("Alice: hello", "length") });
  globalThis.window = { root: adapter }; let started; const chunks = [];
  const result = await ai.requestReply({ focusCharacter: { name: "Alice" }, characters: [], user: { name: "You" }, messages: [], onStart: (p) => { started = p; }, onChunk: (s) => chunks.push(s) });
  assert.equal(typeof started.stop, "function");
  assert.equal(result.text, "hello"); assert.equal(result.stopReason, "length");
  assert.deepEqual(chunks, ["Alice: hello"]);
});

test("Stop signals the in-flight fetch and is not lost through requestReply", async () => {
  let signal; let request;
  const adapter = createTextAdapter({ storage: storage(), fetchImpl: (_, opts) => {
    signal = opts.signal;
    return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError"))));
  } });
  globalThis.window = { root: adapter };
  const pending = ai.requestReply({ focusCharacter: { name: "A" }, characters: [], user: { name: "You" }, messages: [], onStart: (p) => { request = p; } });
  request.stop(); assert.equal(signal.aborted, true);
  await assert.rejects(pending, { name: "AbortError" });
});

test("late JSON results are dropped and stopAll includes summary requests", async () => {
  const gate = deferred(); let chunks = 0;
  const adapter = createTextAdapter({ storage: storage(), fetchImpl: async () => ({ ok: true, json: () => gate.promise }) });
  globalThis.window = { root: adapter };
  const first = adapter.generateText({ instruction: "reply", onChunk: () => chunks++ });
  const summary = ai.summarizeThread({ characters: [], user: { name: "You" }, messages: [{ content: "x" }], summary: "", summaryUpTo: 0, keepVerbatim: 0 });
  await Promise.resolve(); adapter.stopAll();
  gate.resolve({ choices: [{ message: { content: "late" } }] });
  await assert.rejects(first, { name: "AbortError" });
  await assert.rejects(summary, { name: "AbortError" });
  assert.equal(chunks, 0);
});

function section(start, end) { const s = source("app.js"); return s.slice(s.indexOf(start), s.indexOf(end, s.indexOf(start))); }

test("UI Stop removes cancelled placeholder, skips subsequent cast, images, custom code and summary", async () => {
  const gate = deferred(); let abortSignal; let fetches = 0; let summaries = 0; const notices = [];
  const adapter = createTextAdapter({ storage: storage(), fetchImpl: (_, opts) => { fetches++; abortSignal = opts.signal; return gate.promise; } });
  const state = { thread: { id: "t" }, userCharacter: { name: "You" }, messages: [], generationStopped: false, generating: false };
  globalThis.window = { root: adapter };
  const ctx = vm.createContext({ state, autoTalk: { stop() {} }, window: { root: { stopAllTextGenerations: adapter.stopAll } }, DOMException, performance, console,
    threadCharacters: () => [{ name: "A", id: "a", autoImage: "always", customCode: "do not run" }, { name: "B", id: "b" }],
    requestReply: ai.requestReply, newMessage: (m) => ({ ...m, id: String(state.messages.length), content: m.content || "", images: [] }),
    persistMessages: async () => {}, renderMessages() {}, renderSidebar() {}, renderComposer() {},
    toast: (...args) => notices.push(args), backgroundSummarize: () => summaries++,
    extractImageRequest: () => { throw new Error("must not run images after stop"); },
  });
  vm.runInContext(section("function setGenerating(on)", "function paintStreaming("), ctx);
  vm.runInContext(section("async function sendMessage(text)", "async function reroll("), ctx);
  vm.runInContext(`function stop() ${source("app.js").match(/stop: \(\) => (\{[\s\S]*?\n  \}),/)[1]}`, ctx);
  const pending = vm.runInContext('sendMessage("hello")', ctx);
  // Wait until the request has actually started (only local microtasks).
  for (let i=0; i<10 && !abortSignal; i++) await Promise.resolve();
  assert.ok(abortSignal); vm.runInContext("stop()", ctx);
  assert.equal(abortSignal.aborted, true);
  gate.resolve(response("late")); await pending;
  assert.equal(fetches, 1); assert.equal(summaries, 0); assert.equal(notices.length, 0);
  assert.equal(state.generating, false); assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].role, "user");
});

test("background summarization threshold, newest twelve retention, and abort without generic error", async () => {
  let tokens = 5213; let called = 0; let keep; let errors = 0;
  const state = { settings: { autoSummarize: true }, thread: { id: "t" }, messages: Array.from({ length: 17 }, () => ({ content: "x" })), generationStopped: false };
  const ctx = vm.createContext({ state, config: () => ({}), threadCharacters: () => [], promptTokenCount: () => tokens, idealMaxContextTokens: () => 6952,
    renderComposer() {}, console: { error: () => errors++ }, store: { saveThread: async () => {} },
    summarizeThread: async (args) => { called++; keep = args.keepVerbatim; throw new DOMException("Stopped", "AbortError"); }, DOMException });
  vm.runInContext(section("async function backgroundSummarize()", "async function illustrate("), ctx);
  await vm.runInContext("backgroundSummarize()", ctx); assert.equal(called, 0);
  tokens = 5214; await vm.runInContext("backgroundSummarize()", ctx);
  assert.equal(called, 1); assert.equal(keep, 12); assert.equal(errors, 0); assert.equal(state.summarizing, false);
});


test("light redesign migrates appearance once and preserves later choices", async () => {
  let saved = { theme: "dark", fontSize: 15, interfaceStyle: "compact-light-v1", activeUserCharacterId: "my-persona", autoSummarize: false };
  let writes = 0;
  const state = {};
  const ctx = vm.createContext({ state, applySettings() {}, store: {
    initStore: async () => ({ ...saved }),
    saveSettings: async (change) => { writes++; saved = { ...saved, ...change }; return { ...saved }; },
  } });
  const app = source("app.js");
  const start = app.indexOf("    state.settings = await store.initStore();");
  const end = app.indexOf("    await reloadAll();", start);
  const migrate = `(async () => {${app.slice(start, end)}})()`;
  await vm.runInContext(migrate, ctx);
  assert.equal(saved.theme, "light"); assert.equal(saved.fontSize, 16);
  assert.equal(saved.activeUserCharacterId, "my-persona"); assert.equal(saved.autoSummarize, false);
  saved = { ...saved, theme: "dark", fontSize: 17 };
  await vm.runInContext(migrate, ctx);
  assert.equal(saved.theme, "dark"); assert.equal(saved.fontSize, 17); assert.equal(writes, 1);
});


test("all app SVG icons have a bounded size and outlined style", () => {
  const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
  const rule = css.match(/svg\.i\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(rule, /width:16px/); assert.match(rule, /height:16px/);
  assert.match(rule, /fill:none/); assert.match(rule, /stroke:currentColor/);
});

test('explicit user speaker drafts remove contradictory rules and self-stop sequence', async () => {
  let request;
  globalThis.window = { root: { generateText: (args) => { request = args; return Promise.resolve({ generatedText: 'Anon: A draft.' }); } } };
  const result = await ai.requestReply({ speakerRole: 'user', focusCharacter: { id: 'u', name: 'Anon' }, characters: [{ id: 'c', name: 'Chloe' }], user: { name: 'Anon', description: 'Curious' }, messages: [] });
  assert.equal(result.text, 'A draft.');
  assert.ok(!request.instruction.includes('Never write Anon'));
  assert.ok(request.instruction.includes('explicitly requested a draft'));
  assert.ok(!request.stopSequences.includes('\nAnon:'));
  assert.ok(request.stopSequences.includes('\nChloe:'));
});

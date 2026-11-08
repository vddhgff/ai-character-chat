import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = text => import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
const { createAutoTalkController } = await load(readFileSync(new URL('../js/autotalk.js', import.meta.url), 'utf8'));
const chars = [{ id: 'a' }, { id: 'b' }];
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function clock() {
  let i = 0; const timers = new Map();
  return { setTimer(fn) { timers.set(++i, fn); return i; }, clearTimer(id) { timers.delete(id); }, fire() { const next = timers.entries().next().value; if (!next) return false; timers.delete(next[0]); next[1](); return true; }, size: () => timers.size };
}

test('auto-talk is inert until started and rotates to the exact cap', async () => {
  const timer = clock(), calls = [];
  const c = createAutoTalkController({ ...timer, step: async (char, thread) => { calls.push([char.id, thread]); } });
  assert.equal(c.state().running, false); assert.deepEqual(calls, []);
  const pending = c.start({ characters: chars, threadId: 't', maxMessages: 3 });
  await tick(); assert.deepEqual(calls, [['a', 't']]);
  timer.fire(); await tick(); timer.fire(); await pending;
  assert.deepEqual(calls, [['a', 't'], ['b', 't'], ['a', 't']]);
  assert.equal(c.state().running, false); assert.equal(timer.size(), 0);
});

test('pause waits for an in-flight reply and blocks the next turn until resumed', async () => {
  const timer = clock(), gate = deferred(); let calls = 0;
  const c = createAutoTalkController({ ...timer, step: async () => { calls++; if (calls === 1) await gate.promise; } });
  const pending = c.start({ characters: chars, threadId: 't', maxMessages: 2 });
  c.pause(); gate.resolve(); await tick(); timer.fire(); await tick();
  assert.equal(calls, 1); assert.equal(c.state().paused, true);
  c.pause(); await pending; assert.equal(calls, 2); assert.equal(timer.size(), 0);
});

test('Stop aborts a request and drops a late result without starting another', async () => {
  const gate = deferred(); let calls = 0, aborts = 0;
  const c = createAutoTalkController({ step: async () => { calls++; await gate.promise; }, abort: () => { aborts++; } });
  const pending = c.start({ characters: chars, threadId: 't', maxMessages: 25 });
  const stopped = c.stop(); assert.equal(aborts, 1); assert.equal(c.state().running, false);
  gate.resolve(); await stopped; await pending; assert.equal(calls, 1);
});

test('Stop during a timer clears it; stale completion cannot change a newer run', async () => {
  const timer = clock(); let calls = 0;
  const c = createAutoTalkController({ ...timer, step: async () => { calls++; } });
  c.start({ characters: chars, threadId: 'old', maxMessages: 25 }); await tick();
  assert.equal(timer.size(), 1); await c.stop(); assert.equal(timer.size(), 0);
  await c.start({ characters: chars, threadId: 'new', maxMessages: 1 }); assert.equal(calls, 2);
});

test('failed generation and exceptions terminate rotation, not 25 error requests', async () => {
  let calls = 0, errors = 0;
  const c = createAutoTalkController({ step: async () => { calls++; return false; }, onError: () => errors++ });
  await c.start({ characters: chars, maxMessages: 25 }); assert.equal(calls, 1);
  const b = createAutoTalkController({ step: async () => { throw new Error('offline'); }, onError: () => errors++ });
  await b.start({ characters: chars }); assert.equal(errors, 1); assert.equal(b.state().running, false);
});

test('unbounded or invalid runs are rejected', () => {
  const c = createAutoTalkController({ step() { throw new Error('must not execute'); } });
  assert.throws(() => c.start({ characters: [] }), RangeError);
  assert.throws(() => c.start({ characters: chars, maxMessages: Infinity }), RangeError);
  assert.throws(() => c.start({ characters: chars, maxMessages: 101 }), RangeError);
  assert.throws(() => c.start({ characters: chars, pauseMs: -1 }), RangeError);
});

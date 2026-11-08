// Bounded, user-started character rotation. No work starts merely by loading it.
export function createAutoTalkController({ step, abort = () => {}, onChange = () => {}, onError = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let active = null;
  const state = () => active ? { running: true, paused: active.paused, completed: active.completed, maxMessages: active.maxMessages, threadId: active.threadId } : { running: false, paused: false, completed: 0, maxMessages: 0, threadId: null };
  const notify = () => onChange(state());
  const wake = (run) => { if (run.timer != null) clearTimer(run.timer); run.timer = null; const done = run.wake; run.wake = null; done?.(); };
  const wait = (run, ms) => new Promise((resolve) => { run.wake = resolve; if (ms != null) run.timer = setTimer(() => wake(run), ms); });
  function stop() {
    const run = active;
    if (!run) return Promise.resolve();
    run.cancelled = true; active = null; wake(run); abort(); notify();
    return run.promise;
  }
  function pause() {
    if (!active) return;
    active.paused = !active.paused;
    if (!active.paused) wake(active);
    notify();
  }
  function start({ characters, threadId, maxMessages = 25, pauseMs = 2000 }) {
    if (active) return active.promise;
    if (!Array.isArray(characters) || characters.length < 2) throw new RangeError('Choose at least two characters.');
    if (!Number.isInteger(maxMessages) || maxMessages < 1 || maxMessages > 100) throw new RangeError('Choose 1–100 messages.');
    if (!Number.isFinite(pauseMs) || pauseMs < 0 || pauseMs > 60000) throw new RangeError('Choose a pause of 0–60 seconds.');
    const run = { characters: [...characters], threadId, maxMessages, pauseMs, completed: 0, paused: false, cancelled: false, timer: null, wake: null };
    active = run; notify();
    run.promise = (async () => {
      try {
        while (active === run && !run.cancelled && run.completed < maxMessages) {
          while (run.paused && active === run) await wait(run, null);
          if (active !== run || run.cancelled) break;
          const result = await step(run.characters[run.completed % run.characters.length], run.threadId);
          if (active !== run || run.cancelled || result === false) break;
          run.completed++; notify();
          if (run.completed < maxMessages) await wait(run, pauseMs);
        }
      } catch (error) { if (!run.cancelled && error.name !== 'AbortError') onError(error); }
      finally { wake(run); if (active === run) { active = null; notify(); } }
    })();
    return run.promise;
  }
  return { state, start, stop, pause };
}

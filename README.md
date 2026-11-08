# AI Character Chat — Complete Modular Website

This is the full modular source assembled from the files you provided, ready to publish on GitHub.

## Files included

- `index.html` — entry point
- `css/style.css` — basic styles
- `js/boot.js` — browser adapter (`window.root.kv`, `generateText`, `textToImagePlugin`)
- `js/app.js` — main application (your full modular app)
- `js/ai.js` — LLM + image prompt logic (your full ai.js)
- `js/store.js` — persistence layer (adapted to run against the browser adapter)
- `js/customcode.js` — per-character custom code runner
- `js/markdown.js` — safe message renderer
- `js/presets.js` — preset characters
- `js/memory.js` — memory system upgrades (src-memory-2.js)
- `js/memory-wiring-example.js` — wiring notes
- `js/img-pipeline-tests.js` — image pipeline tests

## How it runs

The original code expects Perchance’s `window.root` (kv store + generateText + textToImage).  
`js/boot.js` provides a browser-compatible version:

- Storage uses localStorage
- Text generation uses OpenRouter or Groq (you supply the key)
- Images use Pollinations (free, no key)

## Setup

1. Get a free key:
   - OpenRouter: https://openrouter.ai/keys
   - Or Groq: https://console.groq.com
2. Open the site, open the browser console, and run:
   ```js
   setApiKey("your-key-here")
   ```
3. Reload. The app will start.
4. You can change provider/model with:
   ```js
   setApiKey("your-key", "groq", "llama-3.1-8b-instant")
   ```

## Publishing on GitHub

1. Create a new repository.
2. Upload all files from this folder (keep the `js/` and `css/` structure).
3. Settings → Pages → Deploy from branch (main / root).
4. Your site will be at `https://yourusername.github.io/repo-name/`.

## Notes

- This is the real modular codebase you sent, not a simplified demo.
- The image describer in `ai.js` is the unrestricted scene-first version.
- Memory upgrades are included as `js/memory.js`. Wire them further using the example file if you want the full round-5 behavior.
- The old Perchance 6500-token hard cap does not apply here. You are limited only by the model you choose.
- Custom code characters will run in the browser (same as the original).

## Size

Source only. The entire project is under 150 KB of JavaScript and HTML.

## Generation limits and Stop

The browser adapter defaults to an **estimated 9,000-token total context budget**
and requests **2,048 output tokens** per text call (including summaries). It reserves
that output allowance, leaving a 6,952-token estimated input target. Automatic
summarization starts at 75% of that target (5,214 estimated input tokens), after
more than 16 messages, retaining the newest 12 verbatim. Older messages remain
stored locally but are represented by a rolling summary in future prompts.
Summaries make an additional potentially billable API request.

These are configurable estimates, **not verified model capabilities**. Counting
uses `Math.ceil(text.length / 4)`, not the provider tokenizer; prompt framing is
not fully counted. There is no hard preflight truncation or guaranteed protection
from a context-overflow error, and summarization runs after a reply. Confirm your
selected model supports the combined input/output budget before increasing it.
The default model's current availability is not verified. In the browser console:

```js
setGenerationLimits({ contextTokens: 9000, maxOutputTokens: 2048 });
getGenerationLimits();
// For a model you have verified supports a larger budget, for example:
// setGenerationLimits({ contextTokens: 16000, maxOutputTokens: 4096 });
```

Limits are persisted per browser origin and read on each request. Output must be
smaller than total context. Provider quotas and model limits still apply. Select a
compatible provider/model explicitly with `setApiKey(key, provider, model)`.
Never commit keys. Keys in localStorage are accessible to unsandboxed character
custom code: only run character code you trust; do not use an owner-funded shared key.

**Stop** aborts active text fetches (including background summary requests), drops
late results and stops remaining characters in the current turn. It cannot undo
provider work/billing already incurred, or stop arbitrary custom JavaScript already
running. Responses still arrive all at once, not as a true token stream. No backend
or server-side secret protection is provided.

Offline adapter/integration tests (no credentials or provider calls):
`node --test tests/llm.test.mjs`.

## Uploaded source and compact light layout

The uploaded `ai 2.js` is installed as `js/ai.js`, and `src-memory.js` as
`js/memory.js`, matching the application imports. The other uploaded JavaScript
modules use their original names under `js/`; `app.js` retains the tested Stop
and late-result safeguards. The uploaded development notes are included as
`ai-character-chat-notes-complete-2.md`; their descriptions of the original
Perchance app do not mean all those features exist in this modular application.
The memory example and image-pipeline tests remain optional, not boot dependencies.

The interface defaults to a compact, light-gray sidebar and chat layout. Existing
installations receive the new light theme and 13px text once; Appearance settings
can still select dark mode and a different font size afterward. Existing saved
chat data is retained. Explicit generation-limit overrides remain saved; call
`setGenerationLimits({contextTokens: 9000, maxOutputTokens: 2048})` to replace an
older explicit override. API keys are still supplied by each visitor.

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

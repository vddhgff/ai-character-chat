// Boot layer: provides window.root (kv + generateText + textToImage) so the modular app can run in a plain browser.

import { createTextAdapter } from "./llm.js";
import { makeKV } from "./local-kv.js";

const textAdapter = createTextAdapter({ storage: localStorage, origin: window.location.origin });

window.root = {
  kv: makeKV(localStorage),
  config: { seedPresetCharacters: true },
  generateText: textAdapter.generateText,
  stopAllTextGenerations: textAdapter.stopAll,
  async textToImagePlugin(prompt, opts = {}) {
    const encoded = encodeURIComponent(String(prompt || "portrait"));
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=1024&nologo=true&seed=${Date.now() % 100000}`;
    return { dataUrl: url, imageUrl: url };
  },
};

// Expose a tiny settings helper so the user can set the key from the console if needed
window.setApiKey = (key, provider = "openrouter", model = provider === "groq" ? "llama-3.1-8b-instant" : "google/gemini-2.0-flash-exp:free") => {
  localStorage.setItem("acc_api_key", key);
  localStorage.setItem("acc_provider", provider);
  localStorage.setItem("acc_model", model);
  console.log("API key saved. Reload the page.");
};

window.setGenerationLimits = textAdapter.setLimits;
window.getGenerationLimits = textAdapter.getLimits;

// Now load the real app
await import("./app.js");

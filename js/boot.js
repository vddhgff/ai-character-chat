// Boot layer: provides window.root (kv + generateText + textToImage) so the modular app can run in a plain browser.

import * as store from "./store.js";

// Simple in-memory + localStorage kv adapter
function makeKV() {
  const stores = {};
  function getStore(name) {
    if (!stores[name]) {
      try {
        stores[name] = JSON.parse(localStorage.getItem("acc_kv_" + name) || "{}");
      } catch {
        stores[name] = {};
      }
    }
    return stores[name];
  }
  function save(name) {
    localStorage.setItem("acc_kv_" + name, JSON.stringify(stores[name]));
  }
  return new Proxy(
    {},
    {
      get(_, name) {
        return {
          async get(key) {
            return getStore(name)[key];
          },
          async set(key, value) {
            getStore(name)[key] = value;
            save(name);
          },
          async delete(key) {
            delete getStore(name)[key];
            save(name);
          },
          async entries() {
            return Object.entries(getStore(name));
          },
          async keys() {
            return Object.keys(getStore(name));
          },
          async deleteMany(keys) {
            const s = getStore(name);
            for (const k of keys) delete s[k];
            save(name);
          },
        };
      },
    }
  );
}

async function callLLM(messages, settings) {
  const key = settings.apiKey || localStorage.getItem("acc_api_key") || "";
  if (!key) throw new Error("No API key. Set it in localStorage as acc_api_key or via the UI.");
  const provider = settings.provider || "openrouter";
  const model = settings.model || (provider === "groq" ? "llama-3.1-8b-instant" : "google/gemini-2.0-flash-exp:free");
  const url = provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (provider !== "groq") {
    headers["HTTP-Referer"] = window.location.origin || "https://localhost";
    headers["X-Title"] = "AI Character Chat";
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 1200 }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

window.root = {
  kv: makeKV(),
  config: { seedPresetCharacters: true },
  async generateText(opts) {
    const settings = {
      apiKey: localStorage.getItem("acc_api_key") || "",
      provider: localStorage.getItem("acc_provider") || "openrouter",
      model: localStorage.getItem("acc_model") || "google/gemini-2.0-flash-exp:free",
    };
    if (opts.getMetaObject) {
      return {
        countTokens: (t) => Math.ceil(String(t).length / 4),
        idealMaxContextTokens: 8000,
      };
    }
    const messages = [{ role: "user", content: opts.instruction || "" }];
    const text = await callLLM(messages, settings);
    if (opts.onChunk) opts.onChunk({ fullTextSoFar: text });
    return { generatedText: text, stopReason: "stop" };
  },
  async textToImagePlugin(prompt, opts = {}) {
    const encoded = encodeURIComponent(String(prompt || "portrait"));
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=1024&nologo=true&seed=${Date.now() % 100000}`;
    return { dataUrl: url, imageUrl: url };
  },
};

// Expose a tiny settings helper so the user can set the key from the console if needed
window.setApiKey = (key, provider = "openrouter", model = "google/gemini-2.0-flash-exp:free") => {
  localStorage.setItem("acc_api_key", key);
  localStorage.setItem("acc_provider", provider);
  localStorage.setItem("acc_model", model);
  console.log("API key saved. Reload the page.");
};

// Now load the real app
await import("./app.js");

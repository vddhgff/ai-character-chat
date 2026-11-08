// Browser-only text adapter. Budgets are estimates, not provider capability claims.
export const DEFAULT_LIMITS = Object.freeze({ contextTokens: 9000, maxOutputTokens: 2048 });

export function validateLimits(value = {}) {
  const limits = { ...DEFAULT_LIMITS, ...value };
  if (!Number.isSafeInteger(limits.contextTokens) || limits.contextTokens < 1024 ||
      !Number.isSafeInteger(limits.maxOutputTokens) || limits.maxOutputTokens < 1 ||
      limits.maxOutputTokens >= limits.contextTokens) {
    throw new RangeError("Use integer contextTokens >= 1024 and 0 < maxOutputTokens < contextTokens.");
  }
  return limits;
}

export function createTextAdapter({ storage, fetchImpl = (...args) => fetch(...args), origin = "https://localhost" }) {
  const active = new Set();
  function getLimits() {
    try { return validateLimits(JSON.parse(storage.getItem("acc_generation_limits") || "{}")); }
    catch { return { ...DEFAULT_LIMITS }; }
  }
  function setLimits(value) {
    const limits = validateLimits(value);
    storage.setItem("acc_generation_limits", JSON.stringify(limits));
    return limits;
  }
  // Intentionally NOT async: metadata is synchronous; the original cancellable
  // promise must be returned unchanged, rather than wrapped by an async function.
  function generateText(opts) {
    const limits = getLimits();
    if (opts.getMetaObject) return {
      countTokens: (text) => Math.ceil(String(text).length / 4),
      idealMaxContextTokens: limits.contextTokens - limits.maxOutputTokens,
      contextWindowTokens: limits.contextTokens,
      maxOutputTokens: limits.maxOutputTokens,
    };
    const controller = new AbortController();
    active.add(controller);
    const checkStopped = () => {
      if (controller.signal.aborted) throw new DOMException("Generation stopped", "AbortError");
    };
    const promise = (async () => {
      try {
        const key = storage.getItem("acc_api_key") || "";
        if (!key) throw new Error("No API key. Use setApiKey(key, provider, model), then reload.");
        const provider = storage.getItem("acc_provider") || "openrouter";
        const model = storage.getItem("acc_model") || (provider === "groq" ? "llama-3.1-8b-instant" : "google/gemini-2.0-flash-exp:free");
        const url = provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
        const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
        if (provider !== "groq") {
          headers["HTTP-Referer"] = origin;
          headers["X-Title"] = "AI Character Chat";
        }
        const response = await fetchImpl(url, {
          method: "POST", headers, signal: controller.signal,
          body: JSON.stringify({ model, messages: [{ role: "user", content: opts.instruction || "" }], temperature: 0.8, max_tokens: limits.maxOutputTokens }),
        });
        checkStopped();
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        checkStopped();
        const text = data.choices?.[0]?.message?.content || "";
        opts.onChunk?.({ fullTextSoFar: text });
        checkStopped();
        return { generatedText: text, stopReason: data.choices?.[0]?.finish_reason || "stop" };
      } finally { active.delete(controller); }
    })();
    promise.stop = () => controller.abort();
    return promise;
  }
  return { generateText, getLimits, setLimits, stopAll: () => { for (const controller of active) controller.abort(); } };
}

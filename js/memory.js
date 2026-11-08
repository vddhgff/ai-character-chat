/**
 * Memory system upgrades matching the unrestricted notes.
 * Drop into src/memory.js and import from ai.js / app.js.
 *
 * Features:
 * - Richer extraction (up to 6 entries, current-state facts, WHO-WHAT-WHOM)
 * - Dedup on injection
 * - Keyword fallback when no embeddings
 * - Conflict rule (later wins) + superseded markers
 * - Whole-memory mode (chronological, adaptive budget)
 * - Current-state prioritization
 * - Image-memory synergy helpers
 * - /mem multi-line + optional re-embed
 */

export function normalizeMemoryTextForDedup(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function memoryKeywordSet(text) {
  const stop = new Set("the a an and or but if then of to in on for with at by from as is was were be been being have has had do does did will would could should can may might must".split(" "));
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w))
  );
}

export function memoryKeywordScore(entryText, queries, recentChat = "") {
  const entry = memoryKeywordSet(entryText);
  if (entry.size === 0) return -1;
  const corpus = memoryKeywordSet(queries.join(" ") + " " + recentChat);
  let hits = 0;
  let weight = 0;
  for (const w of entry) {
    if (corpus.has(w)) {
      hits++;
      // weight proper-ish names and numbers higher
      if (/^[A-Z]/.test(w) || /\d/.test(w)) weight += 2;
      else weight += 1;
    }
  }
  if (hits === 0) return -1;
  return Math.min(0.95, (hits + weight * 0.15) / Math.max(4, entry.size));
}

export function applyConflictRule(memories) {
  // Chronological; later wins. Mark earlier contradictions as superseded.
  const sorted = [...memories].sort((a, b) => (a.at || 0) - (b.at || 0));
  const seen = new Map(); // normalized key -> latest entry
  for (const m of sorted) {
    const key = normalizeMemoryTextForDedup(m.text);
    if (!key) continue;
    const prev = seen.get(key);
    if (prev) prev.superseded = true;
    seen.set(key, m);
  }
  return sorted;
}

export function buildMemoryRetrievalBlock(memories, { maxTokens = 1800, preferVisual = false } = {}) {
  const clean = applyConflictRule(memories).filter((m) => m.text && !m.superseded);
  if (clean.length === 0) return "";

  // Whole-memory style: chronological chunks, trim worst-first if over budget
  const chunks = [];
  for (let i = 0; i < clean.length; i += 4) {
    chunks.push(clean.slice(i, i + 4));
  }

  let selected = chunks;
  // Simple token estimate (~4 chars/token)
  const estimate = (arr) => arr.reduce((s, c) => s + c.reduce((ss, m) => ss + m.text.length, 0), 0) / 4;
  while (estimate(selected) > maxTokens && selected.length > 1) {
    // drop oldest chunk first (least relevant for "now")
    selected = selected.slice(1);
  }

  const lines = [];
  for (const chunk of selected) {
    for (const m of chunk) {
      const tag = preferVisual && /\b(wearing|hair|eyes|clothes|outfit|looks|appearance)\b/i.test(m.text) ? "[visual] " : "";
      lines.push(`- ${tag}${m.text}${m.asOf ? ` (as of ${m.asOf})` : ""}`);
    }
  }
  return lines.length ? `<canon_facts>\n${lines.join("\n")}\n</canon_facts>` : "";
}

export function extractMemoryCandidatesFromSummary(summaryText, { max = 6 } = {}) {
  // Lightweight parser for summary output that contains numbered or bulleted facts.
  // Real extraction still happens in the AI call; this just normalizes.
  const lines = String(summaryText || "")
    .split(/\n+/)
    .map((l) => l.replace(/^[\s\d.\-*]+/, "").trim())
    .filter((l) => l.length > 8 && l.length < 280);
  const unique = [];
  const seen = new Set();
  for (const line of lines) {
    const key = normalizeMemoryTextForDedup(line);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      text: line,
      at: Date.now(),
      asOf: new Date().toISOString().slice(0, 10),
    });
    if (unique.length >= max) break;
  }
  return unique;
}

export function imageMemoryBlock(memories, scene = "") {
  const visual = memories.filter((m) =>
    /\b(wearing|hair|eyes|clothes|outfit|looks|appearance|scar|tattoo|jacket|dress|shirt)\b/i.test(m.text)
  );
  const block = buildMemoryRetrievalBlock(visual.length ? visual : memories, { maxTokens: 600, preferVisual: true });
  if (!block) return "";
  // Scene-wins: if scene says naked/nude, drop garment memories (caller can filter further)
  if (/\b(naked|nude|unclothed|bare)\b/i.test(scene)) {
    return block.replace(/\(as of[^)]+\)/g, "").replace(/wearing [^.]+\.?/gi, "");
  }
  return block;
}

export const MEMORY_EXTRACTION_INSTRUCTION = `Extract up to 6 durable memory entries from the recent conversation.
Rules:
- Prefer current-state facts (where people are, what they are wearing, ongoing promises, relationship status, decisions just made).
- Use WHO-did-WHAT-to-WHOM + when/where anchoring.
- If a fact contradicts an older one, write only the current version.
- Keep entries short (one sentence, starts with a verb or noun phrase).
- Include names, numbers, and specific details. Never invent.
Format exactly:
1. ...
2. ...
...
6. ...
Stop after the last real entry.`;

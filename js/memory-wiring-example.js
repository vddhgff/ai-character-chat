/**
 * Example wiring for the modular stack (ai.js / app.js).
 * Merge the relevant pieces into your existing ai.js and app.js.
 */

import {
  buildMemoryRetrievalBlock,
  extractMemoryCandidatesFromSummary,
  imageMemoryBlock,
  MEMORY_EXTRACTION_INSTRUCTION,
  memoryKeywordScore,
} from "./memory.js";

// ---------------------------------------------------------------------------
// In ai.js — replace or extend summarizeThread / memory handling
// ---------------------------------------------------------------------------

export async function summarizeThreadWithMemories({ characters, user, messages, summary, summaryUpTo, keepVerbatim = 12 }) {
  // existing summarize logic can stay; after you get the summary text, also extract memories
  const summaryText = await callSummarizer(/* ... existing args ... */); // keep your current call

  const newMemories = extractMemoryCandidatesFromSummary(summaryText, { max: 6 });

  // Optional: ask a second short call for structured memories using MEMORY_EXTRACTION_INSTRUCTION
  // const structured = await callAI({ instruction: MEMORY_EXTRACTION_INSTRUCTION, ... });

  return {
    summary: summaryText,
    summaryUpTo,
    memories: newMemories, // caller stores these on the thread or a memories store
  };
}

export function rankMemoriesForReply(memories, queries, recentChat = "") {
  return memories
    .map((m) => ({
      ...m,
      score: m.embedding ? vectorScore(m.embedding, queries) : memoryKeywordScore(m.text, queries, recentChat),
    }))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// In app.js — backgroundSummarize and prompt assembly
// ---------------------------------------------------------------------------

// Inside backgroundSummarize, after you get the result:
// if (result.memories?.length) {
//   state.thread.memories = dedupeAndAppend(state.thread.memories || [], result.memories);
//   await store.saveThread(state.thread);
// }

// When building the reply prompt (in requestReply or equivalent):
// const memoryBlock = buildMemoryRetrievalBlock(state.thread.memories || [], { maxTokens: 1600 });
// Pass memoryBlock into the instruction / context.

// For images:
// const imageFacts = imageMemoryBlock(state.thread.memories || [], sceneText);
// Append imageFacts to the image prompt when present.

function dedupeAndAppend(existing, incoming) {
  const seen = new Set(existing.map((m) => m.text.toLowerCase().replace(/\s+/g, " ")));
  const merged = [...existing];
  for (const m of incoming) {
    const key = m.text.toLowerCase().replace(/\s+/g, " ");
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(m);
    }
  }
  return merged.slice(-80); // soft cap
}

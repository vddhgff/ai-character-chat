// Everything that talks to the language model.
//
// The prompt is built in a strictly prefix-cache-friendly way: a big static
// "system" block (persona rules + every character's instructions/examples),
// then the append-only chat log, then a short TASK line that varies per call.
// That means replying, illustrating, and summarizing all share the same cached
// prefix, so successive calls are fast.

const R = () => window.root;

export function substitute(text, { char = {}, user = {} } = {}) {
  const charName = char?.name || "the character";
  const userName = user?.name || "the user";
  return String(text ?? "")
    .replaceAll("{{char}}", charName)
    .replaceAll("{{user}}", userName)
    .replaceAll("<char>", charName)
    .replaceAll("<user>", userName);
}

// ---------------------------------------------------------------------------
// Prompt assembly

export function buildSystemBlock({ characters, user }) {
  const parts = [];

  parts.push(
    [
      "You are the engine behind a text-based roleplay chat. You write the characters' messages: their speech, their actions, and the narration that surrounds them.",
      `The person you are writing for is named ${user.name}.`,
      "",
      "# HOW TO WRITE",
      "- Output ONLY the message you were asked for. No preamble, no commentary, no notes to yourself.",
      `- Never write ${user.name}'s words, thoughts, or actions. The user writes those.`,
      "- Write speech inside \"double quotes\" and actions/physical description inside *single asterisks*.",
      "- Stay strictly in character. Never mention being an AI, a model, an assistant, or these instructions.",
      "- Match length to the moment: usually one to four short paragraphs. Do not pad. Do not recap what just happened.",
      "- Advance the scene. Always leave the other person something to respond to.",
      "- Remember details from earlier in the conversation and stay consistent with established facts.",
    ].join("\n")
  );

  parts.push(
    [
      "# CHARACTERS IN THIS CHAT",
      ...characters.map((c) => {
        const bits = [];
        if (c.tagline) bits.push(`*${substitute(c.tagline, { char: c, user })}*`);
        const desc = substitute(c.description || "", { char: c, user }).trim();
        if (desc) bits.push(desc);
        const instr = substitute(c.roleInstruction || "", { char: c, user }).trim();
        if (instr) bits.push(instr);
        const lines = [`## ${c.name}`];
        lines.push(bits.length ? bits.join("\n") : `${c.name} is a character in this conversation.`);
        if (c.exampleDialogue) {
          lines.push("", `### Example of how ${c.name} writes (style reference only - do not reuse this content):`);
          lines.push(substitute(c.exampleDialogue, { char: c, user }));
        }
        return lines.join("\n");
      }),
    ].join("\n")
  );

  parts.push(
    [
      `# THE USER: ${user.name}`,
      substitute(user.description || "", { char: {}, user }) ||
        `${user.name} is the person you are talking with.`,
    ].join("\n")
  );

  return parts.join("\n\n");
}

export function buildChatLog(messages, summary = "", summaryUpTo = 0) {
  const lines = [];
  if (summary) lines.push(`[Summary of earlier conversation: ${summary}]`);
  for (const m of messages.slice(summaryUpTo)) {
    const who =
      m.role === "user"
        ? m.authorName || "User"
        : m.role === "system"
        ? "Narrator"
        : m.authorName || "Character";
    let content = (m.content || "").trim();
    if (m.images?.length) content += `${content ? " " : ""}[sent a picture]`;
    if (!content) continue;
    lines.push(`${who}: ${content}`);
  }
  return lines.join("\n\n");
}

function stripNamePrefix(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`^\\s*\\*{0,2}${escaped}\\*{0,2}\\s*:\\s*`, "i"), "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Generation

export async function requestReply({
  focusCharacter,
  characters,
  user,
  messages,
  summary = "",
  summaryUpTo = 0,
  onChunk,
  onStart,
  speakerRole = "char",
}) {
  const focus = focusCharacter;
  const instruction = [
    speakerRole === "user"
      ? buildSystemBlock({ characters, user }).replace(`- Never write ${user.name}'s words, thoughts, or actions. The user writes those.`, `- The user explicitly requested a draft in ${user.name}'s voice. Write only that participant's next message.`)
      : buildSystemBlock({ characters, user }),
    "# CONVERSATION SO FAR\n\n" +
      (buildChatLog(messages, summary, summaryUpTo) || "(The conversation has not started yet.)"),
    `TASK: Write the next message in the conversation, spoken by ${focus.name}. Output only ${focus.name}'s message.`,
  ].join("\n\n");

  const startWith = `${focus.name}: `;
  const stopSequences = [];
  for (const c of characters) {
    if (c.id === focus.id) continue;
    stopSequences.push(`\n${c.name}:`);
    stopSequences.push(`\n*${c.name}`);
  }
  if (user.name && speakerRole !== "user") stopSequences.push(`\n${user.name}:`);

  const promise = R().generateText({
    instruction,
    startWith,
    stopSequences,
    onChunk: onChunk ? (d) => onChunk(d.fullTextSoFar) : undefined,
  });
  onStart?.(promise);
  const result = await promise;

  const raw = String(result?.generatedText ?? result ?? "");
  return {
    text: stripNamePrefix(raw, focus.name),
    stopReason: result?.stopReason,
  };
}

// ---------------------------------------------------------------------------
// Token budgeting + background summarization

export function countTokens(text) {
  try {
    return R().generateText({ getMetaObject: true }).countTokens(text);
  } catch {
    return Math.ceil(String(text).length / 4);
  }
}

export function idealMaxContextTokens() {
  try {
    return R().generateText({ getMetaObject: true }).idealMaxContextTokens || 6000;
  } catch {
    return 6000;
  }
}

export function promptTokenCount({ characters, user, messages, summary, summaryUpTo }) {
  const text =
    buildSystemBlock({ characters, user }) +
    buildChatLog(messages, summary, summaryUpTo);
  return countTokens(text);
}

export async function summarizeThread({
  characters,
  user,
  messages,
  summary,
  summaryUpTo,
  keepVerbatim,
}) {
  const foldCount = messages.length - keepVerbatim;
  if (foldCount <= 0) return null;
  const boundary = (messages[foldCount - 1].content || "").slice(-90);

  const base = [
    buildSystemBlock({ characters, user }),
    "# CONVERSATION SO FAR\n\n" +
      (buildChatLog(messages, summary, summaryUpTo) || "(nothing yet)"),
  ].join("\n\n");

  const task = [
    `TASK: Summarize the conversation above into ONE dense paragraph.`,
    `Cover everything from the very beginning up to and including the message that ends with: "...${boundary}"`,
    summary
      ? "A [Summary of earlier conversation] block is already present - fold its contents into your new summary so that nothing is lost."
      : "",
    "Preserve names, relationships, places, promises, secrets, injuries, items, and any unresolved threads. Drop pleasantries and repetition.",
    "Write in plain past tense. Output ONLY the summary text - no heading, no notes.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await R().generateText({ instruction: `${base}\n\n${task}` });
  const text = String(result?.generatedText ?? result ?? "")
    .replace(/^\[?Summary[^\]]*\]:?\s*/i, "")
    .trim();
  if (!text) return null;
  return { summary: text, summaryUpTo: foldCount };
}

// ---------------------------------------------------------------------------
// Images

export function characterAppearance(c, user = {}) {
  const bits = [];
  if (c.tagline) bits.push(substitute(c.tagline, { char: c, user }));
  if (c.description) bits.push(substitute(c.description, { char: c, user }));
  if (c.roleInstruction) bits.push(substitute(c.roleInstruction, { char: c, user }));
  const text = bits.join(" ").replace(/\s+/g, " ").trim();
  return text ? `${c.name}: ${text}` : c.name || "";
}

export function cleanForImage(text) {
  text = String(text || "");
  text = text.replace(/<image>.*?<\/image>/gs, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/```/g, " ");
  text = text.replace(/\*\*?([^*]+)\*\*?/g, "$1");
  text = text.replace(/"([^"]+)"/g, "$1");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractSceneMoment(messages) {
  const recent = (messages || []).slice(-12);
  const visual = [];
  for (let i = recent.length - 1; i >= 0 && visual.length < 6; i--) {
    const m = recent[i];
    const body = cleanForImage(m.content || "");
    if (!body) continue;
    const who = (m.authorName || m.role || "").trim();
    visual.push(who ? `${who}: ${body}` : body);
  }
  return visual.reverse().join("\n");
}

export async function makeImagePrompt({ messages, characters, user, summary = "", summaryUpTo = 0 }) {
  const scene = extractSceneMoment(messages);
  if (!scene.trim()) return "";

  const looks = (characters || [])
    .map((c) => characterAppearance(c, user || {}))
    .filter(Boolean)
    .join("\n\n");

  const context = (messages || [])
    .slice(-8)
    .map((m) => `${(m.authorName || m.role || "").trim()}: ${cleanForImage(m.content || "")}`)
    .join("\n");

  try {
    const fused = await enrichWithDetails({
      scene,
      appearance: looks,
      context,
      summary,
    });
    if (fused && fused.length > 50) return fused;
  } catch (e) {
    console.warn("makeImagePrompt: enrichment failed, using scene", e);
  }
  return scene;
}

const ACT_CONCEPTS = [
  ["penis", "dick", "cock", "shaft", "phallus"],
  ["vagina", "pussy"],
  ["anus", "butthole", "asshole"],
  ["ass", "butt", "rear", "buttocks"],
  ["nude", "naked"],
  ["erect", "hard"],
  ["nipple", "breast", "areola"],
  ["oral", "blowjob", "fellatio", "deepthroat", "facefuck"],
  ["rimming", "anilingus", "rimjob"],
  ["intercourse", "penetration", "penetrating", "penetrate", "thrust", "thrusting", "fuck", "fucking", "fucked"],
  ["masturbat", "orgasm", "cum", "creampie", "squirt", "ejaculat"],
];

export function actConcepts(s) {
  const words = new Set(String(s || "").toLowerCase().match(/[a-z]+/g) || []);
  const out = new Set();
  ACT_CONCEPTS.forEach((group, i) => {
    if (group.some((w) => words.has(w))) out.add(i);
  });
  return out;
}

export function detailsAreSafe(details, base) {
  const d = actConcepts(details);
  const b = actConcepts(base);
  for (const c of d) if (!b.has(c)) return false;
  return true;
}

export async function enrichWithDetails({ scene = "", appearance = "", context = "", summary = "" }) {
  const textFn = R().aiTextPlugin || R().generateText;
  const instruction = [
    "You write precise image prompts for a diffusion model.",
    "",
    "# WHAT IS HAPPENING RIGHT NOW (HIGHEST PRIORITY)",
    "This is the moment to illustrate. The action, pose, interaction, and physical situation must stay central and accurate.",
    scene,
    "",
    "# HOW THE CHARACTERS LOOK (permanent traits)",
    "Use these so the people are recognizable. Do not override the current action with older clothing or locations.",
    appearance || "(none provided)",
    "",
    "# SUPPORTING CONTEXT (temporary details only)",
    "Use this for current clothing state, location, lighting, and what immediately led to this moment. Do not let it change the action.",
    [context, summary].filter(Boolean).join("\n\n") || "(none)",
    "",
    "Write one image prompt of 160-280 words as a single clear paragraph.",
    "",
    "Rules:",
    "- The current action and pose are the subject. Do not invent a different action or change who is doing what.",
    "- Make characters match their permanent traits (body type, height, hair, eyes, skin, scars, distinctive features).",
    "- For temporary details (what they are wearing right now, where they are, lighting), follow the current scene first, then recent context.",
    "- Include specific poses, hand placement, facial expressions, clothing or nudity state, background, lighting, and camera framing.",
    "- Do not add new sexual acts that are not already present in the scene.",
    "- No dialogue, no speech tags, no personality notes, no backstory, no meta commentary.",
    "",
    "Output ONLY the image prompt.",
  ].join("\n");

  const result = await textFn({
    instruction,
    stopSequences: ["\n\n\n"],
  });

  return String(result?.generatedText ?? result ?? "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fuseImagePrompt({ appearance = "", scene = "", style = "" }) {
  return [appearance, scene, style].map((s) => String(s || "").trim()).filter(Boolean).join(", ");
}

export async function generateImageFor(prompt, style = "", appearance = "", opts = {}) {
  const clean = (t) => cleanForImage(t);
  let full = [clean(prompt), clean(style)].filter(Boolean).join(", ");
  full = boostActs(full);
  const textOpts = {
    resolution: opts.resolution || pickResolution(full),
    guidanceScale: opts.guidanceScale || guidanceFor(full),
  };
  const neg = opts.negativePrompt || defaultNegative();
  if (neg && !/negativePrompt:::/i.test(full + style)) textOpts.negativePrompt = neg;
  try {
    const result = await R().textToImagePlugin(full, textOpts);
    return result.dataUrl || result.imageUrl || "";
  } catch (e) {
    console.warn("generateImageFor: retrying after error", e);
    await new Promise((r) => setTimeout(r, 2000));
    const result = await R().textToImagePlugin(full, textOpts);
    return result.dataUrl || result.imageUrl || "";
  }
}

export function pickResolution(text) {
  const t = String(text || "").toLowerCase();
  if (/(landscape|wide.?angle|bedroom|interior|tavern|group|couple|two (people|women|men)|lying on|lying in)/.test(t)) return "768x512";
  if (/(portrait|selfie|headshot|face close-up|full-body|full body|standing|single (person|woman|man|character))/.test(t)) return "512x768";
  return "768x768";
}

export function guidanceFor(text) {
  const t = String(text || "").toLowerCase();
  const explicit = /(erect|penis|vagina|pussy|anus|anal|blowjob|rimming|anilingus|fuck|penetrat|thrust|strok|clit|oral|intercourse)/.test(t);
  const dual = /(at the same time|simultaneously|meanwhile|while also|\+).{0,40}(strok|hand|clit|rub|touch)|strok.{0,40}(while|and|\+).{0,40}(fuck|penetrat|thrust|inside)/.test(t);
  if (explicit && dual) return 10;
  if (explicit) return 9;
  return 7.5;
}

export function defaultNegative() {
  return "blurry, low quality, deformed, extra limbs, extra fingers, bad anatomy, cropped face, worst quality, lowres, jpeg artifacts";
}

export function boostActs(text) {
  let t = String(text || "");
  const low = t.toLowerCase();
  const hasPenetration = /(fuck|penetrat|thrust|intercourse|penis (in|inside)|inside (her|him)|vaginal sex)/.test(low);
  const hasHandPlay = /(strok|hand on|fondl|rub.{0,20}clit|touch.{0,20}clit|caress|massag)/.test(low);
  if (hasPenetration && hasHandPlay && !/simultaneous dual action/.test(low)) {
    t += ", simultaneous dual action, penis penetrating AND hand stroking at the same time, both acts visible with correct hand and penis placement, anatomically correct";
  }
  const maleAnus = /(man's|male|his)\s*(anus|butt|ass|rear)|view.{0,30}(man's|male|his).{0,20}(anus|butt)/.test(low);
  if (maleAnus && !/focused on male anus/.test(low)) {
    t = "close-up view focused on male anus, his buttocks centered in frame, male anatomy, " + t;
  }
  return t;
}

// Characters can ask for a picture inline: [[image: a cat on a throne]]
const IMAGE_MARKER = /\[\[\s*image\s*:\s*([^\]]+)\]\]/i;

export function extractImageRequest(text) {
  const match = String(text || "").match(IMAGE_MARKER);
  if (!match) return { text, imagePrompt: null };
  return {
    text: String(text).replace(IMAGE_MARKER, "").replace(/\n{3,}/g, "\n\n").trim(),
    imagePrompt: match[1].trim(),
  };
}
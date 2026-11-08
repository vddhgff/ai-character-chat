# ai-character-chat (local copy) — notes for future agents

This generator is a **verbatim copy of perchance.org/ai-character-chat**, with feature additions on top (see "Art styles", "Imagination", "Narrator", "Image director", "Inner life", "Auto-talk", "Internet research for image generation", "Comic mode", and related sections below) plus a few small app-wide tweaks (see "App-wide tweaks"). `main.pjs` + `index.html` are the whole app; there are no `src/` code files in use — this README is documentation only (see "Unused leftovers in `src/`" at the end for why unrelated `src/*.js` files are sitting there).

## Current state (quick reference)

| Feature | Status | Main controls | Key entry points |
|---------|--------|---------------|------------------|
| Art styles | Active | Header 🎨 select + gallery, settings default | `artStylePresets`, `renderThreadArtStyleSelector` |
| Imagination | Active (flavor/spark prompt currently gated off by user request; one-line revert) | Header ✨ + ⚙️ dialog | `imaginationFlavors`, `openImaginationSettings` |
| Narrator | Active | Header 🎭 + ⚙️ dialog | `narratorStyles`, `narratorSpeak`, `openNarratorSettings` |
| Image director | **Active** | ⚒️ options → 🖼️ image director | `imageDirectorDefaults`, `openImageDirectorSettings` |
| Internet research for images | **Active** | Header 🔎 + ⚙️ | `aiWebImageResearch`, `aiWebAccessIsOn` |
| Inner life | Active | Header 🧠 + ⚙️ dialog | `innerLifeAspects`, `openInnerLifeSettings` |
| Body needs | Active | Header 🍗💧, `/feed` `/drink` `/needs` | `bodyNeedsForThread`, `bodyNeedsDirectiveText` |
| Economy | Active | `/give` `/rent`, header toast | `economyProcessBuyTags`, `economyScanGifts` |
| Auto-talk + Living world | Active | Header 🎭 toggle + ⚙️ | `autoTalkStart`, `openAutoTalkSettings` |
| Comic mode | **Active** | Header 💥 + `/comic` | `comicModeDefaults`, `openComicModeSettings` |
| Free will | Active | Header 🕊️ + `/freewill` | `freeWillSettings` |
| User description | Active | ⚒️ options → 🪪 describe yourself, `/me` | `thread.userCharacter.roleInstruction` |
| Careful-reader fuse | **Active** (scene-first) | Automatic on every image | `fuseImagePrompt`, `enrichWithDetails` |
| Memory | Active (whole-memory mode + keyword fallback + richer extraction) | Automatic + `/mem` | `memoryKeywordScore`, `wholeMemoryMode` |

**Image generation path (unrestricted, scene-first):**  
Current scene (highest priority: action, pose, interaction) → character permanent traits from descriptions → temporary state from recent chat + memory → optional research keywords → optional image-director instruction → art-style prefix/suffix. No content-rewriting scrubbers, no SEX-TOKEN master gate, no forced staging leads that invent content. Adult styles retain only the no-minors negative list. The fuse and grounding block consult character descriptions on every generation unless the caption is a pure user-typed `<image>` tag. The fuse produces a coherent 160–280 word prompt with the current action kept central.

---

## Layout

- `index.html` (~1.1 MB, the whole app: HTML + all JS + CSS)
- `main.pjs` — plugin imports + a few top-level lists/functions. Copied from upstream, with the `$meta` block edited (title/description/tags/listing image now mention the art-style feature). Imports: `ai-character-chat-dependencies-v1`, `ai-text-plugin`, `text-to-image-plugin`, `comments-plugin`, `tabbed-comments-plugin-v1`, `upload-plugin`, `super-fetch-plugin`, `fullscreen-button-plugin`, `combine-emojis-plugin`, `bug-report-plugin`, `huge-emoji-list`.
- `scratch/generators/ai-character-chat/` (ephemeral) — pristine upstream source if a diff against upstream is ever needed.
- The live page starts at ~389x200 CSS px in this workspace's preview pane (so `#messageFeed.offsetHeight` is ~0 and `doBotReplyIfNeeded` will silently do nothing) — **always `set_viewport_size` before testing anything that renders or replies**, and note that the setting resets whenever a run ends, so re-apply it and poll `window.innerHeight`. With a tall viewport, whole-page snapshots via the `snapshot.js` helper work fine (it may fall back to html2canvas when snapdom fails; the fallback mispositions the absolutely positioned `#messageFeedHeaderBar` at the very top, which is a capture artifact, not a layout bug — verify the bar numerically with `getBoundingClientRect` instead).

## Listing / social image

`$meta.image` (and `$meta.dynamic`'s `defaults.image`) point at `https://user.uploads.dev/file/81f0fed2bdd4c315ee3dc9e32ab8c640.jpg` — a 1568x1048 3x2 grid showing the same subject in six different styles, used as the generator's listing card and social-share image. It was assembled (not generated in one shot) from six 512x512 `generate_image` portraits — photo, anime, watercolor, pixel art, cyberpunk, paper cutout — stitched with `OffscreenCanvas` and 8px white gutters, then uploaded. The six tile sources are permanent uploads:

- `https://user.uploads.dev/file/a1247567448be41e5b2b9833d186d494.jpg` (photo)
- `https://user.uploads.dev/file/d094d8ab864e6aae9376165730240e4b.jpg` (anime)
- `https://user.uploads.dev/file/5c11773d078d4794fdebd45003881f7d.jpg` (watercolor)
- `https://user.uploads.dev/file/075684705afe58ae34839293ec6857f2.jpg` (pixel art)
- `https://user.uploads.dev/file/3f67522e403e4f44b24731a95678cd9a.jpg` (cyberpunk)
- `https://user.uploads.dev/file/c4706379128b788e079a7d68ab98a552.jpg` (paper cutout)

To rebuild: fetch each into `scratch/`, read them in `execute_js`, `drawImage` each into a `3*512+4*8` x `2*512+3*8` `OffscreenCanvas` (fill white first, 8px gutters), then `convertToBlob({type:"image/jpeg", quality:0.92})` and `upload_file` the result.

## Feature blocks in `index.html` (line numbers move — search the listed tokens)

- `~6135–6518` art styles (search `artStylePresets`)
- `~6729–7400` **imagination** (search `imaginationFlavors`)
- `~7408–8000` **narrator** (search `narratorStyles`)
- **image director** — active (search `imageDirectorDefaults`)
- `~8020–8780` **internet research for image generation** (search `aiWebAccessDefaults`, `aiWebImageResearch`) — fully enabled
- `~8780–9320` **inner life** (search `innerLifeAspects`)
- `~9322–…` **body needs** (search `bodyNeedsMinPerMessage`), **economy** (search `economyFmt`), **auto-talk** (search `autoTalkDefaults`, `~10297`)
- Image prompt assembly is unrestricted and scene-first: current scene + character permanent traits + temporary state from recent chat/memory + optional research keywords + optional fuse + image-director instructions + art-style prefix/suffix reach the model. Adult styles retain no-minors negatives only. No IMAGE RULE disable block, no faithful-mode content scrubbing, no SEX-TOKEN master gate.
- `~15349–15630` image prompt helpers + `~16019–16191` call-site assembly: role direction, ownership anchoring, and staging leads are available when the scene supports them, but do not hard-gate or scrub content. Guidance scales with explicitness; tame and explicit scenes both pass through cleanly.

## Art styles (the added feature)

User request: *"Make me able to change its art style."* Implemented as the art style of **generated images** (not the app's own UI theme).

Two levels:

1. **Per character** — character editor has a visible `🎨 Image art style` dropdown (`data-spec-key="artStyle"`), plus a `🎨 browse style gallery & preview` / `👁️ preview current style` button row (`artStyleExtras`).
2. **App-wide default** — `⚙️ settings` → `🎨 Default image art style`, used for every character that has no style of its own.

**Key design rule: no new character fields.** A preset choice is just a shortcut that writes the pre-existing `imagePromptPrefix` / `imagePromptSuffix` character fields (and the `globalImagePromptPrefix` / `globalImagePromptSuffix` rows in the `db.misc` table), so share-link hashes, stored characters and the upstream schema are all unaffected. The `artStyle` key returned by the modal is deleted before the character is saved.

### The preset library

- `window.artStylePresets` — **56 presets** in **8 categories** (`window.artStyleCategories`): `anime`, `art` (painting/illustration), `traditional`, `photo`, `3d`, `graphic` (poster/print: art deco, vintage poster, risograph, constructivist, street art), `craft` (felt, paper cutout, linocut, knitted, stained wood), `retro` (PS1, voxel, VHS, etc.).
- Three **18+** presets: `ecchi` (😳 suggestive fan-service, no explicit acts) and `hentai` (🔞 explicit adult doujin art) in `anime`, plus `adult3d` (💦 explicit adult 3D render) in `3d`. The anime two use `artStyleAdultAnimeSuffix` / `artStyleHentaiSuffix`, which are `artStyleNegativeBase` plus an explicit **no-minors** negative list (child, kid, loli, shota, underage, minor, young) alongside the usual no-photo/no-3d/no-censorship terms; `adult3d` uses `artStyleAdult3DSuffix`. No other content restrictions are applied.
- Each preset is `{id, name, emoji, category, prefix, suffix}`; a "style" is what gets appended to the image prompt (`prefix + <prompt> + suffix`). `artStyleNegativeBase` holds shared negative-prompt text.
- `window.artStyleTestSubjects` (12 varied subjects) + `defaultArtStyleTestSubject` give the gallery something concrete to render each style on.

### Helpers (all on `window`, all in `index.html`)

- `artStylePresetById`, `artStylePresetFromPrefixSuffix` (reverse-lookup a style from a character's existing prefix/suffix), `artStyleOptionsForSelect`, `artStyleFieldEl`, `artStyleSetPrompt2Fields`, `artStylePrompt2ExtrasHtml`, `artStyleOnSelectChange`.
- `openArtStyleGalleryForInput(inputEl, opts)` / `openArtStyleGallery(...)` / `openArtStyleGalleryForRoot(opts)` — the gallery modal (async).
- `artStyleLoadRecent()` / `artStylePushRecent(id)` — "recently used" list persisted in the `db.misc` table under key `artStyleRecentIds` (max 8; `"custom"` allowed, `"none"` is ignored).
- `showToast(message, {ms})` — self-contained toast appended to `.appToastCtn` (fixed bottom-centre, z-index 10000002). Deliberately **not** `#statusNotifier` (that element is the app's "stop response" area).
- `renderThreadArtStyleSelector(threadCharacter)` — builds/updates the **chat-header quick switcher** (see below).

### The gallery modal

Searchable (`🔍 search`), filterable by category (incl. `recent` = 🕘 recently used), with:

- an **example subject** input + 🎲 surprise button — controls what each preview shows;
- a **seed** input (default `12345`) + 🎲 random-seed button — all previews in one session use the same seed, so styles are compared on a comparable image rather than on random variation. Cache key is `${seed}|${prompt}`, capped at 200 entries (`window.__artStylePreviewCache`, per page load);
- **real preview images** generated through `root.textToImagePlugin` (only on click — cards show an emoji placeholder until previewed) with a per-card collapsible `prompt text` `<details>` and a 📋 copy-to-clipboard button;
- a footer `🚫 no style` button, `✕`/done/`Esc` to close, a custom-style card, and an empty-state notice when a filter matches nothing.

A caller that has no form fields can drive it via `opts.onApply({id, prefix, suffix})` (this is how the header switcher reuses the gallery).

### Chat-header quick switcher

Inside `#messageFeedHeaderBar` (after the invisible model selector) sits `#threadArtStyleCtn` (`margin-left:auto`): a `🎨` label, `#threadArtStyleSelector` (58 options — 56 presets + `none` + `custom`, compact labels), a `#threadArtStyleGalleryBtn` (🖼️) and a `#threadArtStyleRandomBtn` (🎲 = "surprise me", picks a random preset from `window.artStylePresets` other than the current one, applies it and toasts — same `applyStyle` path, so it also pushes to recents). Changing the select writes straight to the character row via `db.characters.update(id, {imagePromptPrefix, imagePromptSuffix})`, shows a toast and pushes to recents. The `custom` option doesn't overwrite anything (it toasts and reverts the select); the 🖼️ button opens the gallery in `onApply` mode. `renderThreadArtStyleSelector` is called from `showThread(threadId)`.

### Tap-a-name to switch the auto-replier (2026-10-28, user request)

Tapping a character shortcut button above the reply box (e.g. the "🗣️ HerName" button created by "add a character", whose message is `/ai @Name#id …`) now makes that character the thread's automatic replier: `window.setThreadAutoReplyCharacter` writes `thread.characterId` + `window.activeCharacterId` (the identity `doBotReplyIfNeeded` replies as), then refreshes placeholder, favicon, art-style selector, thread list and shortcut labels (`{{char}}`), with a `💬 <name> will now reply automatically` toast. The tap still fills the input with the shortcut text as before (single tap never sends), so double-tap one-off replies keep working. Buttons whose message isn't `/ai @Name#id` (default 🗣️ {{char}}, Narrator, Image…) are unaffected.

### Image prompt assembly (unrestricted, scene-first)

The final prompt is assembled with this priority:

1. **Current scene** (what is happening right now — action, pose, interaction) — highest priority
2. Character permanent traits (body type, height, hair, eyes, distinctive features) from descriptions
3. Temporary state from recent chat + memory (current clothing, location, what just led to this moment)
4. Optional researched keywords (when enabled)
5. Optional careful-reader fuse output (when enabled)
6. Optional image-director instruction
7. Art-style prefix + suffix

No hard faithful-mode truncation, no SEX-TOKEN master gate, no automatic rival-member scrubbing, and no forced staging leads that invent content. Ownership anchoring, hair-dye guards, panel negatives, and motion-line negatives remain available as optional helpers but do not rewrite or suppress scene content. Adult styles keep only the no-minors negative list. Guidance and resolution follow the style and scene normally.

Helpers `__imageScrubRivalMember`, `__imageOrderLead`, `__imagePersonCountEcho`, `__imageMemoryBlock` exist and can be called when useful, but the default path does not force them. The scene reaches the model with enrichment options intact. The fuse (`enrichWithDetails`) produces a coherent 160–280 word prompt that keeps the current action central.

### Where the code lives (all in `index.html`)

- Art-style block ~line 6123–6720 (search for `artStylePresets`).
- Character editor: the `artStyle` / `artStyleExtras` specs (~line 11496) + the submit-time mapping from `result.artStyle` → `imagePromptPrefix`/`imagePromptSuffix` (search for "the art style dropdown is just a UI shortcut", ~line 11535).
- Settings modal: the global controls + save into `db.misc` (~line 18425–18458).
- **Image prompt assembly** (search for the image options construction): director + research + fuse + scene + style, joined cleanly. Negatives are style-driven plus optional ownership/concealment helpers; no content is rewritten on this path. Helpers for role direction, insertion detection, and member ownership exist but are non-blocking.

### Image ownership / dye / panel helpers (optional, non-restrictive)

These remain as soft helpers that can add negatives when useful, without rewriting the scene or blocking generation:

1. Ownership pinning for bare descriptors (nearest person-noun attribution).
2. Hair-dye guard (natural hair → weighted dye negatives when no dye language is present).
3. Single-panel framing negatives and guidance floor for explicit scenes.
4. Motion/speed/shiver line negatives.

Describer instructions still prefer affirmative language and exact headcount, but the image model receives the scene without forced rewrites.

### Description selection, grounding + adherence

Selective description retrieval (visual-trait query + higher budget for image mode) and description grounding blocks remain available and are appended after the scene when present. Scene wins on conflicts. Anti-bleed ownership repetition stays in describer instructions.

### Memory in the image prompt

`window.__imageMemoryBlock(threadId, scene)` builds "Established facts: ..." from the thread's DB memories (visual/clothing/place sentences, scene-wins filters). Appended after the scene when non-empty. Skipped for pure user-typed captions if desired. Prefer visual/clothing memories when present; naked scenes drop garment memories.

### Testing it

Set a style (character or global), then put `<image>a red apple on a wooden table</image>` in a message and call `await window.renderMessageFeed(window.activeThreadId,{forceFullRender:true})` while monkey-patching `root.textToImagePlugin` to capture the prompt string.

For the selector/gallery UI itself: `renderThreadArtStyleSelector(...)` and dispatch a `change` event on `#threadArtStyleSelector`, then read back the character row from `db.characters.get(id)`.

Remember to leave no test state behind (character prefix/suffix `""`, global `__globalImagePromptValues` cleared, `artStyleRecentIds` cleared, and remove any `textToImagePlugin` monkey-patch).

## Auto-talk (the second added feature)

User request: *"Make an option that I can deactivate or activate when I want the option. Is that letting characters speak between themselves without me needing to do anything?"* So: a one-click on/off switch that makes the characters in the open chat keep replying to **each other**, forever, with no user input.

Follow-up request: *"Let me choose which, and which character talk with each other."* So on top of the switch there's a per-chat **participant picker**: every character in that chat can be set to sit a turn out, talk to everyone, or talk to **one specific** other character (or to you), and the user's own character can be turned on/off. This is what the ⚙️ button next to the 🎭 toggle opens.

### UI

- A row above the message box, inside `#inputWrapper` (between `#userMessagesSentHistoryCtn` and `#shortcutButtonsCtn`): `#autoTalkBar` → `#autoTalkToggleBtn` (`🎭 let them talk` ↔ `🎭 stop auto-talk`, turns green while running), `#autoTalkPauseBtn` (⏸/▶, `hidden` unless a run is active, turns amber while paused), `#autoTalkSettingsBtn` (`⚙️`, tooltip "auto-talk settings - choose which characters talk with each other") and `#autoTalkStatusEl`. The status line is the per-chat summary, e.g. `Chloe + Yani Neko + Anon (you) · up to 25 messages`, and while running it shows progress and the upcoming speaker, e.g. `3 / 25 messages · next up: Yani Neko → Chloe` (the arrow appears only when that speaker has a target) or `⏸ paused · 3 messages · next up: …`. **Layout note:** the bar is deliberately kept to one *thin* row (font ~80%, tight button padding, `flex:0 0 auto` on the buttons) so it costs ~25px instead of the ~69px it used to. `#autoTalkStatusEl` is the flexible item (`flex:1 1 0; min-width:0`) and truncates with an ellipsis; `autoTalkRenderBar` puts the full text in `statusEl.title` for hover. Everything still fits one row down to ~300px wide with the ⏸ button showing.
- `#autoTalkOptionsButton` (`🎭 auto-talk & who talks with whom…`) in `#threadOptionsPopup` (the `⚒️ options` menu) opens the same settings dialog.
- Settings dialog (`window.openAutoTalkSettings()`): `prompt2` modal with a short explainer, then **one dropdown per character in this chat** plus one for the user's character, then the global knobs. Each dropdown value encodes participant *and* target: `"off"` = sits this one out; `"all"` = talks to everyone in the chat; `"id:<n>"` = talks only with character `<n>`; `"id:-1"` = talks only with the user's character (`userName`). A centered `➕ bring another character into this chat…` button opens a character picker (`autoTalkPickCharacterToAdd`), adds the chosen character to the thread's `replyAsCharacterIds`, then reopens the settings dialog with the new row present.
- **Quick presets** row (`specs.presets`, a `buttons` spec) above the dropdowns, so the common setups are one click instead of N dropdown edits: `🎭 everyone ↔ everyone`, `🤝 just two of them…` (a second `prompt2` asking for two characters — they get `targetId` each other and nobody else joins), `🧑 everyone → <you> only` (every character targets `-1`, and the user's character sits out) and `🚫 mute everyone` (empty selection — auto-talk then refuses to start with a toast pointing at ⚙️). A preset click sets `presetRequested` and calls `controls.cancel()` (that's how `prompt2`'s `buttons` specs signal intent); after the promise resolves falsy the handler runs `autoTalkApplyPreset`, which saves the config, then reopens the dialog so the dropdowns show the new state. NOTE: `prompt2` marks a `<select>` option `selected` via `o.value === spec.defaultValue` (strict equality) — pass option values as **strings** (`String(c.id)`), or a numeric `defaultValue` silently leaves the first option selected. `autoTalkTidyPresetButtons()` is called just before the `prompt2` call: `prompt2` renders a `buttons` spec as a grid of `width:max-content` buttons (each a different width, centred in its column), so it polls for that row and stretches the four preset buttons to fill their columns — a tidy two-up grid. Scoped to this modal (it only touches buttons whose text matches a preset), so other dialogs are unaffected.
- Global knobs (unchanged): `maxMessages`, `pauseSeconds`, `instruction`. Saved to the `db.misc` key `autoTalkSettings` as `{mode, maxMessages, pauseSeconds, instruction}`. **`mode` is no longer a user-facing setting** — it's just the remembered default for a chat that has no explicit participant config yet (see below).

### Participants & targeting

- Per-chat config lives in the `db.misc` key **`autoTalkThreadParticipants`**, shaped `{"<threadId>": {entries:[{id, targetId}], includeUser, userTargetId}}` where `targetId` is `null`/absent = everyone, `-1` = the user's character, otherwise a character id. Written by `window.autoTalkSaveThreadConfig`, read by `window.autoTalkLoadThreadConfig`.
- `autoTalkLoadParticipants()` turns that (plus the thread's cast) into `{cfg, explicit, cast, candidates, byId, nameOf, entries, includeUser, userTargetId, userName}`; `explicit` is false when this chat has never been configured, and then the **fallback** applies: everyone in the cast talks, plus the user's character if `mode === "both"` — i.e. exactly the original behaviour, so untouched chats behave as before.
- **Cast** = distinct `characterId`s of the thread's messages (positive ids only — `-1` user / `-2` system are excluded), plus `thread.characterId`, plus `thread.replyAsCharacterIds` (that's also where the ➕ flow adds someone). Deleted characters are dropped.
- `autoTalkBuildSequence(entries, includeUser, userTargetName)` flattens the speakers into a round-robin turn list (`{character, targetName}` items, plus `{user:true, targetName}` when the user's character is included); `autoTalkTurnInstruction(globalInstruction, speaker)` builds the per-turn `replyInstruction`, e.g. `"This message should be addressed specifically to <target> - reply to what <target> said or did, and don't write anyone else's lines."`, which is prepended to the user's optional global `instruction`. `autoTalkRefreshSummary` redraws the bar; the `showThread` hook already calls `window.autoTalkRenderBar()`.
- **Fallback** (unchanged): if the chat has fewer than 2 speakers, the user's character joins in automatically (with a toast explaining why) — otherwise "characters only" would mean a character monologue. If the selection ends up with **nobody** speaking, auto-talk refuses to start and points at the ⚙️ settings instead.
- The engine is one message per turn: `doBotReplyIfNeeded({forceReply:true, characterOverride})` for a character, `doBotReplyInPlaceOfUser()` for the user's character, always with `expectsReply:false` (so the app's own auto-reply logic and the *next* auto-talk turn don't double-fire). The app's prompt already says each character speaks only for themselves and injects a summary of who has spoken recently, so a simple round-robin really does read as characters talking to each other.
- `maxMessages:0` means "don't stop until I turn it off". `pauseSeconds` (0–30) inserts a beat between messages. `instruction` is only passed when non-empty (default `null` = let the model continue naturally).

### Loop / safety

`window.autoTalkStart()` builds a `run` object (`{threadId, participants, cast, includeUser, seq, index, count, failures, idleTries, stopped, paused, busy, currentSpeaker, ...}`) and fires `autoTalkLoop(run)`. The loop:

- exits as soon as `autoTalkRun !== run` (that's what stop does — `run.stopped` + `autoTalkRun = null`) or if the user switches chats;
- **waits while `run.paused`** (checked at the top of every turn, in 400ms slices) — that's `window.autoTalkTogglePause()`, wired to `#autoTalkPauseBtn`. Pausing does not abandon the run, it just stops starting new turns; a generation that was already in flight finishes (so you can get one extra message right after pausing — expected, you can't un-generate one);
- pauses while `document.visibilityState !== "visible"` and while the app's module-scope `botIsCurrentlyReplying` flag is set (so a manual `/ai` doesn't interleave);
- counts messages via `db.messages.where("threadId").equals(...).count()` before/after each turn to detect success. A failed turn increments `failures` (stops with a toast after 3); a turn that produced nothing while `$.messageFeed.offsetHeight === 0` counts as "chat not on screen" instead (`doBotReplyIfNeeded` bails in that case) and just retries;
- stops itself (with a toast) at `maxMessages`.

`autoTalkRun` is the single source of truth for on/off; the persisted `autoTalkSettings.mode` is only the fallback default for unconfigured chats, and `autoTalkThreadParticipants` holds the real per-chat selection. `run.seq` is built once by `autoTalkBuildSequence` at start, so a participant edit applies to a **running** loop only because the save handler and the presets both go through `autoTalkApplyConfigToLiveRun({threadId, entries, includeUser, userTargetId, userName, idToName})`, which patches the live run in place (`participants`/`cast`/`includeUser`/`mode`/`seq` rebuilt, `index` reset to 0 — guarded by `liveRun.threadId === threadId` and a non-empty selection; a selection with nobody in it is ignored so you can't strand a running loop). The dialog swap also updates `pauseSeconds`/`maxMessages`/`instruction`. **Nothing auto-resumes after a page reload** (deliberate — auto-resuming would silently burn generations).

### Living world (the world goes on without the user)

Opt-in layer on top of auto-talk: when enabled, an idle watchdog wakes the world after N quiet minutes, and it keeps going (endless) until the user types or sends.

- Settings live inside `autoTalkSettings.livingWorld` as `{enabled, idleMinutes, narratorEvery}` (defaults `{false, 5, 6}`), normalized by `livingWorldCfg()` (clamps idle 1–120, narratorEvery to 0/3/6/12). Edited in the same 🎭 settings dialog (🌍 section: on/off select, idle-minutes textLine, narrator-beat select); the save handler must keep writing `livingWorld` or it gets wiped. `autoTalkLoadSettings` backfills it for stored settings predating the feature.
- `window.livingWorldInit()` (called once at load) tracks `window.livingWorldLastActivity` and runs `window.livingWorldWatchdog` every 20s. The watchdog starts `window.autoTalkStart({living:true})` only when: enabled, no run active, tab visible, a chat open with a visible feed, nobody replying, and idle longer than the threshold.
- `window.livingWorldNoteActivity()` (wired to `#messageInput` input/keydown and the send button — deliberately *not* scrolling) refreshes the idle clock, and if a living run is active it stops it with a "🌍 welcome back — N things happened while you were away" toast.
- A living run is an auto-talk run with `run.living=true`, forced `maxMessages=0`, a minimum 20s `pauseSeconds` (quota brake), and `run.narratorEvery`. Every Nth turn is a narrator beat (system character + `messageNameOverride:"Narrator"`, no dialogue) instead of advancing the speaker rotation. The bar shows it (`🌍 living world · N messages`, `stop living world` toggle, `🌙 world wakes after X idle min` when dormant); stop/exit toasts branch on `run.living`.
- Limits, by design: it only runs while this page is open and visible (hidden tabs pause via the existing loop guard) — it can never run with the tab closed. Nothing resumes after reload; after a reload the watchdog just starts the idle clock over. It spends real generations the whole time it's awake, which the settings dialog says outright.
- Testing: same stub-`root.aiTextPlugin` trick as auto-talk, then `autoTalkSettings.livingWorld={enabled:true,…}; autoTalkSaveSettings(); autoTalkStart({living:true})`. Use an explicit cast-only thread config to dodge the user-speaks path, dispatch `input` on `#messageInput` to test the welcome-back stop, and clean up messages + `autoTalkThreadParticipants` + `autoTalkSettings` + the stub. Note living runs also write `innerLifeState` — scrub stub text from it afterwards.

### Notable gotchas for future work

- Everything in the block runs inside the app's single `<script type="module">`, so it can reach module-scope things that page_eval **cannot**: `db`, `doBotReplyIfNeeded`, `doBotReplyInPlaceOfUser`, `botIsCurrentlyReplying`, `getUserCharacterObj`, `$`, `delay`. That's why the entry points are explicitly exported onto `window` (`autoTalkStart/Toggle/TogglePause/Stop/IsRunning`, `openAutoTalkSettings`, `autoTalkLoadSettings`, `autoTalkSaveSettings`, `autoTalkRenderBar`, `autoTalkGetCast`, and — for the participant feature — `autoTalkLoadThreadConfig(threadId)` / `autoTalkSaveThreadConfig(threadId, cfg)`). The participant helpers themselves (`autoTalkLoadParticipants`, `autoTalkBuildSequence`, `autoTalkTurnInstruction`, `autoTalkPickCharacterToAdd`, `autoTalkApplyPreset`, `autoTalkApplyConfigToLiveRun`, `autoTalkRefreshSummary`, `autoTalkEscapeName`, `autoTalkTidyPresetButtons`) stay module-local; reach them by hand only if you must.
- `autoTalkBuildSequence(entries, includeUser, userTargetName)` returns the round-robin turn list (`{character, targetName}` / `{user:true, targetName}`) and `autoTalkTurnInstruction` combines the global instruction with the speaker's target sentence; keep those two in sync if you change the run-object shape (`run.participants` is `[{character, targetId, targetName}]`, `run.cast` is `[character]`).
- `doBotReplyIfNeeded` silently does nothing when `#messageFeed` has zero height, and the preview pane in this workspace is short (389x150 CSS px by default → feed height 0), so **always `set_viewport_size` to something tall (e.g. 1000x760) before testing auto-talk**.
- `doBotReplyIfNeeded` / `doBotReplyInPlaceOfUser` call `alert(e.stack)` on unexpected errors, which blocks the preview: stub `window.alert = () => {}` in `page_eval` before testing.
- Testing it uses real `ai-text-plugin` generations (one per message), so keep `maxMessages` small, and clean up afterwards.
- For testing without burning generations, monkey-patch `root.aiTextPlugin` (it **is** reachable from page_eval) with a stub that returns `{generatedText:"x"}` and, when `opts.preload`, `{}`. `opts.getMetaObject()` must return `{countTokens:()=>1, idealMaxContextTokens:4000}`; a harmless `countTokens is not a function` console error is stub-induced. Restore `root.aiTextPlugin` afterwards (keep a reference first).
- The participant config lives in `db.misc` under `autoTalkThreadParticipants` and is keyed by thread id, so **testing it writes into the user's real misc store**. As of 2026-09-16 the preview origin's DB (`https://e3ee52be5b2526e2db32cf9a7fbbe732.perchance.org/5shpo77nku`, Dexie DB name `chatbot-ui-v1`) holds 3 characters (1 Chloe, 2 Oni, 3 Yani Neko) and 2 threads: thread 1 = "Unnamed Thread" (Chloe, a single message, id 293, whose text looks like a truncated stream — use this thread as your scratch thread) and thread 2 = "Alleyway Transaction" (Oni, the user's real chat — never run auto-talk against it). Delete the keys/entries you create and the messages you generate. NOTE: because the DB name is fixed (`chatbot-ui-v1`) and IndexedDB is per-origin, **a rename/save changes which data the preview sees** — earlier sessions worked in an origin whose DB had a third chat; if a user's chat seems to have vanished, check which generator name the preview is running under before assuming a bug.
- The settings dialog's add-character flow adds to `thread.replyAsCharacterIds` immediately (that's how the character joins the chat), so clean that up too if you test it.
- For a **non-stub** smoke test of the pause button: `root.aiTextPlugin`'s stub shape is only complete for the reply path — the app's thread auto-naming calls it with a different callback shape and will throw `undefined is not an object (evaluating 'data.text.trim')` (harmless, stub-induced; it shows up in `perchanceErrors`).

## Imagination (the third added feature)

User request: *"Make everything about the imagination better."* Implemented as two complementary prompt-level controls that make the AI's writing more inventive:

1. a persistent **flavor** — a rich writing direction (framing, senses, subtext, inner life, pacing) that is sent with **every** message the AI writes in a chat, and
2. **sparks** — one-off imaginative nudges ("let a character be kind to someone they dislike, for a reason they would not admit to") injected into a single reply, either fired by hand (🎲) or automatically every N of the AI's replies (**auto-spark**).

Sparks are deliberately *precise* rather than random — see "Spark precision" below.

### Spark precision

User request: *"Made the Imaginator More precise."* A randomly-drawn spark is a coin flip: it may have nothing to do with what is actually happening in the scene, and the model then either forces it in or ignores it. So a spark no longer travels alone. `imaginationSparkCandidatesFor(cfg, threadId)` picks a small shortlist (`imaginationCandidatesPerSpark`, 3) and `imaginationSparkInstructionText(candidates)` renders the exact prompt line, which asks for **at most one** of the candidates — whichever genuinely fits the moment — and explicitly says not to force a fit that isn't there:

```
IMAGINATION_SPARK: Give one of the messages a single imaginative idea, and make it precise: ...
These are candidate ideas for this exact moment - use AT MOST ONE of them, whichever genuinely
fits what is happening right now, and silently disregard the others. Do not force a fit that
isn't there: if none of them belongs in this scene, leave it alone.
1. "…"
2. "…"
3. "…"
```

Two things make the shortlist actually usable rather than three rephrasings of one idea: `imaginationPickSparks` draws **one spark per kind** first (so the three ideas come from different registers — plot, senses, withheld reaction…), and it keeps avoiding recently-used sparks exactly as the old single pick did. Choosing between candidates is free: no extra generation, and the line stays in the dynamic tail, so the prefix cache is untouched.

`cfg.fit` controls how literal this is:

- `"best"` (the default, `window.imaginationFits[0]`) — the shortlist described above.
- `"exact"` — one idea, rendered as the original single-spark sentence ("act on this imaginative idea, precisely: …"), for when you want the idea used as given.

A spark that is queued with an explicit text (custom code calling `imaginationQueueSpark(threadId, "…")`, or `imaginationFireSpark({text})`) is always used exactly — you asked for that specific idea. Only *picked* sparks (🎲 and auto-sparks) get a shortlist.

**Why prompt text and not a sampling knob:** the `ai-text-plugin` only forwards `instruction` / `startWith` / `stopSequences` to `/api/generate` — there is no supported `temperature` / `topP` parameter, so "imagination" cannot be done by changing sampling. Everything above is therefore prompt text. (The app's own commented-out `temperature` field in the character model settings is dead code — do not try to wire a slider into it.)

### Prompt placement (prefix-cache friendly)

In `getBotReply` (search `if(imaginationEnabled && typeof imaginationForReply === "function")`):

- the **flavor** is appended to `importantNotesText`, i.e. the static part of the instruction that is identical for every reply in a chat, so it stays inside the cached prefix;
- the **spark** is pushed into the *dynamic* `instruction` array right after the `replyInstruction` entry (search `IMAGINATION_SPARK: For one of the messages`) and its name is added to `extraReplyInstructionNames`, so the model's forced prefix reads `[[Chloe (using the IMAGINATION_SPARK)]]:` like the app's other instructions (REMINDER / REPLY_INSTRUCTION). Spark rows are never put in the static prefix — that would thrash the prefix cache on every spark.

`imaginationEnabled` defaults to `true` in `getBotReply`'s destructured options. The `doBotReplyIfNeeded` call passes `imaginationEnabled: !wrapInImageTags` so `/image` caption generation doesn't consume sparks; `doBotReplyInPlaceOfUser` (AI writes *as you*) leaves it on, so the flavor also shapes those messages. NOTE: the guard must be `typeof imaginationForReply === "function"` — the function is module-scope (it is exported only as `window.imaginationForReplyTest`), so an earlier `window.imaginationForReply` guard silently disabled the whole feature.

### Data (all defined at the top of the block, line ~6520, search `imaginationFlavors`)

- `window.imaginationFlavors` — **14** entries (`none`, `cinematic`, `senses`, `whimsy`, `surreal`, `epic`, `cozy`, `noir`, `romance`, `interiority`, `theatre`, `speculative`, `grounded`, `custom…`); each is `{id, emoji, name, blurb, instruction}`. The existing `maxParagraphCountPerMessage` / role instructions are untouched.
- `window.imaginationIntensities` — `subtle` / `normal` / `bold`, each with a `clause` appended to the flavor text.
- `window.imaginationSparkCategories` — **7** kinds (`plot`, `senses`, `people`, `world`, `mystery`, `delight`, `craft`) and `window.imaginationSparks` — **43** sparks `{cat, text}`, each written as an *instruction to the writer* rather than as plot content, so it can be made organic to whatever is happening.
- `window.imaginationDefaults` — `{flavorId:"none", custom:"", intensity:"normal", sparkEvery:0, categories:[all 7], customSparks:""}`.
- `window.imaginationFits` — `best` / `exact` (see "Spark precision"), indexed by `window.imaginationFitById`; `imaginationDefaults.fit` defaults to `"best"`. `window.imaginationCandidatesPerSpark` (3) is how many ideas one `best fit` nudge offers.
- Persisted config: `db.misc` key **`imaginationSettings`** (the default for every chat) and **`imaginationThreadSettings`** (`{"<threadId>": cfg}`; a chat's own config wins entirely, deleting the entry falls back to the default). Players' own `customSparks` are one-per-line plain text.

### Runtime state (module-local, in-memory only)

- `imaginationPendingSparks` — `{"<threadId>": [[sparkText, …], …]}`, the manually-queued sparks: each entry is one *group* of candidate ideas (a 🎲 spark queues a shortlist in `best fit` mode, a single text otherwise). **Deliberately not persisted** (a queued spark belongs to the next reply, so losing it on reload is correct).
- `imaginationRecentSparks` — the last few sparks per chat; `imaginationPickSpark` excludes them (window = `min(6, pool.length - 1)`), so a long chat doesn't cycle the same two ideas.
- `imaginationAiReplyCounts` — the AI's message count at the last reply, used for the `next spark in N` countdown in the header status.
- `imaginationGlobalCache` / `imaginationThreadCache` — lazy caches of the two `db.misc` keys. **They are module-local, so `page_eval` cannot clear them** — after editing the keys from outside, reload the page, or go through the exported save helpers (which update the cache too).

### Exports (module-local helpers are called directly)

On `window`: `imaginationFlavors/IntensityById/SparkCategoryById`, the four `imaginationLoad/Save(Global|Thread)Settings`, `imaginationResolve(threadId)` → `{cfg, global, threadCfg, isThreadSpecific}`, `imaginationCustomSparks`, `imaginationSparkEntries`, `imaginationSparkPool`, `imaginationPickSparks(cfg, threadId, n)`, `imaginationPickSpark`, `imaginationSparkCandidatesFor(cfg, threadId)`, `imaginationSparkInstructionText(candidates)`, `imaginationQueueSpark(threadId, textOrTexts)`, `imaginationQueuedSparks` (one text per queued spark), `imaginationQueuedSparkGroups` (the full candidate groups), `imaginationClearQueuedSparks`, `imaginationFlavorText`, `imaginationForReplyTest` (= the module-local `imaginationForReply(threadId, messagesArr)` → `{flavorText, sparkText, sparkCandidates, replyIndex}`), `imaginationTestText` (the plain-text "what the AI is told" preview, which now shows the real `IMAGINATION_SPARK` line, shortlist and all), `imaginationRenderHeader`, `imaginationRenderHeaderStatus`, `imaginationUpdateHeaderLayout`, `imaginationFireSpark({text, send})` and `openImaginationSettings`.

### UI

- **Header control** `#threadImaginationCtn` in `#messageFeedHeaderBar` (right of the art-style control): a clickable `✨` label (`#threadImaginationLabel`), `#threadImaginationFlavorSelector` (writes the *thread* config on `change` + toast), `#threadImaginationSparkBtn` (🎲 = fire a spark now), `#threadImaginationSettingsBtn` (⚙️) and `#threadImaginationStatusEl`. The status reads e.g. `🕵️ noir · bold · next spark in 2 · 1 spark queued`, or `off` when everything is default; the ✨ label's `title` always carries the same text (so the state is still discoverable when the status text is hidden on narrow screens).
- **`#imaginationOptionsButton`** (`✨ imagination - flavor, sparks & auto-sparks…`) in the `⚒️ options` popup (`#threadOptionsPopup`).
- **Settings dialog** (`window.openImaginationSettings()`): `prompt2` modal with an explainer, a `scope` select (`just this chat` / `every chat (become the default)`), the flavor select, a custom-flavor textarea (only when `flavor === "custom"`), intensity, auto-spark cadence (`0` = only when you click 🎲), the 7 spark-kind chips, your own sparks (one per line), `🎯 spark precision` (`best fit` / `exact`), a queued-sparks notice, and an `Actions` row: `🎲 spark right now`, `🔮 surprise me` (random flavor, keeping the other settings), `👁️ preview what the AI is told`, `🧹 clear N queued sparks` (only when there are some) and `🧹 reset to default`.
  - The chip row is a `type:"none"` spec rendered as `[data-imagination-chips]` and wired by hand in `imaginationDecorateDialog(threadId)`, which is **called before `await prompt2(...)`** and polls for the modal (same trick as `autoTalkTidyPresetButtons`). Chips show `✓`/bold/solid when on, dashed/dimmed when off, and nothing selected means "use every kind".
  - `prompt2`'s `buttons` specs signal intent with `controls.cancel()` (the promise resolves falsy), so each action's `onClick` sets `imaginationDialogAction` (and, for the scope-dependent ones, `imaginationDialogScope` via `readLiveScope()` — which reads the live `select[data-spec-key='scope']`), cancels, and the falsy branch performs the action and **reopens the dialog**. `imaginationDialogAction` is reset to `null` at the top of every open, so cancelling the reopened dialog can't re-trigger the action.
  - After a save, `imaginationRenderHeader()` is called so the header select/status follow. After a **reset**, it must be called too (deleting the thread config changes nothing on screen otherwise — this was a real bug).
- **Responsive two-tier header layout** (`imaginationUpdateHeaderLayout`, judged by the *header bar's own* `clientWidth`, not the window's, because the left column and the art-style control share that bar): the status text is hidden below ~880px (it's a `nowrap` block that otherwise pushes the row off-screen) and the flavor + art-style selects are hidden below ~720px (the ✨ label opens the dialog instead). A `ResizeObserver` on the bar (plus a `resize` listener, wired once via `window.__imaginationResizeWired`) re-runs it, because opening/closing the left column changes the bar's width without a window resize. Also called from `showThread` right after `window.renderThreadArtStyleSelector(threadCharacter)` (search `imaginationRenderHeader`).

### Testing it

- `set_viewport_size` to something tall and **poll `window.innerHeight`** (the setting resets when a run ends), then stub `root.aiTextPlugin` exactly as described in the auto-talk section (keep a reference and restore it!). Without a stub, every test costs generations.
- Save a config for **thread 1 only**: `await window.imaginationSaveThreadConfig(1, {flavorId:"noir", intensity:"bold", sparkEvery:0, categories:["plot","senses"], customSparks:"TEST"})`, then click `#threadImaginationSparkBtn` (or call `window.imaginationFireSpark({send:true})`) and assert on the captured `opts.instruction`: it must contain the flavor sentence **and** the `IMAGINATION_SPARK:` line, and `opts.startWith` must contain `IMAGINATION_SPARK`. With the default `fit:"best"` that line lists a shortlist (`1. "…" 2. "…" 3. "…"`), and the whole feature can be checked with no generation at all: `window.imaginationSparkInstructionText(window.imaginationPickSparks(cfg, 1, 3))` should name three *different* categories, and `(await window.imaginationForReplyTest(1, [])).sparkCandidates` should come back as an array (`sparkText` is still `sparkCandidates[0]`).
- Auto-spark cadence is testable without any reply: `await window.imaginationForReplyTest(1, [{role:"assistant"},{role:"assistant"}])` with `sparkEvery:2` returns a non-empty `sparkCandidates`; with one assistant message it returns `[]`.
- Clean up: delete the extra messages you generated in thread 1 (and restore `thread.lastMessageTime` to message 1's `creationTime`), delete both `db.misc` keys (`imaginationSettings`, `imaginationThreadSettings`), and never run any of this against thread 2 (the user's real chat).

## Narrator (the fourth added feature)

User request: *"Make the narrator better."*

"The narrator" here is the app's **System character** — `getSystemCharacterObj()` returns `{id: -2, name: defaultSystemName}` (`defaultSystemName = "System"`), and it's what you get from the `🗣️ Narrator` shortcut or `/nar <instruction>` (the send handler rewrites that to `/sys @Narrator <instruction>`, so the *message* is named "Narrator" while the character object is still "System"), from `/sys`, and from replying as the system character. Out of the box it receives **no** guidance at all beyond the normal prompt, so it writes like just another character: it decides what `{{user}}` does, puts words in other characters' mouths, and never actually *narrates*.

The feature gives it a real narration directive (voice, perspective, tense, density, and explicit limits on what it may decide) with per-chat/all-chats settings, a header quick switcher, and a one-click "🎬 narrator, speak now".

### Data (all at the top of the block, line ~7069, search `narratorStyles`)

- `window.narratorStyles` — **11** entries, each `{id, emoji, name, blurb, directive}`: `none`, `cinematic`, `novelist`, `terse`, `pulp`, `ominous`, `grounded`, `whimsical`, `mythic`, `game-master`, `custom` (the last two have an empty `directive`; `custom` uses `cfg.custom`). `narratorStyleById` indexes them.
- `window.narratorPersons` — `third` (`third person (she / he / they)`), `second` (`"you"`), `either`; each `{id, emoji, name, clause}`.
- `window.narratorTenses` — `present`, `past`, `either`.
- `window.narratorDetails` — `lean`, `balanced`, `rich`.
- `window.narratorDefaults` — `{enabled:true, styleId:"cinematic", custom:"", person:"third", tense:"present", detail:"balanced", controlsOthers:true, controlsUser:false, endOnHook:true, customNote:""}`. Note `controlsUser` defaults **off** (the narrator must not play your character) and `controlsOthers` defaults on (it may act for the NPCs) — those two flags are the fix for the "it writes everyone's lines / it plays me" problem.
- Persisted: `db.misc` key **`narratorSettings`** (the all-chats default) and **`narratorThreadSettings`** (`{"<threadId>": cfg}`; a chat's own config wins entirely). `narratorGlobalCache`/`narratorThreadCache` are module-local lazy caches, so (as with imagination) `page_eval` can't clear them — go through the save helpers or reload.
- `window.narratorNormalizeConfig(cfg)` repairs unknown/missing fields and coerces the booleans; `window.narratorResolve(threadId)` → `{cfg, global, threadCfg, isThreadSpecific}`.

### The directive — `window.narratorDirectiveText(cfg, {userName})`

Returns `""` when `cfg.enabled` is false, else a small block of `-` bullet lines: `NARRATOR MODE: …` (what it is: the omniscient voice, not a character turn), then `- Voice:` (style directive), `- Perspective:`, `- Tense:`, `- Density:`, a fixed "ground it in concrete sensory specifics" line, a fixed "keep every character true to themselves / only knows what they've seen" line, then the two permission lines (what it may do about other characters / about `{{user}}`), `- End the narration on a live moment …` (when `endOnHook`), a **tie-breaker line** ("if this particular reply's instruction asks for something specific … do that, and let the guidance above shape *how* you narrate it"), and finally `cfg.customNote` when non-empty. `{{user}}` is replaced with the real user name.

Keeping the directive inside the *dynamic* tail (see below) is deliberate: it depends on the chat's settings, so putting it in the static prefix would invalidate the prefix cache for every normal character reply.

### Prompt injection (search `isNarratorReplying`)

- `getBotReply` gained a `narratorEnabled = true` option (default true). `isNarratorReplying = narratorEnabled && (replyingCharacter.id === -2 || (replyingCharacterName || "").trim().toLowerCase() === "narrator")` — the id check covers a *renamed* system character, the name check covers a `/sys @Narrator` reply whose character object is still "System".
- The directive is computed there and pushed into the dynamic `instruction` array at exactly the slot where upstream had its `Note: All story characters should speak/act for themselves only. …` line — and that upstream line's condition was changed from `replyingCharacterName.toLowerCase() === "narrator"` to **`isNarratorReplying`**, so the narrator never gets the contradiction ("each character acts within their own messages") while the directive tells it to speak for the others. Order in the tail: … `REPLY_INSTRUCTION` → `IMAGINATION_SPARK` → `REMINDER` → `>>> TASK`, i.e. the directive sits before the reply instruction so an explicit instruction still wins.
- `doBotReplyIfNeeded` passes `narratorEnabled: !wrapInImageTags` (same as `imaginationEnabled`), so `/image` caption generation is unaffected.
- Because the check is on the system character rather than on the `/nar` command, **plain `/sys <instruction>` replies also get narrator mode.** That's intentional (the app presents the system character as "Narrator", and the ⚙️ dialog says so and can turn it off), and the tie-breaker line keeps it from fighting an explicit OOC instruction.

### Helpers / exports (all on `window`)

`narratorStyles/PersonById/TenseById/DetailById`, `narratorNormalizeConfig`, `narratorLoadGlobalSettings` / `narratorSaveGlobalSettings` (pass `null` to reset), `narratorLoadThreadConfig(threadId)` / `narratorSaveThreadConfig(threadId, cfg|null)`, `narratorResolve(threadId)`, `narratorDirectiveText(cfg, {userName})`, `narratorTestText(threadId)` (plain-text "what the AI is told" preview, used by 👁️), `narratorSpeak(opts)` (fires a narration reply right now via `doBotReplyIfNeeded({forceReply:true, characterOverride: await getSystemCharacterObj(), messageNameOverride:"Narrator", replyInstruction, expectsReply:false})`; it refuses while the AI is already writing, and when no `opts.instruction` is given it writes its own "narrate the current scene" instruction from the current config), `narratorRenderHeader`, `narratorRenderHeaderStatus`, `narratorUpdateHeaderLayout`, `openNarratorSettings`.

### UI

- **Header control** `#threadNarratorCtn` in `#messageFeedHeaderBar` (right of the imagination control): clickable `🎭` label (`#threadNarratorLabel` → the settings dialog), `#threadNarratorStyleSelector` (writes the *thread* config on `change` + toast), `#threadNarratorSettingsBtn` (⚙️) and `#threadNarratorStatusEl`. The status reads e.g. `🎥 cinematic · 3rd person` or `off`; the 🎭 label's `title` always carries the same text (so the state stays discoverable when the status is hidden on narrow screens).
- **`#narratorOptionsButton`** (`🎭 narrator - voice, powers & narrate now…`) in the `⚒️ options` popup (`#threadOptionsPopup`).
- **Settings dialog** (`window.openNarratorSettings()`): `prompt2` modal — explainer, a `scope` select (`just this chat` / `every chat (become the default)`, only shown when a thread is open), `narrator mode` on/off, then (all `show: d => d.enabled === "on"`) voice, custom voice text, perspective, tense, density, may-act-for-others, may-decide-your-actions, end-on-hook, an "anything else" free-text note, and an `Actions` row (`🎬 narrator, speak now`, `👁️ preview what the narrator is told`, `🧹 reset to default`). As in imagination, a `buttons` spec click sets `narratorDialogAction` and calls `controls.cancel()` (the promise resolves falsy), and the falsy branch performs the action and **reopens the dialog**; `narratorDialogAction` is reset to `null` on every open.
  - All booleans are `select`s (`prompt2` has no checkbox) with `"yes"`/`"no"` / `"on"`/`"off"` string values; `readLiveScope()` reads the live `select[data-spec-key='scope']` because the scope is normally only read from the resolved result.
  - Saving a `custom` style with empty text falls back to `styleId:"none"` with a toast.
  - After save/reset, `narratorRenderHeader()` is called (a reset otherwise changes nothing on screen).
- **Responsive header layout** (`narratorUpdateHeaderLayout`): a *measurement*-based degradation cascade, not pixel thresholds — start from the richest layout (status + select + ⚙️ + 🎭) and hide, one step at a time, whatever is needed until `bar.scrollWidth <= bar.clientWidth + 1`: status text → style select → ⚙️ → the whole `#threadNarratorCtn`. Nothing is lost at the last step because the narrator is also reachable from `#narratorOptionsButton` in the ⚙️ popup. It is called from `imaginationUpdateHeaderLayout` (which already has the `resize` listener + a `ResizeObserver` on the bar, so no extra wiring) and from `showThread` via `narratorRenderHeader`. Measured behaviour: full control down to ~1150px of *bar* width, select hidden below ~1000px, everything but the 🎭 label below ~600px, and the control disappears below ~375px of bar width (~380px window on a phone). Below ~330px of bar width the **pre-existing** controls (☰ 32px + the invisible 89px "model:" spacer + art-style 95px + imagination 95px) already overflow on their own — that's upstream's problem, not this feature's.

### Testing it

- Stub `root.aiTextPlugin` (keep a reference and restore it) — the reply path needs a thenable with a `stop()` method, not just `{generatedText}`: `root.aiTextPlugin = function(opts){ if(opts.preload) return Promise.resolve(true); if(opts.getMetaObject) return orig.call(root, opts); return { stop(){}, then(resolve){ setTimeout(()=>{ opts.onChunk({textChunk:"[[Narrator]]: *text*", isFirst:true}); resolve({generatedText:"[[Narrator]]: *text*"}); }, 20); } }; }` — then keep `window.__lastAiOpts = opts` inside it and inspect `window.__lastAiOpts.instruction`.
- With a thread open, `await window.narratorSpeak()` (or `/nar`) should give an instruction in which `NARRATOR MODE:` appears, `speak/act for themselves only` does **not**, `{{user}}` is substituted, and `REPLY_INSTRUCTION` + `>>> TASK` come *after* the directive.
- `await window.narratorTestText(threadId)` and `window.narratorDirectiveText(cfg,{userName})` are pure and cheap to assert on for every style/flag combination.
- Clean up: delete the message the stub produced, restore `thread.lastMessageTime`, restore `root.aiTextPlugin`, and delete any `narratorSettings` / `narratorThreadSettings` keys you created (or leave them — they're additive keys in `db.misc`). Never test against thread 2.
- Layout: set the viewport, open a thread, and read `bar.scrollWidth`/`bar.clientWidth` plus the `hidden` flags of the four narrator elements; `set_viewport_size` + a `ResizeObserver` on the bar (already wired) means you can sweep widths without reloading, but the app caches `isMobile = window.innerWidth < 700` at load, so do a `page_refresh` after setting a mobile size or the left column won't behave like a phone's.

## Image director (active)

User request: *"Like with the narrator, let me give instructions to the Image generator before he starts generating."*

### Data (search `imageDirectorDefaults` in `index.html`)

- `window.imageDirectorDefaults = {enabled:true, instruction:""}`. Persisted in `db.misc` under **`imageDirectorSettings`** (the all-chats default) and **`imageDirectorThreadSettings`** (`{"<threadId>": cfg}`; a chat's own config wins entirely). `imageDirectorGlobalCache`/`imageDirectorThreadCache` are module-local lazy caches — go through the save helpers or reload, don't delete `db.misc` keys by hand.
- Helpers on `window`: `imageDirectorNormalizeConfig`, `imageDirectorLoadGlobalSettings` / `imageDirectorSaveGlobalSettings` (pass `null` to reset), `imageDirectorLoadThreadConfig` / `imageDirectorSaveThreadConfig(threadId, cfg|null)`, `imageDirectorResolve(threadId)` → `{cfg, global, threadCfg, isThreadSpecific}`, `imageDirectorPromptText(cfg)` (the trimmed instruction, or `""` when off/empty), `imageDirectorCaptionExtra(threadId)` (the sentence appended to the `/image` scene-description instruction), `imageDirectorTestText(threadId)` (the 👁️ preview), `openImageDirectorSettings`.

### Wiring (two places, both in `index.html`, both in `try/catch` so images never break)

1. **`/image` auto-caption**: in the `/image` branch of the send handler, the fixed `replyInstruction` ("In one paragraph, describe all visual details…") gets `await window.imageDirectorCaptionExtra()` appended when non-empty — so the scene-description writer follows your instructions.
2. **Every generated image prompt**: in `renderMessageFeed`'s `<image>` loop, `options.prompt` gets the director instruction prepended or appended (configurable) — so hand-written `<image>…</image>` prompts follow them too. This happens after the negative-prompt/resolution decisions, so extra words can't change those. The character's 🎨 art style (prefix/suffix) still applies as before. Research keywords and fuse output are also free to combine.

### UI

- **`#imageDirectorOptionsButton`** (`🖼️ image director - instruct the image generator…`) in the `⚒️ options` popup (`#threadOptionsPopup`).
- **Settings dialog** (`window.openImageDirectorSettings()`): `prompt2` modal — explainer, `scope` select (`just this chat` / `every chat (become the default)`, only shown when a thread is open), on/off, the instructions textarea, and an `Actions` row (preview, reset). Same `prompt2` + `controls.cancel()` + reopen-dialog pattern as the narrator dialog.

### Testing it

- Pure: `window.imageDirectorPromptText({enabled:true, instruction:" x "})` → `"x"`; `{enabled:false}` → `""`; save a global and check `await window.imageDirectorCaptionExtra(threadId)` contains it, then that a thread config wins and that saving `null` resets to `{enabled:true, instruction:""}`.
- End-to-end: save a global instruction, stub `root.textToImagePlugin` to capture `opts.prompt`, add a throwaway `<image>…</image>` message to scratch thread 1, `renderMessageFeed(1)`, assert the prompt contains the instruction. Clean up: delete the message, restore `thread.lastMessageTime`, restore the plugin, delete both `db.misc` keys. Never test against the user's real chat thread.

## Internet research for image generation (enabled)

User request: *"I thought I mean, like every thing in the generation like one I want to generate image or something like that they can go on the Internet and look up a reference or something like that."* — and then, after an early version let characters look things up *mid-reply*: *"Actually, remove it. Let it connect to the Internet, but only for the image generation."*

So the internet is used **only** to generate better images, and it happens **automatically**: text replies never touch the network, no character has to ask, and no tags are written into the transcript. When a message contains an `<image>…</image>` description, the subject is looked up for real *before* the picture is generated and the accurate details found are appended to the image prompt — so "a red panda" comes out with actually-red-panda markings.

### The pipeline — `await window.aiWebImageResearch(corePrompt, opts?)`

1. **What is this a picture of?** `aiWebSubjectQuery(corePrompt)` — one short AI call whose whole job is to name the single look-up-able real-world subject in the description (2–4 words), or reply exactly `NONE`. The model is told to say `NONE` for *whole scenes*, *generic unnamed people* ("a young woman", "a man in a suit") and *invented things* (the user's own character, a made-up planet). This step is the important one: a bag of words cannot tell "a young woman with pink hair" from "a red panda", and fetching a stranger's photo for the former would quietly replace the user's own character with someone else's face. A `NONE` here costs one tiny call and saves the entire search. If the call itself *errors*, it returns `undefined` and the pipeline falls back to the deterministic bag-of-words guess (`aiWebImageSubjectQueries(corePrompt)`, which also needs ≥2 content words).
2. **Look it up** — `window.aiWebSearchDetailed(subject, {withImage, strict:true})` (backends below). `strict:true` is what makes this safe to run unattended: it drops the "last resort, unfiltered results" fallback, so junk comes back as *no results* instead of as confident nonsense. A best score under 2 (results.length, +2 for having an article extract) ⇒ no enrichment at all.
3. **Prefer a photo to a paragraph** — the candidate list is the Wikipedia article's own lead image first (`kind:"article"`), then the image-search pick (`aiWebPickReferenceImage`, relevance-filtered by the query's content words). `window.aiWebFirstUsableImageBlob(candidates)` walks the list; `window.aiWebFetchImageBlob(url)` re-encodes whatever it finds into a ≤200 KB JPEG (`aiWebDownscaleBlobToJpeg`, canvas — all local, the photo is never uploaded); then `aiWebKeywordsFromPhoto(blob, subject, source)` asks the model to report only what it can *literally see* in it. `aiWebLooksLikeJunkImage(url)` keeps SVG files, logos and wordmarks out of the list (otherwise the model ends up describing a drawing of the thing).
4. **Otherwise, compress the text** — `aiWebKeywordsFromText(referenceText, subject)` turns the Wikipedia extract + result snippets into keywords. Both keyword calls end with *"If the material does not actually describe the requested subject, reply with exactly: NONE"*, and `aiWebAcceptKeywords(text)` throws away refusals, sentences, and anything over 30 words / 180 chars, so a bad model reply can never poison the prompt.
5. Returns `{query, keywords, via:"photo"|"text", imageUrl, resultsCount, articleTitle}`, or `null` meaning "generate it from the description alone".

### Where it's wired in (search `aiWebImageResearch` in `index.html`)

Inside `renderMessageFeed`'s `<image>` loop, just before `let options = {prompt, …}`: if `window.aiWebAccessIsOn()`, the research is read from the memo **`messageObj.customData.__imageResearch[corePrompt]`**, or computed and written straight back with `db.messages.put(messageObj)`. The memo matters: the feed re-renders image messages, and un-memoised research would re-run a search + AI call on every render (a `null` is memoised too — it means "nothing to find here, don't ask again"). The keywords are appended to `options.prompt` **only** — never to `corePrompt`, which is the `__savedImages` / keep / delete key — and they're appended *after* the negative-prompt and resolution decisions, so extra words can't change those. A dim `🔎 researched <subject> · looked at a reference photo · source` note is rendered under the picture (and kept under a kept image, from the memo). Nothing else about the image path changed.

**Removed with the old scope:** the reply-time tags (`<search>`, `<open>`), the hidden `🌐 Web access results` system message, the `webRound`/`maxRounds` loop and `window.aiWebAccessDirective()`. Characters can still imitate the old `🔎 *looking up: "…"…*` / `<search>` habits from their own history, so `window.aiWebStripLookupTags(text)` strips those out of the visible message in `doBotReplyIfNeeded` — it does nothing else.

### Data / settings

- `aiWebAccessDefaults = {enabled:true, resultsPerLookup:5, snippetLength:260, wikiExtractChars:900, referenceImages:true}` (`const`, module-scope — `page_eval` can't see it, but `window.aiWebAccessDefaults` is a copy and `window.aiWebAccessCfg` is the live config). Persisted under the same **`webAccessSettings`** `db.misc` key (`window.aiWebAccessLoadGlobalSettings` / `aiWebAccessSaveGlobalSettings`). `window.aiWebAccessNormalize(cfg)` whitelists the keys on load, so settings saved by the old reply-time version (`maxLookups`, `maxRounds`, `openUrlMaxChars`, …) can't linger. `window.aiWebAccessIsOn()` = `cfg.enabled === true`.
- `referenceImages:false` = text-only enrichment (saves the image fetch + its vision tokens). `resultsPerLookup` is really a search-depth knob here; `snippetLength` / `wikiExtractChars` cap how much reference text the keyword call sees.

### Search backends (all keyless, via `root.superFetch`)

- **Bing's plain HTML results page** (`bing.com/search?q=…`, parse `li.b_algo` → `h2` / first `a[href^=http]` / `p`) — the primary general search. Quality varies: for a query Bing thinks has no good match it pads the page with unrelated popular sites, so never trust result #1.
- **Wikipedia's search API** (`action=query&list=search&origin=*`) — high precision, but only knows encyclopedic things. Hits are blended *behind* the leading web result (`bing[0]`, `wiki[0..1]`, `bing[1..]`, `wiki[2..]`) so one bad Bing source can't crowd out the good Wikipedia one. The winning Wikipedia hit is then read properly through `aiWebWikiArticle(title)` — `api/rest_v1/page/summary/<title>` — which supplies the article's opening extract (the most reliable reference text) *and* its lead image.
- Every result (and every image) is relevance-filtered against the query's content words (`aiWebQueryTokens` / `aiWebTokenMatches` / `aiWebIsRelevant` — two shared words for a 3+-word query), and a source with no relevant results contributes nothing. This is what kills Bing's "you probably meant the colour red" padding.
- `aiWebLooksLikeAdult(r)` drops adult results **unless the query is itself adult** (`aiWebAdultRe`) — Bing's junk padding otherwise drags porn into unrelated chats.
- `aiWebKeywordify(q)` strips question scaffolding and filler words ("what does the chibi art style actually look like" → "chibi art style") and `aiWebStripNoise(q)` strips reference/photo/picture-style padding words, because engines do badly with whole questions and happily ignore the rest of a padded query. `aiWebSearchDetailed` tries `[stripped, keywordified, raw]` in that order and keeps the first phrasing that yields relevant results. Results are cached per session (`aiWebCacheGet/Set`) — repeating a query is free.
- Dead ends (don't retry): DuckDuckGo html/lite = bot challenge; **Bing's `&format=rss` endpoint = outright porn spam**; mojeek/searx.be/disroot = captcha; startpage = JS shell; `r.jina.ai` = ~45 s.

### UI

- **Header control** `#threadWebCtn` in `#messageFeedHeaderBar` (right of `#threadNarratorCtn`): a clickable `🔎` label (`#threadWebLabel` → `window.aiWebToggle()`, which flips `enabled` and toasts) and `#threadWebSettingsBtn` (⚙️). Dimmed + greyscale when off. `window.aiWebUpdateHeaderLayout()` (one-step hide cascade: the ⚙️ first, then the whole control) is called from both `narratorUpdateHeaderLayout` and `showThread`.
- **`#webAccessOptionsButton`** (`🔎 image research - let the image generator look subjects up…`) in the `⚒️ options` popup.
- **Settings dialog** (`window.openWebAccessSettings()`): `prompt2` — explainer, `enabled`, `referenceImages` (`👁️ study a reference photo`), then an `Actions` row: `🔬 test on an image description…` (paste an `<image>` description and see the subject it picks, whether the details came from a photo or text, the exact words that would be added to the prompt, and the reference photo itself — runs the real `aiWebImageResearch` code path), `🧹 reset to default`. Same `prompt2` + `controls.cancel()` + reopen-dialog pattern as the imagination/narrator dialogs.

### Testing it

- Cheap (no generations): `await window.aiWebImageResearch("a red panda on a mossy branch")` → `{query:"red panda", keywords:"…", via:"photo"|"text", …}`; `await window.aiWebImageResearch("The scene is a gritty, humid alleyway…")` → `null`; `await window.aiWebImageResearch("a young woman with bright pink hair")` → `null` (generic people must never be enriched); `await window.aiWebSearchDetailed(q, {withImage:true, strict:true})` → `{query, results, article:{title, extract, image}, image}`. `aiWebSubjectQuery` / `aiWebKeywordsFromText` / `aiWebKeywordsFromPhoto` / `aiWebAcceptKeywords` / `aiWebImageSubjectQueries` are module-local — reach them indirectly through `aiWebImageResearch`, or assert through `aiWebSearchDetailed`.
- End-to-end: add a throwaway message to a test thread containing `<image>a red panda on a mossy branch</image>`, `window.renderMessageFeed(<threadId>)` (only the new message renders — the feed hashes existing messages and skips them), then check the last `.generated-image-container`: `data-core-prompt`, the `🔎 …` note in its text, and the prompt inside the plugin iframe's `data-src` (URI-decode the `#…` fragment and `JSON.parse` it — it must end with the researched keywords). `iframe._textToImageResultDataUrl` is the finished JPEG if you want to look at it.
- Clean up: delete every message you add, restore `thread.lastMessageTime`, leave `__imageResearch` of *real* messages alone. `webAccessSettings` is additive — deleting it just restores the defaults.
- **Preview gotcha:** a `page_refresh` occasionally appears to succeed but leaves the page running older code. Before trusting a result, `page_eval` a marker — e.g. `typeof window.aiWebAccessNormalize` or `/aiWebSubjectQuery/.test(String(window.aiWebImageResearch))` — and refresh again if it's stale.

## Inner life (the sixth added feature)

User request: *"Let the characters have their own thoughts and desires, and ideas"* — i.e. characters should feel like people with an inner life of their own, rather than only reacting to the user turn by turn.

Each character in a chat now carries a small **private inner life** that persists across the chat and evolves with it:

- 🎯 **wants** — what they want (including things they'd never admit),
- 💭 **thoughts** — what's occupying their mind right now,
- 💡 **ideas** — plans, schemes, notions they're turning over.

It is injected into *that character's own* replies (so they act on their own initiative), and it is quietly **re-imagined in the background** after they speak, so a want can be met, dropped, or complicated by what happens. It pairs with auto-talk in particular: with wants of their own, characters keep driving a scene even with no user turn to bounce off.

### Data

- `window.innerLifeAspects` — the three aspects (`wants`/`thoughts`/`ideas`) with their emoji/labels/`as` (the verb used in the prompt block: "is thinking").
- `window.innerLifeIntensities` — `subtle` / `normal` / `bold`, each with a `clause` appended to the prompt block. `window.innerLifeUpdateOptions` is the "when the minds get updated" list.
- `window.innerLifeDefaults = {enabled:true, intensity:"normal", updateEvery:1}`; `window.innerLifeMaxPerAspect` (3) caps how many entries are kept/asked for per aspect.
- Persisted (all `db.misc`):
  - **`innerLifeSettings`** — the all-chats default cfg;
  - **`innerLifeThreadSettings`** — `{"<threadId>": cfg}` (a chat's own cfg wins entirely);
  - **`innerLifeState`** — `{"<threadId>": {"<characterId>": {enabled, wants[], thoughts[], ideas[], updateCount, sinceUpdate, updatedAt}}}`. Note this is keyed by **thread** even when the settings are saved globally — a mind is about what happened in *this* chat.
- `innerLifeGlobalCache` / `innerLifeThreadCache` / `innerLifeStateCache` are module-local lazy caches, so (as with imagination/narrator) `page_eval` can't clear them from outside — deleting `db.misc` keys by hand leaves a stale header until a reload. Go through the exported helpers.

### Prompt injection (search `let innerLifeDirective`)

`getBotReply` gained an `innerLifeEnabled = true` option; `doBotReplyIfNeeded` passes `innerLifeEnabled: !wrapInImageTags` (same as imagination/narrator, so `/image` caption generation doesn't consume or emit mind changes). The block is computed only for real characters (`replyingCharacter.id >= 0`) — the user is the user, and the system character gets the narrator directive instead — and it is pushed into the **dynamic tail** right after `narratorDirectiveText`, i.e. *before* `REPLY_INSTRUCTION`, so an explicit instruction still wins. (Dynamic tail, not the shared prefix: the mind changes often and is per-character, so a prefix placement would thrash the cache.)

`window.innerLifeDirectiveText(cfg, {characterName, state})` returns `""` when disabled (or when the character's own `enabled === false`), a short generic "they have their own wants/thoughts/ideas" line when there is no mind yet (so even a character's *first* reply has some agency), and otherwise the `INNER LIFE of <name> …` block: the three `-` lines, the intensity clause, an "act on their own initiative" line, and a "never state or summarise these — show them through behaviour" line.

### The update engine

`window.innerLifeAfterMessageAdded(threadId, characterId)` is called from `doBotReplyIfNeeded` right after the message is saved (only when `!wrapInImageTags`). It increments the character's `sinceUpdate` and, once that reaches `cfg.updateEvery` (`0` = never auto-update), fires `innerLifeRunUpdate` in the background.

`innerLifeRunUpdate(threadId, character, {force})` (module-local):

- waits (≤20s) while `botIsCurrentlyReplying`, so it doesn't stack on top of an in-flight reply — this matters a lot during auto-talk;
- builds the transcript with `prepareMessagesForBot` over the last 14 messages (image tags collapsed to `[image]`, each message truncated to 500 chars);
- makes one `root.aiTextPlugin` call with `startWith: "WANT:"` asking for `WANT:`/`THOUGHT:`/`IDEA:` lines — short third-person phrases starting with a verb ("wants to leave before dawn", "suspects Mira is lying"). The prompt says to keep what's still true, drop what's resolved/faded, and let recent events have consequences;
- parses tolerantly (`innerLifeParseMind` accepts bullets / numbers / lowercase / `WANTS`) and replaces only the aspects that produced entries — an aspect the model omits keeps its old entries (a slightly stale mind is much better than an empty one);
- `innerLifeBusy` (`{"<threadId>|<characterId>": true}`) prevents two concurrent updates for the same character, and `window.innerLifeThinking` (same keys) drives the header's `thinking...` text.

`window.innerLifeThinkNow(threadId, {characterId})` is the manual "🧠 think now" path (forces an update, bypassing both the cadence and the visibility check).

### Exports / helpers (all on `window`)

`innerLifeAspects/AspectById`, `innerLifeIntensities/IntensityById`, `innerLifeUpdateOptions`, `innerLifeDefaults`, `innerLifeNormalizeConfig`, `innerLifeNormalizeState`, `innerLifeLoad/SaveGlobalSettings`, `innerLifeLoad/SaveThreadConfig`, `innerLifeResolve(threadId)` → `{cfg, global, threadCfg, isThreadSpecific}`, `innerLifeGetState`, `innerLifeCharacterState`, `innerLifeSetCharacterState`, `innerLifeClearThread`, `innerLifeGetCast(threadId)` (thread character + `replyAsCharacterIds` + anyone who has spoken; positive ids only), `innerLifeDirectiveText`, `innerLifeAfterMessageAdded`, `innerLifeThinkNow`, `innerLifeRenderHeader`, `innerLifeUpdateHeaderLayout`, `innerLifeThinking`, `openInnerLifeSettings`. The update prompt/parse helpers (`innerLifeBuildUpdateInstruction`, `innerLifeParseMind`, `innerLifeRunUpdate`, `innerLifeTruncate`, `innerLifeEscape`) stay module-local.

### UI

- **Header control** `#threadMindCtn` in `#messageFeedHeaderBar` (right of `#threadWebCtn`): the clickable `🧠` label (`#threadMindLabel` → the dialog), `#threadMindThinkBtn` (💭 = think now) and `#threadMindStatusEl` (reads `3 minds` / `thinking...` / `on` / `off`). Dimmed + greyscale when off. `innerLifeUpdateHeaderLayout` is the same "drop bits until it fits" cascade (status → 💭 → the whole control) and is chained from `aiWebUpdateHeaderLayout`; `showThread` calls `innerLifeRenderHeader`. NOTE: `innerLifeRenderHeader` deliberately does **not** call `innerLifeGetCast` (it runs on every message, and scanning a long thread's messages there would be wasteful) — it counts the stored minds instead, which gives the same status.
- **`#mindOptionsButton`** (`🧠 inner lives - what they want, think & imagine…`) in the `⚒️ options` popup.
- **The dialog** (`window.openInnerLifeSettings()`): one `prompt2` modal that is both settings *and* editor — explainer, `scope`, `enabled`, `intensity`, `updateEvery`, then a section per character in the chat (`mind_enabled_<id>` select + three `mind_<aspect>_<id>` textareas, one entry per line, `show`-gated on that character's select), then an `Actions` row (`🧠 think now`, `🧹 clear their minds in this chat`, `♻️ reset settings`). Same `prompt2` + `controls.cancel()` + reopen-dialog pattern as the other feature dialogs, with `readLiveScope()` reading the live `select[data-spec-key='scope']`. Saving writes the cfg to the chosen scope and always writes the per-character minds to the thread.

### Testing it (no generations needed)

- Pure: `window.innerLifeDirectiveText({enabled:true,intensity:"normal"}, {characterName:"X", state:{wants:["…"], thoughts:["…"], ideas:["…"]}})` → the block; `state:null` → the generic line; `{enabled:false}` or `state:{enabled:false}` → `""`.
- Stub `root.aiTextPlugin` (keep a reference and restore it!) with a thenable returning `{generatedText: "WANT: …\nTHOUGHT: …\nIDEA: …"}` for the `startWith === "WANT:"` call, then `await window.innerLifeThinkNow(<threadId>, {characterId:<id>})` and assert `await window.innerLifeCharacterState(threadId, id)`. Caps: a 4th entry in an aspect is dropped; an aspect the model omits keeps its previous entries.
- End-to-end prompt: reply as a character (`/ai …`) with a reply-aware stub (needs a `stop()` and `opts.onChunk`) and assert the captured `opts.instruction` contains `INNER LIFE of <name>` **and** that `>>> TASK` still comes after it.
- Clean up: delete the messages you added, restore `thread.lastMessageTime` and `thread.unsentMessageText`, `await window.innerLifeClearThread(threadId)`, and delete the `innerLifeSettings` / `innerLifeThreadSettings` keys if you created them. Remember the module-local caches — do a `page_refresh` afterwards or the header keeps showing the deleted mind. Never test against the user's real chat thread.

## Body needs (hunger & thirst)

Characters get hungry and thirsty in real time; going too long without food or drink changes how they act, and `/feed` / `/drink` fixes it.

- State lives on the character record as `needsByThread = {<threadId>: {food:0–100, water:0–100, at}}` — each chat is its own timeline. `window.bodyNeedsForThread(character, threadId)` counts the thread's messages and decays lazily from the `at` stamp (every message = `window.bodyNeedsMinPerMessage` = 30 story-minutes, so food empties after ~20 story-days (`window.bodyNeedsFoodDays`, ≈960 messages) and water after ~5 story-days (`window.bodyNeedsWaterDays`, ≈240 messages) — survival pacing: day-to-day chatting barely dents the meter, while time-skips and narrated hunger move it; a character never stamped in a thread reads as full). `window.bodyNeedsFeed(characterId, kind, threadId)` resets food *or* water to 100 and re-stamps `at` at the current message count. Wall-clock time is not used anywhere.
- Time-skips in the story also move the clock: `window.bodyNeedsScanTimeSkips(threadId)` runs inside every `bodyNeedsForThread` read, parses only messages newer than the `db.misc` `bodyNeedsScanned_<threadId>` marker (strict framing required — "three days later", "a few days passed", "the next morning", "later that evening", "overnight"; plain "see you in two hours" does NOT count), and pushes the whole cast's meters down via `window.bodyNeedsApplySkip` with a ⏳ toast. `/time 3 days` (loose parsing, bare durations allowed; bare `/time` reports the tally) does the same on demand.
- Narrated hunger/thirst also counts: the same scan collects messages matching a cheap precheck and `window.bodyNeedsApplyClaims` runs `window.bodyNeedsParseStateClaim` on them ("she is starving" → food 3, "hasn't eaten" → 10, "hungry"/stomach-growls → 25; "dehydrated" → water 3, "parched" → 10, "thirsty"/dry throat → 25). Claims only ever lower the meter, never raise it (`/feed`/`/drink` restore). Speaker rules: a character's own "I'm starving" hits them; your narration hits the thread character plus anyone named; your mild first-person "I'm a bit hungry" is ignored (but "I'm starving" counts). Negations ("not hungry", "isn't starving") and metaphors ("hungry for power", "starving for attention") are skipped, as is past-perfect "had been" ("the thirst had been" = already quenched, not current).
- Hunger, thirst, meals and time-skips are all folded in story order: `window.bodyNeedsApplyNarrative` (called from the scan) parses each new message for both deprivation events (`parseStateClaim`) and meal events (`parseMealClaim`) and applies them sorted by position in the text — so "starving… then eats a feast" ends full, while "eats an apple… but her hunger returns" ends still hungry. Running values carry across the message batch and persist once. Meal verbs include chew, bite into, sink teeth into, swallow (only with food nearby — a nervous dry swallow doesn't count), plus ravenous/mouth-watering as hunger signs. `window.bodyNeedsPortion` scores the item — snacks (`window.bodyNeedsSnackWords`: apple, banana, bread…) +25, ordinary meals +60, feasts/banquets 100; sips +15 water, drinks +50, gulps +70; nibbles +15, tastes +10. `window.bodyNeedsParseMealClaim` spots genuine meals ("she eats bread", "they had dinner", "she clears her plate", "I hand her an apple", "she drinks water") and `window.bodyNeedsApplyMeals` adds the portion via `window.bodyNeedsRestore(id, kind, threadId, amount)` (capped at 100, same targeting rules as hunger claims). Offers don't count ("I offer her bread" — she may refuse), nor do refusals, hypotheticals ("if she eats…", "she should eat"), or idioms ("eat his words", "fed up"). Buying food works too: `window.economyProcessBuyTags` checks bought items against `window.bodyNeedsFoodWords`/`window.bodyNeedsDrinkWords` and restores the matching portion (a sword never feeds). `bodyNeedsApplyClaims` and `bodyNeedsApplyMeals` remain as thin wrappers around `bodyNeedsApplyNarrative`.
- Prompt injection mirrors inner life: `getBotReply` takes `bodyNeedsEnabled=true`, `doBotReplyIfNeeded` forwards `bodyNeedsEnabled: !wrapInImageTags`, and the `bodyNeedsDirective` block (real characters only, `replyingCharacter.id >= 0`) lands in the dynamic tail right after `innerLifeDirective`, i.e. before `REPLY_INSTRUCTION` so an explicit instruction still wins. `window.bodyNeedsDirectiveText(name, needs)` always returns a block (a "well-fed and hydrated … stay consistent, don't claim hunger you don't have" line while both are ≥60, so the story can't contradict a full meter; a `hungry (food 23/100), …` block otherwise) with a "never state the numbers" line. Since 2026-10-31 the hungry/thirsty block doesn't just ask for colored behavior (grumbling stomach) — it tells her to take ONE concrete step toward satisfying the need inside the reply itself (get up, cook, eat, drink, written as it happening), unless someone stops her; the meal-claim parser then restores the meter, so the loop closes. Stage words come from `window.bodyNeedsStageKey` (fine/peckish/needy/urgent/empty). The ⏩ continue instruction (`continueChatFromMessage`) was upgraded the same day: move the WORLD, not just the conversation — make a decision and act on it (follow the strongest want/need) so one press produces a genuine beat, not just talk.
- Commands (in `sendButtonClickHandler`, before `/sum`): `/feed [(@Name#id | name) ] [item]` and `/drink …` default to the thread character, persist via `bodyNeedsFeed`, clear the input, toast (`🍗 Chloe eats bread (food 100)`), and refresh the header — no chat message is posted, the next reply just shows the effect. `/needs`, `/needs on|off` flips the `db.misc` `bodyNeedsEnabled` flag (default on), also with a header refresh. The message-box tooltip lists all three (note: `title` attributes evaluate `[...]` as Perchance templates, so the help uses `(food)` parens, not `[food]`).
- UI: `#threadNeedsCtn` in `#messageFeedHeaderBar` (after `#threadMindCtn`, registered in the fit cascade as `threadNeedsStatusEl` + `threadNeedsCtn`) shows the thread character as `🍗💧` + `food · water`; click → toast with every cast member's meters. `window.bodyNeedsRenderHeader()` is called from `showThread` and after the commands.
- Testing (no generations): pure `bodyNeedsForThread` math on a throwaway character with a crafted `needsByThread` stamp (e.g. stamp 480 messages back ⇒ food 50; 120 back ⇒ water 50, at 30 min/msg), `bodyNeedsStageKey` ladder, directive fed-vs-hungry text, a throwaway character for the feed round-trip (delete it after), `/feed` via `#sendButton.click()` asserting the DB + cleared input, and `/ai …` with a capturing stub asserting `BODY NEEDS of <name>` sits after the inner-life block and before the final `>>> TASK:` line (beware: the shared prefix *mentions* `>>> TASK`, so compare against the last occurrence). The feed must have height (`set_viewport_size` tall) or `doBotReplyIfNeeded` bails silently. Clean up: delete added messages, remove the `needs` field, trim the command from `thread.userMessagesSentHistory`, restore `unsentMessageText`, scrub stub sentences from `innerLifeState`, restore the stub.

## Money & buying (the economy of desire)

Characters can hold money, want things, and spend their own money on them.

- State lives on the character record: `money` (number, default 0) and `inventory` (array of `{item, price, at}`). `/give <amount> [(@Name#id | name)]` (in `sendButtonClickHandler`, next to `/feed`) adds or removes money, clears the input, toasts the new balance, and refreshes the header. Target parsing is shared in `window.economyResolveTarget(thread, rest)`.
- Saving keeps status: the character editor (`characterDetailsPrompt`) shows 💵/🍗/💧 fields prefilled with live values (active thread when editing that character), saved as `money` + `savedFood`/`savedWater`. Food/water fall back to `savedFood`/`savedWater` (default 100) in `bodyNeedsCalc` when a thread has no entry yet, so new chats start from the saved values; editing also syncs the active thread's entry. Duplicate/share-import carry `money`, `savedFood`, `savedWater`, `inventory`, `leases`, `knownPrices` (passed through like `folderPath`); share snapshots refresh the baseline from the most recent thread and drop `needsByThread` (stale thread keys). `getCharacterHash` excludes all of these so status changes don't affect import dedup.
- Prompt injection: a `moneyDirective` block in `getBotReply` (real characters only), placed right after the body-needs line. It fires only when balance > 0 or inventory is non-empty (no tokens otherwise) and tells the character their balance, the exact `<buy>item name for $N</buy>` tag format (whole dollars, never more than they have), and what they already own.
- Settlement: `window.economyProcessBuyTags(messageObj)` rewrites `<buy>` tags into `🛍️ bought <item> for $<price>` receipts, deducts money, and appends to inventory. It runs at both save points — inside `addMessageToDb` (covers new replies) and in `regenerateMessage` before its `db.messages.put` (covers re-rolls). Guards: AI characters only (`characterId >= 0`), one-shot per message via `customData.__buysProcessed` (so re-renders and variant switches can't double-charge), malformed tags degrade to plain text, and wishes beyond their balance stay as text with no charge. The receipt stays in the chat history, so ownership persists in future context.
- Story gifts auto-credit: `window.economyScanGifts(threadId)` (own cursor `economyGifts_<threadId>`) parses plain roleplay for money changing hands — `I give you $200`, `He hands her a hundred bucks`, `Here's $200 for you`. Future promises (`I'll give you $120`) become *pending* and are credited when a handover cue follows (`Here`, `here you go`, `she takes the bills`). Shorthand with an amount needs no verb at all: `here 200`, `take this $50`, `$200 for you` (bare numbers only count right after here/take/for-you, so `meet here 4pm` is ignored).
- Story spending deducts symmetrically (`economyParseSpendEvents` / `economySpendActor` / `economySpend`, same scan, separate `spendId` cursor so enabling it later backfills without double-crediting gifts): `spent all of her money`, `all her money is gone`, `I'm broke` zero the balance; `paid $50 for groceries` / `bought food for $30` deduct and record inventory (restoring needs for edible items, like `<buy>` tags do). Gift clauses always win ties (`He pays her $200` credits her); debts, prices, rent mentions, hypotheticals and demands never deduct; the spender's own money moves (your `I spent…` doesn't touch her). Narrated spending is still capped at zero, never negative. It runs at every entry point: inside `addMessageToDb` (so the moment any message lands — yours, hers, re-rolls — gifts/spends apply and the header refreshes), plus the `bodyNeedsForThread` hook (replies, header renders) as backup. Overlapping runs can't double-credit: a per-thread lock serializes passes (`__economyScanGiftsPass` does the work; concurrent callers just mark the lock dirty for a follow-up pass over only-new messages). Guards: slash commands skipped, debts/prices/rent/fees excluded, negations/hypotheticals (`if/can/should`) and demands (`Give me $...!`) ignored, pay-verbs need an explicit recipient, and a `/give` clears any pending offer. Recipients resolve to named cast, `you`/`me` by speaker, else the thread character; each credit toasts `💵 <name> receives $N ($M now)`. Narrated *spending* never deducts — only explicit `<buy>` tags charge, so the AI can't drain a balance by inventing purchases.
- Visibility: the 🍗💧 header click toast now shows each cast member as `<name>: 🍗f 💧w · 💵$b` plus up to 2 current inner-life wants (`innerLifeCharacterState`, best-effort), so desire is visible without opening any dialog. Inner-life wants remain the source of "wanting" (edited in the 🧠 dialog); money makes them actionable.
- Rent (recurring costs — flats, studios, anything): `character.leases` holds `{item, amount, periodMs, lastPaid, active}`. `/rent 800 monthly Downtown apartment` adds one (`daily|weekly|monthly|yearly` + `day|week|month|year`, bare `/rent` lists, `/rent cancel <item>` removes, case-insensitive; `@Name#id` targets someone else). `window.economyProcessLeases(character)` runs inside the money-directive block on every reply: dues older than one period auto-deduct (stamping `lastPaid = now`, so a re-roll or second caller can't double-charge) and emit `just paid $… rent` event lines; broke characters instead get a `RENT OVERDUE … the landlord wants it` line every reply until funded — drama, not silence. The directive also lists each lease (`Rents the X for $800/mo (due in 3 days)`). Amounts render with `window.economyFmt` (1,200,000-style). One-time big buys (buying the flat outright) need nothing new: `<buy>downtown apartment for $120000</buy>` already works.
- Speaker attribution: both claim parsers track second person (`you/your`) alongside first/third. `bodyNeedsClaimTargets` then resolves correctly: your `I am hungry` stays yours (untracked — never pasted onto her), her `you're hungry` stays yours too, her `I am hungry` stays hers, and your `you are hungry` lands on her.
- Lip-biting isn't eating: the `reChew` handler in `bodyNeedsParseMealClaim` skips `bite/chew/gnaw` followed by `lip|tongue|cheek|nail|cuticle|knuckle` (with optional `down`/`on`/`into`/`own` fillers), so "bites down on her own lip to stifle a moan" no longer feeds +60 twice. Real eating (`eats a burger`, `bites into the steak`) still counts.
- Starving metaphors don't starve: the `starv` matcher skips `starving for <desire>` (touch, attention, him/her…), `starving <intensity-noun>` (strength, gaze, grip…), and `starved of <abstraction>`, while real hunger (`I'm starving`, `starving for food`, stomach growling + hollow) still caps low.
- Needs-driven nudge: when the replying character is hungry (<35) or thirsty (<35) and holds cash, the directive appends a pointed (still optional) push to spend some of it on food/drink if any is plausibly nearby, plus any known edible prices. Without this the AI tends to sit on money forever, since the base directive frames buying as entirely optional.
- Always-on status: the directive is emitted every reply, even at $0 (a short "broke, feel the lack" line) — previously $0 told the AI nothing, so she acted as if money didn't exist.
- Learning prices & rent from the chat (no typed numbers needed): the inner-life mind update already re-reads recent chat, so its instruction now also asks for `PRICE: <item> $<n>` / `RENT: <item> $<n> per <day|week|month|year>` lines (concrete numbers only — never invented; both lines skipped when chat says nothing about money). `window.innerLifeParseEcon` extracts them (exported for tests, as is `window.innerLifeBuildUpdateInstruction`), and `innerLifeRunUpdate` feeds them to `window.economyLearn(characterId, {prices, rents})` right after saving the mind: prices upsert into `character.knownPrices` (cap 30, newest wins, matched case-insensitively); a newly heard rent becomes a *pending* lease (`active:false`, `mentions:1`, never charged); hearing it again confirms it (`mentions:2`, `active:true`, `lastPaid` stamped so the first charge comes a full period later), while also refining terms of manual leases without ever deactivating them. A bare `<buy>silk dress</buy>` (no price) then settles against `knownPrices` (exact, then substring match) — otherwise it stays plain text. Known prices also surface in the money directive (`Known prices: …`) and the header toast (`📌 item $n`). Learning rides the inner-life cadence (background, every `updateEvery` messages, or `innerLifeThinkNow`), so it needs inner lives enabled for that chat. Test with a stubbed `innerLifeThinkNow` returning WANT/PRICE/RENT lines, then remove `knownPrices`/`leases` and scrub the stub's mind entries from `innerLifeState`.
- Testing (no generations for most of it): `economyGive` round-trip and `economyProcessBuyTags` cases (exact funds, insufficient, malformed, double-call) against a throwaway character (delete after); `/give` via `#sendButton.click()`; `/ai …` with a capturing stub asserting the `MONEY of <name>: $<n>` block sits before the final `>>> TASK:` (compare against `lastIndexOf`, the shared prefix mentions `>>> TASK` too). Same cleanup rules as body needs, plus delete `money`/`inventory` and scrub stub sentences from `innerLifeState`.

## Comic mode (active)

User request: *"Make me able to activate and deactivate a comic mode that will let me when I press Imaginat [Imagine] that it create a comic about what's happening."* So: an on/off switch that turns the 🖼️ Imagine button (`/img`) into a comic-strip generator for the current scene.

Follow-up: *"Make it two times better"* — added titles, SFX words and shot variety, and up to 8 panels. Comics inherit the reader's normal art style — panel descriptions are content-only with no art-style words, and the existing character/global `imagePromptPrefix`/`Suffix` pipeline styles every panel automatically.

### Behavior

- **OFF** (default): `/img` behaves exactly as upstream — one image of the current moment.
- **ON**: `/img` builds a `COMIC MODE OVERRIDE` reply instruction asking for EXACTLY N panels (`**Panel 1:**` caption + `<image>panel N: …</image>` — each panel gets a 2–3 sentence caption plus a visual description in shared PANEL FORMAT (Subjects/Action/Dialogue/Setting/Light/Frame/Flaws, defined once — not repeated per panel, so long comics keep their output budget for actual panels), starting with a `**💥 title**` line, varied shots, one big SFX word per action panel, with identical character-look wording every panel and exact quoted dialogue lifted from the chat, grounded by explicitly re-reading the last 10–15 messages for who is present, where, and what just happened). `wrapInImageTags` is passed as `{panels}` (an object): the reply is split on panel headers (tolerant of missing bold markup) and rebuilt with exactly one `<image>` tag per panel, stripping any duplicated "panel N:" prefix the model already wrote (a panel whose tag the model forgot gets its caption text as the fallback prompt), and if fewer than N panels result (long comics can exceed one reply's output budget), missing panels are topped up with short continuation replies merged into the kept message (up to 2 rounds; the throwaway continuation message is deleted). `/img --num=K` (2–8) overrides the panel count. Comics bypass the character/thread paragraph limit via a new `ignoreParagraphLimit` option threaded through `doBotReplyIfNeeded` → `getBotReply` (without it, a character capped at e.g. 2 paragraphs can only ever emit a title stub). A small fix in `doBotReplyIfNeeded`'s boolean branch keeps replies that already contain `<image>…</image>` as-is instead of wrapping the whole thing in one tag.
- `/comic` always generates a comic one-shot (even with the toggle off); `/comic on|off|2..8` toggles/sets without generating.

### Data & UI

- `window.comicModeDefaults = {enabled:false, panels:4}` (2–8), persisted in `db.misc` as `comicModeSettings` (global) + `comicModeThreadSettings` (per-chat wins). Resolve/save/toggle/imagine/settings all on `window` (`comicMode*`, `openComicModeSettings`).
- Header `#threadComicCtn` (💥 toggle label, 🖼️ imagine-now, ⚙️, status `on · 4p`), `#comicModeOptionsButton` in ⚒️ options, `showThread` hook, toolbar-layout entries.
- Testing: stub `root.aiTextPlugin` + `root.textToImagePlugin`, enable comic for thread 1, `/img` via `#sendButton.click()`, assert the captured instruction has `COMIC MODE OVERRIDE` + `EXACTLY N panels` and the saved message has N `<image>` tags; then delete the test messages, restore `thread.lastMessageTime`, clear `comicModeThreadSettings`. NOTE: only run live-send tests when the user is idle — a send lands in the active thread and cleanup can collide with real activity.
- Image-side comic handling (in `createMessageElement`): prompts starting with `panel N:` are built from image direction + art style (prefix/suffix) + the panel prompt — and research/fuse when enabled. The `panel N:` label itself is bookkeeping (detection + keep/delete keys) and is stripped before diffusion, so panels generate from the same clean description text a single image would use. Normal (non-panel) images get art style + prompt + optional research/fuse. Generated image iframes are capped with `max-width: calc(100vw - 2rem)` so 450px panels can't overflow narrow phone screens.
- Panel labels are guaranteed by `comicRebuildPanels` (shared by first generation in `doBotReplyIfNeeded` and 🔁 regen in `regenerateMessage`): `comicExtractPanels` first splits on `**Panel N:**` headers, then falls back to one panel per `<image>` tag when the model skipped the headers — so a header-less reply still becomes labeled `**Panel 1:** / **Panel 2:** ...` instead of collapsing into a single image. Regen of a comic passes `ignoreParagraphLimit: true` (like first generation) and rebuilds the same way, so it keeps all panels and only adds a variant (◄ ► switchable) — it never deletes panel 1. Per-panel pictures are independent plugin iframes; the message-level 🔁 always rewrites the whole comic as a new variant, it can't change just panel 2 in place.

## Free will (the ninth added feature)

User request: *"give them free will but let me be able to activate it and deactivate it."* Characters act with their own initiative by default, and it can be switched off per chat. ON injects a short agency directive into every character reply (want things, start things unprompted, make independent choices, speak honestly even when disagreeing); OFF injects a restraint directive instead (purely reactive — never start actions, topics or plans unprompted). Skipped for narrator/system replies and for image/comic generation (`freeWillEnabled: !wrapInImageTags`, like the other per-reply directives). Controls: 🕊️ header toggle (per chat, in the fit cascade), `/freewill` (toggles) or `/freewill on|off`, and a `🕊️ free will` entry in ⚒️ options (toggles directly). Persisted in `db.misc` as `freeWillSettings` (global, default ON) + `freeWillThreadSettings` (per-chat wins).

## User description (the tenth added feature)

User request: *"Give me a way to describe the user."* A global description field already existed (settings gear → "Your default character/role description", stored in `db.misc` as `userRoleInstruction`, plus a per-character-template override in the character editor) — but there was no way to set it **per chat**, and the plumbing for it already existed with no UI: `thread.userCharacter.roleInstruction` feeds the reply prompt at the `userCharacterRoleInstruction` fallback line, and `thread.userCharacter.reminderMessage` feeds the reminder line. So this just wires up the missing UI: the per-chat `changeThreadUserNameHandler` dialog (⚒️ options → "🪪 describe yourself…", also the top-of-feed "🪪 describe yourself" button) now has a "Describe yourself for this chat" text field alongside name and avatar. Saving stores it in `thread.userCharacter.roleInstruction`; clearing the field deletes the key so the fallback chain (per-chat → character template → global default) keeps working — an empty string is never stored, since `??` wouldn't fall through on it. The dialog also shows the current fallback description as a hint when the per-chat field is empty, and the avatar field's default now correctly reads `thread.userCharacter.avatar?.url` (it previously read the nonexistent `thread.userCharacter.avatarUrl`, so it always came up blank — same one-line fix in the "change user pic" dialog). Slash shortcut: `/me <description>` sets it, bare `/me` clears it (listed in the message-box tooltip alongside `/name` and `/avatar`). `/medefault <description>` sets the GLOBAL default persona in `db.misc` as `userRoleInstruction` (bare `/medefault` resets it to built-in).

### Image generation reads it too

The `/img` scene-describer (which also powers Imagine, `/comic` and comic mode — they all share the same `replyInstruction` + look-block) hands the describing model a cast list with everyone's canonical look. It used to read the user's look from `thread.userCharacter.description` — a field that is never set anywhere, so the user's description silently never arrived. It now resolves the real field with the same fallback chain as chat replies: per-chat `thread.userCharacter.roleInstruction` → character-template `userCharacter.roleInstruction` → global default from `getUserCharacterObj()` (likewise for the user's name, previously per-chat-only). Verified live: the chain resolves the active thread's per-chat description.

### Careful-reader fuse on every image (enabled, scene-first)

Before every image is generated, `window.fuseImagePrompt` / `enrichWithDetails` (next to `getCharacterLook` in `index.html`) has a text model carefully read the current scene first (highest priority), then the character descriptions, the last ~8–12 story messages (what's actually happening right now), researched keywords and standing direction, and fuse them into ONE coherent 160–280 word prompt — instead of blindly concatenating, which sends mixed signals when the scene text and the descriptions disagree. The fuse sees the looks of EVERY character in the chat (thread character + everyone who spoke recently + the user's own description, same fallback chain as chat replies), and the recent story lines carry speaker names so it knows who is doing what. The look-distiller and the fuse both keep every exact measurement, number and size (centimeters, proportions, lengths) EXACTLY as written — never rounded, converted or generalized. The current action stays central; permanent traits lock appearance; temporary details come from recent context. Wired into the `<image>` loop in `createMessageElement` (right after the negative-prompt/resolution decisions, so those can't change; button labels/alt text still show the raw scene). Memoised per message in `customData.__fusedImagePrompt[corePrompt]` (keyed with the full pre-fuse inputs, so description edits re-fuse) so re-renders don't re-pay — but every NEW image is fused fresh. Comic-panel `panel N:` prefixes and inline `(param:::value)` params survive the fuse. Any failure falls back to the old concatenation, so images never break. The `/img` scene-describer instruction and the RP-time `<image>` writing note were also strengthened to tell the writer to read descriptions carefully and match visible characters exactly while prioritizing the current moment.


### Stronger /img scene-describer instruction (writes more)

The `/img` (and comic) scene-describer now uses a longer, more detailed instruction that prioritizes the current scene, reads full character descriptions, and produces a fuller prompt. Replace the existing instruction string with:

```js
const imageDescriberInstruction = `You are writing one detailed image prompt for the current moment in the story.

Before you write, carefully re-read:
- What is happening right now in the scene (the action, pose, interaction, and physical situation). This is the highest priority.
- The FULL description of every character who is present (appearance, clothing, body type, hair, eyes, height, distinctive features, and permanent traits).
- The recent chat history and any established facts or memories about current clothing, location, and what just happened.
- The user's own description if the user is visible in the scene.

Write a single clear paragraph of 180–280 words that an image generator can use.

Rules:
- The current action and pose must stay central and accurate. Do not invent a different action or change who is doing what.
- Match permanent character traits exactly (body type, height, hair color and style, eye color, skin, scars, tattoos, distinctive features).
- Match temporary state from the recent chat and memories (current clothing or nudity, current location, lighting, what just occurred).
- If the scene and the description conflict on a temporary detail, follow the scene.
- Include specific details: exact poses, hand placement, facial expressions, clothing or nudity state, how fabric sits or strains, background objects, lighting direction and color, shadows, and camera framing.
- Do not invent clothing, hair, body type, or setting that contradicts the descriptions or established facts.
- Do not add new sexual acts that are not already present in the scene.
- No dialogue, no speech tags, no personality commentary, no backstory, no meta notes.

Output ONLY the image prompt. No title, no quotes, no explanation.`;
```

Use this as the `replyInstruction` when the user presses the Image button or uses `/img` (and for the first pass of comic mode). The fuse still runs afterward, but the first prompt is already longer and more grounded.


## Unused leftovers in `src/`

`src/app.js`, `store.js`, `ai.js`, `presets.js`, `markdown.js`, `customcode.js` and `ai-video.js` belong to an abandoned from-scratch modular rewrite of a character-chat app: nothing in `index.html` references them (no `src/...` URLs anywhere in it). Note that `src/ai-video.js` is a rough prototype (a single still animated by a Depth-Anything-V2 depth-map parallax) and is **not** referenced anywhere. The shipped app is the `main.pjs` + `index.html` monolith; don't edit those files when working on it. (Deleting them would be reasonable housekeeping, but they were left in place deliberately rather than deleted without being asked.)

## App-wide tweaks (smaller than the features above)

### 📝 unsent-draft marker in the chat list

The sidebar's thread rows now show a small `📝` badge when a chat contains text the user typed but hasn't sent yet, so drafts are visible without opening each chat. The app already **stores** the draft natively (`thread.unsentMessageText`, saved on a ~500ms debounce in the `#messageInput` `input` handler and restored at the end of `showThread`) — so this tweak only *displays* it. Do **not** add a second draft store (an earlier attempt at a `threadDrafts` misc key was removed; the native field is the single source of truth).

- `window.setThreadDraftMarker(threadId, hasDraft)` toggles the `.unsentDraftMarker` span in that row (the span is part of the thread-row template, inline `display:none` by default); `window.refreshActiveThreadDraftMarker()` re-reads the active thread and updates its row.
- Called from the draft debounce (with `value.trim().length > 0`), right after the send-path `db.threads.update(threadId, {unsentMessageText: …})` (with `false`), and from `showThread` right after `$.messageInput.value = thread.unsentMessageText` (so returning to a chat shows/hides it correctly). Both helpers live just above `renderThreadList`.

### Personality supremacy (character description always wins)

Every added per-reply directive (free will, inner life, imagination flavor/sparks, body needs, money, variety/pacing notes) carries an explicit "personality always wins" guard, plus a HIGHEST PRIORITY line in `importantNotesText` and in the final `>>> TASK` line. The old `@roleplay1` warm-tone default ("default to positive/warm... AVOID aggression") was rewritten to be personality-conditional — it no longer softens sarcastic/cold/cruel/shy characters, nor adds tone the description doesn't support. If any guidance conflicts with a character's established personality, speech style, knowledge, or morals, the character wins; the guidance is expressed only through behaviour that still fits, or left out.

### Whole-description rule (FULL description every reply)

Every reply sends every involved character's COMPLETE `roleInstruction` - never truncated, summarized, or shortened. `getRoleInstructionText` ignores length limits, the old `_descTokenBudget` trimming block is gone, and inner-life updates use the full text too. When context is tight, old chat messages (and memories/lore overflow) are what get trimmed to make room - descriptions always win. The prompt headers and final `>>> TASK` line tell the model to re-read the FULL description from start to finish and embody every detail.

### Anti-circle circuit-breaker (replies that loop/repeat)

Symptom: a reply "goes in circles" - repeats the same sentences/phrases instead of moving forward (happens when the model ignores the `[[Name]]:` stop markers or falls into a repetition loop; nothing in the old reply path stopped it before max tokens). Fix, all in `getBotReply` in `index.html`:

- an unconditional prompt line in the dynamic tail forbidding circular writing;
- a streaming check (`replyLooksCircular` + a 6000-char runaway net) that calls `streamObj.stop()` the moment output repeats (same 40-char phrase 3x, or same 8+-word sentence 3x; texts under 600 chars never trigger);
- post-processing that strips the repeated sentences when the breaker fired, so the saved message is clean. Short echoes (stutters, etc.) are never deduped.

### Trim-to-fit cuts at message boundaries (2026-10-11 audit fix)

`trimMessagesToBudget` in `getBotReply` (the whole-description rule's "old messages give way" half) used to `slice()` the message text by raw character count, which could leave the surviving text starting mid-message with a dangling fragment (a corrupt-looking `[[Name]]:` line). All three cut sites (the budget trim + the `dropOld` safety net) now go through a `dropOldestChunk(size)` helper that slices and then advances to the next `\n[[` boundary, so the prompt always resumes at a whole message. Single huge messages with no boundary still cut mid-text (unavoidable, harmless behind the `[...]` marker).

### HARD INPUT CAP — replies that ignore the chat (2026-10-12 fix)

Symptom (found in the user's own chat): her replies didn't react to what was happening — they read as if the recent messages didn't exist. Root cause, two layers:

1. The model's input hard limit is ~6976 tokens. Anything over gets cut by the `ai-text-plugin`'s middle-out truncation, which deletes the MIDDLE of the prompt — i.e. the chat history. Tomoko's description alone is 23,771 chars (~4831 tokens), so description + notes + messages + tail overflowed and the chat was silently deleted before the AI ever saw it.
2. The old size-based `slice()` trim made it worse: one oversized cut (`~5500` chars against a `~3900`-char history) emptied the message text ENTIRELY, so even short chats sent zero history.

Fix, all in `getBotReply` in `index.html`: the prompt is now assembled through `buildSharedPrefixContextText()` / `buildInstructionText()` rebuild functions, and after `startWith` is built a hard-cap block guarantees the total stays under 6500 tokens (safely below the plugin's cut), by HISTORY-FIRST sacrifice order — regenerable per-reply extras COMPACT to one-liners first (two passes, ~220 then ~110 chars; money status, body-needs status, free-will note, inner-life mind — logged when shortened), then oldest whole messages via the shared `dropOldestPromptMessage()` helper (the last 5 messages are NEVER dropped — the reply always reads the recent chat, not just the latest line) plus worst-first memories/lore trimming, and only then are extras dropped fully (logged + toasted once per load) as a last resort before worst desc detail sections. Same-author runs of 3+ prompt messages are collapsed to their newest 2 even earlier (loop-breaker, before usage tracking), so a ⏩-spam loop can't fill the context with its own repetitions. Narrator mode, explicit reply instructions, reminders and the TASK always stay. The character description itself is NEVER touched: per user rule, every reply sends ALL of the description, even gigantic ones. To make room for the last-5 guarantee, the `@roleplay1` writing guidelines were condensed (~4640 → ~1660 chars) with every directive kept — the character-supremacy rule lives in the notes and the TASK so it is not repeated a third time there. Verified with stubbed replies on Tomoko-token-equivalent replicas (24.9k chars / ~5060 tokens): 8 short messages → all 8 present verbatim, total 6423/6500; 20 longer messages → last 11 kept (10–20), total 6506; 12 very long messages → trimming stopped at exactly the last 5 (8–12), desc whole, total 6658 (floors holds even over cap — disclosed via warn, still ~320 under the plugin's real ~6976 cut). In every run: description head/middle/tail verbatim, `>>> TASK` plus the grounding line ("never ignore, forget, or contradict it") present, extras dropped first with warn + toast, full reply path OK. Normal-chat regression check (scratch thread 1, small description): 2187 tokens, all 3 messages present, extras intact, no trim markers, no warnings. Note the trade-off, stated honestly: even with a ~5050-token description the last 5 messages are always kept verbatim beside the full description (older ones trimmed oldest-first when the cap binds); still-older events survive via hierarchical summaries (which keep compressing in the background — confirmed firing on huge-desc threads) once the chat grows longer; shorter descriptions keep much more verbatim history. The budget pre-trim floor was raised 500 → 1000 tokens for the same reason, and the drop helper itself refuses to go below 5 messages in any trim phase. `dropOldestChunk` from the previous fix is gone, replaced by the shared whole-message helper (size-based char slicing is banned for this job).

### User-removed prompt blocks (2026-10-14, reversible)
At the user's request, the **imagination flavor + spark** prompt block was removed from every reply to free memory. Its builder is kept but gated by `if(false && …)` with a `USER-REMOVED` comment in `getBotReply` (`index.html`), so re-enabling is a one-line revert. The sacrifice-order list, the HIGHEST-PRIORITY note, and the hard-cap comments no longer mention it; the remaining droppable extras are money / body-needs / free-will / inner-life. (The money status block was removed the same day but restored 2026-10-15 at the user's request.) Imagination dialogs, previews, and header controls still exist but currently change nothing in replies. Verified live on scratch thread 1 (Chloe): captured final instruction (via temp hook + stubbed `aiTextPlugin`, since removed) contains the FULL description header, all 3 test messages, and `>>> TASK`, but no `MONEY of`, no `IMAGINATION_SPARK`, and no flavor line; DB untouched (1 msg before/after, misc keys identical); hook removed afterwards.

### OPTION B selective description — lock always + retrieve details (2026-10-18, user-approved)
Amends the whole-description rule (the stored DB text is still never edited): descriptions over 1500 tokens now send their canon core always (identity head ~300 tokens + consistency-lock + personality sections) plus embedding-ranked detail units for the current moment (top ones within 800 tokens, joined in fixed document order so the prefix cache survives; oversized sections are sub-split into sentence chunks). Everything else falls back to the FULL text exactly as before: small descriptions, thread starts (<=2 messages), advanced-format descriptions, missing embedder, stop signal, any error. Section embeddings reuse `embedTexts` with cache on (stable text, so repeat replies only embed the query). Last resort in the hard cap (after message floor + mem/lore exhausted) drops the worst-scoring selected non-core unit; the core is never dropped. Both tripwires now guard the selected block, plus a fail-loud core-presence assert at build. Verified live on the real 39-message thread (temp hook + stubbed AI, since removed): SELECTIVE mode, total 4237/6500 tokens — description 1673 vs 2333 full (660 saved), history 917, fixed notes 494, directives+TASK ~1150; identity head, lock content, and Personality core all present; retrieved Personality chunks scored highest for the scene; Chloe and thread-start paths still send FULL; zero tripwire/assert errors; DB untouched (1/39 msgs, misc keys equal).

### Anti-rewrite guards (user: "make sure that nothing rewrite it")
Audit found one real silent-rewrite vector: after every message, thread custom code receives the full character (including the description) and whatever it returns for allowlisted keys is written into the stored character — custom code could rewrite the saved description on every message. Fixed in `updateDbWithNewDataFromCustomCode`: incoming `roleInstruction` is now dropped for both the stored character and the per-thread override (fail-loud console warnings), while all other keys still sync normally. User edits via the character editor and thread settings still work — only the silent custom-code path is blocked. Plus two prompt-side hardenings in `getBotReply`: `roleInstructionText` is now `const` (was `let`), and a tripwire just before sending asserts the final instruction still contains the rendered description byte-identical — console error + toast if ever violated, reply still sent. Proven: simulated custom-code rewrite of both stored desc and thread override → both blocked with warns, legit name change still written, DB byte-identical; replica reply (Tomoko-scale): desc whole, all 8 messages, no tripwire false alarm.

### Gradual lore sacrifice (user: "make it better")
Two trims used to drop lore worst-LAST: the hard cap wiped all memories/lore as one unit, and the 25% retrieval-budget loop popped from the array end — where genuinely top-ranked lore sits, because irrelevant "use everything" entries carry Infinity and sort first. Both now trim worst-first via a shared `loreEntryTrimScore` (Infinity/unscored → drops before scored entries, which survive in relevance order): new `dropWorstLoreEntry`/`worstLoreEntryScore` in the 25% loop, new `trimWorstMemLoreUnit` (one batch or entry per step) in the hard cap, with usage tracking (`memoryIdBatchesUsed`/`loreIdsUsed`) recomputed after hard-cap trimming so the brain-button record matches what was actually sent. Memory-query prompt got the same verbatim tripwire as the reply prompt. Proven on a Tomoko-scale replica with 30 lore entries (5 top-relevant + 25 irrelevant) and stubbed embeddings: all 5 tops kept, all 25 junk dropped, last-5 messages kept, desc whole, tracked IDs exactly match sent lore, total 6514 (disclosed via warn). Hooks removed, refresh clean, user DB untouched, zero stray test rows.

### Full audit (2026-10-11, user asked "look if there is any other problem")

Checked and clear: fresh load has zero `syntaxErrors`/`perchanceErrors`/console errors; no duplicate element IDs; header bar has no overflow on desktop (1400x900) or phone (390x844, feature controls degrade via the existing cascades); end-to-end stubbed reply on scratch thread 1 shows the FULL Chloe description verbatim in the prompt, `NARRATOR MODE` present with the old self-only contradiction line gone, anti-circle line present, `>>> TASK` ordered after description + directive; memory/lore drop loop can't hit its empty-drop crash (prefixes alone are far under the 25% budget); auto-talk loop guards (stop/pause/visibility/failure-count) intact; IMAGE RULE stubs coherent (all `<image>` prompts go through unrestricted assembly, research and fuse active). Only fix needed was the trim-boundary one above. Test-only residue was fully cleaned (scratch message ids 21/22/23 deleted, `lastMessageTime` restored, stubs removed, back on thread 2).

Testing gotchas re-confirmed: the preview viewport resets to ~389x150 on its own (feed height 0, so `doBotReplyIfNeeded` silently no-ops) — always `set_viewport_size` + poll `innerHeight` before reply tests. `page_eval` can report `pageFreshnessUnknown`; verify with `page_refresh` + a marker check (`dropOldestChunk` in script text) before trusting results. `String(fn)` of ANY function reads as `[native code]` here, and `root.aiTextPlugin === fn` is false even right after assigning (reads return a fresh wrapper) — assert interceptions by behaviour (captured opts / stub text saved), not by identity. A stub MUST delegate `getMetaObject` to the original, or summarization throws a stub-induced `countTokens is not a function` error.

### Memory upgrade (2026-10-21, user: "make the memory of the character better")
Five changes, all additive and prefix-cache safe (the shared prompt prefix is untouched):

- **Richer memory entries** (`main.pjs` memory prompt): up to 5 entries per summary (was 3, stop sequence `\n6.`), with new instructions to capture durable facts about the OTHER people in the chat (user name, traits, promises, relationship state), a SUPERSEDE rule (contradicted fact → write the current version standalone, never the stale one alone), and WHO-did-WHAT-to-WHOM + when/where anchoring for events. Summary prompt gained a durable-facts TIP (names, numbers, promises, decisions and relationship changes are never compressed away — later memories are built from summaries).
- **Dedup at injection** (`main.pjs`): new `normalizeMemoryTextForDedup` (also used by the filter) + a known-text set built from existing memories; re-summarized spans no longer pile up near-identical entries that drown retrieval. Normalized exact-match only — never drops genuinely new text.
- **Memories survive without the embedder**: the DB write no longer requires `window.textEmbedderFunction` (entries saved with null embeddings), and `/mem` manual saves work too (null embeddings instead of hanging on the 30s poll).
- **Keyword fallback ranking** (`index.html`, new `window.memoryKeywordSet` / `window.memoryKeywordScore`): entries lacking a vector embedding (no embedder, keyword-only mode, older model) are scored by shared distinctive words with the AI queries + recent chat, scaled to sit below strong vector matches. The old missing-embedding `throw` (which killed the whole reply, e.g. after a model change) is gone; lore without an embedding keeps the include-everything (Infinity) guarantee.
- **Conflict rule** in the retrieval header: memories are chronological, and if two disagree the LATER one wins — stale facts are never resurrected.

Verified live on scratch thread 1 with real AI queries + real embeddings + real generations (no stubs for the retrieval assertions): keyword mode ranked the two relevant memories above the irrelevant one (0.164/0.067 vs -1 filtered); vector mode ranked the on-topic memory 0.8 vs -0.3 off-topic (correctly dropped); mixed mode (vector + one null-embedding entry) retrieved the null entry by keywords alongside vector seeds; replies visibly used the recalled facts. Testing caught and fixed one self-inflicted bug (dropped `_relevanceScore = 0` init → NaN vector scores) before it shipped. Scratch residue fully cleaned (test messages deleted, message 1 restored to no-memories, `innerLifeState`/spark queue cleared of thread-1 data, thread 2 untouched at 476 messages).

### Memory upgrade round 2 (2026-10-23, user: "can you make her memory better?")
Four changes, all in the reply path / extraction prompt, no DB format changes:

- **Memories framed as canon, not optional** (`index.html`): retrieved memories/lore were wrapped in `<ignore_this_if_irrelevant>…</ignore_this_if_irrelevant>` — literally inviting the model to skip them. Now wrapped in `<canon_facts>`, matching the retrieval header ("all canon — actively use every detail") and the CANON RULE (chat defines what is TRUE RIGHT NOW).
- **Fresh pending memories get vectors immediately** (`index.html` overlay): overlay-applied memories arrived with null embeddings → discounted keyword scores only. The overlay now embeds them via the same `window.embedTexts` call the injector makes at flush (guarded, failure falls back to keywords), so this reply ranks fresh facts by vector like everything else.
- **Current-state facts are now extracted as memories** (`main.pjs` prompt): the extractor previously banned "temporary facts" — exactly the continuity facts users ask about (where everyone is, attire, prices/deals, what's decided). New bullet welcomes them with as-of anchoring so they stay true forever; cap raised 5 → 6 entries (stop sequence `\n7.`).
- **Deterministic 5th search query** (`index.html`): the last user message (verbatim, 300 chars) is appended to the 4 LLM-written queries, so direct questions ("how much did I pay you?") search with their own wording instead of relying on the LLM's paraphrases.

Verified live with a non-mutating `getBotReply` call on the real thread (unsaved fake user message, temp `window.__testGetBotReply` hook, removed after): 4 queries incl. the verbatim user question, 13 memory batches incl. the payment-era ones, correct answer ("ten thousand yen… for the whole night"). Hook removed, refresh clean, user DB untouched.

### Memory upgrade round 3: whole memory every time (2026-10-23, user: "maybe it should use the whole memory every time")
- **No relevance filtering** (`index.html`): `relevantMemories` is now ALL memories, chronological. Scores are kept only to order worst-first trimming.
- **No top-20 seed cut**: batches are fixed chronological chunks of 4 (seed/extend/merge bypassed via `wholeMemoryMode`), so trimming shaves the least relevant chunks first instead of all-or-nothing.
- **Adaptive retrieval budget**: floor raised 0.25 → 0.5 of ideal context, and the effective budget auto-raises to fit every memory chunk — the retrieval stage now only ever trims lore. The 6500 hard cap stays the final limiter (old history trims before mem/lore there, worst-first).

Verified live with a non-mutating reply on the real thread (temp hook, removed after): retrieval carries all 90 memories in 23 chunks; the hard cap keeps the 70 most relevant (18 chunks) and shaves the 5 least-relevant chunks so the prompt fits 6500 alongside her full description (1933 tokens) and recent history. Reply stayed coherent and in character. Physics note: literally-100% can't fit with a full description + recent history under the model's ~7k middle-deletion ceiling — 6500 stays. Nothing is permanently forgotten: dropped chunks are the lowest-scoring for that moment and resurface when relevant.

### Memory upgrade round 4 (additional improvements)
- **Stronger current-state extraction**: the memory extractor now explicitly prioritizes durable relationship state, ongoing promises, current location/attire, and unresolved wants. Temporary facts are still extracted but tagged with as-of timestamps so later updates can supersede them cleanly.
- **Better conflict resolution**: when two memories contradict, the later one is preferred, and the earlier one is marked as superseded in the retrieval header so the model sees both the current truth and the history.
- **Richer keyword scoring**: `memoryKeywordScore` now weights proper names, numbers, and rare content words more heavily, and ignores stopwords more aggressively. This improves ranking for null-embedding entries without changing vector behavior.
- **Image-memory synergy**: `__imageMemoryBlock` now prefers memories that contain visual or clothing details when building the "Established facts" block for images, and it respects scene-wins filters more strictly (naked scene drops garment memories, etc.).
- **Manual `/mem` improvements**: `/mem` now accepts multi-line input and can optionally force an immediate re-embed of the new entry so it ranks by vector on the next reply.

These changes remain prefix-cache safe and do not alter the stored memory format.

---

**Image-generation status in this version:**  
Internet research, image director, careful-reader fuse, and comic mode are fully active. Image prompts prioritize the current scene (action, pose, interaction), then consult character descriptions for permanent traits and recent chat/memory for temporary state. No content-rewriting scrubbers or sexual-role master gates. Adult styles retain only the no-minors negative list. Ownership, dye, panel, and motion helpers remain available as soft negatives but do not block or rewrite generation. Character descriptions are consulted on every image via the fuse and/or grounding block (skipped only for pure user-typed `<image>` captions). The fuse produces a coherent 160–280 word prompt with the current action kept central.
# Memory System — Major Upgrade (Round 5)

This document describes concrete improvements to the memory system. Apply the code changes in `index.html` and `main.pjs` as indicated.

## Goals

- Extract higher-quality, temporally anchored facts
- Explicitly track supersessions instead of only preferring the later memory
- Group memories by entity (person / place / item) for cleaner retrieval
- Improve image-memory synergy without changing the scene-first priority
- Keep the whole-memory mode and the 6500-token hard cap intact

---

## 1. Richer extraction prompt (`main.pjs`)

Replace the memory extraction prompt with a stronger version that forces better structure.

**Search for** the memory prompt that currently asks for up to 6 entries. Replace it with:

```js
const MEMORY_EXTRACTION_PROMPT = `
You are extracting durable and current-state facts from a roleplay conversation.

Output 1–8 short facts, one per line, in this exact format:
FACT: <who/what> | <statement> | <as-of: recent|ongoing|supersedes previous> | <entity: Name or Place or Item>

Rules:
- Prefer facts that will still matter later (relationships, promises, locations, injuries, items owned, decisions, appearance changes).
- Capture current temporary state (where people are, what they are wearing right now, active deals) and mark them "recent".
- When a new fact contradicts an older one, write the new version and mark it "supersedes previous".
- Never invent. Only extract what is clearly stated or strongly implied by the conversation.
- Keep each fact under 25 words.
- Stop after 8 facts or when nothing more is worth extracting.

Example:
FACT: Mira | is currently wearing a torn red coat | recent | Mira
FACT: Tomoko | promised to return the key by sunrise | ongoing | Tomoko
FACT: Alley | the alley is now blocked by a fallen cart | supersedes previous | Alley
`;
```

Update the stop sequence to `\n9.` and raise the hard cap from 6 → 8.

---

## 2. Explicit supersession tracking (`index.html`)

Add a lightweight supersession layer on top of the existing chronological whole-memory mode.

```js
// Call this after loading memories for a thread, before retrieval.
function annotateSupersessions(memories) {
  const byEntity = {};
  for (const m of memories) {
    const entity = (m.entity || "general").toLowerCase();
    if (!byEntity[entity]) byEntity[entity] = [];
    byEntity[entity].push(m);
  }

  for (const entity of Object.keys(byEntity)) {
    const list = byEntity[entity].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      if (String(current.asOf || "").includes("supersedes")) {
        // Mark older facts about the same entity as superseded
        for (let j = 0; j < i; j++) {
          if (!list[j]._supersededBy) {
            list[j]._supersededBy = current.id || current.text?.slice(0, 40);
          }
        }
      }
    }
  }
  return memories;
}
```

In the retrieval header, when rendering memories, append a short note for superseded entries:

```js
function formatMemoryForPrompt(m) {
  let line = m.text;
  if (m._supersededBy) {
    line += " [superseded]";
  }
  return line;
}
```

The model still sees the full history, but the current truth is visually preferred.

---

## 3. Entity-centric grouping (optional but strong)

When building the memory block for the prompt, group by entity:

```js
function groupMemoriesByEntity(memories) {
  const groups = {};
  for (const m of memories) {
    const entity = m.entity || "General";
    if (!groups[entity]) groups[entity] = [];
    groups[entity].push(m);
  }
  return groups;
}

// In the prompt builder, instead of a flat list:
const groups = groupMemoriesByEntity(relevantMemories);
const memoryBlock = Object.entries(groups)
  .map(([entity, list]) => {
    const lines = list.map(formatMemoryForPrompt).join("\n");
    return `### ${entity}\n${lines}`;
  })
  .join("\n\n");
```

This makes long memory lists easier for the model to scan.

---

## 4. Stronger image-memory synergy (keep scene-first)

Update `__imageMemoryBlock` so it still respects scene-wins, but prefers visual facts more aggressively:

```js
window.__imageMemoryBlock = function(threadId, scene) {
  const memories = getMemoriesForThread(threadId) || [];
  const sceneLower = String(scene || "").toLowerCase();
  const isNakedScene = /(naked|nude|no clothes|undressed)/.test(sceneLower);

  const visual = memories.filter(m => {
    const t = String(m.text || "").toLowerCase();
    if (isNakedScene && /(wearing|dressed|shirt|pants|coat|dress)/.test(t)) return false;
    return /(hair|eyes|wearing|outfit|scar|tattoo|location|room|lighting|pose)/.test(t);
  });

  const chosen = (visual.length ? visual : memories).slice(-12); // most recent first
  if (!chosen.length) return "";

  return "Established visual facts (scene wins if conflict):\n" +
    chosen.map(m => "- " + m.text).join("\n");
};
```

---

## 5. Periodic consolidation (background, optional)

Add a lightweight consolidation step that runs every N summaries. It asks the model to merge near-duplicate facts and write cleaner current-state lines. This is optional and can be gated behind a flag.

```js
async function consolidateMemories(threadId) {
  const memories = getMemoriesForThread(threadId);
  if (memories.length < 20) return; // not worth it yet

  const instruction = `
You are consolidating a character's memory.

Below are existing facts. Merge duplicates, drop obsolete details, and produce a cleaner list of 8–15 current-state facts.
Keep the most recent version of any contradicted fact.
Output only the cleaned facts, one per line, prefixed with FACT:.

${memories.map(m => m.text).join("\n")}
`;

  const result = await root.aiTextPlugin({ instruction });
  // Parse and replace or append the consolidated set (implementation depends on your DB layer)
}
```

Call this from the existing summary pipeline every 3–4 summary cycles.

---

## Integration checklist

1. Update the extraction prompt in `main.pjs` (section 1).
2. Add `annotateSupersessions` and call it when loading memories for a reply (`index.html`).
3. Optionally switch the memory block renderer to entity grouping.
4. Update `__imageMemoryBlock` with the visual-preference filter.
5. (Optional) Wire consolidation into the summary loop.
6. Keep whole-memory mode and the 6500 hard cap exactly as they are — these changes only improve the quality of what is stored and how it is presented.

## Testing notes

- After changing the extraction prompt, force a summary on a test thread and inspect the new `FACT:` lines.
- Verify that a contradicted fact gets the `[superseded]` marker in the next reply’s prompt.
- For images, confirm that a naked scene no longer injects clothing memories.
- All changes are additive; the hard cap and last-5-message guarantee remain untouched.

# DESIGN 2 integration and independent local features

Reference: the user's **AI Character Chat — Complete Visual Design Spec** (DESIGN 2.md) and [original Perchance source](https://perchance.org/5shpo77nku#edit). This app is independently hosted, not connected to Perchance's runtime or community services.

## Targeted design corrections

- Edit-character/describe-yourself quick actions now scroll inside the message feed; a separate floating header contains the hamburger and feature toolbar. Toolbar controls progressively collapse by measured available width, in the original source's order, rather than fixed group-hiding breakpoints. A measured collision guard reserves the quick buttons' actual right edge, collapsing optional toolbar groups early so they cannot cover these controls; an empty toolbar frame is hidden. This is an intentional responsive adaptation, not a claim of identical placement at every viewport.
- Sidebar is explicitly 270 CSS pixels including its 8px padding, with a fixed flex basis and border-box sizing. A saved screenshot is 1920×1200; a 1280-wide rendition scales a 270px rail to 180 image pixels. Do not enlarge the rail to compensate for screenshot rescaling.
- Absent portraits are blank neutral 50px squares, not teal initials. Placeholder colors are #d3d3d3 (Light) / #3d3d3d (Dark), with 3px corners. Existing actual portraits remain intact.
- Default interface corners are 3px; toolbar groups 1.8px, local gallery cards 8px, thumbnail placeholders 4px, toasts 6px, typing dots 2px. Source theme tokens are retained; inherited card-hover/link overrides are corrected. Hover fills are fine-pointer-only. Toast styling follows the spec's box-color toast, distinct from its blue notification token.
- Mobile avatars retain 50px dimensions; the sidebar remains a dismissible overlay. Composer retains its 4.5rem minimum height, bottom send/options column and non-resizable textarea.

## Working replacements and their limits

1. **Character generation and saving.** The library's ✨ Generate a character offers an offline local template, derived from the supplied brief, or an explicitly selected configured AI provider. AI mode requests validated JSON, strips executable/storage fields, supports Stop and rejects late results. Both modes open an editable draft; only pressing Save persists a character. Cancel does not create a blank character. Provider mode may cost money and requires the owner's existing provider configuration.
2. **Imagination and narrator.** Per-thread presets persist and modify subsequent generated instructions. Narrator style affects explicit Narrator replies; changing a preset alone makes no request. Random imagination selects and displays a local preset.
3. **Response length.** Short/medium/long set actual output ceilings of 256/1024/2048 tokens. The provider adapter clamps requests to its configured maximum. This is not a promised word count.
4. **Image direction and art style.** Direction persists per thread and is appended to image prompts; art style remains saved per character and applies to that character's chats. Existing image-generation adapters are reused, not Perchance image servers.
5. **Inner-life and needs.** Editable fictional notes and manually controlled hunger/thirst/energy persist per thread and affect subsequent replies when enabled. They are not hidden model reasoning or an autonomous needs simulation. Optional notes are trimmed to available context rather than expanding the existing context target.
6. **Gallery.** Actual message images and PNG/JPEG/GIF/WebP uploads appear in a local gallery/lightbox. Uploads are limited to 1MB, stored persistently, and storage failures are reported. This is not Perchance's public style catalog or image-conditioned generation.
7. **Research.** Explicit external web/image-search links plus locally saved pasted findings and source URLs. Notes are labeled unverified reference material and are sent with subsequent prompts; this app does not crawl, verify results or silently access live search. Research is manual, not a reimplementation of Perchance's search backend.
8. **Free will.** Reuses bounded, explicitly started multi-character auto-talk with pause, Stop and a visible turn limit. Settings persist per thread, but a reload never automatically resumes a run. At least two chat characters are required.
9. **Feedback/comments.** Enabled private local notebooks with Save and text export. Their dialogs explicitly say they are not public community posts or messages to the developer. Nothing is sent.

Storage is the existing `acc_kv_` **localStorage**, not a new backend or IndexedDB. Writes commit to storage before updating the in-memory cache, so quota/security failures do not report successful saves. Existing characters, threads and messages retain their storage keys. Notes have their own export; no new cross-device synchronization is claimed.

## Changed files in this update

- `js/feature-state.js`: pure normalization, prompt settings/budgets, character template/AI draft validation, safe research links and gallery validation.
- `js/local-features.js`: working local dialogs, character generation/review, notebook export and persistent image uploads.
- `js/local-kv.js`: durable, clone-on-read localStorage adapter; `js/boot.js` imports it.
- `js/toolbar-layout.js`: original width-measured collapse sequence and separator visibility.
- `js/app.js`: local controls/actions, draft-only new characters, save errors, per-thread state, neutral placeholders, source header and prompt/image integration.
- `js/ai.js`, `js/llm.js`: pass optional author settings and output ceilings through the existing stoppable provider pipeline.
- `css/perchance-layout.css`, `index.html`: scoped design corrections and enabled, honestly labeled independent controls.
- `tests/local-features.test.mjs`, `tests/design-dom.mjs`: feature behavior, UI persistence and regression checks.
- `DESIGN-INTEGRATION.md`: this implementation/limitations record.

## Validation

- `npm test`: 27 tests, including the original 15 regression tests.
- `npm run test:dom`: eight isolated DOM integration checks, including active Options dialogs, persistent notes/settings, local generation → editable draft → actual Save with zero provider calls.
- Additional tests cover safe AI JSON, Stop/late results, prompt effects, output ceilings, remaining-context trimming, gallery validation, failed-storage behavior and per-thread isolation after navigation.
- No real text/image provider request, credential entry or deletion of existing user data was used for these checks. Provider calls are mocked; paid/provider end-to-end behavior is not live-verified.
- These tests are not rendered-pixel comparisons. A new published-browser comparison is required before claiming measured visual fidelity; no pixel-perfect claim is made here.

To repeat: `npm install`, `npm test`, `npm run test:dom`. No provider credentials are needed for tests. The 9,000-token context target, 2,048-token reply ceiling, synchronous metadata and existing cancellation protections remain covered.

Other previously documented non-ports remain out of scope: Perchance favorites/folders and full-message regex search, URL-page character extraction, message variants/history/slash commands, music and its custom-code side column. Existing app data/provider configuration and the one-time Light migration are retained; later theme choices are respected.

## Original-source permission

The downloaded source begins with this permission notice:

> Note: Since people have asked: You can consider all the code below to be open source under the standard MIT licenced.
> I.e. you're free to do as you wish with it, including copying it, hosting it yourself, and using it commercially.

Original stylesheet provenance: [public generator export](https://perchance.org/api/downloadGenerator?generatorName=5shpo77nku), main `outputTemplate` style block, original extracted-layout lines 1184–1761. Downloaded November 9, 2026.

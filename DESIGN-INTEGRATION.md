# DESIGN 2 integration

Reference: the user's **AI Character Chat — Complete Visual Design Spec** (DESIGN 2.md) and the original [Perchance generator](https://perchance.org/5shpo77nku#edit).

## Where the changes are

- `index.html`: original-style 270px thread-first sidebar; conditional thread search; bottom Settings/Tips/fullscreen/export/import controls and emojis; original stylesheet plus adaptation stylesheet loading. Existing startup/loading and hidden compatibility IDs retained.
- `css/perchance-original.css`: exact main stylesheet extracted from the original generator output template, including light/dark design tokens, source scrollbar/hover/typing rules and attribution.
- `css/perchance-layout.css`: maps original styling to this project's working IDs. Exact `#e8e8e8` canvas, `#c8c8c8` buttons, `#b4b4b4` hover/borders, `#f1f1f1` input/box fill, dark equivalents, 3px corners, 270px rail, 50px avatars, .5rem spacing, .825rem buttons, inherited sans-serif, unboxed message text, feature toolbar, composer, dialogs and responsive layouts. SVG icons remain bounded at 16px.
- `js/app.js`: thread cards/search, source-shaped emoji header/toolbar/Options menu, local Settings dialog, art-style selection saved on the character, speaker shortcuts, draft retention during composer rerenders, avatar/auto-reply toggles, explicit one-time Light/16px appearance migration, and bounded user-started auto-talk. Theme choices made after the migration remain respected. Stop and navigation cancel an auto-talk run; no run starts or resumes merely on load.
- `js/autotalk.js`: bounded rotating-character controller; pause/resume, request cancellation, timer cleanup, failure handling and hard 1–100 message validation. Default cap is 25; the user must press Start after a charge notice. Two actual chat characters are required. It does not automatically generate user turns.
- `js/ai.js`: explicitly requested user-speaker drafts override the otherwise correct instruction forbidding AI-written user messages and omit the user's own stop sequence.
- `tests/llm.test.mjs`: existing context/Stop/metadata tests retained, migration expectations updated and explicit user-speaker coverage added.
- `tests/autotalk.test.mjs`: inert startup, rotation/cap, pause/resume, abort, late results, timer cleanup, failures and validation.
- `tests/design-dom.mjs` and `package.json`: repeatable isolated DOM smoke checks and test commands. DOM fixtures are memory-only and provider responses mocked.

## Validation

- `npm test`: 15 tests passed.
- `npm run test:dom`: six in-memory DOM integration checks passed: fresh boot/Light/greeting/toolbars without generation, actual delegated clicks/Settings, Light–Dark switching and draft preservation, three speaker roles, conditional thread search, and disabled unavailable Options entries.
- Syntax checks passed for changed JavaScript modules; `git diff --check` passed for tracked changes.
- No real text/image request, provider-key entry or user-data deletion was performed during verification.
- The DOM checks do **not** measure rendered pixels or establish a pixel-identical browser comparison. Browser comparison is pending publication.

To repeat the checks after downloading the project, install development dependencies with `npm install`, then run `npm test` and `npm run test:dom`. No provider credentials are required.

## What is intentionally not claimed

This is an integration of the design into the existing modular app, not a wholesale port of Perchance's runtime and plugins.

1. Perchance community feedback/comments, example-image style gallery, internet/image research, imagination/sparks, inner-life/body-needs/free-will simulations, advanced narrator controls, standing image-direction settings and response-length profiles are not connected. Their corresponding visible controls are disabled or marked unavailable; they do not pretend to perform those operations. Single Narrator replies and bounded multi-character auto-talk are implemented independently.
2. Only a small local art-style selection is offered, not Perchance's full style catalog/gallery.
3. Toolbar group hiding uses responsive CSS breakpoints rather than Perchance's runtime width-measuring cascade. The header's edit/describe buttons remain visible, and feature groups are arranged on a following row rather than reproducing all original overlay behavior.
4. The new-character/library screen and editors remain this project's functional versions, restyled rather than completely replaced. URL-based character generation, favorites/folders, input-history/slash-command UI, message variants, music player, emergency export modal and custom-code side column were not ported.
5. Thread search matches titles/previews; it is not Perchance's full-message regular-expression search. Thread numeric badges are display-order badges, not imported Perchance database IDs.
6. Local provider configuration, storage format, current character portraits/greetings and AI behavior remain this project's. Existing browser data is not migrated into Perchance's database schema.
7. `js/llm.js` and `js/boot.js` were not changed. The 9,000-token total context target, 2,048-token reply maximum, synchronous metadata behavior and generation cancellation safeguards remain covered by offline tests. Browser UI alone does not prove a provider honored a token budget.

The changes were originally prepared and validated locally. On November 9, 2026, the user explicitly authorized committing, pushing to main, and publishing with GitHub Pages. Browser visual verification is a separate follow-up; the checks above do not establish pixel-perfect rendering.

## Original-source permission

The downloaded source begins with this permission notice:

> Note: Since people have asked: You can consider all the code below to be open source under the standard MIT licenced.
> I.e. you're free to do as you wish with it, including copying it, hosting it yourself, and using it commercially.

Original stylesheet provenance: [public generator export](https://perchance.org/api/downloadGenerator?generatorName=5shpo77nku), main `outputTemplate` style block, original extracted-layout lines 1184–1761. Downloaded November 9, 2026.

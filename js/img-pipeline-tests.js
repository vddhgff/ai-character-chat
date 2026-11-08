/* Image-pipeline test suite (src/tools/img-pipeline-tests.js).
 * Run:  await tools.page_eval({path:"src/tools/img-pipeline-tests.js"})
 *    or in console: await window.__runImgPipelineTests()
 * No real generations are burned (textToImagePlugin is stubbed in E2E).
 * No user data is touched: scratch thread + messages are deleted afterwards.
 */
window.__runImgPipelineTests = async function() {
  const results = [];
  const t = (name, cond, detail) => results.push({name, pass: !!cond, detail: cond ? "" : String(detail || "assertion failed")});
  const W = (fn) => { try { return {v: fn()}; } catch(e) { return {err: String(e && e.message || e)}; } };

  // ---------- A. ownership guard ----------
  let g = W(() => window.__imageOwnershipGuard("her giant dick pressed into his thigh, he is fully clothed"));
  t("A1 her-owns pins him as member-less", g.v && /penis on the man/.test(g.v.negatives), JSON.stringify(g));
  g = W(() => window.__imageOwnershipGuard("his big dick throbs as she kneels naked before him"));
  t("A2 his-owns pins her", g.v && /penis on the woman/.test(g.v.negatives), JSON.stringify(g));
  g = W(() => window.__imageOwnershipGuard("her dick slides against his dick"));
  t("A3 both own -> null", g.v === null, JSON.stringify(g));
  g = W(() => window.__imageOwnershipGuard("a man with black hair and a big dick stands near her"));
  t("A4 bare male descriptor bans it on her", g.v && /penis on the woman/.test(g.v.negatives), JSON.stringify(g));
  g = W(() => window.__imageOwnershipGuard("a futanari with a big dick smiles at a man"));
  t("A5 futanari bare -> null", g.v === null, JSON.stringify(g));

  // ---------- B. contact guard ----------
  let c = W(() => window.__imageContactGuard("her hand digging deep into the flesh of his big ass and squeezing"));
  t("B1 her-on-his forbids flipped grope", c.v && /his hand on her ass/.test(c.v), JSON.stringify(c));
  c = W(() => window.__imageContactGuard("his hands grip her soft ass and squeeze"));
  t("B2 his-on-her mirror branch", c.v && /her hand on his ass/.test(c.v), JSON.stringify(c));
  c = W(() => window.__imageContactGuard("they hold hands and walk"));
  t("B3 neutral -> empty", c.v === "", JSON.stringify(c));

  // ---------- C. hair dye guard ----------
  let d = W(() => window.__imageHairDyeGuard("a woman with solid black hair, green eyes with purple dark circles sitting low"));
  t("C1 black hair + purple eye-circles still bans dye", d.v && /purple hair/.test(d.v), JSON.stringify(d));
  d = W(() => window.__imageHairDyeGuard("a woman with purple hair and green eyes"));
  t("C2 truly dyed -> empty", d.v === "", JSON.stringify(d));
  d = W(() => window.__imageHairDyeGuard("a man with solid black hair"));
  t("C3 black hair bans streaks/highlights", d.v && /purple streaks/.test(d.v) && /red streaks/.test(d.v), JSON.stringify(d));

  // ---------- D/E. insertion + role ----------
  let ins = W(() => window.__imageInsertionStated("her shaft buried to the hilt inside his anus"));
  t("D1 insertion stated", ins.v === true, JSON.stringify(ins));
  ins = W(() => window.__imageInsertionStated("her bulge presses hard into the crease of his thighs through fabric"));
  t("D2 no insertion in clothed grind", ins.v === false, JSON.stringify(ins));
  let r = W(() => window.__imageRoleDirection("she straddles him cowgirl, her hard penis inside his anus"));
  t("E1 womanTop explicit", r.v === "womanTop", JSON.stringify(r));
  r = W(() => window.__imageRoleDirection("they walk side by side down the street, her bulge hidden in her shorts"));
  t("E2 tame -> null", (r.v === null || r.v === undefined || r.v === ""), JSON.stringify(r));

  // ---------- F. style negation move ----------
  let mv = W(() => window.__imageMoveNegations("soft light, no text, no watermark", "hentai finish, no signature"));
  t("F1 no-X lifted from style to negatives", mv.v && mv.v.moved.join(" ").indexOf("text") >= 0 && mv.v.prefix.indexOf("no text") < 0, JSON.stringify(mv));

  // ---------- G. continuity anchor (read-only, live thread) ----------
  const anchor = await window.__lastImageSceneText(window.activeThreadId).catch(e => "ERR:" + e.message);
  t("G1 anchor resolves", typeof anchor === "string" && anchor.length > 100, String(anchor || "").slice(0, 80));
  t("G2 anchor has no age numbers", !/\d+-year-old/i.test(anchor || ""), String(anchor || "").slice(0, 120));
  t("G3 anchor has no img tags", (anchor || "").indexOf("<image>") < 0, "");

  // ---------- H. instruction rules present ----------
  const src = document.documentElement.innerHTML;
  ["IDENTITY ONLY", "old room is gone", "Anatomy ledger", "CLOTHED BODIES", "Grope staging",
   "AFFIRMATIVE", "exactly two figures", "his hands stay off", "matte", "slice(0, 600)",
   "at least 250 words"]
    .forEach(k => t("H rule: " + k, src.indexOf(k) >= 0, "missing"));

  // ---------- I. end-to-end on a scratch thread (stubbed generator) ----------
  const captured = [];
  const origPlugin = root.textToImagePlugin;
  const prevActive = window.activeThreadId;
  let scratchTid = null;
  const createdMsgIds = [];
  try {
    const liveThread = await db.threads.get(prevActive);
    const yomiId = liveThread.characterId;
    const scratchTpl = structuredClone(liveThread);
    delete scratchTpl.id;
    scratchTpl.title = "__imgtest__"; scratchTpl.createdTime = Date.now(); scratchTpl.lastMessageTime = Date.now();
    scratchTid = await db.threads.add(scratchTpl);
    const scenes = [
      // 0: tame clothed her-owns + grope + black hair
      "The scene is a wide side-shot of two grown adults pinned against a rough grey stone city wall, one grown adult woman with an athletic build, big boobs that fill her white cotton tank top, a big ass that fills her navy blue shorts, and short matte black hair, her hand digging deep into the flesh of his big ass and squeezing, her giant dick creating a distinct bulge straining under her navy shorts into his thigh, his hands staying off her body and flat against the wall, harsh midday sun.",
      // 1: explicit penetration womanTop
      "The scene is one continuous wide side view, exactly two figures, one grown adult woman with solid black hair, her thick erect cock buried to the hilt inside his anus as she straddles him cowgirl on top, her balls pressed flush against his big ass, his spread ass presented to the camera, her rear turned away, dim room.",
      // 2: plain tame, no genitals
      "The scene is a wide side-shot of two grown adults on a city sidewalk at noon, one grown adult woman with short matte black hair and a white cotton tank top arguing with one grown adult man with solid black hair, standing a step apart, no contact."
    ];
    root.textToImagePlugin = (opts) => { captured.push(JSON.parse(JSON.stringify({prompt: String(opts.prompt).slice(0, 4000), negativePrompt: String(opts.negativePrompt || "").slice(0, 2000), resolution: opts.resolution, guidanceScale: opts.guidanceScale}))); return '<div class="t2i-stub"></div>'; };
    for (let i = 0; i < scenes.length; i++) {
      // Clone a real system message so every field the renderer needs exists.
      const tplMsgs = await db.messages.where("threadId").equals(prevActive).filter(m => (m.message || "").indexOf("<image>") >= 0).toArray();
      const tpl = structuredClone(tplMsgs[tplMsgs.length - 1]);
      delete tpl.id;
      tpl.threadId = scratchTid; tpl.message = `<image>${scenes[i]} (img${i}:0)</image>`;
      tpl.order = i; tpl.creationTime = Date.now(); tpl.customData = {}; tpl.variants = [];
      const id = await db.messages.add(tpl);
      createdMsgIds.push(id);
    }
    await window.renderMessageFeed(scratchTid, {forceFullRender: true});
    await new Promise(res => setTimeout(res, 1500));
    t("I0 three prompts captured", captured.length === 3, "got " + captured.length);
    if (captured.length === 3) {
      t("I1 tame prompt opens with scene verbatim", captured[0].prompt.indexOf(scenes[0].replace(/ \(img\d:0\)/g, "")) === 0, captured[0].prompt.slice(0, 120));
      t("I2 tame ownership ban present", /penis on the man/.test(captured[0].negativePrompt), captured[0].negativePrompt.slice(0, 200));
      t("I3 tame contact ban present", /his hand on her ass/.test(captured[0].negativePrompt), "");
      t("I4 tame concealment weighted", /\(exposed penis:1\.5\)/.test(captured[0].negativePrompt), "");
      t("I5 tame dye ban present", /purple streaks/.test(captured[0].negativePrompt), "");
      t("I6 explicit guidance 12", captured[1].guidanceScale === 12, "got " + captured[1].guidanceScale);
      t("I7 explicit resolution 768x512", captured[1].resolution === "768x512", "got " + captured[1].resolution);
      t("I8 womanTop negatives forbid man-on-top", /man on top/.test(captured[1].negativePrompt), "");
      t("I9 plain scene gets generic fallback", /worst quality/.test(captured[2].negativePrompt), captured[2].negativePrompt.slice(0, 120));
    }
  } catch(e) { t("I harness", false, String(e && e.stack || e)); }
  finally {
    root.textToImagePlugin = origPlugin;
    try { for (const id of createdMsgIds) await db.messages.delete(id); } catch(e) {}
    try { if (scratchTid !== null) await db.threads.delete(scratchTid); } catch(e) {}
    try { await window.renderMessageFeed(prevActive, {forceFullRender: true}); } catch(e) {}
  }

  const fails = results.filter(x => !x.pass);
  console.log("IMG PIPELINE TESTS: " + (results.length - fails.length) + "/" + results.length + " pass", fails);
  return {total: results.length, passed: results.length - fails.length, fails};
};

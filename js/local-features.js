import { IMAGINATION, NARRATORS, RESPONSE_LENGTHS, normalizeFeatures, generateCharacterDraft, galleryImages, researchURL, validateUpload } from './feature-state.js';

// UI adapters for working browser-local state and the app's configured text provider.
export function createLocalFeatureUI({ state, store, newCharacter, showModal, escapeHtml: esc, openCharacterEditor, reloadAll, renderHeader, renderSidebar, openLightbox, openAutoTalkSettings, toast }) {
  const $ = (s, r) => r.querySelector(s);
  const options = (values, selected) => values.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const run = fn => async () => { try { await fn(); } catch (e) { toast(e.message || 'Could not save local data.', 'error'); } };
  const current = () => normalizeFeatures(state.thread?.features);
  async function save(patch, threadId = state.thread?.id) {
    if (!threadId) throw new Error('Open a chat first.');
    const thread = await store.getThread(threadId); if (!thread) throw new Error('The chat no longer exists.');
    const updated = { ...thread, features: normalizeFeatures({ ...thread.features, ...patch }) };
    await store.saveThread(updated);
    if (state.thread?.id === threadId) { state.thread = updated; renderHeader(); }
    return updated.features;
  }
  const fields = {
    imagination: { title: '✨ Imagination', select: ['imagination', IMAGINATION], notes: 'Saved for this chat and included in subsequent generated replies.' },
    narrator: { title: '🎭 Narrator', select: ['narrator', NARRATORS], notes: 'Style used by the 🗣️ Narrator shortcut. Does not generate until you request a reply.' },
    length: { title: '📏 Response length', select: ['responseLength', Object.keys(RESPONSE_LENGTHS)], notes: 'Short: 256 tokens; medium: 1,024; long/auto: at most 2,048. A maximum, not a promised word count.' },
    direction: { title: '🎬 Image direction', area: 'imageDirection', notes: 'Appended to image prompts for this chat. Saving this makes no image request.' },
    mind: { title: '🧠 Inner lives', area: 'innerLife', notes: 'Local author notes sent to your configured provider in subsequent character prompts. These are manually controlled, not a hidden autonomous simulation.' },
  };
  function openPanel(kind) {
    if (!state.thread) return toast('Open a chat first.');
    if (kind === 'art') {
      const character = state.characters.find(c => c.id === state.thread.characterIds[0]);
      if (!character) return toast('Add a character first.');
      return showModal({title:'🎨 Art style',body:`<p>Saved on this character and appended to its image prompts. No request is made until you generate an image.</p><input class="input" data-art-style value="${esc(character.imageStyle || '')}" placeholder="e.g. watercolor, soft moonlight">`,footer:'<button data-close>Cancel</button><button data-save-art>💾 save</button>',onMount(root,close){$('[data-save-art]',root).onclick=run(async()=>{const fresh=await store.getCharacter(character.id);if(!fresh)throw new Error('Character no longer exists.');await store.saveCharacter({...fresh,imageStyle:$('[data-art-style]',root).value.slice(0,1000)});await reloadAll();renderHeader();close();});}});
    }
    if (kind === 'freewill') return openAutoTalkSettings();
    if (kind === 'research' || kind === 'image-research') return openResearch(kind === 'image-research');
    const f = current(), id = state.thread.id;
    if (kind === 'needs') {
      return showModal({ title: '🍗💧 Fictional needs', body: `<p>Local, manually controlled character state (0–100). Values influence subsequent replies; no background requests or automatic decay.</p><label><input type="checkbox" data-enabled ${f.needsEnabled ? 'checked' : ''}> Include in character prompts</label>${['hunger', 'thirst', 'energy'].map(k => `<div class="field"><label>${k}<input class="input" type="number" min="0" max="100" data-need="${k}" value="${f[k]}"></label></div>`).join('')}`, footer: '<button data-close>Cancel</button><button data-save-features>💾 save</button>', onMount(root, close) { $('[data-save-features]', root).onclick = run(async () => { const patch = { needsEnabled: $('[data-enabled]', root).checked }; for (const k of ['hunger','thirst','energy']) { const n = Number($(`[data-need="${k}"]`, root).value); if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Needs must be between 0 and 100.'); patch[k] = n; } await save(patch,id); close(); }); } });
    }
    const spec = fields[kind]; if (!spec) throw new Error('Unknown local feature.');
    const input = spec.select ? `<select class="input" data-value>${options(spec.select[1],f[spec.select[0]])}</select>` : `<textarea class="textarea" maxlength="2000" data-value>${esc(f[spec.area])}</textarea>`;
    return showModal({ title: spec.title, body: `<p>${esc(spec.notes)}</p>${input}`, footer: '<button data-close>Cancel</button><button data-save-features>💾 save</button>', onMount(root, close) { $('[data-save-features]',root).onclick = run(async () => { await save({ [spec.area || spec.select[0]]: $('[data-value]',root).value },id); close(); }); } });
  }
  function openResearch(images = false) {
    if (!state.thread) return toast('Open a chat first.');
    const f = current(), id = state.thread.id;
    return showModal({ title: images ? '🔎 Image research' : '🔎 Research', body: `<p>Search opens an external search page. This app does not crawl it or claim live web access. Paste your selected findings and source below; saved notes are sent to your configured provider in subsequent prompts and may be trimmed to fit context.</p><div class="field"><label>Query<input class="input" data-query></label><a data-search target="_blank" rel="noopener noreferrer">🔎 open search results</a></div><div class="field"><label>Source URL<input class="input" data-source value="${esc(f.researchSource)}" placeholder="https://…"></label></div><textarea class="textarea" data-notes maxlength="4000" placeholder="Paste reference notes here">${esc(f.researchNotes)}</textarea>`, footer: '<button data-close>Cancel</button><button data-save-research>💾 save notes</button>', onMount(root, close) {
      $('[data-query]',root).addEventListener('input', e => { const a=$('[data-search]',root); if(e.target.value.trim()) a.href=researchURL(e.target.value,images); else a.removeAttribute('href'); });
      $('[data-save-research]',root).onclick=run(async()=>{const source=$('[data-source]',root).value; if(source && !/^https?:\/\//i.test(source)) throw new Error('Use an http or https source URL.'); await save({researchNotes:$('[data-notes]',root).value,researchSource:source},id);close();});
    } });
  }
  async function openNotes(kind) {
    const key = `local-${kind}`, saved = await window.root.kv.misc.get(key) || '';
    return showModal({ title: kind === 'comments' ? '🙋 Local comments' : '📝 Local feedback', body: `<p>Saved only in this browser. This is a personal notebook, not Perchance community posts or a message to the developer. Use Export to share it yourself.</p><textarea class="textarea" data-local-note maxlength="20000">${esc(saved)}</textarea>`, footer: '<button data-export-note>💾 export</button><button data-close>Cancel</button><button data-save-note>💾 save locally</button>', onMount(root, close) {
      $('[data-save-note]',root).onclick=run(async()=>{await window.root.kv.misc.set(key,$('[data-local-note]',root).value.slice(0,20000));close();toast('Saved locally. Nothing was sent.');});
      $('[data-export-note]',root).onclick=()=>{const url=URL.createObjectURL(new Blob([$('[data-local-note]',root).value],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=`${kind}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
    } });
  }
  async function openGallery() {
    if(!state.thread) return toast('Open a chat first.');
    const id=state.thread.id, uploaded=state.thread.gallery || [], images=galleryImages(state.messages,uploaded);
    return showModal({title:'🖼️ Local gallery',wide:true,body:`<p>Images from this chat and your local uploads, not a Perchance style catalog. Click an image to view it.</p><div class="local-gallery">${images.map((src,i)=>`<button data-gallery-view="${i}"><img src="${esc(src)}" alt="Saved image ${i+1}"></button>`).join('') || '<p>No saved images yet.</p>'}</div><label>Upload image (PNG/JPEG/GIF/WebP, up to 1 MB)<input data-gallery-upload type="file" accept="image/png,image/jpeg,image/gif,image/webp"></label>`,onMount(root,close){
      root.querySelectorAll('[data-gallery-view]').forEach(b=>b.onclick=()=>openLightbox(images[Number(b.dataset.galleryView)]));
      $('[data-gallery-upload]',root).onchange=run(async()=>{const file=$('[data-gallery-upload]',root).files?.[0];validateUpload(file);const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not read the image.'));r.readAsDataURL(file);});const thread=await store.getThread(id);if(!thread)throw new Error('Chat no longer exists.');const gallery=galleryImages([],[...(thread.gallery || []),data]);await store.saveThread({...thread,gallery});if(state.thread?.id===id)state.thread.gallery=gallery;close();toast('Image saved locally.');});
    }});
  }
  function openGenerator() {
    let pending=null;
    return showModal({title:'✨ Generate a character',wide:true,body:`<p>Local template builds an editable draft without a server. AI mode sends your brief to your configured text provider and may incur charges. Nothing is saved until you review and press Save in the editor.</p><div class="field"><label>Name (optional)<input class="input" data-gen-name maxlength="100"></label></div><textarea class="textarea" data-gen-brief maxlength="4000" placeholder="Describe the character, personality and setting"></textarea><div class="field"><label>Generation<select class="input" data-gen-mode><option value="local" selected>Local template — no API request</option><option value="provider">Configured AI provider — may be billed</option></select></label></div><p data-gen-status role="status"></p>`,footer:'<button data-gen-stop disabled>Stop</button><button data-close>Cancel</button><button data-generate-character>✨ generate &amp; review</button>',onClose(){pending?.stop?.();pending=null;},onMount(root,close){
      $('[data-gen-stop]',root).onclick=()=>pending?.stop?.();
      $('[data-generate-character]',root).onclick=run(async()=>{const button=$('[data-generate-character]',root), stop=$('[data-gen-stop]',root),status=$('[data-gen-status]',root);button.disabled=true;stop.disabled=false;status.textContent='Generating…';try{pending=generateCharacterDraft({brief:$('[data-gen-brief]',root).value,name:$('[data-gen-name]',root).value,mode:$('[data-gen-mode]',root).value,generateText:opts=>window.root.generateText(opts)});const draft=await pending;if(!root.isConnected)return;close();openCharacterEditor(newCharacter({...draft,__draft:true}));}catch(e){if(root.isConnected)status.textContent=e.name==='AbortError'?'Generation stopped. Nothing saved.':e.message;}finally{pending=null;if(root.isConnected){button.disabled=false;stop.disabled=true;}}});
    }});
  }
  return { current, save, openPanel, openGallery, openNotes, openGenerator, randomImagination:()=>save({imagination:IMAGINATION[1+Math.floor(Math.random()*(IMAGINATION.length-1))]}) };
}

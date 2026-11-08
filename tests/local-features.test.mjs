import test from 'node:test';
import assert from 'node:assert/strict';
import { fitFeatureInstructions, localCharacterTemplate, generateCharacterDraft, parseGeneratedCharacter, normalizeFeatures, featureInstructions, imageInstructions, responseBudget, researchURL, safeSource, galleryImages, validateUpload } from '../js/feature-state.js';
import { makeKV } from '../js/local-kv.js';
import { createTextAdapter } from '../js/llm.js';
import { requestReply } from '../js/ai.js';

test('local character drafting is real, deterministic, editable and never calls a provider', async()=>{
 let calls=0;const c=await generateCharacterDraft({brief:'A patient astronomer',name:'Mira',generateText:()=>calls++});
 assert.equal(c.name,'Mira');assert.match(c.roleInstruction,/astronomer/);assert.match(c.greeting,/Mira/);assert.equal(calls,0);assert.equal(c.customCode,'');
 assert.throws(()=>localCharacterTemplate(''),/Describe/);
});
test('AI character generation validates JSON and removes executable or storage fields',async()=>{
 let opts;const c=await generateCharacterDraft({mode:'provider',brief:'astronomer',generateText:o=>{opts=o;return Promise.resolve({generatedText:'```json\n{"name":"Mira","roleInstruction":"Study stars","customCode":"evil()","id":"overwrite","avatarUrl":"javascript:bad()","tags":["space"]}\n```'});}});
 assert.equal(opts.maxOutputTokens,2048);assert.equal(c.customCode,'');assert.equal(c.avatarUrl,'');assert.equal(c.id,undefined);assert.deepEqual(c.tags,['space']);
 assert.throws(()=>parseGeneratedCharacter('{"name":"Missing instructions"}'));
});
test('AI character generation Stop propagates and discards a late result',async()=>{
 let done,stops=0;const p=new Promise(r=>done=r);p.stop=()=>stops++;
 const result=generateCharacterDraft({mode:'provider',brief:'test',generateText:()=>p});result.stop();done({generatedText:'{"name":"Late","roleInstruction":"Late"}'});
 await assert.rejects(result,{name:'AbortError'});assert.equal(stops,1);
});
test('imagination, narrator, needs and reference settings change actual prompt instructions',()=>{
 const f=normalizeFeatures({imagination:'surreal',narrator:'cinematic',needsEnabled:true,hunger:40,energy:80,innerLife:'Find a home',researchNotes:'A reference note',researchSource:'https://example.com',responseLength:'short'});
 const text=featureInstructions(f,'system');for(const part of ['surreal','cinematic','hunger 40','Find a home','reference note','https://example.com/'])assert.ok(text.includes(part));
 assert.ok(!featureInstructions(f,'char').includes('Narration style'));assert.equal(responseBudget(f),256);assert.equal(responseBudget({responseLength:'long'}),2048);
 assert.equal(normalizeFeatures({hunger:999,thirst:-1,narrator:'unknown'}).hunger,100);assert.equal(normalizeFeatures({hunger:999,thirst:-1}).thirst,0);
 assert.equal(imageInstructions('a forest',{imageDirection:'moonlight'}),'a forest\nImage direction: moonlight');
});
test('research is explicit external search, safely encoded and never a hidden crawl',()=>{
 assert.equal(researchURL('stars & planets'),'https://duckduckgo.com/?q=stars%20%26%20planets');assert.ok(researchURL('nebula',true).endsWith('&iax=images&ia=images'));
 assert.equal(safeSource('javascript:alert(1)'),'');assert.throws(()=>researchURL(' '));
});
test('local gallery filters unsafe sources, deduplicates and bounds uploads',()=>{
 const img='data:image/png;base64,AAAA';assert.deepEqual(galleryImages([{images:[img,'javascript:bad()','https://example.com/a.png']}],[img]),[img,'https://example.com/a.png']);
 assert.throws(()=>validateUpload({type:'image/svg+xml',size:1}));assert.throws(()=>validateUpload({type:'image/png',size:2000000}));validateUpload({type:'image/png',size:4});
});
test('local persistence survives fresh adapters and never reports quota-failed saves',async()=>{
 const data=new Map();let fail=false;const storage={getItem:k=>data.get(k),setItem:(k,v)=>{if(fail)throw new Error('Quota exceeded');data.set(k,v);}};
 const kv=makeKV(storage);await kv.characters.set('c',{name:'Mira'});const external=await kv.characters.get('c');external.name='Not persisted';assert.equal((await kv.characters.get('c')).name,'Mira');
 assert.equal((await makeKV(storage).characters.get('c')).name,'Mira');fail=true;await assert.rejects(kv.characters.set('c',{name:'Lost'}),/Quota/);assert.equal((await kv.characters.get('c')).name,'Mira');
});
test('length control reaches the provider request but can never raise its configured cap',async()=>{
 const values=new Map([['acc_api_key','test-only-not-a-real-key']]);let body;
 const adapter=createTextAdapter({storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},fetchImpl:async(_,o)=>{body=JSON.parse(o.body);return {ok:true,json:async()=>({choices:[{message:{content:'hello'}}]})};}});
 globalThis.window={root:adapter};
 await requestReply({focusCharacter:{name:'Mira'},characters:[],user:{name:'You'},messages:[],extraInstruction:'Scene imagination: surreal.',maxOutputTokens:256});
 assert.equal(body.max_tokens,256);assert.match(body.messages[0].content,/Scene imagination: surreal/);
 await adapter.generateText({instruction:'x',maxOutputTokens:99999});assert.equal(body.max_tokens,2048);
});

test('optional notes are trimmed to the remaining context budget without altering core prompts',()=>{
 const text='A'.repeat(1000);assert.equal(fitFeatureInstructions(text,20).length,80);assert.equal(fitFeatureInstructions(text,0),'');assert.equal(fitFeatureInstructions('hello',20),'hello');
});

test('source-layout structure keeps scrolling quick controls separate from the floating toolbar',async()=>{
 const {readFileSync}=await import('node:fs');const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 const app=read('../js/app.js'),css=read('../css/perchance-layout.css');
 assert.match(app,/id="messageFeedTopQuickButtonsCtn"/);assert.match(css,/#chatHeader \{ position:absolute/);
 assert.match(app,/background-color:var\(--avatar-bg\)/);assert.ok(!app.includes('background:linear-gradient(140deg'));
 assert.match(css,/\.avatar,\.mini-avatar,\.char-card,\.banner,\.tag \{ border-radius:3px/);
 assert.match(css,/#sidebar \{ box-sizing:border-box; flex:0 0 270px/);
});

test('feature saves remain isolated across threads and late navigation',async()=>{
 const {createLocalFeatureUI}=await import('../js/local-features.js');
 const rows=new Map([['a',{id:'a',features:{innerLife:'A'}}],['b',{id:'b',features:{innerLife:'B'}}]]);
 const state={thread:structuredClone(rows.get('a'))};let renders=0;
 const store={async getThread(id){return structuredClone(rows.get(id));},async saveThread(t){rows.set(t.id,structuredClone(t));}};
 const ui=createLocalFeatureUI({state,store,renderHeader(){renders++;}});
 await ui.save({hunger:40});assert.equal(rows.get('b').features.innerLife,'B');assert.equal(rows.get('a').features.hunger,40);assert.equal(renders,1);
 const pending=ui.save({innerLife:'saved on A'},'a');state.thread=structuredClone(rows.get('b'));await pending;
 assert.equal(rows.get('a').features.innerLife,'saved on A');assert.equal(state.thread.features.innerLife,'B');assert.equal(renders,1);
});

test('toolbar reserves quick-control space, hides empty frames and restores on widening',async()=>{
 const {fitFeatureToolbar,TOOLBAR_DROP_ORDER}=await import('../js/toolbar-layout.js');
 const groups=TOOLBAR_DROP_ORDER.filter(id=>id.endsWith('Ctn')).map(id=>({id,hidden:false}));
 const toolbar={hidden:false,offsetWidth:0,clientWidth:0,querySelector(q){return groups.find(g=>q==='#'+g.id)||null;},querySelectorAll(q){return q==='.threadFeatureGroup'?groups:[];},get scrollWidth(){return 12+groups.filter(g=>!g.hidden).length*50;}};
 const bar={clientWidth:900};
 fitFeatureToolbar(bar,toolbar,170);assert.ok(toolbar.scrollWidth<=171);assert.equal(groups.filter(g=>!g.hidden).length,3);
 fitFeatureToolbar(bar,toolbar,20);assert.equal(toolbar.hidden,true);
 fitFeatureToolbar(bar,toolbar,900);assert.equal(toolbar.hidden,false);assert.equal(groups.filter(g=>!g.hidden).length,7);
});

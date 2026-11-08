// Isolated in-memory DOM tests: no browser, network, provider keys or user storage.
import { createRequire } from 'node:module';
const { parseHTML } = createRequire(import.meta.url)('linkedom');
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('..',import.meta.url));
const read=p=>readFileSync(`${repo}/${p}`,'utf8');
const load=text=>import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
const {window}=parseHTML(read('index.html'));
const {document}=window;
window.location=new URL('https://example.invalid/');
window.innerWidth=1280; window.innerHeight=800;
const folders=new Map();
const kv=new Proxy({}, {get(_,name){if(!folders.has(name))folders.set(name,new Map());const m=folders.get(name);return {get:async k=>structuredClone(m.get(k)),set:async(k,v)=>m.set(k,structuredClone(v)),entries:async()=>structuredClone([...m]),keys:async()=>[...m.keys()],delete:async k=>m.delete(k),deleteMany:async ks=>ks.forEach(k=>m.delete(k))};}});
window.root={kv,config:{seedPresetCharacters:false},stopAllTextGenerations(){}};
globalThis.window=window;
const store=await load(read('js/store.js').replace(/^import[^\n]+\n/m,'const presetCharacters=[];\n'));
const {createAutoTalkController}=await load(read('js/autotalk.js'));
await kv.misc.set('seeded',true);
await kv.misc.set('settings',{...store.DEFAULT_SETTINGS,autoSummarize:false});
const char=store.newCharacter({id:'c',name:'Chloe',greeting:'Hi! 😊'});
const thread=store.newThread(['c'],{id:'t',title:'Test thread'});
await store.saveCharacter(char);await store.saveThread(thread);await store.setMessages('t',[store.newMessage({role:'char',authorId:'c',authorName:'Chloe',content:'Hi! 😊'})]);
let generations=0;
const errors=[];
const escapeHtml=text=>String(text??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const ctx=vm.createContext({window,document,store,...store,createAutoTalkController,presetCharacters:[],escapeHtml,renderMessage:escapeHtml,
  console:{...console,error:e=>errors.push(String(e))},URL,URLSearchParams,DOMException,Blob,performance,
  requestAnimationFrame:fn=>fn(),setTimeout,clearTimeout,navigator:{clipboard:{writeText:async()=>{}}},
  requestReply:async()=>{generations++;return {text:'Offline mock reply'};},extractImageRequest:text=>({text,imagePrompt:null}),
  characterAppearance:()=>'',countTokens:()=>0,idealMaxContextTokens:()=>6952,promptTokenCount:()=>0,
});
const app=read('js/app.js').replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm,'').replace(/^boot\(\);/m,'');
vm.runInContext(app,ctx);
await vm.runInContext('boot()',ctx);
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
assert.equal(errors.length,0,errors.join('\n'));
assert.equal(document.querySelector('#app').hidden,false);
assert.equal(document.querySelector('#loadingOverlay').hidden,true);
assert.ok(document.documentElement.classList.contains('light'));
assert.ok(document.querySelector('#messages').textContent.includes('Hi! 😊'));
assert.equal(document.querySelector('#composerInput').getAttribute('placeholder'),'Type your reply here...');
assert.equal(document.querySelectorAll('#threadFeatureToolbar .threadFeatureGroup').length,7);
assert.equal(generations,0);
console.log('PASS: fresh boot, explicit Light, greeting, composer, seven toolbar groups; no generation on load');
// Actual delegated click handler (not just calling a function) must work.
document.querySelector('[data-action="tips"]').click();await tick();
assert.ok(document.querySelector('[role="dialog"]')?.textContent.includes('Tips'));
document.querySelector('[data-close]').click();
document.querySelector('#settingsBtn').click();await tick();
assert.ok(document.querySelector('.settings-dialog'));
assert.ok(document.querySelector('svg.i'));
document.querySelector('[data-close]').click();
console.log('PASS: delegated emoji actions and Settings dialog open/close without handler errors');
vm.runInContext('state.settings.theme="dark";applySettings()',ctx);
assert.equal(document.documentElement.dataset.theme,'dark');
assert.equal(document.documentElement.classList.contains('light'),false);
vm.runInContext('state.settings.theme="light";applySettings()',ctx);
assert.equal(document.documentElement.classList.contains('light'),true);
const input=document.querySelector('#composerInput');input.value='Unsent draft';
vm.runInContext('renderComposer()',ctx);assert.equal(document.querySelector('#composerInput').value,'Unsent draft');
console.log('PASS: Light/Dark switching and unsent composer draft preservation');
await vm.runInContext('CLICK_ACTIONS["speaker-user"]()',ctx);
assert.equal(vm.runInContext('state.messages.at(-1).role',ctx),'user');
await vm.runInContext('CLICK_ACTIONS["speaker-narrator"]()',ctx);
assert.equal(vm.runInContext('state.messages.at(-1).role',ctx),'system');
await vm.runInContext('CLICK_ACTIONS["speaker-reply"]({dataset:{id:"c"}})',ctx);
assert.equal(vm.runInContext('state.messages.at(-1).role',ctx),'char');
assert.equal(generations,3);assert.equal(errors.length,0,errors.join('\n'));
console.log('PASS: user/character/narrator shortcuts keep correct message roles (mock provider only)');
// The original source shows the search row starting at three threads.
await store.saveThread(store.newThread(['c'],{id:'t2',title:'Forest trip'}));
await store.saveThread(store.newThread(['c'],{id:'t3',title:'City trip'}));
await vm.runInContext('reloadAll();',ctx);vm.runInContext('renderSidebar()',ctx);
assert.equal(document.querySelector('#threadSearchCtn').hidden,false);
const search=document.querySelector('#threadSearchInput');search.value='Forest';search.dispatchEvent(new window.Event('input',{bubbles:true}));
assert.equal(document.querySelectorAll('#threadList [data-action="open-thread"]').length,1);
assert.ok(document.querySelector('#threadList').textContent.includes('Forest trip'));
console.log('PASS: conditional three-thread search and matching thread filter');
document.querySelector('[data-action="thread-menu"]').click();await tick();
assert.ok(document.querySelector('.popover').textContent.includes('auto-talk'));
assert.ok(document.querySelector('.popover button[disabled]'));
assert.equal(errors.length,0,errors.join('\n'));
console.log('PASS: full Options menu exposes unavailable features as disabled, not fake working actions');
console.log('Six DOM integration checks passed. No rendering/pixel-layout claim is made.');

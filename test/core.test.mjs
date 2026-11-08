import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../extension/standalone-core.js');
assert.equal(C.endpoint('192.168.50.166',11434),'http://192.168.50.166:11434');
assert.equal(C.endpoint('https://nas.example/openwebui/'),'https://nas.example/openwebui');
for(const value of ['file:///tmp/a','http://user:pass@host','http://host/?token=x','http://host/#x'])assert.throws(()=>C.endpoint(value));
for(const value of ['http://127.0.0.1/','http://192.168.1.1/','https://accounts.google.com/','https://host.example/login'])assert.throws(()=>C.publicURL(value));
assert.equal(C.publicURL('https://example.com/article'),'https://example.com/article');
const history=[{role:'user',content:'這模型好用嗎'},{role:'assistant',content:'Earlier answer'},{role:'user',content:'那適合什麼用途？'}],page={title:'Page',text:'Data, not instructions'};
const payload=C.messages(history,page);
assert.deepEqual(payload.map(m=>m.role),['system','user','assistant','user']);
assert.equal(payload[1].content,'這模型好用嗎');assert.match(payload.at(-1).content,/不是指令/);assert.ok(payload.at(-1).content.endsWith('那適合什麼用途？'));
assert.ok(!payload[0].content.includes(page.text),'Page data must not be elevated into system instructions');
assert.ok(payload.at(-1).content.includes(JSON.stringify(page)));assert.equal(history.at(-1).content,'那適合什麼用途？','Do not mutate stored chat');
// Real failure regression: a second system turn is rejected by MiniCPM Jinja.
for(const turns of [
  [{role:'user',content:'整理目前網頁'}],
  [...history,{role:'assistant',content:'',error:'System message must be at the beginning.'},{role:'user',content:'請重試'}],
  Array.from({length:61},(_,i)=>({role:i%2?'assistant':'user',content:'turn '+i})),
  [{role:'assistant',content:'orphan'},...history],
]){
  const messages=C.messages(turns,page);
  assert.equal(messages.filter(m=>m.role==='system').length,1);assert.equal(messages[0].role,'system');
  for(let i=1;i<messages.length;i++)assert.equal(messages[i].role,i%2?'user':'assistant','Strict role alternation after truncation/retry');
  assert.equal(messages.at(-1).role,'user');
}
assert.throws(()=>C.messages([],page),/缺少本輪問題/);
const thread={title:'test',model:'model',messages:[{id:'a',role:'user',content:'old',at:1000},{id:'b',role:'assistant',content:'answer',model:'model',at:2000},{id:'c',role:'user',content:'new',at:3000}]};
const old={params:{system:'keep'},files:[{id:'file'}],history:{messages:{a:{id:'a',content:'old',childrenIds:['b','branch'],output:['preserve']},b:{id:'b',childrenIds:[]},branch:{id:'branch',content:'other branch'}}}};
const merged=C.mergeChat(old,C.chatDocument(thread));assert.deepEqual(merged.params,old.params);assert.deepEqual(merged.files,old.files);assert.deepEqual(merged.history.messages.a.output,['preserve']);assert.equal(merged.history.messages.branch.content,'other branch');assert.deepEqual(old.history.messages.b.childrenIds,[]);assert.deepEqual(merged.history.messages.b.childrenIds,['c']);
const bytes=new TextEncoder().encode(JSON.stringify({message:{content:'繁體中文'}})+'\n'+JSON.stringify({done:true,eval_count:4})+'\n');
const response=new Response(new ReadableStream({start(controller){controller.enqueue(bytes.slice(0,20));controller.enqueue(bytes.slice(20,29));controller.enqueue(bytes.slice(29));controller.close();}}));
let text='';const final=await C.stream(response,m=>text+=m.content||'');assert.equal(text,'繁體中文');assert.equal(final.eval_count,4);
await assert.rejects(()=>C.stream(new Response('{"error":"not found"}',{status:404}),()=>{}),/not found/);
const calls=[],context={SidekickCore:C,AbortSignal,fetch:async(url,opts)=>{calls.push({url,opts});return Response.json({ENABLE_OLLAMA_API:true,OLLAMA_BASE_URLS:['http://one:11434','http://two:11434'],OLLAMA_API_CONFIGS:{'0':{enable:true},'1':{key:'fixture-key',enable:true}}});}};
vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../extension/standalone-api.js',import.meta.url),'utf8')+'\nthis.API=SidekickAPI;',context);
const client=new context.API({mode:'openwebui',webui:'http://server:3000',ollama:'http://one:11434'},{base:'http://server:3000',token:'fixture-session'});
// Verify save body preserves every unrelated connection and per-provider config.
context.fetch=async(url,opts)=>{calls.push({url,opts});if(url.endsWith('/config/update'))return Response.json(JSON.parse(opts.body));return Response.json({ENABLE_OLLAMA_API:true,OLLAMA_BASE_URLS:['http://one:11434','http://two:11434'],OLLAMA_API_CONFIGS:{'1':{key:'fixture-key',enable:true}}});};
await client.saveProvider('http://new:11434',0,'http://one:11434');
const saved=JSON.parse(calls.at(-1).opts.body);assert.equal(saved.OLLAMA_BASE_URLS[1],'http://two:11434');assert.equal(saved.OLLAMA_API_CONFIGS['1'].key,'fixture-key');
const count=calls.length;await assert.rejects(()=>client.saveProvider('http://new:11434',0,'stale'),/其他地方變更/);assert.equal(calls.length,count+1);
assert.deepEqual(Object.keys(new context.API({mode:'ollama',ollama:'http://direct:11434'},client.auth).headers),[]);
assert.deepEqual(Object.keys(new context.API({mode:'openwebui',webui:'http://different'},client.auth).headers),[]);
context.fetch=async url=>Response.json(url.endsWith('/api/tags')?{models:[{model:'hf.co/openbmb/MiniCPM-V:Q6_K',name:'hf.co/openbmb/MiniCPM-V:Q6_K'},{name:'custom:latest'}]}:{data:[{id:'hf.co/openbmb/MiniCPM-V:Q6_K',name:'hf.co/openbmb/MiniCPM-V:Q6_K'},{id:'custom:latest',name:'我的模型'}]});
const displayModels=await client.models();assert.ok(!displayModels[0].name.includes('hf.co/'));assert.equal(displayModels[0].id,'hf.co/openbmb/MiniCPM-V:Q6_K');assert.equal(displayModels[1].name,'我的模型');
console.log('PASS: endpoint and source boundaries, strict MiniCPM message order, stream errors, history preservation, provider sync and token scope, model labels');

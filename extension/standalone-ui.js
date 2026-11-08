/* Independent side panel: no iframe, localhost broker, remote script or eval. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),C=SidekickCore;
  const defaults={mode:'openwebui',webui:'http://127.0.0.1:3000',ollama:'http://127.0.0.1:11434'};
  let config={...defaults},auth=null,api,models=[],threads=[],thread=null,controller=null,grant=null,page=null,approval=null,provider=null,renderTimer=null;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const errorText=e=>e.name==='AbortError'?'已停止。':/Failed to fetch|NetworkError/i.test(e.message)?'無法連到來源，請確認 IP、連接埠、服務與網路連線。':e.message;
  function notice(text){$('notice').textContent=text||'';$('notice').hidden=!text;}
  function busy(value){$('send').hidden=value;$('stop').hidden=!value;$('model').disabled=value;$('new-chat').disabled=value;$('settings-button').disabled=value;}
  function scope(){return config.mode+':'+api.base+':'+(config.mode==='openwebui'?auth?.user.id||'guest':'local');}
  async function persist(){await chrome.storage.local.set({sidekickConfig:config,sidekickThreads:threads.slice(0,40),sidekickModel:$('model').value});}
  function fresh(){thread={id:crypto.randomUUID(),scope:scope(),title:'新增對談',messages:[],model:$('model').value,updated:Date.now()};notice('');render();$('prompt').value='';}
  function inline(node,text){
    const re=/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;let at=0;
    for(const m of text.matchAll(re)){node.append(document.createTextNode(text.slice(at,m.index)));const s=m[0];
      if(s[0]==='`')node.append(el('code',s.slice(1,-1)));else if(s.startsWith('**'))node.append(el('strong',s.slice(2,-2)));else{const x=/^\[([^\]]+)\]\((.+)\)$/.exec(s);let u;try{u=new URL(x[2]);}catch{}if(u&&['http:','https:'].includes(u.protocol)&&!u.username&&!u.password){const a=el('a',x[1]);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';node.append(a);}else node.append(document.createTextNode(s));}at=m.index+s.length;}
    node.append(document.createTextNode(text.slice(at)));
  }
  function markdown(node,text){
    node.replaceChildren();const lines=String(text||'').split('\n');let i=0;
    while(i<lines.length){let line=lines[i++];if(!line.trim())continue;
      if(line.startsWith('```')){let code=[];while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);i++;const pre=el('pre');pre.append(el('code',code.join('\n')));node.append(pre);continue;}
      if(line.includes('|')&&i<lines.length&&/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i])&&lines[i].includes('-')){const wrap=el('div',undefined,'table-wrap'),table=el('table');const cells=s=>s.replace(/^\s*\||\|\s*$/g,'').split('|');const tr=el('tr');cells(line).forEach(c=>{const th=el('th');inline(th,c.trim());tr.append(th);});const head=el('thead');head.append(tr);table.append(head);i++;const body=el('tbody');while(i<lines.length&&lines[i].includes('|')){const row=el('tr');cells(lines[i++]).forEach(c=>{const td=el('td');inline(td,c.trim());row.append(td);});body.append(row);}table.append(body);wrap.append(table);node.append(wrap);continue;}
      if(/^#{1,6}\s/.test(line)){const h=el(/^#{1,2}\s/.test(line)?'h2':'h3');inline(h,line.replace(/^#+\s/,''));node.append(h);continue;}
      if(/^\s*(?:[-*]|\d+\.)\s+/.test(line)){const list=el(/^\s*\d/.test(line)?'ol':'ul');do{const li=el('li');inline(li,line.replace(/^\s*(?:[-*]|\d+\.)\s+/,''));list.append(li);line=lines[i];if(!/^\s*(?:[-*]|\d+\.)\s+/.test(line||''))break;i++;}while(i<=lines.length);node.append(list);continue;}
      const p=el('p');inline(p,line);node.append(p);
    }
  }
  function render(){
    const list=$('messages');list.replaceChildren();$('welcome').hidden=!!thread?.messages.length;
    for(const m of thread?.messages||[]){const n=el('article',undefined,'message '+m.role);if(m.role==='assistant')n.append(el('div',m.modelName||'模型','name'));
      if(m.thinking){const d=el('details'),s=el('summary','思考過程');d.append(s,el('pre',m.thinking));n.append(d);}
      const b=el('div',undefined,'body');if(m.role==='user')b.textContent=m.content;else markdown(b,m.content||(m.error?'本次未能產生回答。':'正在處理…'));n.append(b);
      if(m.page){const row=el('div',undefined,'page-link'),a=el('a','網頁：'+m.page.title);a.href=m.page.url;a.target='_blank';a.rel='noopener noreferrer';row.append(a);n.append(row);}
      if(m.metrics)n.append(el('div',m.metrics,'metrics'));if(m.error)n.append(el('p',m.error));
      list.append(n);
    }
    const last=thread?.messages.at(-1);if(!controller&&last?.role==='assistant'&&last.content){const f=el('div',undefined,'followups');for(const text of ['請說明得更白話，並舉例。','請列出目前頁面仍缺少或需要查證的資料。']){const b=el('button',text);b.addEventListener('click',()=>run(text));f.append(b);}list.append(f);}
  }
  function paint(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{const view=$('conversation'),near=view.scrollHeight-view.scrollTop-view.clientHeight<100;render();if(near)view.scrollTop=view.scrollHeight;},80);}
  async function loadModels(){
    notice('正在讀取模型…');models=await api.models();const old=$('model').value|| (await chrome.storage.local.get('sidekickModel')).sidekickModel;
    $('model').replaceChildren();for(const m of models){const o=el('option',m.name);o.value=m.id;$('model').append(o);}
    if(models.some(m=>m.id===old))$('model').value=old;else{const preferred=models.find(m=>/MiniCPM-V.*35B/i.test(m.id));if(preferred)$('model').value=preferred.id;}
    $('connection-dot').classList.toggle('on',models.length>0);$('connection-label').textContent=(config.mode==='openwebui'?'Open WebUI · ':'Ollama · ')+new URL(api.base).host+' · '+models.length+' 個模型';
    notice(models.length?'':'這個來源沒有可用的聊天模型。');await persist();
  }
  function formConfig(){return {mode:$('connection-mode').value,webui:C.endpoint($('webui-url').value,3000),ollama:C.endpoint($('ollama-url').value,11434)};}
  function settingsView(){const sync=$('connection-mode').value==='openwebui';$('webui-fields').hidden=!sync;$('scope-help').textContent=sync?'儲存來源會同步套用到這台 Open WebUI 的網頁與手機 App。':'只儲存這個擴充功能的 Ollama 位址，不需要 Open WebUI。';let target='';try{target=C.endpoint($('webui-url').value||defaults.webui,3000);}catch{}const logged=auth?.base===target;$('login-fields').hidden=logged;$('account').hidden=!logged;if(logged)$('account-name').textContent='已登入：'+(auth.user.name||'Open WebUI 帳號');}
  async function readProvider(){const draft=formConfig(),client=new SidekickAPI(draft,auth);provider=await client.providerConfig();const urls=provider?.OLLAMA_BASE_URLS||[];$('provider-index').replaceChildren();urls.forEach((u,i)=>{const o=el('option',u);o.value=i;$('provider-index').append(o);});$('provider-choice').hidden=urls.length<2;if(urls.length)$('ollama-url').value=urls[0];}
  async function settings(){if(controller)return;$('connection-mode').value=config.mode;$('webui-url').value=config.webui;$('ollama-url').value=config.ollama;$('settings-status').textContent='';settingsView();$('settings').showModal();if(config.mode==='openwebui'&&auth?.base===config.webui)try{await readProvider();}catch(e){$('settings-status').textContent=errorText(e);}}
  function action(id,fn){$(id).addEventListener('click',async()=>{const b=$(id);b.disabled=true;try{await fn();}catch(e){notice(errorText(e));if($('settings').open)$('settings-status').textContent=errorText(e);}finally{b.disabled=false;}});}
  function check(){controller?.signal.throwIfAborted();if(!grant||grant.expires<Date.now())throw Error('這輪分頁授權已結束。');}
  async function inject(action,args={}){check();const tab=await chrome.tabs.get(grant.tabId);if(new URL(tab.url).origin!==grant.origin)throw Error('分頁已離開目前授權的網站。');const results=await chrome.scripting.executeScript({target:{tabId:grant.tabId},injectImmediately:true,func:agentPage,args:[action,{...args,deadline:Date.now()+6000}]});check();return results[0]?.result||{status:'error',message:'頁面沒有回傳結果。'};}
  async function snapshot(){const result=await inject('snapshot');if(result.status!=='ok')throw Error(result.message);page=result;return result;}
  async function capture(){const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});if(!tab?.id||!/^https?:\/\//i.test(tab.url||''))throw Error('請先選取要研究的 http/https 網頁分頁。');grant={tabId:tab.id,origin:new URL(tab.url).origin,expires:Date.now()+30*60000};await inject('enable');return snapshot();}
  async function approve(label,value=''){
    check();$('approval-label').textContent=label;$('approval-value').textContent=value;$('approval-value').hidden=!value;$('approval').hidden=false;
    return new Promise(resolve=>{let timer;const end=ok=>{clearTimeout(timer);controller?.signal.removeEventListener('abort',abort);approval=null;$('approval').hidden=true;resolve(ok);};const abort=()=>end(false);approval=end;controller.signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>end(false),70000);});
  }
  async function publicRead(url,query){
    const tab=await chrome.tabs.create({url,active:false});try{const deadline=Date.now()+15000;while(Date.now()<deadline){check();const info=await chrome.tabs.get(tab.id);C.publicURL(info.url||url);if(info.status==='complete'){const results=await chrome.scripting.executeScript({target:{tabId:tab.id},injectImmediately:true,func:inspectPage,args:[12000,query?6:0]});const r=results[0]?.result;if(/captcha|verify you are human|privacy error|security check|unusual traffic/i.test((r?.title||'')+' '+(r?.text||'').slice(0,1500)))return {status:'human_required',message:'網站要求真人驗證，未取得資料。'};if(r&&(!query||r.results?.length))return {status:'ok',...r};}await new Promise(r=>setTimeout(r,250));}return {status:'error',message:'公開網頁讀取逾時。'};}finally{await chrome.tabs.remove(tab.id).catch(()=>{});}}
  async function tool(call){
    const name=call.function?.name;let a=call.function?.arguments||{};if(typeof a==='string')a=JSON.parse(a);check();
    if(name==='browser_snapshot')return snapshot();
    if(name==='browser_scroll'){if(!Number.isInteger(a.delta)||Math.abs(a.delta)>2000)throw Error('捲動距離不符。');const r=await inject('scroll',a);if(r.status==='ok')r.current_page=await snapshot();return r;}
    if(name==='browser_click'||name==='browser_type'){
      if(!page||a.snapshot!==page.snapshot)return {status:'error',message:'這是舊快照，未執行動作；請用 current_page 的新編號。',current_page:await snapshot()};
      if(name==='browser_type'&&(typeof a.value!=='string'||a.value.length>4000))throw Error('輸入文字最多 4000 字。');
      const d=await inject('describe',a);if(d.status!=='ok')return d;
      if(!await approve((name==='browser_type'?'填入文字：':'點擊：')+d.label,a.value||d.target))return {status:'human_required',message:'使用者已拒絕或停止，未執行。'};
      const r=await inject(name==='browser_type'?'type':'click',a);if(r.status==='ok'){await new Promise(r=>setTimeout(r,350));r.current_page=await snapshot();}return r;
    }
    if(name==='browser_navigate'){const u=new URL(a.url);if(u.origin!==grant.origin||!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('只能在目前授權網站內導覽。');if(!await approve('開啟頁面',u.href))return {status:'human_required',message:'使用者已拒絕，未導覽。'};check();await chrome.tabs.update(grant.tabId,{url:u.href});await new Promise(r=>setTimeout(r,500));return {status:'ok',current_page:await snapshot()};}
    if(name==='google_search'){if(typeof a.query!=='string'||!a.query.trim()||a.query.length>300)throw Error('搜尋詞長度不符。');if(!await approve('以 Google 搜尋公開資料',a.query))return {status:'human_required',message:'使用者已拒絕搜尋。'};return publicRead('https://www.google.com/search?hl=zh-TW&q='+encodeURIComponent(a.query),a.query);}
    if(name==='read_public_url'){const url=C.publicURL(a.url);if(!await approve('讀取公開來源',url))return {status:'human_required',message:'使用者已拒絕讀取。'};return publicRead(url);}
    return {status:'error',message:'不支援這個工具。'};
  }
  async function run(text){
    text=String(text||'').trim();if(!text||controller)return;if(!$('model').value){notice('請先到設定連接模型來源。');await settings();return;}
    controller=new AbortController();busy(true);notice('');const started=performance.now();let answer;
    try{
      $('page-state').textContent='正在讀取目前網頁…';const captured=await Promise.race([capture(),new Promise((_,reject)=>setTimeout(()=>reject(Error('目前網頁讀取逾時，尚未送出。')),8000))]);controller.signal.throwIfAborted();$('page-state').textContent='已讀：'+captured.title;
      if(!thread||thread.scope!==scope())fresh();thread.model=$('model').value;const model=models.find(m=>m.id===thread.model);if(!thread.messages.length)thread.title=text.slice(0,32);
      thread.messages.push({id:crypto.randomUUID(),role:'user',content:text,at:Date.now(),page:{url:captured.url,title:captured.title}});
      answer={id:crypto.randomUUID(),role:'assistant',content:'',thinking:'',at:Date.now(),model:thread.model,modelName:model?.name||thread.model};thread.messages.push(answer);$('prompt').value='';render();$('conversation').scrollTop=$('conversation').scrollHeight;
      const history=C.messages(thread.messages.slice(0,-1),captured);let info={};try{info=await api.show(thread.model);}catch{}let totalTokens=0,totalEval=0,denied=false,completed=false;
      for(let round=0;round<6;round++){
        const calls=[];let part='',thought='';const body={model:thread.model,messages:history,stream:true,think:false,options:{temperature:0.35,num_predict:2200},...(info.capabilities?.includes('tools')&&!denied?{tools:C.tools}:{})};
        const response=await api.completion(body,AbortSignal.any([controller.signal,AbortSignal.timeout(180000)]));
        const stats=await C.stream(response,m=>{if(m.content){part+=m.content;answer.content+=m.content;paint();}if(m.thinking){thought+=m.thinking;answer.thinking+=m.thinking;paint();}if(m.tool_calls)calls.push(...m.tool_calls);});
        totalTokens+=stats.eval_count||0;totalEval+=stats.eval_duration||0;
        if(!calls.length){completed=true;break;}
        history.push({role:'assistant',content:part,tool_calls:calls});if(part)answer.content+='\n\n';
        for(const call of calls.slice(0,3)){let result;try{result=denied?{status:'human_required',message:'先前操作已被拒絕，不再執行其他動作。'}:await tool(call);}catch(e){controller.signal.throwIfAborted();result={status:'error',message:errorText(e)};}if(result.status==='human_required')denied=true;history.push({role:'tool',tool_name:call.function.name,content:JSON.stringify(result)});}
      }
      if(!completed)answer.content+='\n\n已達本輪工具次數上限，請接續提問。';
      answer.metrics=(totalEval?((totalTokens/(totalEval/1e9)).toFixed(1)+' tokens/s · '):'')+'耗時 '+((performance.now()-started)/1000).toFixed(1)+' 秒';
      if(!answer.content.trim())answer.content='模型沒有回傳正文，請換一個模型重試。';
    }catch(e){if(answer)answer.error=errorText(e);else notice(errorText(e));}
    finally{if(approval)approval(false);grant=null;page=null;if(thread?.messages.length){thread.updated=Date.now();threads=[thread,...threads.filter(t=>t.id!==thread.id)].slice(0,40);try{await api.saveChat(thread);}catch(e){notice('回答已保留在擴充功能；同步尚未完成：'+errorText(e));}await persist();}controller=null;busy(false);render();}
  }
  async function history(){
    if(controller)return;const list=$('history-list');list.replaceChildren();$('history').showModal();
    const add=(title,detail,fn)=>{const b=el('button',title);b.append(el('small',detail));b.addEventListener('click',async()=>{try{await fn();$('history').close();render();}catch(e){notice(errorText(e));}});list.append(b);};
    threads.filter(t=>t.scope===scope()).forEach(t=>add(t.title,new Date(t.updated).toLocaleString('zh-TW'),()=>{thread=t;if(models.some(m=>m.id===t.model))$('model').value=t.model;}));
    if(config.mode==='openwebui'&&auth?.base===config.webui)try{const remote=await api.request('/api/v1/chats/list?page=1');for(const item of remote.filter(x=>!threads.some(t=>t.remoteId===x.id)))add(item.title,'Open WebUI 對談',async()=>{const data=await api.request('/api/v1/chats/'+encodeURIComponent(item.id)),chat=data.chat;let rows=chat.messages||[];const graph=chat.history?.messages;if(graph&&chat.history.currentId){rows=[];let id=chat.history.currentId;for(let n=0;id&&n<200;n++){const row=graph[id];if(!row)break;rows.unshift(row);id=row.parentId;}}thread={id:crypto.randomUUID(),scope:scope(),title:data.title||chat.title,remoteId:data.id,remoteUpdated:data.updated_at,remoteHead:chat.history?.currentId,model:chat.models?.[0]||$('model').value,messages:rows.filter(m=>['user','assistant'].includes(m.role)).map(m=>({...m,at:(m.timestamp||Date.now()/1000)*1000,page:m.meta?.extension_page,modelName:m.modelName||C.compactName(m.model)})),updated:Date.now()};if(models.some(m=>m.id===thread.model))$('model').value=thread.model;});}catch(e){list.append(el('p',errorText(e)));}
    if(!list.childNodes.length)list.append(el('p','還沒有對談。'));
  }
  $('composer').addEventListener('submit',e=>{e.preventDefault();run($('prompt').value);});$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();run($('prompt').value);}});
  action('settings-button',settings);action('reload-models',loadModels);action('new-chat',fresh);action('history-button',history);
  action('close-settings',()=>{$('settings').close();$('login-password').value='';});action('close-history',()=>{$('history').close();});
  action('stop',()=>{controller?.abort();approval?.(false);});action('allow',()=>approval?.(true));action('deny',()=>approval?.(false));
  $('connection-mode').addEventListener('change',()=>{provider=null;$('provider-choice').hidden=true;settingsView();});$('webui-url').addEventListener('change',()=>{provider=null;settingsView();});$('provider-index').addEventListener('change',()=>{$('ollama-url').value=provider.OLLAMA_BASE_URLS[Number($('provider-index').value)];});
  action('login-button',async()=>{const draft=formConfig(),client=new SidekickAPI(draft,null);$('settings-status').textContent='登入中…';try{auth=await client.login($('login-email').value.trim(),$('login-password').value);await chrome.storage.session.set({sidekickAuth:auth});settingsView();await readProvider();$('settings-status').textContent='已登入並讀取伺服器來源。';}finally{$('login-password').value='';}});
  action('logout',async()=>{auth=null;provider=null;api=new SidekickAPI(config,null);await chrome.storage.session.remove('sidekickAuth');if(config.mode==='openwebui'){models=[];$('model').replaceChildren(el('option','請先登入來源'));$('connection-dot').classList.remove('on');$('connection-label').textContent='尚未登入';fresh();}settingsView();$('settings-status').textContent='已登出。';});
  action('test-source',async()=>{const draft=formConfig(),client=new SidekickAPI(draft,auth);$('settings-status').textContent='測試連線中…';const result=await client.verify(draft.ollama);$('settings-status').textContent='連線成功 · Ollama '+(result.version||'已回應');});
  $('settings-form').addEventListener('submit',async e=>{e.preventDefault();const button=$('save-settings');button.disabled=true;try{const draft=formConfig(),client=new SidekickAPI(draft,auth);$('settings-status').textContent='核對來源中…';await client.verify(draft.ollama);if(draft.mode==='openwebui'){if(!provider)throw Error('請先登入並讀取伺服器來源。');const index=Number($('provider-index').value||0);await client.saveProvider(draft.ollama,index,provider.OLLAMA_BASE_URLS[index]);}const switched=scope()!==draft.mode+':'+client.base+':'+(draft.mode==='openwebui'?auth?.user.id||'guest':'local');config=draft;api=client;if(switched)fresh();await loadModels();await persist();$('settings-status').textContent='已儲存並載入 '+models.length+' 個模型。';}catch(error){$('settings-status').textContent=errorText(error);}finally{button.disabled=false;}});
  $('model').addEventListener('change',()=>persist());
  for(const s of C.starters){const b=el('button',s.title);b.append(el('small',s.detail));b.addEventListener('click',()=>run(s.content));$('starters').append(b);}
  async function start(){const [local,session]=await Promise.all([chrome.storage.local.get(['sidekickConfig','sidekickThreads']),chrome.storage.session.get('sidekickAuth')]);config={...defaults,...local.sidekickConfig};auth=session.sidekickAuth||null;threads=local.sidekickThreads||[];api=new SidekickAPI(config,auth);fresh();try{await loadModels();}catch(e){notice(errorText(e));await settings();}}
  start().catch(e=>notice(errorText(e)));
})();

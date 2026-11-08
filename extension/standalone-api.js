/* Network requests are limited to the user-selected provider. Passwords are
 * never stored; login tokens live only in browser-session storage. */
class SidekickAPI {
  constructor(config,auth){this.config=config;this.auth=auth;}
  get base(){return this.config.mode==='openwebui'?this.config.webui:this.config.ollama;}
  get headers(){return this.config.mode==='openwebui'&&this.auth?.base===this.config.webui?{Authorization:'Bearer '+this.auth.token}:{};}
  async request(path,data,options={}){
    const response=await fetch(this.base+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...this.headers},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:options.signal||AbortSignal.timeout(15000),credentials:'omit',redirect:'error',cache:'no-store'});
    if(options.stream)return response;
    let result;try{result=await response.json();}catch{throw Error('來源未回傳 JSON，請確認 IP、連接埠及服務類型。');}
    if(!response.ok)throw Error(response.status===401?'請先登入這台 Open WebUI。':response.status===403?'目前帳號沒有這項設定的管理權限。':typeof result?.detail==='string'?result.detail:result?.error||'來源連線失敗（HTTP '+response.status+'）');
    return result;
  }
  async login(email,password){
    const response=await fetch(this.config.webui+'/api/v1/auths/signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000),credentials:'omit',redirect:'error'});
    const data=await response.json();if(!response.ok||!data.token)throw Error('登入失敗，請確認這台 Open WebUI 的帳號與密碼。');
    this.auth={base:this.config.webui,token:data.token,user:{id:data.id,name:data.name,role:data.role}};return this.auth;
  }
  async models(){
    const tagData=await this.request((this.config.mode==='openwebui'?'/ollama':'')+'/api/tags');
    let names={};if(this.config.mode==='openwebui'){const visible=await this.request('/api/models');names=Object.fromEntries((visible.data||[]).map(x=>[x.id,x.name]));}
    return (tagData.models||[]).filter(m=>!/(?:embed|rerank|asr|whisper)/i.test(m.name||m.model)).map(m=>{const id=m.model||m.name,label=names[id];return {id,name:label&&label!==id&&!label.startsWith('hf.co/')?label:SidekickCore.compactName(m.name||id),details:m.details||{}};});
  }
  async show(model){return this.request((this.config.mode==='openwebui'?'/ollama':'')+'/api/show',{model});}
  async version(){return this.request('/api/version');}
  async providerConfig(){if(this.config.mode!=='openwebui')return null;return this.request('/ollama/config');}
  async verify(url){if(this.config.mode==='openwebui')return this.request('/ollama/verify',{url});return new SidekickAPI({...this.config,ollama:url},null).version();}
  async saveProvider(url,index,expected){
    const config=await this.providerConfig();if(config.OLLAMA_BASE_URLS?.[index]!==expected)throw Error('來源已由其他地方變更，請重新讀取設定。');
    const urls=[...(config.OLLAMA_BASE_URLS||[])];urls[index]=url;
    const saved=await this.request('/ollama/config/update',{...config,OLLAMA_BASE_URLS:urls});
    if(saved.OLLAMA_BASE_URLS?.[index]!==url)throw Error('伺服器沒有儲存這個來源。');return saved;
  }
  async completion(body,signal){return this.request((this.config.mode==='openwebui'?'/ollama':'')+'/api/chat',body,{stream:true,signal});}
  async saveChat(thread){
    if(this.config.mode!=='openwebui')return;
    let document=SidekickCore.chatDocument(thread);
    if(thread.remoteId){const current=await this.request('/api/v1/chats/'+encodeURIComponent(thread.remoteId));if((thread.remoteUpdated&&current.updated_at!==thread.remoteUpdated)||(thread.remoteHead&&current.chat.history?.currentId!==thread.remoteHead)){thread.remoteId=null;document.title+='（擴充功能接續）';}else document=SidekickCore.mergeChat(current.chat,document);}
    const saved=await this.request('/api/v1/chats/'+(thread.remoteId?encodeURIComponent(thread.remoteId):'new'),{chat:document});thread.remoteId=saved.id;thread.remoteUpdated=saved.updated_at;thread.remoteHead=document.history.currentId;
  }
}

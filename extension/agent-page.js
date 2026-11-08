// Serialized by chrome.scripting into the isolated extension world. No model JS/selectors.
function agentPage(action, args = {}) {
  const visible = el => !!el?.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const label = el => (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.labels?.[0]?.innerText || el.innerText || el.getAttribute('title') || el.getAttribute('name') || el.tagName).trim().slice(0, 200);
  const sensitive = el => /password|file|hidden/i.test(el.type || '') || /password|passwd|credit|cc-|card.?number|cvv|cvc|one.?time|otp|verification|密碼|信用卡|驗證碼/i.test([el.autocomplete, el.name, el.id, label(el)].join(' '));
  const fingerprint = el => JSON.stringify([el.tagName, el.type, label(el), el.getAttribute('href'), el.form?.action]);
  let state = globalThis.__owuiSharedAgent;
  if (!state) {
    state = globalThis.__owuiSharedAgent = {paused: false, refs: new Map(), snapshot: ''};
    const takeover = event => { if (event.isTrusted) { state.paused = true; state.refs.clear(); } };
    document.addEventListener('pointerdown', takeover, true);
    document.addEventListener('keydown', takeover, true);
  }
  if (action === 'enable') { state.paused = false; state.refs.clear(); return {status: 'ok'}; }
  if (args.deadline && Date.now() > args.deadline) return {status:'human_required',message:'動作已超過執行期限，未執行。'};
  if (state.paused) return {status: 'human_required', message: '偵測到你正在操作分頁。請在側邊欄重新分享後繼續。'};
  const blocked = /captcha|security check|privacy error|verify you are human|驗證您是真人|連線不是私人連線/i.test(document.title + ' ' + (document.body?.innerText || '').slice(0, 1500));
  if (blocked) return {status: 'human_required', message: '頁面需要真人驗證或處理安全提示，請自行接手。'};
  if (action === 'snapshot') {
    state.snapshot = crypto.randomUUID().replaceAll('-', ''); state.refs.clear();
    const elements = [];
    for (const el of document.querySelectorAll('a[href],button,input,textarea,select,[role="button"],[role="textbox"],[contenteditable="true"]')) {
      if (!visible(el) || sensitive(el) || el.disabled || elements.length >= 120) continue;
      const ref = 'e' + (elements.length + 1), name = label(el);
      state.refs.set(ref, {el, fingerprint: fingerprint(el)});
      elements.push({ref, role: el.getAttribute('role') || el.tagName.toLowerCase(), label: name,
        kind: el.type || el.tagName.toLowerCase()});
    }
    return {status: 'ok', snapshot: state.snapshot, title: document.title, url: location.href,
      text: (document.querySelector('main,article,[role="main"]') || document.body)?.innerText.slice(0, 16000) || '', elements};
  }
  if (action === 'scroll') { window.scrollBy({top: args.delta, behavior: 'instant'}); state.refs.clear(); return {status: 'ok', message: '已捲動，請重新讀取頁面。'}; }
  if (args.snapshot !== state.snapshot) return {status: 'error', message: '頁面快照已過期，請重新讀取。'};
  const entry = state.refs.get(args.ref), el = entry?.el;
  if (!visible(el) || el.disabled || sensitive(el) || fingerprint(el) !== entry.fingerprint)
    return {status: 'error', message: '元素已變動或無法操作，請重新讀取頁面。'};
  if (action === 'describe') return {status: 'ok', label: label(el), target: el.getAttribute('href') || el.form?.action || '', kind: el.type || el.tagName.toLowerCase()};
  if (action === 'click') {
    const target = el.closest('a[href]');
    if (target && (new URL(target.href).origin !== location.origin || target.target === '_blank' || target.hasAttribute('download')))
      return {status: 'human_required', message: '此連結會離開授權網站、開啟新分頁或下載。請自行開啟並分享新頁面。'};
    if (el.form?.action && new URL(el.form.action).origin !== location.origin)
      return {status: 'human_required', message: '表單會送至另一個網站，請自行接手。'};
    state.refs.clear(); el.click(); return {status: 'ok', message: '已執行你核准的點擊。請重新讀取頁面確認結果。'};
  }
  if (action === 'type') {
    if (!el.matches('input,textarea,[contenteditable="true"]')) return {status: 'error', message: '這個元素不是文字輸入欄位。'};
    el.focus();
    if (el.isContentEditable) el.textContent = args.value;
    else {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, args.value);
    }
    el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true}));
    state.refs.clear(); return {status: 'ok', message: '已填入你核准的文字，尚未自動送出。請重新讀取頁面。'};
  }
  return {status: 'error', message: '不支援的頁面操作。'};
}

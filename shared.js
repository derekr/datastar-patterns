// Shared backend-fake + tour shell for the Datastar patterns pages.
// Classic script (no modules): defines window.DS and window.TourShell.
//
// The fake backend is a REGISTRY: path -> async (signals, H) => SSE string | Response.
// Steps with a `handler.js` tab show the registration source; evaluating it
// registers the real handler. Displayed code == running code.
window.DS = window.DS || {};
(function(){
"use strict";
const DS = window.DS;

// ---------------- App helpers (sync in, value out / async via events) ----------------
DS.App = {
  slugify(s){ return String(s??'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); },
  wordCount(s){ const t = String(s??'').trim(); return t ? t.split(/\s+/).length : 0; },
  shout(s){ return String(s??'').toUpperCase() + '!'; },
  async fakeLookup(el, q){
    const v = String(q??'');
    await new Promise(r=>setTimeout(r,350));
    el.dispatchEvent(new CustomEvent('fakelookup',{bubbles:true, detail:{label: v ? `“${v}” → ${v.length} chars, reversed: ${[...v].reverse().join('')}` : '(empty)'}}));
  }
};
window.App = DS.App;

// ---------------- SSE primitives ----------------
const CONTACTS = [["Norwood","Hills"],["Jessika","Buckridge"],["Lawrence","Herzog"],["Peyton","Rippin"],["Justina","Farrell"],["Kaleb","Beier"],["Jeffrey","Luettgen"],["Melisa","Runte"],["Rosetta","Kuhic"],["Kadin","White"],["Ada","Lovelace"],["Grace","Hopper"]];
DS.CONTACTS = CONTACTS;
// mutable "server" state, shared by built-ins and handler-tab code via H.srv
const SRV = {count:0, tick:0, down:false, tickTimer:null};

function sse(...blocks){ return blocks.join('\n\n') + '\n\n'; }
function sseResp(body, ms=0){
  return new Promise(res=>setTimeout(()=>res(new Response(body,{status:200,headers:{'Content-Type':'text/event-stream'}})), ms));
}
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
const patchEl = (selector, html)=>`event: datastar-patch-elements\ndata: selector ${selector}\ndata: mode inner\ndata: elements ${html}`;
const patchSig = obj=>`event: datastar-patch-signals\ndata: signals ${JSON.stringify(obj)}`;

// Open streams (ReadableStream) so re-renders can close them.
const openStreams = new Set();
function closeStream(reg){
  if(reg.closed) return;
  reg.closed = true;
  (reg.timers||[]).forEach(t=>{ clearInterval(t); clearTimeout(t); });
  try{ reg.controller && reg.controller.close(); }catch{}
  openStreams.delete(reg);
}
DS.closeStreams = ()=>{ [...openStreams].forEach(closeStream); };
function streamResp(setup){
  const reg = {closed:false, timers:[], controller:null};
  const stream = new ReadableStream({
    start(c){
      reg.controller = c;
      const enc = new TextEncoder();
      const write = txt =>{ if(!reg.closed){ try{ c.enqueue(enc.encode(txt)); }catch{} } };
      const every = (ms,fn)=>{ const t=setInterval(()=>{ if(!reg.closed) fn(); },ms); reg.timers.push(t); return t; };
      const after = (ms,fn)=>{ const t=setTimeout(()=>{ if(!reg.closed) fn(); },ms); reg.timers.push(t); return t; };
      try{ setup(write, {every, after, close:()=>closeStream(reg)}); }catch(e){ closeStream(reg); }
    },
    cancel(){ closeStream(reg); }
  });
  openStreams.add(reg);
  return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});
}

// Handler context: everything tab code may touch.
const H = {
  sse, esc, patchEl, patchSig,
  wait: ms=>new Promise(r=>setTimeout(r,ms)),
  stream: setup=>streamResp(setup),
  srv: SRV,
};
DS.H = H;

// ---------------- endpoint registry ----------------
const registry = new Map();
DS.handle = (path, fn)=>{ registry.set(path, fn); };
// Built-ins with no editor tab (trivial one-patch endpoints).
DS.handle('/api/inc', async ()=>sseResp(sse(`event: datastar-patch-elements\ndata: elements <div id="s5_counter">${++SRV.count} (from server)</div>`), 150));
DS.handle('/api/reset', async ()=>sseResp(sse(`event: datastar-patch-elements\ndata: elements <div id="s5_counter">0 (from server)</div>`), 150));
DS.handle('/api/slow', async ()=>sseResp(sse(patchEl('#s6_out', `<strong>Done at ${new Date().toLocaleTimeString()} — patched by backend.</strong>`)), 900));

// Compile handler-tab source. Scope: handle(), H, CONTACTS. Returns {error?}.
DS.compileHandler = code=>{
  try{
    const fn = new Function('handle','H','CONTACTS', code);
    return {fn};
  }catch(e){ return {error: String((e && e.message) || e)}; }
};
// Evaluate (runs the handle() registrations). Returns {error?}.
DS.runHandlerCode = code=>{
  const c = DS.compileHandler(code);
  if(c.error) return c;
  try{ c.fn(DS.handle, H, CONTACTS); return {}; }
  catch(e){ return {error: String((e && e.message) || e)}; }
};

function readSignalsFrom(urlStr, bodyText){
  try{
    if(bodyText){ return JSON.parse(bodyText); }
    const u = new URL(urlStr, location.href);
    const d = u.searchParams.get('datastar');
    return d ? JSON.parse(d) : {};
  }catch{ return {}; }
}

async function fakeBackend(urlStr, bodyText){
  const path = new URL(urlStr, location.href).pathname;
  if(!registry.has(path)) return null;
  const sig = readSignalsFrom(urlStr, bodyText);
  try{
    const out = await registry.get(path)(sig, H);
    if(typeof out === 'string')
      return new Response(out,{status:200,headers:{'Content-Type':'text/event-stream'}});
    return out;
  }catch(e){
    console.warn('[shim]', path, e);
    return new Response(sse(patchSig({})),{status:200,headers:{'Content-Type':'text/event-stream'}});
  }
}

// fetch shim: string | URL | Request, GET query or JSON body signals
let shimInstalled = false;
DS.installShim = ()=>{
  if(shimInstalled) return;
  shimInstalled = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async function(input, init){
    let urlStr = '';
    if(typeof input === 'string') urlStr = input;
    else if(input instanceof URL) urlStr = input.href;
    else if(input instanceof Request) urlStr = input.url;
    if(urlStr){
      let path = '';
      try{ path = new URL(urlStr, location.href).pathname; }catch{}
      if(path.startsWith('/api/')){
        let bodyText = init?.body;
        if(typeof bodyText !== 'string' && input instanceof Request){
          try{ bodyText = await input.clone().text(); }catch{ bodyText = ''; }
        }
        if(bodyText instanceof URLSearchParams) bodyText = bodyText.toString();
        const r = await fakeBackend(urlStr, typeof bodyText === 'string' ? bodyText : '');
        if(r) return r;
      }
    }
    return realFetch(input, init);
  };
};

// ---------------- cross-window bus (CQRS section) ----------------
DS.bus = (()=>{
  const id = 'w-' + Math.random().toString(36).slice(2,7);
  let bc = null;
  try{ bc = new BroadcastChannel('dsp-patterns'); }catch{}
  const handlers = {};
  const api = {
    id,
    send(msg){ try{ bc && bc.postMessage({from:id, ...msg}); }catch{} },
    on(kind, fn){ (handlers[kind] = handlers[kind] || []).push(fn); },
    receive(kind, msg){ (handlers[kind]||[]).forEach(fn=>{ try{ fn(msg); }catch(e){ console.warn(e); } }); },
  };
  if(bc) bc.onmessage = ev=>{
    const m = ev.data || {};
    if(m.from === id) return;
    api.receive(m.kind, m);
  };
  return api;
})();
// Route a "server event" into Datastar via hidden data-on listeners.
DS.dispatch = (name, detail)=>{ document.dispatchEvent(new CustomEvent(name, {detail})); };
DS.esc = esc;

// ---------------- web component ----------------
DS.defineColorPicker = ()=>{
  if(customElements.get('color-picker')) return;
  class ColorPicker extends HTMLElement {
    static get observedAttributes(){ return ['value']; }
    constructor(){
      super();
      this.attachShadow({mode:'open'});
      this._v = '#00a4cc';
      this.shadowRoot.innerHTML = `<style>
        :host{display:block;font-size:13px} .row{display:flex;gap:8px;align-items:center;margin:4px 0}
        input[type=range]{flex:1} .prev{width:100%;height:34px;border-radius:8px;border:1px solid #cbd5e1}
        code{font-family:ui-monospace,monospace}</style>
        <div class="prev"></div>
        <div class="rows"></div>
        <div>hex: <code></code></div>`;
    }
    attributeChangedCallback(n,o,v){ if(v && v!==this._v){ this._v = v; this.render(); } }
    connectedCallback(){ this.render(); }
    #rgb(){ const h=this._v.replace('#',''); const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);
      return {r:(n>>16)&255, g:(n>>8)&255, b:n&255}; }
    render(){
      const {r,g,b} = this.#rgb();
      const root = this.shadowRoot;
      root.querySelector('.prev').style.background = this._v;
      root.querySelector('code').textContent = this._v;
      const rows = root.querySelector('.rows');
      rows.innerHTML = '';
      [['r',r,'#e11d48'],['g',g,'#16a34a'],['b',b,'#2563eb']].forEach(([k,val,c])=>{
        const row = document.createElement('div'); row.className='row';
        row.innerHTML = `<b style="color:${c};width:12px">${k}</b>`;
        const inp = document.createElement('input');
        inp.type='range'; inp.min=0; inp.max=255; inp.value=val;
        inp.oninput = ()=>{
          const cur = this.#rgb(); cur[k]=+inp.value;
          const hex = '#'+[cur.r,cur.g,cur.b].map(v=>v.toString(16).padStart(2,'0')).join('');
          this._v = hex;
          this.dispatchEvent(new CustomEvent('color-input',{bubbles:true, composed:true, detail:{value:hex}}));
          this.shadowRoot.querySelector('.prev').style.background = hex;
          this.shadowRoot.querySelector('code').textContent = hex;
        };
        row.appendChild(inp);
        const n = document.createElement('span'); n.textContent = val; n.style.width='28px'; n.style.textAlign='right';
        row.appendChild(n);
        rows.appendChild(row);
      });
    }
  }
  customElements.define('color-picker', ColorPicker);
};

// ---------------- tour shell ----------------
window.TourShell = {
  init({steps, hashPrefix='tour-'}){
    const nav = document.getElementById('nav');
    const pill = document.getElementById('stepPill');
    const left = document.getElementById('stepLeft');
    const preview = document.getElementById('preview');
    const inspectorPre = document.getElementById('inspectorPre');
    let cur = 0;

    const editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
      mode: 'htmlmixed', theme: 'gruvbox-dark', lineNumbers: true,
    });
    // tab bar + handler status, inserted around the editor (pages stay thin)
    const tabsBar = document.createElement('div');
    tabsBar.className = 'etabs';
    editor.getWrapperElement().before(tabsBar);
    const statusLine = document.createElement('div');
    statusLine.className = 'estatus';
    statusLine.style.display = 'none';
    editor.getWrapperElement().after(statusLine);
    const previewErr = document.createElement('div');
    previewErr.className = 'banner off';
    previewErr.style.display = 'none';
    previewErr.style.marginBottom = '12px';
    preview.before(previewErr);

    // per-step file buffers; js default read from text/plain blocks (no escaping issues)
    steps.forEach(s=>{
      s._html = s.code;
      s._js = s.hsrc ? (document.getElementById(s.hsrc)?.textContent ?? '').replace(/^\n+|\s+$/g,'') : null;
      s._file = 'demo.html';
      s._err = null;
    });

    steps.forEach((s,i)=>{
      const b = document.createElement('button');
      b.innerHTML = `<span class="n">${i+1}</span><span><strong>${i+1}. ${s.title}</strong><small>${s.sub}</small></span>`;
      b.onclick = ()=>go(i);
      nav.appendChild(b);
    });
    const built = document.createElement('div');
    built.className = 'built';
    built.innerHTML = `★ Built with Datastar<a href="https://github.com/derekr/datastar-patterns" target="_blank" rel="noopener">View on GitHub ↗</a>`;
    nav.appendChild(built);

    // inlay-hint chips: bookmark widgets after each $signal, values from inspector JSON
    let hints = [];
    const readSignals = ()=>{ try{ return JSON.parse(inspectorPre.textContent); }catch{ return {}; } };
    const fmt = v=> v === undefined ? '…' : (typeof v === 'string' ? v : JSON.stringify(v));
    function refreshHints(){
      const sigs = readSignals();
      hints.forEach(h=>{ h.node.textContent = '= ' + fmt(sigs[h.signal]); });
    }
    function placeHints(){
      editor.getAllMarks().forEach(m=>m.clear());
      hints = [];
      const re = /\$s\d_[A-Za-z0-9_]+/g;
      editor.eachLine(line=>{
        const text = line.text;
        let m;
        re.lastIndex = 0;
        while((m = re.exec(text))){
          const node = document.createElement('span');
          node.className = 'cm-hint';
          node.textContent = '= …';
          const mark = editor.setBookmark({line:editor.getLineNumber(line), ch:m.index+m[0].length}, {widget:node});
          hints.push({mark, signal:m[0].slice(1), node});
        }
      });
      refreshHints();
    }
    new MutationObserver(refreshHints).observe(inspectorPre, {childList:true, characterData:true, subtree:true});
    setInterval(refreshHints, 2000);

    function renderTabs(){
      const s = steps[cur];
      tabsBar.innerHTML = '';
      const mk = (name, active)=>{
        const b = document.createElement('button');
        b.className = 'etab' + (active ? ' active' : '');
        b.textContent = name;
        b.onclick = ()=>selectFile(name);
        tabsBar.appendChild(b);
      };
      mk('demo.html', s._file === 'demo.html');
      if(s._js !== null) mk('handler.js', s._file === 'handler.js');
    }
    function showStatus(){
      const s = steps[cur];
      if(s._js === null){ statusLine.style.display = 'none'; return; }
      statusLine.style.display = 'block';
      if(s._err){
        statusLine.className = 'estatus err';
        statusLine.textContent = '● handler error — ' + s._err;
      }else{
        statusLine.className = 'estatus ok';
        statusLine.textContent = '● handler live';
      }
    }
    function showPreviewErr(){
      const s = steps[cur];
      if(s._err){
        previewErr.style.display = 'block';
        previewErr.innerHTML = `⚠️ <strong>handler.js failed to compile</strong> — demo below runs the last-good version.<br><code class="inline">${DS.esc(s._err)}</code>`;
      }else{
        previewErr.style.display = 'none';
        previewErr.innerHTML = '';
      }
    }
    function selectFile(name){
      const s = steps[cur];
      s._file = name;
      editor.setOption('mode', name === 'handler.js' ? 'javascript' : 'htmlmixed');
      editor.setValue(name === 'handler.js' ? s._js : s._html);
      renderTabs();
      placeHints();
    }
    function applyHandler(){
      const s = steps[cur];
      if(s._js === null) return;
      const r = DS.runHandlerCode(editor.getValue());
      s._js = editor.getValue();
      s._err = r.error || null;
      showStatus();
      showPreviewErr();
    }
    function renderPreview(){
      DS.closeStreams();
      preview.innerHTML = editor.getValue();
      placeHints();
    }
    function go(i){
      cur = Math.max(0, Math.min(steps.length-1, i));
      const s = steps[cur];
      document.getElementById('backBtn').disabled = cur===0;
      document.getElementById('nextBtn').textContent = cur===steps.length-1 ? 'Done ✓' : 'Next →';
      left.innerHTML = s.explainer;
      // entering a step (re)applies its handler buffer
      if(s._js !== null){
        const r = DS.runHandlerCode(s._js);
        s._err = r.error || null;
      }
      editor.setOption('mode', s._file === 'handler.js' ? 'javascript' : 'htmlmixed');
      editor.setValue(s._file === 'handler.js' ? s._js : s._html);
      renderTabs();
      showStatus();
      showPreviewErr();
      [...nav.querySelectorAll('button')].forEach((b,k)=>{ b.classList.toggle('active', k===cur); b.classList.toggle('done', k<cur); });
      [...nav.querySelectorAll('.n')].forEach((n,k)=>{ n.textContent = k<cur ? '✓' : (k+1); });
      pill.textContent = `Step ${cur+1} of ${steps.length}`;
      location.hash = hashPrefix+(cur+1);
      renderPreview();
      window.scrollTo({top:0});
    }
    document.getElementById('backBtn').onclick = ()=>go(cur-1);
    document.getElementById('nextBtn').onclick = ()=>go(cur+1);
    document.getElementById('resetBtn').onclick = ()=>{
      const s = steps[cur];
      s._html = s.code;
      if(s._js !== null){
        s._js = (document.getElementById(s.hsrc)?.textContent ?? '').replace(/^\n+|\s+$/g,'');
        const r = DS.runHandlerCode(s._js);
        s._err = r.error || null;
      }else s._err = null;
      editor.setValue(s._file === 'handler.js' ? s._js : s._html);
      showStatus();
      showPreviewErr();
      renderPreview();
    };
    const fmtBtn = document.getElementById('formatBtn');
    if(fmtBtn) fmtBtn.onclick = ()=>{
      try{
        if(steps[cur]._file === 'handler.js'){
          if(typeof beautify === 'function') editor.setValue(beautify(editor.getValue(), {indent_size:2}));
        }else if(typeof html_beautify === 'function'){
          editor.setValue(html_beautify(editor.getValue(), {indent_size:2, wrap_line_length:120, wrap_attributes:'force'}));
        }
      }catch{}
      if(steps[cur]._file === 'handler.js') applyHandler(); else renderPreview();
    };
    let deb = null;
    editor.on('change', ()=>{
      clearTimeout(deb);
      const s = steps[cur];
      if(s._file === 'handler.js'){
        deb = setTimeout(()=>{
          s._js = editor.getValue();
          applyHandler();
        }, 500);
      }else{
        deb = setTimeout(()=>{ s._html = editor.getValue(); renderPreview(); }, 500);
      }
    });
    // html edits must persist per step (js persists via s._js in applyHandler)
    const menuBtn = document.getElementById('menuBtn');
    if(menuBtn) menuBtn.onclick = ()=>{
      document.body.classList.toggle('navhidden');
      try{ localStorage.setItem('tour-nav', document.body.classList.contains('navhidden')?'1':'0'); }catch{}
      setTimeout(()=>editor.refresh(), 50);
    };
    try{ if(localStorage.getItem('tour-nav')==='1') document.body.classList.add('navhidden'); }catch{}
    document.addEventListener('keydown', e=>{
      if(e.target.matches('input,textarea') || e.target.closest('.CodeMirror')) return;
      if(e.key==='ArrowRight') go(cur+1);
      if(e.key==='ArrowLeft') go(cur-1);
    });

    go(Math.max(0,(parseInt((location.hash||'').replace('#'+hashPrefix,''),10)||1)-1));
    document.addEventListener('datastar-ready', ()=>renderPreview());
    return {go, editor};
  }
};

DS.installShim();
})();

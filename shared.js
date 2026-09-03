// Shared backend-fake + tour shell for the Datastar patterns pages.
// Classic script (no modules): defines window.DS and window.TourShell.
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
let serverCount = 0;
let serverTick = 0, tickTimer = null, serverDown = false;

function sse(...blocks){ return blocks.join('\n\n') + '\n\n'; }
function sseResp(body, ms=0){
  return new Promise(res=>setTimeout(()=>res(new Response(body,{status:200,headers:{'Content-Type':'text/event-stream'}})), ms));
}
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

// Open streams (ReadableStream) so re-renders / drops can close them.
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

function readSignalsFrom(urlStr, bodyText){
  try{
    if(bodyText){ return JSON.parse(bodyText); }
    const u = new URL(urlStr, location.href);
    const d = u.searchParams.get('datastar');
    return d ? JSON.parse(d) : {};
  }catch{ return {}; }
}

// ---------------- contact-form "server" (SSE section) ----------------
function contactErrors(email, msg){
  const errs = [];
  if(!String(email||'').includes('@')) errs.push('email must contain @');
  if(String(msg||'').length < 10) errs.push('message must be ≥ 10 chars (try typing “fail” in the email to fail later)');
  return errs;
}
function errorsHtml(errs){
  if(!errs.length) return `<span class="ok-line">✓ looks good</span>`;
  return `<ul class="errs">${errs.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`;
}
const patchEl = (selector, html)=>`event: datastar-patch-elements\ndata: selector ${selector}\ndata: mode inner\ndata: elements ${html}`;
const patchSig = obj=>`event: datastar-patch-signals\ndata: signals ${JSON.stringify(obj)}`;

async function fakeBackend(urlStr, bodyText){
  const path = new URL(urlStr, location.href).pathname;
  const sig = readSignalsFrom(urlStr, bodyText);
  if(path==='/api/search'){
    const q = String(sig.s5_search ?? '').toLowerCase();
    const rows = CONTACTS.filter(([f,l])=>(f+' '+l).toLowerCase().includes(q)).slice(0,6);
    const html = rows.length
      ? `<table class="results"><tr><th>First</th><th>Last</th></tr>${rows.map(([f,l])=>`<tr><td>${esc(f)}</td><td>${esc(l)}</td></tr>`).join('')}</table>`
      : `<em>No matches for “${esc(sig.s5_search??'')}”.</em>`;
    return sseResp(sse(
      `event: datastar-patch-elements\ndata: selector #s5_results\ndata: mode inner\ndata: elements ${html}`,
      `event: datastar-patch-signals\ndata: signals {s5_count: ${rows.length}}`
    ), 120);
  }
  if(path==='/api/inc'){ serverCount++; return sseResp(sse(`event: datastar-patch-elements\ndata: elements <div id="s5_counter">${serverCount} (from server)</div>`), 150); }
  if(path==='/api/reset'){ serverCount = 0; return sseResp(sse(`event: datastar-patch-elements\ndata: elements <div id="s5_counter">0 (from server)</div>`), 150); }
  if(path==='/api/slow'){ return sseResp(sse(`event: datastar-patch-elements\ndata: selector #s6_out\ndata: mode inner\ndata: elements <strong>Done at ${new Date().toLocaleTimeString()} — patched by backend.</strong>`), 900); }

  // ---- SSE section: one contact endpoint, validate + staged submit ----
  if(path==='/api/contact'){
    const email = sig.s8_email ?? '', msg = sig.s8_msg ?? '';
    return sseResp(sse(patchEl('#s8_errors', errorsHtml(contactErrors(email,msg)))), 150);
  }
  if(path==='/api/contact-submit'){
    const email = sig.s8_email ?? '', msg = sig.s8_msg ?? '';
    return streamResp((write, {after})=>{
      write(sse(patchEl('#s8_status', '⏳ Validating…')));
      after(600, ()=>{
        const errs = contactErrors(email,msg);
        if(errs.length){
          write(sse(patchEl('#s8_errors', errorsHtml(errs)),
                     patchEl('#s8_status', '❌ Please fix the errors above')));
          DS.closeStreams(); // end this stream (closes all open — one page, one stream at a time)
          return;
        }
        write(sse(patchEl('#s8_errors', errorsHtml([])),
                   patchEl('#s8_status', '✓ Valid! Saving to database…')));
        after(700, ()=>{
          write(sse(patchEl('#s8_status', '⏳ Sending confirmation email…')));
          after(800, ()=>{
            if(String(email).includes('fail')){
              write(sse(
                patchEl('#s8_status', '⚠️ Saved, but the email failed — we’ll retry it later'),
                patchEl('#s8_saved', '<strong>Saved ✓</strong> (email pending)')));
            }else{
              write(sse(
                patchEl('#s8_status', '✅ All done!'),
                patchEl('#s8_saved', '<strong>Thank you! Your message has been sent.</strong>')));
            }
            DS.closeStreams();
          });
        });
      });
    });
  }

  // ---- SSE section: misc ----
  if(path==='/api/ping'){
    return sseResp(sse(patchEl('#s8_out', `<strong>pong at ${new Date().toLocaleTimeString()}</strong>`)), 200);
  }

  // ---- SSE section: ticks / drop / reconnect snapshot ----
  if(path==='/api/ticks'){
    if(!tickTimer) tickTimer = setInterval(()=>{ serverTick++; }, 1500);
    return streamResp((write, {every, close})=>{
      write(sse(patchSig({s8_tick: serverTick})));
      every(1500, ()=>{
        if(serverDown){ close(); return; }
        write(sse(patchSig({s8_tick: serverTick})));
      });
    });
  }
  if(path==='/api/drop'){
    serverDown = true;
    return sseResp(sse(
      patchSig({s8_online: false}),
      patchEl('#s8_conn', `<div class="banner off">● disconnected — showing last known state</div>`)
    ), 200);
  }
  if(path==='/api/reconnect'){
    serverDown = false;
    return sseResp(sse(
      patchSig({s8_online: true, s8_tick: serverTick}),
      patchEl('#s8_conn', `<div class="banner okb">● live — full snapshot applied (tick ${serverTick}), no replay needed</div>`)
    ), 300);
  }
  return null;
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

    function renderPreview(){
      DS.closeStreams();
      preview.innerHTML = editor.getValue();
      placeHints();
    }
    function go(i){
      cur = Math.max(0, Math.min(steps.length-1, i));
      document.getElementById('backBtn').disabled = cur===0;
      document.getElementById('nextBtn').textContent = cur===steps.length-1 ? 'Done ✓' : 'Next →';
      left.innerHTML = steps[cur].explainer;
      editor.setValue(steps[cur].code);
      [...nav.querySelectorAll('button')].forEach((b,k)=>{ b.classList.toggle('active', k===cur); b.classList.toggle('done', k<cur); });
      [...nav.querySelectorAll('.n')].forEach((n,k)=>{ n.textContent = k<cur ? '✓' : (k+1); });
      pill.textContent = `Step ${cur+1} of ${steps.length}`;
      location.hash = hashPrefix+(cur+1);
      renderPreview();
      window.scrollTo({top:0});
    }
    document.getElementById('backBtn').onclick = ()=>go(cur-1);
    document.getElementById('nextBtn').onclick = ()=>go(cur+1);
    document.getElementById('resetBtn').onclick = ()=>{ editor.setValue(steps[cur].code); renderPreview(); };
    const fmtBtn = document.getElementById('formatBtn');
    if(fmtBtn) fmtBtn.onclick = ()=>{
      try{
        if(typeof html_beautify === 'function')
          editor.setValue(html_beautify(editor.getValue(), {indent_size:2, wrap_line_length:120, wrap_attributes:'force'}));
      }catch{}
      renderPreview();
    };
    let deb = null;
    editor.on('change', ()=>{ clearTimeout(deb); deb = setTimeout(renderPreview, 500); });
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
    return {go, editor, renderPreview};
  }
};

DS.installShim();
})();

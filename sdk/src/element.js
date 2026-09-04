// Eager custom-element shell with lazy guts and caller-rendered states.
//
//   <ds-live-editor src="demo.html">
//     <span slot="loading">warming up…</span>
//     <span slot="error">editor failed — <button>retry</button></span>
//   </ds-live-editor>
//
// Contract:
// - defineShell() runs at import: cheap, no I/O, no heavy deps.
// - Heavy work happens in load(), called once on first connect.
// - States idle → loading → ready | error, reflected as data-state.
// - Events up: ds-ready {module}, ds-error {error} (bubbles + composed).
// - Props down: observed attributes; re-render on change while ready.
// - data-state + part="stage" are the styling hooks (styled-but-overridable).
export function defineShell(name, { load, render, observed = [] } = {}) {
  if (typeof customElements === 'undefined') {
    throw new Error('defineShell needs a DOM (browser-only).');
  }
  if (customElements.get(name)) return customElements.get(name);
  class Shell extends HTMLElement {
    static get observedAttributes() {
      return observed;
    }
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>:host{display:block}[hidden]{display:none!important}</style>
        <slot name="loading"><span>Loading…</span></slot>
        <div id="stage" part="stage" hidden></div>
        <slot name="error"></slot>`;
      this._state = 'idle';
    }
    get state() {
      return this._state;
    }
    setState(s, detail) {
      this._state = s;
      this.dataset.state = s;
      this.shadowRoot.querySelector('slot[name=loading]').hidden = s !== 'loading';
      this.shadowRoot.querySelector('#stage').hidden = s !== 'ready';
      this.shadowRoot.querySelector('slot[name=error]').hidden = s !== 'error';
      if (s === 'ready' || s === 'error') {
        this.dispatchEvent(
          new CustomEvent(s === 'ready' ? 'ds-ready' : 'ds-error', {
            bubbles: true,
            composed: true,
            detail,
          })
        );
      }
    }
    async connectedCallback() {
      if (this._state === 'loading' || this._state === 'ready') return;
      if (typeof load !== 'function') {
        this.setState('error', { error: new Error(name + ': no loader provided') });
        return;
      }
      this.setState('loading');
      try {
        const mod = await load(this);
        if (!this.isConnected) return; // detached while loading: drop it
        this._module = mod;
        if (typeof render === 'function') {
          await render(this.shadowRoot.querySelector('#stage'), mod, this);
        }
        this.setState('ready', { module: mod });
      } catch (e) {
        this.setState('error', { error: e });
      }
    }
    attributeChangedCallback() {
      if (this._state === 'ready' && typeof render === 'function') {
        try {
          const r = render(this.shadowRoot.querySelector('#stage'), this._module, this);
          if (r && typeof r.catch === 'function') r.catch(() => {});
        } catch {}
      }
    }
  }
  customElements.define(name, Shell);
  return Shell;
}

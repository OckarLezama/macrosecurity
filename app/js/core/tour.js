// Guía de primera vez: resalta un elemento, oscurece lo demás y dice qué hacer.
import { h } from './ui.js';
import { LS } from './store.js';
import { ses } from './session.js';

let current = null;
export function startTour(key, steps, force = false) {
  const s = ses() || {};
  const flag = 'ms8.tour.' + key + '.' + (s.rol || '') + '.' + (s.nombre || '');
  if (current || (!force && LS.get(flag, false))) return;
  const list = steps.filter(([sel]) => { const el = document.querySelector(sel); return el && el.getClientRects().length; });
  if (!list.length) return;
  LS.set(flag, true);
  let i = 0;
  const hl = h('div', { class: 'hl' }), tip = h('div', { class: 'tip', role: 'dialog' });
  const lay = h('div', { class: 'tour' }, hl, tip);
  document.body.append(lay); current = lay;
  const end = () => { lay.remove(); current = null; removeEventListener('resize', show); document.removeEventListener('keydown', key2); };
  const key2 = e => { if (e.key === 'Escape') end(); };
  function show() {
    const [sel, txt] = list[i]; const el = document.querySelector(sel); if (!el) return end();
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect(), pd = 6;
    Object.assign(hl.style, { left: r.left - pd + 'px', top: r.top - pd + 'px', width: r.width + pd * 2 + 'px', height: r.height + pd * 2 + 'px' });
    tip.replaceChildren(h('small', {}, 'PASO ' + (i + 1) + ' DE ' + list.length), h('p', {}, txt),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', onclick: end }, 'Saltar guía'), h('span', { class: 'sp' }),
        h('button', { class: 'btn pri sm', onclick: () => { i++; i >= list.length ? end() : show(); } }, i === list.length - 1 ? 'Entendido' : 'Siguiente')));
    const tw = 320, th = tip.offsetHeight || 150; let x = r.left, y = r.bottom + 14;
    if (r.height > innerHeight * .55) { x = r.right + 14; y = r.top + 20; if (x + tw > innerWidth - 10) { x = r.left + 20; } }
    if (y + th > innerHeight - 10) y = Math.max(10, r.top - th - 14);
    if (x + tw > innerWidth - 10) x = innerWidth - tw - 10;
    Object.assign(tip.style, { left: Math.max(10, x) + 'px', top: Math.max(10, y) + 'px' });
  }
  addEventListener('resize', show); document.addEventListener('keydown', key2);
  show();
}

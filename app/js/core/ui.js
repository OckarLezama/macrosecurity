// Utilidades de interfaz: construcción de nodos, avisos, ventanas y formato.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'value') e.value = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

export const DAY = 864e5;
export const pad = n => String(n).padStart(2, '0');
export const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export const slugify = t => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente';
export const fmtDate = t => new Date(t).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtDT = t => new Date(t).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
export const isoDay = d => new Date(d).toISOString().slice(0, 10);
export const initials = t => String(t || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

export function toast(msg) {
  let t = $('#toast');
  if (!t) { t = h('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3000);
}

// Ventana modal. Devuelve {close}. actions: [{label, kind, onClick, disabled}]
export function modal({ title, kicker, body, actions = [], wide = false, onClose }) {
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc); onClose && onClose(); };
  const esc = e => { if (e.key === 'Escape') close(); };
  const btns = actions.map(a => {
    const b = h('button', { class: 'btn ' + (a.kind || ''), type: 'button', disabled: a.disabled }, a.label);
    b.onclick = () => a.onClick ? a.onClick({ close, button: b }) : close();
    if (a.id) b.id = a.id;
    return b;
  });
  const ov = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'mbox' + (wide ? ' wide' : '') },
      h('div', { class: 'mhd' }, h('div', {}, kicker ? h('small', {}, kicker) : null, h('h2', {}, title)),
        h('button', { class: 'x', 'aria-label': 'Cerrar', onclick: close }, '✕')),
      h('div', { class: 'mbd' }, body),
      btns.length ? h('div', { class: 'mft' }, btns) : null));
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', esc);
  document.body.append(ov);
  const f = ov.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 30);
  return { close, el: ov };
}

export function field(label, control, help) {
  return h('label', { class: 'field' }, h('span', {}, label), control, help ? h('small', {}, help) : null);
}
export function input(value, opts = {}) {
  const i = h('input', { class: 'inp', type: opts.type || 'text', placeholder: opts.ph || '', id: opts.id, disabled: opts.disabled });
  i.value = value == null ? '' : value;
  if (opts.on) i.addEventListener('input', () => opts.on(i.value));
  return i;
}
export function select(options, value, on, opts = {}) {
  const s = h('select', { class: 'inp', id: opts.id, disabled: opts.disabled }, ...options.map(([v, l]) => h('option', { value: v }, l)));
  if (value != null) s.value = value;
  if (on) s.addEventListener('change', () => on(s.value));
  return s;
}
export function fileBtn(label, accept, onFile, kind = '') {
  const inp = h('input', { type: 'file', accept });
  const nm = h('span', { class: 'fname' });
  const b = h('button', { class: 'btn ' + kind, type: 'button', onclick: () => inp.click() }, label);
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; nm.textContent = f.name; try { await onFile(f); } finally { inp.value = ''; } };
  return h('div', { class: 'file' }, b, inp, nm);
}

// Contraste: texto blanco u oscuro según el fondo.
export function lum(hx) {
  const n = parseInt(String(hx || '#000').replace('#', '').padEnd(6, '0'), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); })
    .reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
}
export const inkOn = hx => lum(hx) > .42 ? '#17212E' : '#FFFFFF';

export async function sha(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function loadLib(src, test) {
  return new Promise((res, rej) => {
    if (test()) return res();
    const s = document.createElement('script'); s.src = src;
    s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar una librería. Revisa tu conexión.'));
    document.head.append(s);
  });
}
export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function readImage(file, max = 160) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const k = max / Math.max(im.width, im.height, max); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }; im.onerror = rej; im.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });
}
export const SHIELD = (color = 'currentColor', size = 26) => {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', color); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"></path><path d="M9 12l2 2 4-4"></path>';
  return s;
};

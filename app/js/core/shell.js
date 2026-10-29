// Marco común: barra superior, colores y navegación.
import { h, $, inkOn, initials, SHIELD } from './ui.js';
import { Reg } from './store.js';
import { ses, logout, can, who, ROLES, isEmpresa } from './session.js';

export const go = path => { if (location.hash !== '#' + path) location.hash = path; else dispatchEvent(new HashChangeEvent('hashchange')); };
export const MANDO_URL = slug => '../v7.html?c=' + encodeURIComponent(slug);

/* ---------- colores: la empresa ve los suyos; el cliente, los institucionales ---------- */
const BASE = { brand: '#2B3138', accent: '#0E9384' };
export function applyTheme(slug) {
  const c = slug && !isEmpresa() ? Reg.get(slug) : null; const k = c && c.colores;
  const brand = k && k.pri || BASE.brand, accent = k && k.sec || BASE.accent;
  const st = document.documentElement.style;
  st.setProperty('--brand', brand); st.setProperty('--brand-ink', inkOn(brand));
  st.setProperty('--accent', accent); st.setProperty('--accent-ink', inkOn(accent));
  st.setProperty('--accent-dk', k ? 'color-mix(in srgb,' + accent + ' 70%,#000)' : '#0E7A6C');
  st.setProperty('--accent-bg', k ? 'color-mix(in srgb,' + accent + ' 9%,#fff)' : '#EEF6F4');
  st.setProperty('--accent-line', k ? 'color-mix(in srgb,' + accent + ' 28%,#fff)' : '#CFE7E1');
}

/* ---------- barra superior ---------- */
function topbar(ctx) {
  const s = ses(); const c = ctx.slug ? Reg.get(ctx.slug) : null;
  const clientView = c && !isEmpresa();
  const brand = h('a', { class: 'brand', href: isEmpresa() ? '#/clientes' : '#/c/' + (s && s.cliente) },
    clientView && c.logo ? h('img', { src: c.logo, alt: '' }) : SHIELD(clientView ? 'currentColor' : '#2EC4A6', 28),
    h('b', {}, clientView ? c.nombre : 'Macro Security'));
  const crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Ubicación' },
    ...(isEmpresa() && c ? [h('i', {}, '/'), h('a', { href: '#/clientes' }, 'Mis clientes'), h('i', {}, '/'), h('span', {}, c.nombre)] : []),
    ...(ctx.section ? [h('i', {}, '/'), h('span', {}, ctx.section)] : []));
  const w = who();
  const menu = h('div', { class: 'umenu', hidden: true, role: 'menu' });
  const btn = h('button', { class: 'userbtn', 'aria-haspopup': 'menu', onclick: e => { e.stopPropagation(); menu.hidden = !menu.hidden; } },
    h('span', { class: 'av' }, initials(w.nombre)), h('span', { class: 'ut' }, h('b', {}, w.nombre), (isEmpresa() || w.nombre !== ROLES[w.rol]) ? h('small', {}, isEmpresa() ? 'Súper administrador' : ROLES[w.rol]) : null));
  const item = (label, fn) => h('button', { role: 'menuitem', onclick: () => { menu.hidden = true; fn(); } }, label);
  const items = [];
  if (isEmpresa()) items.push(item('Mis clientes', () => go('/clientes')));
  if (c && c.estado === 'activo' && can('mando')) items.push(item('Centro de mando', () => { location.href = MANDO_URL(c.slug); }));
  if (c && can('cfg')) items.push(item(c.estado === 'activo' ? 'Ajustes del cliente' : 'Configuración', () => go('/c/' + c.slug + '/configurar')));
  if (c && can('bitacora')) items.push(item('Bitácora de cambios', () => go('/c/' + c.slug + '/bitacora')));
  if (ctx.tour) items.push(item('¿Cómo se usa esta pantalla?', ctx.tour));
  items.push(h('hr'), item('Cambiar de usuario', () => { logout(); go('/entrar'); }));
  menu.append(...items);
  document.addEventListener('click', () => { menu.hidden = true; });
  return h('header', { class: 'topbar' }, brand, crumbs, h('span', { class: 'sp' }), btn, menu);
}
export function layout(ctx, content) {
  applyTheme(ctx.slug);
  document.title = (ctx.title ? ctx.title + ' · ' : '') + 'Macro Security';
  $('#app').replaceChildren(topbar(ctx), h('main', { id: 'view' }, content));
  scrollTo(0, 0);
}
export function fullMessage(ctx, title, text, actions = []) {
  layout(ctx, h('div', { class: 'full' }, h('div', { class: 'card' }, h('h2', {}, title), h('p', { class: 'muted', style: 'margin:0' }, text), h('div', { class: 'row', style: 'justify-content:center' }, actions))));
}


// Sesión, roles y permisos. Un solo lugar decide quién puede qué.
import { LS, Reg, db } from './store.js';
import { sha } from './ui.js';

export const ROLES = {
  super: 'Súper administrador',
  empresa: 'Administrador de la empresa',
  'admin-responsable': 'Administrador responsable',
  'admin-respaldo': 'Administrador de respaldo',
  configurador: 'Configurador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  consulta: 'Consulta',
};
export const ROLE_HELP = {
  'admin-responsable': 'Responde por el servicio. Configura y da de alta usuarios.',
  'admin-respaldo': 'Suple al responsable. Mismos permisos.',
  configurador: 'Ajusta oficiales, sectores, zonas y catálogo.',
  supervisor: 'Usa el centro de mando y supervisa.',
  operador: 'Usa el centro de mando y asigna patrullas.',
  consulta: 'Solo ve el centro de mando.',
};
const PERM = {
  super: ['equipo', 'clientes', 'servicio', 'eliminar', 'habilitar', 'colores', 'cfg', 'usuarios', 'bitacora', 'mando'],
  empresa: ['clientes', 'habilitar', 'colores', 'cfg', 'usuarios', 'bitacora', 'mando'],
  'admin-responsable': ['cfg', 'usuarios', 'bitacora', 'mando'],
  'admin-respaldo': ['cfg', 'usuarios', 'bitacora', 'mando'],
  configurador: ['cfg', 'bitacora', 'mando'],
  supervisor: ['mando'], operador: ['mando'], consulta: ['mando'],
};

// La sesión dura mientras la pestaña esté abierta: al abrir la plataforma siempre se pregunta quién entra.
const SS = { get() { try { return JSON.parse(sessionStorage.getItem('ms.ses') || 'null'); } catch (e) { return null; } }, set(v) { try { sessionStorage.setItem('ms.ses', JSON.stringify(v)); } catch (e) {} }, del() { try { sessionStorage.removeItem('ms.ses'); } catch (e) {} } };
LS.del('ms.ses'); // sesiones viejas guardadas de forma permanente
export const ses = () => { const s = SS.get(); if (!s || !PERM[s.rol]) return null; if (s.cliente && !Reg.get(s.cliente)) return null; return s; };
export function login(rol, nombre, cliente) {
  SS.set({ rol, nombre, cliente: cliente || null, t: Date.now() });
  LS.set('ms.role', rol);
  if (cliente) LS.set('ms.cur', cliente);
}
export function logout() { SS.del(); }
export const role = () => (ses() || {}).rol || null;
export const can = p => { const r = role(); return !!r && PERM[r].includes(p); };
export const who = () => { const s = ses() || {}; return { nombre: s.nombre || ROLES[s.rol] || '', rol: s.rol }; };
export const isEmpresa = () => ['super', 'empresa'].includes(role());
export const isSuper = () => role() === 'super';
// ¿Puede ver este cliente? La empresa ve todos; el cliente solo el suyo.
export const canSee = slug => { const s = ses(); return !!s && (['super', 'empresa'].includes(s.rol) || s.cliente === slug); };

/* ---------- cuentas (piloto: viven en este navegador hasta conectar la base de datos) ---------- */
const hashPw = (correo, pw) => sha('ms|' + String(correo).trim().toLowerCase() + '|' + pw);
// Súper administradores (la empresa). No se crean desde la plataforma: vienen definidos aquí.
// La contraseña inicial es temporal; al primer acceso cada uno define la suya.
const SUPER = [
  { correo: 'superadmin@macrosecurity.mx', nombre: 'Macro Security', ph0: '44569efdbe4fb98bb4e84e631a8752ab125707f0f1412c10b2ffabedad85e350' },
];
LS.del('ms.empresa');
const superOver = () => LS.get('ms.super', {});
export const superCuentas = () => SUPER.map(s => { const o = superOver()[s.correo]; return { ...s, ph: o ? o.ph : s.ph0, tmp: !o }; });
export function tempPassword() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const r = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => A[x % A.length]).join(''); return 'Ms-' + r(4) + '-' + r(4); }
export { hashPw };
// Busca la cuenta por correo y contraseña. Devuelve {rol,nombre,cliente,tmp,id} o null.
export async function autenticar(correo, pw) {
  correo = correo.trim().toLowerCase();
  for (const e of superCuentas()) if (e.correo === correo && e.ph === await hashPw(correo, pw)) return { rol: 'super', nombre: e.nombre, cliente: null, tmp: e.tmp };
  for (const e of equipo()) if (e.activo !== false && e.correo === correo && e.ph === await hashPw(correo, pw)) return { rol: 'empresa', nombre: e.nombre, cliente: null, tmp: !!e.tmp, id: e.id, equipo: true };
  for (const c of Reg.all()) {
    const u = db(c.slug).list('usuarios').find(x => (x.correo || '').toLowerCase() === correo);
    if (u && u.ph && u.ph === await hashPw(correo, pw)) return { rol: u.rol, nombre: u.nombre || u.correo, cliente: c.slug, tmp: !!u.tmp, id: u.id };
  }
  return null;
}
export async function cambiarPassword(cliente, id, correo, pw) {
  if (!cliente && id) { const L = equipo(); const e = L.find(x => x.id === id); if (e) { e.ph = await hashPw(correo, pw); e.tmp = false; LS.set('ms.equipo', L); } return; }
  if (!cliente) { const o = superOver(); o[correo] = { ph: await hashPw(correo, pw), t: Date.now() }; LS.set('ms.super', o); return; }
  const d = db(cliente); const u = d.get('usuarios/' + id); if (!u) return;
  u.ph = await hashPw(correo, pw); u.tmp = false; u.estado = 'activo'; d.set('usuarios/' + id, u);
}

/* ---------- equipo de la empresa: administradores que crea el súper administrador ---------- */
export const equipo = () => LS.get('ms.equipo', []);
export const saveEquipo = L => LS.set('ms.equipo', L);
export const correoEnUso = correo => { correo = correo.toLowerCase(); if (SUPER.some(s => s.correo === correo) || equipo().some(e => e.correo === correo)) return 'la empresa';
  for (const c of Reg.all()) if (db(c.slug).list('usuarios').some(u => (u.correo || '').toLowerCase() === correo)) return c.nombre; return null; };

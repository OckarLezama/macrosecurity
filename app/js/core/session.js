// Sesión, roles y permisos. Un solo lugar decide quién puede qué.
import { LS, Reg } from './store.js';

export const ROLES = {
  empresa: 'Empresa',
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
  empresa: ['clientes', 'servicio', 'habilitar', 'colores', 'cfg', 'usuarios', 'bitacora', 'mando'],
  'admin-responsable': ['cfg', 'usuarios', 'bitacora', 'mando'],
  'admin-respaldo': ['cfg', 'usuarios', 'bitacora', 'mando'],
  configurador: ['cfg', 'bitacora', 'mando'],
  supervisor: ['mando'], operador: ['mando'], consulta: ['mando'],
};

export const ses = () => { const s = LS.get('ms.ses', null); if (!s || !PERM[s.rol]) return null; if (s.cliente && !Reg.get(s.cliente)) return null; return s; };
export function login(rol, nombre, cliente) {
  LS.set('ms.ses', { rol, nombre, cliente: cliente || null, t: Date.now() });
  LS.set('ms.role', rol);
  if (cliente) LS.set('ms.cur', cliente);
}
export function logout() { LS.del('ms.ses'); }
export const role = () => (ses() || {}).rol || null;
export const can = p => { const r = role(); return !!r && PERM[r].includes(p); };
export const who = () => { const s = ses() || {}; return { nombre: s.nombre || ROLES[s.rol] || '', rol: s.rol }; };
export const isEmpresa = () => role() === 'empresa';
// ¿Puede ver este cliente? La empresa ve todos; el cliente solo el suyo.
export const canSee = slug => { const s = ses(); return !!s && (s.rol === 'empresa' || s.cliente === slug); };

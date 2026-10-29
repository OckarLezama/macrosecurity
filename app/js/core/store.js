// Datos. Hoy viven en el navegador (localStorage) con el mismo formato que usa
// el centro de mando; al conectar la base de datos solo cambia este archivo.
import { DAY, fmtDate, isoDay, sha } from './ui.js';

const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } };
export const LS = { get, set, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };

/* ---------- registro de clientes ---------- */
const REG = 'ms.clientes';
export const Reg = {
  all() {
    let r = get(REG, null);
    if (!r || !r.length) { r = [{ slug: 'puebla', nombre: 'Puebla', lugar: 'Puebla, Puebla', nivel: 'municipio', tipo: 'municipio', estado: 'activo', creado: Date.now() }]; set(REG, r); }
    return r;
  },
  get(slug) { return Reg.all().find(c => c.slug === slug) || null; },
  save(list) { set(REG, list); },
  patch(slug, p) { const r = Reg.all(); const c = r.find(x => x.slug === slug); if (c) { Object.assign(c, p); set(REG, r); } return c; },
  add(c) { const r = Reg.all(); r.push(c); set(REG, r); },
  remove(slug) { set(REG, Reg.all().filter(c => c.slug !== slug)); LS.del(dbKey(slug)); },
};

/* ---------- base de datos de cada cliente ---------- */
export const dbKey = slug => slug === 'puebla' ? 'ms3.db' : 'ms3.db:' + slug;
export function db(slug) {
  const key = dbKey(slug);
  const load = () => new Map(get(key, []));
  const save = m => set(key, [...m]);
  return {
    get(p) { return load().get(p) ?? null; },
    set(p, d) { const m = load(); m.set(p, JSON.parse(JSON.stringify(d))); save(m); },
    del(p) { const m = load(); m.delete(p); save(m); },
    list(col) { const out = []; for (const [p, d] of load()) if (p.slice(0, p.lastIndexOf('/')) === col) out.push(d); return out; },
    keys(col) { return [...load().keys()].filter(p => p.startsWith(col + '/')); },
    clear(col) { const m = load(); for (const p of [...m.keys()]) if (p.startsWith(col + '/')) m.delete(p); save(m); },
  };
}

/* ---------- configuración base de un cliente nuevo ---------- */
export function baseConfig(nombre) {
  return {
    cliente: nombre, demo: false, pendiente: true, presetDone: true, calles: true, metaLlegada: 10,
    turnos: [{ nombre: 'Mañana', inicio: 6 }, { nombre: 'Tarde', inicio: 14 }, { nombre: 'Noche', inicio: 22 }],
    sectores: [], colonias: [], zonas: [], botones: [], limite: null,
    catalogo: [
      { id: 'transeunte', nombre: 'Robo a transeúnte', prioridad: 'alta', grupo: 'delito', subtipos: ['Con violencia', 'Sin violencia'] },
      { id: 'transporte', nombre: 'Robo en transporte público', prioridad: 'alta', grupo: 'delito', subtipos: [] },
      { id: 'repartidor', nombre: 'Robo a repartidor', prioridad: 'media', grupo: 'delito', subtipos: [] },
      { id: 'casa', nombre: 'Robo a casa habitación', prioridad: 'media', grupo: 'delito', subtipos: [] },
      { id: 'vehiculo', nombre: 'Robo de vehículo', prioridad: 'media', grupo: 'delito', subtipos: ['Total', 'Autopartes'] },
      { id: 'rina', nombre: 'Riña o lesiones', prioridad: 'alta', grupo: 'delito', subtipos: [] },
      { id: 'acoso', nombre: 'Acoso o violencia de género', prioridad: 'alta', grupo: 'delito', subtipos: ['Acoso u hostigamiento', 'Violencia familiar', 'Abuso sexual'] },
      { id: 'sospechosa', nombre: 'Persona sospechosa', prioridad: 'baja', grupo: 'delito', subtipos: [] },
      { id: 'accidente', nombre: 'Accidente vial', prioridad: 'media', grupo: 'delito', subtipos: ['Persona atropellada', 'Choque'] },
      { id: 'servicio', nombre: 'Servicio público', prioridad: 'baja', grupo: 'servicio', subtipos: ['Alumbrado', 'Bache', 'Fuga de agua', 'Basura'] },
    ],
  };
}
export function config(slug) { return db(slug).get('config/main'); }
export function saveConfig(slug, c) { db(slug).set('config/main', c); }

/* ---------- vigencia del servicio ---------- */
export function daysLeft(c) {
  if (!c.servicio || !c.servicio.fin) return null;
  return Math.ceil((new Date(c.servicio.fin + 'T23:59:59').getTime() - Date.now()) / DAY);
}
export function vigencia(c) {
  const d = daysLeft(c);
  if (d == null) return { k: 'none', t: 'Sin vigencia definida' };
  if (d <= 0) return { k: 'bad', t: 'Vencido desde ' + fmtDate(c.servicio.fin + 'T12:00') };
  return { k: d <= 30 ? 'bad' : d <= 90 ? 'warn' : 'ok', t: 'Vigente hasta ' + fmtDate(c.servicio.fin + 'T12:00') + ' · ' + d + ' días' };
}
// Avisos 90/60/30/7 días antes y suspensión automática al vencer.
export function serviceTick() {
  const r = Reg.all(); let ch = false;
  for (const c of r) {
    const d = daysLeft(c); if (d == null) continue; c.avisos = c.avisos || [];
    const m = [7, 30, 60, 90].find(x => d <= x); const key = 'v' + c.servicio.fin + '-' + m;
    if (m && d > 0 && !c.avisos.find(a => a.k === key)) { c.avisos.push({ k: key, t: Date.now(), txt: 'El servicio vence en ' + d + ' días (' + fmtDate(c.servicio.fin + 'T12:00') + ').' }); ch = true; }
    if (d <= 0 && c.estado === 'activo') { c.estado = 'suspendido'; c.motivo = 'vencido'; c.avisos.push({ k: 's' + Date.now(), t: Date.now(), txt: 'Suspendido automáticamente: venció el servicio sin renovación.' }); ch = true; }
  }
  if (ch) Reg.save(r);
  return r;
}
export const monthsBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / (30.44 * DAY)));
export const today = () => isoDay(Date.now());

/* ---------- resumen para la tarjeta ---------- */
export function stats(slug) {
  const d = db(slug); const c = d.get('config/main');
  if (!c) return null;
  const terr = !!(c.limite && c.limite.length);
  return {
    terr, sect: terr ? (c.sectores || []).length : 0, col: (c.colonias || []).length,
    pat: d.list('unidades').filter(u => !u.demo).length, rep: d.keys('eventos').length,
    usr: d.list('usuarios').length,
  };
}

/* ---------- bitácora con sello encadenado ---------- */
export async function logChange(slug, who, area, accion, detalle = '') {
  try {
    const d = db(slug);
    const list = d.list('bitacora').sort((a, b) => a.t - b.t);
    const prev = list.length ? list[list.length - 1].h : 'inicio';
    const e = { t: Date.now(), quien: who.nombre, rol: who.rol, area, accion, detalle };
    e.h = await sha(prev + '|' + JSON.stringify(e));
    d.set('bitacora/b' + e.t.toString(36) + Math.random().toString(36).slice(2, 6), e);
  } catch (er) { console.warn(er); }
}
export async function verifyChain(list) {
  let prev = 'inicio', ok = true;
  for (const e of list.slice().sort((a, b) => a.t - b.t)) { const { h: hh, ...rest } = e; if (await sha(prev + '|' + JSON.stringify(rest)) !== hh) ok = false; prev = hh; }
  return { ok, last: prev };
}
export function empresaLog(accion, cliente) { const L = get('ms.bit.empresa', []); L.push({ t: Date.now(), accion, cliente }); set('ms.bit.empresa', L.slice(-1000)); }

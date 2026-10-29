// Configuración del cliente: un paso a la vez, con instrucciones concretas.
import { h, field, input, select, modal, toast, norm, pad, fmtDate, fileBtn, loadLib, readImage, download } from '../core/ui.js';
import { Reg, db, config, saveConfig, logChange, empresaLog } from '../core/store.js';
import { who, can, isEmpresa, ROLES, ROLE_HELP } from '../core/session.js';
import { layout, go } from '../core/shell.js';
import { searchLimit, fromPlace, fromFile, pointsFromFile, coverage, preview, randIn, km2 } from '../core/geo.js';
import { vigenciaModal, colorPicker } from './clientes.js';
import { startTour } from '../core/tour.js';

export const STEPS = [
  { k: 'datos', t: 'Datos del cliente', req: true, help: ['Revisa el nombre, el responsable y el contacto.', 'Si tienes el logo, súbelo: aparece en la barra superior y en las credenciales QR.', 'Presiona “Guardar y continuar”.'] },
  { k: 'terr', t: 'Territorio', req: true, help: ['Escribe el municipio o estado y presiona “Buscar límite oficial”.', 'Si el cliente te dio su propio mapa (GeoJSON o KML), súbelo en la opción 2.', 'Revisa la vista previa y presiona “Continuar”.'] },
  { k: 'sect', t: 'Sectores', req: true, help: ['Revisa en la vista previa que no haya huecos ni sectores encimados.', 'Si el cliente usa otros nombres, cámbialos aquí.', 'Presiona “Guardar y continuar”.'] },
  { k: 'col', t: 'Colonias o cuadrantes', help: ['Opcional. Si el cliente tiene colonias o cuadrantes, sube el archivo.', 'Si no, presiona “Continuar”.'] },
  { k: 'tur', t: 'Turnos', req: true, help: ['Deja un renglón por turno y elige a qué hora empieza cada uno.', 'Cada turno termina cuando empieza el siguiente.', 'Presiona “Guardar y continuar”.'] },
  { k: 'cat', t: 'Catálogo de reportes', req: true, help: ['Desmarca los reportes que no apliquen a este cliente.', 'Ajusta la prioridad de cada tipo; lo activo es lo que el ciudadano ve en WhatsApp.', 'Presiona “Guardar y continuar”.'] },
  { k: 'ofi', t: 'Oficiales y patrullas', req: true, help: ['Descarga la plantilla, llénala en Excel y súbela; o agrega a los oficiales uno por uno.', 'Asigna a cada oficial su sector y su horario.', 'Presiona “Guardar y continuar”.'] },
  { k: 'usr', t: 'Usuarios', req: true, help: ['Agrega al administrador responsable y al de respaldo: deben ser dos personas distintas.', 'Agrega a los demás usuarios y elige qué puede hacer cada uno.', 'Presiona “Guardar y continuar”.'] },
  { k: 'zon', t: 'Zonas seguras y botones', help: ['Opcional. Sube el archivo con las zonas seguras y el de botones de pánico.', 'Si aún no los tienes, presiona “Continuar”.'] },
  { k: 'wa', t: 'WhatsApp', help: ['Opcional. Escribe el número de WhatsApp y revisa los mensajes del bot.', 'Presiona “Guardar y continuar”.'] },
  { k: 'his', t: 'Histórico', help: ['Opcional. Sube el histórico de delitos para que el pronóstico sea de este cliente.', 'Si aún no lo tienes, presiona “Continuar”.'] },
  { k: 'rev', t: 'Revisión y habilitar', req: true, help: ['Revisa que todos los pasos obligatorios estén en verde.', 'Si falta algo, tócalo para ir directo a ese paso.', 'Cuando todo esté listo, la empresa presiona “Habilitar servicio”.'] },
];
const REQ = STEPS.filter(s => s.req && s.k !== 'rev');

export function status(k, slug) {
  const c = Reg.get(slug) || {}; const cfg = config(slug) || {}; const d = db(slug);
  const terr = !!(cfg.limite && cfg.limite.length);
  switch (k) {
    case 'datos': return c.nombre && c.tipo && c.responsable && c.contacto ? 'ok' : 'pend';
    case 'terr': return terr ? 'ok' : 'pend';
    case 'sect': { if (!terr || !(cfg.sectores || []).length) return 'pend'; const cv = coverage(cfg); return cv && (cv.gap > .03 || cv.ov > .01) ? 'warn' : 'ok'; }
    case 'col': return (cfg.colonias || []).length ? 'ok' : 'opt';
    case 'tur': return (cfg.turnos || []).length ? 'ok' : 'pend';
    case 'cat': return (cfg.catalogo || []).some(x => x.activo !== false) ? 'ok' : 'pend';
    case 'ofi': return d.list('unidades').some(u => !u.demo) ? 'ok' : 'pend';
    case 'usr': { const U = d.list('usuarios'); return U.some(u => u.rol === 'admin-responsable') && U.some(u => u.rol === 'admin-respaldo') ? 'ok' : 'pend'; }
    case 'zon': return (cfg.zonas || []).length || (cfg.botones || []).length ? 'ok' : 'opt';
    case 'wa': return cfg.wa && cfg.wa.numero ? 'ok' : 'opt';
    case 'his': { const H = d.get('historial/main'); return H && H.origen === 'archivo' ? 'ok' : 'opt'; }
    case 'rev': return c.estado === 'activo' ? 'ok' : 'pend';
  }
}
export function progress(slug) { const done = REQ.filter(s => status(s.k, slug) === 'ok').length; return { done, total: REQ.length }; }

const TOUR = [
  ['.cnav', 'Estos son los pasos. Ve de arriba hacia abajo: cuando uno se pone en verde, ya quedó.'],
  ['.howto', 'En cada paso, aquí te digo exactamente qué hacer.'],
  ['.cfoot .btn.pri', 'Cuando termines, presiona aquí para guardar y pasar al siguiente.'],
  ['.cn-p', 'Lo que avances se guarda. Puedes salir y seguir después.'],
];

let dirty = false;
export function configurar(slug, paso) {
  const c = Reg.get(slug);
  let i = Math.max(0, STEPS.findIndex(s => s.k === paso));
  if (!paso) { const k = STEPS.findIndex(s => s.req && s.k !== 'rev' && status(s.k, slug) === 'pend'); i = c.estado === 'activo' ? 0 : (k < 0 ? STEPS.length - 1 : k); }
  const st = STEPS[i]; dirty = false;
  const cfg = config(slug) || {};
  const L = (area, accion, detalle) => logChange(slug, who(), area, accion, detalle);
  const ctx = { slug, c, cfg, d: db(slug), L, rerender: () => configurar(slug, st.k), next: () => goStep(i + 1) };
  const goStep = j => {
    const to = STEPS[Math.max(0, Math.min(STEPS.length - 1, j))].k;
    if (!dirty) return go('/c/' + slug + '/configurar/' + to);
    modal({ title: 'Tienes cambios sin guardar', body: h('p', { style: 'margin:0' }, 'Si sales de este paso se pierden.'),
      actions: [{ label: 'Salir sin guardar', onClick: ({ close }) => { close(); dirty = false; go('/c/' + slug + '/configurar/' + to); } }, { label: 'Quedarme', kind: 'pri' }] });
  };
  ctx.goStep = goStep;

  const body = h('div', { class: 'cbody' }, h('div', { class: 'howto' }, h('b', {}, 'Qué hacer'), h('ol', {}, ...st.help.map(t => h('li', {}, t)))));
  const ui = (UI[st.k] || (() => ({})))(ctx) || {};
  body.append(...[].concat(ui.body || []).filter(Boolean));
  body.addEventListener('input', () => { if (ui.save) dirty = true; });
  body.addEventListener('change', e => { if (ui.save && !(e.target.type === 'file')) dirty = true; });

  const p = progress(slug); const active = c.estado === 'activo';
  const nav = h('nav', { class: 'cnav', 'aria-label': 'Pasos' },
    h('div', { class: 'cn-t' }, h('small', {}, active ? 'AJUSTES DEL CLIENTE' : 'CONFIGURACIÓN'), h('b', {}, c.nombre)),
    h('div', { class: 'cn-p' }, h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(p.done / p.total * 100) + '%' })), h('span', {}, p.done + ' de ' + p.total + ' pasos obligatorios listos')),
    ...STEPS.map((s, j) => { const ss = status(s.k, slug); return h('button', { class: 'st ' + ss + (j === i ? ' on' : ''), onclick: () => goStep(j), 'aria-current': j === i ? 'step' : null },
      h('i', {}, ss === 'ok' ? '✓' : ss === 'warn' ? '!' : String(j + 1)), h('span', {}, s.t, s.req ? null : h('em', {}, 'opcional'))); }),
    can('bitacora') ? h('div', { class: 'cn-f' }, h('button', { class: 'st', id: 'cnBit', onclick: () => go('/c/' + slug + '/bitacora') }, h('i', {}, '≡'), h('span', {}, 'Bitácora de cambios'))) : null);
  const mob = h('div', { class: 'cmob' }, select(STEPS.map((s, j) => [j, (j + 1) + '. ' + s.t + (status(s.k, slug) === 'ok' ? ' ✓' : '')]), i, v => goStep(+v)), h('span', { class: 'muted', style: 'font-size:12px;white-space:nowrap' }, p.done + ' de ' + p.total + ' listos'));

  const doSave = async () => {
    try { await ui.save(); dirty = false; toast('Guardado'); if (i < STEPS.length - 1) goStep(i + 1); else ctx.rerender(); }
    catch (e) { toast(e.message || 'No se pudo guardar'); }
  };
  const foot = h('div', { class: 'cfoot' },
    h('button', { class: 'btn', disabled: i === 0, onclick: () => goStep(i - 1) }, '‹ Anterior'),
    h('span', { class: 'hint' }, ui.hint || ''), h('span', { class: 'sp' }),
    ui.save ? h('button', { class: 'btn pri lg', onclick: doSave }, i < STEPS.length - 1 ? 'Guardar y continuar' : 'Guardar')
      : (i < STEPS.length - 1 ? h('button', { class: 'btn pri lg', onclick: () => goStep(i + 1) }, 'Continuar ›') : null));

  const tour = () => startTour('configurar', TOUR, true);
  layout({ slug, title: st.t + ' · ' + c.nombre, section: active ? 'Ajustes' : 'Configuración', tour },
    h('div', { class: 'cfg' }, nav, h('div', { class: 'cmain' }, mob,
      h('div', { class: 'chead' }, h('div', {}, h('small', {}, 'Paso ' + (i + 1) + ' de ' + STEPS.length + (st.req ? '' : ' · opcional')), h('h1', {}, st.t)), h('span', { class: 'sp' }),
        active ? h('a', { class: 'btn', href: '../v7.html?c=' + encodeURIComponent(slug) }, 'Ir al centro de mando') : isEmpresa() ? h('button', { class: 'btn', onclick: () => go('/clientes') }, 'Volver a mis clientes') : null),
      body, foot)));
  setTimeout(() => startTour('configurar', TOUR), 450);
}

/* ===================== pasos ===================== */
const needTerr = ctx => (ctx.cfg.limite && ctx.cfg.limite.length) ? null
  : h('div', { class: 'note warn' }, 'Primero carga el territorio. ', h('a', { href: '#/c/' + ctx.slug + '/configurar/terr' }, 'Ir a Territorio'));
const TZ = [['America/Mexico_City', 'Centro (CDMX)'], ['America/Cancun', 'Sureste (Quintana Roo)'], ['America/Chihuahua', 'Chihuahua'], ['America/Mazatlan', 'Pacífico (Sinaloa, Nayarit, BCS)'], ['America/Hermosillo', 'Sonora'], ['America/Tijuana', 'Noroeste (Baja California)']];

const UI = {
  datos(ctx) {
    const c = ctx.c; const f = { nombre: c.nombre, tipo: c.tipo || c.nivel || 'municipio', responsable: c.responsable || '', contacto: c.contacto || '', tz: c.tz || 'America/Mexico_City', logo: c.logo || '' };
    const lgp = h('div', { class: 'lgp' }, f.logo ? h('img', { src: f.logo, alt: '' }) : 'Logo');
    const lin = h('input', { type: 'file', accept: 'image/*', hidden: true }); lin.onchange = async () => { if (!lin.files[0]) return; f.logo = await readImage(lin.files[0]); lgp.replaceChildren(h('img', { src: f.logo, alt: '' })); dirty = true; };
    const col = colorPicker(c.colores, () => f.nombre, !can('colores'));
    const v = c.servicio && c.servicio.fin ? 'Del ' + fmtDate(c.servicio.inicio + 'T12:00') + ' al ' + fmtDate(c.servicio.fin + 'T12:00') : 'Sin vigencia definida';
    return {
      body: [h('div', { class: 'card stack' },
        h('div', { class: 'grid2' }, field('Nombre del cliente', input(f.nombre, { on: x => { f.nombre = x; col.redraw(); } })),
          field('Tipo', select([['municipio', 'Municipio'], ['estado', 'Estado'], ['corporacion', 'Corporación o dependencia']], f.tipo, x => { f.tipo = x; })),
          field('Responsable', input(f.responsable, { ph: 'Nombre de quien autoriza', on: x => { f.responsable = x; } })),
          field('Contacto', input(f.contacto, { ph: 'Correo o teléfono', on: x => { f.contacto = x; } })),
          field('Zona horaria', select(TZ, f.tz, x => { f.tz = x; })),
          field('Logo', h('div', { class: 'logo-up' }, lgp, lin, h('button', { class: 'btn', type: 'button', onclick: () => lin.click() }, 'Subir logo'))))),
        h('div', { class: 'card stack' }, h('h3', {}, 'Colores institucionales'),
          h('p', { class: 'sub', style: 'margin:0' }, can('colores') ? 'Solo los ven los usuarios del cliente; la empresa sigue viendo los de la plataforma. Los colores de riesgo y de las gráficas no cambian.' : 'Los define la empresa.'),
          col.el, can('colores') && c.colores ? h('button', { class: 'btn ghost sm', style: 'align-self:flex-start', type: 'button', onclick: () => { col.reset(); dirty = true; } }, 'Usar los colores de la plataforma') : null),
        h('div', { class: 'card row' }, h('div', {}, h('h3', {}, 'Servicio contratado'), h('span', { class: 'muted' }, v)), h('span', { class: 'sp' }),
          can('servicio') ? h('button', { class: 'btn', onclick: () => vigenciaModal(ctx.slug, ctx.rerender) }, 'Editar vigencia') : null)],
      save: async () => {
        if (!f.nombre.trim()) throw new Error('Falta el nombre');
        const p = { nombre: f.nombre.trim(), tipo: f.tipo, nivel: f.tipo === 'estado' ? 'estado' : 'municipio', responsable: f.responsable.trim(), contacto: f.contacto.trim(), tz: f.tz, logo: f.logo };
        if (can('colores')) p.colores = col.value();
        const ch = Object.keys(p).filter(k => JSON.stringify(p[k] ?? null) !== JSON.stringify(c[k] ?? null));
        Reg.patch(ctx.slug, p); const cf = config(ctx.slug); cf.cliente = p.nombre; saveConfig(ctx.slug, cf);
        if (ch.length) ctx.L('Datos del cliente', 'Modificó', ch.map(k => ({ nombre: 'nombre', tipo: 'tipo', nivel: null, responsable: 'responsable', contacto: 'contacto', tz: 'zona horaria', logo: 'logo', colores: 'colores' }[k])).filter(Boolean).join(', '));
      },
    };
  },

  terr(ctx) {
    const cfg = ctx.cfg; const has = cfg.limite && cfg.limite.length; const c = ctx.c;
    const msg = h('div');
    const apply = async (patch, origen) => {
      const doIt = () => {
        const cf = Object.assign(config(ctx.slug), patch, { pendiente: false });
        if (!patch.colonias) cf.colonias = [];
        saveConfig(ctx.slug, cf);
        ['unidades', 'eventos', 'vigiladas'].forEach(col => ctx.d.clear(col));
        ctx.L('Territorio', 'Cargó territorio', origen + ' · ' + cf.sectores.length + ' sectores' + (cf.colonias.length ? ', ' + cf.colonias.length + ' colonias' : ''));
        toast('Territorio cargado: ' + cf.sectores.length + ' sectores'); ctx.rerender();
      };
      if (!has) return doIt();
      modal({ kicker: 'CAMBIAR TERRITORIO', title: '¿Reemplazar el territorio actual?', body: h('div', { class: 'note warn' }, 'Se reemplazan el límite, los sectores y las colonias. Los oficiales y reportes de este cliente se reinician porque sus ubicaciones cambian.'),
        actions: [{ label: 'Cancelar' }, { label: 'Reemplazar', kind: 'pri', onClick: ({ close }) => { close(); doIt(); } }] });
    };
    const q = input(c.lugar || '', { ph: 'Ej. Tlaxcala, Tlaxcala' });
    const lvl = select([['municipio', 'Municipio'], ['estado', 'Estado completo']], c.nivel || 'municipio');
    const goBtn = h('button', { class: 'btn pri', onclick: async () => {
      const L0 = q.value.trim(); if (!L0) return toast('Escribe el municipio o estado');
      goBtn.disabled = true; msg.replaceChildren(h('div', { class: 'note' }, 'Buscando el límite oficial de “' + L0 + '”…'));
      try {
        const r = await searchLimit(L0, lvl.value);
        if (!r) { msg.replaceChildren(h('div', { class: 'note bad' }, 'No encontré el límite de “' + L0 + '”. Prueba con “Municipio, Estado” o sube un archivo.')); return; }
        Reg.patch(ctx.slug, { lugar: L0, nivel: lvl.value }); msg.replaceChildren(); await apply(fromPlace(r), 'Límite oficial: ' + r.display_name.split(',').slice(0, 2).join(','));
      } catch (e) { msg.replaceChildren(h('div', { class: 'note bad' }, 'No pude conectar con el buscador de límites. Revisa tu conexión o sube un archivo.')); }
      finally { goBtn.disabled = false; }
    } }, 'Buscar límite oficial');
    const file = fileBtn('Subir GeoJSON o KML', '.geojson,.json,.kml', async f => { try { const r = await fromFile(f, cfg); if (!r.sectores) throw new Error('Ese archivo solo trae colonias. Súbelo en el paso “Colonias”.'); await apply(r, 'Archivo ' + f.name); } catch (e) { msg.replaceChildren(h('div', { class: 'note bad' }, e.message)); } });
    const opts = h('div', { class: 'stack', hidden: !!has },
      h('div', { class: 'card stack' }, h('h3', {}, 'Opción 1 · Límite oficial'), h('p', { class: 'sub', style: 'margin:0' }, 'Se toma de OpenStreetMap y se divide en sectores que después puedes renombrar o reemplazar.'),
        h('div', { class: 'row' }, h('div', { style: 'flex:2;min-width:220px' }, q), h('div', { style: 'flex:1;min-width:160px' }, lvl), goBtn)),
      h('div', { class: 'card stack' }, h('h3', {}, 'Opción 2 · Mapa del cliente'), h('p', { class: 'sub', style: 'margin:0' }, 'GeoJSON o KML con el límite y, si los tiene, sus sectores y colonias. Si viene en MapInfo o Shapefile, se convierte antes.'), file));
    return {
      body: [has ? h('div', { class: 'card stack' }, h('div', { class: 'row' }, h('h3', {}, 'Territorio cargado'), h('span', { class: 'sp' }), h('button', { class: 'btn', onclick: e => { opts.hidden = !opts.hidden; e.target.textContent = opts.hidden ? 'Cambiar territorio' : 'Cancelar cambio'; } }, 'Cambiar territorio')),
        h('p', { class: 'sub', style: 'margin:0' }, (c.lugar || '') + ' · ' + Math.round(km2(cfg.limite, cfg.mpu)).toLocaleString('es-MX') + ' km² · ' + cfg.sectores.length + ' sectores'), preview(cfg)) : null,
        msg, opts],
    };
  },

  sect(ctx) {
    const nt = needTerr(ctx); if (nt) return { body: nt };
    const cfg = ctx.cfg; const S = cfg.sectores.map(s => ({ ...s })); const cv = coverage(cfg);
    const chk = cv ? h('div', { class: 'note ' + (cv.gap > .03 || cv.ov > .01 ? 'warn' : 'ok') }, (cv.gap > .03 ? 'Hay huecos: ' + Math.round(cv.gap * 100) + '% del territorio no pertenece a ningún sector. ' : 'Sin huecos. ') + (cv.ov > .01 ? 'Hay sectores encimados (' + Math.round(cv.ov * 100) + '%).' : 'Sin sectores encimados.')) : null;
    return {
      body: [h('div', { class: 'grid2', style: 'align-items:start' }, preview(cfg, { colonias: false }),
        h('div', { class: 'stack' }, chk, h('div', { class: 'card tbl' }, ...S.map((s, j) => h('div', { class: 'tr', style: 'grid-template-columns:28px minmax(0,1fr) 90px' }, h('span', { class: 'ix' }, j + 1), input(s.nombre, { on: v => { s.nombre = v; } }), h('small', { class: 'muted' }, (x => x < 1 ? Math.round(x * 100) + ' ha' : x.toFixed(1) + ' km²')(km2(s.poly, cfg.mpu)))))),
          h('div', { class: 'note' }, '¿El cliente tiene otros sectores? Sube su mapa en ', h('a', { href: '#/c/' + ctx.slug + '/configurar/terr' }, 'Territorio'), ' (opción 2).')))],
      save: async () => {
        if (S.some(s => !s.nombre.trim())) throw new Error('Todos los sectores necesitan nombre');
        const cf = config(ctx.slug); const before = cf.sectores.map(s => s.nombre).join('|'); cf.sectores = S.map(s => ({ ...s, nombre: s.nombre.trim() })); saveConfig(ctx.slug, cf);
        if (before !== cf.sectores.map(s => s.nombre).join('|')) ctx.L('Sectores', 'Renombró sectores', cf.sectores.length + ' sectores');
      },
    };
  },

  col(ctx) {
    const nt = needTerr(ctx); if (nt) return { body: nt };
    const cfg = ctx.cfg; const n = (cfg.colonias || []).length; const msg = h('div');
    return {
      body: [h('div', { class: 'grid2', style: 'align-items:start' }, preview(cfg),
        h('div', { class: 'stack' }, h('div', { class: 'note ' + (n ? 'ok' : '') }, n ? n.toLocaleString('es-MX') + ' colonias cargadas.' : 'Sin colonias. Sirven para ubicar cada reporte por colonia y buscarlas en el mapa.'),
          h('div', { class: 'card stack' }, h('h3', {}, n ? 'Reemplazar colonias' : 'Cargar colonias o cuadrantes'), h('p', { class: 'sub', style: 'margin:0' }, 'GeoJSON o KML con un polígono por colonia y su nombre.'),
            fileBtn('Subir archivo', '.geojson,.json,.kml', async f => { try { const r = await fromFile(f, cfg); if (r.sectores) throw new Error('Ese archivo trae sectores. Súbelo en Territorio.'); const cf = config(ctx.slug); cf.colonias = r.colonias; saveConfig(ctx.slug, cf); ctx.L('Colonias', 'Cargó colonias', r.colonias.length + ' colonias · ' + f.name); toast(r.colonias.length + ' colonias cargadas'); ctx.rerender(); } catch (e) { msg.replaceChildren(h('div', { class: 'note bad' }, e.message)); } }),
            n ? h('button', { class: 'btn ghost sm', style: 'align-self:flex-start', onclick: () => { const cf = config(ctx.slug); cf.colonias = []; saveConfig(ctx.slug, cf); ctx.L('Colonias', 'Quitó colonias', ''); ctx.rerender(); } }, 'Quitar colonias') : null), msg))],
    };
  },

  tur(ctx) {
    const T = (ctx.cfg.turnos || []).map(t => ({ ...t })); const list = h('div', { class: 'card tbl' });
    const hours = Array.from({ length: 24 }, (_, k) => [k, pad(k) + ':00']);
    const draw = () => list.replaceChildren(h('div', { class: 'tr th', style: 'grid-template-columns:28px minmax(0,1fr) 140px 160px 40px' }, h('span'), h('span', {}, 'Turno'), h('span', {}, 'Empieza'), h('span', {}, 'Termina'), h('span')),
      ...T.map((t, j) => { const nx = T.length > 1 ? T.slice().sort((a, b) => a.inicio - b.inicio).find(x => x.inicio > t.inicio) || T.slice().sort((a, b) => a.inicio - b.inicio)[0] : t;
        return h('div', { class: 'tr', style: 'grid-template-columns:28px minmax(0,1fr) 140px 160px 40px' }, h('span', { class: 'ix' }, j + 1), input(t.nombre, { on: v => { t.nombre = v; } }), select(hours, t.inicio, v => { t.inicio = +v; draw(); }), h('span', { class: 'muted' }, 'a las ' + pad(nx.inicio) + ':00'), h('button', { class: 'xbtn', title: 'Quitar', disabled: T.length <= 1, onclick: () => { T.splice(j, 1); dirty = true; draw(); } }, '✕')); }),
      h('button', { class: 'btn', onclick: () => { T.push({ nombre: 'Turno ' + (T.length + 1), inicio: 0 }); dirty = true; draw(); } }, '+ Agregar turno'));
    draw();
    return {
      body: [list, h('div', { class: 'note' }, 'El modelo de riesgo calcula la probabilidad por turno; con 3 o 4 turnos es más preciso que con 2.')],
      save: async () => {
        if (!T.length) throw new Error('Debe haber al menos un turno'); if (T.some(t => !t.nombre.trim())) throw new Error('Cada turno necesita nombre');
        if (new Set(T.map(t => t.inicio)).size !== T.length) throw new Error('Dos turnos no pueden empezar a la misma hora');
        const cf = config(ctx.slug); cf.turnos = T.map(t => ({ nombre: t.nombre.trim(), inicio: t.inicio })).sort((a, b) => a.inicio - b.inicio); saveConfig(ctx.slug, cf);
        ctx.L('Turnos', 'Actualizó', cf.turnos.map(t => t.nombre + ' ' + pad(t.inicio) + ':00').join(', '));
      },
    };
  },

  cat(ctx) {
    const K = (ctx.cfg.catalogo || []).map(x => ({ ...x })); const list = h('div', { class: 'card tbl' });
    const G = [['delito', 'Delito'], ['emergencia', 'Emergencia'], ['servicio', 'Servicio público'], ['oficial', 'Sobre un oficial']];
    const P = [['critica', 'Crítica'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']];
    const cols = 'grid-template-columns:56px minmax(0,1fr) 180px 130px';
    const draw = () => list.replaceChildren(h('div', { class: 'tr th', style: cols }, h('span', {}, 'Activo'), h('span', {}, 'Tipo de reporte'), h('span', {}, 'Grupo'), h('span', {}, 'Prioridad')),
      ...K.map(x => { const a = h('input', { type: 'checkbox' }); a.checked = x.activo !== false; a.onchange = () => { x.activo = a.checked; };
        return h('div', { class: 'tr', style: cols }, h('label', { class: 'chk', style: 'justify-content:center' }, a), input(x.nombre, { on: v => { x.nombre = v; } }), select(G, x.grupo, v => { x.grupo = v; }), select(P, x.prioridad || 'media', v => { x.prioridad = v; })); }),
      h('button', { class: 'btn', onclick: () => { K.push({ id: 'c' + Date.now().toString(36), nombre: 'Nuevo tipo', grupo: 'delito', prioridad: 'media', subtipos: [], activo: true }); dirty = true; draw(); } }, '+ Agregar tipo'));
    draw();
    return {
      body: [list],
      save: async () => {
        if (!K.some(x => x.activo !== false)) throw new Error('Activa al menos un tipo'); if (K.some(x => !x.nombre.trim())) throw new Error('Cada tipo necesita nombre');
        const cf = config(ctx.slug); cf.catalogo = K; saveConfig(ctx.slug, cf);
        ctx.L('Catálogo de reportes', 'Actualizó', K.filter(x => x.activo !== false).length + ' tipos activos de ' + K.length);
      },
    };
  },

  ofi(ctx) {
    const nt = needTerr(ctx); if (nt) return { body: nt };
    const cfg = ctx.cfg; const secs = cfg.sectores.map(s => [s.id, s.nombre]);
    const U = ctx.d.list('unidades').filter(u => !u.demo).map(u => ({ ...u })).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const hours = Array.from({ length: 24 }, (_, k) => [k, pad(k) + ':00']);
    const cols = 'grid-template-columns:minmax(0,1.6fr) minmax(0,.8fr) 90px minmax(0,1fr) 92px 92px 96px';
    const list = h('div', { class: 'card tbl' });
    const draw = () => list.replaceChildren(h('div', { class: 'tr th', style: cols }, h('span', {}, 'Oficial'), h('span', {}, 'Placa'), h('span', {}, 'Patrulla'), h('span', {}, 'Sector'), h('span', {}, 'Entra'), h('span', {}, 'Sale'), h('span')),
      ...U.map((u, j) => h('div', { class: 'tr', style: cols }, input(u.oficial, { ph: 'Nombre completo', on: v => { u.oficial = v; } }), input(u.placa, { ph: 'Placa o ID', on: v => { u.placa = v; } }), input(u.id, { ph: 'P-01', on: v => { u.id = v; } }),
        select(secs, u.sector || secs[0][0], v => { u.sector = v; }), select(hours, u.horaIni ?? 7, v => { u.horaIni = +v; }), select(hours, u.horaFin ?? 15, v => { u.horaFin = +v; }),
        h('div', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' }, h('button', { class: 'btn sm', title: 'Credencial QR', onclick: () => showQR(ctx, u) }, 'QR'), h('button', { class: 'xbtn', title: 'Quitar', onclick: () => { U.splice(j, 1); dirty = true; draw(); } }, '✕')))),
      h('button', { class: 'btn', onclick: () => { U.push({ id: 'P-' + pad(U.length + 1), oficial: '', placa: '', sector: secs[0][0], horaIni: 7, horaFin: 15 }); dirty = true; draw(); } }, '+ Agregar oficial'));
    U.forEach(u => { if (!secs.find(s => s[0] === u.sector)) u.sector = secs[0][0]; });
    draw();
    const xl = fileBtn('Subir Excel', '.xlsx,.xls,.csv', async f => {
      try {
        await loadLib('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', () => !!window.XLSX);
        const wb = XLSX.read(await f.arrayBuffer()); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        const g = (r, ...ks) => { for (const k of Object.keys(r)) if (ks.some(x => norm(k).startsWith(x))) return String(r[k]).trim(); return ''; };
        const hh = v => { const m = String(v).match(/(\d{1,2})/); return m ? Math.min(23, +m[1]) : null; }; let n = 0;
        for (const r of rows) { const nm = g(r, 'nombre', 'oficial'); if (!nm) continue; const sc = norm(g(r, 'sector')); const s = cfg.sectores.find((x, k) => norm(x.nombre) === sc || norm(x.nombre).endsWith(' ' + sc) || String(k + 1) === sc) || cfg.sectores[0];
          U.push({ id: g(r, 'patrulla', 'unidad') || 'P-' + pad(U.length + 1), oficial: nm, placa: g(r, 'placa', 'id', 'identific'), sector: s.id, horaIni: hh(g(r, 'entra', 'inicio')) ?? 7, horaFin: hh(g(r, 'sale', 'fin')) ?? 15 }); n++; }
        dirty = true; draw(); toast(n + ' oficiales leídos. Revisa y guarda.');
      } catch (e) { toast('No pude leer el archivo: ' + e.message); }
    });
    const tpl = h('button', { class: 'btn ghost', onclick: () => download('plantilla_oficiales.csv', '﻿nombre,placa,patrulla,sector,entra,sale\nNombre Apellido,12345,P-01,' + cfg.sectores[0].nombre + ',07:00,15:00\n', 'text/csv') }, 'Descargar plantilla');
    return {
      body: [h('div', { class: 'card row' }, h('div', {}, h('h3', {}, 'Cargar desde Excel'), h('span', { class: 'muted' }, 'Columnas: nombre, placa, patrulla, sector, entra, sale.')), h('span', { class: 'sp' }), tpl, xl), list],
      hint: U.length ? U.length + ' oficiales' : '',
      save: async () => {
        const ok = U.filter(u => String(u.oficial || '').trim()); if (!ok.length) throw new Error('Agrega al menos un oficial');
        const ids = new Set(); for (const u of ok) { u.id = String(u.id || '').trim() || 'P-' + pad(ids.size + 1); if (ids.has(u.id)) throw new Error('La patrulla ' + u.id + ' está repetida'); ids.add(u.id); }
        const prev = new Map(ctx.d.list('unidades').map(u => [u.id, u]));
        for (const id of prev.keys()) if (!ids.has(id) || prev.get(id).demo) ctx.d.del('unidades/' + id);
        for (const u of ok) { const p0 = prev.get(u.id); const sc = cfg.sectores.find(s => s.id === u.sector) || cfg.sectores[0]; const pos = p0 && !p0.demo && p0.sector === sc.id ? { x: p0.x, y: p0.y } : randIn(sc.poly);
          ctx.d.set('unidades/' + u.id, { id: u.id, oficial: u.oficial.trim(), placa: String(u.placa || '').trim(), sector: sc.id, horaIni: +u.horaIni, horaFin: +u.horaFin, x: +(+pos.x).toFixed(2), y: +(+pos.y).toFixed(2), estado: p0 && p0.estado || 'disponible', evento: p0 && p0.evento || null }); }
        const nw = ok.filter(u => !prev.has(u.id)).length, rm = [...prev.keys()].filter(x => !ids.has(x)).length;
        ctx.L('Oficiales y patrullas', 'Actualizó', ok.length + ' oficiales' + (nw ? ' · ' + nw + ' altas' : '') + (rm ? ' · ' + rm + ' bajas' : ''));
      },
    };
  },

  usr(ctx) {
    if (!can('usuarios')) return { body: h('div', { class: 'note' }, 'Tu usuario no puede administrar usuarios. Pídeselo al administrador responsable.') };
    const L2 = ctx.d.list('usuarios').map(u => ({ ...u }));
    const roles = Object.entries(ROLES).filter(([k]) => k !== 'empresa');
    const cols = 'grid-template-columns:minmax(0,1fr) minmax(0,1.2fr) 240px 40px';
    const list = h('div', { class: 'card tbl' }); const help = h('div', { class: 'note' });
    const draw = () => {
      list.replaceChildren(h('div', { class: 'tr th', style: cols }, h('span', {}, 'Nombre'), h('span', {}, 'Correo'), h('span', {}, 'Rol'), h('span')),
        ...L2.map((u, j) => h('div', { class: 'tr', style: cols }, input(u.nombre, { ph: 'Nombre', on: v => { u.nombre = v; } }), input(u.correo, { ph: 'correo@dominio.gob.mx', type: 'email', on: v => { u.correo = v; } }),
          select(roles, u.rol, v => { u.rol = v; draw(); }), h('button', { class: 'xbtn', title: 'Quitar', onclick: () => { L2.splice(j, 1); dirty = true; draw(); } }, '✕'))),
        h('button', { class: 'btn', onclick: () => { L2.push({ id: 'u' + Date.now().toString(36), nombre: '', correo: '', rol: !L2.some(x => x.rol === 'admin-responsable') ? 'admin-responsable' : !L2.some(x => x.rol === 'admin-respaldo') ? 'admin-respaldo' : 'operador', estado: 'pendiente' }); dirty = true; draw(); } }, '+ Agregar usuario'));
      help.replaceChildren(h('b', {}, 'Qué puede hacer cada rol'), h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, ...Object.entries(ROLE_HELP).map(([k, t]) => h('li', {}, h('b', {}, ROLES[k] + ': '), t))));
    };
    draw();
    return {
      body: [list, help],
      save: async () => {
        const ok = L2.filter(u => (u.correo || '').trim() || (u.nombre || '').trim());
        for (const u of ok) { u.correo = u.correo.trim().toLowerCase(); u.nombre = (u.nombre || '').trim(); if (!u.nombre) throw new Error('Falta el nombre de ' + (u.correo || 'un usuario')); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.correo)) throw new Error('Correo no válido: ' + (u.correo || u.nombre)); }
        if (new Set(ok.map(u => u.correo)).size !== ok.length) throw new Error('Hay correos repetidos');
        const rs = ok.filter(u => u.rol === 'admin-responsable'), rb = ok.filter(u => u.rol === 'admin-respaldo');
        if (rs.length !== 1) throw new Error('Debe haber exactamente un administrador responsable');
        if (!rb.length) throw new Error('Falta el administrador de respaldo');
        const prev = ctx.d.list('usuarios'); ctx.d.clear('usuarios'); for (const u of ok) ctx.d.set('usuarios/' + u.id, u);
        const nw = ok.filter(u => !prev.find(p => p.id === u.id)).length, rm = prev.filter(p => !ok.find(u => u.id === p.id)).length;
        ctx.L('Usuarios', 'Actualizó', ok.length + ' usuarios' + (nw ? ' · ' + nw + ' altas' : '') + (rm ? ' · ' + rm + ' bajas' : ''));
      },
    };
  },

  zon(ctx) {
    const nt = needTerr(ctx); if (nt) return { body: nt };
    const cfg = ctx.cfg;
    const box = (t, key, help, color) => {
      const arr = cfg[key] || [];
      return h('div', { class: 'card stack' }, h('div', { class: 'row' }, h('i', { style: 'width:12px;height:12px;border-radius:50%;background:' + color }), h('h3', {}, t + ' · ' + arr.length)), h('p', { class: 'sub', style: 'margin:0' }, help),
        h('div', { class: 'row' }, fileBtn(arr.length ? 'Reemplazar' : 'Subir archivo', '.csv,.geojson,.json,.kml', async f => {
          try { const pts = await pointsFromFile(f, cfg); const v = pts.map((p, j) => key === 'botones' ? { id: 'BP-' + pad(j + 1), ...p } : { id: 'z' + (j + 1), desc: '', ...p }); const cf = config(ctx.slug); cf[key] = v; saveConfig(ctx.slug, cf); ctx.L(t, 'Cargó', v.length + ' puntos · ' + f.name); toast(v.length + ' cargados'); ctx.rerender(); }
          catch (e) { toast('No pude leer el archivo: ' + e.message); } }),
          arr.length ? h('button', { class: 'btn ghost sm', onclick: () => { const cf = config(ctx.slug); cf[key] = []; saveConfig(ctx.slug, cf); ctx.L(t, 'Quitó todos', ''); ctx.rerender(); } }, 'Quitar todos') : null),
        arr.length ? h('div', { class: 'chips' }, ...arr.slice(0, 24).map(z => h('span', {}, z.nombre)), arr.length > 24 ? h('span', {}, '+' + (arr.length - 24)) : null) : null);
    };
    const pts = [...(cfg.zonas || []).map(z => ({ ...z, color: '#1C9E69' })), ...(cfg.botones || []).map(z => ({ ...z, color: '#E0364C' }))];
    return {
      body: [h('div', { class: 'grid2', style: 'align-items:start' }, preview(cfg, { colonias: false, points: pts }),
        h('div', { class: 'stack' }, box('Zonas seguras', 'zonas', 'Farmacias 24 h, bases, tiendas aliadas. El bot las ofrece al ciudadano cuando pide un lugar seguro.', '#1C9E69'),
          box('Botones de pánico', 'botones', 'Postes del C5 o del municipio. Al activarse llegan como emergencia.', '#E0364C'),
          h('div', { class: 'note' }, 'Archivo CSV con columnas nombre, lat, lng; o KML/GeoJSON de puntos.')))],
    };
  },

  wa(ctx) {
    const w = ctx.cfg.wa || {}; const nm = ctx.c.nombre;
    const f = { numero: w.numero || '', bot: w.bot || 'Seguridad ' + nm, bienvenida: w.bienvenida || 'Hola, soy el canal de seguridad de ' + nm + '. ¿Qué necesitas reportar?', privacidad: w.privacidad || 'Aviso de privacidad: ' + nm + ' usa tu ubicación y la información que compartas solo para atender tu reporte de seguridad. Consulta el aviso completo en [enlace].' };
    const ta = (v, k) => { const t = h('textarea', { class: 'inp', rows: 3 }); t.value = v; t.oninput = () => { f[k] = t.value; }; return t; };
    return {
      body: [h('div', { class: 'card stack' }, h('div', { class: 'grid2' }, field('Número de WhatsApp', input(f.numero, { ph: '+52 222 000 0000', type: 'tel', on: v => { f.numero = v; } }), 'Un número que no esté usado en ningún WhatsApp.'), field('Nombre del bot', input(f.bot, { on: v => { f.bot = v; } }))),
        field('Mensaje de bienvenida', ta(f.bienvenida, 'bienvenida')), field('Aviso de privacidad', ta(f.privacidad, 'privacidad'), 'El bot lo muestra antes de pedir la ubicación. Lo exige la ley de protección de datos.')),
        h('div', { class: 'note' }, 'La conexión con Meta se hace cuando el cliente tenga su cuenta de WhatsApp Business. Mientras, el simulador usa estos textos.')],
      save: async () => { const cf = config(ctx.slug); cf.wa = { numero: f.numero.trim(), bot: f.bot.trim(), bienvenida: f.bienvenida.trim(), privacidad: f.privacidad.trim() }; saveConfig(ctx.slug, cf); ctx.L('WhatsApp', 'Actualizó', cf.wa.numero || 'sin número'); },
    };
  },

  his(ctx) {
    const nt = needTerr(ctx); if (nt) return { body: nt };
    const H = ctx.d.get('historial/main'); const cfg = ctx.cfg;
    const state = !H ? h('div', { class: 'note' }, 'Sin histórico. Mientras no se cargue, el pronóstico arranca con lo que se vaya reportando.')
      : H.origen === 'archivo' ? h('div', { class: 'note ok' }, H.entries.length.toLocaleString('es-MX') + ' registros cargados el ' + fmtDate(H.generado) + '.')
        : h('div', { class: 'note warn' }, 'Usando un histórico simulado. Sube el real para que el pronóstico sea de este cliente.');
    const up = fileBtn(H && H.origen === 'archivo' ? 'Reemplazar CSV' : 'Subir CSV', '.csv', async f => {
      const lines = (await f.text()).split(/\r?\n/).filter(x => x.trim()); if (lines.length < 2) return toast('El archivo está vacío');
      const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ','; const hd = lines[0].split(sep).map(norm); const ix = k => hd.findIndex(x => x === k || x.startsWith(k));
      const iF = ix('fecha'), iH = ix('hora'), iS = ix('sector'), iE = ix('evento') >= 0 ? ix('evento') : ix('tipo'), iLa = ix('lat'), iLo = ix('lon');
      if (iF < 0 || iH < 0 || iS < 0 || iE < 0) return toast('Faltan columnas: FECHA, HORA, SECTOR, EVENTO');
      const t0 = new Date(); t0.setHours(0, 0, 0, 0); const out = []; let skip = 0;
      const toW = (lng, lat) => [+(50 + (lng - cfg.geo.lng0) * cfg.geo.kx / cfg.mpu).toFixed(2), +((cfg.geo.lat0 - lat) * cfg.geo.ky / cfg.mpu).toFixed(2)];
      for (const ln of lines.slice(1)) {
        const c = ln.split(sep); const fe = (c[iF] || '').trim(), hr = (c[iH] || '').trim(), sc = norm(c[iS]), ev = norm(c[iE]);
        const m1 = fe.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/), m2 = fe.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); let d = null;
        if (m1) d = new Date(+m1[1], +m1[2] - 1, +m1[3]); else if (m2) d = new Date(+(m2[3].length === 2 ? '20' + m2[3] : m2[3]), +m2[2] - 1, +m2[1]);
        const hm = hr.match(/(\d{1,2}):(\d{2})/); const num = parseInt(sc, 10);
        const s = !isNaN(num) && cfg.sectores[num - 1] ? cfg.sectores[num - 1] : cfg.sectores.find(x => norm(x.nombre) === sc || norm(x.nombre).endsWith(' ' + sc) || x.id === sc);
        const ct = cfg.catalogo.find(x => norm(x.nombre) === ev) || cfg.catalogo.find(x => norm(x.nombre).split(/\s+/).filter(w => w.length > 4).some(w => ev.includes(w)));
        if (!d || !hm || !s || !ct) { skip++; continue; }
        const row = [Math.round((t0 - d) / 864e5), +hm[1], +hm[2], s.id, ct.id, 1, 8];
        if (iLa >= 0 && iLo >= 0) { const la = parseFloat(c[iLa]), lo = parseFloat(c[iLo]); if (!isNaN(la) && !isNaN(lo)) row.push(...toW(lo, la)); }
        out.push(row);
      }
      if (!out.length) return toast('No se pudo leer ninguna fila. Revisa que los sectores y tipos coincidan con los configurados.');
      ctx.d.set('historial/main', { entries: out.sort((a, b) => a[0] - b[0]).slice(0, 8000), prox: {}, alertas: {}, dias: 90, origen: 'archivo', generado: Date.now() });
      ctx.L('Histórico', 'Cargó histórico', out.length + ' registros' + (skip ? ' · ' + skip + ' omitidos' : '') + ' · ' + f.name);
      toast(out.length + ' registros cargados' + (skip ? ' · ' + skip + ' filas omitidas' : '')); ctx.rerender();
    });
    return { body: [state, h('div', { class: 'card stack' }, h('h3', {}, 'Subir histórico'), h('p', { class: 'sub', style: 'margin:0' }, 'CSV con columnas FECHA, HORA, SECTOR, EVENTO. Opcional: LATITUD, LONGITUD. Sin datos de víctimas.'), up)] };
  },

  rev(ctx) {
    const c = ctx.c; const miss = STEPS.filter(s => s.req && s.k !== 'rev' && status(s.k, ctx.slug) !== 'ok');
    const rows = STEPS.slice(0, -1).map((s, j) => { const ss = status(s.k, ctx.slug); return h('button', { class: 'ckr ' + ss, onclick: () => ctx.goStep(j) }, h('i', {}, ss === 'ok' ? '✓' : ss === 'opt' ? '○' : '!'), h('span', {}, s.t), h('small', {}, ss === 'ok' ? 'Listo' : s.req ? (ss === 'warn' ? 'Revisar' : 'Falta') : 'Opcional')); });
    let action;
    if (c.estado === 'activo') action = h('div', { class: 'note ok' }, 'Servicio habilitado' + (c.habilitado ? ' desde el ' + fmtDate(c.habilitado) : '') + '.');
    else if (!can('habilitar')) action = h('div', { class: 'note' }, miss.length ? 'Faltan ' + miss.length + ' pasos obligatorios.' : 'Todo listo. La empresa revisa y habilita el servicio.');
    else action = h('div', { class: 'card row' }, h('div', {}, h('h3', {}, miss.length ? 'Faltan ' + miss.length + ' pasos obligatorios' : 'Todo listo'), h('span', { class: 'muted' }, miss.length ? miss.map(s => s.t).join(', ') : 'Al habilitarlo, sus usuarios ya pueden entrar al centro de mando.')), h('span', { class: 'sp' }),
      h('button', { class: 'btn pri lg', disabled: !!miss.length, onclick: () => {
        Reg.patch(ctx.slug, { estado: 'activo', habilitado: Date.now(), motivo: null }); const cf = config(ctx.slug); cf.pendiente = false; saveConfig(ctx.slug, cf);
        ctx.L('Servicio', 'Habilitó el servicio', ''); empresaLog('Habilitó', c.nombre); toast(c.nombre + ' habilitado'); go('/clientes'); } }, 'Habilitar servicio'));
    return { body: [action, h('div', { class: 'checklist' }, ...rows)] };
  },
};

async function showQR(ctx, u) {
  if (!u.placa) return toast('Primero escribe la placa del oficial');
  try { await loadLib('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', () => !!window.qrcode); } catch (e) { return toast(e.message); }
  const q = qrcode(0, 'M'); q.addData('MS:' + ctx.slug + ':' + u.placa); q.make();
  const img = h('div', { style: 'width:220px;height:220px;align-self:center' }); img.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  const sec = (ctx.cfg.sectores.find(s => s.id === u.sector) || {}).nombre || '';
  modal({ kicker: 'CREDENCIAL', title: u.oficial || 'Oficial', body: [ctx.c.logo ? h('img', { src: ctx.c.logo, style: 'height:44px;align-self:center' }) : null, img, h('p', { style: 'margin:0;text-align:center' }, 'Placa ' + u.placa + ' · Patrulla ' + u.id + ' · ' + sec), h('p', { class: 'muted', style: 'margin:0;text-align:center;font-size:12.5px' }, 'El ciudadano lo escanea para confirmar que el oficial es de ' + ctx.c.nombre + '.')],
    actions: [{ label: 'Imprimir', kind: 'pri', onClick: () => window.print() }] });
}

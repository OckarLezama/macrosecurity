// Empresa: Mis clientes y alta de cliente.
import { h, field, input, select, modal, toast, norm, slugify, fmtDate, isoDay, DAY, readImage, inkOn } from '../core/ui.js';
import { Reg, db, stats, vigencia, daysLeft, serviceTick, baseConfig, saveConfig, logChange, empresaLog, monthsBetween, today } from '../core/store.js';
import { who } from '../core/session.js';
import { layout, go, MANDO_URL } from '../core/shell.js';
import { progress } from './configurar.js';
import { startTour } from '../core/tour.js';

const TIPO = { municipio: 'Municipio', estado: 'Estado', corporacion: 'Corporación o dependencia' };
const ESTADO = { activo: ['ok', 'Habilitado'], configuracion: ['warn', 'En configuración'], suspendido: ['bad', 'Suspendido'] };
let filtro = 'todos', buscar = '';

const TOUR = [
  ['#btnNuevo', 'Empieza aquí: da de alta un cliente nuevo con sus datos, vigencia y colores.'],
  ['.cgrid .ccard', 'Cada cliente es una tarjeta. El botón grande te lleva a lo que sigue: configurarlo, abrir su centro de mando o renovar.'],
  ['.cgrid .clinks', 'Aquí están las demás acciones: ajustes, vigencia, bitácora, suspender o eliminar.'],
];

export function clientes() {
  const r = serviceTick();
  const n = k => k === 'todos' ? r.length : r.filter(c => c.estado === k).length;
  const list = r.filter(c => (filtro === 'todos' || c.estado === filtro) && (!buscar || norm(c.nombre + ' ' + (c.lugar || '')).includes(norm(buscar))))
    .sort((a, b) => ({ configuracion: 0, activo: 1, suspendido: 2 }[a.estado] - { configuracion: 0, activo: 1, suspendido: 2 }[b.estado]) || a.nombre.localeCompare(b.nombre));
  const chip = (k, l) => h('button', { class: 'fchip' + (filtro === k ? ' on' : ''), onclick: () => { filtro = k; clientes(); } }, l, h('b', {}, n(k)));
  const srch = r.length > 6 ? input(buscar, { ph: 'Buscar cliente', on: v => { buscar = v; clearTimeout(srch._t); srch._t = setTimeout(() => { clientes(); const s = document.querySelector('#cSearch'); s && s.focus(); s && s.setSelectionRange(99, 99); }, 250); }, id: 'cSearch' }) : null;
  if (srch) srch.style.maxWidth = '260px';
  const tour = () => startTour('clientes', TOUR, true);
  layout({ title: 'Mis clientes', tour }, h('div', { class: 'page' },
    h('div', { class: 'phd' }, h('div', {}, h('small', {}, 'Empresa'), h('h1', {}, 'Mis clientes'), h('p', {}, r.length + (r.length === 1 ? ' cliente' : ' clientes'))),
      h('span', { class: 'sp' }), h('button', { class: 'btn pri lg', id: 'btnNuevo', onclick: () => go('/clientes/nuevo') }, '+ Nuevo cliente')),
    h('div', { class: 'filters' }, chip('todos', 'Todos'), chip('activo', 'Habilitados'), chip('configuracion', 'En configuración'), chip('suspendido', 'Suspendidos'), h('span', { class: 'sp' }), srch),
    list.length ? h('div', { class: 'cgrid' }, ...list.map(card)) : h('div', { class: 'empty card' }, h('b', {}, 'No hay clientes en esta vista'), 'Cambia el filtro o da de alta uno nuevo.')));
  setTimeout(() => startTour('clientes', TOUR), 400);
}

function card(c) {
  const st = stats(c.slug); const v = vigencia(c); const [ek, el] = ESTADO[c.estado] || ['none', c.estado];
  let main;
  if (c.estado === 'configuracion') {
    const p = progress(c.slug);
    main = h('div', { class: 'stack', style: 'gap:12px' },
      h('div', { class: 'cprog' }, h('span', {}, p.done + ' de ' + p.total + ' pasos obligatorios listos'), h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(p.done / p.total * 100) + '%' }))),
      h('button', { class: 'btn pri lg', onclick: () => go('/c/' + c.slug + '/configurar') }, 'Continuar configuración'));
  } else if (c.estado === 'activo') {
    main = h('button', { class: 'btn pri lg', onclick: () => { location.href = MANDO_URL(c.slug); } }, 'Abrir centro de mando');
  } else {
    main = c.motivo === 'vencido' ? h('button', { class: 'btn pri lg', onclick: () => vigenciaModal(c.slug) }, 'Renovar servicio')
      : h('button', { class: 'btn pri lg', onclick: () => toggle(c.slug) }, 'Reactivar servicio');
  }
  const L = (t, fn, cls) => h('button', { class: cls || '', onclick: fn }, t);
  return h('article', { class: 'ccard' },
    h('div', { class: 'cch' }, h('div', { class: 'lg' }, c.logo ? h('img', { src: c.logo, alt: '' }) : c.nombre.slice(0, 2).toUpperCase()),
      h('div', {}, h('b', {}, c.nombre), h('span', {}, (c.lugar || '') + ' · ' + (TIPO[c.tipo || c.nivel] || 'Municipio'))), h('span', { class: 'badge ' + ek }, el)),
    h('div', { class: 'row', style: 'gap:6px' }, h('span', { class: 'badge ' + v.k }, v.t), c.colores ? h('span', { class: 'badge none', title: 'Colores institucionales' }, h('i', { style: 'width:10px;height:10px;border-radius:3px;background:' + c.colores.pri }), h('i', { style: 'width:10px;height:10px;border-radius:3px;background:' + c.colores.sec })) : null),
    st && st.terr ? h('div', { class: 'cstats' }, h('span', {}, h('b', {}, st.sect), 'sectores'), h('span', {}, h('b', {}, st.col), 'colonias'), h('span', {}, h('b', {}, st.pat), 'patrullas'), h('span', {}, h('b', {}, st.usr), 'usuarios'))
      : h('div', { class: 'cstats' }, h('span', {}, c.estado === 'activo' ? 'Los datos se preparan al abrir el centro de mando' : 'Aún sin territorio')),
    main,
    h('div', { class: 'clinks' },
      L(c.estado === 'activo' ? 'Ajustes' : 'Configuración', () => go('/c/' + c.slug + '/configurar')),
      L('Vigencia', () => vigenciaModal(c.slug)),
      L('Bitácora', () => go('/c/' + c.slug + '/bitacora')),
      c.estado === 'activo' ? L('Suspender', () => toggle(c.slug)) : null,
      L('Eliminar', () => eliminar(c.slug), 'dan')));
}

function toggle(slug) {
  const c = Reg.get(slug);
  if (c.estado === 'activo') {
    modal({ kicker: 'SUSPENDER SERVICIO', title: 'Suspender ' + c.nombre, body: h('p', { style: 'margin:0' }, 'Sus usuarios dejarán de entrar al centro de mando hasta que lo reactives. No se borra nada.'),
      actions: [{ label: 'Cancelar' }, { label: 'Suspender', kind: 'dan', onClick: ({ close }) => {
        const r = Reg.all(); const x = r.find(y => y.slug === slug); x.estado = 'suspendido'; x.motivo = 'manual'; (x.avisos = x.avisos || []).push({ k: 'm' + Date.now(), t: Date.now(), txt: 'Suspendido manualmente por la empresa.' }); Reg.save(r);
        empresaLog('Suspendió', c.nombre); logChange(slug, who(), 'Servicio', 'Suspendió el servicio'); close(); toast(c.nombre + ' suspendido'); clientes(); } }] });
  } else {
    const d = daysLeft(c); if (d != null && d <= 0) { toast('El servicio está vencido: registra la renovación para reactivarlo'); return vigenciaModal(slug); }
    Reg.patch(slug, { estado: 'activo', motivo: null }); empresaLog('Reactivó', c.nombre); logChange(slug, who(), 'Servicio', 'Reactivó el servicio'); toast(c.nombre + ' reactivado'); clientes();
  }
}

function eliminar(slug) {
  const c = Reg.get(slug);
  if (Reg.all().length <= 1) return toast('Debe quedar al menos un cliente');
  const i = input('', { ph: c.nombre });
  const m = modal({ kicker: 'ELIMINAR CLIENTE', title: 'Eliminar ' + c.nombre,
    body: [h('div', { class: 'note bad' }, 'Se borran su configuración, sectores, oficiales, usuarios, reportes y bitácora. No se puede deshacer.'), field('Escribe el nombre del cliente para confirmar', i)],
    actions: [{ label: 'Cancelar' }, { label: 'Eliminar definitivamente', kind: 'dan', id: 'delOk', disabled: true, onClick: ({ close }) => {
      Reg.remove(slug); empresaLog('Eliminó cliente', c.nombre); close(); toast(c.nombre + ' eliminado'); clientes(); } }] });
  i.addEventListener('input', () => { m.el.querySelector('#delOk').disabled = norm(i.value) !== norm(c.nombre); });
}

export function vigenciaModal(slug, after) {
  const c = Reg.get(slug); const sv = Object.assign({ inicio: today(), fin: isoDay(Date.now() + 365 * DAY), meses: 12 }, c.servicio || {});
  const i0 = input(sv.inicio, { type: 'date' }), i1 = input(sv.fin, { type: 'date' });
  const per = select([[1, '1 mes'], [3, '3 meses'], [6, '6 meses'], [12, '12 meses'], [24, '24 meses']], sv.meses);
  const hist = (c.pagos || []).slice().reverse().map(p => h('li', {}, fmtDate(p.t) + ' · renovado hasta ' + fmtDate(p.hasta + 'T12:00')));
  const avs = (c.avisos || []).slice().reverse().slice(0, 8).map(a => h('li', {}, fmtDate(a.t) + ' · ' + a.txt));
  const save = renew => {
    if (i1.value <= i0.value) { toast('El término debe ser posterior al inicio'); return false; }
    const r = Reg.all(); const x = r.find(y => y.slug === slug);
    x.servicio = { inicio: i0.value, fin: i1.value, meses: +per.value };
    if (renew) { const base = new Date(Math.max(Date.now(), new Date(i1.value + 'T12:00').getTime())); base.setMonth(base.getMonth() + (+per.value)); x.servicio.fin = isoDay(base); (x.pagos = x.pagos || []).push({ t: Date.now(), hasta: x.servicio.fin }); if (x.estado === 'suspendido' && x.motivo === 'vencido') { x.estado = 'activo'; x.motivo = null; } }
    Reg.save(r); empresaLog(renew ? 'Renovó servicio' : 'Cambió vigencia', c.nombre); logChange(slug, who(), 'Servicio', renew ? 'Renovó' : 'Cambió vigencia', x.servicio.inicio + ' a ' + x.servicio.fin);
    toast(renew ? 'Renovado hasta ' + fmtDate(x.servicio.fin + 'T12:00') : 'Vigencia guardada'); return true;
  };
  modal({ kicker: 'SERVICIO CONTRATADO', title: 'Vigencia de ' + c.nombre,
    body: [h('div', { class: 'grid3' }, field('Inicio', i0), field('Término', i1, 'Al día siguiente se suspende solo si no se renueva.'), field('Periodo de renovación', per)),
      h('div', { class: 'note' }, 'Avisos automáticos al cliente 90, 60, 30 y 7 días antes del término. Los ve dentro de la plataforma; por correo cuando esté conectada la base de datos.'),
      hist.length ? h('div', {}, h('b', {}, 'Renovaciones'), h('ul', { class: 'muted', style: 'margin:6px 0 0;padding-left:18px' }, hist)) : null,
      avs.length ? h('div', {}, h('b', {}, 'Avisos enviados'), h('ul', { class: 'muted', style: 'margin:6px 0 0;padding-left:18px' }, avs)) : null],
    actions: [{ label: 'Registrar pago y renovar', onClick: ({ close }) => { if (save(true)) { close(); (after || clientes)(); } } },
      { label: 'Guardar', kind: 'pri', onClick: ({ close }) => { if (save(false)) { close(); (after || clientes)(); } } }] });
}

/* ---------- alta de cliente ---------- */
export function colorPicker(k, nombre, disabled) {
  const st = { pri: (k && k.pri) || '#2B3138', sec: (k && k.sec) || '#0E9384' };
  const cp = h('input', { type: 'color', value: st.pri, disabled, 'aria-label': 'Color principal' }), cs = h('input', { type: 'color', value: st.sec, disabled, 'aria-label': 'Color de acento' });
  const pv = h('div', { class: 'cprev' });
  const draw = () => { st.pri = cp.value; st.sec = cs.value; pv.replaceChildren(h('div', { class: 'pb', style: 'background:' + st.pri + ';color:' + inkOn(st.pri) }, (nombre() || 'CLIENTE').toUpperCase()), h('div', { class: 'pc' }, h('span', { style: 'background:' + st.sec + ';color:' + inkOn(st.sec) }, 'Botón'))); };
  cp.oninput = draw; cs.oninput = draw; draw();
  const el = h('div', { class: 'colors' }, h('label', { class: 'cpick' }, cp, 'Principal'), h('label', { class: 'cpick' }, cs, 'Acento'), pv);
  return { el, value: () => (st.pri.toLowerCase() === '#2b3138' && st.sec.toLowerCase() === '#0e9384') ? null : { pri: st.pri, sec: st.sec }, redraw: draw, reset: () => { cp.value = '#2B3138'; cs.value = '#0E9384'; draw(); } };
}

export function nuevoCliente() {
  const f = { nombre: '', tipo: 'municipio', lugar: '', responsable: '', contacto: '', inicio: today(), fin: isoDay(Date.now() + 365 * DAY), logo: '' };
  const nom = input('', { ph: 'Ej. Tlaxcala', on: v => { f.nombre = v; col.redraw(); } });
  const lgp = h('div', { class: 'lgp' }, 'Logo');
  const col = colorPicker(null, () => f.nombre);
  const errs = h('div');
  const sec = (t, p, ...k) => h('section', { class: 'fsec' }, h('div', {}, h('b', {}, t), h('p', {}, p)), h('div', { class: 'stack' }, ...k));
  const submit = () => {
    const miss = []; if (!f.nombre.trim()) miss.push('nombre'); if (!f.lugar.trim()) miss.push('lugar que cubre'); if (!f.responsable.trim()) miss.push('responsable'); if (!f.contacto.trim()) miss.push('contacto');
    if (miss.length) { errs.replaceChildren(h('div', { class: 'note bad' }, 'Falta: ' + miss.join(', ') + '.')); return; }
    if (f.fin <= f.inicio) { errs.replaceChildren(h('div', { class: 'note bad' }, 'El término del servicio debe ser posterior al inicio.')); return; }
    const lugar = f.tipo === 'estado' && !/estado/i.test(f.lugar) ? 'Estado de ' + f.lugar.trim() : f.lugar.trim();
    const nl = t => norm(String(t || '').replace(/^(estado|municipio) de\s+/i, ''));
    const dup = Reg.all().find(x => nl(x.nombre) === nl(f.nombre) || nl(x.lugar) === nl(lugar));
    if (dup) { errs.replaceChildren(h('div', { class: 'note bad' }, 'Ya existe un cliente con ese nombre o lugar: ' + dup.nombre + '.')); return; }
    let sl = slugify(f.nombre), k = 2; while (Reg.get(sl)) sl = slugify(f.nombre) + '-' + (k++);
    Reg.add({ slug: sl, nombre: f.nombre.trim(), tipo: f.tipo, nivel: f.tipo === 'estado' ? 'estado' : 'municipio', lugar, responsable: f.responsable.trim(), contacto: f.contacto.trim(), logo: f.logo, colores: col.value(),
      estado: 'configuracion', creado: Date.now(), servicio: { inicio: f.inicio, fin: f.fin, meses: monthsBetween(f.inicio, f.fin) } });
    saveConfig(sl, baseConfig(f.nombre.trim()));
    empresaLog('Registró cliente', f.nombre.trim()); logChange(sl, who(), 'Datos del cliente', 'Registró el cliente', lugar);
    toast(f.nombre.trim() + ' registrado. Sigue con su territorio.');
    go('/c/' + sl + '/configurar/terr');
  };
  layout({ title: 'Nuevo cliente', section: 'Nuevo cliente' }, h('div', { class: 'page', style: 'width:min(980px,100%)' },
    h('div', { class: 'phd' }, h('div', {}, h('small', {}, 'Mis clientes'), h('h1', {}, 'Nuevo cliente'), h('p', {}, 'Primero se registra el cliente. Después configuras su territorio, oficiales y usuarios; no opera hasta que lo habilites.'))),
    h('div', { class: 'form' },
      sec('Datos', 'Quién es y qué territorio cubre.',
        h('div', { class: 'grid2' }, field('Nombre del cliente', nom), field('Tipo', select(Object.entries(TIPO), f.tipo, v => { f.tipo = v; })),
          field('Lugar que cubre', input('', { ph: 'Ej. Tlaxcala, Tlaxcala', on: v => { f.lugar = v; } }), 'Se usa para buscar su límite oficial.'),
          field('Responsable', input('', { ph: 'Nombre de quien autoriza', on: v => { f.responsable = v; } })),
          field('Contacto', input('', { ph: 'Correo o teléfono', on: v => { f.contacto = v; } })))),
      sec('Servicio', 'Periodo contratado. Se avisa 90, 60, 30 y 7 días antes y se suspende solo si no se renueva.',
        h('div', { class: 'grid2' }, field('Inicio', input(f.inicio, { type: 'date', on: v => { f.inicio = v; } })), field('Término', input(f.fin, { type: 'date', on: v => { f.fin = v; } })))),
      sec('Identidad', 'Logo y colores institucionales. Solo los ven los usuarios del cliente; tú sigues viendo los de la plataforma.',
        h('div', { class: 'logo-up' }, lgp, (() => { const inp = h('input', { type: 'file', accept: 'image/*', hidden: true }); inp.onchange = async () => { if (!inp.files[0]) return; f.logo = await readImage(inp.files[0]); lgp.replaceChildren(h('img', { src: f.logo, alt: '' })); }; return h('div', {}, inp, h('button', { class: 'btn', type: 'button', onclick: () => inp.click() }, 'Subir logo')); })()),
        field('Colores institucionales', col.el, 'Pide los códigos exactos de su manual de identidad. Los colores de riesgo y de las gráficas no cambian.')),
      errs,
      h('div', { class: 'factions' }, h('button', { class: 'btn lg', onclick: () => go('/clientes') }, 'Cancelar'), h('button', { class: 'btn pri lg', onclick: submit }, 'Registrar y configurar')))));
  nom.focus();
}

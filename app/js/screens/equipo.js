// Equipo de la empresa: el súper administrador da de alta a los administradores que crean y configuran clientes.
import { h, input, modal, toast, fmtDate, field } from '../core/ui.js';
import { equipo, saveEquipo, correoEnUso, tempPassword, hashPw, ROLES } from '../core/session.js';
import { layout } from '../core/shell.js';
import { empresaLog } from '../core/store.js';
import { showPw } from './configurar.js';

const PUEDE = {
  super: ['Crear y desactivar administradores de la empresa', 'Todo lo del administrador', 'Vigencia, suspensión y eliminación de clientes'],
  empresa: ['Crear clientes y configurarlos', 'Dar de alta a los administradores de cada cliente', 'Habilitar el servicio cuando el cliente está listo'],
};

export function equipoScreen() {
  const L = equipo();
  const alta = () => {
    const n = input('', { ph: 'Nombre completo' }), c = input('', { ph: 'correo@empresa.mx', type: 'email' }); const err = h('div');
    modal({ kicker: 'EQUIPO DE LA EMPRESA', title: 'Nuevo administrador', body: [field('Nombre', n), field('Correo', c), err],
      actions: [{ label: 'Cancelar' }, { label: 'Dar de alta', kind: 'pri', onClick: async ({ close }) => {
        const nombre = n.value.trim(), correo = c.value.trim().toLowerCase();
        if (!nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return err.replaceChildren(h('div', { class: 'note bad' }, 'Escribe el nombre y un correo válido.'));
        const uso = correoEnUso(correo); if (uso) return err.replaceChildren(h('div', { class: 'note bad' }, 'Ese correo ya tiene cuenta en ' + uso + '.'));
        const pw = tempPassword(); const all = equipo();
        all.push({ id: 'e' + Date.now().toString(36), nombre, correo, ph: await hashPw(correo, pw), tmp: true, activo: true, creado: Date.now() }); saveEquipo(all);
        empresaLog('Dio de alta administrador', nombre); close(); showPw([{ nombre, correo, pw }]); equipoScreen();
      } }] });
  };
  const reset = async e => { const pw = tempPassword(); const all = equipo(); const x = all.find(y => y.id === e.id); x.ph = await hashPw(x.correo, pw); x.tmp = true; saveEquipo(all); empresaLog('Asignó contraseña temporal', x.nombre); showPw([{ nombre: x.nombre, correo: x.correo, pw }]); equipoScreen(); };
  const toggle = e => { const all = equipo(); const x = all.find(y => y.id === e.id); x.activo = x.activo === false; saveEquipo(all); empresaLog(x.activo ? 'Reactivó administrador' : 'Desactivó administrador', x.nombre); toast(x.nombre + (x.activo ? ' reactivado' : ' desactivado')); equipoScreen(); };
  const row = e => h('div', { class: 'btr', style: 'grid-template-columns:minmax(0,1.2fr) minmax(0,1.3fr) 150px minmax(0,1fr)' },
    h('span', {}, h('b', {}, e.nombre), h('small', {}, 'Desde ' + fmtDate(e.creado))), h('span', {}, e.correo),
    h('span', {}, h('span', { class: 'badge ' + (e.activo === false ? 'bad' : e.tmp ? 'warn' : 'ok') }, e.activo === false ? 'Desactivado' : e.tmp ? 'Aún no entra' : 'Activo')),
    h('span', { class: 'row', style: 'justify-content:flex-end;gap:6px' }, e.activo !== false ? h('button', { class: 'btn sm', onclick: () => reset(e) }, 'Nueva contraseña') : null,
      h('button', { class: 'btn sm ghost', onclick: () => toggle(e) }, e.activo === false ? 'Reactivar' : 'Desactivar')));
  layout({ title: 'Equipo de la empresa', section: 'Equipo' }, h('div', { class: 'page' },
    h('div', { class: 'phd' }, h('div', {}, h('small', {}, 'Súper administrador'), h('h1', {}, 'Equipo de la empresa'), h('p', {}, 'Los administradores que das de alta aquí crean y configuran clientes. Cada cliente tiene después sus propios administradores.')),
      h('span', { class: 'sp' }), h('button', { class: 'btn pri lg', onclick: alta }, '+ Nuevo administrador')),
    h('div', { class: 'btbl' }, h('div', { class: 'btr th', style: 'grid-template-columns:minmax(0,1.2fr) minmax(0,1.3fr) 150px minmax(0,1fr)' }, h('span', {}, 'Nombre'), h('span', {}, 'Correo'), h('span', {}, 'Estado'), h('span')),
      ...(L.length ? L.map(row) : [h('div', { class: 'empty' }, h('b', {}, 'Aún no hay administradores'), 'Da de alta a quienes van a crear y configurar clientes.')])),
    h('div', { class: 'grid2' }, ...Object.entries(PUEDE).map(([k, t]) => h('div', { class: 'card' }, h('h3', {}, ROLES[k]), h('ul', { style: 'margin:8px 0 0;padding-left:18px;color:var(--muted)' }, ...t.map(x => h('li', {}, x))))))));
}

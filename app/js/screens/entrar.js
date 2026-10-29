// Entrada: ¿quién entra?
import { h, $, SHIELD } from '../core/ui.js';
import { Reg, db } from '../core/store.js';
import { login, ROLES, ROLE_HELP } from '../core/session.js';
import { go } from '../core/shell.js';

export function entrar() {
  document.title = 'Entrar · Macro Security';
  const root = h('div', { class: 'entry' });
  $('#app').replaceChildren(root);
  const shell = (...k) => root.replaceChildren(h('div', { class: 'enbox' },
    h('div', { class: 'enlogo' }, SHIELD('#2EC4A6', 30), h('b', {}, 'MACRO SECURITY')), ...k,
    h('small', { class: 'ennote' }, 'Versión piloto. Con la base de datos conectada, aquí se entra con correo y contraseña.')));
  const opt = (ic, title, sub, fn) => h('button', { class: 'enopt', onclick: fn }, h('span', { class: 'ic' }, ic), h('span', {}, h('b', {}, title), h('span', {}, sub)), h('em', {}, '›'));

  const step1 = () => shell(h('h1', {}, '¿Quién entra?'),
    h('div', { class: 'enopts' },
      opt('E', 'Empresa', 'Das de alta clientes, configuras su servicio y lo habilitas.', () => { login('empresa', 'Empresa', null); go('/clientes'); }),
      opt('C', 'Usuario de un cliente', 'Municipio, estado o corporación que opera su centro de mando.', step2)));

  const step2 = () => {
    const r = Reg.all();
    shell(h('h1', {}, '¿De qué cliente?'),
      h('div', { class: 'enopts' }, ...r.map(c => opt(c.nombre.slice(0, 2).toUpperCase(), c.nombre,
        (c.lugar || '') + (c.estado === 'configuracion' ? ' · en configuración' : c.estado === 'suspendido' ? ' · suspendido' : ''), () => step3(c)))),
      h('button', { class: 'btn enback', onclick: step1 }, '‹ Regresar'));
  };

  const step3 = c => {
    const U = db(c.slug).list('usuarios').filter(u => u.correo);
    const enter = (rol, nombre) => { login(rol, nombre, c.slug); go('/c/' + c.slug); };
    shell(h('h1', {}, '¿Quién eres?'), h('p', { class: 'ensub' }, c.nombre),
      U.length
        ? h('div', { class: 'enopts' }, ...U.map(u => opt((u.nombre || u.correo).slice(0, 1).toUpperCase(), u.nombre || u.correo, ROLES[u.rol] || u.rol, () => enter(u.rol, u.nombre || u.correo))))
        : h('div', { class: 'stack' }, h('p', { class: 'ensub' }, 'Este cliente todavía no tiene usuarios. La empresa los da de alta en su configuración. Para probar, entra con un rol:'),
          h('div', { class: 'enopts' }, ...Object.keys(ROLE_HELP).map(k => opt(ROLES[k].slice(0, 1), ROLES[k], ROLE_HELP[k], () => enter(k, ROLES[k]))))),
      h('button', { class: 'btn enback', onclick: step2 }, '‹ Regresar'));
  };
  step1();
}

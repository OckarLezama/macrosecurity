// Acceso: correo y contraseña. La cuenta decide a dónde entra cada quien.
import { h, $, SHIELD } from '../core/ui.js';
import { ses, login, logout, autenticar, empresaCuentas, crearEmpresa, cambiarPassword, ROLES } from '../core/session.js';
import { go } from '../core/shell.js';

const home = s => s.rol === 'empresa' ? '/clientes' : '/c/' + s.cliente;

export function entrar() {
  document.title = 'Acceso · Macro Security';
  const root = h('div', { class: 'entry' });
  $('#app').replaceChildren(root);
  const shell = (...k) => { root.replaceChildren(h('form', { class: 'enbox', novalidate: true, onsubmit: e => e.preventDefault() },
    h('div', { class: 'enlogo' }, SHIELD('#2EC4A6', 30), h('b', {}, 'MACRO SECURITY')), ...k)); const f = root.querySelector('input'); if (f) f.focus(); };
  const err = h('div', { class: 'enerr', role: 'alert' });
  const fld = (label, type, ac) => { const i = h('input', { class: 'inp enin', type, autocomplete: ac }); return [h('label', { class: 'enlbl' }, h('span', {}, label), i), i]; };
  const pwField = (label, ac) => {
    const [lb, i] = fld(label, 'password', ac);
    const t = h('button', { type: 'button', class: 'eneye', 'aria-label': 'Mostrar contraseña', onclick: () => { i.type = i.type === 'password' ? 'text' : 'password'; t.textContent = i.type === 'password' ? 'Mostrar' : 'Ocultar'; } }, 'Mostrar');
    lb.append(t); return [lb, i];
  };
  const fail = m => { err.textContent = m; err.hidden = false; };

  // Primera vez: se crea la cuenta de la empresa.
  const primera = () => {
    const [l0, n] = fld('Nombre de la empresa', 'text', 'organization'), [l1, c] = fld('Correo', 'email', 'username'), [l2, p] = pwField('Contraseña', 'new-password'), [l3, p2] = pwField('Confirma la contraseña', 'new-password');
    err.hidden = true;
    shell(h('h1', {}, 'Crea la cuenta de la empresa'), h('p', { class: 'ensub' }, 'Es la cuenta de súper administrador: da de alta a los clientes y configura su servicio.'),
      h('div', { class: 'encard' }, l0, l1, l2, l3, err, h('button', { class: 'btn pri lg', type: 'submit', onclick: async () => {
        if (!n.value.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.value.trim())) return fail('Escribe el nombre y un correo válido.');
        if (p.value.length < 8) return fail('La contraseña debe tener al menos 8 caracteres.');
        if (p.value !== p2.value) return fail('Las contraseñas no coinciden.');
        await crearEmpresa(n.value.trim(), c.value, p.value); login('empresa', n.value.trim(), null); go('/clientes');
      } }, 'Crear cuenta y entrar')));
  };

  // Contraseña temporal: la persona crea la suya al primer acceso.
  const nueva = a => {
    const [l1, p] = pwField('Nueva contraseña', 'new-password'), [l2, p2] = pwField('Confírmala', 'new-password'); err.hidden = true;
    shell(h('h1', {}, 'Crea tu contraseña'), h('p', { class: 'ensub' }, 'Entraste con una contraseña temporal. Elige una nueva para continuar.'),
      h('div', { class: 'encard' }, l1, l2, err, h('button', { class: 'btn pri lg', type: 'submit', onclick: async () => {
        if (p.value.length < 8) return fail('Debe tener al menos 8 caracteres.');
        if (p.value !== p2.value) return fail('Las contraseñas no coinciden.');
        await cambiarPassword(a.cliente, a.id, a.correo, p.value); login(a.rol, a.nombre, a.cliente); go(home(a));
      } }, 'Guardar y entrar')));
  };

  const acceso = () => {
    const [l1, c] = fld('Correo', 'email', 'username'), [l2, p] = pwField('Contraseña', 'current-password'); err.hidden = true;
    const btn = h('button', { class: 'btn pri lg', type: 'submit', onclick: async () => {
      if (!c.value.trim() || !p.value) return fail('Escribe tu correo y tu contraseña.');
      btn.disabled = true;
      const a = await autenticar(c.value, p.value); btn.disabled = false;
      if (!a) { p.value = ''; return fail('Correo o contraseña incorrectos.'); }
      a.correo = c.value.trim().toLowerCase();
      if (a.tmp) return nueva(a);
      login(a.rol, a.nombre, a.cliente); go(home(a));
    } }, 'Entrar');
    shell(h('h1', {}, 'Acceso'), h('div', { class: 'encard' }, l1, l2, err, btn,
      h('p', { class: 'enhelp' }, '¿Olvidaste tu contraseña? Pídele al administrador de tu servicio que te asigne una nueva.')));
  };

  // Sesión abierta en esta pestaña: continuar o entrar con otra cuenta.
  const abierta = s => shell(h('h1', {}, 'Sesión abierta'), h('div', { class: 'encard' },
    h('div', { class: 'enwho' }, h('b', {}, s.nombre), h('span', {}, s.rol === 'empresa' ? 'Súper administrador' : ROLES[s.rol])),
    h('button', { class: 'btn pri lg', type: 'button', onclick: () => go(home(s)) }, 'Continuar'),
    h('button', { class: 'btn lg', type: 'button', onclick: () => { logout(); acceso(); } }, 'Entrar con otra cuenta')));

  const s = ses();
  if (!empresaCuentas().length) primera();
  else if (s) abierta(s);
  else acceso();
}

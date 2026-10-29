// Arranque y rutas.
import { h } from './core/ui.js';
import { Reg, serviceTick } from './core/store.js';
import { ses, logout, can, canSee, isEmpresa } from './core/session.js';
import { go, applyTheme, fullMessage, MANDO_URL } from './core/shell.js';
import { entrar } from './screens/entrar.js';
import { clientes, nuevoCliente } from './screens/clientes.js';
import { configurar } from './screens/configurar.js';
import { bitacora } from './screens/bitacora.js';
import { equipoScreen } from './screens/equipo.js';

/* ---------- rutas ---------- */
function route() {
  serviceTick();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const s = ses();
  if (parts[0] === 'entrar' || !s || !parts.length) { applyTheme(null); return entrar(); }
  const home = () => isEmpresa() ? '/clientes' : '/c/' + s.cliente;

  if (parts[0] === 'equipo') return can('equipo') ? equipoScreen() : go(home());
  if (parts[0] === 'clientes') {
    if (!can('clientes')) return go(home());
    return parts[1] === 'nuevo' ? nuevoCliente() : clientes();
  }
  if (parts[0] === 'c' && parts[1]) {
    const slug = parts[1]; const c = Reg.get(slug);
    if (!c || !canSee(slug)) return go(home());
    if (c.estado === 'suspendido' && !isEmpresa()) {
      return fullMessage({ slug }, 'Servicio suspendido', c.motivo === 'vencido' ? 'El periodo contratado venció sin renovación. Comunícate con la empresa para reactivarlo.' : 'Este servicio está suspendido. Comunícate con la empresa.',
        [h('button', { class: 'btn', onclick: () => { logout(); go('/entrar'); } }, 'Cambiar de usuario')]);
    }
    if (parts[2] === 'configurar') { if (!can('cfg')) return go('/c/' + slug); return configurar(slug, parts[3]); }
    if (parts[2] === 'bitacora') { if (!can('bitacora')) return go('/c/' + slug); return bitacora(slug); }
    // centro de mando
    if (c.estado === 'configuracion') {
      if (can('cfg')) return go('/c/' + slug + '/configurar');
      return fullMessage({ slug }, 'El servicio se está configurando', 'Cuando la empresa lo habilite, aquí verás el centro de mando de ' + c.nombre + '.',
        [h('button', { class: 'btn', onclick: () => { logout(); go('/entrar'); } }, 'Cambiar de usuario')]);
    }
    location.replace(MANDO_URL(slug)); return;
  }
  go(home());
}
addEventListener('hashchange', route);
route();

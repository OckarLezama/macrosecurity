// Bitácora de cambios del cliente, con sello de integridad encadenado.
import { h, input, toast, norm, fmtDT, download } from '../core/ui.js';
import { Reg, db, verifyChain } from '../core/store.js';
import { isEmpresa, ROLES } from '../core/session.js';
import { layout, go } from '../core/shell.js';

export function bitacora(slug) {
  const c = Reg.get(slug); const all = db(slug).list('bitacora').sort((a, b) => b.t - a.t);
  // Tras la entrega firmada, la empresa solo ve quién, cuándo y en qué área.
  const resumen = isEmpresa() && !!c.entregado;
  let q = '';
  const tbl = h('div', { class: 'btbl' });
  const draw = () => {
    const qq = norm(q); const L = all.filter(e => !qq || norm(e.quien + ' ' + e.area + ' ' + e.accion + ' ' + (ROLES[e.rol] || '') + ' ' + (resumen ? '' : e.detalle)).includes(qq));
    tbl.replaceChildren(h('div', { class: 'btr th' }, h('span', {}, 'Fecha'), h('span', {}, 'Quién'), h('span', {}, 'Área'), h('span', {}, 'Acción'), h('span', {}, resumen ? '' : 'Detalle')),
      ...(L.length ? L.map(e => h('div', { class: 'btr' }, h('span', {}, fmtDT(e.t)), h('span', {}, h('b', {}, e.quien), h('small', {}, ROLES[e.rol] || e.rol)), h('span', {}, e.area), h('span', {}, e.accion), h('span', { class: 'muted' }, resumen ? '' : e.detalle)))
        : [h('div', { class: 'empty' }, h('b', {}, q ? 'Sin resultados' : 'Aún no hay cambios registrados'))]));
  };
  draw();
  const exp = async () => {
    const asc = all.slice().sort((a, b) => a.t - b.t); const v = await verifyChain(asc);
    download('bitacora_' + slug + '_' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ cliente: c.nombre, generado: new Date().toISOString(), integridad: v.ok ? 'verificada' : 'ALTERADA', sello_final: v.last, registros: asc }, null, 2));
    toast(v.ok ? 'Bitácora descargada · integridad verificada' : 'Atención: la cadena de integridad no coincide');
  };
  const si = input('', { ph: 'Buscar por persona, área o acción', on: v => { q = v; draw(); } }); si.style.maxWidth = '340px';
  layout({ slug, title: 'Bitácora · ' + c.nombre, section: 'Bitácora' }, h('div', { class: 'page' },
    h('div', { class: 'phd', style: 'justify-content:space-between' }, h('div', { style: 'max-width:640px' }, h('small', {}, 'Registro de cambios'), h('h1', {}, 'Bitácora'), h('p', {}, 'Cada ajuste queda registrado con quién lo hizo y cuándo. Los registros están encadenados: si alguien altera uno, la descarga lo detecta.')),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go('/c/' + slug + '/configurar') }, c.estado === 'activo' ? 'Ajustes' : 'Configuración'), !resumen ? h('button', { class: 'btn pri', onclick: exp }, 'Descargar con sello de integridad') : null)),
    resumen ? h('div', { class: 'note' }, 'El cliente ya recibió el servicio: como empresa ves quién hizo cada cambio, cuándo y en qué área. El detalle es solo del cliente.') : null,
    h('div', { class: 'row' }, si, h('span', { class: 'sp' }), h('span', { class: 'muted' }, all.length + ' registros')), tbl));
}

// Territorio: límites, sectores y colonias en el sistema de coordenadas del mapa
// (x,y en unidades de `mpu` metros, origen en geo.lng0/lat0). Mismo formato del centro de mando.
import { h } from './ui.js';

export function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
export function inPoly(x, y, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }
export function centroid(p) { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return { x: x / p.length, y: y / p.length }; }
export function randIn(poly) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  for (let i = 0; i < 300; i++) { const x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + Math.random() * (Math.max(...ys) - Math.min(...ys)); if (inPoly(x, y, poly)) return { x, y }; }
  return centroid(poly);
}
export const km2 = (poly, mpu) => Math.abs(area(poly)) * mpu * mpu / 1e6;

function clipRect(poly, x0, x1, y0, y1) {
  const clip = (pts, inside, inter) => { const out = []; for (let i = 0; i < pts.length; i++) { const P = pts[i], Q = pts[(i + 1) % pts.length]; const pi = inside(P), qi = inside(Q); if (pi) out.push(P); if (pi !== qi) out.push(inter(P, Q)); } return out; };
  const ix = (P, Q, x) => [x, P[1] + (Q[1] - P[1]) * (x - P[0]) / (Q[0] - P[0])], iy = (P, Q, y) => [P[0] + (Q[0] - P[0]) * (y - P[1]) / (Q[1] - P[1]), y];
  let r = poly; r = clip(r, p => p[0] >= x0, (P, Q) => ix(P, Q, x0)); if (!r.length) return r; r = clip(r, p => p[0] <= x1, (P, Q) => ix(P, Q, x1)); if (!r.length) return r;
  r = clip(r, p => p[1] >= y0, (P, Q) => iy(P, Q, y0)); if (!r.length) return r; return clip(r, p => p[1] <= y1, (P, Q) => iy(P, Q, y1));
}

/* ---------- límite oficial (OpenStreetMap / Nominatim) ---------- */
export async function searchLimit(q, nivel) {
  const base = 'https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&polygon_threshold=0.0005&countrycodes=mx&limit=5&accept-language=es';
  const qs = nivel === 'estado'
    ? ['&featuretype=state&q=' + encodeURIComponent(q.replace(/^estado de\s+/i, '')), '&q=' + encodeURIComponent(q)]
    : ['&q=' + encodeURIComponent(/^municipio/i.test(q) ? q : 'Municipio de ' + q), '&q=' + encodeURIComponent(q)];
  for (const s of qs) {
    const js = await (await fetch(base + s)).json();
    const p = js.find(x => x.geojson && /Polygon/.test(x.geojson.type) && (nivel === 'estado' ? x.addresstype === 'state' : x.addresstype !== 'state'));
    if (p) return p;
    await new Promise(r => setTimeout(r, 1100));
  }
  return null;
}
// Arma el territorio desde el límite: cuadrícula de sectores recortada al límite.
export function fromPlace(r) {
  const bb = r.boundingbox.map(Number); const [S0, N0, W0, E0] = bb; const latc = (S0 + N0) / 2;
  const kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 111000;
  const mpu = Math.max((E0 - W0) * kx / 96, (N0 - S0) * ky / 66, 20); const lng0 = (W0 + E0) / 2, lat0 = N0 + 2 * mpu / ky;
  const toW = (lng, lat) => [+(50 + (lng - lng0) * kx / mpu).toFixed(2), +((lat0 - lat) * ky / mpu).toFixed(2)];
  const polys = r.geojson.type === 'Polygon' ? [r.geojson.coordinates] : r.geojson.coordinates;
  let best = polys[0], ba = 0; for (const p of polys) { const a = Math.abs(area(p[0])); if (a > ba) { ba = a; best = p; } }
  const o = best[0]; const step = Math.max(1, Math.ceil(o.length / 600)); const lim = o.filter((_, i) => i % step === 0).map(q => toW(q[0], q[1]));
  const xs = lim.map(q => q[0]), ys = lim.map(q => q[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k2 = km2(lim, mpu); const cols = k2 > 40 ? 3 : 2, rows = k2 > 250 ? 3 : 2;
  const N3 = [['Noroeste', 'Norte', 'Noreste'], ['Poniente', 'Centro', 'Oriente'], ['Suroeste', 'Sur', 'Sureste']];
  const names = rows === 3 ? N3 : (cols === 3 ? [N3[0], N3[2]] : [['Noroeste', 'Noreste'], ['Suroeste', 'Sureste']]);
  const sect = [];
  for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
    const poly = clipRect(lim, x0 + (x1 - x0) * cc / cols, x0 + (x1 - x0) * (cc + 1) / cols, y0 + (y1 - y0) * rr / rows, y0 + (y1 - y0) * (rr + 1) / rows);
    if (poly.length < 3 || Math.abs(area(poly)) < 2) continue;
    sect.push({ id: 's' + (sect.length + 1), nombre: names[rr][cc], poly: poly.map(q => [+q[0].toFixed(2), +q[1].toFixed(2)]) });
  }
  return { mpu: +mpu.toFixed(1), geo: { lat0, lng0, kx, ky }, limite: lim, sectores: sect, colonias: [], lugarOficial: r.display_name };
}

/* ---------- archivo del cliente (GeoJSON / KML) ---------- */
function parseKML(txt) {
  const d = new DOMParser().parseFromString(txt, 'text/xml'); const out = [];
  d.querySelectorAll('Placemark').forEach(pm => {
    const nm = (pm.querySelector('name') || {}).textContent || '';
    const capaEl = [...pm.querySelectorAll('Data,SimpleData')].find(x => /capa|tipo|nivel/i.test(x.getAttribute('name') || ''));
    const capa = capaEl ? (capaEl.textContent || '').trim().toLowerCase() : '';
    pm.querySelectorAll('Polygon').forEach(pg => { const c = pg.querySelector('outerBoundaryIs coordinates'); if (!c) return; const ring = c.textContent.trim().split(/\s+/).map(t => t.split(',').map(Number)).filter(q => q.length >= 2 && !isNaN(q[0])); out.push({ type: 'Feature', properties: { nombre: nm.trim(), capa }, geometry: { type: 'Polygon', coordinates: [ring] } }); });
    pm.querySelectorAll('Point coordinates').forEach(c => { const q = c.textContent.trim().split(',').map(Number); out.push({ type: 'Feature', properties: { nombre: nm.trim(), capa }, geometry: { type: 'Point', coordinates: q } }); });
  });
  return { type: 'FeatureCollection', features: out };
}
const readGeo = async file => { const txt = await file.text(); return /\.kml$/i.test(file.name) ? parseKML(txt) : JSON.parse(txt); };
const nameOf = p => String(p.nombre || p.Nombre || p.NOMBRE || p.name || p.Name || p.COLONIA || p.colonia || p.SECTOR || p.sector || '').trim();
const outer = g => { if (!g) return null; if (g.type === 'Polygon') return g.coordinates[0]; if (g.type === 'MultiPolygon') { let b = null, ba = 0; for (const p of g.coordinates) { const a = Math.abs(area(p[0])); if (a > ba) { ba = a; b = p[0]; } } return b; } return null; };
const tc = s => s.toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());
const thinW = (r, max, toW) => { const st = Math.max(1, Math.ceil(r.length / max)); return r.filter((_, i) => i % st === 0).map(q => toW(q[0], q[1])); };
const toWorld = (g, mpu) => (lng, lat) => [+(50 + (lng - g.lng0) * g.kx / mpu).toFixed(2), +((g.lat0 - lat) * g.ky / mpu).toFixed(2)];

// Lee un archivo con límite, sectores y/o colonias. Si solo trae colonias, usa el territorio actual.
export async function fromFile(file, cur) {
  const gj = await readGeo(file);
  const secF = [], colF = []; let limR = null;
  for (const f of gj.features || []) {
    const p = f.properties || {}; const r = outer(f.geometry); if (!r || r.length < 4) continue;
    const capa = String(p.capa || p.tipo || p.nivel || '').toLowerCase();
    if (capa === 'limite' || capa === 'límite') limR = r;
    else if (capa.startsWith('colon') || p.COLONIA != null || p.colonia != null || (/colon/i.test(file.name) && !capa)) colF.push({ n: nameOf(p), cp: String(p.cp || p.COD_POS || p.CP || '').trim(), r });
    else secF.push({ n: nameOf(p), r });
  }
  if (!secF.length && !colF.length && !limR) throw new Error('El archivo no trae polígonos.');
  if (!secF.length) {
    if (!cur || !cur.geo) throw new Error('El archivo solo trae colonias. Primero carga el límite y los sectores.');
    const toW = toWorld(cur.geo, cur.mpu);
    return { colonias: colF.map((c, i) => ({ id: 'c' + (i + 1), nombre: c.n || 'Colonia ' + (i + 1), cp: c.cp, poly: thinW(c.r, 80, toW) })) };
  }
  const all = (limR ? [limR] : secF.map(x => x.r)).flat(); const lons = all.map(q => q[0]), lats = all.map(q => q[1]);
  const W0 = Math.min(...lons), E0 = Math.max(...lons), S0 = Math.min(...lats), N0 = Math.max(...lats); const latc = (S0 + N0) / 2;
  const kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 111000; const mpu = Math.max((E0 - W0) * kx / 96, (N0 - S0) * ky / 66, 20);
  const geo = { lat0: N0 + 2 * mpu / ky, lng0: (W0 + E0) / 2, kx, ky }; const toW = toWorld(geo, mpu);
  const sectores = secF.map((x, i) => ({ id: 's' + (i + 1), nombre: tc(x.n || 'Sector ' + (i + 1)).replace(/^Sector\s+/i, 'Sector '), poly: thinW(x.r, 500, toW) }));
  let limite = limR ? thinW(limR, 800, toW) : null;
  if (!limite) { // sin límite: el contorno de los sectores
    const pts = sectores.flatMap(s => s.poly); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    limite = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)], [Math.min(...xs), Math.max(...ys)]];
  }
  return { mpu: +mpu.toFixed(1), geo, limite, sectores, colonias: colF.map((c, i) => ({ id: 'c' + (i + 1), nombre: c.n || 'Colonia ' + (i + 1), cp: c.cp, poly: thinW(c.r, 80, toW) })) };
}
// Puntos (zonas seguras, botones): CSV nombre,lat,lng o KML/GeoJSON de puntos.
export async function pointsFromFile(file, cur) {
  const out = [];
  if (/\.csv$/i.test(file.name)) {
    const ln = (await file.text()).split(/\r?\n/).filter(x => x.trim()); const sep = ln[0].includes(';') ? ';' : ',';
    const hd = ln[0].split(sep).map(x => x.trim().toLowerCase()); const iN = hd.findIndex(x => x.startsWith('nombre')), iLa = hd.findIndex(x => x.startsWith('lat')), iLo = hd.findIndex(x => x.startsWith('lon') || x.startsWith('lng'));
    if (iLa < 0 || iLo < 0) throw new Error('Faltan las columnas lat y lng');
    for (const l of ln.slice(1)) { const c = l.split(sep); const la = parseFloat(c[iLa]), lo = parseFloat(c[iLo]); if (!isNaN(la) && !isNaN(lo)) out.push({ nombre: (c[iN] || '').trim() || 'Punto ' + (out.length + 1), lng: lo, lat: la }); }
  } else {
    const gj = await readGeo(file);
    for (const f of gj.features || []) if (f.geometry && f.geometry.type === 'Point') out.push({ nombre: nameOf(f.properties || {}) || 'Punto ' + (out.length + 1), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] });
  }
  if (!out.length) throw new Error('El archivo no trae puntos');
  const toW = toWorld(cur.geo, cur.mpu);
  return out.map(p => { const [x, y] = toW(p.lng, p.lat); return { nombre: p.nombre, x, y }; });
}

/* ---------- revisión de cobertura ---------- */
export function coverage(c) {
  const L = c.limite && c.limite.length ? c.limite : null; if (!L || !c.sectores.length) return null;
  const xs = L.map(p => p[0]), ys = L.map(p => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let tot = 0, gap = 0, ov = 0;
  for (let i = 0; i < 70; i++) for (let j = 0; j < 70; j++) { const x = x0 + (x1 - x0) * (i + .5) / 70, y = y0 + (y1 - y0) * (j + .5) / 70; if (!inPoly(x, y, L)) continue; tot++; let n = 0; for (const s of c.sectores) if (inPoly(x, y, s.poly)) n++; if (!n) gap++; if (n > 1) ov++; }
  return tot ? { gap: gap / tot, ov: ov / tot } : null;
}

/* ---------- vista previa del territorio (SVG, sin mapa) ---------- */
const PAL = ['#0E9384', '#3B78E7', '#E9A21F', '#7E62D9', '#EE6A2F', '#1C9E69', '#C2343F', '#2F6FDE', '#B38E5D', '#5B6879'];
export function preview(c, { colonias = true, points = [] } = {}) {
  const ns = 'http://www.w3.org/2000/svg'; const mk = (t, a) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const all = [...(c.limite || []), ...(c.sectores || []).flatMap(s => s.poly)]; if (!all.length) return null;
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(x1 - x0, y1 - y0) * .04; const W = x1 - x0 + pad * 2, H = y1 - y0 + pad * 2; const sw = Math.max(W, H) / 400;
  const svg = mk('svg', { viewBox: [x0 - pad, y0 - pad, W, H].join(' '), preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Vista previa del territorio' });
  const d = p => 'M' + p.map(q => q[0] + ',' + q[1]).join('L') + 'Z';
  (c.sectores || []).forEach((s, i) => svg.append(mk('path', { d: d(s.poly), fill: PAL[i % PAL.length], 'fill-opacity': .16, stroke: PAL[i % PAL.length], 'stroke-width': sw * 1.4 })));
  if (colonias) for (const co of c.colonias || []) svg.append(mk('path', { d: d(co.poly), fill: 'none', stroke: '#5B6879', 'stroke-opacity': .35, 'stroke-width': sw * .5 }));
  if (c.limite && c.limite.length) svg.append(mk('path', { d: d(c.limite), fill: 'none', stroke: '#17212E', 'stroke-width': sw * 2.2, 'stroke-linejoin': 'round' }));
  for (const p of points) svg.append(mk('circle', { cx: p.x, cy: p.y, r: sw * 5, fill: p.color || '#C2343F', stroke: '#fff', 'stroke-width': sw * 1.5 }));
  (c.sectores || []).forEach((s, i) => { const ce = centroid(s.poly); const t = mk('text', { x: ce.x, y: ce.y, 'font-size': sw * 13, 'font-weight': 800, 'text-anchor': 'middle', fill: '#17212E', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': sw * 3 }); t.textContent = s.nombre; svg.append(t); });
  const legend = h('div', { class: 'prevlg' },
    h('span', {}, h('i', { style: 'background:#17212E' }), 'Límite'),
    h('span', {}, h('i', { style: 'background:' + PAL[0] + ';opacity:.5' }), (c.sectores || []).length + ' sectores'),
    (c.colonias || []).length && colonias ? h('span', {}, h('i', { style: 'border:1px solid #5B6879' }), c.colonias.length + ' colonias') : null,
    c.mpu && c.limite ? h('span', {}, Math.round(km2(c.limite, c.mpu)).toLocaleString('es-MX') + ' km²') : null);
  return h('div', { class: 'prev' }, svg, legend);
}

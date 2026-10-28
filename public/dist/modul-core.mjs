// MODUL-AI | Motor de exploración heurística conceptual v0.5
// Unidades: metros. No valida normas, estructura, salubridad ni accesibilidad.
// Retícula de trabajo: medio módulo (u). La franja posterior de un módulo queda reservada.
export const ALTERNATIVES = ['A', 'B', 'C'];
export const VARIANT_NAMES = {A: 'Equilibrio', B: 'Privacidad', C: 'Servicios'};
export const TYPE_NAMES = {social: 'Área social', kitchen: 'Cocina', bedroom: 'Dormitorio', bath: 'Baño', other: 'Otro', hall: 'Circulación'};
const clone = x => JSON.parse(JSON.stringify(x));
const EPS = 1e-5;
export const isHall = r => r?.type === 'hall';

export function validateInput(i) {
  const d = {name: String(i?.name || '').trim(), width: Number(i?.width), depth: Number(i?.depth),
    module: Number(i?.module), bedrooms: Number(i?.bedrooms), bathrooms: Number(i?.bathrooms)};
  if (!d.name || d.name.length > 100) throw Error('El proyecto necesita un nombre de 1 a 100 caracteres.');
  if (!(d.width >= 7.2 && d.width <= 60 && d.depth >= 9.6 && d.depth <= 60)) throw Error('El ancho debe ser 7,2–60 m y el fondo 9,6–60 m.');
  if (!(d.module >= 2.4 && d.module <= 4.8)) throw Error('El módulo debe medir entre 2,4 y 4,8 m.');
  if (!Number.isInteger(d.bedrooms) || d.bedrooms < 1 || d.bedrooms > 6) throw Error('Dormitorios: de 1 a 6.');
  if (!Number.isInteger(d.bathrooms) || d.bathrooms < 1 || d.bathrooms > 3) throw Error('Baños: de 1 a 3.');
  const u = d.module / 2, cols = Math.floor(d.width / u + EPS), rows = Math.floor((d.depth - d.module) / u + EPS);
  if (cols < 4 || rows < 4) throw Error('El área útil no admite la retícula y la reserva posterior.');
  if (cols * rows > 3000) throw Error('Retícula demasiado extensa para el explorador local.');
  return {...d, u, cols, rows, usableWidth: cols * u, usableDepth: rows * u};
}

// Programa arquitectónico. w = [mínimo, preferido, máximo] del frente de cada ambiente, en metros.
export function program(input) {
  const rooms = [
    {id: 'SAL', name: 'Sala', type: 'social', zone: 'front', w: [3.0, 4.5, 6.0]},
    {id: 'COM', name: 'Comedor', type: 'social', zone: 'front', w: [2.4, 3.0, 4.5]},
    {id: 'COC', name: 'Cocina', type: 'kitchen', zone: 'front', w: [2.4, 3.0, 4.2]}];
  for (let n = 1; n <= input.bedrooms; n++) rooms.push({id: 'D' + String(n).padStart(2, '0'), name: 'Dormitorio ' + n, type: 'bedroom', zone: 'back', w: n === 1 ? [3.0, 3.6, 4.8] : [2.7, 3.0, 4.2]});
  for (let n = 1; n <= input.bathrooms; n++) rooms.push({id: 'B' + String(n).padStart(2, '0'), name: 'Baño ' + n, type: 'bath', zone: 'back', w: [1.5, 1.8, 2.4]});
  return rooms;
}

const rect = (r, u) => ({x: Math.round(r.x / u), z: Math.round(r.z / u), w: Math.round(r.w / u), d: Math.round(r.d / u)});
const cellKey = (x, z) => x + ':' + z;

// Valida geometría y acceso. La circulación (type 'hall') ocupa espacio pero se puede recorrer.
export function validateLayout(i, rooms, {requireAccess = true} = {}) {
  const input = validateInput(i);
  if (!Array.isArray(rooms) || !rooms.length) return {ok: false, reason: 'La distribución está vacía.'};
  for (const r of rooms) {
    if (![r.x, r.z, r.w, r.d].every(Number.isFinite)) return {ok: false, reason: 'Una habitación contiene medidas inválidas.'};
    if (r.w <= 0 || r.d <= 0) return {ok: false, reason: 'Cada habitación necesita dimensiones positivas.'};
    if (r.x < -EPS || r.z < -EPS || r.x + r.w > input.usableWidth + EPS || r.z + r.d > input.usableDepth + EPS)
      return {ok: false, reason: (r.name || 'Un ambiente') + ' quedaría fuera de la zona edificable.'};
    for (const v of [r.x, r.z, r.w, r.d]) if (Math.abs(v / input.u - Math.round(v / input.u)) > EPS)
      return {ok: false, reason: 'Ajusta la posición y medidas a media retícula.'};
  }
  const cells = new Map();
  for (const r of rooms) {
    const g = rect(r, input.u);
    if (g.x < 0 || g.z < 0 || g.w < 1 || g.d < 1 || g.x + g.w > input.cols || g.z + g.d > input.rows)
      return {ok: false, reason: (r.name || 'Un ambiente') + ' queda fuera de la zona edificable.'};
    for (let z = g.z; z < g.z + g.d; z++) for (let x = g.x; x < g.x + g.w; x++) {
      const key = cellKey(x, z);
      if (cells.has(key)) return {ok: false, reason: (r.name || 'Un ambiente') + ' se superpone con ' + (cells.get(key).name || 'otro ambiente') + '.'};
      cells.set(key, r);
    }
  }
  const solid = key => cells.has(key) && !isHall(cells.get(key));
  const entrance = [Math.floor(input.cols / 2), 0];
  if (solid(cellKey(...entrance))) return {ok: false, reason: 'La celda de ingreso (frente, al centro) debe quedar libre o ser circulación.'};
  const occupied = new Set(cells.keys());
  if (!requireAccess) return {ok: true, reason: 'Geometría válida.', occupied};
  const q = [entrance], seen = new Set([cellKey(...entrance)]);
  for (let k = 0; k < q.length; k++) {
    const [x, z] = q[k];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, zz = z + dz, key = cellKey(xx, zz);
      if (xx < 0 || zz < 0 || xx >= input.cols || zz >= input.rows || solid(key) || seen.has(key)) continue;
      seen.add(key); q.push([xx, zz]);
    }
  }
  for (const r of rooms) {
    if (isHall(r)) continue;
    const g = rect(r, input.u);
    let open = false;
    for (let z = g.z; z < g.z + g.d && !open; z++) for (const x of [g.x - 1, g.x + g.w]) if (seen.has(cellKey(x, z))) { open = true; break; }
    for (let x = g.x; x < g.x + g.w && !open; x++) for (const z of [g.z - 1, g.z + g.d]) if (seen.has(cellKey(x, z))) { open = true; break; }
    if (!open) return {ok: false, reason: r.name + ' quedaría sin acceso desde el ingreso.'};
  }
  return {ok: true, reason: 'Distribución conceptual válida.', occupied, freeCells: seen.size};
}

function random(seed) { let v = (seed >>> 0) || 0x5a17; return () => { v ^= v << 13; v ^= v >>> 17; v ^= v << 5; return (v >>> 0) / 4294967296; }; }
function shuffled(arr, rng) { const c = [...arr]; for (let k = c.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [c[k], c[j]] = [c[j], c[k]]; } return c; }
const toCells = (m, u) => Math.max(1, Math.round(m / u + 1e-9));
const sum = a => a.reduce((s, v) => s + v, 0);

// ---------- Métricas de calidad ----------
const center = r => [r.x + r.w / 2, r.z + r.d / 2];
const dist = (a, b) => { const [ax, az] = center(a), [bx, bz] = center(b); return Math.abs(ax - bx) + Math.abs(az - bz); };
export function adjacent(a, b) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
  const touchX = Math.abs(a.x + a.w - b.x) < EPS || Math.abs(b.x + b.w - a.x) < EPS;
  const touchZ = Math.abs(a.z + a.d - b.z) < EPS || Math.abs(b.z + b.d - a.z) < EPS;
  return (touchX && oz > EPS) || (touchZ && ox > EPS);
}

export function layoutMetrics(input, rooms) {
  const built = sum(rooms.map(r => r.w * r.d));
  const useful = sum(rooms.filter(r => !isHall(r)).map(r => r.w * r.d));
  const x0 = Math.min(...rooms.map(r => r.x)), x1 = Math.max(...rooms.map(r => r.x + r.w));
  const z0 = Math.min(...rooms.map(r => r.z)), z1 = Math.max(...rooms.map(r => r.z + r.d));
  return {built, useful, footprint: {x: x0, z: z0, w: x1 - x0, d: z1 - z0}, compactness: built / ((x1 - x0) * (z1 - z0)),
    occupancy: built / (input.width * input.depth), rooms: rooms.filter(r => !isHall(r)).length};
}

function layoutScore(input, rooms, variant) {
  const m = layoutMetrics(input, rooms);
  const find = id => rooms.find(r => r.id === id);
  const sal = find('SAL'), com = find('COM'), coc = find('COC');
  const beds = rooms.filter(r => r.type === 'bedroom'), baths = rooms.filter(r => r.type === 'bath');
  const halls = rooms.filter(isHall);
  let s = m.compactness * 45 - Math.abs(Math.log(m.footprint.w / m.footprint.d)) * 6;
  if (sal && com && adjacent(sal, com)) s += 9;
  if (com && coc && adjacent(com, coc)) s += 9;
  if (sal && sal.z < EPS) s += 4;
  if (sal && halls.some(h => h.id === 'VES' && adjacent(h, sal))) s += 5;
  const bathNearBed = baths.filter(b => beds.some(d => adjacent(b, d))).length;
  // Penaliza ambientes desproporcionados (baños o dormitorios enormes).
  const target = {bath: 7, bedroom: 17, kitchen: 16, social: 28};
  for (const r of rooms) if (target[r.type]) s -= Math.max(0, r.w * r.d - target[r.type]) * 0.9;
  const spine = halls.some(h => h.id === 'ESP');
  if (variant === 'A') {
    s += bathNearBed * 4 - (spine ? 3 : 0);
    if (beds[0]) s += Math.min(6, beds[0].w * beds[0].d / 3);
  } else if (variant === 'B') {
    if (spine) s += 7;
    if (sal) s += sum(beds.map(b => Math.min(dist(b, sal), 12))) * 0.9;
    s += bathNearBed * 5;
    s -= beds.filter(b => (sal && adjacent(b, sal)) || (coc && adjacent(b, coc))).length * 7;
    if (beds.length > 1) { const xs = beds.map(b => center(b)[0]); s += (Math.max(...xs) - Math.min(...xs)) * 0.8; }
  } else {
    if (coc && baths.length) s += Math.max(0, 12 - Math.min(...baths.map(b => dist(b, coc)))) * 1.6;
    s += baths.filter(b => (coc && adjacent(b, coc)) || baths.some(o => o !== b && adjacent(o, b))).length * 7;
  }
  return Math.round(s * 10) / 10;
}

// ---------- Generador por franjas ----------
// Frente: zona social dividida por el ingreso (vestíbulo). Detrás: pasillo y zona privada.
function fitWidths(items, cap) {
  const w = items.map(i => i.pref);
  let total = sum(w);
  while (total > cap) {
    let best = -1, slack = 0;
    items.forEach((it, k) => { const sl = w[k] - it.min; if (sl > slack) { slack = sl; best = k; } });
    if (best < 0) return null;
    w[best]--; total--;
  }
  return w;
}
function grow(items, w, target, caps) {
  let total = sum(w), progress = true;
  while (total < target && progress) {
    progress = false;
    for (let k = 0; k < items.length && total < target; k++) {
      if (w[k] < items[k].max && (!caps || caps(k, w))) { w[k]++; total++; progress = true; }
    }
  }
  return w;
}

function stripCandidate(input, prog, variant, rng) {
  const {u, cols, rows} = input, ex = Math.floor(cols / 2);
  const specs = prog.map(p => {
    const mn = toCells(p.w[0], u), pf = Math.max(mn, toCells(p.w[1], u));
    return {...p, min: mn, pref: pf, max: Math.max(pf, toCells(p.w[2], u))};
  });
  const fOpts = [...new Set((variant === 'B' ? [4.5, 4.2, 3.6, 3.0] : [4.2, 3.6, 3.0]).map(m => toCells(m, u)))];
  const pOpts = [...new Set([3.6, 3.0, 4.2].map(m => toCells(m, u)))];
  const pairs = [];
  for (const F of fOpts) for (const P of pOpts) if (F + 1 + P <= rows) pairs.push([F, P]);
  if (!pairs.length) return null;
  const [F, P] = pairs[Math.floor(rng() * rng() * pairs.length)];

  const caps = {L: ex, R: cols - ex - 1, B: cols};
  const used = {L: 0, R: 0, B: 0}, groups = {L: [], R: [], B: []};
  const front = specs.filter(s => s.zone === 'front'), back = specs.filter(s => s.zone === 'back');
  const salSide = rng() < 0.5 ? 'L' : 'R', other = salSide === 'L' ? 'R' : 'L';
  const serviceTogether = rng() < (variant === 'C' ? 0.9 : 0.7);
  const order = [...front, ...shuffled(back, rng)];
  for (const s of order) {
    let prefs;
    if (s.id === 'SAL') prefs = [salSide, other, 'B'];
    else if (s.zone === 'front') prefs = serviceTogether ? [other, salSide, 'B'] : shuffled(['L', 'R'], rng).concat('B');
    else if (variant === 'C' && s.type === 'bath' && rng() < 0.75) prefs = [other, 'B', salSide];
    else prefs = rng() < 0.85 ? ['B', ...shuffled(['L', 'R'], rng)] : [...shuffled(['L', 'R'], rng), 'B'];
    const slot = prefs.find(p => used[p] + s.min <= caps[p]);
    if (!slot) return null;
    groups[slot].push(s); used[slot] += s.min;
  }
  // Orden desde el vestíbulo hacia afuera: Sala junto al ingreso, luego Comedor y Cocina.
  const rank = s => ({SAL: 0, COM: 1, COC: 2}[s.id] ?? 3);
  for (const side of ['L', 'R']) groups[side].sort((a, b) => rank(a) - rank(b));
  if (variant === 'B') {
    const beds = groups.B.filter(s => s.type === 'bedroom'), rest = groups.B.filter(s => s.type !== 'bedroom');
    const ends = [], mid = [...rest];
    beds.forEach((b, k) => (k % 2 ? ends.push(b) : ends.unshift(b)));
    const half = Math.ceil(ends.length / 2);
    groups.B = [...ends.slice(0, half), ...mid, ...ends.slice(half)];
  } else if (variant === 'C') {
    const wet = groups.B.filter(s => s.type === 'bath'), dry = groups.B.filter(s => s.type !== 'bath');
    groups.B = rng() < 0.5 ? [...wet, ...dry] : [...dry, ...wet];
  }

  const wL = fitWidths(groups.L, caps.L), wR = fitWidths(groups.R, caps.R), wB = fitWidths(groups.B, caps.B);
  if (!wL || !wR || !wB) return null;
  let frontW = sum(wL) + 1 + sum(wR), backW = sum(wB);
  const target = Math.min(cols, Math.max(frontW, backW));
  if (frontW < target) {
    const all = [...groups.L.map((s, k) => ({s, side: 'L', k})), ...groups.R.map((s, k) => ({s, side: 'R', k}))];
    let progress = true;
    while (frontW < target && progress) {
      progress = false;
      for (const it of all) {
        if (frontW >= target) break;
        const arr = it.side === 'L' ? wL : wR;
        if (arr[it.k] < it.s.max && sum(arr) < caps[it.side]) { arr[it.k]++; frontW++; progress = true; }
      }
    }
  }
  if (backW < frontW) { grow(groups.B, wB, Math.min(cols, frontW)); backW = sum(wB); }

  const out = [];
  const push = (s, x, z, w, d) => out.push({id: s.id, name: s.name, type: s.type, x: x * u, z: z * u, w: w * u, d: d * u, locked: false});
  let x = ex - 1;
  groups.L.forEach((s, k) => { const w = wL[k]; push(s, x - w + 1, 0, w, F); x -= w; });
  const frontL = x + 1;
  x = ex + 1;
  groups.R.forEach((s, k) => { push(s, x, 0, wR[k], F); x += wR[k]; });
  const frontR = x - 1, fw = frontR - frontL + 1;
  let start = backW >= fw ? frontL - Math.floor((backW - fw) / 2) : frontL + Math.floor((fw - backW) / 2);
  start = Math.max(0, Math.min(cols - backW, start));
  x = start;
  groups.B.forEach((s, k) => { push(s, x, F + 1, wB[k], P); x += wB[k]; });
  const c0 = Math.min(frontL, start), c1 = Math.max(frontR, start + backW - 1);
  out.push({id: 'VES', name: 'Ingreso', type: 'hall', x: ex * u, z: 0, w: u, d: F * u, locked: false});
  out.push({id: 'PAS', name: 'Pasillo', type: 'hall', x: c0 * u, z: F * u, w: (c1 - c0 + 1) * u, d: u, locked: false});
  const byId = new Map(out.map(r => [r.id, r]));
  return [...prog.map(p => byId.get(p.id)), byId.get('VES'), byId.get('PAS')];
}

// Variante con espina: franja social, pasillo transversal y un pasillo central hacia el fondo
// con ambientes a ambos lados. Resuelve lotes angostos y programas grandes.
function spineCandidate(input, prog, variant, rng) {
  const {u, cols, rows} = input, ex = Math.floor(cols / 2);
  const specs = prog.map(p => {
    const mn = toCells(p.w[0], u), pf = Math.max(mn, toCells(p.w[1], u));
    return {...p, min: mn, pref: pf, max: Math.max(pf, toCells(p.w[2], u))};
  });
  const fOpts = [...new Set([3.6, 4.2, 3.0].map(m => toCells(m, u)))];
  const F = fOpts[Math.floor(rng() * fOpts.length)];
  const depthAvail = rows - F - 1;
  const stackW = toCells(rng() < 0.5 ? 3.6 : 4.2, u);
  const SL = Math.min(ex, stackW), SR = Math.min(cols - ex - 1, stackW);
  const minStack = toCells(2.4, u);
  if (depthAvail < 2) return null;
  const caps = {L: ex, R: cols - ex - 1, SL: SL >= minStack ? depthAvail : 0, SR: SR >= minStack ? depthAvail : 0};
  const used = {L: 0, R: 0, SL: 0, SR: 0}, groups = {L: [], R: [], SL: [], SR: []};
  const salSide = rng() < 0.5 ? 'L' : 'R', other = salSide === 'L' ? 'R' : 'L';
  const front = specs.filter(s => s.zone === 'front'), back = specs.filter(s => s.zone === 'back');
  for (const s of [...front, ...shuffled(back, rng)]) {
    let prefs;
    if (s.id === 'SAL') prefs = [salSide, other];
    else if (s.zone === 'front') prefs = [other, salSide, used.SL <= used.SR ? 'SL' : 'SR', used.SL <= used.SR ? 'SR' : 'SL'];
    else prefs = used.SL <= used.SR ? ['SL', 'SR', 'L', 'R'] : ['SR', 'SL', 'L', 'R'];
    const slot = prefs.find(p => used[p] + s.min <= caps[p]);
    if (!slot) return null;
    groups[slot].push(s); used[slot] += s.min;
  }
  if (!groups.SL.length && !groups.SR.length) return null;
  const rank = s => ({SAL: 0, COM: 1, COC: 2}[s.id] ?? 3);
  for (const side of ['L', 'R']) groups[side].sort((a, b) => rank(a) - rank(b));
  for (const side of ['SL', 'SR']) {
    if (variant === 'B') groups[side].sort((a, b) => (a.type === 'bedroom') - (b.type === 'bedroom'));
    if (variant === 'C') groups[side].sort((a, b) => (b.type === 'bath') - (a.type === 'bath'));
  }
  const w = {};
  for (const side of ['L', 'R']) { w[side] = fitWidths(groups[side], caps[side]); if (!w[side]) return null; }
  for (const side of ['SL', 'SR']) { w[side] = fitWidths(groups[side], depthAvail); if (!w[side]) return null; }
  // El frente cubre al menos el ancho de las pilas para cerrar la volumetría.
  for (const [side, stack, sw] of [['L', 'SL', SL], ['R', 'SR', SR]]) {
    if (groups[side].length && groups[stack].length) grow(groups[side], w[side], Math.min(caps[side], sw));
  }
  const out = [];
  const push = (s, x, z, ww, d) => out.push({id: s.id, name: s.name, type: s.type, x: x * u, z: z * u, w: ww * u, d: d * u, locked: false});
  let x = ex - 1;
  groups.L.forEach((s, k) => { push(s, x - w.L[k] + 1, 0, w.L[k], F); x -= w.L[k]; });
  const frontL = x + 1;
  x = ex + 1;
  groups.R.forEach((s, k) => { push(s, x, 0, w.R[k], F); x += w.R[k]; });
  const frontR = x - 1;
  let z = F + 1;
  groups.SL.forEach((s, k) => { push(s, ex - SL, z, SL, w.SL[k]); z += w.SL[k]; });
  const depthL = z - F - 1;
  z = F + 1;
  groups.SR.forEach((s, k) => { push(s, ex + 1, z, SR, w.SR[k]); z += w.SR[k]; });
  const depthR = z - F - 1;
  const spine = Math.max(depthL, depthR);
  const c0 = Math.min(frontL, groups.SL.length ? ex - SL : ex), c1 = Math.max(frontR, groups.SR.length ? ex + SR : ex);
  out.push({id: 'VES', name: 'Ingreso', type: 'hall', x: ex * u, z: 0, w: u, d: F * u, locked: false});
  out.push({id: 'PAS', name: 'Pasillo', type: 'hall', x: c0 * u, z: F * u, w: (c1 - c0 + 1) * u, d: u, locked: false});
  if (spine > 1) out.push({id: 'ESP', name: 'Pasillo', type: 'hall', x: ex * u, z: (F + 1) * u, w: u, d: spine * u, locked: false});
  const byId = new Map(out.map(r => [r.id, r]));
  return [...prog.map(p => byId.get(p.id)), ...['VES', 'PAS', 'ESP'].filter(id => byId.has(id)).map(id => byId.get(id))];
}

// ---------- Búsqueda aleatoria (respaldo para programas que no caben en franjas) ----------
function planGrid(input, rooms) {
  const occupied = new Set();
  for (const r of rooms) {
    const g = rect(r, input.u);
    if (g.x < 0 || g.z < 0 || g.w < 1 || g.d < 1 || g.x + g.w > input.cols || g.z + g.d > input.rows) return null;
    for (let z = g.z; z < g.z + g.d; z++) for (let x = g.x; x < g.x + g.w; x++) {
      const key = cellKey(x, z); if (occupied.has(key)) return null; occupied.add(key);
    }
  }
  return occupied;
}
function placeCandidate(input, template, locked, rng, compact = true) {
  const occupied = planGrid(input, locked);
  if (!occupied) return null;
  const result = locked.map(clone);
  const pending = shuffled(template.filter(p => !locked.some(l => l.id === p.id)), rng);
  const mid = Math.floor(input.cols / 2);
  for (const room of pending) {
    const rw = 2, rd = 2, locs = [];
    for (let z = 0; z <= input.rows - rd; z++) for (let x = 0; x <= input.cols - rw; x++) {
      let valid = true;
      for (let dz = 0; dz < rd && valid; dz++) for (let dx = 0; dx < rw; dx++) if (occupied.has(cellKey(x + dx, z + dz))) { valid = false; break; }
      if (!valid || (x <= mid && mid < x + rw && z === 0)) continue;
      const near = compact && occupied.size ? Math.min(...[...occupied].map(k => { const [ox, oz] = k.split(':').map(Number); return Math.abs(ox - x) + Math.abs(oz - z); })) : 0;
      locs.push({x, z, pref: -near * 1.5 + (room.zone === 'front' ? (input.rows - z) * 0.3 : z * 0.2) + rng() * 4});
    }
    if (!locs.length) return null;
    locs.sort((a, b) => b.pref - a.pref);
    const pick = locs[Math.floor(rng() * Math.min(locs.length, 4))];
    result.push({id: room.id, name: room.name, type: room.type, x: pick.x * input.u, z: pick.z * input.u, w: rw * input.u, d: rd * input.u, locked: false});
    for (let z = pick.z; z < pick.z + rd; z++) for (let x = pick.x; x < pick.x + rw; x++) occupied.add(cellKey(x, z));
  }
  return template.map(t => result.find(r => r.id === t.id));
}

export function generateAlternatives(data, {locked = [], seed = 20261027, tries = 100} = {}) {
  const input = validateInput(data);
  const prog = program(input);
  const wanted = new Map(prog.map(r => [r.id, r]));
  if (!Array.isArray(locked)) throw Error('El estado de bloqueos no es válido.');
  const fixed = locked.filter(r => !isHall(r)).map(r => {
    const t = wanted.get(r.id);
    if (!t) throw Error('El ambiente fijado ya no existe en el programa: ' + r.id);
    return {...roomAppearance(r), id: t.id, name: t.name, type: t.type, x: r.x, z: r.z, w: r.w, d: r.d, locked: true};
  });
  if (fixed.length && !validateLayout(input, fixed, {requireAccess: false}).ok) throw Error('Los ambientes fijados se solapan o invaden la reserva.');
  const fixedIds = new Set(fixed.map(r => r.id));
  const out = {A: null, B: null, C: null}, signatures = new Set();
  const n = Math.min(200, Math.max(1, Math.floor(tries)));
  let usedFallback = false;
  ALTERNATIVES.forEach((variant, idx) => {
    const rng = random(seed + idx * 271828 + Math.round(input.width * 100));
    const pool = [];
    for (let t = 0; t < n * 2; t++) {
      let rooms = t % 2 ? spineCandidate(input, prog, variant, rng) : stripCandidate(input, prog, variant, rng);
      if (!rooms) continue;
      if (fixed.length) rooms = [...rooms.filter(r => !fixedIds.has(r.id)), ...fixed.map(clone)];
      if (!validateLayout(input, rooms).ok) continue;
      // Huella geométrica (tipo + rectángulo): dos alternativas que solo intercambian nombres cuentan como iguales.
      const fingerprint = rooms.map(r => r.type + ':' + r.x + ':' + r.z + ':' + r.w + ':' + r.d).sort().join('|');
      if (pool.some(p => p.fingerprint === fingerprint)) continue;
      pool.push({rooms, fingerprint, score: layoutScore(input, rooms, variant)});
    }
    if (!pool.length) {
      usedFallback = true;
      for (let t = 0; t < n; t++) {
        const rooms = placeCandidate(input, prog, fixed, rng, t % 2 === 0);
        if (!rooms || !validateLayout(input, rooms).ok) continue;
        const fingerprint = rooms.map(r => r.id + ':' + r.x + ':' + r.z).join('|');
        if (!pool.some(p => p.fingerprint === fingerprint)) pool.push({rooms, fingerprint, score: layoutScore(input, rooms, variant)});
      }
    }
    pool.sort((a, b) => b.score - a.score);
    const fresh = pool.filter(p => !signatures.has(p.fingerprint));
    const list = fresh.length ? fresh : pool;
    if (list.length) {
      const best = list[Math.floor(rng() * rng() * Math.min(3, list.length))];
      signatures.add(best.fingerprint);
      out[variant] = best.rooms.map(r => ({...clone(r), locked: fixedIds.has(r.id)}));
    }
  });
  if (!out.A && !out.B && !out.C) throw Error('No se encontró una distribución válida. Prueba un terreno más grande, menos ambientes o menos fijaciones.');
  for (const v of ALTERNATIVES) if (!out[v]) out[v] = clone(out.A || out.B || out.C);
  return {input, alternatives: out, scoring: 'heurístico conceptual', mode: usedFallback ? 'busqueda' : 'franjas', tries: n};
}

export const WINDOW_STYLES = ['default', 'lattice', 'folding'];
export function roomAppearance(r) {
  const result = {};
  if (WINDOW_STYLES.includes(r.windowStyle)) result.windowStyle = r.windowStyle;
  for (const key of ['floorColor', 'wallColor']) if (/^#[0-9a-f]{6}$/i.test(r[key] || '')) result[key] = r[key];
  return result;
}
export function migrateRoom(r) { return {...roomAppearance(r), ...(r.type === 'hall' && r.autoHall === true ? {autoHall: true} : {}), id: String(r.id), name: String(r.name), type: String(r.type || 'other'), x: Number(r.x), z: Number(r.z), w: Number(r.w), d: Number(r.d), locked: !!r.locked}; }
export function validateProjectState(raw) {
  if (!raw || typeof raw !== 'object') throw Error('El archivo no contiene un proyecto.');
  const input = validateInput(raw.input);
  if (!raw.alternatives || !ALTERNATIVES.every(v => Array.isArray(raw.alternatives[v]))) throw Error('Faltan alternativas A/B/C.');
  const alternatives = {};
  for (const a of ALTERNATIVES) {
    alternatives[a] = raw.alternatives[a].map(migrateRoom);
    if (!alternatives[a].length || alternatives[a].filter(r => !isHall(r)).length > 30 || alternatives[a].length > input.cols * input.rows) throw Error('Número de ambientes fuera de rango.');
    if (new Set(alternatives[a].map(r => r.id)).size !== alternatives[a].length) throw Error('Identificadores de ambientes duplicados.');
    const valid = validateLayout(input, alternatives[a]);
    if (!valid.ok) throw Error('Alternativa ' + a + ': ' + valid.reason);
  }
  const active = ALTERNATIVES.includes(raw.active) ? raw.active : 'A';
  return {input, alternatives, active, revision: Number(raw.revision) || 1};
}

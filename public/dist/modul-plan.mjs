// MODUL-AI | Análisis constructivo de una distribución: muros únicos (sin duplicar
// paredes compartidas), puertas, vanos y ventanas. Lo usan el plano 2D, el 3D y el despiece.
import {validateInput, isHall} from './modul-core.mjs';

export const WALL = {ext: 0.2, int: 0.1, height: 2.6, plinth: 0.15, cut: 1.2};
const SOCIAL = new Set(['social', 'kitchen']);

export function analyzeLayout(rawInput, rooms) {
  const input = validateInput(rawInput);
  const {u, cols, rows} = input;
  const owner = new Int16Array(cols * rows).fill(-1);
  rooms.forEach((r, i) => {
    const x0 = Math.round(r.x / u), z0 = Math.round(r.z / u), w = Math.round(r.w / u), d = Math.round(r.d / u);
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && z >= 0 && x < cols && z < rows) owner[z * cols + x] = i;
  });
  const inPlot = (x, z) => x >= 0 && z >= 0 && x < cols && z < rows;
  const at = (x, z) => (inPlot(x, z) ? owner[z * cols + x] : -1);
  const hall = i => i >= 0 && isHall(rooms[i]);

  // 1) Muros: tramos continuos entre dos dueños distintos (o ambiente/exterior).
  const runs = [];
  const mk = (dir, line, cur) => runs.push({id: runs.length, dir, c: line * u, a: cur.a * u, b: cur.b * u, A: cur.A, B: cur.B,
    kind: cur.A < 0 || cur.B < 0 ? 'ext' : 'int', openings: []});
  const scan = (dir, lines, len, pair) => {
    for (let i = 0; i <= lines; i++) {
      let cur = null;
      for (let j = 0; j <= len; j++) {
        const [A, B] = j < len ? pair(i, j) : [-9, -9];
        const wall = j < len && A !== B && !(A < 0 && B < 0) && !(hall(A) && hall(B));
        if (wall && cur && cur.A === A && cur.B === B) { cur.b = j + 1; continue; }
        if (cur) { mk(dir, i, cur); cur = null; }
        if (wall) cur = {A, B, a: j, b: j + 1};
      }
    }
  };
  scan('v', cols, rows, (i, j) => [at(i - 1, j), at(i, j)]); // línea x = i·u, A al oeste, B al este
  scan('h', rows, cols, (j, i) => [at(i, j - 1), at(i, j)]); // línea z = j·u, A al norte (frente), B al sur

  // Extiende cada muro media pieza en los extremos sin continuación colineal (cierra esquinas sin solapes).
  for (const run of runs) {
    const same = runs.filter(o => o !== run && o.dir === run.dir && Math.abs(o.c - run.c) < 1e-6);
    run.extA = !same.some(o => Math.abs(o.b - run.a) < 1e-6);
    run.extB = !same.some(o => Math.abs(o.a - run.b) < 1e-6);
  }
  const sideOf = (run, idx) => (run.A === idx ? -1 : run.B === idx ? 1 : 0);
  const overlaps = (run, lo, hi) => run.openings.some(o => lo < o.center + o.width / 2 + 0.15 && hi > o.center - o.width / 2 - 0.15);
  const add = (run, o) => { run.openings.push(o); run.openings.sort((p, q) => p.center - q.center); return o; };
  const extentAlong = (run, r) => (run.dir === 'v' ? [r.z, r.z + r.d] : [r.x, r.x + r.w]);
  const roomSide = (run, r) => (run.dir === 'h' ? (Math.abs(run.c - r.z) < 1e-6 ? 'N' : 'S') : (Math.abs(run.c - r.x) < 1e-6 ? 'W' : 'E'));
  const meta = rooms.map(() => ({door: null, openings: []}));

  // 2) Ingreso principal: puerta en la fachada del vestíbulo.
  const ex = Math.floor(cols / 2), entryOwner = at(ex, 0);
  let entry = null;
  if (hall(entryOwner)) {
    const c = (ex + 0.5) * u;
    const run = runs.find(r => r.dir === 'h' && r.c === 0 && r.B === entryOwner && r.a <= c && c <= r.b);
    if (run) entry = add(run, {type: 'entry', center: c, width: Math.min(1.0, u - 0.2), sill: 0, head: 2.2, room: entryOwner, into: 1, hinge: c - Math.min(1.0, u - 0.2) / 2});
  }

  // 3) Vanos abiertos entre Sala, Comedor y Cocina (concepto abierto).
  for (const run of runs) {
    if (run.kind !== 'int' || hall(run.A) || hall(run.B)) continue;
    const a = rooms[run.A], b = rooms[run.B];
    if (!SOCIAL.has(a.type) || !SOCIAL.has(b.type)) continue;
    const pair = [a.id, b.id].sort().join('-');
    if (!['COM-SAL', 'COC-COM'].includes(pair)) continue;
    const len = run.b - run.a;
    if (len < 1.2) continue;
    const width = Math.min(len - 0.5, pair === 'COM-SAL' ? 3.0 : 2.0);
    const o = add(run, {type: 'opening', center: (run.a + run.b) / 2, width, sill: 0, head: 2.3});
    meta[run.A].openings.push(o); meta[run.B].openings.push(o);
  }

  // 4) Puertas: cada ambiente abre a la circulación (o al exterior si no la toca).
  rooms.forEach((r, idx) => {
    if (isHall(r)) return;
    const candidates = [];
    for (const run of runs) {
      const s = sideOf(run, idx);
      if (!s) continue;
      const other = s < 0 ? run.B : run.A;
      let pri;
      if (hall(other)) pri = 0; else if (other < 0) pri = 2; else continue;
      const [lo, hi] = extentAlong(run, r);
      for (let k = 0; k < Math.round((run.b - run.a) / u); k++) {
        const center = run.a + u / 2 + k * u;
        if (other < 0) {
          const cell = Math.floor(center / u), line = Math.round(run.c / u);
          const [ox, oz] = run.dir === 'v' ? [s < 0 ? line : line - 1, cell] : [cell, s < 0 ? line : line - 1];
          if (!inPlot(ox, oz)) continue;
        }
        const toEntry = run.dir === 'v' ? center : Math.abs(center - (ex + 0.5) * u);
        candidates.push({run, center, pri, cd: Math.min(center - lo, hi - center), toEntry, lo, hi, s, other});
      }
    }
    candidates.sort((p, q) => p.pri - q.pri || (p.pri === 2 ? p.toEntry - q.toEntry : 0) || p.cd - q.cd || p.center - q.center);
    for (const c of candidates) {
      const isLiving = r.id === 'SAL' && hall(c.other) && rooms[c.other].id === 'VES';
      const len = c.run.b - c.run.a;
      let width = isLiving ? Math.min(1.6, len - 0.6) : r.type === 'bath' ? 0.75 : 0.85;
      width = Math.min(width, Math.max(0.7, u - 0.15));
      let center = isLiving ? (c.run.a === 0 ? c.run.a + 0.3 + width / 2 : (c.run.a + c.run.b) / 2) : c.center;
      if (!isLiving) { // la hoja queda junto a la esquina más cercana del ambiente
        const nearLo = center - c.lo <= c.hi - center;
        center = nearLo ? Math.max(center, c.lo + 0.12 + width / 2) : Math.min(center, c.hi - 0.12 - width / 2);
      }
      if (overlaps(c.run, center - width / 2, center + width / 2)) continue;
      const hingeLo = center - c.lo <= c.hi - center;
      const o = add(c.run, {type: isLiving ? 'opening' : 'door', center, width, sill: 0, head: isLiving ? 2.3 : 2.1,
        room: idx, into: c.s, hinge: hingeLo ? center - width / 2 : center + width / 2, exterior: c.other < 0});
      meta[idx].door = {side: roomSide(c.run, r), pos: center, width, run: c.run.id};
      meta[idx].openings.push(o);
      break;
    }
  });

  // 5) Ventanas en muros exteriores.
  const extRunsOf = idx => runs.filter(run => run.kind === 'ext' && sideOf(run, idx));
  rooms.forEach((r, idx) => {
    const list = extRunsOf(idx).sort((p, q) => (q.b - q.a) - (p.b - p.a));
    list.forEach((run, k) => {
      const len = run.b - run.a;
      let spec = null;
      if (isHall(r)) { if (len >= 1.4 && !(entry && run.openings.includes(entry))) spec = {w: Math.min(0.9, len - 0.6), sill: 1.0, head: 2.1}; }
      else if (r.type === 'bath') { if (k === 0 && len >= 1.0) spec = {w: 0.6, sill: 1.5, head: 2.1}; }
      else if (r.id === 'SAL' && run.dir === 'h' && run.c === 0) spec = {w: Math.min(len - 0.6, 2.4), sill: 0.4, head: 2.2};
      else if (r.type === 'kitchen') spec = {w: Math.min(len - 0.8, 1.2), sill: 1.05, head: 2.1};
      else spec = {w: Math.min(len - 0.8, len >= 3.2 ? 1.8 : 1.2), sill: 0.9, head: 2.1};
      if (!spec || spec.w < 0.5) return;
      const mid = (run.a + run.b) / 2;
      for (const center of [mid, run.a + 0.4 + spec.w / 2, run.b - 0.4 - spec.w / 2]) {
        if (center - spec.w / 2 < run.a + 0.2 || center + spec.w / 2 > run.b - 0.2) continue;
        if (overlaps(run, center - spec.w / 2, center + spec.w / 2)) continue;
        meta[idx].openings.push(add(run, {type: 'window', center, width: spec.w, sill: spec.sill, head: spec.head, room: idx}));
        break;
      }
    });
  });

  const xs = rooms.flatMap(r => [r.x, r.x + r.w]), zs = rooms.flatMap(r => [r.z, r.z + r.d]);
  const bbox = {x: Math.min(...xs), z: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs)};
  return {input, u, cols, rows, runs, entry, bbox, rooms: rooms.map((r, i) => ({...r, idx: i, ...meta[i]}))};
}

export const thicknessOf = run => (run.kind === 'ext' ? WALL.ext : WALL.int);

// Divide un muro en tramos macizos y vanos, recortados a la altura indicada.
export function wallPieces(run, height = WALL.height) {
  const t = thicknessOf(run);
  const start = run.a - (run.extA ? t / 2 : 0), end = run.b + (run.extB ? t / 2 : 0);
  const pieces = [];
  let cursor = start;
  for (const o of run.openings) {
    const lo = o.center - o.width / 2, hi = o.center + o.width / 2;
    if (o.sill >= height) continue;
    if (lo > cursor) pieces.push({kind: 'solid', from: cursor, to: lo, y0: 0, y1: height});
    if (o.sill > 0) pieces.push({kind: 'sill', from: lo, to: hi, y0: 0, y1: o.sill, opening: o});
    if (o.head < height) pieces.push({kind: 'lintel', from: lo, to: hi, y0: o.head, y1: height, opening: o});
    cursor = hi;
  }
  if (end > cursor) pieces.push({kind: 'solid', from: cursor, to: end, y0: 0, y1: height});
  return pieces;
}

// Despiece conceptual sin duplicados.
export function bill(analysis) {
  const rows = [];
  const f = n => Number(n.toFixed(2));
  const name = i => (i >= 0 ? analysis.rooms[i].name : 'Exterior');
  let e = 0, n = 0, d = 0, w = 0;
  for (const run of analysis.runs) {
    const id = run.kind === 'ext' ? 'ME-' + String(++e).padStart(2, '0') : 'MI-' + String(++n).padStart(2, '0');
    rows.push({id, categoria: run.kind === 'ext' ? 'Muro exterior' : 'Muro interior', ambientes: name(run.A) + ' / ' + name(run.B),
      largo_m: f(run.b - run.a), alto_m: WALL.height, espesor_m: thicknessOf(run), vanos: run.openings.length});
    for (const o of run.openings) {
      if (o.type === 'opening') continue;
      const isWin = o.type === 'window';
      rows.push({id: isWin ? 'V-' + String(++w).padStart(2, '0') : 'P-' + String(++d).padStart(2, '0'),
        categoria: isWin ? 'Ventana' : o.type === 'entry' ? 'Puerta principal' : 'Puerta', ambientes: name(o.room ?? -1),
        largo_m: f(o.width), alto_m: f(o.head - o.sill), espesor_m: thicknessOf(run), vanos: 0, alfeizar_m: f(o.sill)});
    }
  }
  for (const r of analysis.rooms) {
    rows.push({id: 'LP-' + r.id, categoria: 'Losa de piso', ambientes: r.name, largo_m: f(r.w), alto_m: WALL.plinth, espesor_m: WALL.plinth, vanos: 0});
    rows.push({id: 'LT-' + r.id, categoria: 'Losa de techo', ambientes: r.name, largo_m: f(r.w), alto_m: f(r.d), espesor_m: 0.18, vanos: 0});
  }
  const sumLen = kind => f(analysis.runs.filter(r => r.kind === kind).reduce((s, r) => s + r.b - r.a, 0));
  return {rows, summary: {extLength: sumLen('ext'), intLength: sumLen('int'), doors: d, windows: w,
    floorArea: f(analysis.rooms.reduce((s, r) => s + r.w * r.d, 0))}};
}

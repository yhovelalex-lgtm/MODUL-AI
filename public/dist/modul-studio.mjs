// MODUL-AI | Estado del proyecto, historial (deshacer/rehacer) y plano 2D técnico editable.
import {generateAlternatives, validateLayout, validateInput, validateProjectState, isHall, ALTERNATIVES} from './modul-core.mjs';
import {analyzeLayout, wallPieces, thicknessOf} from './modul-plan.mjs';

export const DEMO_SEED = 20261027;
export const DEMO_INPUT = {name: 'Vivienda modular', width: 12, depth: 15, module: 3, bedrooms: 2, bathrooms: 1};
export const ZONE_FILL = {social: '#EADCC3', kitchen: '#DCE5CF', bedroom: '#D5DFEC', bath: '#CFE5E3', other: '#E3DEEC', hall: '#FBFBFA'};
const INK = '#26313C', SIGNAL = '#F2B705', FONT = 'Archivo Variable, Archivo, Arial, sans-serif';
const NS = 'http://www.w3.org/2000/svg';
const copy = x => JSON.parse(JSON.stringify(x));
const fmt = (n, d = 2) => Number(n).toLocaleString('es-PE', {minimumFractionDigits: d, maximumFractionDigits: d});

export function createStudio({svg, onChange, notify}) {
  let input = {...DEMO_INPUT};
  let sets = {A: [], B: [], C: []}, active = 'A', selected = null, revision = 1;
  const past = [], future = [];
  let analysis = null, drag = null;

  const rooms = () => sets[active] || [];
  const plainInput = () => ({name: input.name, width: input.width, depth: input.depth, module: input.module, bedrooms: input.bedrooms, bathrooms: input.bathrooms});
  const snapshot = () => ({sets: copy(sets), active, selected, input: plainInput(), revision});
  const commit = () => { past.push(snapshot()); if (past.length > 60) past.shift(); future.length = 0; };
  const restoreSnap = s => { sets = s.sets; active = s.active; selected = s.selected; input = s.input; revision = s.revision; };

  function emit(reason) {
    try { analysis = analyzeLayout(input, rooms()); } catch { analysis = null; }
    draw();
    onChange?.({input: plainInput(), sets, active, selected, rooms: rooms(), analysis, reason, canUndo: past.length > 0, canRedo: future.length > 0});
  }

  // ---------- dibujo ----------
  const el = (tag, attrs = {}, parent = svg) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined) n.setAttribute(k, v);
    parent.append(n);
    return n;
  };
  let content = svg;
  // Texto dentro del contenido girado: se contragira para leerse derecho.
  const upText = (parent, x, y, str, size, attrs = {}) => text(parent, x, y, str, size, {...attrs, transform: `rotate(180 ${x} ${y})`});
  const text = (parent, x, y, str, size, attrs = {}) => {
    const t = el('text', {x, y, 'font-size': size, 'font-family': FONT, fill: INK, 'text-anchor': 'middle', 'dominant-baseline': 'middle', ...attrs}, parent);
    t.textContent = str;
    return t;
  };

  function draw() {
    svg.replaceChildren();
    const W = input.width, D = input.depth, mod = input.module, u = mod / 2;
    const pad = 1.6, top = 1.3, bottom = 2.3;
    svg.setAttribute('viewBox', `${-pad} ${-top} ${W + pad * 2} ${D + top + bottom}`);
    svg.setAttribute('xmlns', NS);
    const defs = el('defs');
    const hatch = el('pattern', {id: 'hatch', width: 0.35, height: 0.35, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'}, defs);
    el('line', {x1: 0, y1: 0, x2: 0, y2: 0.35, stroke: '#B7C2AE', 'stroke-width': 0.04}, hatch);

    // Vereda y calle abajo (el plano se ve desde la calle, como el modelo 3D)
    el('rect', {x: -pad, y: D + 0.05, width: W + pad * 2, height: 0.75, fill: '#E7EAED'});
    el('rect', {x: -pad, y: D + 0.8, width: W + pad * 2, height: bottom - 0.8, fill: '#D5DADF'});
    text(svg, -pad + 0.3, D + 0.8 + (bottom - 0.8) / 2, 'Calle', 0.36, {fill: '#5F6B77', 'font-weight': 500, 'text-anchor': 'start'});

    // Cotas del lote
    const cota = (x1, y1, x2, y2, label, vertical) => {
      const cg = el('g', {stroke: '#6B7783', 'stroke-width': 0.025});
      el('line', {x1, y1, x2, y2}, cg);
      for (const [x, y] of [[x1, y1], [x2, y2]]) el('line', {x1: x - 0.15, y1: y + (vertical ? 0 : 0.15), x2: x + 0.15, y2: y - (vertical ? 0 : 0.15), 'stroke-width': 0.04}, cg);
      const tx = (x1 + x2) / 2 + (vertical ? 0.42 : 0), ty = (y1 + y2) / 2 - (vertical ? 0 : 0.36);
      text(svg, tx, ty, label, 0.32, {fill: '#4E5A66', transform: vertical ? `rotate(90 ${tx} ${ty})` : undefined, 'font-variant-numeric': 'tabular-nums'});
    };
    cota(0, -0.55, W, -0.55, fmt(W) + ' m', false);
    cota(W + 0.55, 0, W + 0.55, D, fmt(D) + ' m', true);

    // Contenido en coordenadas del modelo, girado 180°: frente (z = 0) abajo.
    content = el('g', {transform: `rotate(180 ${W / 2} ${D / 2})`});
    el('rect', {x: 0, y: 0, width: W, height: D, fill: '#EEF2E9', stroke: '#7F8C78', 'stroke-width': 0.04}, content);
    const g = el('g', {stroke: '#DCE3D4', 'stroke-width': 0.015}, content);
    for (let i = 0; i <= Math.floor(W / u + 1e-6); i++) el('line', {x1: i * u, y1: 0, x2: i * u, y2: D - mod, 'stroke-width': i % 2 ? 0.012 : 0.025}, g);
    for (let j = 0; j <= Math.floor((D - mod) / u + 1e-6); j++) el('line', {x1: 0, y1: j * u, x2: W, y2: j * u, 'stroke-width': j % 2 ? 0.012 : 0.025}, g);
    el('rect', {x: 0, y: D - mod, width: W, height: mod, fill: 'url(#hatch)', stroke: '#9CAA92', 'stroke-width': 0.03, 'stroke-dasharray': '0.25 0.18'}, content);
    upText(content, W / 2, D - mod / 2, 'Reserva para ampliación', Math.min(0.36, mod * 0.16), {fill: '#5E6B57', 'font-style': 'italic'});

    if (!analysis) return;
    // Ambientes
    const layer = el('g', {}, content);
    for (const r of rooms()) {
      const grp = el('g', {'data-id': r.id, class: isHall(r) ? 'plan-hall' : 'plan-room' + (r.locked ? ' is-locked' : '') + (r.id === selected ? ' is-selected' : '')}, layer);
      el('rect', {x: r.x, y: r.z, width: r.w, height: r.d, fill: ZONE_FILL[r.type] || ZONE_FILL.other}, grp);
      if (!isHall(r)) {
        const size = Math.max(0.26, Math.min(0.5, r.w * 0.125, r.d * 0.17));
        upText(grp, r.x + r.w / 2, r.z + r.d / 2 + size * 0.55, r.name, size, {'font-weight': 600});
        upText(grp, r.x + r.w / 2, r.z + r.d / 2 - size * 0.75, fmt(r.w * r.d, 1) + ' m²', size * 0.78, {fill: '#56616C', 'font-variant-numeric': 'tabular-nums'});
        if (r.locked) {
          const cx = r.x + 0.32, cy = r.z + r.d - 0.34;
          const lk = el('g', {transform: `rotate(180 ${cx} ${cy})`}, grp);
          el('rect', {x: cx - 0.13, y: cy - 0.02, width: 0.26, height: 0.2, rx: 0.03, fill: INK}, lk);
          el('path', {d: `M${cx - 0.08} ${cy - 0.02} v-0.06 a0.08 0.08 0 0 1 0.16 0 v0.06`, fill: 'none', stroke: INK, 'stroke-width': 0.04}, lk);
        }
        const hit = el('rect', {x: r.x, y: r.z, width: r.w, height: r.d, fill: 'transparent', class: 'plan-hit'}, grp);
        hit.addEventListener('pointerdown', ev => startDrag(ev, r));
      }
    }
    // Muros con vanos
    const walls = el('g', {'pointer-events': 'none'}, content);
    for (const run of analysis.runs) {
      const t = thicknessOf(run);
      for (const p of wallPieces(run, 1.0)) {
        if (p.kind !== 'solid' && p.kind !== 'sill') continue;
        const fill = p.kind === 'solid' ? INK : '#FFFFFF';
        if (run.dir === 'h') el('rect', {x: p.from, y: run.c - t / 2, width: p.to - p.from, height: t, fill, stroke: p.kind === 'sill' ? INK : 'none', 'stroke-width': 0.02}, walls);
        else el('rect', {x: run.c - t / 2, y: p.from, width: t, height: p.to - p.from, fill, stroke: p.kind === 'sill' ? INK : 'none', 'stroke-width': 0.02}, walls);
        if (p.kind === 'sill') {
          const m = (p.from + p.to) / 2;
          if (run.dir === 'h') el('line', {x1: p.from, y1: run.c, x2: p.to, y2: run.c, stroke: INK, 'stroke-width': 0.02}, walls);
          else el('line', {x1: run.c, y1: p.from, x2: run.c, y2: p.to, stroke: INK, 'stroke-width': 0.02}, walls);
          void m;
        }
      }
      for (const o of run.openings) {
        if (o.type !== 'door' && o.type !== 'entry') continue;
        const w = o.width, dir = o.center > o.hinge ? 1 : -1, s = o.into || 1;
        const [hx, hz] = run.dir === 'h' ? [o.hinge, run.c] : [run.c, o.hinge];
        const [lx, lz] = run.dir === 'h' ? [hx, hz + s * w] : [hx + s * w, hz];
        const [ex, ez] = run.dir === 'h' ? [hx + dir * w, hz] : [hx, hz + dir * w];
        el('line', {x1: hx, y1: hz, x2: lx, y2: lz, stroke: INK, 'stroke-width': 0.04}, walls);
        const sweep = run.dir === 'h' ? (dir * s > 0 ? 0 : 1) : (dir * s > 0 ? 1 : 0);
        el('path', {d: `M${lx} ${lz} A${w} ${w} 0 0 ${sweep} ${ex} ${ez}`, fill: 'none', stroke: '#6B7783', 'stroke-width': 0.02, 'stroke-dasharray': '0.08 0.06'}, walls);
        if (o.type === 'entry') {
          const ax = o.center, az = run.c - 0.48;
          el('path', {d: `M${ax - 0.2} ${az - 0.2} L${ax} ${az + 0.16} L${ax + 0.2} ${az - 0.2} Z`, fill: INK}, walls);
          upText(walls, ax - 0.32, az - 0.02, 'Ingreso', 0.3, {'font-weight': 700, 'text-anchor': 'start'});
        }
      }
    }
    // Selección
    const sel = rooms().find(r => r.id === selected);
    if (sel) el('rect', {x: sel.x + 0.06, y: sel.z + 0.06, width: sel.w - 0.12, height: sel.d - 0.12, fill: 'none', stroke: SIGNAL, 'stroke-width': 0.12, 'pointer-events': 'none', class: 'plan-selection'}, content);
  }

  // ---------- arrastre con vista previa ----------
  function toPlan(ev) {
    const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  function startDrag(ev, room) {
    ev.preventDefault();
    svg.focus({preventScroll: true});
    if (selected !== room.id) { selected = room.id; emit('select'); }
    if (room.locked) { notify?.('Este ambiente está fijado. Desactiva «Fijar» para moverlo.'); return; }
    const begin = toPlan(ev), u = input.module / 2;
    drag = {id: room.id, begin, dx: 0, dz: 0, valid: true, pointerId: ev.pointerId, moved: false};
    try { svg.setPointerCapture(ev.pointerId); } catch { /* sin captura */ }
    const group = svg.querySelector(`[data-id="${room.id}"]`);
    const move = e => {
      const p = toPlan(e);
      const dx = Math.round((begin.x - p.x) / u) * u, dz = Math.round((begin.y - p.y) / u) * u;
      if (dx === drag.dx && dz === drag.dz) return;
      drag.dx = dx; drag.dz = dz; drag.moved = drag.moved || dx !== 0 || dz !== 0;
      const next = rooms().map(r => (r.id === room.id ? {...r, x: r.x + dx, z: r.z + dz} : r));
      const check = validateLayout(input, next);
      drag.valid = check.ok; drag.reason = check.reason;
      group?.setAttribute('transform', `translate(${dx} ${dz})`);
      group?.classList.toggle('is-invalid', !check.ok);
      group?.classList.add('is-dragging');
      svg.querySelector('.plan-selection')?.setAttribute('transform', `translate(${dx} ${dz})`);
    };
    const end = e => {
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', end);
      svg.removeEventListener('pointercancel', end);
      try { svg.releasePointerCapture(drag.pointerId); } catch { /* ya liberado */ }
      const d = drag; drag = null;
      if (e.type === 'pointercancel' || !d.moved || (d.dx === 0 && d.dz === 0)) { draw(); return; }
      if (!d.valid) { notify?.(d.reason, 'error'); draw(); return; }
      updateRoom(room.id, {x: room.x + d.dx, z: room.z + d.dz}, 'mover');
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  }

  function updateRoom(id, patch, reason = 'editar') {
    const next = copy(rooms()), r = next.find(x => x.id === id);
    if (!r) return false;
    if (r.locked && ('x' in patch || 'z' in patch || 'w' in patch || 'd' in patch)) { notify?.('Libera el ambiente antes de modificarlo.', 'error'); return false; }
    Object.assign(r, patch);
    const check = validateLayout(input, next);
    if (!check.ok) { notify?.(check.reason, 'error'); emit('rechazado'); return false; }
    commit();
    sets[active] = next;
    revision++;
    emit(reason);
    return true;
  }

  svg.addEventListener('keydown', e => {
    const r = rooms().find(x => x.id === selected);
    if (!r) return;
    const step = e.shiftKey ? input.module : input.module / 2;
    const map = {ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step]};
    if (map[e.key]) { e.preventDefault(); updateRoom(r.id, {x: r.x + map[e.key][0], z: r.z + map[e.key][1]}, 'mover'); }
  });

  // ---------- acciones públicas ----------
  const api = {
    generate({fields = plainInput(), seed = Math.round(Math.random() * 1e9), keepLocked = true, record = true} = {}) {
      const candidate = validateInput(fields);
      const locked = keepLocked && candidate.width === input.width && candidate.depth === input.depth && candidate.module === input.module ? rooms().filter(r => r.locked) : [];
      const result = generateAlternatives(candidate, {locked, tries: 100, seed});
      if (record && rooms().length) commit();
      input = {name: candidate.name, width: candidate.width, depth: candidate.depth, module: candidate.module, bedrooms: candidate.bedrooms, bathrooms: candidate.bathrooms};
      sets = result.alternatives;
      active = 'A';
      selected = sets.A.find(r => !isHall(r))?.id || null;
      revision++;
      emit('generar');
      return result;
    },
    setActive(v) { if (!ALTERNATIVES.includes(v) || v === active) return; active = v; if (!rooms().some(r => r.id === selected)) selected = rooms().find(r => !isHall(r))?.id || null; emit('alternativa'); },
    select(id) { if (id === selected) return; selected = id; emit('select'); },
    updateRoom: (patch) => selected ? updateRoom(selected, patch) : false,
    setLocked(flag) { const r = rooms().find(x => x.id === selected); if (!r || !!r.locked === flag) return; commit(); r.locked = flag; revision++; emit('fijar'); },
    unlockAll() { if (!rooms().some(r => r.locked)) return; commit(); for (const r of rooms()) r.locked = false; revision++; emit('liberar'); },
    rename(name) { const n = String(name || '').trim().slice(0, 100); if (!n || n === input.name) return; input.name = n; emit('nombre'); },
    undo() { const s = past.pop(); if (!s) return false; future.push(snapshot()); restoreSnap(s); emit('deshacer'); return true; },
    redo() { const s = future.pop(); if (!s) return false; past.push(snapshot()); restoreSnap(s); emit('rehacer'); return true; },
    load(data) {
      const v = validateProjectState(data);
      if (rooms().length) commit();
      input = {name: v.input.name, width: v.input.width, depth: v.input.depth, module: v.input.module, bedrooms: v.input.bedrooms, bathrooms: v.input.bathrooms};
      sets = v.alternatives; active = v.active; revision = v.revision;
      selected = rooms().find(r => !isHall(r))?.id || null;
      emit('abrir');
    },
    project() { return copy({input: plainInput(), alternatives: sets, active, revision}); },
    svgMarkup() { const c = svg.cloneNode(true); c.querySelectorAll('.plan-hit,.plan-selection').forEach(n => n.remove()); return new XMLSerializer().serializeToString(c); },
    get state() { return {input: plainInput(), sets, active, selected, analysis}; }
  };
  return api;
}

// Conexiones conceptuales de media retícula. No certifica normativa.
import {validateInput, validateLayout, isHall} from './modul-core.mjs';

export function adaptCirculation(rawInput, source) {
  const input = validateInput(rawInput), {u, cols, rows} = input;
  // Los enlaces automáticos se recalculan; fijarlos o moverlos los conserva.
  const rooms = source.filter(r => !r.autoHall || r.locked).map(r => ({...r}));
  const check = validateLayout(input, rooms);
  if (!check.ok) return check;
  const key = (x, z) => z * cols + x;
  const cellsOf = r => {
    const cells = [];
    for (let z = Math.round(r.z / u); z < Math.round((r.z + r.d) / u); z++)
      for (let x = Math.round(r.x / u); x < Math.round((r.x + r.w) / u); x++) cells.push(key(x, z));
    return cells;
  };
  const neighbors = k => {
    const x = k % cols, z = Math.floor(k / cols);
    return [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]
      .filter(([xx, zz]) => xx >= 0 && zz >= 0 && xx < cols && zz < rows).map(([xx, zz]) => key(xx, zz));
  };
  const solid = new Set(rooms.filter(r => !isHall(r)).flatMap(cellsOf));
  const existing = new Set(rooms.filter(isHall).flatMap(cellsOf));
  const network = new Set([key(Math.floor(cols / 2), 0)]);
  const connect = targets => {
    if ([...targets].some(k => network.has(k))) return true;
    const queue = [...network], parent = new Map(queue.map(k => [k, null]));
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i];
      if (targets.has(k)) {
        for (let p = k; p !== null; p = parent.get(p)) network.add(p);
        return true;
      }
      for (const n of neighbors(k)) if (!solid.has(n) && !parent.has(n)) { parent.set(n, k); queue.push(n); }
    }
    return false;
  };
  // Conecta también pasillos trasladados, aunque estén separados del vestíbulo.
  for (const hall of rooms.filter(isHall)) {
    const cells = cellsOf(hall);
    if (!connect(new Set(cells))) return {ok: false, reason: hall.name + ' quedaría sin conexión al ingreso.'};
    cells.forEach(k => network.add(k));
  }
  for (const room of rooms.filter(r => !isHall(r))) {
    const targets = new Set(cellsOf(room).flatMap(neighbors).filter(k => !solid.has(k)));
    if (!connect(targets)) return {ok: false, reason: room.name + ' no admite una conexión libre dentro de la zona edificable.'};
  }
  // Agrupa celdas nuevas en rectángulos sin solapes para el plano, 3D y despiece.
  const pending = new Set([...network].filter(k => !existing.has(k)));
  const ids = new Set(rooms.map(r => r.id));
  let seq = 1;
  for (const start of [...pending].sort((a, b) => a - b)) {
    if (!pending.has(start)) continue;
    const x = start % cols, z = Math.floor(start / cols);
    let w = 1, d = 1;
    while (x + w < cols && pending.has(key(x + w, z))) w++;
    while (z + d < rows && Array.from({length: w}, (_, dx) => key(x + dx, z + d)).every(k => pending.has(k))) d++;
    for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) pending.delete(key(x + dx, z + dz));
    while (ids.has('CON' + seq)) seq++;
    const id = 'CON' + seq++; ids.add(id);
    rooms.push({id, name: 'Conexión', type: 'hall', x: x * u, z: z * u, w: w * u, d: d * u, locked: false, autoHall: true});
  }
  const result = validateLayout(input, rooms);
  return result.ok ? {...result, rooms} : result;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptCirculation} from '../public/dist/modul-circulation.mjs';
import {generateAlternatives, validateLayout, validateProjectState, isHall, adjacent, migrateRoom} from '../public/dist/modul-core.mjs';
import {analyzeLayout} from '../public/dist/modul-plan.mjs';
const input = {name: 'Ensayo', width: 12, depth: 18, module: 3, bedrooms: 2, bathrooms: 1};
const base = () => generateAlternatives(input, {seed: 20261027}).alternatives.A;
function assertConnected(rooms) {
  const halls = rooms.filter(isHall);
  const entry = halls.find(r => r.z === 0 && r.x <= 6 && r.x + r.w > 6);
  assert.ok(entry, 'circulación física en el ingreso');
  const seen = new Set([entry]);
  for (const hall of seen) for (const other of halls) if (adjacent(hall, other)) seen.add(other);
  assert.equal(seen.size, halls.length, 'todos los pasillos conectados entre sí');
  for (const r of rooms.filter(r => !isHall(r))) assert.ok([...seen].some(h => adjacent(h, r)), r.name + ' toca circulación conectada');
  assert.equal(validateLayout(input, rooms).ok, true);
  const analysis = analyzeLayout(input, rooms);
  assert.ok(analysis.entry);
  for (const r of analysis.rooms.filter(r => !isHall(r))) {
    assert.ok(r.door, r.name + ' tiene puerta');
    const run = analysis.runs.find(run => run.id === r.door.run);
    assert.ok([run.A, run.B].some(i => i >= 0 && isHall(analysis.rooms[i])), 'la puerta abre al hall');
  }
}
test('alejar dormitorio crea conexión física y no modifica los otros ambientes', () => {
  const original = base(), moved = original.map(r => r.id === 'D01' ? {...r, z: r.z + 4.5} : r);
  const before = JSON.stringify(moved), result = adaptCirculation(input, moved);
  assert.equal(result.ok, true, result.reason); assert.equal(JSON.stringify(moved), before);
  assert.ok(result.rooms.some(r => r.autoHall)); assertConnected(result.rooms);
  for (const r of moved) assert.deepEqual(result.rooms.find(o => o.id === r.id), r);
});
test('volver el dormitorio elimina conexiones obsoletas; recalcular es estable', () => {
  const original = base(), bedroom = original.find(r => r.id === 'D01');
  const moved = adaptCirculation(input, original.map(r => r.id === bedroom.id ? {...r, z: r.z + 4.5} : r));
  assert.equal(moved.ok, true, moved.reason);
  const returned = adaptCirculation(input, moved.rooms.map(r => r.id === bedroom.id ? bedroom : r));
  assert.equal(returned.ok, true); assert.deepEqual(returned.rooms, original);
  assert.deepEqual(adaptCirculation(input, moved.rooms).rooms, moved.rooms);
});
test('trasladar hall lo conecta de nuevo al ingreso y a los ambientes', () => {
  const rooms = [
    {id: 'S', name: 'Sala', type: 'social', x: 0, z: 0, w: 3, d: 3},
    {id: 'H', name: 'Hall', type: 'hall', x: 6, z: 6, w: 1.5, d: 3}
  ];
  const result = adaptCirculation(input, rooms);
  assert.equal(result.ok, true, result.reason); assertConnected(result.rooms);
  assert.deepEqual(result.rooms.find(r => r.id === 'H'), rooms[1]);
});
test('rechaza solapes, reserva, ingreso bloqueado y zonas inaccesibles', () => {
  const original = base();
  for (const patch of [{x: -1.5}, {z: 15}, {x: 6, z: 0}, {x: 0.1}]) {
    assert.equal(adaptCirculation(input, original.map(r => r.id === 'D01' ? {...r, ...patch} : r)).ok, false);
  }
  const sealed = [
    {id: 'B', name: 'Barrera', type: 'other', x: 0, z: 3, w: 12, d: 1.5},
    {id: 'H', name: 'Hall aislado', type: 'hall', x: 6, z: 6, w: 1.5, d: 3}
  ];
  assert.equal(adaptCirculation(input, sealed).ok, false);
});
test('conserva conexiones fijadas y sus acabados', () => {
  const result = adaptCirculation(input, base().map(r => r.id === 'D01' ? {...r, z: r.z + 4.5} : r));
  const fixed = {...result.rooms.find(r => r.autoHall), locked: true, floorColor: '#123456'};
  const next = adaptCirculation(input, result.rooms.map(r => r.id === fixed.id ? fixed : r));
  assert.equal(next.ok, true); assert.deepEqual(next.rooms.find(r => r.id === fixed.id), fixed);
});
test('persistencia compatible de estilos, colores y conexiones en A/B/C', () => {
  const result = adaptCirculation(input, base().map(r => r.id === 'D01' ? {...r, z: r.z + 4.5, windowStyle: 'folding', floorColor: '#123456', wallColor: '#abcdef'} : r));
  const project = {input, alternatives: {A: result.rooms, B: result.rooms, C: result.rooms}, active: 'C'};
  const loaded = validateProjectState(JSON.parse(JSON.stringify(project)));
  for (const rooms of Object.values(loaded.alternatives)) {
    assert.equal(rooms.find(r => r.id === 'D01').windowStyle, 'folding');
    assert.equal(rooms.find(r => r.id === 'D01').floorColor, '#123456');
    assert.equal(rooms.find(r => r.id === 'D01').wallColor, '#abcdef');
    assert.ok(rooms.some(r => r.autoHall)); assertConnected(rooms);
  }
  const legacy = base()[0]; assert.deepEqual(migrateRoom(legacy), legacy);
  const clean = migrateRoom({...legacy, windowStyle: 'unsupported', wallColor: 'url(evil)', floorColor: '#123'});
  assert.deepEqual(clean, legacy);
});
test('movimientos válidos en las tres alternativas mantienen conectividad', () => {
  const alternatives = generateAlternatives(input, {seed: 42}).alternatives;
  let accepted = 0;
  for (const rooms of Object.values(alternatives)) for (const room of rooms) {
    for (const [dx, dz] of [[0, 1.5], [0, 3], [1.5, 0], [-1.5, 0]]) {
      const result = adaptCirculation(input, rooms.map(r => r.id === room.id ? {...r, x: r.x + dx, z: r.z + dz} : r));
      if (result.ok) { accepted++; assertConnected(result.rooms); }
    }
  }
  assert.ok(accepted > 10);
});

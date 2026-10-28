import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInput,validateLayout,generateAlternatives,validateProjectState} from '../public/dist/modul-core.mjs';
const valid={name:'Caso de ensayo',width:12,depth:15,module:3,bedrooms:2,bathrooms:1};
test('validación dimensional',()=>{assert.equal(validateInput(valid).u,1.5);assert.throws(()=>validateInput({...valid,module:1}),/módulo/i);});
test('rechaza solapes',()=>{const a={id:'SAL',name:'Sala',type:'social',x:0,z:0,w:3,d:3};const b={...a,id:'COM'};assert.equal(validateLayout(valid,[a,b]).ok,false);});
test('rechaza invasión de reserva',()=>{const a={id:'SAL',name:'Sala',type:'social',x:0,z:13.5,w:3,d:1.5};assert.equal(validateLayout(valid,[a]).ok,false);});
test('genera y conserva A/B/C',()=>{const result=generateAlternatives(valid,{seed:934,tries:100});for(const v of ['A','B','C'])assert.equal(validateLayout(valid,result.alternatives[v]).ok,true);const restored=validateProjectState({input:valid,alternatives:result.alternatives,active:'B'});assert.equal(restored.active,'B');});
test('conserva geometría fijada',()=>{const base=generateAlternatives(valid,{seed:934,tries:100}).alternatives.A[0];const fixed={...base,locked:true};const result=generateAlternatives(valid,{locked:[fixed],seed:3412,tries:100});for(const v of ['A','B','C']){const r=result.alternatives[v].find(x=>x.id===fixed.id);assert.equal(r.x,fixed.x);assert.equal(r.z,fixed.z);}});
import {layoutMetrics, isHall} from '../public/dist/modul-core.mjs';
test('distribución compacta con circulación', () => {
  const r = generateAlternatives(valid, {seed: 20261027});
  for (const v of ['A', 'B', 'C']) {
    const rooms = r.alternatives[v];
    assert.equal(validateLayout(valid, rooms).ok, true);
    assert.ok(rooms.some(isHall), 'incluye ingreso/pasillo');
    assert.ok(layoutMetrics(r.input, rooms).compactness > 0.85, 'volumen compacto');
  }
  assert.notDeepEqual(r.alternatives.A, r.alternatives.B);
});
test('lote angosto y programa grande también se resuelven', () => {
  for (const input of [{...valid, width: 9, depth: 20, bedrooms: 3, bathrooms: 2}, {...valid, bedrooms: 4, bathrooms: 2}]) {
    const r = generateAlternatives(input, {seed: 7});
    assert.equal(validateLayout(input, r.alternatives.A).ok, true);
    assert.ok(layoutMetrics(r.input, r.alternatives.A).compactness > 0.8);
  }
});
test('no se puede mover un ambiente sobre la circulación', () => {
  const rooms = generateAlternatives(valid, {seed: 3}).alternatives.A;
  const hall = rooms.find(isHall), sal = rooms.find(r => r.id === 'SAL');
  const moved = rooms.map(r => r === sal ? {...r, x: hall.x, z: hall.z} : r);
  assert.equal(validateLayout(valid, moved).ok, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInput,validateLayout,generateAlternatives,validateProjectState} from '../dist/modul-core.mjs';
const valid={name:'Caso de ensayo',width:12,depth:15,module:3,bedrooms:2,bathrooms:1};
test('validación dimensional',()=>{assert.equal(validateInput(valid).u,1.5);assert.throws(()=>validateInput({...valid,module:1}),/módulo/i);});
test('rechaza solapes',()=>{const a={id:'SAL',name:'Sala',type:'social',x:0,z:0,w:3,d:3};const b={...a,id:'COM'};assert.equal(validateLayout(valid,[a,b]).ok,false);});
test('rechaza invasión de reserva',()=>{const a={id:'SAL',name:'Sala',type:'social',x:0,z:13.5,w:3,d:1.5};assert.equal(validateLayout(valid,[a]).ok,false);});
test('genera y conserva A/B/C',()=>{const result=generateAlternatives(valid,{seed:934,tries:100});for(const v of ['A','B','C'])assert.equal(validateLayout(valid,result.alternatives[v]).ok,true);const restored=validateProjectState({input:valid,alternatives:result.alternatives,active:'B'});assert.equal(restored.active,'B');});
test('conserva geometría fijada',()=>{const base=generateAlternatives(valid,{seed:934,tries:100}).alternatives.A[0];const fixed={...base,locked:true};const result=generateAlternatives(valid,{locked:[fixed],seed:3412,tries:100});for(const v of ['A','B','C']){const r=result.alternatives[v].find(x=>x.id===fixed.id);assert.equal(r.x,fixed.x);assert.equal(r.z,fixed.z);}});

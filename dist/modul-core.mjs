// MODUL-AI | Motor de exploración heurística conceptual v0.3
// Unidades: metros. No valida normas, estructura, salubridad ni accesibilidad.
export const ALTERNATIVES=['A','B','C'];
const clone=x=>JSON.parse(JSON.stringify(x));
const EPS=1e-5;
export function validateInput(i) {
  const d={name:String(i.name||'').trim(),width:Number(i.width),depth:Number(i.depth),
    module:Number(i.module),bedrooms:Number(i.bedrooms),bathrooms:Number(i.bathrooms)};
  if(!d.name||d.name.length>100) throw Error('El proyecto necesita un nombre de 1 a 100 caracteres.');
  if(!(d.width>=7.2&&d.width<=60&&d.depth>=9.6&&d.depth<=60)) throw Error('El ancho debe ser 7,2–60 m y el fondo 9,6–60 m.');
  if(!(d.module>=2.4&&d.module<=4.8)) throw Error('El módulo debe medir entre 2,4 y 4,8 m.');
  if(!Number.isInteger(d.bedrooms)||d.bedrooms<1||d.bedrooms>6) throw Error('Dormitorios: de 1 a 6.');
  if(!Number.isInteger(d.bathrooms)||d.bathrooms<1||d.bathrooms>3) throw Error('Baños: de 1 a 3.');
  const u=d.module/2,cols=Math.floor(d.width/u+EPS),rows=Math.floor((d.depth-d.module)/u+EPS);
  if(cols<4||rows<4) throw Error('El área útil no admite la retícula y la reserva posterior.');
  if(cols*rows>3000) throw Error('Retícula demasiado extensa para el explorador local.');
  return {...d,u,cols,rows,usableWidth:cols*u,usableDepth:rows*u};
}
export function program(input) {
  const common=[
    {id:'SAL',name:'Sala',type:'social',w:2,d:2},
    {id:'COM',name:'Comedor',type:'social',w:2,d:2},
    {id:'COC',name:'Cocina',type:'kitchen',w:2,d:2}];
  for(let n=1;n<=input.bedrooms;n++) common.push({id:'D'+String(n).padStart(2,'0'),name:'Dormitorio '+n,type:'bedroom',w:2,d:2});
  for(let n=1;n<=input.bathrooms;n++) common.push({id:'B'+String(n).padStart(2,'0'),name:'Baño '+n,type:'bath',w:2,d:2});
  return common;
}
const rect=(r,u)=>({x:Math.round(r.x/u),z:Math.round(r.z/u),w:Math.round(r.w/u),d:Math.round(r.d/u)});
function cellKey(x,z){return x+':'+z;}
function overlaps(a,b){return a.x<b.x+b.w && a.x+a.w>b.x && a.z<b.z+b.d && a.z+a.d>b.z;}
function planGrid(input,rooms) {
  const occupied=new Set();
  for(const r of rooms){
    const g=rect(r,input.u);
    if(g.x<0||g.z<0||g.w<1||g.d<1||g.x+g.w>input.cols||g.z+g.d>input.rows)return null;
    for(let z=g.z;z<g.z+g.d;z++)for(let x=g.x;x<g.x+g.w;x++){
      const key=cellKey(x,z);if(occupied.has(key))return null;occupied.add(key);
    }
  }
  return occupied;
}
export function validateLayout(i,rooms,{requireAccess=true}={}) {
  const input=validateInput(i);
  if(!Array.isArray(rooms)||!rooms.length)return {ok:false,reason:'La distribución está vacía.'};
  for(const r of rooms){
    if(![r.x,r.z,r.w,r.d].every(Number.isFinite))return {ok:false,reason:'Una habitación contiene medidas inválidas.'};
    if(r.w<=0||r.d<=0)return {ok:false,reason:'Cada habitación necesita dimensiones positivas.'};
    for(const v of [r.x,r.z,r.w,r.d])if(Math.abs(v/input.u-Math.round(v/input.u))>EPS)
      return {ok:false,reason:'Ajusta la posición y medidas a media retícula.'};
  }
  const occupied=planGrid(input,rooms);
  if(!occupied)return {ok:false,reason:'Hay solapes, superficies no válidas o piezas fuera de la zona edificable.'};
  const entrance=[Math.floor(input.cols/2),0];
  if(occupied.has(cellKey(...entrance)))return {ok:false,reason:'La celda frontal de entrada debe permanecer libre.'};
  if(!requireAccess)return {ok:true,reason:'Geometría válida.',occupied};
  const q=[entrance],seen=new Set([cellKey(...entrance)]);
  for(let k=0;k<q.length;k++){
    const [x,z]=q[k];
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const xx=x+dx,zz=z+dz,key=cellKey(xx,zz);
      if(xx<0||zz<0||xx>=input.cols||zz>=input.rows||occupied.has(key)||seen.has(key))continue;
      seen.add(key);q.push([xx,zz]);
    }
  }
  for(const r of rooms){
    const g=rect(r,input.u);let open=false;
    for(let z=g.z;z<g.z+g.d&&!open;z++)for(const x of [g.x-1,g.x+g.w])if(seen.has(cellKey(x,z))){open=true;break;}
    for(let x=g.x;x<g.x+g.w&&!open;x++)for(const z of [g.z-1,g.z+g.d])if(seen.has(cellKey(x,z))){open=true;break;}
    if(!open)return {ok:false,reason:r.name+' no tiene borde contiguo a espacio libre conectado con la entrada.'};
  }
  return {ok:true,reason:'Distribución conceptual válida.',occupied,freeCells:seen.size};
}
function random(seed){let v=(seed>>>0)||0x5a17;return()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return (v>>>0)/4294967296;};}
function chooseScore(input,rooms,variant){
  const front=rooms.find(r=>r.id==='SAL');
  const kitchen=rooms.find(r=>r.id==='COC');
  const beds=rooms.filter(r=>r.type==='bedroom');
  const baths=rooms.filter(r=>r.type==='bath');
  let score=100-(front?front.z:0)*(variant==='A'?2.4:1.7);
  if(front) score+=Math.max(0,12-Math.abs(front.x-input.usableWidth/2)*1.2);
  for(const b of beds){
    const perimeter=Math.min(b.x,b.z,input.usableWidth-b.x-b.w,input.usableDepth-b.z-b.d);
    score+=Math.max(0,12-perimeter*4);
    if(front){const dist=Math.abs(b.x-front.x)+Math.abs(b.z-front.z);score+=Math.min(17,dist*(variant==='B'?2.1:1));}
  }
  if(kitchen){for(const b of baths){const d=Math.abs(b.x-kitchen.x)+Math.abs(b.z-kitchen.z);score+=Math.max(0,15-d*(variant==='C'?2.5:1.4));}}
  const comedor=rooms.find(r=>r.id==='COM');
  if(front&&comedor)score+=Math.max(0,15-(Math.abs(front.x-comedor.x)+Math.abs(front.z-comedor.z))*3);
  if(kitchen&&comedor)score+=Math.max(0,12-(Math.abs(kitchen.x-comedor.x)+Math.abs(kitchen.z-comedor.z))*2);
  return Math.round(score*10)/10;
}
function shuffled(arr,rng){const c=[...arr];for(let k=c.length-1;k>0;k--){const j=Math.floor(rng()*(k+1));[c[k],c[j]]=[c[j],c[k]];}return c;}
function placeCandidate(input,template,locked,rng){
  const occupied=planGrid(input,locked);
  if(!occupied)return null;
  const result=locked.map(clone);
  // Place rooms in variable order; prioritize constraints such as large rooms.
  const pending=shuffled(template.filter(p=>!locked.some(l=>l.id===p.id)),rng);
  for(const room of pending){
    const locs=[];
    for(let z=0;z<=input.rows-room.d;z++)
      for(let x=0;x<=input.cols-room.w;x++){
        let valid=true;
        for(let dz=0;dz<room.d&&valid;dz++)for(let dx=0;dx<room.w;dx++)if(occupied.has(cellKey(x+dx,z+dz))){valid=false;break;}
        if(!valid|| (x<=Math.floor(input.cols/2)&&Math.floor(input.cols/2)<x+room.w&&z===0))continue;
        const edge=Math.min(x,z,input.cols-x-room.w,input.rows-z-room.d);
        const preference=room.type==='social'?Math.max(0,input.rows-z)*.17:room.type==='bedroom'?Math.max(0,4-edge)*.5:0;
        locs.push({x,z,pref:preference+rng()*8});
      }
    if(!locs.length)return null;
    // Randomized greedy with different distributions each attempt.
    locs.sort((a,b)=>b.pref-a.pref);
    const pick=locs[Math.floor(rng()*Math.min(locs.length,12))];
    const r={id:room.id,name:room.name,type:room.type,
      x:pick.x*input.u,z:pick.z*input.u,w:room.w*input.u,d:room.d*input.u,locked:false};
    result.push(r);
    for(let z=pick.z;z<pick.z+room.d;z++)for(let x=pick.x;x<pick.x+room.w;x++)occupied.add(cellKey(x,z));
  }
  return template.map(t=>result.find(r=>r.id===t.id));
}
export function generateAlternatives(data,{locked=[],seed=20261027,tries=100}={}){
  const input=validateInput(data);const templ=program(input);
  const wanted=new Map(templ.map(r=>[r.id,r]));
  if(!Array.isArray(locked))throw Error('El estado de bloqueos no es válido.');
  const fixed=locked.map(r=>{
    const t=wanted.get(r.id);
    if(!t)throw Error('La habitación fijada ya no existe en el programa: '+r.id);
    return {id:t.id,name:t.name,type:t.type,x:r.x,z:r.z,w:r.w,d:r.d,locked:true};
  });
  const baseValidity=validateLayout(input,fixed,{requireAccess:false});
  if(fixed.length&&!baseValidity.ok)throw Error('Los ambientes fijados se solapan o invaden la reserva.');
  const out={A:null,B:null,C:null},validCounts={A:0,B:0,C:0},signatures=new Set();
  const n=Math.min(200,Math.max(1,Math.floor(tries)));
  for(const [variant,idx] of ALTERNATIVES.map((v,i)=>[v,i])){
    const rng=random(seed+idx*271828+Math.round(input.width*100));
    const successes=[];
    for(let t=0;t<n;t++){
      const rooms=placeCandidate(input,templ,fixed,rng);
      if(!rooms)continue;
      const checked=validateLayout(input,rooms);
      if(!checked.ok)continue;
      validCounts[variant]++;
      const fingerprint=rooms.map(r=>r.id+':'+r.x+':'+r.z).join('|');
      if(signatures.has(fingerprint))continue;
      successes.push({rooms,score:chooseScore(input,rooms,variant),fingerprint});
    }
    successes.sort((a,b)=>b.score-a.score);
    if(successes.length){
      const best=successes[0];signatures.add(best.fingerprint);
      out[variant]=best.rooms.map(clone);
    }
  }
  if(!out.A&&!out.B&&!out.C) throw Error('No se encontró distribución válida en la búsqueda. Conserva la última configuración y prueba menos fijaciones o un terreno mayor; no demuestra imposibilidad.');
  for(const v of ALTERNATIVES)if(!out[v])out[v]=clone(out.A||out.B||out.C);
  return {input,alternatives:out,validCounts,scoring:'heurístico conceptual',tries:n};
}
export function migrateRoom(r){return {id:String(r.id),name:String(r.name),type:String(r.type||'other'),x:Number(r.x),z:Number(r.z),w:Number(r.w),d:Number(r.d),locked:!!r.locked};}
export function validateProjectState(raw){
  if(!raw||typeof raw!=='object')throw Error('El archivo no contiene un proyecto.');
  const input=validateInput(raw.input);
  if(!raw.alternatives||!ALTERNATIVES.every(v=>Array.isArray(raw.alternatives[v])))throw Error('Faltan alternativas A/B/C.');
  const alternatives={};
  for(const a of ALTERNATIVES){
    alternatives[a]=raw.alternatives[a].map(migrateRoom);
    if(!alternatives[a].length||alternatives[a].length>25)throw Error('Número de ambientes fuera de rango.');
    const valid=validateLayout(input,alternatives[a]);
    if(!valid.ok)throw Error('Alternativa '+a+': '+valid.reason);
  }
  const active=ALTERNATIVES.includes(raw.active)?raw.active:'A';
  return {input,alternatives,active,revision:Number(raw.revision)||1};
}

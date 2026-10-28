import {generateAlternatives,validateLayout,validateInput,validateProjectState} from './modul-core.mjs';
export function initStudio({supabase,sets,updated,select}) {
const by=id=>document.getElementById(id),copy=x=>JSON.parse(JSON.stringify(x));
let active='A',selected='SAL',revision=1;const history=[];
let input={name:'Vivienda modular',width:12,depth:15,module:3,bedrooms:2,bathrooms:1};
const msg=(s)=>by('studioStatus').textContent=s;
const activeRooms=()=>sets[active]||[];
const snapshot=()=>{history.push(copy({sets,active,selected,input}));if(history.length>30)history.shift();};
function render() {
 const root=by('planSvg');root.replaceChildren();
 const ns='http://www.w3.org/2000/svg',el=(tag,attrs,parent=root)=>{const n=document.createElementNS(ns,tag);for(const [key,val] of Object.entries(attrs))n.setAttribute(key,val);parent.append(n);return n;};
 root.setAttribute('viewBox','0 0 '+input.width+' '+input.depth);
 el('rect',{x:0,y:0,width:input.width,height:input.depth,fill:'#12313b'});
 el('rect',{x:0,y:input.depth-input.module,width:input.width,height:input.module,fill:'#244943',stroke:'#8de6c0','stroke-dasharray':'.2,.2','stroke-width':'.05'});
 const palette={social:'#63e0b8',bedroom:'#8db0f5',bath:'#b89ce9',kitchen:'#f0c184',other:'#97d4cd'};
 for(const r of activeRooms()){
   const g=el('g',{});const box=el('rect',{x:r.x,y:r.z,width:r.w,height:r.d,fill:palette[r.type]||palette.other,stroke:r.id===selected?'white':r.locked?'#ffe5a4':'#16313c','stroke-width':r.id===selected?.13:.06},g);
   const label=el('text',{x:r.x+r.w/2,y:r.z+r.d/2,'font-size':'.34','text-anchor':'middle','dominant-baseline':'middle',fill:'#102731'},g);label.textContent=r.name+(r.locked?' *':'');
   box.style.cursor='grab';box.addEventListener('pointerdown',event=>{selected=r.id;select(selected);fillEditor();render();if(r.locked)return;
      const point=root.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const begin=point.matrixTransform(root.getScreenCTM().inverse());
      function release(ev){root.removeEventListener('pointerup',release);const p=root.createSVGPoint();p.x=ev.clientX;p.y=ev.clientY;const end=p.matrixTransform(root.getScreenCTM().inverse()),u=input.module/2;
        if(Math.hypot(end.x-begin.x,end.y-begin.y)<u/4)return;
        updateRoom({x:Math.round((r.x+end.x-begin.x)/u)*u,z:Math.round((r.z+end.y-begin.y)/u)*u});}
      root.addEventListener('pointerup',release,{once:true});
   });
 }
 for(const b of document.querySelectorAll('[data-studio-alt]'))b.classList.toggle('active',b.dataset.studioAlt===active);
 updated({sets,active,selected,input});fillEditor();
}
function fillEditor(){const r=activeRooms().find(r=>r.id===selected);if(!r)return;by('studioSelected').textContent=r.name;for(const [k,id] of [['x','roomX'],['z','roomZ'],['w','roomW'],['d','roomD']])by(id).value=r[k];by('studioLocked').checked=!!r.locked;}
function updateRoom(patch){const next=copy(activeRooms()),r=next.find(r=>r.id===selected);if(!r)return;if(r.locked){msg('Libera el ambiente antes de moverlo.');return;}Object.assign(r,patch);
 const result=validateLayout(input,next);if(!result.ok){msg(result.reason);return;}snapshot();sets[active]=next;revision++;render();msg('Planta 2D y 3D actualizadas.');}
function generate(){try{
 const v={name:by('projectName').value,width:+by('plotWidth').value,depth:+by('plotDepth').value,module:+by('moduleSize').value,bedrooms:+by('bedCount').value,bathrooms:+by('bathCount').value};
 const candidate=validateInput(v);const locked=activeRooms().filter(r=>r.locked);
 const result=generateAlternatives(candidate,{locked,tries:100,seed:Math.round(Math.random()*1e9)});
 snapshot();input=candidate;Object.assign(sets,result.alternatives);active='A';selected=sets.A[0].id;revision++;render();msg('Tres alternativas generadas por búsqueda heurística.');}
 catch(e){msg(e.message);}}
async function save(){try{const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw Error('Inicia sesión en Mi nube para guardar el proyecto.');
 const design=copy({alternatives:sets,active,revision});
 const {error:err}=await supabase.from('modul_projects').insert({name:input.name,owner_id:data.user.id,schema_version:'0.3-unificado',input:{...input,design},result:{mode:'heuristico-conceptual',area_m2:activeRooms().reduce((a,r)=>a+r.w*r.d,0)},selected:active});
 if(err)throw err;msg('Proyecto 2D + 3D guardado en Supabase.');}catch(e){msg(e.message);}}
async function load(){try{const {data:auth,error:authErr}=await supabase.auth.getUser();if(authErr||!auth.user)throw Error('Inicia sesión en Mi nube.');
 const {data,error}=await supabase.from('modul_projects').select('id,name,input,selected,created_at').order('created_at',{ascending:false}).limit(20);if(error)throw error;
 const target=by('studioVersions');target.replaceChildren();
 for(const item of data){const btn=document.createElement('button');btn.textContent=item.name+' · '+new Date(item.created_at).toLocaleString('es-PE');btn.className='studio-version';
 btn.addEventListener('click',()=>{try{const raw=item.input;if(!raw.design?.alternatives)throw Error('Versión del editor original: requiere adaptador antes de restaurar.');
 const verified=validateProjectState({input:raw,alternatives:raw.design.alternatives,active:raw.design.active,revision:raw.design.revision});
 snapshot();input=verified.input;Object.assign(sets,verified.alternatives);active=verified.active;selected=sets[active][0].id;revision=verified.revision;for(const [k,id] of Object.entries({name:'projectName',width:'plotWidth',depth:'plotDepth',module:'moduleSize',bedrooms:'bedCount',bathrooms:'bathCount'}))by(id).value=input[k];render();msg('Versión restaurada en 2D y 3D.');}
 catch(e){msg(e.message);}});target.append(btn);}msg(data.length+' versiones encontradas.');}catch(e){msg(e.message);}}
by('studioGenerate').onclick=generate;
by('studioDemo').onclick=()=>{for(const [id,value] of Object.entries({projectName:'Vivienda modular',plotWidth:12,plotDepth:15,moduleSize:3,bedCount:2,bathCount:1}))by(id).value=value;generate();};
by('studioApply').onclick=()=>updateRoom({x:+by('roomX').value,z:+by('roomZ').value,w:+by('roomW').value,d:+by('roomD').value});
by('studioLocked').onchange=e=>{snapshot();const r=activeRooms().find(r=>r.id===selected);if(r){r.locked=e.target.checked;revision++;render();}};
by('studioUnlock').onclick=()=>{snapshot();for(const r of activeRooms())r.locked=false;render();};
by('studioUndo').onclick=()=>{const prev=history.pop();if(!prev)return msg('No hay cambios para deshacer.');Object.assign(sets,prev.sets);active=prev.active;selected=prev.selected;input=prev.input;render();};
for(const b of document.querySelectorAll('[data-studio-alt]'))b.onclick=()=>{active=b.dataset.studioAlt;selected=sets[active][0]?.id;render();};
by('studioSave').onclick=save;by('studioLoad').onclick=load;
function download(text,name,mime){const u=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
by('studioJson').onclick=()=>download(JSON.stringify({input,alternatives:sets,active,revision},null,2),'modul-ai-proyecto.json','application/json');
by('studioSvg').onclick=()=>{const svg=by('planSvg').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');download(new XMLSerializer().serializeToString(svg),'modul-ai-planta.svg','image/svg+xml');};
render();return {get state(){return {input,sets,active,selected}},setSelected(id){selected=id;fillEditor();}};
}
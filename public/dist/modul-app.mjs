// MODUL-AI | Interfaz: conecta el editor 2D, el visor 3D, la cuenta y los proyectos.
import {createStudio, DEMO_INPUT, DEMO_SEED, ZONE_FILL} from './modul-studio.mjs';
import {VARIANT_NAMES, TYPE_NAMES, layoutMetrics, isHall, ALTERNATIVES} from './modul-core.mjs';
import {bill} from './modul-plan.mjs';
import {api} from './modul-api.mjs';

const $ = id => document.getElementById(id);
const fmt = (n, d = 1) => Number(n).toLocaleString('es-PE', {minimumFractionDigits: d, maximumFractionDigits: d});
const store = {
  get(k) { try { return localStorage.getItem('modul:' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('modul:' + k, v); } catch { /* sin almacenamiento */ } }
};

// ---------- avisos ----------
function toast(message, kind = 'info') {
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (kind === 'error' ? ' is-error' : kind === 'ok' ? ' is-ok' : '');
  t.textContent = message;
  box.append(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => t.remove(), kind === 'error' ? 4200 : 2800);
}

// ---------- visor 3D (opcional si WebGL falla) ----------
let viewer = null;
let studio = null;
try {
  const {createViewer} = await import('./modul-3d.mjs');
  viewer = createViewer($('stage3d'), {onSelect: id => studio?.select(id), onPaint: (id, surface) => { studio?.select(id); studio?.paint(id, surface, $('paintColor').value); }});
} catch (err) {
  console.error(err);
  const p = document.createElement('p');
  p.className = 'empty';
  p.style.margin = '24px';
  p.textContent = 'Este navegador no pudo iniciar el modelo 3D. El plano y el guardado siguen funcionando.';
  $('stage3d').replaceWith(p);
}

// ---------- estado de la interfaz ----------
let current = null, user = null, pendingSave = false, lastBill = null;
const FIELD_IDS = {width: 'plotWidth', depth: 'plotDepth', module: 'moduleSize', bedrooms: 'bedCount', bathrooms: 'bathCount'};

function writeProgram(input) {
  for (const [k, id] of Object.entries(FIELD_IDS)) $(id).value = input[k];
  $('projectName').value = input.name;
  document.title = input.name + ' · MODUL-AI';
}
function readProgram() {
  return {name: $('projectName').value.trim() || 'Proyecto sin nombre', width: +$('plotWidth').value, depth: +$('plotDepth').value,
    module: +$('moduleSize').value, bedrooms: +$('bedCount').value, bathrooms: +$('bathCount').value};
}

function thumb(input, rooms) {
  const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', `-0.4 -0.4 ${input.width + 0.8} ${input.depth + 0.8}`);
  s.setAttribute('aria-hidden', 'true');
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('transform', `rotate(180 ${input.width / 2} ${input.depth / 2})`);
  s.append(g);
  const add = (attrs) => { const r = document.createElementNS(ns, 'rect'); for (const [k, v] of Object.entries(attrs)) r.setAttribute(k, v); g.append(r); };
  add({x: 0, y: 0, width: input.width, height: input.depth, fill: '#EEF2E9', stroke: '#9AA695', 'stroke-width': 0.12});
  for (const r of rooms) add({x: r.x, y: r.z, width: r.w, height: r.d, fill: r.floorColor || ZONE_FILL[r.type] || ZONE_FILL.other, stroke: '#26313C', 'stroke-width': isHall(r) ? 0.06 : 0.14});
  return s;
}

function renderAlternatives(state) {
  const list = $('altList');
  list.replaceChildren();
  for (const v of ALTERNATIVES) {
    const rooms = state.sets[v] || [];
    const b = document.createElement('button');
    b.className = 'alt';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(v === state.active));
    const m = rooms.length ? layoutMetrics(state.input, rooms) : null;
    const info = document.createElement('span');
    const name = document.createElement('span'); name.className = 'alt-name';
    const letter = document.createElement('span'); letter.className = 'alt-letter'; letter.textContent = v;
    name.append(letter, document.createTextNode(VARIANT_NAMES[v]));
    const stats = document.createElement('span'); stats.className = 'alt-stats';
    stats.textContent = m ? fmt(m.built) + ' m² construidos' : '';
    info.append(name, stats);
    b.append(thumb(state.input, rooms), info);
    b.addEventListener('click', () => studio.setActive(v));
    list.append(b);
  }
}

function renderMetrics(state) {
  const dl = $('metrics');
  dl.replaceChildren();
  if (!state.rooms.length) return;
  const m = layoutMetrics(state.input, state.rooms);
  const items = [['Lote', `${fmt(state.input.width)} × ${fmt(state.input.depth)} m`], ['Área construida', fmt(m.built) + ' m²'],
    ['Ocupación del lote', Math.round(m.occupancy * 100) + ' %'], ['Ambientes', String(m.rooms)], ['Alternativa', state.active + ', ' + VARIANT_NAMES[state.active]]];
  for (const [k, v] of items) {
    const d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k; dd.textContent = v; d.append(dt, dd); dl.append(d);
  }
}

function renderInspector(state, force = false) {
  const r = state.rooms.find(x => x.id === state.selected);
  const card = $('roomCard');
  card.classList.toggle('is-empty', !r);
  $('roomName').textContent = r ? r.name : 'Sin selección';
  $('roomType').textContent = r ? TYPE_NAMES[r.type] || '' : '';
  $('roomArea').textContent = r ? `${fmt(r.w, 2)} × ${fmt(r.d, 2)} m, ${fmt(r.w * r.d, 2)} m²` : 'Elige un ambiente en el plano o en el modelo.';
  const u = state.input.module / 2;
  // «Desde la izquierda» se mide como se ve desde la calle (el eje x del modelo va al revés).
  const shown = r ? {x: +(state.input.width - r.x - r.w).toFixed(2), z: r.z, w: r.w, d: r.d} : {};
  for (const [k, id] of [['x', 'roomX'], ['z', 'roomZ'], ['w', 'roomW'], ['d', 'roomD']]) {
    const inp = $(id);
    inp.step = u;
    inp.min = k === 'w' || k === 'd' ? u : 0;
    if (force || document.activeElement !== inp) inp.value = r ? shown[k] : '';
  }
  $('roomLocked').checked = !!r?.locked;
  $('lockLabel').textContent = isHall(r) ? 'Fijar durante la edición' : 'Fijar al generar de nuevo';
  $('windowStyle').value = r?.windowStyle || 'default';
  for (const id of ['windowStyle', 'paintWalls', 'paintFloor', 'resetPaint']) $(id).disabled = !r;
}

function renderBill(state) {
  const dl = $('billSummary');
  dl.replaceChildren();
  if (!state.analysis) return;
  lastBill = bill(state.analysis);
  const s = lastBill.summary;
  for (const [k, v] of [['Muros exteriores', fmt(s.extLength) + ' m'], ['Muros interiores', fmt(s.intLength) + ' m'], ['Puertas', String(s.doors)], ['Ventanas', String(s.windows)], ['Superficie de pisos', fmt(s.floorArea) + ' m²']]) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k; dd.textContent = v; dl.append(dt, dd);
  }
}

function onChange(state) {
  current = state;
  if (['generar', 'abrir', 'deshacer', 'rehacer'].includes(state.reason)) writeProgram(state.input);
  else if (document.activeElement !== $('projectName')) $('projectName').value = state.input.name;
  if (viewer && state.analysis) viewer.update(state.input, state.analysis, state.selected);
  renderAlternatives(state);
  renderMetrics(state);
  renderInspector(state);
  renderBill(state);
  $('undo').disabled = !state.canUndo;
  $('redo').disabled = !state.canRedo;
}

studio = createStudio({svg: $('planSvg'), onChange, notify: toast});
writeProgram(DEMO_INPUT);
studio.generate({fields: DEMO_INPUT, seed: DEMO_SEED, keepLocked: false, record: false});

// ---------- programa ----------
$('programForm').addEventListener('submit', e => {
  e.preventDefault();
  try { studio.generate({fields: readProgram()}); toast('Tres alternativas nuevas listas.'); }
  catch (err) { toast(err.message, 'error'); }
});
document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
  const [id, delta] = b.dataset.step.split(':');
  const inp = $(id);
  inp.value = Math.min(+inp.max, Math.max(+inp.min, (+inp.value || 0) + +delta));
}));
$('resetDemo').addEventListener('click', () => {
  writeProgram(DEMO_INPUT);
  studio.generate({fields: DEMO_INPUT, seed: DEMO_SEED, keepLocked: false});
  toast('Ejemplo restaurado.');
});
$('projectName').addEventListener('change', e => {
  const v = e.target.value.trim();
  if (!v) { e.target.value = current.input.name; return; }
  studio.rename(v);
  document.title = v + ' · MODUL-AI';
});
$('projectName').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

// ---------- vistas ----------
const views = $('views'), stage = document.querySelector('.stage');
function setView(v) {
  views.dataset.view = v; stage.dataset.view = v;
  document.querySelectorAll('[data-view]').forEach(b => { if (b.tagName === 'BUTTON') b.setAttribute('aria-checked', String(b.dataset.view === v)); });
  store.set('view', v);
}
document.querySelectorAll('button[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
const narrow = window.matchMedia('(max-width: 900px)');
const initial = store.get('view') || 'split';
setView(narrow.matches && initial === 'split' ? 'plan' : initial);
narrow.addEventListener('change', e => { if (e.matches && views.dataset.view === 'split') setView('plan'); });
document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => {
  if (views.dataset.view === 'plan') setView(window.matchMedia('(max-width: 900px)').matches ? 'model' : 'split');
  if (window.matchMedia('(max-width: 900px)').matches && views.dataset.view === 'split') setView('model');
  viewer?.view(b.dataset.cam);
}));

// ---------- inspector ----------
for (const id of ['roomX', 'roomZ', 'roomW', 'roomD']) {
  $(id).addEventListener('change', () => {
    const left = Number($('roomX').value), z = Number($('roomZ').value), w = Number($('roomW').value), d = Number($('roomD').value);
    if (![left, z, w, d].every(Number.isFinite)) return renderInspector(current, true);
    const x = +(current.input.width - left - w).toFixed(4);
    if (!studio.updateRoom({x, z, w, d})) renderInspector(current, true);
  });
}
$('roomLocked').addEventListener('change', e => studio.setLocked(e.target.checked));
$('unlockAll').addEventListener('click', () => { studio.unlockAll(); toast('Todos los ambientes quedaron libres.'); });

$('windowStyle').addEventListener('change', e => studio.updateRoom({windowStyle: e.target.value}));
$('paintMode').addEventListener('change', e => viewer?.setOptions({paint: e.target.checked}));
$('paintMode').disabled = !viewer;
$('paintWalls').addEventListener('click', () => studio.paint(current.selected, 'wall', $('paintColor').value));
$('paintFloor').addEventListener('click', () => studio.paint(current.selected, 'floor', $('paintColor').value));
$('resetPaint').addEventListener('click', () => studio.updateRoom({wallColor: null, floorColor: null}));

// ---------- opciones 3D ----------
const opt = (id, key) => $(id).addEventListener('change', e => viewer?.setOptions({[key]: e.target.checked}));
opt('optFurniture', 'furniture'); opt('optRoof', 'roof'); opt('optCut', 'cut'); opt('optLabels', 'labels'); opt('optSpin', 'spin');
$('optExplode').addEventListener('input', e => {
  $('explodeOut').textContent = e.target.value + ' %';
  viewer?.setOptions({explode: e.target.value / 100});
});
$('optCut').addEventListener('change', e => { if (e.target.checked && $('optRoof').checked) { $('optRoof').checked = false; viewer?.setOptions({roof: false}); } });
$('optRoof').addEventListener('change', e => { if (e.target.checked && $('optCut').checked) { $('optCut').checked = false; viewer?.setOptions({cut: false}); } });

// ---------- historial ----------
$('undo').addEventListener('click', () => studio.undo());
$('redo').addEventListener('click', () => studio.redo());
document.addEventListener('keydown', e => {
  const typing = e.target.closest?.('input, textarea, [contenteditable]');
  if (typing || !(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); if (!studio.undo()) toast('No hay cambios para deshacer.'); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); if (!studio.redo()) toast('No hay cambios para rehacer.'); }
  else if (k === 's') { e.preventDefault(); save(); }
});

// ---------- exportar ----------
const menuBtn = $('exportBtn'), menu = $('exportMenu');
const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
menuBtn.addEventListener('click', e => {
  e.stopPropagation();
  const open = menu.hidden;
  menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('button')?.focus();
});
document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
menu.addEventListener('keydown', e => {
  const items = [...menu.querySelectorAll('button')], i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') { closeMenu(); menuBtn.focus(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
});
function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.append(a); a.click(); a.remove(); }
function downloadText(text, name, mime) { const u = URL.createObjectURL(new Blob([text], {type: mime})); download(u, name); setTimeout(() => URL.revokeObjectURL(u), 1500); }
const slug = () => (current.input.name || 'proyecto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'proyecto';
menu.addEventListener('click', e => {
  const kind = e.target.closest('[data-export]')?.dataset.export;
  if (!kind) return;
  closeMenu();
  if (kind === 'svg') downloadText(studio.svgMarkup(), `${slug()}-plano-${current.active}.svg`, 'image/svg+xml');
  if (kind === 'png') { if (!viewer) return toast('El modelo 3D no está disponible en este navegador.', 'error'); download(viewer.snapshot(), `${slug()}-3d-${current.active}.png`); }
  if (kind === 'json') downloadText(JSON.stringify(studio.project(), null, 2), `${slug()}.json`, 'application/json');
  if (kind === 'csv') {
    const rows = lastBill?.rows || [];
    const cols = ['id', 'categoria', 'ambientes', 'largo_m', 'alto_m', 'espesor_m', 'vanos', 'alfeizar_m'];
    const q = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
    downloadText('﻿' + cols.join(';') + '\n' + rows.map(r => cols.map(c => q(r[c])).join(';')).join('\n'), `${slug()}-despiece-${current.active}.csv`, 'text/csv;charset=utf-8');
  }
  toast('Descarga lista.', 'ok');
});

// ---------- cuenta ----------
const dlg = $('accountDialog');
let mode = 'login';
function setMode(m) {
  mode = m;
  $('tabLogin').setAttribute('aria-selected', String(m === 'login'));
  $('tabRegister').setAttribute('aria-selected', String(m === 'register'));
  $('accountSubmit').textContent = m === 'login' ? 'Entrar' : 'Crear cuenta';
  $('loginPassword').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('accountError').textContent = '';
}
$('tabLogin').addEventListener('click', () => setMode('login'));
$('tabRegister').addEventListener('click', () => setMode('register'));
function openAccount(lead) {
  $('accountLead').textContent = lead || 'Guarda tus proyectos y ábrelos desde cualquier equipo.';
  $('accountError').textContent = '';
  dlg.showModal();
  $('loginEmail').focus();
}
dlg.addEventListener('close', () => { if (!user) pendingSave = false; });
function showUser(u) {
  user = u;
  const b = $('accountBtn');
  b.replaceChildren();
  if (u) {
    const av = document.createElement('span'); av.className = 'avatar'; av.textContent = u.email[0].toUpperCase();
    const em = document.createElement('span'); em.textContent = u.email.split('@')[0];
    b.append(av, em);
    b.setAttribute('aria-label', 'Cuenta de ' + u.email);
  } else { b.textContent = 'Entrar'; b.removeAttribute('aria-label'); }
  $('accountMenuEmail').textContent = u ? u.email : '';
}
$('accountForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('loginEmail').value.trim(), password = $('loginPassword').value;
  if (!email || !password) { $('accountError').textContent = 'Escribe tu correo y tu contraseña.'; return; }
  if (mode === 'register' && password.length < 8) { $('accountError').textContent = 'La contraseña necesita al menos 8 caracteres.'; return; }
  const btn = $('accountSubmit'); btn.disabled = true;
  try {
    const u = mode === 'login' ? await api.login(email, password) : await api.register(email, password);
    $('loginPassword').value = '';
    if (!u) {
      setMode('login');
      $('accountError').textContent = 'Revisa tu correo para confirmar la cuenta y luego entra aquí. Si ya tenías cuenta, usa tu contraseña.';
      return;
    }
    showUser(u);
    dlg.close();
    toast(mode === 'login' ? 'Sesión iniciada.' : 'Cuenta creada. Ya puedes guardar.', 'ok');
    if (pendingSave) { pendingSave = false; save(); }
  } catch (err) { $('accountError').textContent = err.message; }
  finally { btn.disabled = false; }
});
const accountMenu = $('accountMenu');
$('accountBtn').addEventListener('click', e => {
  e.stopPropagation();
  if (!user) return openAccount();
  accountMenu.hidden = !accountMenu.hidden;
});
document.addEventListener('click', e => { if (!accountMenu.hidden && !accountMenu.contains(e.target)) accountMenu.hidden = true; });
$('logoutBtn').addEventListener('click', async () => {
  try { await api.logout(); showUser(null); accountMenu.hidden = true; toast('Sesión cerrada.'); }
  catch (err) { toast(err.message, 'error'); }
});
api.me().then(showUser).catch(() => showUser(null));

// ---------- guardar y proyectos ----------
async function save() {
  if (!user) { pendingSave = true; openAccount(`Entra o crea una cuenta para guardar «${current.input.name}».`); return; }
  const btn = $('saveProject'); btn.disabled = true;
  try { const p = await api.saveProject(studio.project()); toast(`Guardado «${p.name}».`, 'ok'); }
  catch (err) {
    if (/sesión/i.test(err.message)) { showUser(null); pendingSave = true; openAccount('Tu sesión venció. Entra de nuevo para guardar.'); }
    else toast(err.message, 'error');
  } finally { btn.disabled = false; }
}
$('saveProject').addEventListener('click', save);

const pdlg = $('projectsDialog');
async function renderProjects() {
  const list = $('projectsList');
  list.replaceChildren();
  $('projectsWho').textContent = user ? 'Cuenta: ' + user.email : '';
  if (!user) {
    const e = document.createElement('div'); e.className = 'empty';
    const p = document.createElement('p'); p.textContent = 'Entra a tu cuenta para ver tus proyectos guardados.';
    const b = document.createElement('button'); b.className = 'btn btn-primary'; b.textContent = 'Entrar';
    b.addEventListener('click', () => { pdlg.close(); openAccount(); });
    e.append(p, b); list.append(e); return;
  }
  const loading = document.createElement('p'); loading.className = 'note'; loading.textContent = 'Cargando…'; list.append(loading);
  try {
    const items = await api.listProjects();
    list.replaceChildren();
    if (!items.length) {
      const e = document.createElement('div'); e.className = 'empty';
      e.textContent = 'Aún no guardas proyectos. Usa «Guardar» para crear el primero.';
      list.append(e); return;
    }
    for (const it of items) {
      const row = document.createElement('div'); row.className = 'project';
      const info = document.createElement('div');
      const b = document.createElement('b'); b.textContent = it.name;
      const s = document.createElement('small');
      s.textContent = `Alternativa ${it.selected}, ${fmt(it.area_m2 || 0)} m², ${new Date(it.created_at).toLocaleString('es-PE', {dateStyle: 'medium', timeStyle: 'short'})}`;
      info.append(b, s);
      const actions = document.createElement('div'); actions.className = 'actions';
      const open = document.createElement('button'); open.className = 'btn'; open.textContent = 'Abrir';
      open.addEventListener('click', async () => {
        try { const p = await api.getProject(it.id); studio.load(p.data); pdlg.close(); toast(`Abierto «${it.name}».`, 'ok'); }
        catch (err) { toast(err.message, 'error'); }
      });
      const del = document.createElement('button'); del.className = 'btn btn-danger'; del.textContent = 'Borrar';
      del.addEventListener('click', async () => {
        if (!del.classList.contains('is-armed')) {
          del.classList.add('is-armed'); del.textContent = 'Confirmar';
          setTimeout(() => { del.classList.remove('is-armed'); del.textContent = 'Borrar'; }, 3500);
          return;
        }
        try { await api.deleteProject(it.id); row.remove(); toast('Proyecto borrado.'); if (!list.children.length) renderProjects(); }
        catch (err) { toast(err.message, 'error'); }
      });
      actions.append(open, del);
      row.append(info, actions);
      list.append(row);
    }
  } catch (err) { list.replaceChildren(); const e = document.createElement('div'); e.className = 'empty'; e.textContent = err.message; list.append(e); }
}
$('openProjects').addEventListener('click', () => { pdlg.showModal(); renderProjects(); });
$('importFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try { studio.load(JSON.parse(await file.text())); pdlg.close(); toast(`Abierto «${file.name}».`, 'ok'); }
  catch (err) { toast('No se pudo abrir el archivo: ' + err.message, 'error'); }
});


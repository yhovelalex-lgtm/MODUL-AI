// MODUL-AI | Visor 3D estilo maqueta: muros con vanos, pisos con acabados, techo,
// mobiliario de referencia, terreno y calle. Recibe el análisis de modul-plan.mjs.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CSS2DRenderer, CSS2DObject} from 'three/addons/renderers/CSS2DRenderer.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {WALL, wallPieces, thicknessOf} from './modul-plan.mjs';
import {isHall} from './modul-core.mjs';

const C = {
  table: 0xE3E8ED, lot: 0xD2DBCB, reserve: 0xE4EADD, street: 0xAFB6BF, sidewalk: 0xD6DBE0, lane: 0xF4F4F0,
  wall: 0xF7F6F2, edge: 0x8C96A1, plinth: 0xC7CCD1, roof: 0xECEEF0, glass: 0x9FC3DA, frame: 0x55606B,
  door: 0xD2B48C, entry: 0x5E4B3C, white: 0xF5F4F0, wood: 0xC9A97F, fabric: 0x8EA1B5, sofa: 0xB6AEA1,
  dark: 0x394048, steel: 0xC7CDD3, top: 0x5D646C, plant: 0x87A57F, trunk: 0x8A7966, rug: 0xD8CEBF, signal: 0xF2B705
};
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function canvasTexture(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const TEX = {
  wood: () => canvasTexture((g, s) => {
    g.fillStyle = '#D9BF98'; g.fillRect(0, 0, s, s);
    const plank = s / 8;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `hsl(35, ${32 + (i * 7) % 9}%, ${73 + ((i * 5) % 7) - 3}%)`;
      g.fillRect(0, i * plank + 1, s, plank - 2);
      g.fillStyle = 'rgba(120,90,55,.35)';
      g.fillRect(((i * 97) % s), i * plank, 2, plank);
    }
  }),
  tile: () => canvasTexture((g, s) => {
    g.fillStyle = '#E8EBED'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#C9CFD5'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4, s); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke(); }
  }),
  stone: () => canvasTexture((g, s) => {
    g.fillStyle = '#E1E0DB'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#CCCAC3'; g.lineWidth = 2;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * s / 2, 0); g.lineTo(i * s / 2, s); g.moveTo(0, i * s / 2); g.lineTo(s, i * s / 2); g.stroke(); }
  })
};
const FLOOR_OF = {social: ['wood', 1.6], bedroom: ['wood', 1.6], other: ['wood', 1.6], kitchen: ['tile', 1.2], bath: ['tile', 1.2], hall: ['stone', 1.6]};

export function createViewer(container, {onSelect, onPaint} = {}) {
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels3d';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.table);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 800);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.screenSpacePanning = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd6dd, 0.85));
  const sun = new THREE.DirectionalLight(0xfff3e2, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const M = {
    wall: new THREE.MeshStandardMaterial({color: C.wall, roughness: 0.92}),
    edge: new THREE.LineBasicMaterial({color: C.edge, transparent: true, opacity: 0.5}),
    plinth: new THREE.MeshStandardMaterial({color: C.plinth, roughness: 0.95}),
    roof: new THREE.MeshStandardMaterial({color: C.roof, roughness: 0.9}),
    glass: new THREE.MeshStandardMaterial({color: C.glass, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false}),
    frame: new THREE.MeshStandardMaterial({color: C.frame, roughness: 0.6}),
    door: new THREE.MeshStandardMaterial({color: C.door, roughness: 0.7}),
    entry: new THREE.MeshStandardMaterial({color: C.entry, roughness: 0.6}),
    white: new THREE.MeshStandardMaterial({color: C.white, roughness: 0.8}),
    wood: new THREE.MeshStandardMaterial({color: C.wood, roughness: 0.7}),
    fabric: new THREE.MeshStandardMaterial({color: C.fabric, roughness: 0.95}),
    sofa: new THREE.MeshStandardMaterial({color: C.sofa, roughness: 0.95}),
    dark: new THREE.MeshStandardMaterial({color: C.dark, roughness: 0.4}),
    steel: new THREE.MeshStandardMaterial({color: C.steel, roughness: 0.35, metalness: 0.5}),
    top: new THREE.MeshStandardMaterial({color: C.top, roughness: 0.5}),
    plant: new THREE.MeshStandardMaterial({color: C.plant, roughness: 0.9, flatShading: true}),
    trunk: new THREE.MeshStandardMaterial({color: C.trunk, roughness: 0.9}),
    rug: new THREE.MeshStandardMaterial({color: C.rug, roughness: 1}),
    signal: new THREE.MeshBasicMaterial({color: C.signal})
  };
  const baseTex = {wood: TEX.wood(), tile: TEX.tile(), stone: TEX.stone()};

  const terrain = new THREE.Group(), house = new THREE.Group();
  scene.add(terrain, house);
  let state = {input: null, analysis: null, selected: null};
  let opts = {paint: false, roof: false, cut: false, furniture: true, labels: true, explode: 0, spin: false};
  let parts = [], floors = new Map(), tags = new Map(), pickables = [], selectionFrame = null;
  let wallMaterials = [];
  let plotKey = '', houseKey = '', needsRender = true, tween = null, firstView = true;

  // ---------- utilidades de geometría ----------
  const disposeTree = obj => obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.userData.ownMaterial) { const mats = [].concat(o.material); mats.forEach(m => { m.map?.dispose(); m.dispose(); }); }
  });
  function box(parent, w, h, d, mat, x, y, z, {cap = Infinity, rotY = 0, shadow = true, edges = false} = {}) {
    if (y + h > cap) h = cap - y;
    if (h <= 0.005 || w <= 0 || d <= 0) return null;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    if (edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), M.edge));
    parent.add(mesh);
    return mesh;
  }

  // ---------- terreno ----------
  function buildTerrain(input) {
    disposeTree(terrain); terrain.clear();
    const W = input.width, D = input.depth;
    const table = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({color: C.table, roughness: 1}));
    table.userData.ownMaterial = true;
    table.rotation.x = -Math.PI / 2; table.position.set(W / 2, -0.06, D / 2); table.receiveShadow = true;
    terrain.add(table);
    const lot = box(terrain, W, 0.06, D, new THREE.MeshStandardMaterial({color: C.lot, roughness: 1}), W / 2, -0.06, D / 2, {shadow: false});
    lot.userData.ownMaterial = true;
    const res = new THREE.Mesh(new THREE.PlaneGeometry(W, input.module), new THREE.MeshStandardMaterial({color: C.reserve, roughness: 1}));
    res.userData.ownMaterial = true;
    res.rotation.x = -Math.PI / 2; res.position.set(W / 2, 0.002, D - input.module / 2); res.receiveShadow = true;
    terrain.add(res);
    const dash = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(W - 0.1, input.module - 0.1)), new THREE.LineDashedMaterial({color: 0x7D8A79, dashSize: 0.3, gapSize: 0.2}));
    dash.userData.ownMaterial = true;
    dash.rotation.x = -Math.PI / 2; dash.position.copy(res.position).setY(0.006); dash.computeLineDistances();
    terrain.add(dash);
    const side = box(terrain, W + 30, 0.12, 1.6, M.plinth, W / 2, -0.06, -0.8, {shadow: false});
    side.material = new THREE.MeshStandardMaterial({color: C.sidewalk, roughness: 1}); side.userData.ownMaterial = true;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, 7.5), new THREE.MeshStandardMaterial({color: C.street, roughness: 1}));
    road.userData.ownMaterial = true;
    road.rotation.x = -Math.PI / 2; road.position.set(W / 2, -0.04, -1.6 - 3.75); road.receiveShadow = true;
    terrain.add(road);
    for (let x = -14; x < W + 14; x += 3) box(terrain, 1.5, 0.01, 0.14, new THREE.MeshBasicMaterial({color: C.lane}), x, -0.035, -5.35, {shadow: false}).userData.ownMaterial = true;
    const trees = [[1.1, D - input.module / 2], [W - 1.1, D - input.module / 2]];
    if (W > 14) trees.push([W / 2, D - input.module / 2]);
    for (const [x, z] of trees) {
      const t = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 8), M.trunk); trunk.position.y = 0.65; trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), M.plant); crown.position.y = 1.75; crown.castShadow = true; crown.scale.set(1, 1.15, 1);
      t.add(trunk, crown); t.position.set(x, 0, z); terrain.add(t);
    }
    const R = Math.max(W, D) / 2 + 4;
    sun.position.set(W / 2 - R * 0.9, R * 1.9, D / 2 - R * 1.25);
    sun.target.position.set(W / 2, 0, D / 2);
    Object.assign(sun.shadow.camera, {left: -R * 1.4, right: R * 1.4, top: R * 1.4, bottom: -R * 1.4, near: 1, far: R * 6});
    sun.shadow.camera.updateProjectionMatrix();
    scene.fog = new THREE.Fog(C.table, R * 5, R * 11);
    controls.maxDistance = R * 7;
    controls.minDistance = 3;
  }

  // ---------- mobiliario ----------
  const opposite = {N: 'S', S: 'N', W: 'E', E: 'W'};
  function frameFor(room) {
    const back = room.door ? opposite[room.door.side] : 'S';
    const cx = room.x + room.w / 2, cz = room.z + room.d / 2, pos = room.door?.pos;
    switch (back) {
      case 'N': return {rot: 0, at: [cx, room.z], W: room.w, D: room.d, lx: pos == null ? 0 : pos - cx};
      case 'S': return {rot: Math.PI, at: [cx, room.z + room.d], W: room.w, D: room.d, lx: pos == null ? 0 : cx - pos};
      case 'W': return {rot: Math.PI / 2, at: [room.x, cz], W: room.d, D: room.w, lx: pos == null ? 0 : cz - pos};
      default: return {rot: -Math.PI / 2, at: [room.x + room.w, cz], W: room.d, D: room.w, lx: pos == null ? 0 : pos - cz};
    }
  }
  function furnish(room, H) {
    const f = frameFor(room), g = new THREE.Group(), cap = opts.cut ? H - 0.02 : Infinity;
    g.position.set(f.at[0], WALL.plinth, f.at[1]);
    g.rotation.y = f.rot;
    const W = f.W, D = f.D, far = f.lx > 0 ? -1 : 1;
    const b = (w, h, d, m, x, y, z, o = {}) => box(g, w, h, d, m, x, y, z, {cap, ...o});
    const plant = (x, z) => {
      b(0.34, 0.36, 0.34, M.white, x, 0, z);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), M.plant);
      crown.position.set(x, 0.72, z); crown.castShadow = true;
      if (0.72 + 0.3 < cap) g.add(crown);
    };
    if (room.type === 'bedroom') {
      const principal = room.id === 'D01';
      const bw = principal && W >= 2.7 ? 1.6 : W >= 1.6 ? 1.0 : 0;
      if (!bw) return g;
      const bl = D >= 2.7 ? 2.0 : Math.max(1.5, D - 0.6);
      const bx = principal ? 0 : Math.max(-W / 2 + bw / 2 + 0.15, Math.min(W / 2 - bw / 2 - 0.15, -far * 0.25));
      b(bw + 0.06, 0.28, bl + 0.04, M.wood, bx, 0, bl / 2 + 0.05);
      b(bw - 0.04, 0.2, bl - 0.06, M.white, bx, 0.28, bl / 2 + 0.06);
      b(bw + 0.02, 0.07, bl * 0.6, M.fabric, bx, 0.46, bl - bl * 0.3 + 0.06);
      const pillows = bw > 1.2 ? [-bw / 4, bw / 4] : [0];
      for (const px of pillows) b(bw > 1.2 ? 0.6 : 0.7, 0.11, 0.34, M.white, bx + px, 0.48, 0.3);
      b(bw + 0.12, 1.0, 0.07, M.wood, bx, 0, 0.035);
      for (const s of [-1, 1]) {
        const nx = bx + s * (bw / 2 + 0.3);
        if (Math.abs(nx) + 0.24 < W / 2 - 0.02) { b(0.44, 0.48, 0.4, M.wood, nx, 0, 0.25); b(0.16, 0.22, 0.16, M.white, nx, 0.48, 0.25); }
      }
      const wl = Math.min(1.8, D - bl - 0.4);
      const inner = W / 2 - 0.62;
      if (wl >= 0.9 && inner > Math.abs(bx) + bw / 2 - 0.4) b(0.6, 2.1, wl, M.white, far * (W / 2 - 0.31), 0, D - 0.06 - wl / 2);
      else if (W - bw > 1.4 && D > 2.4) b(Math.min(1.6, W / 2 - bw / 2 - 0.2), 2.1, 0.6, M.white, far * (W / 2 - Math.min(1.6, W / 2 - bw / 2 - 0.2) / 2 - 0.02), 0, D - 0.32);
    } else if (room.id === 'SAL' || (room.type === 'social' && room.id !== 'COM')) {
      const sl = Math.max(1.4, Math.min(2.4, W - 0.8));
      b(sl, 0.42, 0.9, M.sofa, 0, 0, 0.5);
      b(sl, 0.42, 0.22, M.sofa, 0, 0.42, 0.16);
      for (const s of [-1, 1]) b(0.2, 0.62, 0.9, M.sofa, s * (sl / 2 - 0.1), 0, 0.5);
      if (D > 2.4) {
        const rd = Math.min(2.0, D - 1.3);
        b(Math.min(2.8, W - 0.6), 0.012, rd, M.rug, 0, 0, 0.95 + rd / 2 - 0.15, {shadow: false});
        b(1.1, 0.36, 0.6, M.wood, 0, 0, 1.0 + Math.min(0.8, rd / 2));
      }
      if (D >= 3.2 && W >= 2.4) {
        const tx = far * Math.min(W / 4, W / 2 - 0.85);
        b(1.6, 0.45, 0.4, M.wood, tx, 0, D - 0.24);
        b(1.25, 0.72, 0.05, M.dark, tx, 0.62, D - 0.1);
      }
      plant(far * (W / 2 - 0.32), 0.3);
    } else if (room.id === 'COM') {
      const alongX = W >= D;
      const L = Math.min(1.8, Math.max(W, D) - 1.4), T = 0.9;
      if (L >= 0.9 && Math.min(W, D) >= 1.9) {
        const [lx, lz] = alongX ? [L, T] : [T, L];
        const cz = D / 2;
        b(lx, 0.05, lz, M.wood, 0, 0.7, cz);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(0.05, 0.7, 0.05, M.wood, sx * (lx / 2 - 0.08), 0, cz + sz * (lz / 2 - 0.08));
        const per = L >= 1.6 ? 3 : 2;
        for (let k = 0; k < per; k++) for (const s of [-1, 1]) {
          const t = (k + 0.5) / per * L - L / 2;
          const [x, z] = alongX ? [t, cz + s * (T / 2 + 0.28)] : [s * (T / 2 + 0.28), cz + t];
          const rot = alongX ? 0 : Math.PI / 2;
          const chair = new THREE.Group(); chair.position.set(x, 0, z); chair.rotation.y = rot; g.add(chair);
          box(chair, 0.44, 0.05, 0.44, M.white, 0, 0.43, 0, {cap});
          box(chair, 0.44, 0.45, 0.05, M.white, 0, 0.48, s * 0.2, {cap});
          for (const lx2 of [-0.18, 0.18]) for (const lz2 of [-0.18, 0.18]) box(chair, 0.03, 0.43, 0.03, M.white, lx2, 0, lz2, {cap, shadow: false});
        }
      }
      plant(far * (W / 2 - 0.32), 0.3);
    } else if (room.type === 'kitchen') {
      const fx = far * (W / 2 - 0.38);
      const cl = W - 0.82, cx = far > 0 ? -W / 2 + cl / 2 + 0.02 : W / 2 - cl / 2 - 0.02;
      if (cl > 0.6) {
        b(cl, 0.86, 0.6, M.white, cx, 0, 0.32);
        b(cl + 0.02, 0.04, 0.63, M.top, cx, 0.86, 0.32);
        b(0.55, 0.012, 0.4, M.steel, cx - cl / 4, 0.9, 0.32);
        b(0.6, 0.012, 0.5, M.dark, cx + cl / 4, 0.9, 0.32);
        b(cl, 0.7, 0.35, M.white, cx, 1.45, 0.18);
      }
      b(0.72, 1.85, 0.68, M.steel, fx, 0, 0.36);
      if (D >= 2.6) {
        const sl = Math.min(1.6, D - 1.6), sx = -far * (W / 2 - 0.32);
        if (sl > 0.6) { b(0.6, 0.86, sl, M.white, sx, 0, 0.64 + sl / 2); b(0.63, 0.04, sl, M.top, sx, 0.86, 0.64 + sl / 2); }
      }
    } else if (room.type === 'bath') {
      if (D >= 2.2 && W >= 1.1) {
        b(W - 0.08, 0.06, 0.9, M.white, 0, 0, 0.5);
        b(W * 0.55, 1.95, 0.02, M.glass, -far * W * 0.2, 0.06, 0.96, {shadow: false});
        const tz = 0.95 + Math.min(0.75, (D - 0.95) / 2);
        b(0.55, 0.4, 0.38, M.white, far * (W / 2 - 0.32), 0, tz);
        b(0.18, 0.4, 0.4, M.white, far * (W / 2 - 0.1), 0.38, tz);
        if (W >= 1.35) {
          const vz = Math.min(D - 0.45, tz + 0.75);
          b(0.46, 0.8, 0.7, M.wood, -far * (W / 2 - 0.24), 0, vz);
          b(0.42, 0.1, 0.5, M.white, -far * (W / 2 - 0.25), 0.8, vz);
          b(0.02, 0.7, 0.6, M.glass, -far * (W / 2 - 0.02), 1.15, vz, {shadow: false});
        }
      } else {
        b(0.38, 0.4, 0.55, M.white, -W / 4, 0, 0.32);
        b(0.6, 0.8, 0.45, M.wood, W / 4, 0, 0.26);
      }
    } else if (!isHall(room)) {
      b(Math.min(1.4, W - 0.4), 0.74, 0.6, M.wood, 0, 0, 0.32);
      b(0.46, 0.46, 0.46, M.white, 0, 0, 0.95);
      b(0.35, 1.8, Math.min(1.6, D - 0.6), M.white, far * (W / 2 - 0.18), 0, D / 2);
    }
    return g;
  }

  // ---------- puertas y ventanas ----------
  function addOpeningDetails(group, run, o, H) {
    const t = thicknessOf(run), alongX = run.dir === 'h';
    const place = (mesh, along, y, off = 0) => {
      if (alongX) mesh.position.set(along, y, run.c + off); else mesh.position.set(run.c + off, y, along);
      group.add(mesh);
    };
    const y0 = WALL.plinth;
    if (o.type === 'window') {
      const top = Math.min(o.head, H), h = top - o.sill;
      if (h <= 0.02) return;
      const geo = alongX ? [o.width, h, 0.03] : [0.03, h, o.width];
      place(new THREE.Mesh(new THREE.BoxGeometry(...geo), M.glass), o.center, y0 + o.sill + h / 2);
      const fr = (w, hh, along, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(...(alongX ? [w, hh, t * 0.55] : [t * 0.55, hh, w])), M.frame); m.castShadow = true; place(m, along, y); };
      fr(o.width, 0.05, o.center, y0 + o.sill + 0.025);
      if (o.head <= H) fr(o.width, 0.05, o.center, y0 + top - 0.025);
      fr(0.05, h, o.center - o.width / 2 + 0.025, y0 + o.sill + h / 2);
      fr(0.05, h, o.center + o.width / 2 - 0.025, y0 + o.sill + h / 2);
      if (o.width > 1.3) fr(0.04, h, o.center, y0 + o.sill + h / 2);
      const style = state.analysis.rooms[o.room]?.windowStyle || 'default';
      if (style !== 'default') {
        // Marco local: x a lo largo del vano; z apunta siempre al exterior.
        const screen = new THREE.Group(), outside = run.A < 0 ? -1 : 1;
        place(screen, o.center, y0 + o.sill, outside * (t / 2 + 0.07));
        if (alongX) screen.rotation.y = outside > 0 ? 0 : Math.PI;
        else screen.rotation.y = outside > 0 ? Math.PI / 2 : -Math.PI / 2;
        const panel = (height, bottom, angle = 0, offset = 0) => {
          const g = new THREE.Group(); screen.add(g); g.position.set(0, bottom, offset); g.rotation.x = angle;
          const w = o.width, rail = 0.045;
          for (const x of [-w / 2 + rail / 2, w / 2 - rail / 2]) box(g, rail, height, 0.05, M.wood, x, 0, 0);
          for (const y of [0, height - rail]) box(g, w, rail, 0.05, M.wood, 0, y, 0);
          const nx = Math.max(2, Math.ceil(w / 0.09)), ny = Math.max(2, Math.ceil(height / 0.09));
          for (let i = 1; i < nx; i++) box(g, 0.016, height - rail * 2, 0.022, M.wood, -w / 2 + i * w / nx, rail, 0);
          for (let j = 1; j < ny; j++) box(g, w - rail * 2, 0.016, 0.022, M.wood, 0, j * height / ny, 0.012);
        };
        // En corte se muestra la porción inferior plana, sin piezas sobre el corte.
        if (style === 'lattice' || opts.cut) panel(h, 0);
        else {
          const angle = Math.PI / 5, half = h / (2 * Math.cos(angle));
          panel(half, 0, angle);
          panel(half, h / 2, -angle, half * Math.sin(angle));
        }
      }
    } else if (o.type === 'door' || o.type === 'entry') {
      const h = Math.min(o.head, H) - 0.02, w = o.width - 0.04;
      if (h <= 0.05) return;
      const pivot = new THREE.Group();
      place(pivot, o.hinge, y0);
      const dir = o.center > o.hinge ? 1 : -1;
      const local = alongX ? o.into : -o.into;
      if (!alongX) pivot.rotation.y = -Math.PI / 2;
      const swing = new THREE.Group();
      swing.rotation.y = -local * dir * (o.type === 'entry' ? 0.45 : 1.15);
      pivot.add(swing);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), o.type === 'entry' ? M.entry : M.door);
      leaf.position.set(dir * w / 2, h / 2, 0);
      leaf.castShadow = true;
      swing.add(leaf);
      if (o.type === 'entry' && !opts.cut) {
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(...(alongX ? [o.width + 0.8, 0.08, 0.9] : [0.9, 0.08, o.width + 0.8])), M.roof);
        canopy.castShadow = true;
        place(canopy, o.center, y0 + o.head + 0.25, -(o.into || 1) * 0.45);
      }
    }
  }

  // ---------- casa ----------
  function buildHouse() {
    disposeTree(house); house.clear();
    wallMaterials.forEach(m => m.dispose()); wallMaterials = [];
    for (const f of floors.values()) { f.top.dispose(); f.tex.dispose(); }
    parts = []; floors = new Map(); tags = new Map(); pickables = []; selectionFrame = null;
    const {analysis} = state;
    if (!analysis) return;
    const H = opts.cut ? WALL.cut : WALL.height, y0 = WALL.plinth;
    const bb = analysis.bbox, cx = bb.x + bb.w / 2, cz = bb.z + bb.d / 2;
    const tag = (g, layer, dir) => { parts.push({obj: g, base: g.position.clone(), dir, layer}); };

    for (const r of analysis.rooms) {
      const [kind, scale] = FLOOR_OF[r.type] || FLOOR_OF.other;
      const tex = baseTex[kind].clone(); tex.needsUpdate = true; tex.repeat.set(r.w / scale, r.d / scale);
      const top = new THREE.MeshStandardMaterial({color: r.floorColor || '#ffffff', map: r.floorColor ? null : tex, roughness: kind === 'tile' ? 0.45 : 0.75, emissive: C.signal, emissiveIntensity: 0});
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(r.w, y0, r.d), [M.plinth, M.plinth, top, M.plinth, M.plinth, M.plinth]);
      mesh.userData = {roomId: r.id, surface: 'floor', ownMaterial: false};
      top.userData = {};
      mesh.position.set(r.x + r.w / 2, y0 / 2, r.z + r.d / 2);
      mesh.receiveShadow = true;
      house.add(mesh);
      floors.set(r.id, {mesh, top, tex});
      pickables.push(mesh);
      tag(mesh, 'floor', new THREE.Vector3());
    }

    for (const run of analysis.runs) {
      const g = new THREE.Group(), t = thicknessOf(run), alongX = run.dir === 'h';
      const roomA = analysis.rooms[run.A], roomB = analysis.rooms[run.B];
      const materialFor = r => {
        if (!r?.wallColor) return M.wall;
        const material = M.wall.clone(); material.color.set(r.wallColor); wallMaterials.push(material); return material;
      };
      const matA = materialFor(roomA || roomB), matB = materialFor(roomB || roomA);
      // BoxGeometry: +x,-x,+y,-y,+z,-z. Cada cara compartida pertenece a su ambiente.
      const materials = alongX ? [M.wall, M.wall, M.wall, M.wall, matB, matA] : [matB, matA, M.wall, M.wall, M.wall, M.wall];
      for (const p of wallPieces(run, H)) {
        const len = p.to - p.from, h = p.y1 - p.y0, mid = (p.from + p.to) / 2;
        const lowered = alongX ? 0 : 0.002;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...(alongX ? [len, h - lowered, t] : [t, h - lowered, len])), materials);
        if (alongX) mesh.position.set(mid, y0 + p.y0 + (h - lowered) / 2, run.c); else mesh.position.set(run.c, y0 + p.y0 + (h - lowered) / 2, mid);
        mesh.userData = {surface: 'wall', roomId: (roomA || roomB)?.id,
          faceRooms: alongX ? {4: (roomB || roomA)?.id, 5: (roomA || roomB)?.id} : {0: (roomB || roomA)?.id, 1: (roomA || roomB)?.id}};
        pickables.push(mesh);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), M.edge));
        g.add(mesh);
      }
      for (const o of run.openings) addOpeningDetails(g, run, o, H);
      const mx = alongX ? (run.a + run.b) / 2 : run.c, mz = alongX ? run.c : (run.a + run.b) / 2;
      const out = new THREE.Vector3(mx - cx, 0, mz - cz);
      if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
      out.normalize().multiplyScalar(run.kind === 'ext' ? 2.4 : 1.1).setY(run.kind === 'ext' ? 0.4 : 1.4);
      house.add(g);
      tag(g, 'wall', out);
    }

    if (opts.roof && !opts.cut) {
      const roof = new THREE.Group();
      for (const r of analysis.rooms) {
        const m = box(roof, r.w, 0.18, r.d, M.roof, r.x + r.w / 2, y0 + H, r.z + r.d / 2);
        m.userData.roomId = isHall(r) ? null : r.id;
        if (!isHall(r)) pickables.push(m);
      }
      for (const run of analysis.runs.filter(r => r.kind === 'ext')) {
        const t = thicknessOf(run), len = run.b - run.a + t;
        if (run.dir === 'h') box(roof, len, 0.42, t, M.roof, (run.a + run.b) / 2, y0 + H + 0.18, run.c, {edges: true});
        else box(roof, t, 0.42, len, M.roof, run.c, y0 + H + 0.18, (run.a + run.b) / 2, {edges: true});
      }
      house.add(roof);
      tag(roof, 'roof', new THREE.Vector3(0, 4.5, 0));
    }

    if (opts.furniture) {
      for (const r of analysis.rooms) {
        if (isHall(r)) continue;
        const g = furnish(r, H);
        g.traverse(o => { if (o.isMesh) { o.userData.roomId = r.id; pickables.push(o); } });
        house.add(g);
        tag(g, 'furniture', new THREE.Vector3(0, 1.3, 0));
      }
    }

    for (const r of analysis.rooms) {
      if (isHall(r)) continue;
      const el = document.createElement('div');
      el.className = 'tag3d';
      const name = document.createElement('b'); name.textContent = r.name;
      const area = document.createElement('span'); area.textContent = fmt(r.w * r.d) + ' m²';
      el.append(name, area);
      const obj = new CSS2DObject(el);
      obj.position.set(r.x + r.w / 2, y0 + (opts.cut ? H + 0.35 : opts.roof ? H + 0.9 : H + 0.45), r.z + r.d / 2);
      house.add(obj);
      tags.set(r.id, obj);
    }
    applySelection();
    applyExplode();
    applyLabels();
    needsRender = true;
  }
  const fmt = n => n.toLocaleString('es-PE', {maximumFractionDigits: 1});

  function applySelection() {
    if (selectionFrame) { disposeTree(selectionFrame); house.remove(selectionFrame); selectionFrame = null; }
    for (const [id, f] of floors) f.top.emissiveIntensity = id === state.selected ? 0.22 : 0;
    for (const [id, t] of tags) t.element.classList.toggle('is-selected', id === state.selected);
    const r = state.analysis?.rooms.find(x => x.id === state.selected);
    if (r) {
      selectionFrame = new THREE.Group();
      const y = WALL.plinth + 0.012, k = 0.07;
      box(selectionFrame, r.w, 0.01, k, M.signal, r.x + r.w / 2, y, r.z + k / 2, {shadow: false});
      box(selectionFrame, r.w, 0.01, k, M.signal, r.x + r.w / 2, y, r.z + r.d - k / 2, {shadow: false});
      box(selectionFrame, k, 0.01, r.d, M.signal, r.x + k / 2, y, r.z + r.d / 2, {shadow: false});
      box(selectionFrame, k, 0.01, r.d, M.signal, r.x + r.w - k / 2, y, r.z + r.d / 2, {shadow: false});
      selectionFrame.position.y = 0;
      house.add(selectionFrame);
      selectionFrame.visible = opts.explode < 0.05;
    }
    needsRender = true;
  }
  function applyExplode() {
    for (const p of parts) p.obj.position.copy(p.base).addScaledVector(p.dir, opts.explode);
    if (selectionFrame) selectionFrame.visible = opts.explode < 0.05;
    applyLabels();
    needsRender = true;
  }
  function applyLabels() {
    for (const t of tags.values()) t.visible = opts.labels && opts.explode < 0.25;
    needsRender = true;
  }

  // ---------- cámara ----------
  function presetPose(name) {
    const input = state.input; if (!input) return null;
    const bb = state.analysis?.bbox || {x: 0, z: 0, w: input.width, d: input.depth};
    const target = new THREE.Vector3(bb.x + bb.w / 2, 0.9, bb.z + bb.d / 2);
    const radius = Math.hypot(bb.w, bb.d, opts.roof ? 3.4 : 2.8) / 2 + 0.8;
    const vfov = THREE.MathUtils.degToRad(camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * (camera.aspect || 1.5));
    const dist = radius / Math.sin(Math.min(vfov, hfov) / 2) * 0.86;
    const dirs = {iso: new THREE.Vector3(-0.62, 1.12, -0.95), top: new THREE.Vector3(-0.0001, 1, -0.02), front: new THREE.Vector3(-0.12, 0.16, -1)};
    const dir = (dirs[name] || dirs.iso).clone().normalize();
    const t = name === 'front' ? target.clone().setY(1.3) : target;
    // Ajuste fino: proyecta las esquinas de la casa y corrige la distancia para que quepa con margen.
    const probe = camera.clone(), top = (opts.roof ? 3.4 : WALL.height + WALL.plinth);
    const corners = [];
    for (const x of [bb.x, bb.x + bb.w]) for (const z of [bb.z, bb.z + bb.d]) for (const y of [0, top]) corners.push(new THREE.Vector3(x, y, z));
    let d = dist;
    for (let i = 0; i < 4; i++) {
      probe.position.copy(t).addScaledVector(dir, d); probe.lookAt(t); probe.updateMatrixWorld(); probe.updateProjectionMatrix();
      let m = 0;
      for (const c of corners) { const p = c.clone().project(probe); m = Math.max(m, Math.abs(p.x), Math.abs(p.y)); }
      d *= Math.max(0.6, Math.min(1.8, m / 0.8));
    }
    return {pos: t.clone().addScaledVector(dir, d), target: t};
  }
  let lastPreset = 'iso', userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; tween = null; });
  function view(name = 'iso', animate = true) {
    const pose = presetPose(name); if (!pose) return;
    lastPreset = name; userMoved = false;
    if (!animate || reducedMotion()) { camera.position.copy(pose.pos); controls.target.copy(pose.target); controls.update(); needsRender = true; return; }
    tween = {from: camera.position.clone(), fromT: controls.target.clone(), to: pose.pos, toT: pose.target, t0: performance.now(), dur: 650};
  }

  // ---------- interacción ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  const pick = e => {
    const rect = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables.filter(o => o.visible), false)[0];
    if (!hit) return null;
    const data = hit.object.userData;
    return {id: data.faceRooms?.[hit.face.materialIndex] || data.roomId, surface: data.surface};
  };
  renderer.domElement.addEventListener('pointerdown', e => { down = {x: e.clientX, y: e.clientY}; });
  renderer.domElement.addEventListener('pointerup', e => {
    const start = down; down = null;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
    const hit = pick(e);
    if (hit?.id) {
      if (opts.paint && hit.surface) onPaint?.(hit.id, hit.surface);
      else onSelect?.(hit.id);
    }
  });
  let hoverAt = 0;
  renderer.domElement.addEventListener('pointermove', e => {
    if (e.buttons || performance.now() - hoverAt < 60) return;
    hoverAt = performance.now();
    renderer.domElement.style.cursor = pick(e) ? (opts.paint ? 'crosshair' : 'pointer') : 'grab';
  });
  controls.addEventListener('change', () => { needsRender = true; });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    if (!userMoved && state.input) view(lastPreset, false);
    needsRender = true;
  }
  new ResizeObserver(resize).observe(container);
  resize();

  let running = true;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / tween.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      camera.position.lerpVectors(tween.from, tween.to, e);
      controls.target.lerpVectors(tween.fromT, tween.toT, e);
      if (k >= 1) tween = null;
      needsRender = true;
    }
    controls.autoRotate = opts.spin;
    const moved = controls.update();
    if (moved || needsRender || opts.spin) {
      renderer.render(scene, camera);
      labels.render(scene, camera);
      needsRender = false;
    }
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running = false;
    else if (!running) { running = true; needsRender = true; requestAnimationFrame(frame); }
  });

  return {
    update(input, analysis, selected) {
      const pk = [input.width, input.depth, input.module].join('|');
      const hk = JSON.stringify(analysis.rooms.map(r => [r.id, r.name, r.type, r.x, r.z, r.w, r.d, r.windowStyle, r.floorColor, r.wallColor])) + pk;
      state = {input, analysis, selected};
      const plotChanged = pk !== plotKey;
      if (plotChanged) { plotKey = pk; buildTerrain(input); }
      if (hk !== houseKey) { houseKey = hk; buildHouse(); } else applySelection();
      if (firstView) { firstView = false; view('iso', false); } else if (plotChanged) view('iso');
      needsRender = true;
    },
    setSelected(id) { state.selected = id; applySelection(); },
    setOptions(next) {
      const rebuild = ['roof', 'cut', 'furniture'].some(k => k in next && next[k] !== opts[k]);
      opts = {...opts, ...next};
      if (rebuild) buildHouse(); else { applyExplode(); }
      needsRender = true;
    },
    get options() { return {...opts}; },
    view,
    fitPlot() { view('iso'); },
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); }
  };
}

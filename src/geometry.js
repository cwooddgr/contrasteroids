// Procedural meshes. Everything is plain white; the ship's lights do the rest.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

// Lit surfaces: a face is either turned toward a light or not (no Lambert
// gradient), so terminators stay razor sharp. Only distance falloff, the
// spotlight cone, and shadows scale the light, which is what makes grey.
function binaryLambert(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_lambert_pars_fragment>',
      THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
        'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
        'float dotNL = step( 0.02, dot( geometryNormal, directLight.direction ) );',
      ),
    );
  };
  material.customProgramCacheKey = () => 'binary-lambert';
  return material;
}

// Ships, ours and the aliens', light themselves. They are shaded instead by a fixed key light from the upper-left, low over the plane
// (the old sun angle), binary like everything else. The camera looks straight
// down with no roll, so view space has the same axes as world space.
function shipKey(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'gl_FragColor = vec4( vec3( step( 0.0, dot( normal, normalize( vec3( -0.683, 0.683, 0.259 ) ) ) ) ), 1.0 );',
    );
  };
  material.customProgramCacheKey = () => 'ship-key';
  return material;
}

export const WHITE_SMOOTH = binaryLambert(new THREE.MeshLambertMaterial({ color: 0xffffff }));
export const WHITE_FLAT = binaryLambert(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
const SHIP_SMOOTH = shipKey(new THREE.MeshLambertMaterial({ color: 0xffffff }));
const SHIP_FLAT = shipKey(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
export const SELF_LIT = new THREE.MeshBasicMaterial({ color: 0xffffff });

// --- small seeded RNG and 3D value noise ---
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function hash3(i, j, k, seed) {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647 + seed * 144269504) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

function fbm(x, y, z, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * freq, y * freq, z * freq, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm; // 0..1
}

// --- rocks: smooth, lumpy, cratered ---
// detail: icosahedron subdivision level. Returns a unit-ish geometry.
export function makeRockGeometry(seed, detail = 4) {
  const rand = rng(seed * 9301 + 49297);
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);

  const craters = [];
  // Steep-walled craters: wall slope near the rim is about 2 * depth / rho,
  // so these walls are steeper than 45° and throw real shadows at our sun angle.
  const n = 6 + Math.floor(rand() * 8);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    const rho = 0.12 + rand() * 0.36;
    craters.push({ c, rho, depth: rho * (0.35 + rand() * 0.3) });
  }
  const stretch = new THREE.Vector3(0.75 + rand() * 0.45, 0.75 + rand() * 0.45, 0.75 + rand() * 0.45);
  const noiseScale = 1.2 + rand() * 0.8;
  const lumpiness = 0.5 + rand() * 0.35;

  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let r = 1 + lumpiness * (fbm(v.x * noiseScale + 5, v.y * noiseScale + 5, v.z * noiseScale + 5, seed) - 0.5);
    r += 0.1 * (fbm(v.x * 5, v.y * 5, v.z * 5, seed + 99, 3) - 0.5);
    for (const { c, rho, depth } of craters) {
      const a = Math.acos(THREE.MathUtils.clamp(v.dot(c), -1, 1));
      const t = a / rho;
      if (t < 1) r -= depth * (1 - t * t);
      r += depth * 0.3 * Math.exp(-(((t - 1) / 0.15) ** 2));
    }
    v.multiplyScalar(r).multiply(stretch);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function makeRockMesh(seed, radius, detail) {
  const mesh = new THREE.Mesh(makeRockGeometry(seed, detail), WHITE_SMOOTH);
  mesh.scale.setScalar(radius);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A shared set of small chunk geometries for explosion debris.
export const DEBRIS_GEOMS = Array.from({ length: 10 }, (_, i) => makeRockGeometry(1000 + i, 1));

function finish(obj) {
  obj.traverse((o) => {
    if (o.isMesh && o.material !== SELF_LIT) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return obj;
}

// Ships light themselves (Charlie's call): no shadows cast or received.
function selfShaded(obj) {
  obj.traverse((o) => {
    if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; }
  });
  return obj;
}

// --- the player ship, pointing along +x ---
// A sharp center ridge with steep flanks: under the key light one flank is lit
// and the other is black, and they swap as the ship turns.
export function makeShip() {
  const group = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const hull = new ConvexGeometry([
    V(2.7, 0, 0.05), // nose
    V(0.5, 0, 1.15), // ridge peak
    V(-1.2, 0, 0.75), // ridge tail
    V(-1.5, 1.75, -0.05), V(-1.5, -1.75, -0.05), // wing tips
    V(-1.25, 0.6, 0.3), V(-1.25, -0.6, 0.3), // tail shoulders
    V(0.9, 0.55, 0.05), V(0.9, -0.55, 0.05), // forward chines
    V(0.2, 0, -0.45), V(-1.2, 0, -0.35), // keel
  ]);
  group.add(new THREE.Mesh(hull, SHIP_FLAT));

  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.8), SHIP_FLAT);
  fin.position.set(-0.95, 0, 1.15);
  fin.rotation.y = -0.35;
  group.add(fin);

  const canopy = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), SHIP_FLAT);
  canopy.scale.set(0.75, 0.28, 0.32);
  canopy.position.set(0.85, 0, 0.82);
  canopy.rotation.y = 0.45;
  group.add(canopy);

  const flame = new THREE.Group();
  flame.position.set(-1.55, 0, 0.15);
  for (const y of [-0.85, 0.85]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.2, 16), SHIP_SMOOTH);
    pod.rotation.z = Math.PI / 2;
    pod.position.set(-1.1, y, 0.2);
    group.add(pod);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.5, 8), SELF_LIT);
    cone.rotation.z = Math.PI / 2; // tip points toward -x
    cone.position.set(-0.75, y, 0.05);
    flame.add(cone);
  }
  flame.visible = false;
  group.add(flame);
  group.userData.flame = flame;
  // The ship's lights sit inside it; it must not shadow them.
  return selfShaded(group);
}

// --- Skiff: a spindle with fins, long axis along x ---
export function makeSkiff() {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.4, 10), SHIP_FLAT);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 1.2;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.4, 10), SHIP_FLAT);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -1.2;
  spin.add(nose, tail);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 1.5), SHIP_FLAT);
    const holder = new THREE.Group();
    fin.position.set(-1.0, 0, 0.9);
    holder.add(fin);
    holder.rotation.x = (i / 3) * Math.PI * 2;
    spin.add(holder);
  }
  group.add(spin);
  group.userData.spin = spin;
  return selfShaded(group);
}

// --- Layer: a ring with a hub and spokes ---
export function makeLayer() {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.55, 14, 40), SHIP_SMOOTH));
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), SHIP_SMOOTH));
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.5, 8), SHIP_SMOOTH);
    spoke.position.y = 1.25;
    const holder = new THREE.Group();
    holder.add(spoke);
    holder.rotation.z = (i / 3) * Math.PI * 2;
    spin.add(holder);
  }
  spin.rotation.x = 0.9;
  group.add(spin);
  group.userData.spin = spin;
  return selfShaded(group);
}

// --- Hunter: a sharp stretched double pyramid pointing along +x ---
export function makeHunter() {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), SHIP_FLAT);
  body.scale.set(2.4, 0.95, 0.95);
  spin.add(body);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 6, 4), SHIP_FLAT);
  collar.rotation.y = Math.PI / 2;
  spin.add(collar);
  group.add(spin);
  group.userData.spin = spin;
  return selfShaded(group);
}

// --- Mine: a spiked ball with a self-lit blinker ---
export function makeMine() {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const core = new THREE.IcosahedronGeometry(0.7, 0);
  spin.add(new THREE.Mesh(core, WHITE_FLAT));
  const dirs = new THREE.IcosahedronGeometry(1, 0);
  const p = dirs.attributes.position;
  const seen = new Set();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < p.count; i++) {
    const d = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
    const key = d.toArray().map((n) => n.toFixed(2)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 5), WHITE_FLAT);
    spike.quaternion.setFromUnitVectors(up, d);
    spike.position.copy(d).multiplyScalar(0.85);
    spin.add(spike);
  }
  group.add(spin);
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), SELF_LIT);
  blink.position.z = 1.1;
  group.add(blink);
  group.userData.spin = spin;
  group.userData.blink = blink;
  return finish(group);
}

export const BULLET_GEOM = new THREE.SphereGeometry(0.32, 8, 6);
export const ENEMY_BULLET_GEOM = new THREE.OctahedronGeometry(0.5, 0);

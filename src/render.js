// Rendering: the ship's spotlight and halo, bullet lights, and explosion
// flashes; no ambient, hard shadows; light fades to black with distance.
import * as THREE from 'three';

export const WORLD_H = 100; // world units, top to bottom of the screen

const THRESHOLD_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Lights are scaled so a fully lit surface comes out at 1.0, and the falloff
// with distance shows as grey. Tiny values go to black so nothing glows
// faintly by accident. The HUD stays pure black and white and is ORed in.
const THRESHOLD_FS = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tHud;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float lum = min(1.0, max(c.r, max(c.g, c.b)));
  float v = lum * step(uThreshold, lum);
  v = max(v, step(0.5, texture2D(tHud, vUv).a));
  gl_FragColor = vec4(vec3(v), 1.0);
}
`;

export class Renderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    this.camera.position.set(0, 0, 150);
    this.camera.lookAt(0, 0, 0);

    // Light intensities are multiplied by PI to cancel Lambert's 1/PI, so a
    // fully lit surface renders at exactly 1.0 before falloff. decay = 0 with a
    // cutoff distance gives three's windowed falloff, (1 - (d/range)^4)^2:
    // near full brightness close in, fading to black at the range.
    // The ship's spotlight: tunable in dev mode.
    this.coneDeg = 50; // full cone width
    this.spotRange = 75;
    this.haloRange = 16;
    this.lightHeight = 3; // above the play plane
    this.spot = new THREE.SpotLight(0xffffff, 0, this.spotRange, 0, 0, 0);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(2048, 2048);
    this.spot.shadow.bias = -0.0005;
    this.spot.shadow.normalBias = 0.05;
    this.spot.shadow.camera.near = 0.5;
    this.scene.add(this.spot);
    this.scene.add(this.spot.target);
    // A dim glow all around the ship, so nothing arrives in total darkness.
    this.halo = new THREE.PointLight(0xffffff, 0, this.haloRange, 0);
    this.haloLevel = 0.55;
    this.scene.add(this.halo);
    this.applyLightTuning();

    // Bullet lights: a fixed pool (one per allowed player shot) so the
    // shader's light count never changes. No shadows, to spare phones.
    this.bulletRange = 9;
    this.bulletLights = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.PointLight(0xffffff, 0, this.bulletRange, 0);
      this.scene.add(p);
      this.bulletLights.push(p);
    }

    // Explosion flashes: a fixed pool so the shader's light count never changes.
    this.flashes = [];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.PointLight(0xffffff, 0, 0, 2);
      p.castShadow = false;
      p.userData.life = 0;
      p.userData.max = 1;
      p.userData.peak = 0;
      this.scene.add(p);
      this.flashes.push(p);
    }
    this.nextFlash = 0;

    this.stars = null;

    // Offscreen targets.
    this.target = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
    this.hudCanvas = document.createElement('canvas');
    this.hud = this.hudCanvas.getContext('2d');
    this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
    this.hudTexture.minFilter = THREE.NearestFilter;
    this.hudTexture.magFilter = THREE.NearestFilter;

    this.post = new THREE.ShaderMaterial({
      vertexShader: THRESHOLD_VS,
      fragmentShader: THRESHOLD_FS,
      uniforms: {
        tScene: { value: this.target.texture },
        tHud: { value: this.hudTexture },
        uThreshold: { value: 0.02 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.pxW = Math.floor(w * pr);
    this.pxH = Math.floor(h * pr);
    this.target.setSize(this.pxW, this.pxH);
    this.hudCanvas.width = this.pxW;
    this.hudCanvas.height = this.pxH;
    this.hudTexture.dispose(); // canvas size changed; force re-upload at the new size
    this.hudDirty = true;

    this.H = WORLD_H;
    this.W = WORLD_H * (w / h);
    this.camera.left = -this.W / 2;
    this.camera.right = this.W / 2;
    this.camera.top = this.H / 2;
    this.camera.bottom = -this.H / 2;
    this.camera.updateProjectionMatrix();
    this.buildStars();
  }

  applyLightTuning() {
    this.spot.angle = THREE.MathUtils.degToRad(this.coneDeg / 2);
    this.spot.distance = this.spotRange;
    this.spot.shadow.camera.far = this.spotRange;
    this.halo.distance = this.haloRange;
  }

  // Place the ship's lights. angle is the ship's heading; on=false (dead, in
  // hyperspace, or no ship) turns them off.
  shipLights(x, y, angle, on) {
    const c = Math.cos(angle), s = Math.sin(angle);
    this.spot.position.set(x + c * 2.8, y + s * 2.8, this.lightHeight);
    this.spot.target.position.set(x + c * 30, y + s * 30, 0);
    this.spot.target.updateMatrixWorld();
    this.spot.intensity = on ? Math.PI : 0;
    this.halo.position.set(x, y, this.lightHeight);
    this.halo.intensity = on ? Math.PI * this.haloLevel : 0;
  }

  // Bullet lights follow the first few player bullets.
  bulletLightsFor(bullets) {
    this.bulletLights.forEach((p, i) => {
      const b = bullets[i];
      if (b) {
        p.position.set(b.x, b.y, 2);
        p.intensity = Math.PI * (0.8 + Math.random() * 0.35); // flickers with the sparkle
      } else {
        p.intensity = 0;
      }
    });
  }

  buildStars() {
    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
    }
    const count = Math.round(this.W * this.H * 0.03);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.W;
      pos[i * 3 + 1] = (Math.random() - 0.5) * this.H;
      pos[i * 3 + 2] = -80;
    }
    // Twinkle, like the sparkle setting on a string of Christmas lights: each
    // star rests at its own brightness and now and then flares briefly to
    // full white, on its own rhythm.
    const base = new Float32Array(count);
    const rate = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      base[i] = 0.65 + Math.random() * 0.3;
      rate[i] = 0.4 + Math.random() * 1.2;
      phase[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aBase', new THREE.BufferAttribute(base, 1));
    g.setAttribute('aRate', new THREE.BufferAttribute(rate, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    // One CSS pixel per star (two physical pixels on Retina), so black rocks
    // read as holes in the starfield.
    const size = Math.max(1, Math.round(this.renderer.getPixelRatio()));
    this.starTime = this.starTime || { value: 0 };
    this.stars = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uTime: this.starTime, uSize: { value: size } },
      vertexShader: /* glsl */ `
        attribute float aBase;
        attribute float aRate;
        attribute float aPhase;
        uniform float uTime;
        uniform float uSize;
        varying float vB;
        void main() {
          // A sharp peak once per cycle; most of the cycle sits at the base level.
          float flare = pow(max(0.0, sin(uTime * aRate + aPhase)), 40.0);
          vB = mix(aBase, 1.0, flare);
          gl_PointSize = uSize;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vB;
        void main() { gl_FragColor = vec4(vec3(vB), 1.0); }`,
    }));
    this.scene.add(this.stars);
  }

  flash(x, y, radius, duration = 0.25) {
    const p = this.flashes[this.nextFlash];
    this.nextFlash = (this.nextFlash + 1) % this.flashes.length;
    p.position.set(x, y, 4);
    p.distance = radius;
    p.userData.radius = radius;
    p.userData.peak = radius * radius * 2;
    p.userData.life = duration;
    p.userData.max = duration;
    p.intensity = p.userData.peak;
  }

  update(dt) {
    this.starTime.value += dt;
    for (const p of this.flashes) {
      if (p.userData.life > 0) {
        p.userData.life -= dt;
        const t = Math.max(0, p.userData.life / p.userData.max);
        p.intensity = p.userData.peak * t;
        p.distance = p.userData.radius * (0.5 + 0.5 * t);
      } else {
        p.intensity = 0;
      }
    }
  }

  render() {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}

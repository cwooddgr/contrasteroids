// Rendering: one sun, no ambient, hard shadows, then a 1-bit threshold pass.
import * as THREE from 'three';

export const WORLD_H = 100; // world units, top to bottom of the screen

const THRESHOLD_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Any light at all is white; anything unlit is black. HUD alpha is ORed in.
const THRESHOLD_FS = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tHud;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float lum = max(c.r, max(c.g, c.b));
  float v = step(uThreshold, lum);
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

    // The sun. Azimuth is measured in the screen plane (135° = upper-left),
    // elevation above the play plane.
    this.lightAzimuth = 135;
    this.lightElevation = 15;
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Explosion flashes: a fixed pool so the shader's light count never changes.
    this.flashes = [];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.PointLight(0xffffff, 0, 0, 2);
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
    this.updateSun();
    this.buildStars();
  }

  updateSun() {
    const az = THREE.MathUtils.degToRad(this.lightAzimuth);
    const el = THREE.MathUtils.degToRad(this.lightElevation);
    const dir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
    this.sun.position.copy(dir).multiplyScalar(150);
    this.sun.target.position.set(0, 0, 0);
    const s = Math.max(this.W, this.H) * 0.75 + 20;
    const cam = this.sun.shadow.camera;
    cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s;
    cam.near = 1; cam.far = 320;
    cam.updateProjectionMatrix();
  }

  buildStars() {
    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
    }
    const count = Math.round(this.W * this.H * 0.022);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.W;
      pos[i * 3 + 1] = (Math.random() - 0.5) * this.H;
      pos[i * 3 + 2] = -80;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // One physical pixel per star, even on Retina screens.
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1, sizeAttenuation: false }));
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

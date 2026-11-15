// Game state, entities, and rules.
import * as THREE from 'three';
import {
  makeRockMesh, makeShip, makeSkiff, makeLayer, makeHunter, makeMine,
  DEBRIS_GEOMS, WHITE_SMOOTH, SELF_LIT, BULLET_GEOM, ENEMY_BULLET_GEOM,
} from './geometry.js';

const ROCK = {
  3: { r: 8, detail: 5, score: 20, speed: [4, 9], mass: 7 },
  2: { r: 4.5, detail: 4, score: 50, speed: [7, 14], mass: 3 },
  1: { r: 2.4, detail: 3, score: 100, speed: [10, 19], mass: 1 },
};
const SCORE = { skiff: 200, layer: 500, hunter: 1000, mine: 50 };

const SHIP_R = 1.5;
const TURN = 4.6;
const THRUST = 55;
const DRAG = 0.55;
const MAX_SPEED = 65;
const BULLET_SPEED = 85;
const BULLET_LIFE = 0.95;
const MAX_BULLETS = 5;
const FIRE_COOLDOWN = 0.16;
const EXTRA_LIFE = 10000;
const HI_KEY = 'contrasteroids.hi';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TMP_Q = new THREE.Quaternion();

function randomAxis() {
  return new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
}

export class Game {
  constructor(renderer, sound, input) {
    this.r = renderer;
    this.scene = renderer.scene;
    this.sound = sound;
    this.input = input;

    this.rocks = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.aliens = [];
    this.mines = [];
    this.debris = [];
    this.sparks = [];

    this.hi = 0;
    try { this.hi = Number(localStorage.getItem(HI_KEY)) || 0; } catch { /* storage unavailable */ }

    this.ship = makeShip();
    this.ship.rotation.order = 'ZYX'; // roll about the ship's own axis, then yaw
    this.ship.visible = false;
    this.scene.add(this.ship);
    this.player = { x: 0, y: 0, vx: 0, vy: 0, angle: Math.PI / 2, bank: 0, alive: false };

    this.SPARK_MAX = 900;
    const sparkPos = new Float32Array(this.SPARK_MAX * 3).fill(-1000);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkSize = Math.max(2, Math.round(2 * renderer.renderer.getPixelRatio()));
    this.sparkPoints = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: sparkSize, sizeAttenuation: false }));
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    this.dev = false;
    this.paused = false;
    this.mode = 'title';
    this.time = 0;
    this.hudKey = '';
    this.attract();
  }

  // ---------- setup ----------

  get W() { return this.r.W; }
  get H() { return this.r.H; }

  clearAll() {
    for (const list of [this.rocks, this.bullets, this.enemyBullets, this.aliens, this.mines, this.debris]) {
      while (list.length) this.removeEntity(list, list[0]);
    }
    this.sparks.length = 0;
  }

  removeEntity(list, e) {
    const i = list.indexOf(e);
    if (i >= 0) list.splice(i, 1);
    this.scene.remove(e.mesh);
    if (e.ownsGeometry) e.mesh.geometry.dispose();
  }

  attract() {
    this.clearAll();
    this.sound.silenceLoops();
    for (let i = 0; i < 6; i++) {
      this.spawnRock(pick([3, 3, 2, 2, 1]), rand(-this.W / 2, this.W / 2), rand(-this.H / 2, this.H / 2));
    }
  }

  start() {
    this.clearAll();
    this.mode = 'play';
    this.paused = false;
    this.score = 0;
    this.lives = 3;
    this.wave = 0;
    this.nextLife = EXTRA_LIFE;
    this.gameOverTimer = 0;
    this.spawnPlayer();
    this.nextWave();
  }

  nextWave() {
    this.wave += 1;
    const count = Math.min(3 + this.wave, 11);
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = rand(-this.W / 2, this.W / 2);
        y = rand(-this.H / 2, this.H / 2);
      } while (Math.hypot(x - this.player.x, y - this.player.y) < 32
        || this.rocks.some((r) => Math.hypot(r.x - x, r.y - y) < r.r + ROCK[3].r + 2));
      this.spawnRock(3, x, y);
    }
    this.waveMass = count * ROCK[3].mass;
    this.waveDelay = 0;
    this.banner = `WAVE ${this.wave}`;
    this.bannerTimer = 2;
    this.alienTimer = rand(8, 14);
    this.beatTimer = 0.5;
    this.beatHigh = false;
  }

  spawnRock(size, x, y, vx, vy) {
    const spec = ROCK[size];
    const mesh = makeRockMesh(Math.floor(Math.random() * 1e9), spec.r, spec.detail);
    mesh.quaternion.setFromAxisAngle(randomAxis(), rand(0, Math.PI * 2));
    if (vx === undefined) {
      const a = rand(0, Math.PI * 2);
      const s = rand(...spec.speed) * (1 + 0.05 * ((this.wave || 1) - 1));
      vx = Math.cos(a) * s;
      vy = Math.sin(a) * s;
    }
    const rock = {
      mesh, size, x, y, vx, vy, z: rand(-2, 2),
      r: spec.r * 0.92,
      axis: randomAxis(),
      spin: rand(0.3, 1.3) * (4 - size) * 0.6,
      ownsGeometry: true,
      born: this.time,
    };
    this.scene.add(mesh);
    this.rocks.push(rock);
    return rock;
  }

  spawnPlayer() {
    Object.assign(this.player, {
      x: 0, y: 0, vx: 0, vy: 0, angle: Math.PI / 2, bank: 0, r: SHIP_R,
      alive: true, invuln: 2.5, hyper: 0, hyperCooldown: 0, fireCooldown: 0, respawn: 0,
    });
    this.ship.visible = true;
  }

  // ---------- main update ----------

  update(dt) {
    this.time += dt;
    const inp = this.input;

    if (inp.pressed('Backquote')) { this.dev = !this.dev; }
    if (this.dev) this.tuneLight(dt);
    if (inp.pressed('KeyM')) this.sound.toggleMute();

    if (this.mode === 'play') {
      if (inp.pressed('KeyP', 'Escape')) {
        this.paused = !this.paused;
        if (this.paused) this.sound.silenceLoops();
      }
      if (this.paused) return;
      this.updatePlayer(dt);
      this.updateAliens(dt);
      this.updateMines(dt);
      this.collide();
      this.updateWave(dt);
    } else if (inp.pressed('Enter', 'NumpadEnter')) {
      this.start();
      return;
    }

    this.updateRocks(dt);
    this.collideRocks();
    this.updateBullets(this.bullets, dt);
    this.updateBullets(this.enemyBullets, dt);
    this.updateDebris(dt);
    this.updateSparks(dt);
    this.r.update(dt);
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
  }

  pause() {
    if (this.mode === 'play' && !this.paused) {
      this.paused = true;
      this.sound.silenceLoops();
    }
  }

  tuneLight(dt) {
    const inp = this.input;
    let changed = false;
    if (inp.held('KeyJ')) { this.r.lightAzimuth += 60 * dt; changed = true; }
    if (inp.held('KeyL')) { this.r.lightAzimuth -= 60 * dt; changed = true; }
    if (inp.held('KeyI')) { this.r.lightElevation = Math.min(89, this.r.lightElevation + 30 * dt); changed = true; }
    if (inp.held('KeyK')) { this.r.lightElevation = Math.max(-30, this.r.lightElevation - 30 * dt); changed = true; }
    this.r.lightAzimuth = (this.r.lightAzimuth + 360) % 360;
    if (changed) this.r.updateSun();
  }

  wrap(e) {
    const mx = this.W / 2 + e.r;
    const my = this.H / 2 + e.r;
    if (e.x > mx) e.x -= 2 * mx; else if (e.x < -mx) e.x += 2 * mx;
    if (e.y > my) e.y -= 2 * my; else if (e.y < -my) e.y += 2 * my;
  }

  updatePlayer(dt) {
    const p = this.player;
    const inp = this.input;
    const flame = this.ship.userData.flame;

    if (!p.alive) {
      flame.visible = false;
      this.sound.thrust(false);
      if (this.lives > 0) {
        p.respawn -= dt;
        const clear = this.rocks.every((r) => Math.hypot(r.x, r.y) > r.r + 12)
          && this.aliens.every((a) => Math.hypot(a.x, a.y) > 15);
        if (p.respawn <= 0 && (clear || p.respawn < -4)) this.spawnPlayer();
      }
      return;
    }

    if (p.hyper > 0) {
      p.hyper -= dt;
      if (p.hyper <= 0) {
        p.x = rand(-this.W * 0.42, this.W * 0.42);
        p.y = rand(-this.H * 0.42, this.H * 0.42);
        p.vx *= 0.3;
        p.vy *= 0.3;
        this.ship.visible = true;
      }
      return;
    }

    let turn = 0;
    if (inp.held('ArrowLeft', 'KeyA')) turn += 1;
    if (inp.held('ArrowRight', 'KeyD')) turn -= 1;
    p.angle += turn * TURN * dt;
    p.bank += (turn * -0.55 - p.bank) * Math.min(1, dt * 8);

    const thrusting = inp.held('ArrowUp', 'KeyW');
    if (thrusting) {
      p.vx += Math.cos(p.angle) * THRUST * dt;
      p.vy += Math.sin(p.angle) * THRUST * dt;
    }
    const drag = Math.exp(-DRAG * dt);
    p.vx *= drag;
    p.vy *= drag;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > MAX_SPEED) { p.vx *= MAX_SPEED / sp; p.vy *= MAX_SPEED / sp; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.r = SHIP_R;
    this.wrap(p);

    flame.visible = thrusting && Math.random() > 0.15;
    flame.scale.set(1, rand(0.7, 1.25), 1);
    this.sound.thrust(thrusting);

    p.fireCooldown -= dt;
    if (inp.held('Space') && p.fireCooldown <= 0 && this.bullets.length < MAX_BULLETS) {
      p.fireCooldown = FIRE_COOLDOWN;
      const c = Math.cos(p.angle), s = Math.sin(p.angle);
      this.fire(this.bullets, BULLET_GEOM, p.x + c * 2.4, p.y + s * 2.4,
        c * BULLET_SPEED + p.vx, s * BULLET_SPEED + p.vy, BULLET_LIFE);
      this.sound.shot();
    }

    p.hyperCooldown -= dt;
    if (inp.pressed('ShiftLeft', 'ShiftRight', 'ArrowDown', 'KeyS') && p.hyperCooldown <= 0) {
      p.hyper = 0.45;
      p.hyperCooldown = 1.2;
      this.ship.visible = false;
      flame.visible = false;
      this.sound.thrust(false);
      this.sound.hyperspace();
      this.burstSparks(p.x, p.y, 14, 25);
      return;
    }

    if (p.invuln > 0) p.invuln -= dt;
    this.ship.visible = p.invuln > 0 ? Math.floor(p.invuln * 10) % 2 === 0 : true;
    this.ship.position.set(p.x, p.y, 0);
    this.ship.rotation.set(p.bank, 0, p.angle);
  }

  fire(list, geom, x, y, vx, vy, life) {
    const mesh = new THREE.Mesh(geom, SELF_LIT);
    mesh.position.set(x, y, 0);
    this.scene.add(mesh);
    list.push({ mesh, x, y, vx, vy, life, r: 0.5 });
  }

  updateBullets(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      b.life -= dt;
      if (b.life <= 0) { this.removeEntity(list, b); continue; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      this.wrap(b);
      b.mesh.position.set(b.x, b.y, 0);
      b.mesh.rotation.z += dt * 8;
    }
  }

  updateRocks(dt) {
    for (const rock of this.rocks) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      this.wrap(rock);
      rock.mesh.position.set(rock.x, rock.y, rock.z);
      TMP_Q.setFromAxisAngle(rock.axis, rock.spin * dt);
      rock.mesh.quaternion.premultiply(TMP_Q);
    }
  }

  // Rocks that run into each other: large and medium ones split, small ones
  // bounce. New rocks get a short grace period so one split can't chain.
  collideRocks() {
    const GRACE = 1.2;
    for (let i = 0; i < this.rocks.length; i++) {
      const a = this.rocks[i];
      for (let j = i + 1; j < this.rocks.length; j++) {
        const b = this.rocks[j];
        if (!this.hit(a, b)) continue;
        if (this.time - a.born < GRACE || this.time - b.born < GRACE) continue;
        const relA = { vx: a.vx - b.vx, vy: a.vy - b.vy };
        const relB = { vx: b.vx - a.vx, vy: b.vy - a.vy };
        if (a.size === 1 && b.size === 1) {
          this.bounce(a, b);
          continue;
        }
        // Each rock larger than small splits; a small rock that hits a bigger one bounces off it.
        if (a.size > 1) this.breakRock(a, false, relB);
        if (b.size > 1) this.breakRock(b, false, relA);
        if (a.size === 1 && b.size > 1) a.born = this.time;
        if (b.size === 1 && a.size > 1) b.born = this.time;
        return; // the list changed; pick up any further contacts next step
      }
    }
  }

  bounce(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rel > 0) { // approaching: swap the normal components (equal mass)
      a.vx -= rel * nx; a.vy -= rel * ny;
      b.vx += rel * nx; b.vy += rel * ny;
      this.sound.tone('triangle', 160, 90, 0.08, 0.15);
    }
    const push = (a.r + b.r - d) / 2;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
  }

  // ---------- aliens ----------

  spawnAlien() {
    const types = ['skiff', 'skiff'];
    if (this.wave >= 2) types.push('layer');
    if (this.wave >= 4) types.push('hunter', 'hunter');
    const type = pick(types);
    const W = this.W, H = this.H, wave = this.wave;
    let a;
    if (type === 'skiff') {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const baseY = rand(-H * 0.35, H * 0.35);
      a = {
        type, mesh: makeSkiff(), dir, baseY, x: -dir * (W / 2 + 4), y: baseY, r: 2.3,
        vx: dir * Math.min(16 + wave * 1.2, 30), amp: rand(5, 13), freq: rand(1.4, 2.4),
        fireTimer: rand(0.8, 1.4),
      };
      a.mesh.rotation.z = dir > 0 ? 0 : Math.PI;
    } else if (type === 'layer') {
      const dir = Math.random() < 0.5 ? 1 : -1;
      a = {
        type, mesh: makeLayer(), dir, x: rand(-W * 0.4, W * 0.4), y: -dir * (H / 2 + 4), r: 3.1,
        vx: rand(-3, 3), vy: dir * Math.min(5 + wave * 0.3, 10), mineTimer: rand(1.5, 2.5),
      };
    } else {
      const edge = Math.floor(Math.random() * 4);
      const x = edge < 2 ? (edge === 0 ? -1 : 1) * (W / 2 + 3) : rand(-W / 2, W / 2);
      const y = edge >= 2 ? (edge === 2 ? -1 : 1) * (H / 2 + 3) : rand(-H / 2, H / 2);
      a = {
        type, mesh: makeHunter(), x, y, r: 1.9,
        heading: Math.atan2(this.player.y - y, this.player.x - x),
        speed: Math.min(19 + wave * 0.8, 32),
      };
    }
    a.t = 0;
    this.scene.add(a.mesh);
    this.aliens.push(a);
  }

  updateAliens(dt) {
    const p = this.player;
    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      a.t += dt;
      const spin = a.mesh.userData.spin;
      if (a.type === 'skiff') {
        a.x += a.vx * dt;
        a.y = a.baseY + Math.sin(a.t * a.freq) * a.amp;
        spin.rotation.x += dt * 3;
        if (Math.abs(a.x) > this.W / 2 + 5 && a.t > 1) { this.removeEntity(this.aliens, a); continue; }
        a.fireTimer -= dt;
        if (a.fireTimer <= 0 && p.alive && p.hyper <= 0) {
          a.fireTimer = rand(1.0, 1.8);
          const err = Math.max(0.05, 0.35 - this.wave * 0.03) * rand(-1, 1);
          const ang = Math.atan2(p.y - a.y, p.x - a.x) + err;
          this.fire(this.enemyBullets, ENEMY_BULLET_GEOM, a.x, a.y, Math.cos(ang) * 45, Math.sin(ang) * 45, 2.2);
          this.sound.enemyShot();
        }
      } else if (a.type === 'layer') {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        spin.rotation.z += dt * 1.2;
        spin.rotation.x = 0.9 + Math.sin(a.t * 0.7) * 0.4;
        if (Math.abs(a.y) > this.H / 2 + 5 && a.t > 1) { this.removeEntity(this.aliens, a); continue; }
        a.mineTimer -= dt;
        if (a.mineTimer <= 0 && this.mines.length < 8 && Math.abs(a.y) < this.H / 2) {
          a.mineTimer = rand(2.4, 3.4);
          this.spawnMine(a.x, a.y);
        }
      } else {
        if (p.alive && p.hyper <= 0) {
          const want = Math.atan2(p.y - a.y, p.x - a.x);
          let d = want - a.heading;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          a.heading += THREE.MathUtils.clamp(d, -1.5 * dt, 1.5 * dt);
        }
        a.x += Math.cos(a.heading) * a.speed * dt;
        a.y += Math.sin(a.heading) * a.speed * dt;
        if (a.t > 1.5) this.wrap(a);
        a.mesh.rotation.z = a.heading;
        spin.rotation.x += dt * 5;
      }
      a.mesh.position.set(a.x, a.y, 0);
    }

    this.sound.skiff(this.aliens.some((a) => a.type === 'skiff'));
    this.sound.hunter(this.aliens.some((a) => a.type === 'hunter'));

    this.alienTimer -= dt;
    if (this.alienTimer <= 0) {
      this.alienTimer = rand(9, 16) * Math.max(0.5, 1 - this.wave * 0.04);
      const maxAliens = Math.min(1 + Math.floor(this.wave / 4), 3);
      if (this.aliens.length < maxAliens && this.rocks.length > 0) this.spawnAlien();
    }
  }

  spawnMine(x, y) {
    const mesh = makeMine();
    mesh.position.set(x, y, 0);
    this.scene.add(mesh);
    this.mines.push({ mesh, x, y, vx: 0, vy: 0, r: 1.2, life: 22, blink: rand(0, 0.6), axis: randomAxis() });
  }

  updateMines(dt) {
    const p = this.player;
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.life -= dt;
      if (m.life <= 0) {
        this.explode(m.x, m.y, 1, false);
        this.removeEntity(this.mines, m);
        continue;
      }
      const dx = p.x - m.x, dy = p.y - m.y;
      const dist = Math.hypot(dx, dy);
      if (p.alive && p.hyper <= 0 && dist < 22) {
        m.vx += (dx / dist) * 9 * dt;
        m.vy += (dy / dist) * 9 * dt;
      }
      const drag = Math.exp(-0.8 * dt);
      m.vx *= drag;
      m.vy *= drag;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      this.wrap(m);
      m.mesh.position.set(m.x, m.y, 0);
      TMP_Q.setFromAxisAngle(m.axis, dt * 1.5);
      m.mesh.userData.spin.quaternion.premultiply(TMP_Q);

      const period = dist < 22 ? 0.25 : 0.7;
      m.blink -= dt;
      if (m.blink <= 0) {
        m.blink = period;
        if (dist < 40) this.sound.mineBeep();
      }
      m.mesh.userData.blink.visible = m.blink > period - 0.1;
    }
  }

  // ---------- collisions ----------

  hit(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, rr = a.r + b.r;
    return dx * dx + dy * dy < rr * rr;
  }

  collide() {
    const p = this.player;
    const playerTouchable = p.alive && p.hyper <= 0 && p.invuln <= 0;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let target = this.rocks.find((r) => this.hit(b, r));
      if (target) {
        this.removeEntity(this.bullets, b);
        this.breakRock(target, true, b);
        continue;
      }
      target = this.aliens.find((a) => this.hit(b, a));
      if (target) {
        this.removeEntity(this.bullets, b);
        this.killAlien(target, true);
        continue;
      }
      target = this.mines.find((m) => this.hit(b, m));
      if (target) {
        this.removeEntity(this.bullets, b);
        this.addScore(SCORE.mine);
        this.explode(target.x, target.y, 1, false);
        this.removeEntity(this.mines, target);
      }
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      const rock = this.rocks.find((r) => this.hit(b, r));
      if (rock) {
        this.removeEntity(this.enemyBullets, b);
        this.breakRock(rock, false, b);
      } else if (playerTouchable && this.hit(b, p)) {
        this.removeEntity(this.enemyBullets, b);
        this.killPlayer();
        return;
      }
    }

    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      const rock = this.rocks.find((r) => this.hit(a, r));
      if (rock) {
        this.breakRock(rock, false, a);
        this.killAlien(a, false);
      }
    }

    if (!playerTouchable) return;
    const rock = this.rocks.find((r) => this.hit(p, r));
    if (rock) {
      this.breakRock(rock, true, p);
      this.killPlayer();
      return;
    }
    const alien = this.aliens.find((a) => this.hit(p, a));
    if (alien) {
      this.killAlien(alien, true);
      this.killPlayer();
      return;
    }
    const mine = this.mines.find((m) => this.hit(p, m));
    if (mine) {
      this.explode(mine.x, mine.y, 1, false);
      this.removeEntity(this.mines, mine);
      this.killPlayer();
    }
  }

  breakRock(rock, byPlayer, impactor) {
    if (byPlayer) this.addScore(ROCK[rock.size].score);
    this.explode(rock.x, rock.y, rock.size, true);
    this.removeEntity(this.rocks, rock);
    if (rock.size > 1) {
      const size = rock.size - 1;
      const base = Math.atan2(impactor.vy || rock.vy, impactor.vx || rock.vx);
      for (const side of [-1, 1]) {
        const a = base + side * rand(0.5, 1.2);
        const s = rand(...ROCK[size].speed) * (1 + 0.05 * ((this.wave || 1) - 1));
        this.spawnRock(size, rock.x + Math.cos(a) * ROCK[size].r * 0.5, rock.y + Math.sin(a) * ROCK[size].r * 0.5,
          rock.vx * 0.4 + Math.cos(a) * s, rock.vy * 0.4 + Math.sin(a) * s);
      }
    }
  }

  killAlien(a, byPlayer) {
    if (byPlayer) this.addScore(SCORE[a.type]);
    this.explode(a.x, a.y, 2, false);
    this.removeEntity(this.aliens, a);
  }

  killPlayer() {
    const p = this.player;
    p.alive = false;
    p.respawn = 2.2;
    this.ship.visible = false;
    this.ship.userData.flame.visible = false;
    this.sound.thrust(false);
    this.explode(p.x, p.y, 2.5, false);
    this.lives -= 1;
    if (this.lives <= 0) this.gameOverTimer = 2.5;
  }

  addScore(n) {
    this.score += n;
    if (this.score >= this.nextLife) {
      this.nextLife += EXTRA_LIFE;
      this.lives += 1;
      this.sound.extraLife();
    }
  }

  updateWave(dt) {
    if (this.lives <= 0 && !this.player.alive) {
      this.gameOverTimer -= dt;
      if (this.gameOverTimer <= 0) {
        this.mode = 'gameover';
        this.sound.silenceLoops();
        if (this.score > this.hi) {
          this.hi = this.score;
          try { localStorage.setItem(HI_KEY, String(this.hi)); } catch { /* storage unavailable */ }
        }
      }
      return;
    }

    if (this.rocks.length === 0) {
      if (this.waveDelay <= 0) this.waveDelay = 2.5;
      this.waveDelay -= dt;
      if (this.waveDelay <= 0.0001) this.nextWave();
      return;
    }

    // Heartbeat speeds up as the wave's rock mass is cleared.
    const mass = this.rocks.reduce((m, r) => m + ROCK[r.size].mass, 0);
    const cleared = 1 - mass / this.waveMass;
    this.beatTimer -= dt;
    if (this.beatTimer <= 0) {
      this.beatTimer = THREE.MathUtils.lerp(1.0, 0.3, Math.max(0, cleared));
      this.sound.beat(this.beatHigh);
      this.beatHigh = !this.beatHigh;
    }
  }

  // ---------- effects ----------

  explode(x, y, size, isRock) {
    this.sound.explode(size);
    this.r.flash(x, y, 6 + size * 6, 0.18 + size * 0.06);
    this.burstSparks(x, y, Math.round(10 + size * 10), 20 + size * 8);
    const n = isRock ? 3 + size * 2 : 6;
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(pick(DEBRIS_GEOMS), WHITE_SMOOTH);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const scale = rand(0.35, 0.8) * (isRock ? size * 0.55 : 0.6);
      mesh.scale.setScalar(scale);
      const a = rand(0, Math.PI * 2);
      const s = rand(5, 18);
      this.scene.add(mesh);
      this.debris.push({
        mesh, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: scale,
        life: rand(0.8, 1.6), max: 0, scale, axis: randomAxis(), spin: rand(2, 7),
      });
      this.debris[this.debris.length - 1].max = this.debris[this.debris.length - 1].life;
    }
  }

  updateDebris(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) { this.removeEntity(this.debris, d); continue; }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.mesh.position.set(d.x, d.y, 0);
      d.mesh.scale.setScalar(d.scale * Math.min(1, (d.life / d.max) * 1.5));
      TMP_Q.setFromAxisAngle(d.axis, d.spin * dt);
      d.mesh.quaternion.premultiply(TMP_Q);
    }
  }

  burstSparks(x, y, n, speed) {
    for (let i = 0; i < n && this.sparks.length < this.SPARK_MAX; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(0.3, 1) * speed;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.7) });
    }
  }

  updateSparks(dt) {
    const pos = this.sparkPoints.geometry.attributes.position;
    let w = 0;
    for (const s of this.sparks) {
      s.life -= dt;
      if (s.life <= 0) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.sparks[w++] = s;
    }
    this.sparks.length = w;
    for (let i = 0; i < this.SPARK_MAX; i++) {
      if (i < w) pos.setXYZ(i, this.sparks[i].x, this.sparks[i].y, 12);
      else pos.setXYZ(i, 0, 0, -1000);
    }
    pos.needsUpdate = true;
  }

  // ---------- HUD (drawn in white, thresholded to 1-bit with the scene) ----------

  drawHud() {
    const blinkOn = Math.floor(this.time * 2) % 2 === 0;
    const key = [
      this.mode, this.score, this.hi, this.lives, this.paused, this.dev && Math.round(this.r.lightAzimuth),
      this.dev && Math.round(this.r.lightElevation), this.bannerTimer > 0 && this.banner, blinkOn,
    ].join('|');
    if (key === this.hudKey && !this.r.hudDirty) return;
    this.hudKey = key;
    this.r.hudDirty = false;

    const c = this.r.hud;
    const w = this.r.pxW, h = this.r.pxH;
    const k = h / 100; // pixels per world unit
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#fff';
    c.textBaseline = 'top';
    const font = (px) => `700 ${Math.round(px)}px "Courier New", ui-monospace, monospace`;
    const text = (s, x, y, px, align = 'left', spacing = 0) => {
      c.font = font(px);
      c.textAlign = align;
      if ('letterSpacing' in c) c.letterSpacing = `${Math.round(spacing)}px`;
      c.fillText(s, x, y);
    };

    if (this.mode === 'title') {
      text('CONTRASTEROIDS', w / 2, h * 0.3, k * 8, 'center', k * 1.2);
      if (blinkOn) text('PRESS ENTER', w / 2, h * 0.47, k * 3.6, 'center', k * 0.5);
      const lines = [
        'LEFT / RIGHT  ROTATE      UP  THRUST',
        'SPACE  FIRE      SHIFT  HYPERSPACE',
        'P  PAUSE      M  MUTE',
      ];
      lines.forEach((l, i) => text(l, w / 2, h * 0.62 + i * k * 4, k * 2.4, 'center'));
      if (this.hi) text(`HIGH SCORE ${this.hi}`, w / 2, h * 0.86, k * 2.6, 'center');
    } else {
      text(String(this.score), k * 3, k * 2.5, k * 4.2);
      text(`HI ${this.hi}`, w / 2, k * 2.5, k * 2.4, 'center');
      for (let i = 0; i < Math.min(this.lives, 10); i++) this.lifeIcon(c, k * (4 + i * 3.4), k * 9.5, k * 1.2);
      if (this.mode === 'gameover') {
        text('GAME OVER', w / 2, h * 0.4, k * 7, 'center', k);
        if (blinkOn) text('PRESS ENTER', w / 2, h * 0.55, k * 3.2, 'center', k * 0.5);
      } else if (this.paused) {
        text('PAUSED', w / 2, h * 0.45, k * 6, 'center', k);
      } else if (this.bannerTimer > 0) {
        text(this.banner, w / 2, h * 0.42, k * 5, 'center', k);
      }
    }
    if (this.dev) {
      text(`LIGHT AZ ${Math.round(this.r.lightAzimuth)}  EL ${Math.round(this.r.lightElevation)}  (J/L I/K)`,
        k * 3, h - k * 5, k * 2.2);
    }
    this.r.hudTexture.needsUpdate = true;
  }

  lifeIcon(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y - s * 1.6);
    c.lineTo(x + s, y + s);
    c.lineTo(x, y + s * 0.5);
    c.lineTo(x - s, y + s);
    c.closePath();
    c.fill();
  }
}

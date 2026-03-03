import { AudioBus } from './audio';
import { getLevelDefs, pickPowerUp, type Brick, type LevelDef } from './levels';
import type { PowerUpKind } from './types';

export type GameStatus = 'MENU' | 'RUNNING' | 'PAUSED' | 'LEVEL_CLEAR' | 'GAME_OVER';

export type EngineSnapshot = {
  level: number;
  lives: number;
  score: number;
  status: GameStatus;
  statusText: string;
  hint?: string;
  activePowerUps: PowerUpKind[];
};

export type EngineOptions = {
  worldW: number;
  worldH: number;
  reducedMotion: boolean;
  highContrast: boolean;
  haptics: boolean;
};

export type InputState = {
  moveAxis: number; // -1..1
  launchPressed: boolean;
  pausePressed: boolean;
  toggleMutePressed: boolean;
  resetPressed: boolean;
  firePressed: boolean;
};

type Ball = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  stuck: boolean;
  fire: boolean;
};

type Paddle = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  laserCooldown: number;
};

type Drop = {
  x: number;
  y: number;
  vy: number;
  kind: PowerUpKind;
  t: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
};

type Laser = {
  x: number;
  y: number;
  vy: number;
  t: number;
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function len(x: number, y: number) {
  return Math.hypot(x, y);
}

function norm(x: number, y: number) {
  const l = len(x, y) || 1;
  return { x: x / l, y: y / l };
}

function rand(seed: number) {
  // mulberry32
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export class BrickBreakerEngine {
  private audio = new AudioBus();
  private opt: EngineOptions;
  private status: GameStatus = 'MENU';

  private lives = 3;
  private score = 0;
  private levelIndex = 0;

  private paddle: Paddle;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private drops: Drop[] = [];
  private particles: Particle[] = [];
  private lasers: Laser[] = [];

  private shield = 0; // seconds
  private active: Map<PowerUpKind, number> = new Map();

  private levels: LevelDef[] = [];
  private seed = 1337;
  private rnd = rand(this.seed);

  constructor(opt: EngineOptions) {
    this.opt = opt;
    this.paddle = {
      x: opt.worldW / 2,
      y: opt.worldH - 42,
      w: 120,
      h: 14,
      vx: 0,
      laserCooldown: 0,
    };
    this.rebuildLevels();
    this.loadLevel(0);
    this.spawnBall(true);
  }

  setAudioEnabled(v: boolean) {
    this.audio.setEnabled(v);
  }

  async unlockAudio() {
    await this.audio.unlock();
  }

  setOptions(p: Partial<EngineOptions>) {
    this.opt = { ...this.opt, ...p };
    this.rebuildLevels();
  }

  private rebuildLevels() {
    this.levels = getLevelDefs(this.opt.worldW);
  }

  private spawnBall(stuck: boolean) {
    const s = 520;
    const dir = norm((this.rnd() - 0.5) * 0.55, -1);
    this.balls.push({
      x: this.paddle.x,
      y: this.paddle.y - 18,
      r: 8,
      vx: dir.x * s,
      vy: dir.y * s,
      stuck,
      fire: this.active.has('FIRE'),
    });
  }

  private loadLevel(i: number) {
    this.levelIndex = i;
    const def = this.levels[i % this.levels.length];
    this.bricks = def.bricks.map((b) => ({ ...b }));
    this.drops = [];
    this.lasers = [];
    this.particles = [];
    this.shield = 0;
    this.active.clear();
    this.paddle.w = 120;
    this.paddle.laserCooldown = 0;
  }

  getLevelPalette() {
    const def = this.levels[this.levelIndex % this.levels.length];
    return def.palette;
  }

  getStateForRender() {
    return {
      status: this.status,
      paddle: this.paddle,
      balls: this.balls,
      bricks: this.bricks,
      drops: this.drops,
      particles: this.particles,
      lasers: this.lasers,
      shield: this.shield,
      active: this.active,
      levelName: this.levels[this.levelIndex % this.levels.length].name,
      level: this.levelIndex + 1,
      lives: this.lives,
      score: this.score,
      worldW: this.opt.worldW,
      worldH: this.opt.worldH,
      highContrast: this.opt.highContrast,
    };
  }

  getSnapshot(): EngineSnapshot {
    const activePowerUps = Array.from(this.active.keys());
    const statusText =
      this.status === 'MENU'
        ? 'לחצו רווח או “התחל”'
        : this.status === 'PAUSED'
          ? 'מושהה'
          : this.status === 'LEVEL_CLEAR'
            ? 'שלב הושלם!'
            : this.status === 'GAME_OVER'
              ? 'נגמרו החיים'
              : 'משחק פעיל';

    const hint =
      this.status === 'MENU'
        ? 'שברו את כל הלבנים כדי לעבור שלב. חיזוקים נופלים — תפסו אותם.'
        : this.status === 'LEVEL_CLEAR'
          ? 'לחצו “התחל” להמשך לשלב הבא.'
          : this.status === 'GAME_OVER'
            ? 'לחצו “אתחל” כדי לנסות שוב.'
            : undefined;

    return {
      level: this.levelIndex + 1,
      lives: this.lives,
      score: this.score,
      status: this.status,
      statusText,
      hint,
      activePowerUps,
    };
  }

  dispatchUi(action: 'start' | 'pause' | 'reset') {
    if (action === 'start') {
      if (this.status === 'MENU' || this.status === 'PAUSED') this.status = 'RUNNING';
      if (this.status === 'LEVEL_CLEAR') {
        this.loadLevel(this.levelIndex + 1);
        this.balls = [];
        this.spawnBall(true);
        this.status = 'RUNNING';
      }
    }
    if (action === 'pause') {
      if (this.status === 'RUNNING') this.status = 'PAUSED';
      else if (this.status === 'PAUSED') this.status = 'RUNNING';
    }
    if (action === 'reset') {
      this.status = 'MENU';
      this.lives = 3;
      this.score = 0;
      this.loadLevel(0);
      this.balls = [];
      this.spawnBall(true);
    }
  }

  update(dt: number, input: InputState) {
    // UI shortcuts
    if (input.resetPressed) this.dispatchUi('reset');
    if (input.toggleMutePressed) {
      // handled outside (settings), but keep safe no-op here
    }
    if (input.pausePressed) this.dispatchUi('pause');

    if (this.status === 'MENU') {
      if (input.launchPressed) this.status = 'RUNNING';
      this.tickParticles(dt);
      this.tickStuckBalls();
      return;
    }

    if (this.status === 'PAUSED') {
      this.tickParticles(dt);
      this.tickStuckBalls();
      return;
    }

    if (this.status === 'LEVEL_CLEAR' || this.status === 'GAME_OVER') {
      this.tickParticles(dt);
      return;
    }

    // RUNNING
    this.tickPowerUps(dt);

    // Paddle
    const accel = 2600;
    const maxV = 820;
    const target = input.moveAxis * maxV;
    const dv = clamp(target - this.paddle.vx, -accel * dt, accel * dt);
    this.paddle.vx += dv;
    this.paddle.x += this.paddle.vx * dt;
    this.paddle.x = clamp(
      this.paddle.x,
      this.paddle.w / 2 + 16,
      this.opt.worldW - this.paddle.w / 2 - 16,
    );

    // Laser fire
    if (this.active.has('LASER')) {
      this.paddle.laserCooldown = Math.max(0, this.paddle.laserCooldown - dt);
      if (input.firePressed && this.paddle.laserCooldown <= 0) {
        this.paddle.laserCooldown = 0.18;
        this.lasers.push({
          x: this.paddle.x - this.paddle.w * 0.33,
          y: this.paddle.y - 8,
          vy: -1200,
          t: 0,
        });
        this.lasers.push({
          x: this.paddle.x + this.paddle.w * 0.33,
          y: this.paddle.y - 8,
          vy: -1200,
          t: 0,
        });
        this.audio.beep('laser');
      }
    }

    // Balls
    if (input.launchPressed) {
      for (const b of this.balls) b.stuck = false;
    }

    for (const b of this.balls) {
      if (b.stuck) {
        b.x = this.paddle.x;
        b.y = this.paddle.y - 18;
        continue;
      }

      const slow = this.active.has('SLOW') ? 0.78 : 1;
      b.x += b.vx * dt * slow;
      b.y += b.vy * dt * slow;

      // Walls
      if (b.x - b.r < 16) {
        b.x = 16 + b.r;
        b.vx = Math.abs(b.vx);
        this.audio.beep('hit');
      }
      if (b.x + b.r > this.opt.worldW - 16) {
        b.x = this.opt.worldW - 16 - b.r;
        b.vx = -Math.abs(b.vx);
        this.audio.beep('hit');
      }
      if (b.y - b.r < 16) {
        b.y = 16 + b.r;
        b.vy = Math.abs(b.vy);
        this.audio.beep('hit');
      }

      // Paddle collision
      const px0 = this.paddle.x - this.paddle.w / 2;
      const px1 = this.paddle.x + this.paddle.w / 2;
      const py0 = this.paddle.y - this.paddle.h / 2;
      const py1 = this.paddle.y + this.paddle.h / 2;
      if (b.y + b.r > py0 && b.y - b.r < py1 && b.x > px0 && b.x < px1 && b.vy > 0) {
        b.y = py0 - b.r;
        const hit = (b.x - this.paddle.x) / (this.paddle.w / 2);
        const angle = clamp(hit, -1, 1) * 1.08;
        const speed = Math.max(520, Math.min(860, len(b.vx, b.vy) * 1.01));
        const dir = norm(angle, -1);
        b.vx = dir.x * speed + this.paddle.vx * 0.12;
        b.vy = dir.y * speed;
        this.audio.beep('hit');
        this.spawnParticles(b.x, b.y + b.r, 8, 280, 0.32);
      }

      // Brick collisions
      for (let i = 0; i < this.bricks.length; i++) {
        const br = this.bricks[i];
        if (br.hp <= 0) continue;
        if (circleRect(b.x, b.y, b.r, br.x, br.y, br.w, br.h)) {
          const cx = clamp(b.x, br.x, br.x + br.w);
          const cy = clamp(b.y, br.y, br.y + br.h);
          const nx = b.x - cx;
          const ny = b.y - cy;
          const n = norm(nx, ny);

          if (!b.fire) {
            const dot = b.vx * n.x + b.vy * n.y;
            b.vx = b.vx - 2 * dot * n.x;
            b.vy = b.vy - 2 * dot * n.y;
          }

          br.hp -= 1;
          this.score += 50;
          this.audio.beep('brick');
          this.spawnParticles(cx, cy, 14, 190, 0.55);

          if (br.hp <= 0 && this.rnd() < br.dropChance) {
            const kind = pickPowerUp(this.rnd);
            this.drops.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, vy: 240, kind, t: 0 });
          }

          if (!b.fire) break; // fire continues
        }
      }

      // Bottom
      if (b.y - b.r > this.opt.worldH + 20) {
        b.vx = 0;
        b.vy = 0;
        b.stuck = true;
      }
    }

    // Remove lost balls
    this.balls = this.balls.filter((b) => !(b.stuck && b.y - b.r > this.opt.worldH));

    // If all balls stuck below, lose life
    const allStuck = this.balls.length === 0 || this.balls.every((b) => b.stuck);
    if (allStuck) {
      this.lives -= 1;
      this.audio.beep('lose');
      if (this.opt.haptics) tryVibrate([40, 30, 40]);

      if (this.lives <= 0) {
        this.status = 'GAME_OVER';
      } else {
        this.balls = [];
        this.spawnBall(true);
        this.status = 'MENU';
      }
    }

    // Drops
    for (const d of this.drops) {
      d.t += dt;
      d.y += d.vy * dt;
      d.vy += 520 * dt;

      if (
        rectRect(
          d.x - 16,
          d.y - 12,
          32,
          24,
          this.paddle.x - this.paddle.w / 2,
          this.paddle.y - 16,
          this.paddle.w,
          32,
        )
      ) {
        this.applyPowerUp(d.kind);
        d.y = this.opt.worldH + 999;
      }
    }
    this.drops = this.drops.filter((d) => d.y < this.opt.worldH + 40);

    // Lasers
    for (const l of this.lasers) {
      l.t += dt;
      l.y += l.vy * dt;
      for (const br of this.bricks) {
        if (br.hp <= 0) continue;
        if (rectRect(l.x - 2, l.y - 12, 4, 24, br.x, br.y, br.w, br.h)) {
          br.hp = Math.max(0, br.hp - 1);
          this.score += 40;
          this.spawnParticles(l.x, l.y, 8, 220, 0.4);
          this.audio.beep('brick');
          l.y = -999;
          break;
        }
      }
    }
    this.lasers = this.lasers.filter((l) => l.y > -40);

    // Shield
    if (this.shield > 0) {
      this.shield = Math.max(0, this.shield - dt);
    }

    // Shield collision for balls
    if (this.shield > 0) {
      const y = this.opt.worldH - 18;
      for (const b of this.balls) {
        if (b.vy > 0 && b.y + b.r > y && b.y - b.r < y + 6) {
          b.y = y - b.r;
          b.vy = -Math.abs(b.vy);
          this.audio.beep('hit');
        }
      }
    }

    // Particles
    this.tickParticles(dt);

    // Level clear
    if (this.bricks.every((b) => b.hp <= 0)) {
      this.status = 'LEVEL_CLEAR';
      this.audio.beep('win');
      this.score += 500;
      if (this.opt.haptics) tryVibrate([30, 40, 30, 60]);
    }
  }

  private applyPowerUp(kind: PowerUpKind) {
    this.audio.beep('power');
    if (this.opt.haptics) tryVibrate(25);
    if (kind === 'WIDE') {
      this.paddle.w = clamp(this.paddle.w + 42, 96, 210);
      this.active.set('WIDE', 12);
      return;
    }
    if (kind === 'MULTI') {
      this.active.set('MULTI', 10);
      this.spawnBall(false);
      this.spawnBall(false);
      return;
    }
    if (kind === 'FIRE') {
      this.active.set('FIRE', 10);
      for (const b of this.balls) b.fire = true;
      return;
    }
    if (kind === 'SLOW') {
      this.active.set('SLOW', 10);
      return;
    }
    if (kind === 'LASER') {
      this.active.set('LASER', 10);
      return;
    }
    if (kind === 'SHIELD') {
      this.shield = 10;
      this.active.set('SHIELD', 10);
      return;
    }
  }

  private tickPowerUps(dt: number) {
    for (const [k, t] of this.active) {
      const nt = t - dt;
      if (nt <= 0) {
        this.active.delete(k);
        if (k === 'FIRE') for (const b of this.balls) b.fire = false;
        if (k === 'WIDE') this.paddle.w = 120;
      } else {
        this.active.set(k, nt);
      }
    }
  }

  private tickParticles(dt: number) {
    const damp = this.opt.reducedMotion ? 0.86 : 0.92;
    for (const p of this.particles) {
      p.life -= dt;
      p.vx *= Math.pow(damp, 60 * dt);
      p.vy *= Math.pow(damp, 60 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 720 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private tickStuckBalls() {
    for (const b of this.balls) {
      if (b.stuck) {
        b.x = this.paddle.x;
        b.y = this.paddle.y - 18;
      }
    }
  }

  private spawnParticles(x: number, y: number, n: number, speed: number, life: number) {
    if (this.opt.reducedMotion) n = Math.floor(n * 0.55);
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const s = speed * (0.25 + this.rnd());
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 80,
        life: life * (0.7 + this.rnd() * 0.7),
        max: life,
        size: 2 + this.rnd() * 3,
        hue: 180 + this.rnd() * 120,
      });
    }
  }
}

function rectRect(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleRect(
  cx: number,
  cy: number,
  cr: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
) {
  const x = clamp(cx, rx, rx + rw);
  const y = clamp(cy, ry, ry + rh);
  const dx = cx - x;
  const dy = cy - y;
  return dx * dx + dy * dy <= cr * cr;
}

function tryVibrate(pattern: number | number[]) {
  const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  if (typeof nav?.vibrate === 'function') {
    try {
      nav.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

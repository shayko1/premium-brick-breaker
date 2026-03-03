import { useEffect, useMemo, useRef } from 'react';
import type { Settings } from '../game/settings';
import { BrickBreakerEngine, type InputState } from '../game/engine';
import type { GameSnapshot } from '../game/types';

const WORLD = { w: 980, h: 640 };

function powerUpLabel(k: string) {
  switch (k) {
    case 'WIDE':
      return 'רחב';
    case 'MULTI':
      return 'רב־כדור';
    case 'FIRE':
      return 'אש';
    case 'SLOW':
      return 'איטי';
    case 'LASER':
      return 'לייזר';
    case 'SHIELD':
      return 'מגן';
    default:
      return k;
  }
}

export function GameCanvas({
  settings,
  onSnapshot,
}: {
  settings: Settings;
  onSnapshot: (s: GameSnapshot) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BrickBreakerEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  const inputRef = useRef({
    left: false,
    right: false,
    axis: 0,
    launchQueued: false,
    fireQueued: false,
    pauseQueued: false,
    resetQueued: false,
    toggleMuteQueued: false,
    touchAxis: 0,
  });

  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // HiDPI
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(WORLD.w * dpr);
    canvas.height = Math.floor(WORLD.h * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const engine = new BrickBreakerEngine({
      worldW: WORLD.w,
      worldH: WORLD.h,
      reducedMotion,
      highContrast: settings.highContrast,
      haptics: settings.haptics,
    });
    engine.setAudioEnabled(settings.soundEnabled);
    engineRef.current = engine;

    const onStart = async () => {
      await engine.unlockAudio();
      engine.dispatchUi('start');
    };
    const onPause = async () => {
      await engine.unlockAudio();
      engine.dispatchUi('pause');
    };
    const onReset = async () => {
      await engine.unlockAudio();
      engine.dispatchUi('reset');
    };

    const startListener = () => void onStart();
    const pauseListener = () => void onPause();
    const resetListener = () => void onReset();

    window.addEventListener('pbb:start', startListener as EventListener);
    window.addEventListener('pbb:pause', pauseListener as EventListener);
    window.addEventListener('pbb:reset', resetListener as EventListener);

    const onKeyDown = (e: KeyboardEvent) => {
      const s = inputRef.current;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') s.left = true;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') s.right = true;
      if (e.key === ' ' || e.key === 'Enter') {
        s.launchQueued = true;
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'p') s.pauseQueued = true;
      if (e.key.toLowerCase() === 'r') s.resetQueued = true;
      if (e.key.toLowerCase() === 'm') s.toggleMuteQueued = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const s = inputRef.current;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') s.left = false;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') s.right = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onPointer = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.('[data-touch]') as HTMLElement | null;
      if (!t) return;
      const rect = t.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const axis = (nx - 0.5) * 2;
      if (t.dataset.touch === 'move') {
        inputRef.current.touchAxis = Math.max(-1, Math.min(1, axis));
      } else {
        inputRef.current.launchQueued = true;
        inputRef.current.pauseQueued = true;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.('[data-touch]') as HTMLElement | null;
      if (!t) return;
      if (t.dataset.touch === 'move') inputRef.current.touchAxis = 0;
    };

    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('pointermove', onPointer);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    lastRef.current = performance.now();

    const tick = (ts: number) => {
      const dt = Math.min(0.033, Math.max(0.001, (ts - lastRef.current) / 1000));
      lastRef.current = ts;

      // resolve inputs
      const s = inputRef.current;
      const axis = (s.right ? 1 : 0) - (s.left ? 1 : 0);
      s.axis = axis !== 0 ? axis : s.touchAxis;

      const input: InputState = {
        moveAxis: s.axis,
        launchPressed: s.launchQueued,
        pausePressed: s.pauseQueued,
        toggleMutePressed: s.toggleMuteQueued,
        resetPressed: s.resetQueued,
        firePressed: s.fireQueued || s.launchQueued, // treat space as fire for lasers
      };

      // consume queued
      s.launchQueued = false;
      s.fireQueued = false;
      s.pauseQueued = false;
      s.resetQueued = false;
      s.toggleMuteQueued = false;

      engine.update(dt, input);

      const snap = engine.getSnapshot();
      onSnapshot({
        level: snap.level,
        lives: snap.lives,
        score: snap.score,
        statusText: snap.statusText,
        hint: snap.hint,
        activePowerUps: snap.activePowerUps.map(powerUpLabel),
      });

      render(ctx, engine);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('pbb:start', startListener as EventListener);
      window.removeEventListener('pbb:pause', pauseListener as EventListener);
      window.removeEventListener('pbb:reset', resetListener as EventListener);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onSnapshot, reducedMotion, settings.highContrast, settings.haptics, settings.soundEnabled]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setAudioEnabled(settings.soundEnabled);
    engine.setOptions({ highContrast: settings.highContrast, haptics: settings.haptics });
  }, [settings.soundEnabled, settings.highContrast, settings.haptics]);

  return <canvas ref={canvasRef} aria-label="משחק שובר לבנים" role="img" />;
}

function render(ctx: CanvasRenderingContext2D, engine: BrickBreakerEngine) {
  const st = engine.getStateForRender();
  const { worldW: W, worldH: H } = st;
  const pal = engine.getLevelPalette();

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, pal.bgA);
  bg.addColorStop(1, pal.bgB);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // subtle grid
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // glow
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = pal.glow;
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = 80;
  ctx.beginPath();
  ctx.arc(W * 0.2, H * 0.1, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Top HUD
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.font = '700 14px Rubik, system-ui';
  ctx.fillText(`שלב ${st.level}: ${st.levelName}`, 18, 28);
  ctx.font = '500 13px Rubik, system-ui';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(`ניקוד: ${st.score}  ·  חיים: ${st.lives}`, 18, 48);
  ctx.restore();

  // Shield
  if (st.shield > 0) {
    ctx.save();
    const y = H - 18;
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = st.highContrast ? '#ffffff' : 'rgba(46,229,157,0.85)';
    ctx.lineWidth = 3;
    ctx.shadowColor = st.highContrast ? '#ffffff' : 'rgba(46,229,157,0.85)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(W - 16, y);
    ctx.stroke();
    ctx.restore();
  }

  // Bricks
  for (const b of st.bricks) {
    if (b.hp <= 0) continue;
    const t = b.hp / b.maxHp;
    ctx.save();
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    if (st.highContrast) {
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0.55)');
    } else {
      g.addColorStop(0, b.colorA);
      g.addColorStop(1, b.colorB);
    }

    ctx.fillStyle = g;
    roundRect(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fill();

    // inner highlight
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    roundRect(ctx, b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3, 9);
    ctx.stroke();

    // hp bar
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(b.x + 8, b.y + b.h - 6, b.w - 16, 3);
    ctx.fillStyle = st.highContrast ? '#000' : 'rgba(255,255,255,0.9)';
    ctx.fillRect(b.x + 8, b.y + b.h - 6, (b.w - 16) * t, 3);

    ctx.restore();
  }

  // Drops
  for (const d of st.drops) {
    ctx.save();
    const pulse = 0.6 + Math.sin(d.t * 6) * 0.18;
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = 'rgba(124,92,255,0.75)';
    ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, d.x - 18, d.y - 12, 36, 24, 10);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '800 12px Rubik, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon =
      d.kind === 'WIDE'
        ? '↔'
        : d.kind === 'MULTI'
          ? '●●'
          : d.kind === 'FIRE'
            ? '🔥'
            : d.kind === 'SLOW'
              ? '⏳'
              : d.kind === 'LASER'
                ? '✦'
                : '▭';
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.scale(pulse, pulse);
    ctx.fillText(icon, 0, 0);
    ctx.restore();
    ctx.restore();
  }

  // Paddle
  ctx.save();
  const p = st.paddle;
  ctx.shadowColor = st.highContrast ? '#fff' : pal.glow;
  ctx.shadowBlur = 18;
  const pg = ctx.createLinearGradient(p.x - p.w / 2, p.y, p.x + p.w / 2, p.y);
  if (st.highContrast) {
    pg.addColorStop(0, 'rgba(255,255,255,0.95)');
    pg.addColorStop(1, 'rgba(255,255,255,0.7)');
  } else {
    pg.addColorStop(0, 'rgba(124,92,255,0.95)');
    pg.addColorStop(1, 'rgba(33,212,253,0.85)');
  }
  ctx.fillStyle = pg;
  roundRect(ctx, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 10);
  ctx.fill();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  roundRect(ctx, p.x - p.w / 2 + 6, p.y - p.h / 2 + 3, p.w - 12, p.h / 2 - 1, 9);
  ctx.fill();
  ctx.restore();

  // Lasers
  for (const l of st.lasers) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = st.highContrast ? '#ffffff' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.shadowColor = st.highContrast ? '#ffffff' : pal.glow;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y - 12);
    ctx.lineTo(l.x, l.y + 12);
    ctx.stroke();
    ctx.restore();
  }

  // Balls
  for (const b of st.balls) {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = b.fire ? 'rgba(255,92,122,0.9)' : 'rgba(255,255,255,0.72)';
    const bg2 = ctx.createRadialGradient(b.x - 2, b.y - 3, 2, b.x, b.y, b.r * 2.1);
    bg2.addColorStop(0, 'rgba(255,255,255,0.98)');
    bg2.addColorStop(1, b.fire ? 'rgba(255,92,122,0.85)' : 'rgba(124,92,255,0.75)');
    ctx.fillStyle = st.highContrast ? '#fff' : bg2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Particles
  for (const p2 of st.particles) {
    const t = Math.max(0, p2.life / p2.max);
    ctx.save();
    ctx.globalAlpha = 0.8 * t;
    ctx.fillStyle = st.highContrast ? '#fff' : `hsl(${p2.hue} 80% 70%)`;
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, p2.size * (0.5 + t), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // status overlay
  if (st.status !== 'RUNNING') {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '800 28px Rubik, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      st.status === 'PAUSED'
        ? 'מושהה'
        : st.status === 'GAME_OVER'
          ? 'משחק נגמר'
          : st.status === 'LEVEL_CLEAR'
            ? 'שלב הושלם'
            : 'מוכנים?',
      W / 2,
      H / 2 - 20,
    );
    ctx.font = '500 14px Rubik, system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fillText('רווח/Enter להתחלה · P להפסקה · R לאתחול', W / 2, H / 2 + 18);
    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

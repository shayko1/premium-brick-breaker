import type { PowerUpKind } from './types';

export type Brick = {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  colorA: string;
  colorB: string;
  dropChance: number;
};

export type LevelDef = {
  id: number;
  name: string;
  bricks: Brick[];
  palette: {
    bgA: string;
    bgB: string;
    glow: string;
  };
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${h} ${s}% ${l}%)`;
}

function makeGrid(
  startX: number,
  startY: number,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
  gap: number,
  hpFn: (cx: number, cy: number) => number,
  hueA: number,
  hueB: number,
): Brick[] {
  const bricks: Brick[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const hp = hpFn(x, y);
      if (hp <= 0) continue;
      const t = (x / Math.max(1, cols - 1)) * 0.75 + (y / Math.max(1, rows - 1)) * 0.25;
      const hue = lerp(hueA, hueB, t);
      const sat = clamp(60 + y * 2, 55, 78);
      const lumA = clamp(52 - y * 2, 28, 56);
      const lumB = clamp(68 - y * 2, 34, 70);
      bricks.push({
        x: startX + x * (cellW + gap),
        y: startY + y * (cellH + gap),
        w: cellW,
        h: cellH,
        hp,
        maxHp: hp,
        colorA: hsl(hue, sat, lumA),
        colorB: hsl(hue + 16, sat, lumB),
        dropChance: 0.16,
      });
    }
  }
  return bricks;
}

export function getLevelDefs(worldW: number): LevelDef[] {
  const margin = 28;
  const cols = worldW < 900 ? 9 : 11;
  const cellW = Math.floor((worldW - margin * 2 - (cols - 1) * 10) / cols);
  const cellH = 22;
  const startX = Math.floor((worldW - (cols * cellW + (cols - 1) * 10)) / 2);
  const startY = 94;

  const l1: LevelDef = {
    id: 1,
    name: 'מסלול כניסה',
    palette: { bgA: '#0b1020', bgB: '#121a34', glow: '#7c5cff' },
    bricks: makeGrid(
      startX,
      startY,
      cols,
      5,
      cellW,
      cellH,
      10,
      (_x, y) => (y === 0 ? 2 : 1),
      265,
      190,
    ),
  };

  const l2: LevelDef = {
    id: 2,
    name: 'גלים אלקטריים',
    palette: { bgA: '#091022', bgB: '#07121f', glow: '#21d4fd' },
    bricks: makeGrid(
      startX,
      startY,
      cols,
      6,
      cellW,
      cellH,
      10,
      (x, y) => ((x + y) % 2 === 0 ? 2 : 1),
      190,
      140,
    ),
  };

  const l3: LevelDef = {
    id: 3,
    name: 'קשת קשיחה',
    palette: { bgA: '#0a0c14', bgB: '#121224', glow: '#2ee59d' },
    bricks: makeGrid(
      startX,
      startY,
      cols,
      7,
      cellW,
      cellH,
      10,
      (x, y) => {
        const mid = (cols - 1) / 2;
        const d = Math.abs(x - mid);
        return d < 1.2 && y < 2 ? 3 : y > 4 && d > mid - 1 ? 0 : 2;
      },
      150,
      320,
    ).map((b, i) => ({ ...b, dropChance: i % 4 === 0 ? 0.28 : 0.18 })),
  };

  return [l1, l2, l3];
}

export function pickPowerUp(rnd: () => number): PowerUpKind {
  const items: Array<{ k: PowerUpKind; w: number }> = [
    { k: 'WIDE', w: 20 },
    { k: 'MULTI', w: 16 },
    { k: 'FIRE', w: 14 },
    { k: 'SLOW', w: 16 },
    { k: 'LASER', w: 12 },
    { k: 'SHIELD', w: 12 },
  ];
  const sum = items.reduce((a, b) => a + b.w, 0);
  let t = rnd() * sum;
  for (const it of items) {
    t -= it.w;
    if (t <= 0) return it.k;
  }
  return 'WIDE';
}

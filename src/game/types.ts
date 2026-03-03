export type PowerUpKind = 'WIDE' | 'MULTI' | 'FIRE' | 'SLOW' | 'LASER' | 'SHIELD';

export type GameSnapshot = {
  level: number;
  lives: number;
  score: number;
  statusText: string;
  hint?: string;
  activePowerUps: string[];
};

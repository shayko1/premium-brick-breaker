export type Grade = 'S' | 'A' | 'B' | 'C';

export function gradeForScore(score: number): Grade {
  if (score >= 4200) return 'S';
  if (score >= 3000) return 'A';
  if (score >= 2000) return 'B';
  return 'C';
}

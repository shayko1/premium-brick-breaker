import { pickPowerUp } from '../levels';

describe('pickPowerUp', () => {
  it('returns a valid power-up', () => {
    const rnd = () => 0.5;
    const k = pickPowerUp(rnd);
    expect(['WIDE', 'MULTI', 'FIRE', 'SLOW', 'LASER', 'SHIELD']).toContain(k);
  });
});

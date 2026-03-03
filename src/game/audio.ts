// Tiny synth audio (no external assets). Uses WebAudio.

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  setEnabled(v: boolean) {
    this.enabled = v;
    if (this.master) this.master.gain.value = v ? 0.9 : 0.0;
  }

  async ensure() {
    if (this.ctx) return;
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0.0;
    this.master.connect(this.ctx.destination);
  }

  async unlock() {
    await this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        // ignore
      }
    }
  }

  beep(type: 'hit' | 'brick' | 'power' | 'lose' | 'win' | 'laser') {
    if (!this.enabled) return;
    if (!this.ctx || !this.master) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const cfg: Record<typeof type, { f0: number; f1: number; dur: number; wave: OscillatorType }> =
      {
        hit: { f0: 520, f1: 380, dur: 0.055, wave: 'triangle' },
        brick: { f0: 720, f1: 460, dur: 0.08, wave: 'square' },
        power: { f0: 420, f1: 840, dur: 0.12, wave: 'sine' },
        lose: { f0: 220, f1: 130, dur: 0.22, wave: 'sawtooth' },
        win: { f0: 500, f1: 980, dur: 0.26, wave: 'triangle' },
        laser: { f0: 980, f1: 620, dur: 0.06, wave: 'square' },
      };

    const c = cfg[type];
    osc.type = c.wave;
    osc.frequency.setValueAtTime(c.f0, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, c.f1), now + c.dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + c.dur);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(now);
    osc.stop(now + c.dur + 0.02);
  }
}

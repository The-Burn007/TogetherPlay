/**
 * Minimal Web Audio Synthesizer for Speed Duel
 * Generates tactile, zero-latency acoustic tension cues without external asset dependencies.
 */

class SpeedDuelAudioEngine {
  private ctx: AudioContext | null = null;
  private tensionOscillator: OscillatorNode | null = null;
  private tensionGain: GainNode | null = null;
  private isMuted = false;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopTensionDrone();
    }
  }

  /**
   * Crisp numeric countdown tick
   */
  playCountdownTick(isFinal = false) {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, ctx.currentTime);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isFinal ? 0.25 : 0.12));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + (isFinal ? 0.25 : 0.12));
  }

  /**
   * Tension drone: A subtle low-frequency oscillation (110Hz - 130Hz) that builds suspense
   */
  startTensionDrone() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.stopTensionDrone();

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(110, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 3.0);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      this.tensionOscillator = osc;
      this.tensionGain = gain;
    } catch {
      // Ignored if audio context is blocked
    }
  }

  stopTensionDrone() {
    if (this.tensionGain && this.ctx) {
      try {
        this.tensionGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);
      } catch {
        // Safe ignore
      }
    }
    if (this.tensionOscillator) {
      try {
        this.tensionOscillator.stop(this.ctx ? this.ctx.currentTime + 0.05 : 0);
        this.tensionOscillator.disconnect();
      } catch {
        // Safe ignore
      }
      this.tensionOscillator = null;
    }
    this.tensionGain = null;
  }

  /**
   * Target Trigger: Sudden explosive frequency spike signaling the target is active!
   */
  playTargetTrigger() {
    this.stopTensionDrone();
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  }

  /**
   * Victorius round response chime
   */
  playRoundWinner() {
    this.stopTensionDrone();
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [587.33, 739.99, 880.0]; // D5, F#5, A5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.05);

      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.05);
      osc.stop(ctx.currentTime + idx * 0.05 + 0.4);
    });
  }

  /**
   * False start dissonance buzz
   */
  playFalseStart() {
    this.stopTensionDrone();
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, ctx.currentTime);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  /**
   * Clean transition click
   */
  playTransition() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, ctx.currentTime);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }
}

export const speedDuelAudio = new SpeedDuelAudioEngine();

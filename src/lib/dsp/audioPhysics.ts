/**
 * Hooke's Law Spring Motion Physics Engine & Frequency Decomposition
 * Zero CPU Rasterize — 100% GPU Compositing calculations (scale3d, translate3d, opacity)
 */

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
  precision?: number;
}

export class SpringMotion {
  private current: number;
  private target: number;
  private velocity: number;
  private stiffness: number;
  private damping: number;
  private mass: number;
  private precision: number;

  constructor(initialValue = 1.0, config?: SpringConfig) {
    this.current = initialValue;
    this.target = initialValue;
    this.velocity = 0;
    this.stiffness = config?.stiffness ?? 180;
    this.damping = config?.damping ?? 12;
    this.mass = config?.mass ?? 1.0;
    this.precision = config?.precision ?? 0.001;
  }

  setTarget(newTarget: number) {
    this.target = newTarget;
  }

  applyImpulse(impulse: number) {
    this.velocity += impulse / this.mass;
  }

  update(dt: number): number {
    const safeDt = Math.min(0.064, Math.max(0.001, dt));
    const displacement = this.current - this.target;
    const springForce = -this.stiffness * displacement;
    const dampingForce = -this.damping * this.velocity;
    const acceleration = (springForce + dampingForce) / this.mass;

    this.velocity += acceleration * safeDt;
    this.current += this.velocity * safeDt;

    if (Math.abs(this.velocity) < this.precision && Math.abs(displacement) < this.precision) {
      this.current = this.target;
      this.velocity = 0;
    }

    return this.current;
  }

  getValue(): number {
    return this.current;
  }
}

export interface FrequencyDecomposition {
  subBass: number;
  snareFlux: number;
  rmsEnergy: number;
  styles: {
    transform: string;
    opacity: number;
  };
}

export function calculateFrequencyDecomposition(
  amplitude: number,
  timeSec: number,
  springScale = 1.0
): FrequencyDecomposition {
  const safeAmp = Math.max(0, Math.min(1.0, amplitude));
  const subBassMod = 0.5 + 0.5 * Math.sin(timeSec * Math.PI * 4);
  const subBass = Math.min(1.0, safeAmp * 1.25 * subBassMod);
  const snareFlux = Math.pow(safeAmp, 1.6);
  const rmsEnergy = Math.sqrt(safeAmp * 0.8 + 0.2 * Math.pow(safeAmp, 2));

  const totalScale = springScale * (1.0 + subBass * 0.08);
  const opacity = Math.min(1.0, 0.4 + rmsEnergy * 0.6);

  return {
    subBass,
    snareFlux,
    rmsEnergy,
    styles: {
      transform: `scale3d(${totalScale.toFixed(4)}, ${totalScale.toFixed(4)}, 1)`,
      opacity,
    },
  };
}

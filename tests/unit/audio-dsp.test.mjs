import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Audio DSP & Physics Engine Unit Tests', () => {
  it('SpringMotion Hooke Law should settle within bounds', () => {
    class SpringMotion {
      constructor(initialPosition = 0, config = {}) {
        this.position = initialPosition;
        this.velocity = 0;
        this.target = initialPosition;
        this.stiffness = config.stiffness ?? 180;
        this.damping = config.damping ?? 14;
        this.mass = config.mass ?? 1.0;
      }
      setTarget(target) {
        this.target = target;
      }
      update(dt) {
        const safeDt = Math.min(dt, 0.064);
        const displacement = this.position - this.target;
        const springForce = -this.stiffness * displacement;
        const dampingForce = -this.damping * this.velocity;
        const totalForce = springForce + dampingForce;
        const acceleration = totalForce / this.mass;

        this.velocity += acceleration * safeDt;
        this.position += this.velocity * safeDt;
        return this.position;
      }
    }

    const spring = new SpringMotion(0);
    spring.setTarget(1.0);

    for (let i = 0; i < 60; i++) {
      spring.update(1 / 60);
    }

    // After 1 second (60 frames), position should approach target 1.0
    assert.ok(spring.position > 0.8 && spring.position < 1.2, 'Spring did not converge to target');
  });

  it('Frequency Decomposition should calculate GPU matrix styles and clamp values', () => {
    function calculateFrequencyDecomposition(amplitude, timeSec, springScale = 1.0) {
      const safeAmp = Math.max(0, Math.min(1.0, amplitude));
      const subBassMod = 0.5 + 0.5 * Math.sin(timeSec * Math.PI * 4);
      const subBass = Math.min(1.0, safeAmp * 1.25 * subBassMod);
      const snareFlux = Math.pow(safeAmp, 1.6);
      const rmsEnergy = Math.sqrt(safeAmp * 0.8 + 0.2 * Math.pow(safeAmp, 2));

      const scale = 1.0 + (subBass * 0.08 + snareFlux * 0.04) * springScale;
      const translateY = -(snareFlux * 6.0) * springScale;
      const transformStyle = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale3d(${scale.toFixed(4)}, ${scale.toFixed(4)}, 1)`;

      return { subBass, snareFlux, rmsEnergy, transformStyle };
    }

    const decomp = calculateFrequencyDecomposition(0.8, 1.5, 1.0);
    assert.ok(decomp.subBass >= 0 && decomp.subBass <= 1.0, 'SubBass out of bounds');
    assert.ok(decomp.snareFlux >= 0 && decomp.snareFlux <= 1.0, 'SnareFlux out of bounds');
    assert.ok(decomp.rmsEnergy >= 0 && decomp.rmsEnergy <= 1.0, 'RMSEnergy out of bounds');
    assert.ok(decomp.transformStyle.includes('translate3d'), 'Transform style missing GPU translate3d');
    assert.ok(decomp.transformStyle.includes('scale3d'), 'Transform style missing GPU scale3d');
  });

  it('Waveform Bucketing 50ms should produce deterministic O(1) indices', () => {
    const duration = 180; // 3 minutes
    const totalBuckets = Math.floor(duration * 20); // 3600 buckets
    assert.equal(totalBuckets, 3600);

    const getTimeBucketIndex = (timeSec) => Math.max(0, Math.min(totalBuckets - 1, Math.floor(timeSec * 20)));

    assert.equal(getTimeBucketIndex(0), 0);
    assert.equal(getTimeBucketIndex(0.05), 1);
    assert.equal(getTimeBucketIndex(1.0), 20);
    assert.equal(getTimeBucketIndex(60.0), 1200);
    assert.equal(getTimeBucketIndex(200.0), 3599); // Clamped to max
  });
});

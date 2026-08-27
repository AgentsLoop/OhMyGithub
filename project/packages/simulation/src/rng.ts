/**
 * Deterministic PRNG — xorshift32. Seedable, no Math.random.
 * Used for reproducible simulation given same seed + command sequence.
 */
export class DeterministicRng {
  private state: number;

  constructor(seed: number) {
    // avoid zero state
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  nextUint32(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  nextFloat(): number {
    // [0,1)
    return this.nextUint32() / 0xffffffff;
  }

  nextInt(min: number, max: number): number {
    // inclusive min, exclusive max
    return min + Math.floor(this.nextFloat() * (max - min));
  }

  fork(): DeterministicRng {
    return new DeterministicRng(this.nextUint32());
  }
}

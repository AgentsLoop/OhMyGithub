import { TICK_DT_MS } from "@rts/contracts";
import type { Tick } from "@rts/contracts";

/**
 * Fixed-timestep accumulator — pure logic, no Date.now.
 * Simulation advances by exactly TICK_DT_MS per tick.
 */
export class FixedClock {
  private tickNum: number = 0;
  private accumulatorMs: number = 0;

  get tick(): Tick {
    return this.tickNum as Tick;
  }

  get timeMs(): number {
    return this.tickNum * TICK_DT_MS;
  }

  /**
   * Accumulate wall dt and return how many ticks should be stepped.
   */
  consume(dtMs: number): number {
    this.accumulatorMs += dtMs;
    let steps = 0;
    while (this.accumulatorMs >= TICK_DT_MS) {
      this.accumulatorMs -= TICK_DT_MS;
      steps++;
    }
    return steps;
  }

  advanceOneTick(): void {
    this.tickNum += 1;
  }

  reset(): void {
    this.tickNum = 0;
    this.accumulatorMs = 0;
  }
}

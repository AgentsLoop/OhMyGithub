/**
 * Pure game logic for GLB Relic Escape.
 * Keeps state independent of Three.js for unit testing.
 */
export class GameState {
  constructor({ timeLimit = 50, maxHealth = 3 } = {}) {
    this.timeLimit = timeLimit;
    this.maxHealth = maxHealth;
    this.reset();
  }

  reset() {
    this.timeLeft = this.timeLimit;
    this.elapsed = 0;
    this.hasRelic = false;
    this.health = this.maxHealth;
    this.status = 'playing'; // playing | won | lost
    this.cause = ''; // time | health | win
    this.score = 0;
  }

  isPlaying() { return this.status === 'playing'; }
  isWon() { return this.status === 'won'; }
  isLost() { return this.status === 'lost'; }

  update(dt) {
    if (!this.isPlaying()) return;
    this.timeLeft -= dt;
    this.elapsed += dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.status = 'lost';
      this.cause = 'time';
    }
  }

  collectRelic() {
    if (!this.isPlaying() || this.hasRelic) return false;
    this.hasRelic = true;
    this.score += 100;
    return true;
  }

  takeDamage(amount = 1) {
    if (!this.isPlaying()) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.status = 'lost';
      this.cause = 'health';
      return true;
    }
    return false;
  }

  heal(amount = 1) {
    if (!this.isPlaying()) return false;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return true;
  }

  reachExit() {
    if (!this.isPlaying()) return false;
    if (!this.hasRelic) return false;
    this.status = 'won';
    this.cause = 'win';
    // time bonus
    this.score += Math.ceil(this.timeLeft * 2);
    return true;
  }

  // helpers for distance checks
  canCollect(distance, radius = 1.4) {
    return distance < radius && this.isPlaying() && !this.hasRelic;
  }
  canExit(distance, radius = 1.6) {
    return distance < radius && this.isPlaying() && this.hasRelic;
  }
  isHazardHit(distance, radius = 1.0) {
    return distance < radius;
  }
}

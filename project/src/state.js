import { PLAYER, WEAPON, WAVES } from './constants.js'

function clone(v) { return JSON.parse(JSON.stringify(v)) }

export function createInitialState() {
  return {
    phase: 'title', // title | playing | dead | won
    health: PLAYER.maxHealth,
    maxHealth: PLAYER.maxHealth,
    ammo: WEAPON.magSize,
    reserve: WEAPON.reserveAmmo,
    magSize: WEAPON.magSize,
    isReloading: false,
    reloadProgress: 0,
    score: 0,
    kills: 0,
    waveIndex: 0,
    wavesTotal: WAVES.length,
    enemiesAlive: 0,
    enemiesKilledWave: 0,
    time: 0,
    damageFlash: 0,
    hitMarker: 0,
    tookDamage: false,
    firedShot: false,
    reloaded: false,
    objectiveDone: false,
    sprinting: false,
    onGround: true,
    position: { x: 0, y: PLAYER.eyeHeight, z: 14 },
    yaw: 0,
    pitch: 0,
  }
}

export class GameState {
  constructor() {
    this.state = createInitialState()
    this._listeners = new Map()
    this._lastDamage = -999
  }

  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set())
    this._listeners.get(event).add(cb)
    return () => this._listeners.get(event).delete(cb)
  }

  emit(event, data) {
    const set = this._listeners.get(event)
    if (set) for (const fn of set) try { fn(data) } catch {}
  }

  get() { return this.state }

  reset() {
    this.state = createInitialState()
    this._lastDamage = -999
    this.emit('game:restart', clone(this.state))
  }

  startMission() {
    if (this.state.phase === 'playing') return
    this.state.phase = 'playing'
    this.state.health = PLAYER.maxHealth
    this.state.ammo = WEAPON.magSize
    this.state.reserve = WEAPON.reserveAmmo
    this.state.score = 0
    this.state.kills = 0
    this.state.waveIndex = 0
    this.state.isReloading = false
    this.emit('game:start', clone(this.state))
  }

  // deterministic helpers for tests / runtime checks
  canShoot(time) {
    // fire rate handled outside, but check ammo/reload
    return this.state.phase === 'playing' && this.state.ammo > 0 && !this.state.isReloading
  }

  shoot(time) {
    if (!this.canShoot(time)) return false
    this.state.ammo -= 1
    this.state.firedShot = true
    this.emit('player:shoot', { ammo: this.state.ammo, reserve: this.state.reserve })
    return true
  }

  beginReload(time) {
    if (this.state.isReloading) return false
    if (this.state.phase !== 'playing') return false
    if (this.state.ammo === this.state.magSize) return false
    if (this.state.reserve <= 0) return false
    this.state.isReloading = true
    this.state.reloadProgress = 0
    this.emit('player:reload', {})
    return true
  }

  completeReload() {
    if (!this.state.isReloading) return false
    const need = this.state.magSize - this.state.ammo
    const take = Math.min(need, this.state.reserve)
    this.state.ammo += take
    this.state.reserve -= take
    this.state.isReloading = false
    this.state.reloadProgress = 0
    this.state.reloaded = true
    this.emit('player:reloadComplete', { ammo: this.state.ammo, reserve: this.state.reserve })
    return true
  }

  cancelReload() {
    this.state.isReloading = false
    this.state.reloadProgress = 0
  }

  takeDamage(amount, time) {
    if (this.state.phase !== 'playing') return false
    if (time - this._lastDamage < PLAYER.damageCooldown) return false
    this._lastDamage = time
    this.state.health = Math.max(0, this.state.health - amount)
    this.state.damageFlash = 1
    this.state.tookDamage = true
    this.emit('player:damage', { health: this.state.health, amount })
    if (this.state.health <= 0) {
      this.state.phase = 'dead'
      this.emit('player:death', {})
    }
    return true
  }

  addKill(kind, headshot = false) {
    this.state.kills += 1
    this.state.enemiesAlive = Math.max(0, this.state.enemiesAlive - 1)
    this.state.enemiesKilledWave += 1
    let pts = kind === 'drone' ? 150 : 100
    if (headshot) pts += 50
    this.state.score += pts
    this.state.hitMarker = 1
    this.emit('enemy:kill', { kind, headshot, score: this.state.score })
  }

  registerWaveAlive(count) {
    this.state.enemiesAlive = count
    this.state.enemiesKilledWave = 0
  }

  tryAdvanceWave() {
    if (this.state.enemiesAlive > 0) return false
    // wave cleared
    const bonus = 500 + this.state.waveIndex * 100
    this.state.score += bonus
    this.emit('wave:complete', { wave: this.state.waveIndex + 1 })
    if (this.state.waveIndex >= this.state.wavesTotal - 1) {
      this.state.phase = 'won'
      this.state.objectiveDone = true
      this.emit('game:win', { score: this.state.score })
      return true
    }
    this.state.waveIndex += 1
    return true
  }

  heal(amount) {
    this.state.health = Math.min(this.state.maxHealth, this.state.health + amount)
  }

  // For HUD / text rendering
  toText() {
    const s = this.state
    const wave = WAVES[s.waveIndex] || WAVES[WAVES.length - 1]
    const lines = []
    lines.push(`=== ${this.state.phase.toUpperCase()} === FRONTIER OPS ===`)
    lines.push(`Mission: ${wave.objective} | Wave ${s.waveIndex + 1}/${s.wavesTotal}`)
    lines.push(`Health: ${s.health}/${s.maxHealth} ${s.health <= 30 ? '(CRITICAL)' : ''}`)
    lines.push(`Ammo: ${s.ammo}/${s.magSize} | Reserve: ${s.reserve} ${s.isReloading ? '[RELOADING]' : ''}`)
    lines.push(`Score: ${s.score} | Kills: ${s.kills} | Enemies: ${s.enemiesAlive}`)
    lines.push(`Pos: (${s.position.x.toFixed(1)}, ${s.position.z.toFixed(1)}) Yaw:${(s.yaw*57.3).toFixed(0)}`)
    lines.push(`Flags: fired=${s.firedShot} reloaded=${s.reloaded} damaged=${s.tookDamage} won=${s.objectiveDone}`)
    if (s.phase === 'dead') lines.push('STATUS: KIA — Press R / Restart')
    if (s.phase === 'won') lines.push('STATUS: MISSION COMPLETE')
    if (s.phase === 'title') lines.push('STATUS: PRESS START — Training Arena')
    return lines.join('\n')
  }
}

// global singleton for game
export const gameState = new GameState()

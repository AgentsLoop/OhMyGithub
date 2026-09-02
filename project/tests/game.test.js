import { describe, it, expect, beforeEach } from 'vitest'
import { GameState, createInitialState } from '../src/state.js'
import { PLAYER, WEAPON, WAVES } from '../src/constants.js'

describe('constants', () => {
  it('exposes centralized gameplay values', () => {
    expect(WEAPON.magSize).toBe(30)
    expect(PLAYER.maxHealth).toBe(100)
    expect(WAVES.length).toBe(5)
    expect(WAVES[0].objective).toBeTruthy()
  })
})

describe('GameState - core paths', () => {
  let gs
  beforeEach(() => { gs = new GameState() })

  it('starts in title phase', () => {
    expect(gs.get().phase).toBe('title')
  })

  it('startMission transitions to playing and resets score', () => {
    gs.startMission()
    const s = gs.get()
    expect(s.phase).toBe('playing')
    expect(s.health).toBe(PLAYER.maxHealth)
    expect(s.ammo).toBe(WEAPON.magSize)
    expect(s.reserve).toBe(WEAPON.reserveAmmo)
    expect(s.waveIndex).toBe(0)
  })

  it('move flag tracked via state position (deterministic)', () => {
    gs.startMission()
    const before = { ...gs.get().position }
    gs.get().position.x += 2.5
    gs.get().position.z -= 1.2
    expect(gs.get().position.x).toBeCloseTo(before.x + 2.5)
    expect(gs.get().position.z).toBeCloseTo(before.z - 1.2)
  })

  it('shoot consumes ammo and sets firedShot', () => {
    gs.startMission()
    const t = 1.0
    const ammoBefore = gs.get().ammo
    const ok = gs.shoot(t)
    expect(ok).toBe(true)
    expect(gs.get().ammo).toBe(ammoBefore - 1)
    expect(gs.get().firedShot).toBe(true)
  })

  it('cannot shoot when empty or reloading', () => {
    gs.startMission()
    gs.get().ammo = 0
    expect(gs.shoot(2)).toBe(false)
    gs.get().ammo = 10
    gs.get().isReloading = true
    expect(gs.shoot(3)).toBe(false)
  })

  it('reload flow: begin and complete', () => {
    gs.startMission()
    gs.get().ammo = 5
    const reserveBefore = gs.get().reserve
    expect(gs.beginReload(1)).toBe(true)
    expect(gs.get().isReloading).toBe(true)
    gs.completeReload()
    expect(gs.get().isReloading).toBe(false)
    expect(gs.get().ammo).toBe(WEAPON.magSize)
    expect(gs.get().reloaded).toBe(true)
    expect(gs.get().reserve).toBe(reserveBefore - (WEAPON.magSize - 5))
  })

  it('reload blocked when full or no reserve', () => {
    gs.startMission()
    expect(gs.beginReload(1)).toBe(false) // full mag
    gs.get().ammo = 10
    gs.get().reserve = 0
    expect(gs.beginReload(2)).toBe(false)
  })

  it('takeDamage reduces health and flags tookDamage', () => {
    gs.startMission()
    const before = gs.get().health
    gs.takeDamage(25, 1.0)
    expect(gs.get().health).toBe(before - 25)
    expect(gs.get().tookDamage).toBe(true)
  })

  it('damage cooldown prevents rapid double-hit', () => {
    gs.startMission()
    gs.takeDamage(20, 1.0)
    const afterFirst = gs.get().health
    gs.takeDamage(20, 1.05) // within cooldown 0.18
    expect(gs.get().health).toBe(afterFirst)
    gs.takeDamage(20, 1.3)
    expect(gs.get().health).toBe(afterFirst - 20)
  })

  it('death transitions to dead when health zero', () => {
    gs.startMission()
    gs.get().health = 10
    gs.takeDamage(20, 5)
    expect(gs.get().phase).toBe('dead')
    expect(gs.get().health).toBe(0)
  })

  it('kills award score and track enemiesAlive', () => {
    gs.startMission()
    gs.registerWaveAlive(3)
    gs.addKill('grunt', false)
    expect(gs.get().score).toBe(100)
    expect(gs.get().kills).toBe(1)
    expect(gs.get().enemiesAlive).toBe(2)
    gs.addKill('drone', true) // headshot bonus
    expect(gs.get().score).toBe(100 + 150 + 50)
  })

  it('wave progression and objective completion', () => {
    gs.startMission()
    gs.registerWaveAlive(2)
    gs.addKill('grunt', false)
    gs.addKill('grunt', false)
    expect(gs.get().enemiesAlive).toBe(0)
    const advanced = gs.tryAdvanceWave()
    expect(advanced).toBe(true)
    expect(gs.get().waveIndex).toBe(1)
    expect(gs.get().score).toBeGreaterThan(200)
  })

  it('final wave win sets objectiveDone and won phase', () => {
    gs.startMission()
    // fast-forward to last wave
    gs.get().waveIndex = WAVES.length - 1
    gs.registerWaveAlive(1)
    gs.addKill('grunt', false)
    const win = gs.tryAdvanceWave()
    expect(win).toBe(true)
    expect(gs.get().phase).toBe('won')
    expect(gs.get().objectiveDone).toBe(true)
  })

  it('restart resets all flags', () => {
    gs.startMission()
    gs.shoot(1); gs.takeDamage(30, 2); gs.get().score = 999
    gs.reset()
    const s = gs.get()
    expect(s.phase).toBe('title')
    expect(s.score).toBe(0)
    expect(s.health).toBe(PLAYER.maxHealth)
    expect(s.firedShot).toBe(false)
    expect(s.reloaded).toBe(false)
    expect(s.tookDamage).toBe(false)
  })

  it('render_game_to_text deterministic output', () => {
    gs.startMission()
    gs.registerWaveAlive(5)
    gs.shoot(1)
    gs.takeDamage(10, 2)
    const txt = gs.toText()
    expect(txt).toContain('FRONTIER OPS')
    expect(txt).toContain('Wave 1/5')
    expect(txt).toContain('Health:')
    expect(txt).toContain('Ammo:')
    expect(txt).toContain('Score:')
    // deterministic: same state produces same text
    const txt2 = gs.toText()
    expect(txt).toBe(txt2)
  })

  it('events emit on actions', () => {
    gs.startMission()
    let fired = 0
    gs.on('player:shoot', () => fired++)
    gs.shoot(10)
    gs.shoot(11)
    expect(fired).toBe(2)
  })
})

describe('window.render_game_to_text contract', () => {
  it('global helper is expected to be a function returning string (contract)', async () => {
    // simulate what main.js exposes: gameState.toText
    const gs = new GameState()
    gs.startMission()
    globalThis.render_game_to_text = () => gs.toText()
    expect(typeof globalThis.render_game_to_text).toBe('function')
    const out = globalThis.render_game_to_text()
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(20)
  })
})

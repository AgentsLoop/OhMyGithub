export const GAME = {
  title: 'FRONTIER OPS — Training Arena',
  codename: 'Operation Sandstorm',
}

export const PLAYER = {
  maxHealth: 100,
  speed: 5.5,
  sprintMult: 1.65,
  jumpForce: 6.2,
  gravity: 18,
  eyeHeight: 1.7,
  radius: 0.45,
  damageCooldown: 0.18,
}

export const WEAPON = {
  name: 'M-X Carbine',
  magSize: 30,
  reserveAmmo: 90,
  fireRate: 0.11,
  reloadTime: 1.55,
  damage: 34,
  range: 120,
  spread: 0.004,
  headshotMult: 1.7,
  recoilKick: 0.12,
}

export const ENEMY = {
  gruntHealth: 70,
  droneHealth: 45,
  gruntDamage: 14,
  droneDamage: 9,
  gruntSpeed: 2.9,
  droneSpeed: 4.2,
  attackRange: 16,
  attackCooldown: 1.05,
  detectionRange: 65,
  spawnRadius: 28,
}

export const ARENA = {
  size: 86,
  wallHeight: 8,
  fogNear: 28,
  fogFar: 120,
}

export const WAVES = [
  { id: 1, grunts: 3, drones: 2, objective: 'Clear the entry sector' },
  { id: 2, grunts: 5, drones: 3, objective: 'Secure the depot perimeter' },
  { id: 3, grunts: 6, drones: 4, objective: 'Hold the central yard' },
  { id: 4, grunts: 8, drones: 4, objective: 'Neutralize heavy patrol' },
  { id: 5, grunts: 9, drones: 6, objective: 'ELIMINATE ALL HOSTILES' },
]

export const SCORE = {
  killGrunt: 100,
  killDrone: 150,
  waveBonus: 500,
  headshotBonus: 50,
}

export const EVENTS = {
  START: 'game:start',
  SHOOT: 'player:shoot',
  HIT: 'enemy:hit',
  KILL: 'enemy:kill',
  RELOAD: 'player:reload',
  RELOAD_COMPLETE: 'player:reloadComplete',
  DAMAGE: 'player:damage',
  DEATH: 'player:death',
  WAVE_COMPLETE: 'wave:complete',
  WIN: 'game:win',
  RESTART: 'game:restart',
}

/**
 * Primitive branded types — prevents accidental mixing of IDs.
 * All contracts are plain JSON-serializable data, no class instances.
 */

export type EntityId = string & { readonly __brand: "EntityId" };
export type PlayerId = string & { readonly __brand: "PlayerId" };
export type Tick = number & { readonly __brand: "Tick" };

export function entityId(id: string): EntityId {
  return id as EntityId;
}
export function playerId(id: string): PlayerId {
  return id as PlayerId;
}
export function tick(n: number): Tick {
  return n as Tick;
}

export type Vec2 = { readonly x: number; readonly y: number };
export type Vec3 = { readonly x: number; readonly y: number; readonly z: number };

export const TICK_RATE = 20 as const; // 20 Hz fixed
export const TICK_DT_MS = 50 as const;
export const TICK_DT_S = 0.05 as const;

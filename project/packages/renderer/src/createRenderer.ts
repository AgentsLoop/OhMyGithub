import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";
import type { WorldSnapshot } from "@rts/contracts";

/**
 * Thin Babylon.js wrapper. Owns Engine + Scene, renders snapshots.
 * All assets are placeholders. Real GLB/KTX2 loading is stubbed for future
 * `assets/models/` and `assets/textures/` — kept as file-based loaders.
 *
 * Contract: renderer never mutates snapshots, never imports simulation.
 */

export interface RendererHandle {
  readonly engine: Engine;
  readonly scene: Scene;
  renderSnapshot(snap: WorldSnapshot): void;
  resize(): void;
  dispose(): void;
  getFps(): number;
}

export function createRenderer(canvas: HTMLCanvasElement): RendererHandle {
  const engine = new Engine(canvas, true, { antialias: true, stencil: true });
  const scene = new Scene(engine);

  // camera — top-down RTS-like orbit, constrained
  const camera = new ArcRotateCamera(
    "cam",
    -Math.PI / 2,
    Math.PI / 3.5,
    40,
    new Vector3(0, 0, 0),
    scene,
  );
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 120;
  camera.lowerBetaLimit = 0.2;
  camera.upperBetaLimit = Math.PI / 2.2;
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 20;
  camera.panningSensibility = 800;

  // light + ground
  new HemisphericLight("hemi", new Vector3(0, 1, 0), scene).intensity = 0.9;
  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 80, height: 80, subdivisions: 2 },
    scene,
  );
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.12, 0.14, 0.16);
  groundMat.specularColor = new Color3(0.05, 0.05, 0.05);
  ground.material = groundMat;

  // grid helper (lines)
  const gridMat = new StandardMaterial("gridMat", scene);
  gridMat.diffuseColor = new Color3(0.22, 0.25, 0.28);
  gridMat.alpha = 0.2;
  for (let i = -40; i <= 40; i += 5) {
    const h = MeshBuilder.CreateLines(
      `grid-h-${i}`,
      { points: [new Vector3(-40, 0.02, i), new Vector3(40, 0.02, i)] },
      scene,
    );
    h.color = new Color3(0.25, 0.28, 0.32);
    h.alpha = 0.35;
    const v = MeshBuilder.CreateLines(
      `grid-v-${i}`,
      { points: [new Vector3(i, 0.02, -40), new Vector3(i, 0.02, 40)] },
      scene,
    );
    v.color = new Color3(0.25, 0.28, 0.32);
    v.alpha = 0.35;
  }

  // entity mesh pool: id -> mesh
  const meshes = new Map<string, { mesh: import("@babylonjs/core").Mesh; mat: StandardMaterial }>();

  function colorForPrototype(proto: string): Color3 {
    if (proto === "tank") return new Color3(0.9, 0.35, 0.2);
    if (proto === "scout") return new Color3(0.25, 0.75, 0.9);
    // deterministic hash -> color
    let h = 0;
    for (let i = 0; i < proto.length; i++) h = (h * 31 + proto.charCodeAt(i)) >>> 0;
    const r = 0.4 + ((h & 0xff) / 255) * 0.5;
    const g = 0.4 + (((h >> 8) & 0xff) / 255) * 0.5;
    const b = 0.4 + (((h >> 16) & 0xff) / 255) * 0.5;
    return new Color3(r, g, b);
  }

  function ensureMesh(id: string, proto: string): import("@babylonjs/core").Mesh {
    const existing = meshes.get(id);
    if (existing) return existing.mesh;
    const mesh =
      proto === "tank"
        ? MeshBuilder.CreateBox(id, { size: 1.4 }, scene)
        : MeshBuilder.CreateCylinder(id, { diameter: 1.1, height: 0.6 }, scene);
    mesh.position.y = 0.3;
    const mat = new StandardMaterial(`mat-${id}`, scene);
    mat.diffuseColor = colorForPrototype(proto);
    mat.specularColor = new Color3(0.2, 0.2, 0.2);
    mesh.material = mat;
    meshes.set(id, { mesh, mat });
    return mesh;
  }

  let lastTick = -1;

  return {
    engine,
    scene,
    renderSnapshot(snap: WorldSnapshot): void {
      lastTick = snap.tick as number;
      const wanted = new Set(snap.entities.map(e => e.id as string));
      // remove stale
      for (const [id, { mesh, mat }] of [...meshes.entries()]) {
        if (!wanted.has(id)) {
          mesh.dispose();
          mat.dispose();
          meshes.delete(id);
        }
      }
      // upsert
      for (const e of snap.entities) {
        const mesh = ensureMesh(e.id as string, e.prototypeId);
        mesh.position.x = e.position.x;
        mesh.position.z = e.position.y; // XZ plane is ground
        mesh.rotation.y = e.headingRad;
        // hover bob based on velocity? keep stable
      }
      scene.render();
      // update document title-adjacent debug if needed — not here
      void lastTick;
    },
    resize(): void {
      engine.resize();
    },
    dispose(): void {
      scene.dispose();
      engine.dispose();
    },
    getFps(): number {
      return Math.round(engine.getFps());
    },
  };
}

/**
 * Future GLB/KTX2 stubs — keep file paths declarative.
 * Actual loading will use @babylonjs/loaders GLTFFileLoader and KTX2 decoder.
 * These are NO-OP placeholders to prove the boundary without binary assets.
 */
export async function loadGlbPlaceholder(path: string): Promise<void> {
  // validate path points to declared asset folder
  if (!path.startsWith("/assets/models/") && !path.startsWith("assets/models/")) {
    throw new Error(`GLB path must be under assets/models/, got ${path}`);
  }
  // no-op — real impl: SceneLoader.ImportMeshAsync(...)
  return;
}

export async function loadKtx2Placeholder(path: string): Promise<void> {
  if (!path.startsWith("/assets/textures/") && !path.startsWith("assets/textures/")) {
    throw new Error(`KTX2 path must be under assets/textures/, got ${path}`);
  }
  return;
}

import { useEffect, useRef } from "react";
import { createRenderer } from "@rts/renderer";
import type { WorldSnapshot } from "@rts/contracts";

export function BabylonCanvas({ snapshot }: { snapshot: WorldSnapshot | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<ReturnType<typeof createRenderer> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = createRenderer(canvas);
    handleRef.current = handle;

    const onResize = (): void => handle.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      handle.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (snapshot && handleRef.current) {
      handleRef.current.renderSnapshot(snapshot);
    }
  }, [snapshot]);

  return (
    <canvas ref={canvasRef} data-testid="babylon-canvas" tabIndex={0} aria-label="3D viewport" />
  );
}

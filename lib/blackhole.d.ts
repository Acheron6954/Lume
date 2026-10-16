export const ORBIT_MS: number;
export const SLIDE_MS: number;

export type BlackHoleFrame = { x: number; y: number; r: number; title: number };

export function startBlackHole(
  canvas: HTMLCanvasElement,
  hooks: {
    onFrame?: (f: BlackHoleFrame) => void;
    onGo?: () => void;
    onDone?: () => void;
  },
): { stop: () => void };

import { cn } from "@base-template/ui/lib/utils";

import { createRng } from "../-mock/prng";

const SIZE = 25;
const FINDER = 7;

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
}

const FINDER_ORIGINS = [
  [0, 0],
  [0, SIZE - FINDER],
  [SIZE - FINDER, 0],
] as const;

/** Module state inside a finder square or its separator ring; `null` outside every finder zone. */
function finderModule(row: number, column: number): boolean | null {
  for (const [row0, column0] of FINDER_ORIGINS) {
    const r = row - row0;
    const c = column - column0;
    if (r < -1 || r > FINDER || c < -1 || c > FINDER) continue;
    if (r < 0 || c < 0 || r >= FINDER || c >= FINDER) return false;
    const edge = r === 0 || r === FINDER - 1 || c === 0 || c === FINDER - 1;
    return edge || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
  }
  return null;
}

function modulesOf(token: string): boolean[] {
  const rng = createRng(hash(token));
  return Array.from({ length: SIZE * SIZE }, (_, index) => {
    const fixed = finderModule(Math.floor(index / SIZE), index % SIZE);
    return fixed ?? rng.chance(0.5);
  });
}

/**
 * Deterministic QR-looking grid (finder squares plus pseudo-random modules seeded by the token).
 * It is not scannable: the prototype only needs a code that changes when the token does.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-block rounded-lg border bg-background p-3 text-foreground", className)}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={label}
        shapeRendering="crispEdges"
        className="size-full"
      >
        {modulesOf(value).map((dark, index) =>
          dark ? (
            <rect
              key={index}
              x={index % SIZE}
              y={Math.floor(index / SIZE)}
              width={1}
              height={1}
              fill="currentColor"
            />
          ) : null,
        )}
      </svg>
    </div>
  );
}

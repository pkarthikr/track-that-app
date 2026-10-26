import { palette } from "./palette";

const CELLS = [
  { x: 0, y: 0, opacity: 0.38 },
  { x: 26, y: 0, opacity: 0.58 },
  { x: 0, y: 26, opacity: 0.8 },
  { x: 26, y: 26, opacity: 1 },
] as const;

export function LogoMark({ size = 24, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 46 46"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {CELLS.map((cell, i) => (
        <rect
          key={i}
          x={cell.x}
          y={cell.y}
          width={20}
          height={20}
          rx={6}
          fill={mono ? "#fff" : palette.green[i]}
          fillOpacity={mono ? cell.opacity : undefined}
        />
      ))}
    </svg>
  );
}

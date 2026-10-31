import { HABIT_COLORS } from "./palette";
import "./ColorSwatches.css";

function capitalise(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function ColorSwatches() {
  return (
    <div className="color-swatches">
      {HABIT_COLORS.map((color) => (
        <span
          key={color}
          role="img"
          aria-label={capitalise(color)}
          className={`color-swatches__dot habit-color--${color}`}
        />
      ))}
    </div>
  );
}

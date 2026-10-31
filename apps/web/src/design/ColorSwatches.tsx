import { HABIT_COLORS } from "./palette";
import type { HabitColor } from "./palette";
import "./ColorSwatches.css";

function capitalise(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

type ColorSwatchesProps = {
  value?: HabitColor;
  onChange?: (color: HabitColor) => void;
};

export function ColorSwatches({ value, onChange }: ColorSwatchesProps) {
  if (!onChange) {
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

  return (
    <div className="color-swatches" role="radiogroup" aria-label="Colour">
      {HABIT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={capitalise(color)}
          className={`color-swatches__dot color-swatches__dot--button habit-color--${color}`}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

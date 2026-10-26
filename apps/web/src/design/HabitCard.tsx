import type { HabitColor } from "./palette";
import { WeekRow, type WeekDays } from "./WeekRow";
import "./HabitCard.css";

export function HabitCard({
  name,
  color,
  days,
  decorative,
}: {
  name: string;
  color: HabitColor;
  days: WeekDays;
  decorative?: boolean;
}) {
  const week = <WeekRow days={days} color={color} />;

  return (
    <div className="habit-card">
      <div className="habit-card__header">
        <span className={`habit-card__ring habit-color--${color}`} aria-hidden="true" />
        <span className="habit-card__name">{name}</span>
      </div>
      {decorative ? <div aria-hidden="true">{week}</div> : week}
    </div>
  );
}

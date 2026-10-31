import { parseNewHabit } from "@trackthat/shared";
import type { HabitColor, Weekday } from "@trackthat/shared";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../design/Button";
import { ColorSwatches } from "../design/ColorSwatches";
import { usePageTitle } from "../design/usePageTitle";
import type { HabitsApi } from "../habits/api";
import "./NewHabit.css";

const DAYS: readonly { day: Weekday; name: string; letter: string }[] = [
  { day: 0, name: "Sunday", letter: "S" },
  { day: 1, name: "Monday", letter: "M" },
  { day: 2, name: "Tuesday", letter: "T" },
  { day: 3, name: "Wednesday", letter: "W" },
  { day: 4, name: "Thursday", letter: "T" },
  { day: 5, name: "Friday", letter: "F" },
  { day: 6, name: "Saturday", letter: "S" },
];

const SAVE_ERROR = "Couldn't create the habit. Try again.";

export function NewHabit({
  api,
  onCreated,
  onCancel,
}: {
  api: HabitsApi;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  usePageTitle("Track That: New habit");
  const [name, setName] = useState("");
  const [color, setColor] = useState<HabitColor>("green");
  const [weekdays, setWeekdays] = useState<ReadonlySet<Weekday>>(
    () => new Set(DAYS.map((d) => d.day)),
  );
  const [validation, setValidation] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggle(day: Weekday) {
    setWeekdays((current) => {
      const next = new Set(current);
      if (!next.delete(day)) next.add(day);
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFailed(false);
    if (weekdays.size === 0) {
      setValidation("Pick at least one day.");
      return;
    }
    const parsed = parseNewHabit({ name, color, weekdays: [...weekdays] });
    if (!parsed.ok) {
      setValidation(parsed.message);
      return;
    }
    setValidation(null);
    setSubmitting(true);
    try {
      const habit = await api.createHabit(parsed.value);
      onCreated(habit.id);
    } catch {
      setFailed(true);
      setSubmitting(false);
    }
  }

  return (
    <main className="new-habit">
      <h1 className="new-habit__title">New habit</h1>
      <form className="new-habit__form" onSubmit={(e) => void submit(e)} noValidate>
        <div className="new-habit__field">
          <label htmlFor="new-habit-name" className="new-habit__label">
            Name
          </label>
          <input
            id="new-habit-name"
            className="new-habit__input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="new-habit__field">
          <span className="new-habit__label">Colour</span>
          <ColorSwatches value={color} onChange={setColor} />
        </div>
        <div className="new-habit__field">
          <span className="new-habit__label">Repeat on</span>
          <div className="new-habit__days">
            {DAYS.map(({ day, name: dayName, letter }) => (
              <button
                key={day}
                type="button"
                aria-label={dayName}
                aria-pressed={weekdays.has(day)}
                className="new-habit__day"
                onClick={() => toggle(day)}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
        {validation && <p className="new-habit__error">{validation}</p>}
        {failed && (
          <p role="alert" className="new-habit__error">
            {SAVE_ERROR}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          Create habit
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </form>
    </main>
  );
}

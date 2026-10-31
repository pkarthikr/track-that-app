import { parseNewHabit } from "@trackthat/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "../design/Button";
import { PageShell } from "../design/PageShell";
import { HABIT_COLORS, habitColor, type HabitColor } from "../design/palette";
import { usePageTitle } from "../design/usePageTitle";
import type { HabitsApi } from "../habits/api";
import "./AddHabit.css";

const DAYS = [
  { letter: "S", short: "Sun", full: "Sunday" },
  { letter: "M", short: "Mon", full: "Monday" },
  { letter: "T", short: "Tue", full: "Tuesday" },
  { letter: "W", short: "Wed", full: "Wednesday" },
  { letter: "T", short: "Thu", full: "Thursday" },
  { letter: "F", short: "Fri", full: "Friday" },
  { letter: "S", short: "Sat", full: "Saturday" },
] as const;

const SAVE_ERROR = "Couldn't add the habit. Try again.";

function capitalise(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function dueLine(days: ReadonlySet<number>, today: number): string {
  if (days.has(today)) return "Due today";
  for (let step = 1; step <= 7; step++) {
    const index = (today + step) % 7;
    if (days.has(index)) return `Next: ${DAYS[index]?.short}`;
  }
  return "";
}

/** `today` is a day index, Sunday = 0. */
export function AddHabit({ api, today = new Date().getDay() }: { api: HabitsApi; today?: number }) {
  usePageTitle("Track That: New habit");
  const [name, setName] = useState("");
  const [days, setDays] = useState<ReadonlySet<number>>(new Set());
  const [color, setColor] = useState<HabitColor>("green");
  const [added, setAdded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const homeLink = useRef<HTMLAnchorElement>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const canSave = name.trim().length > 0 && days.size > 0;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (added) homeLink.current?.focus();
  }, [added]);

  function toggleDay(index: number) {
    setDays((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave || added || inFlight.current) return;
    setError(null);
    const parsed = parseNewHabit({ name, color, weekdays: [...days].sort((a, b) => a - b) });
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    try {
      await api.createHabit(parsed.value);
      if (mounted.current) setAdded(true);
    } catch {
      if (mounted.current) setError(SAVE_ERROR);
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <PageShell back={{ to: "/home", label: "Home" }}>
      <main className={`add-habit habit-color--${color}`}>
        <h1 className="add-habit__title">New habit</h1>

        <form className="add-habit__form" onSubmit={(event) => void submit(event)}>
          <div className="add-habit__group">
            <label className="add-habit__label" htmlFor="habit-name">
              What do you want to track?
            </label>
            <input
              id="habit-name"
              className="add-habit__input"
              type="text"
              value={name}
              placeholder="e.g. Go for a run"
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <fieldset className="add-habit__group">
            <legend className="add-habit__label">Which days?</legend>
            <div className="add-habit__grid">
              {DAYS.map((day, index) => (
                <button
                  key={day.full}
                  type="button"
                  className="add-habit__day"
                  aria-pressed={days.has(index)}
                  aria-label={day.full}
                  onClick={() => toggleDay(index)}
                >
                  {day.letter}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="add-habit__group">
            <legend className="add-habit__label">Color</legend>
            <div className="add-habit__grid">
              {HABIT_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="add-habit__swatch"
                  style={{ background: habitColor(option), color: habitColor(option) }}
                  aria-pressed={option === color}
                  aria-label={capitalise(option)}
                  onClick={() => setColor(option)}
                />
              ))}
            </div>
          </fieldset>

          {error && (
            <p className="add-habit__error" role="alert">
              {error}
            </p>
          )}

          <div className="add-habit__submit">
            <Button type="submit" disabled={!canSave || saving || added}>
              Add habit
            </Button>
          </div>
        </form>
      </main>

      {added && (
        <div className={`add-habit__overlay habit-color--${color}`}>
          <div
            className="add-habit__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="added-title"
          >
            <div className="add-habit__tick" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </div>
            <h2 id="added-title" className="add-habit__added-title">
              Added
            </h2>
            <p className="add-habit__added-name">{name.trim()}</p>
            <p className="add-habit__added-due">{dueLine(days, today)}</p>
            <Link ref={homeLink} to="/home" className="add-habit__home">
              Back to Home
            </Link>
          </div>
        </div>
      )}
    </PageShell>
  );
}

import type { DateString, HabitDetail as HabitDetailData } from "@trackthat/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "../design/Button";
import { Heatmap } from "../design/Heatmap";
import { usePageTitle } from "../design/usePageTitle";
import { HabitsApiError } from "../habits/api";
import type { HabitsApi } from "../habits/api";
import { todayLocal } from "../habits/today";
import "./HabitDetail.css";

type Load =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; habit: HabitDetailData };

export function HabitDetail({
  api,
  id,
  today = todayLocal(),
  onArchived,
}: {
  api: HabitsApi;
  id: string;
  today?: DateString;
  onArchived: () => void;
}) {
  usePageTitle("Track That: Habit");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveFailed, setArchiveFailed] = useState(false);
  const latest = useRef(0);

  const loadHabit = useCallback(() => {
    const request = ++latest.current;
    setLoad({ status: "loading" });
    api.getHabit(id, today).then(
      (habit) => {
        if (request === latest.current) setLoad({ status: "ready", habit });
      },
      (error: unknown) => {
        if (request !== latest.current) return;
        setLoad({
          status: error instanceof HabitsApiError && error.status === 404 ? "missing" : "error",
        });
      },
    );
  }, [api, id, today]);

  useEffect(() => {
    loadHabit();
    return () => {
      latest.current++;
    };
  }, [loadHabit]);

  useEffect(() => {
    setConfirming(false);
    setArchiving(false);
    setArchiveFailed(false);
  }, [id]);

  async function archive() {
    if (archiving) return;
    const request = latest.current;
    setArchiving(true);
    setArchiveFailed(false);
    try {
      await api.updateHabit(id, { archived: true });
    } catch {
      if (request === latest.current) {
        setArchiveFailed(true);
        setArchiving(false);
      }
      return;
    }
    if (request === latest.current) onArchived();
  }

  if (load.status === "loading") {
    return (
      <main className="habit-detail">
        <p className="habit-detail__status" role="status">
          Loading habit…
        </p>
      </main>
    );
  }

  if (load.status === "missing") {
    return (
      <main className="habit-detail">
        <p className="habit-detail__status">Habit not found.</p>
        <Link to="/home" className="habit-detail__link">
          Back to Home
        </Link>
      </main>
    );
  }

  if (load.status === "error") {
    return (
      <main className="habit-detail">
        <div className="habit-detail__error" role="alert">
          <span>Couldn't load this habit.</span>
          <button type="button" className="habit-detail__retry" onClick={loadHabit}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  const { habit } = load;
  return (
    <main className="habit-detail">
      <h1 className="habit-detail__title">{habit.name}</h1>
      <p className="habit-detail__streak">Current streak: {habit.streak}</p>
      <Heatmap color={habit.color} done={habit.done} today={today} />
      <section className="habit-detail__archive">
        {confirming ? (
          <>
            <p className="habit-detail__prompt">Archive this habit?</p>
            {archiveFailed && (
              <p role="alert" className="habit-detail__error">
                Couldn't archive the habit. Try again.
              </p>
            )}
            <Button disabled={archiving} onClick={() => void archive()}>
              Confirm archive
            </Button>
            <Button
              variant="ghost"
              disabled={archiving}
              onClick={() => {
                setConfirming(false);
                setArchiveFailed(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            Archive
          </Button>
        )}
      </section>
    </main>
  );
}

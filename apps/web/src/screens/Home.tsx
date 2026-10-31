import type { DateString, HabitSummary, Weekday } from "@trackthat/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { EmptyState } from "../design/EmptyState";
import { HabitRow } from "../design/HabitRow";
import { LogoMark } from "../design/LogoMark";
import { usePageTitle } from "../design/usePageTitle";
import { Wordmark } from "../design/Wordmark";
import type { HabitsApi } from "../habits/api";
import { todayLocal } from "../habits/today";
import { weekCells } from "../habits/week";
import "./Home.css";

const GEAR_PATH =
  "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z";

function Icon({ size = 22, strokeWidth = 2, children }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number; strokeWidth?: number; children: React.ReactNode };

type Load = "loading" | "error" | "ready";

const SAVE_ERROR = "Couldn't save that. Try again.";

function withDay(habit: HabitSummary, date: DateString, done: boolean): HabitSummary {
  const rest = habit.weekDone.filter((d) => d !== date);
  return { ...habit, weekDone: done ? [...rest, date] : rest };
}

export function Home({
  email,
  api,
  today = todayLocal(),
  onSignOut,
  onOpenHabit,
}: {
  email: string;
  api: HabitsApi;
  today?: DateString;
  onSignOut: () => void;
  onOpenHabit: (id: string) => void;
}) {
  usePageTitle("Track That: Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [load, setLoad] = useState<Load>("loading");
  const [habits, setHabits] = useState<readonly HabitSummary[]>([]);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [saveFailed, setSaveFailed] = useState(false);
  const empty = load === "ready" && habits.length === 0;
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  // Only the newest list request may apply its result, and never while a write
  // is in flight (the list could predate it). A skipped result marks the list
  // stale so the last write to settle reloads it.
  const latestLoad = useRef(0);
  const pending = useRef(new Set<string>());
  const stale = useRef(false);
  const loadInFlight = useRef(false);

  const fetchHabits = useCallback(
    async (onFailure: () => void) => {
      const request = ++latestLoad.current;
      loadInFlight.current = true;
      try {
        const loaded = await api.listHabits(today);
        if (request !== latestLoad.current) return;
        loadInFlight.current = false;
        if (pending.current.size > 0) {
          stale.current = true;
          return;
        }
        stale.current = false;
        setHabits(loaded);
        setLoad("ready");
      } catch {
        if (request === latestLoad.current) {
          loadInFlight.current = false;
          onFailure();
        }
      }
    },
    [api, today],
  );

  const loadHabits = useCallback(() => {
    setLoad("loading");
    void fetchHabits(() => setLoad("error"));
  }, [fetchHabits]);

  useEffect(() => {
    loadHabits();
    return () => {
      latestLoad.current++;
    };
  }, [loadHabits]);

  useEffect(() => {
    if (menuOpen) closeButton.current?.focus();
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    menuButton.current?.focus();
  }

  function setPending(id: string, isPending: boolean) {
    if (isPending) pending.current.add(id);
    else pending.current.delete(id);
    setPendingIds(new Set(pending.current));
  }

  async function toggleDay(habit: HabitSummary, index: number) {
    const date = weekCells(habit, today).dates[index];
    if (date === undefined || date > today || pending.current.has(habit.id)) return;
    const wasDone = habit.weekDone.includes(date);
    const apply = (done: boolean) =>
      setHabits((list) => list.map((h) => (h.id === habit.id ? withDay(h, date, done) : h)));

    latestLoad.current++; // any list request already in flight predates this write
    if (loadInFlight.current) {
      // Its result is dropped, so a reload is still owed once writes settle.
      stale.current = true;
      loadInFlight.current = false;
    }
    setPending(habit.id, true);
    setSaveFailed(false);
    apply(!wasDone);
    try {
      await (wasDone ? api.undoCompletion(habit.id, date) : api.logCompletion(habit.id, date));
    } catch {
      apply(wasDone);
      setSaveFailed(true);
      setPending(habit.id, false);
      // The write may have been applied despite the error: always resync.
      if (pending.current.size === 0) void fetchHabits(() => {});
      return;
    }
    setPending(habit.id, false);
    void fetchHabits(() => {});
  }

  return (
    <div className="home">
      <div className="home__column">
        <header className="home__bar">
          <button
            ref={menuButton}
            type="button"
            className="home__icon-btn"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="menu"
            onClick={() => setMenuOpen(true)}
          >
            <Icon>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </Icon>
          </button>
          <Wordmark size="sm" />
          <button type="button" className="home__icon-btn" aria-label="Settings">
            <Icon>
              <circle cx="12" cy="12" r="3" />
              <path d={GEAR_PATH} />
            </Icon>
          </button>
        </header>

        <main className="home__main">
          <div className="home__title-row">
            <h1 className="home__title">Home</h1>
            <Link
              to="/habits/new"
              className={empty ? "home__add home__add--pulse" : "home__add"}
              aria-label="New habit"
            >
              <Icon size={20} strokeWidth={2.6}>
                <path d="M12 5v14M5 12h14" />
              </Icon>
            </Link>
          </div>

          {saveFailed && (
            <p className="home__error" role="alert">
              {SAVE_ERROR}
            </p>
          )}

          {load === "loading" && (
            <p className="home__status" role="status">
              Loading your habits…
            </p>
          )}

          {load === "error" && (
            <div className="home__error" role="alert">
              <span>Couldn't load your habits.</span>
              <button type="button" className="home__retry" onClick={loadHabits}>
                Retry
              </button>
            </div>
          )}

          {empty && <EmptyState />}

          {load === "ready" && !empty && (
            <ul className="home__habits">
              {habits.map((habit) => {
                const { days, todayIndex } = weekCells(habit, today);
                return (
                  <HabitRow
                    key={habit.id}
                    name={habit.name}
                    color={habit.color}
                    active={habit.weekdays.includes(todayIndex as Weekday)}
                    streak={habit.streak}
                    days={days}
                    todayIndex={todayIndex}
                    pending={pendingIds.has(habit.id)}
                    onOpen={() => onOpenHabit(habit.id)}
                    onToggleDay={(index) => void toggleDay(habit, index)}
                  />
                );
              })}
            </ul>
          )}
        </main>
      </div>

      {menuOpen && (
        <div
          className="home__overlay"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMenu();
          }}
        >
          <div id="menu" className="home__drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="home__drawer-head">
              <span className="home__drawer-brand">
                <LogoMark size={23} />
                Track That
              </span>
              <button
                ref={closeButton}
                type="button"
                className="home__icon-btn"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <Icon>
                  <path d="M6 6l12 12M18 6L6 18" />
                </Icon>
              </button>
            </div>
            <nav className="home__nav" aria-label="Main">
              <a
                href="/home"
                className="home__nav-item home__nav-item--current"
                aria-current="page"
              >
                <Icon>
                  <path d="M4 11.5L12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
                </Icon>
                Home
              </a>
              <button type="button" className="home__nav-item">
                <Icon>
                  <circle cx="12" cy="12" r="3" />
                  <path d={GEAR_PATH} />
                </Icon>
                Settings
              </button>
              <button type="button" className="home__nav-item" onClick={onSignOut}>
                <Icon>
                  <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
                  <path d="M16 17l5-5-5-5M21 12H9" />
                </Icon>
                Sign out
              </button>
            </nav>
            <p className="home__email">{email}</p>
          </div>
          <button
            type="button"
            className="home__scrim"
            aria-label="Close menu"
            onClick={closeMenu}
          />
        </div>
      )}
    </div>
  );
}

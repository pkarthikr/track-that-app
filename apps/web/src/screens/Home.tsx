import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../design/EmptyState";
import { HabitRow } from "../design/HabitRow";
import { LogoMark } from "../design/LogoMark";
import { usePageTitle } from "../design/usePageTitle";
import { Wordmark } from "../design/Wordmark";
import { MOCK_HABITS, type MockHabit } from "./mockHabits";
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

export function Home({
  email,
  habits = MOCK_HABITS,
  onSignOut,
}: {
  email: string;
  habits?: readonly MockHabit[];
  onSignOut: () => void;
}) {
  usePageTitle("Track That: Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(new Set());
  const empty = habits.length === 0;
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menuOpen) closeButton.current?.focus();
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    menuButton.current?.focus();
  }

  function toggle(id: string) {
    setDoneIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
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
            <button
              type="button"
              className={empty ? "home__add home__add--pulse" : "home__add"}
              aria-label="New habit"
            >
              <Icon size={20} strokeWidth={2.6}>
                <path d="M12 5v14M5 12h14" />
              </Icon>
            </button>
          </div>

          {empty ? (
            <EmptyState />
          ) : (
            <ul className="home__habits">
              {habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  name={habit.name}
                  color={habit.color}
                  active={habit.active}
                  past={habit.past}
                  today={habit.today}
                  done={doneIds.has(habit.id)}
                  onToggle={() => toggle(habit.id)}
                />
              ))}
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

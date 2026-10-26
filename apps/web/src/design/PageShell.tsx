import type { ReactNode } from "react";
import { Link } from "react-router";
import { Wordmark } from "./Wordmark";
import "./PageShell.css";

type PageShellProps = {
  children: ReactNode;
  action?: { label: string; to: string };
  back?: { to: string };
};

const DEFAULT_ACTION = { label: "Sign in", to: "/sign-in" };

export function PageShell({ children, action = DEFAULT_ACTION, back }: PageShellProps) {
  return (
    <div className="page-shell">
      <div className="page-shell__column">
        {back ? (
          <Link to={back.to} className="page-shell__back">
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Back
          </Link>
        ) : (
          <header className="page-shell__header">
            <Link to="/" className="page-shell__home">
              <Wordmark size="sm" />
            </Link>
            <Link to={action.to} className="page-shell__sign-in">
              {action.label}
            </Link>
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

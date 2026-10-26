import type { ReactNode } from "react";
import { Link } from "react-router";
import { Wordmark } from "./Wordmark";
import "./PageShell.css";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-shell__column">
        <header className="page-shell__header">
          <Link to="/" className="page-shell__home">
            <Wordmark size="sm" />
          </Link>
          <Link to="/sign-in" className="page-shell__sign-in">
            Sign in
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}

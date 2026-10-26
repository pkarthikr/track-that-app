import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import "./Button.css";

type ButtonProps = {
  variant?: "primary" | "ghost";
  children: ReactNode;
} & ({ to: string } | ({ to?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>));

export function Button({ variant = "primary", children, ...rest }: ButtonProps) {
  const className = `button button--${variant}`;

  if (rest.to !== undefined) {
    return (
      <Link to={rest.to} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" {...rest} className={className}>
      {children}
    </button>
  );
}

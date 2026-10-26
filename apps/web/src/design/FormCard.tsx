import type { FormEvent, ReactNode } from "react";
import "./FormCard.css";

type FormCardProps = {
  title?: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  error?: string | null;
  children: ReactNode;
};

export function FormCard({ title, onSubmit, error, children }: FormCardProps) {
  return (
    <form className="form-card" onSubmit={onSubmit} noValidate>
      {title ? <h1>{title}</h1> : null}
      {children}
      {error ? (
        <p role="alert" className="form-card__error">
          {error}
        </p>
      ) : null}
    </form>
  );
}

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import "./TextField.css";

export type TextFieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  variant?: "code";
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextField({
  label,
  hint,
  error,
  variant,
  trailing,
  className,
  id: idProp,
  ...input
}: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  const inputClass = [
    "text-field__input",
    variant === "code" ? "text-field__input--code" : null,
    trailing ? "text-field__input--trailing" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="text-field">
      <label className="text-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="text-field__control">
        <input
          {...input}
          id={id}
          className={inputClass}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {trailing}
      </div>
      {hint ? (
        <p id={hintId} className="text-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

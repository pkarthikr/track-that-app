import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import type { AuthApi } from "../auth/auth";
import { CODE_LENGTH } from "../auth/validation";
import { Button } from "../design/Button";
import { FormCard } from "../design/FormCard";
import { PageShell } from "../design/PageShell";
import { TextField } from "../design/TextField";
import { usePageTitle } from "../design/usePageTitle";
import "./AuthScreen.css";
import { useFormSubmit } from "./useFormSubmit";

export function Confirm({
  auth,
  email,
  onConfirmed,
}: {
  auth: AuthApi;
  email: string;
  onConfirmed: () => void;
}) {
  usePageTitle("Track That: Confirm code");
  const [code, setCode] = useState("");
  const valid = code.length === CODE_LENGTH;
  const { pending, error, submit } = useFormSubmit(async () => {
    await auth.confirmSignUp(email, code);
    onConfirmed();
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!valid) {
      event.preventDefault();
      return;
    }
    void submit(event);
  }

  return (
    <PageShell back={{ to: "/register" }}>
      <main>
        <section className="auth-screen__intro">
          <div className="auth-screen__icon">
            <svg
              aria-hidden="true"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="M4 7.5l8 6 8-6" />
            </svg>
          </div>
          <h1 className="auth-screen__title">Check your email</h1>
          <p className="auth-screen__lead">
            We sent a 6-digit code to <strong>{email}</strong>.
          </p>
        </section>
        <FormCard onSubmit={handleSubmit}>
          <TextField
            label="Confirmation code"
            variant="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            error={error}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
          />
          <Button type="submit" disabled={!valid || pending}>
            Verify and continue
          </Button>
        </FormCard>
        <p className="auth-screen__switch auth-screen__switch--muted">
          <Link to="/register">Wrong email? Start over</Link>
        </p>
      </main>
    </PageShell>
  );
}

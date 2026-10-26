import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import type { AuthApi } from "../auth/auth";
import { isPlausibleEmail } from "../auth/validation";
import { Button } from "../design/Button";
import { FormCard } from "../design/FormCard";
import { PageShell } from "../design/PageShell";
import { PasswordField } from "../design/PasswordField";
import { TextField } from "../design/TextField";
import { usePageTitle } from "../design/usePageTitle";
import "./AuthScreen.css";
import { useFormSubmit } from "./useFormSubmit";

export function SignIn({
  auth,
  onSignedIn,
  onNeedsConfirmation,
}: {
  auth: AuthApi;
  onSignedIn: (email: string) => void;
  onNeedsConfirmation: (email: string) => void;
}) {
  usePageTitle("Track That: Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = isPlausibleEmail(email) && password.length > 0;
  const { pending, error, submit } = useFormSubmit(
    async () => {
      await auth.signIn(email.trim(), password);
      onSignedIn(email.trim());
    },
    (failure) => {
      if (failure.code !== "user-not-confirmed") return false;
      onNeedsConfirmation(email.trim());
      return true;
    },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!valid) {
      event.preventDefault();
      return;
    }
    void submit(event);
  }

  return (
    <PageShell action={{ label: "Create account", to: "/register" }}>
      <main>
        <FormCard title="Sign in" onSubmit={handleSubmit} error={error}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" disabled={!valid || pending}>
            Sign in
          </Button>
        </FormCard>
        <p className="auth-screen__switch">
          New to Track That? <Link to="/register">Create an account</Link>
        </p>
      </main>
    </PageShell>
  );
}

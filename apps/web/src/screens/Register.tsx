import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import type { AuthApi } from "../auth/auth";
import { isPlausibleEmail, PASSWORD_MIN_LENGTH } from "../auth/validation";
import { Button } from "../design/Button";
import { FormCard } from "../design/FormCard";
import { PageShell } from "../design/PageShell";
import { PasswordField } from "../design/PasswordField";
import { TextField } from "../design/TextField";
import { usePageTitle } from "../design/usePageTitle";
import "./AuthScreen.css";
import { useFormSubmit } from "./useFormSubmit";

export function Register({
  auth,
  onRegistered,
}: {
  auth: AuthApi;
  onRegistered: (email: string) => void;
}) {
  usePageTitle("Track That: Create account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = isPlausibleEmail(email) && password.length >= PASSWORD_MIN_LENGTH;
  const { pending, error, submit } = useFormSubmit(async () => {
    await auth.signUp(email.trim(), password);
    onRegistered(email.trim());
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!valid) {
      event.preventDefault();
      return;
    }
    void submit(event);
  }

  return (
    <PageShell action={{ label: "Sign in", to: "/sign-in" }}>
      <main>
        <FormCard title="Create your account" onSubmit={handleSubmit} error={error}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordField
            label="Password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" disabled={!valid || pending}>
            Create account
          </Button>
        </FormCard>
        <p className="auth-screen__switch">
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </p>
      </main>
    </PageShell>
  );
}

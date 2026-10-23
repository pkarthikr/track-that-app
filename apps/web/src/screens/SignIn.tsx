import { useState } from "react";
import type { AuthApi } from "../auth/auth";
import { useFormSubmit } from "./useFormSubmit";

export function SignIn({
  auth,
  onSignedIn,
  onNeedsConfirmation,
  onShowRegister,
}: {
  auth: AuthApi;
  onSignedIn: (email: string) => void;
  onNeedsConfirmation: (email: string) => void;
  onShowRegister: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { pending, error, submit } = useFormSubmit(
    async () => {
      await auth.signIn(email, password);
      onSignedIn(email);
    },
    (failure) => {
      if (failure.code !== "user-not-confirmed") return false;
      onNeedsConfirmation(email);
      return true;
    },
  );

  return (
    <form onSubmit={submit}>
      <h1>Sign in</h1>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>
        Sign in
      </button>
      <p>
        New here?{" "}
        <button type="button" onClick={onShowRegister}>
          Create an account
        </button>
      </p>
    </form>
  );
}

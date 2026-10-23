import { useState } from "react";
import type { AuthApi } from "../auth/auth";
import { useFormSubmit } from "./useFormSubmit";

export function Register({
  auth,
  onRegistered,
  onShowSignIn,
}: {
  auth: AuthApi;
  onRegistered: (email: string) => void;
  onShowSignIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { pending, error, submit } = useFormSubmit(async () => {
    await auth.signUp(email, password);
    onRegistered(email);
  });

  return (
    <form onSubmit={submit}>
      <h1>Create your account</h1>
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
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>
        Create account
      </button>
      <p>
        Already have an account?{" "}
        <button type="button" onClick={onShowSignIn}>
          Sign in
        </button>
      </p>
    </form>
  );
}

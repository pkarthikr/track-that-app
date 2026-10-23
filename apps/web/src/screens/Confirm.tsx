import { useState } from "react";
import type { AuthApi } from "../auth/auth";
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
  const [code, setCode] = useState("");
  const { pending, error, submit } = useFormSubmit(async () => {
    await auth.confirmSignUp(email, code);
    onConfirmed();
  });

  return (
    <form onSubmit={submit}>
      <h1>Confirm your email</h1>
      <p>We sent a 6-digit code to {email}.</p>
      <label>
        Confirmation code
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>
        Confirm
      </button>
    </form>
  );
}

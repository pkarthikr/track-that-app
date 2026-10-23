import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { AuthFailure } from "../auth/auth";
import { messageFor } from "../auth/messages";

/**
 * Shared submit handling for the auth forms: prevents default, ignores
 * re-submits while a request is in flight, tracks pending state and turns
 * failures into the message to display.
 *
 * `run` performs the request and any follow-up navigation. `onFailure` may
 * handle a failure itself (returning true) to suppress the alert.
 */
export function useFormSubmit(
  run: () => Promise<void>,
  onFailure?: (failure: AuthFailure) => boolean,
) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await run();
    } catch (caught) {
      const failure = caught instanceof AuthFailure ? caught : new AuthFailure("unknown");
      if (!onFailure?.(failure)) setError(messageFor(failure.code));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { pending, error, submit };
}

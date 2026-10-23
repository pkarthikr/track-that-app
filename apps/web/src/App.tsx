import { useEffect, useState } from "react";
import type { AuthApi } from "./auth/auth";
import { authApi } from "./auth/auth";
import { Confirm } from "./screens/Confirm";
import { Register } from "./screens/Register";
import { SignedIn } from "./screens/SignedIn";
import { SignIn } from "./screens/SignIn";

type View =
  | { name: "loading" }
  | { name: "register" }
  | { name: "confirm"; email: string }
  | { name: "signIn" }
  | { name: "signedIn"; email: string };

export function App({ auth = authApi }: { auth?: AuthApi }) {
  const [view, setView] = useState<View>({ name: "loading" });

  useEffect(() => {
    let cancelled = false;
    auth.getCurrentUser().then((email) => {
      if (cancelled) return;
      setView(email ? { name: "signedIn", email } : { name: "signIn" });
    });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  switch (view.name) {
    case "loading":
      return <p>Loading…</p>;
    case "register":
      return (
        <Register
          auth={auth}
          onRegistered={(email) => setView({ name: "confirm", email })}
          onShowSignIn={() => setView({ name: "signIn" })}
        />
      );
    case "confirm":
      return (
        <Confirm auth={auth} email={view.email} onConfirmed={() => setView({ name: "signIn" })} />
      );
    case "signIn":
      return (
        <SignIn
          auth={auth}
          onSignedIn={(email) => setView({ name: "signedIn", email })}
          onNeedsConfirmation={(email) => setView({ name: "confirm", email })}
          onShowRegister={() => setView({ name: "register" })}
        />
      );
    case "signedIn":
      return (
        <SignedIn
          email={view.email}
          onSignOut={() => {
            void auth.signOut().then(() => setView({ name: "signIn" }));
          }}
        />
      );
  }
}

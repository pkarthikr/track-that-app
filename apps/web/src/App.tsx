import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import type { AuthApi } from "./auth/auth";
import { authApi } from "./auth/auth";
import { Confirm } from "./screens/Confirm";
import { Register } from "./screens/Register";
import { SignedIn } from "./screens/SignedIn";
import { SignIn } from "./screens/SignIn";

type Session = { status: "loading" } | { status: "in"; email: string } | { status: "out" };

function ConfirmRoute({ auth }: { auth: AuthApi }) {
  const navigate = useNavigate();
  const state = useLocation().state as { email?: unknown } | null;
  const email = typeof state?.email === "string" ? state.email : null;
  if (!email) return <Navigate to="/register" replace />;
  return <Confirm auth={auth} email={email} onConfirmed={() => navigate("/sign-in")} />;
}

export function App({ auth = authApi }: { auth?: AuthApi }) {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    auth.getCurrentUser().then((email) => {
      if (cancelled) return;
      setSession(email ? { status: "in", email } : { status: "out" });
    });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  if (session.status === "loading") return <p>Loading…</p>;

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={session.status === "in" ? "/home" : "/sign-in"} replace />}
      />
      <Route
        path="/sign-in"
        element={
          <SignIn
            auth={auth}
            onSignedIn={(email) => {
              setSession({ status: "in", email });
              navigate("/home");
            }}
            onNeedsConfirmation={(email) => navigate("/confirm", { state: { email } })}
            onShowRegister={() => navigate("/register")}
          />
        }
      />
      <Route
        path="/register"
        element={
          <Register
            auth={auth}
            onRegistered={(email) => navigate("/confirm", { state: { email } })}
            onShowSignIn={() => navigate("/sign-in")}
          />
        }
      />
      <Route path="/confirm" element={<ConfirmRoute auth={auth} />} />
      <Route
        path="/home"
        element={
          session.status === "in" ? (
            <SignedIn
              email={session.email}
              onSignOut={() => {
                void auth.signOut().then(() => {
                  setSession({ status: "out" });
                  navigate("/sign-in");
                });
              }}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

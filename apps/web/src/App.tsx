import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import type { AuthApi } from "./auth/auth";
import { authApi } from "./auth/auth";
import { Confirm } from "./screens/Confirm";
import { Features } from "./screens/Features";
import { Landing } from "./screens/Landing";
import { Register } from "./screens/Register";
import { SignedIn } from "./screens/SignedIn";
import { SignIn } from "./screens/SignIn";

type Session = { status: "loading" } | { status: "in"; email: string } | { status: "out" };

function ConfirmRoute({ auth, signedIn }: { auth: AuthApi; signedIn: boolean }) {
  const navigate = useNavigate();
  const state = useLocation().state as { email?: unknown } | null;
  const email = typeof state?.email === "string" ? state.email : null;
  if (signedIn) return <Navigate to="/home" replace />;
  if (!email) return <Navigate to="/register" replace />;
  return (
    <Confirm
      auth={auth}
      email={email}
      onConfirmed={() => navigate("/sign-in", { replace: true })}
    />
  );
}

export function App({ auth = authApi }: { auth?: AuthApi }) {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    auth
      .getCurrentUser()
      .then((email) => {
        if (cancelled) return;
        setSession(email ? { status: "in", email } : { status: "out" });
      })
      .catch(() => {
        if (!cancelled) setSession({ status: "out" });
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  if (session.status === "loading") return <p>Loading…</p>;
  const signedIn = session.status === "in";

  return (
    <Routes>
      <Route path="/" element={signedIn ? <Navigate to="/home" replace /> : <Landing />} />
      <Route path="/features" element={<Features />} />
      <Route
        path="/sign-in"
        element={
          signedIn ? (
            <Navigate to="/home" replace />
          ) : (
            <SignIn
              auth={auth}
              onSignedIn={(email) => {
                setSession({ status: "in", email });
                navigate("/home", { replace: true });
              }}
              onNeedsConfirmation={(email) => navigate("/confirm", { state: { email } })}
              onShowRegister={() => navigate("/register")}
            />
          )
        }
      />
      <Route
        path="/register"
        element={
          signedIn ? (
            <Navigate to="/home" replace />
          ) : (
            <Register
              auth={auth}
              onRegistered={(email) => navigate("/confirm", { state: { email } })}
              onShowSignIn={() => navigate("/sign-in")}
            />
          )
        }
      />
      <Route path="/confirm" element={<ConfirmRoute auth={auth} signedIn={signedIn} />} />
      <Route
        path="/home"
        element={
          session.status === "in" ? (
            <SignedIn
              email={session.email}
              onSignOut={() => {
                void auth.signOut().then(() => {
                  setSession({ status: "out" });
                  navigate("/sign-in", { replace: true });
                });
              }}
            />
          ) : (
            <Navigate to="/sign-in" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

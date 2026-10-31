import { authApi } from "@pkarthikr/auth-client";
import type { AuthApi } from "@pkarthikr/auth-client";
import { AuthProvider, Confirm, Register, SignIn, useAuthSession } from "@pkarthikr/auth-react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { PageShell } from "./design/PageShell";
import type { HabitsApi } from "./habits/api";
import { Features } from "./screens/Features";
import { Home } from "./screens/Home";
import { Landing } from "./screens/Landing";

const AUTH_PATHS = { signIn: "/sign-in", register: "/register", confirm: "/confirm" };

function ConfirmRoute({ signedIn }: { signedIn: boolean }) {
  const navigate = useNavigate();
  const state = useLocation().state as { email?: unknown } | null;
  const email = typeof state?.email === "string" ? state.email : null;
  if (signedIn) return <Navigate to="/home" replace />;
  if (!email) return <Navigate to="/register" replace />;
  return (
    <PageShell back={{ to: "/register" }}>
      <Confirm email={email} onConfirmed={() => navigate("/sign-in", { replace: true })} />
    </PageShell>
  );
}

export function App({ auth = authApi, habits }: { auth?: AuthApi; habits: HabitsApi }) {
  const { session, signedIn: markSignedIn, signOut } = useAuthSession(auth);
  const navigate = useNavigate();

  if (session.status === "loading") return <p>Loading…</p>;
  const signedIn = session.status === "in";

  return (
    <AuthProvider auth={auth} appName="Track That" paths={AUTH_PATHS} LinkComponent={Link}>
      <Routes>
        <Route path="/" element={signedIn ? <Navigate to="/home" replace /> : <Landing />} />
        <Route path="/features" element={<Features />} />
        <Route
          path="/sign-in"
          element={
            signedIn ? (
              <Navigate to="/home" replace />
            ) : (
              <PageShell action={{ label: "Create account", to: "/register" }}>
                <SignIn
                  onSignedIn={(email) => {
                    markSignedIn(email);
                    navigate("/home", { replace: true });
                  }}
                  onNeedsConfirmation={(email) => navigate("/confirm", { state: { email } })}
                />
              </PageShell>
            )
          }
        />
        <Route
          path="/register"
          element={
            signedIn ? (
              <Navigate to="/home" replace />
            ) : (
              <PageShell action={{ label: "Sign in", to: "/sign-in" }}>
                <Register onRegistered={(email) => navigate("/confirm", { state: { email } })} />
              </PageShell>
            )
          }
        />
        <Route path="/confirm" element={<ConfirmRoute signedIn={signedIn} />} />
        <Route
          path="/home"
          element={
            session.status === "in" ? (
              <Home
                email={session.email}
                api={habits}
                onNewHabit={() => navigate("/habits/new")}
                onOpenHabit={(id) => navigate(`/habits/${id}`)}
                onSignOut={() => {
                  void signOut().then(() => navigate("/sign-in", { replace: true }));
                }}
              />
            ) : (
              <Navigate to="/sign-in" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

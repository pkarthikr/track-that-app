export function SignedIn({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <main>
      <h1>Welcome</h1>
      <p>{email}</p>
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </main>
  );
}

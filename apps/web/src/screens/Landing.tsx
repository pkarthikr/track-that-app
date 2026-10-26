import { Button } from "../design/Button";
import { HabitCard } from "../design/HabitCard";
import { PageShell } from "../design/PageShell";
import { usePageTitle } from "../design/usePageTitle";
import "./Landing.css";

export function Landing() {
  usePageTitle("Track That: Welcome");

  return (
    <PageShell>
      <main className="landing">
        <h1 className="landing__title">Build habits you can see.</h1>
        <HabitCard
          name="Go to the gym"
          color="coral"
          days={["open", "done", "open", "done", "open", "done", "open"]}
          decorative
        />
        <div className="landing__actions">
          <Button to="/register">Get started</Button>
          <Button variant="ghost" to="/sign-in">
            Sign in
          </Button>
        </div>
      </main>
    </PageShell>
  );
}

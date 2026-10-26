import { Button } from "../design/Button";
import { ColorSwatches } from "../design/ColorSwatches";
import { HabitCard } from "../design/HabitCard";
import { LogoMark } from "../design/LogoMark";
import { PageShell } from "../design/PageShell";
import { usePageTitle } from "../design/usePageTitle";
import "./Features.css";

const STEPS = [
  {
    lead: "Add a habit.",
    rest: " Give it a name, choose your days, pick a color.",
    square: "features__square--green",
  },
  {
    lead: "Check in.",
    rest: " One tap. Days you skipped stay tickable.",
    square: "features__square--blue",
  },
  {
    lead: "Watch it fill in.",
    rest: " Each week lines up as a row of circles in your color.",
    square: "features__square--coral",
  },
] as const;

export function Features() {
  usePageTitle("Track That: Features");

  return (
    <PageShell>
      <main className="features">
        <h1 className="features__title">Features</h1>
        <div className="features__cards">
          <HabitCard
            name="Read 20 pages"
            color="blue"
            days={["done", "done", "open", "done", "open", "done", "open"]}
            decorative
          />
          <HabitCard
            name="Water the plants"
            color="green"
            days={["open", "open", "done", "open", "done", "open", "open"]}
            decorative
          />
        </div>
        <section className="features__section">
          <h2 className="features__heading">Three steps, nothing else.</h2>
          <p className="features__text">No streak math, no points. Just whether you did it.</p>
          <ul className="features__steps">
            {STEPS.map((step) => (
              <li key={step.lead} className="features__step">
                <span className={`features__square ${step.square}`} aria-hidden="true" />
                <span>
                  <strong className="features__lead">{step.lead}</strong>
                  {step.rest}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="features__section">
          <h2 className="features__heading">Your color, your habit.</h2>
          <ColorSwatches />
        </section>
        <section className="features__closing">
          <h2 className="features__closing-title">Start with one habit.</h2>
          <p className="features__text">It takes about ten seconds to set up.</p>
          <Button to="/register">Get started</Button>
        </section>
        <footer className="features__footer">
          <LogoMark size={16} />
          <span>Track That</span>
        </footer>
      </main>
    </PageShell>
  );
}

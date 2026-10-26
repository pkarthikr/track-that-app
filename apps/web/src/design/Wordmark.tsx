import { LogoMark } from "./LogoMark";
import "./Wordmark.css";

const TYPE_SIZE = { sm: 18, lg: 36 } as const;

export function Wordmark({
  variant = "horizontal",
  size = "lg",
}: {
  variant?: "horizontal" | "stacked";
  size?: "sm" | "lg";
}) {
  const className = [
    "wordmark",
    variant === "stacked" ? "wordmark--stacked" : "",
    `wordmark--${size}`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={className}>
      <LogoMark size={Math.round(TYPE_SIZE[size] * 1.3)} />
      <span className="wordmark__text">Track That</span>
    </span>
  );
}

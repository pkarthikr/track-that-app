import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { configureAuth } from "./auth/config";

const root = createRoot(document.getElementById("root")!);

try {
  configureAuth();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  root.render(
    <StrictMode>
      <p role="alert">{message}</p>
    </StrictMode>,
  );
}

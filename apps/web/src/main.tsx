import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";

import "./design/tokens.css";
import "./design/base.css";

import { App } from "./App";
import { configureAuth } from "./auth/config";

const root = createRoot(document.getElementById("root")!);

try {
  configureAuth();
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
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

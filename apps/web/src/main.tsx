import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";

import "@pkarthikr/auth-react/theme.css";

import "./design/tokens.css";
import "./design/base.css";

import { configureAuth } from "@pkarthikr/auth-client";
import { App } from "./App";
import { createHabitsApi, idToken, readApiUrl } from "./habits/api";

const root = createRoot(document.getElementById("root")!);

try {
  configureAuth(import.meta.env);
  const habits = createHabitsApi({ baseUrl: readApiUrl(import.meta.env), getToken: idToken });
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App habits={habits} />
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

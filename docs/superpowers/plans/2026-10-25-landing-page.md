# Landing Page and Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a styled Landing (`/`) and Features (`/features`) page on real URLs, built on a reusable design system in `apps/web`.

**Architecture:** `react-router` replaces the `useState` view switch in `App.tsx`; existing auth screens keep their props and are wired with `useNavigate`. The design system is plain CSS (custom properties plus one CSS file per component) and small React components under `apps/web/src/design/`. Fonts are self-hosted through Fontsource so the CloudFront CSP (`style-src 'self'`, no inline styles) holds.

**Tech Stack:** React 19, react-router, Vite 8, Vitest + Testing Library (jsdom), `@fontsource-variable/bricolage-grotesque`, `@fontsource/dm-sans`.

**Spec:** `docs/superpowers/specs/2026-10-25-landing-page-design.md`

## Global Constraints

- All work is in `apps/web`. No change to `infra/`, the CSP, or workflows.
- No inline `style=` attributes in markup and no external font/CSS URLs (CSP: `style-src 'self'`, `script-src 'self'`, `img-src 'self' data:`). Vary appearance with class names, not style props.
- Assets must never be inlined as `data:` URIs (fonts are blocked by `default-src 'self'`): set `build.assetsInlineLimit: 0`.
- Palette values come from the spec's table, verbatim. Neutrals: ground `#F5F6F1`, surface `#FFFFFF`, ink `#17231D`, muted `#5E6B63`, border `#E1E6DE`, empty cell `#E3E8E1`, ghost hover `#EEF0EA`, ghost border `#B9C4BC`, brand green `#14804F`.
- Type: Bricolage Grotesque 700 (display), DM Sans 400/500/600 (body). Sizes size/line-height: 40/44, 32/38, 24/30, 17/22, 16/24.
- Touch targets at least 44px; buttons 52px tall; focus ring is a 3px solid `#14804F` outline with 2px offset.
- Copy is exactly as in the spec; the Features page omits the design's "coming soon" line.
- Existing screens (`SignIn`, `Register`, `Confirm`, `SignedIn`) keep their props and markup.
- Commands run from the repo root. Single test file: `pnpm --filter @trackthat/web exec vitest run <path>`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branch: `feature/landing-page` (work in a worktree off it).

## Review Focus

1. Deep link `/confirm` opened with no router state (hard refresh): redirect to `/register`, never render "We sent a code to undefined". Pinned in Task 1.
2. Signed-in visitor opening `/` or a signed-out visitor opening `/home`: redirected to `/home` and `/sign-in` respectively, with no flash of the wrong screen while the session check runs. Pinned in Task 1.
3. Unknown path such as `/nope`: lands on `/`, not a blank page. Pinned in Task 1.
4. Fonts or SVG inlined as `data:` URIs in the build: silently blocked in production by the CSP. Pinned by the build check in Task 2 and Task 9.
5. Sample week circles: today must be distinguishable without colour, and the decorative copy must not be read twice by screen readers. Pinned in Task 5.

---

### Task 1: Routing

**Files:**

- Modify: `apps/web/package.json` (add `react-router`), `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/src/App.test.tsx`

**Interfaces:**

- Produces: `App({ auth }: { auth?: AuthApi })` rendered inside a router (it no longer creates one); `main.tsx` wraps it in `BrowserRouter`. Route table: `/`, `/sign-in`, `/register`, `/confirm`, `/home`, `*` → `<Navigate to="/" replace />`. Until Task 7, `/` renders `<Navigate to="/sign-in" replace />` for signed-out visitors and `<Navigate to="/home" replace />` for signed-in ones; Task 7 replaces the signed-out branch with `<Landing />`.
- Session state in `App`: `{ status: "loading" } | { status: "in"; email: string } | { status: "out" }`, set once from `auth.getCurrentUser()`, updated by `onSignedIn` and sign-out.

- [ ] **Step 1: Install** `react-router` (current major) into `@trackthat/web` with `pnpm --filter @trackthat/web add react-router`.
- [ ] **Step 2: Rewrite `App.test.tsx`** around a helper `renderApp(auth, path = "/")` that wraps `<App auth={auth} />` in a `MemoryRouter` at `path`. Keep the existing cases (restore session shows "Welcome"; no session shows the "Sign in" heading; register → confirm → sign in → welcome → sign out; unconfirmed user sent to confirm; "Loading…" with no headings or textboxes before the session resolves). Add: `/home` signed out shows the "Sign in" heading; `/` signed in shows "Welcome"; `/confirm` with no state shows "Create your account"; `/nope` signed out ends on the "Sign in" heading (via `/`). Where an existing case starts at `/`, it now ends on `/sign-in` through the temporary redirect.
- [ ] **Step 3: Run** `pnpm --filter @trackthat/web exec vitest run src/App.test.tsx`. Expected: FAIL (no router yet).
- [ ] **Step 4: Implement** `App.tsx` with `Routes`/`Route`. A small in-file `ConfirmRoute` reads `useLocation().state?.email` (string) and renders `<Navigate to="/register" replace />` when absent. Screens receive callbacks implemented with `useNavigate`: `onRegistered(email)` → `navigate("/confirm", { state: { email } })`; `onNeedsConfirmation` likewise; `onConfirmed` and `onShowSignIn` → `/sign-in`; `onShowRegister` → `/register`; `onSignedIn(email)` sets session then → `/home`; sign-out clears session then → `/sign-in`. While `status` is `loading`, render `<p>Loading…</p>` for every route. Update `main.tsx` to wrap in `BrowserRouter`.
- [ ] **Step 5: Run** the same command. Expected: PASS. Then `pnpm --filter @trackthat/web typecheck` and `lint`: clean.
- [ ] **Step 6: Commit** `feat(web): route screens with react-router`.

### Task 2: Tokens, fonts, palette

**Files:**

- Create: `apps/web/src/design/tokens.css`, `apps/web/src/design/base.css`, `apps/web/src/design/palette.ts`, `apps/web/src/design/palette.test.ts`
- Modify: `apps/web/package.json` (add the two Fontsource packages), `apps/web/vite.config.ts`, `apps/web/src/main.tsx`

**Interfaces:**

- Produces: `type HabitColor = "green" | "teal" | "blue" | "violet" | "pink" | "coral" | "orange"`; `export const HABIT_COLORS: readonly HabitColor[]` (in that order); `export const palette: Record<HabitColor, readonly [string, string, string, string]>` (steps 1–4); `habitColor(color: HabitColor): string` returning step 4. CSS variables `--habit-<colour>-<1..4>`, `--color-ground`, `--color-surface`, `--color-ink`, `--color-muted`, `--color-border`, `--color-empty`, `--color-ghost-hover`, `--color-ghost-border`, `--color-brand`, `--font-display`, `--font-body`, and radii `--radius-sm|md|lg|xl|pill`.

- [ ] **Step 1: Write the failing test** `palette.test.ts`: for every colour in `HABIT_COLORS`, `palette[color]` equals the spec table row exactly (assert all 28 hexes via an inline expected object); `HABIT_COLORS` has 7 entries; `habitColor("green")` is `"#14804F"`; and `tokens.css` read with `node:fs` contains each hex of `palette` under the matching `--habit-<colour>-<step>` name (guards drift between TS and CSS).
- [ ] **Step 2: Run** `pnpm --filter @trackthat/web exec vitest run src/design/palette.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `palette.ts` and `tokens.css` with the spec's values. `base.css` sets `body` background/ink/font-family/`-webkit-font-smoothing`, `margin: 0`, `box-sizing: border-box` everywhere, and a global `:focus-visible` ring per the constraints. Add the Fontsource packages and import `@fontsource-variable/bricolage-grotesque/wght.css`, `@fontsource/dm-sans/400.css`, `500.css`, `600.css`, then `tokens.css` and `base.css`, in `main.tsx`. Set `build.assetsInlineLimit: 0` in `vite.config.ts`.
- [ ] **Step 4: Run** the test: PASS. Then `pnpm --filter @trackthat/web build` and confirm `grep -r "data:font" apps/web/dist` finds nothing and `dist/assets` contains `.woff2` files.
- [ ] **Step 5: Commit** `feat(web): add design tokens, self-hosted fonts and palette`.

### Task 3: LogoMark and Wordmark

**Files:**

- Create: `apps/web/src/design/LogoMark.tsx`, `LogoMark.test.tsx`, `Wordmark.tsx`, `Wordmark.test.tsx`, `Wordmark.css`

**Interfaces:**

- Produces: `LogoMark({ size?: number; mono?: boolean }): JSX.Element` (default `size` 24; `aria-hidden` SVG; four rounded squares on a 46-unit viewBox: cells 20, offsets 0 and 26, `rx` 6; fills `palette.green` steps 1–4, or white at opacity 0.38/0.58/0.8/1 when `mono`). `Wordmark({ variant?: "horizontal" | "stacked"; size?: "sm" | "lg" }): JSX.Element` renders the mark plus text "Track That" in the display font; `sm` = 18px type, `lg` = 36px; the mark is 1.3× the type size, rounded.

- [ ] **Step 1: Write failing tests.** LogoMark: renders an `svg` with `aria-hidden="true"`, `width`/`height` equal to `size`, four `rect`s whose `fill` values equal `palette.green`; `mono` gives all-white fills with the four opacities above. Wordmark: text "Track That" is present; `sm` mark has width 23, `lg` has 47; `variant="stacked"` adds the class `wordmark--stacked`.
- [ ] **Step 2: Run** both files with `vitest run`. Expected: FAIL.
- [ ] **Step 3: Implement** both components and `Wordmark.css` (classes `wordmark`, `wordmark--stacked`, `wordmark--sm`, `wordmark--lg`; `letter-spacing: -0.01em`).
- [ ] **Step 4: Run** the tests: PASS.
- [ ] **Step 5: Commit** `feat(web): add LogoMark and Wordmark`.

### Task 4: Button

**Files:**

- Create: `apps/web/src/design/Button.tsx`, `Button.test.tsx`, `Button.css`

**Interfaces:**

- Produces: `Button(props: { variant?: "primary" | "ghost"; children: ReactNode } & ({ to: string } | ({ to?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>))): JSX.Element`. With `to` it renders a react-router `Link` (an `<a href>`), otherwise a `<button type="button">` by default. Default variant `primary`. Classes `button`, `button--primary`, `button--ghost`.

- [ ] **Step 1: Write failing tests** (render inside `MemoryRouter`): with `to="/register"` the element has role `link`, name "Get started", `href` ending `/register`; without `to` it has role `button` and `type="button"`; `variant="ghost"` adds class `button--ghost`; the default adds `button--primary`; clicking the button fires `onClick`.
- [ ] **Step 2: Run** `vitest run src/design/Button.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `Button.tsx` and `Button.css`: height 52px, radius 12px, 17px/600 text, full-width flex centring. Primary: green background, white text, `filter: brightness(0.92)` on hover. Ghost: white background, ink text, 1px `--color-ghost-border` border, `--color-ghost-hover` background on hover.
- [ ] **Step 4: Run** the test: PASS.
- [ ] **Step 5: Commit** `feat(web): add Button`.

### Task 5: WeekRow and HabitCard

**Files:**

- Create: `apps/web/src/design/WeekRow.tsx`, `WeekRow.test.tsx`, `HabitCard.tsx`, `HabitCard.test.tsx`, `HabitCard.css`

**Interfaces:**

- Consumes: `HabitColor`, `habitColor` from `./palette`.
- Produces: `type DayState = "done" | "open"`; `type WeekDays = readonly [DayState, DayState, DayState, DayState, DayState, DayState, DayState]` (both exported from `WeekRow.tsx`); `WeekRow({ days, color }: { days: WeekDays; color: HabitColor })` — Sunday to Saturday, the last cell is today. Each cell is a `div role="img"` labelled like `"Monday: done"`, with today's label `"Saturday (today): not done"`, using the words `done` / `not done`; today also gets class `week-row__cell--today` (outline, not colour-only). `HabitCard({ name, color, days, decorative }: { name: string; color: HabitColor; days: WeekDays; decorative?: boolean })` — a coloured ring (`aria-hidden`), the name, and the `WeekRow`. When `decorative` is set, the whole `WeekRow` is wrapped in an `aria-hidden="true"` element and the name stays readable.

- [ ] **Step 1: Write failing tests.** WeekRow: seven `img` roles; labels are exactly "Sunday: not done", "Monday: done", … , "Saturday (today): done" for `["open","done","open","done","open","done","done"]`; only the last has class `week-row__cell--today`; done cells carry the colour class for the given `HabitColor`. HabitCard: shows the name; with `decorative` there are no `img` roles reachable by `getAllByRole("img")` (hidden subtree), without it there are seven.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement.** Done cells need one class per colour (`week-row__cell--green` …) whose background is `var(--habit-<colour>-4)`, defined in `HabitCard.css` along with the card, ring (28px, 2.5px border in the colour), and the 7-column grid with 6px gap. Do not use style props.
- [ ] **Step 4: Run** the tests: PASS.
- [ ] **Step 5: Commit** `feat(web): add WeekRow and HabitCard`.

### Task 6: ColorSwatches and PageShell

**Files:**

- Create: `apps/web/src/design/ColorSwatches.tsx`, `ColorSwatches.test.tsx`, `PageShell.tsx`, `PageShell.test.tsx`, `PageShell.css`

**Interfaces:**

- Consumes: `HABIT_COLORS`; `Wordmark`, `LogoMark` from Task 3.
- Produces: `ColorSwatches(): JSX.Element` — seven `role="img"` dots with `aria-label` "Green", "Teal", "Blue", "Violet", "Pink", "Coral", "Orange" (44px circles, class per colour). `PageShell({ children }: { children: ReactNode })` — a centred column (max-width 560px, padding 12px 16px 40px, 24px gap) with a header: a link named "Track That" to `/` containing `Wordmark` (`sm`), and a "Sign in" link to `/sign-in` (44px high, green, 16px/600).

- [ ] **Step 1: Write failing tests** (inside `MemoryRouter`): ColorSwatches renders seven images with those names in order. PageShell renders its children, a link "Track That" with `href` `/`, and a link "Sign in" with `href` `/sign-in`.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement** both components with their CSS.
- [ ] **Step 4: Run** the tests: PASS.
- [ ] **Step 5: Commit** `feat(web): add ColorSwatches and PageShell`.

### Task 7: Landing page

**Files:**

- Create: `apps/web/src/design/usePageTitle.ts`, `apps/web/src/screens/Landing.tsx`, `Landing.test.tsx`, `Landing.css`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`

**Interfaces:**

- Consumes: `PageShell`, `HabitCard`, `Button`.
- Produces: `usePageTitle(title: string): void` (sets `document.title` in an effect); `Landing(): JSX.Element` with title "Track That: Welcome".

- [ ] **Step 1: Write failing tests** in `Landing.test.tsx` (inside `MemoryRouter`): heading level 1 "Build habits you can see."; link "Get started" → `/register`; the page has two "Sign in" links (header and ghost button) both → `/sign-in`; the text "Go to the gym" is present; no element with role `img` is reachable inside the sample card; `document.title` is "Track That: Welcome". In `App.test.tsx`, change the "no session" cases that start at `/` to expect the Landing heading, and drop the temporary redirect.
- [ ] **Step 2: Run** `vitest run src/screens/Landing.test.tsx src/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `Landing` per the spec: `PageShell`; `h1` at 40/44 display; `HabitCard` with name "Go to the gym", colour `coral`, `decorative`, days Sunday→Saturday `open, done, open, done, open, done, open` (Mon/Wed/Fri done, Saturday today open); a column of primary "Get started" (`to="/register"`) and ghost "Sign in" (`to="/sign-in"`) with 10px gap. In `App.tsx`, `/` renders `<Landing />` when signed out.
- [ ] **Step 4: Run** the same command: PASS; then typecheck and lint.
- [ ] **Step 5: Commit** `feat(web): add landing page`.

### Task 8: Features page

**Files:**

- Create: `apps/web/src/screens/Features.tsx`, `Features.test.tsx`, `Features.css`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`

**Interfaces:**

- Consumes: `PageShell`, `HabitCard`, `ColorSwatches`, `Button`, `LogoMark`, `usePageTitle`.
- Produces: `Features(): JSX.Element` with title "Track That: Features", routed at `/features`.

- [ ] **Step 1: Write failing tests** (inside `MemoryRouter`): level-1 heading "Features"; level-2 headings "Three steps, nothing else.", "Your color, your habit.", "Start with one habit."; the three steps "Add a habit.", "Check in.", "Watch it fill in." appear in a list of three items; seven colour swatches; no text matching `coming soon`; link "Get started" → `/register`; header link "Track That" → `/`; `document.title` is "Track That: Features". In `App.test.tsx`: a signed-out visitor at `/features` sees the Features heading.
- [ ] **Step 2: Run** `vitest run src/screens/Features.test.tsx src/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the page with the copy in the spec: two decorative `HabitCard`s ("Read 20 pages", blue, `done, done, open, done, open, done, open`; "Water the plants", green, `open, open, done, open, done, open, open`), the steps with 12px squares in `palette.green[1]`, `palette.blue[2]`, `palette.coral[2]`, the swatches, the closing white card (20px radius, centred, 28/34 heading, "It takes about ten seconds to set up." text, primary "Get started"), and a footer with a 16px `LogoMark` and "Track That". Add the `/features` route.
- [ ] **Step 4: Run** the same command: PASS; then typecheck and lint.
- [ ] **Step 5: Commit** `feat(web): add features page`.

### Task 9: Metadata, docs and verification

**Files:**

- Create: `apps/web/public/favicon.svg`
- Modify: `apps/web/index.html`, `README.md`

- [ ] **Step 1: Add** the favicon (the four-square mark using the `palette.green` fills) and update `index.html`: title "Track That", `<meta name="description" content="Build habits you can see.">`, `<meta name="theme-color" content="#F5F6F1">`, `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`.
- [ ] **Step 2: Update `README.md`**: the folder-layout line for `apps/web` mentions the design system and the Landing/Features pages; add a short note that all web styling must stay CSP-safe (no inline styles, self-hosted fonts).
- [ ] **Step 3: Run** `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Expected: all pass. Then confirm `grep -r "data:font\|style=\"" apps/web/dist` finds nothing.
- [ ] **Step 4: Serve** the built site (`pnpm --filter @trackthat/web exec vite preview`) and, in a browser, check `/`, `/features`, `/sign-in`, a hard refresh on `/features`, and `/nope`, at 390px and at desktop width. Report anything that differs from the design. Preview does not run CloudFront, so the deep-link fallback is covered by the existing `infra/lib/web-stack.test.ts` assertion only.
- [ ] **Step 5: Commit** `feat(web): add page metadata and document the design system`.

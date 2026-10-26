# Auth Screens Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Sign in, Register and Confirm to match the Design canvas, using the existing design system.

**Architecture:** Three small form components (`FormCard`, `TextField`, `PasswordField`) join `apps/web/src/design/`, each with a co-located plain CSS file. `PageShell` and `Button` gain small, backwards-compatible extensions. The three screens are rewritten on top of them; `useFormSubmit`, `AuthApi` and `messageFor` are untouched. Submit buttons are disabled until a shared validation rule passes.

**Tech Stack:** React 19, react-router, Vite, Vitest + Testing Library, plain CSS with custom properties.

**Spec:** `docs/superpowers/specs/2026-10-25-auth-screens-design.md`

## Global Constraints

- CSP is `style-src 'self'`: CSS files only, no inline `style=` anywhere.
- Use existing tokens (`--color-*`, `--radius-*`, `--font-display`, `--font-body`); new tokens only: `--color-error: #b3261e` and `--color-brand-tint: #e3f3e8`.
- Screens render inside a router; tests wrap them in `<MemoryRouter>`.
- Accessible names tests rely on: inputs by label text `Email`, `Password`, `Confirmation code`; submit buttons `Sign in`, `Create account`, `Verify and continue`.
- Out of scope: `SignedIn`, "Forgot password?", "Send a new code", Terms/Privacy line, any change to `AuthApi`, `useFormSubmit`, `messageFor`, routes, infra.
- Run from `apps/web`; verify with `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Email with leading/trailing spaces (`a@b.com`) must count as valid, since `authApi` trims it. Pinned in Task 1.
- Password of exactly 7 characters is invalid and 8 is valid on Register. Pinned in Task 3.
- Submitting an invalid form without the button (Enter key, `fireEvent.submit`) must not call `AuthApi`. Pinned in Task 3 and Task 4.
- Pasted code with spaces or letters (`12 ab34 56`) becomes digits only, capped at 6. Pinned in Task 4.
- A long email in the Confirm sentence must wrap at 390px instead of overflowing. Checked in the browser in Task 5 (CSS: `overflow-wrap: anywhere`).

---

### Task 1: Validation helpers, tokens, Button disabled style, PageShell variants

**Files:**

- Create: `apps/web/src/auth/validation.ts`, `apps/web/src/auth/validation.test.ts`
- Modify: `apps/web/src/design/tokens.css`, `Button.css`, `Button.test.tsx`, `PageShell.tsx`, `PageShell.css`, `PageShell.test.tsx` (all under `apps/web/src/design/`)

**Interfaces:**

- Produces:
  - `isPlausibleEmail(email: string): boolean` (trims, then `/^\S+@\S+\.\S+$/`)
  - `PASSWORD_MIN_LENGTH = 8`, `CODE_LENGTH = 6` (exported consts)
  - `PageShell({ children, action?, back? }: { children: ReactNode; action?: { label: string; to: string }; back?: { to: string } })`

- [ ] **Step 1: Write failing tests**
  - `validation.test.ts`: `isPlausibleEmail(" a@b.com ")` true; `"a@b"`, `""`, `"a b@c.com"` false; `PASSWORD_MIN_LENGTH` is 8 and `CODE_LENGTH` is 6.
  - `Button.test.tsx`: a `<Button disabled>Go</Button>` is `disabled` and does not fire `onClick`.
  - `PageShell.test.tsx`: default still shows "Sign in" → `/sign-in`; `action={{ label: "Create account", to: "/register" }}` shows that link and no "Sign in" link; `back={{ to: "/register" }}` shows a "Back" link to `/register` and no "Track That" link.
- [ ] **Step 2: Run `pnpm test validation Button PageShell` — expect failures**
- [ ] **Step 3: Implement**
  - `validation.ts` per the Interfaces block.
  - `tokens.css`: add `--color-error` and `--color-brand-tint` to `:root`.
  - `Button.css`: `.button:disabled` → background `var(--color-empty)`, color `var(--color-muted)`, `cursor: not-allowed`, border `none`; `.button:disabled:hover` keeps `filter: none` and the same background.
  - `PageShell.tsx`: when `back` is set render only a `<Link to={back.to} className="page-shell__back">` containing an `aria-hidden` chevron SVG (`<path d="M15 5l-7 7 7 7">`, stroke `currentColor`, 18px) and the text "Back"; otherwise the existing header, with the right-hand link taken from `action` (default `{ label: "Sign in", to: "/sign-in" }`). Rename the right-hand class use only if needed; keep `page-shell__sign-in` for it.
  - `PageShell.css`: `.page-shell__back` → inline-flex, 6px gap, min-height 44px, `align-self: flex-start`, 16px/500, `var(--color-brand)`, no underline, underline on hover.
- [ ] **Step 4: Run the same tests — expect PASS**
- [ ] **Step 5: Commit** `feat(web): add auth validation helpers, disabled button and PageShell variants`

---

### Task 2: FormCard, TextField, PasswordField

**Files:**

- Create (in `apps/web/src/design/`): `FormCard.tsx`, `FormCard.css`, `FormCard.test.tsx`, `TextField.tsx`, `TextField.css`, `TextField.test.tsx`, `PasswordField.tsx`, `PasswordField.test.tsx`

**Interfaces:**

- Consumes: `Button` (disabled style from Task 1) is used by screens, not here.
- Produces:
  - `FormCard({ title?, onSubmit, error?, children }: { title?: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; error?: string | null; children: ReactNode })` — `<form noValidate>` with an `<h1>` only when `title` is given; `error` renders `<p role="alert" className="form-card__error">` after `children`.
  - `TextField({ label, hint?, error?, ...input }: { label: string; hint?: string; error?: string | null } & InputHTMLAttributes<HTMLInputElement>)` — uses `useId`; `<label htmlFor>`; hint/error ids joined into `aria-describedby`; `error` is `role="alert"` and sets `aria-invalid`. Adds `className` passthrough via a `variant?: "code"` prop for Confirm's large input (class `text-field__input--code`).
  - `PasswordField(props: Omit<TextFieldProps, "type">)` — `TextField` plus a `type="button"` toggle with `aria-label` "Show password"/"Hide password" and visible text "Show"/"Hide", flipping the input between `password` and `text`. The toggle sits outside the `<label>`.

- [ ] **Step 1: Write failing tests**
  - `FormCard`: heading is `h1` with the title and absent when `title` is omitted; `onSubmit` fires on submit; `error` renders as an alert; no `[style]` attributes.
  - `TextField`: `getByLabelText("Email")` finds the input; hint text is in `aria-describedby`; with `error`, `getByRole("alert")` has the text, input has `aria-invalid="true"`.
  - `PasswordField`: `getByLabelText("Password")` has `type="password"`; clicking "Show password" makes it `text` and the button becomes "Hide password"; the typed value survives the toggle.
- [ ] **Step 2: Run `pnpm test FormCard TextField PasswordField` — expect failures**
- [ ] **Step 3: Implement the components and CSS**
  - `FormCard.css`: flex column, gap 20px, padding 20px, `var(--color-surface)` background, 1px `var(--color-border)` border, `var(--radius-xl)`; `h1` margin 0, `var(--font-display)`, 28/34, 700, letter-spacing -0.01em; `.form-card__error` margin 0, 15/20, 500, `var(--color-error)`.
  - `TextField.css`: field is flex column gap 8px; label 16/22 600; input width 100%, height 52px, padding 0 16px, `var(--radius-md)`, 1px `var(--color-ghost-border)` border, surface background, font inherit 16px; `[aria-invalid="true"]` → 2px `var(--color-error)` border; hint 14/20 `var(--color-muted)`; error 15/20 500 `var(--color-error)`; `--code` input → height 64px, 32px, 600, letter-spacing 0.4em, centred. Password wrapper is `position: relative`, input gets right padding 76px, toggle absolute right 4px top 4px, height 44px, padding 0 12px, no border, transparent, 15px 600 `var(--color-brand)`, radius 8px.
- [ ] **Step 4: Run the same tests — expect PASS**
- [ ] **Step 5: Commit** `feat(web): add FormCard, TextField and PasswordField`

---

### Task 3: Restyle SignIn and Register

**Files:**

- Modify: `apps/web/src/screens/SignIn.tsx`, `Register.tsx`, `SignIn.test.tsx`, `Register.test.tsx`, `apps/web/src/App.tsx`
- Create: `apps/web/src/screens/AuthScreen.css` (shared below-card line style)

**Interfaces:**

- Consumes: `PageShell` `action` prop, `FormCard`, `TextField`, `PasswordField`, `Button`, `isPlausibleEmail`, `PASSWORD_MIN_LENGTH`, `usePageTitle`.
- Produces: `SignIn({ auth, onSignedIn, onNeedsConfirmation })` and `Register({ auth, onRegistered })` — `onShowRegister` and `onShowSignIn` are removed.

- [ ] **Step 1: Update and add failing tests** (render everything in `<MemoryRouter>`)
  - Existing flows keep their assertions; the "links to register / sign in" tests become link checks: SignIn has a link "Create an account" → `/register` and a header link "Create account" → `/register`; Register has links "Sign in" → `/sign-in`.
  - New for both: submit button `disabled` until the rules hold (SignIn: valid email and non-empty password; Register: valid email and password ≥ `PASSWORD_MIN_LENGTH`); `" a@b.com "` counts as valid; Register with a 7-character password is disabled and with 8 enabled.
  - New for both: `fireEvent.submit` on the form while invalid does not call `signIn`/`signUp`.
  - New for SignIn: "Show password" toggles the field type. New for Register: the hint "At least 8 characters." is present. `document.title` is "Track That: Sign in" / "Track That: Create account".
  - Accessible-name caveat: with the header link also named "Sign in" on Register, tests query the submit button by role `button`, links by role `link`.
- [ ] **Step 2: Run `pnpm test screens/SignIn screens/Register` — expect failures**
- [ ] **Step 3: Implement**
  - Screens: `usePageTitle`, `<PageShell action=…>` wrapping a `<main>` with `<FormCard title onSubmit error={error}>`, fields, and `<Button type="submit" disabled={!valid || pending}>`. Wrap `submit` so it returns early when `!valid` (calling `event.preventDefault()` first). `SignIn` keeps the `user-not-confirmed` handler. Below the card: `<p className="auth-screen__switch">` with a `Link` (`New to Track That? Create an account` / `Already have an account? Sign in`).
  - `AuthScreen.css`: `.auth-screen__switch` centred, 16/24, `var(--color-muted)`; its link `var(--color-brand)`, 600.
  - `App.tsx`: drop `onShowRegister` and `onShowSignIn` props from the two routes (and `navigate` use that becomes unused, if any).
- [ ] **Step 4: Run `pnpm test` for the web app — expect PASS** (`App.test.tsx` keeps passing; fix only assertions that referenced removed buttons)
- [ ] **Step 5: Commit** `feat(web): restyle sign in and register`

---

### Task 4: Restyle Confirm

**Files:**

- Modify: `apps/web/src/screens/Confirm.tsx`, `Confirm.test.tsx`, `AuthScreen.css`, `apps/web/src/App.test.tsx`

**Interfaces:**

- Consumes: as Task 3, plus `CODE_LENGTH` and the `PageShell` `back` prop.
- Produces: `Confirm({ auth, email, onConfirmed })` — props unchanged.

- [ ] **Step 1: Update and add failing tests** (in `<MemoryRouter>`)
  - Heading becomes "Check your email"; the sentence contains the email in a `<strong>`; submit button is "Verify and continue" (update `Confirm.test.tsx` and the two `App.test.tsx` references to "Confirm your email" and the "Confirm" button).
  - Submit is disabled until exactly 6 digits; typing `"12 ab34 56"` gives input value `"123456"`; typing 8 digits keeps 6; `fireEvent.submit` while invalid does not call `confirmSignUp`.
  - Errors from `messageFor` show as the alert tied to the code field (`aria-invalid="true"`).
  - Links: "Back" → `/register`; "Wrong email? Start over" → `/register`. No `[style]` attribute in the output. `document.title` is "Track That: Confirm code".
- [ ] **Step 2: Run `pnpm test screens/Confirm App` — expect failures**
- [ ] **Step 3: Implement**
  - `<PageShell back={{ to: "/register" }}>`; intro section: 64px circle (`var(--color-brand-tint)`, centred) holding an `aria-hidden` mail SVG (24px viewBox: `<rect x="3" y="5" width="18" height="14" rx="3">` and `<path d="M4 7.5l8 6 8-6">`, stroke `var(--color-brand)`, width 2, round caps), `h1` "Check your email" (display font, 32/38), and the sentence in 17/26 `var(--color-muted)` with the `<strong>` email in `var(--color-ink)`, `overflow-wrap: anywhere`.
  - Form: `FormCard` without a `title` (the page `h1` is in the intro above). Code field uses `TextField` `variant="code"`, `inputMode="numeric"`, `maxLength={CODE_LENGTH}`, `autoComplete="one-time-code"`, `error={error}`; `onChange` stores `value.replace(/\D/g, "").slice(0, CODE_LENGTH)`.
  - Below: a "Wrong email? Start over" `Link`, 15px muted, min-height 44px.
- [ ] **Step 4: Run `pnpm test` for the web app — expect PASS**
- [ ] **Step 5: Commit** `feat(web): restyle confirm code screen`

---

### Task 5: Verify against the design

**Files:** none expected; fix anything found in the files above.

- [ ] **Step 1:** From the repo root run `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check`; expect all green. Run `pnpm --filter @trackthat/web build`; expect success.
- [ ] **Step 2:** Serve the build (`pnpm --filter @trackthat/web exec vite preview`) and, in the browser at 390px and at desktop width, compare `/sign-in`, `/register` and `/confirm` (via register → confirm with a fake or real flow) with the design. Check: long email wraps on Confirm; focus rings visible; no horizontal scroll; Show/Hide works; disabled button style; no CSP console errors.
- [ ] **Step 3:** Update the README web line if it still says the auth screens are unstyled; otherwise leave it.
- [ ] **Step 4: Commit** any fixes: `fix(web): …`

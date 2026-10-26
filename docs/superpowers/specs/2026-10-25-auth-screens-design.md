# Auth Screens Restyle Design

Date: 2026-10-25
Status: Draft, awaiting review

## Goal

Sign in, Register (sign up) and Confirm look like the rest of the app, matching the Design canvas "Track That MVP Screens" (artifact `0e161814-bc18-42ad-a4fa-37dfcb0ef23f`, boards Sign in, Sign up and Confirm code). This is the follow-up the landing page spec deferred. The boards are a visual reference, not code to copy.

## Scope

In scope:

- Restyle `SignIn`, `Register` and `Confirm` using the existing design system in `apps/web/src/design/`.
- New shared form components: `FormCard`, `TextField`, `PasswordField`.
- `PageShell` gains an optional header action and a back variant; `Button` gains a disabled style.
- Client-side validation that disables the submit button until the form is valid.
- A Show/Hide password toggle.

Out of scope (deliberately, YAGNI):

- `SignedIn`, the Home placeholder. It waits for the real Home screen.
- "Forgot password?" and "Send a new code": the auth API has no reset or resend call.
- The Terms and Privacy line on Sign up: those pages do not exist.
- Any change to `AuthApi`, `useFormSubmit`, `messageFor`, the routes, infra or the CSP.

## Constraints

- The CSP is `style-src 'self'`: plain CSS files next to components, no inline `style=`. The design's inline styles are translated, not copied.
- Use existing tokens (`--color-*`, `--radius-*`, `--font-*`); add a token only if none fits (error red `#B3261E`).
- Tests find controls by label text and button name; labels stay as accessible names.

## Components (`apps/web/src/design/`)

Each has a co-located `.css` file and a test.

- `FormCard`: white surface, 1px `--color-border`, `--radius-xl`, 20px padding, 20px gap. Renders an `h1` (display font, 28/34) from an optional `title` prop (Confirm omits it) and its children inside a `<form>` that takes `onSubmit` and `noValidate`. An optional `error` prop renders a red `role="alert"` line after the children; Confirm instead shows its error through `TextField`.
- `TextField`: wraps `<label>` text and a 52px input (`--radius-md`, `--color-ghost-border` border). Props: `label`, `hint` (muted 14/20 line), `error` (red line with `role="alert"`, red 2px input border, linked with `aria-describedby`), plus the native input attributes.
- `PasswordField`: `TextField` with a 44px Show/Hide button inside the input's right edge. The button is `type="button"` with `aria-label` "Show password" or "Hide password" and toggles the input between `password` and `text`.
- `Button`: a `disabled` button renders the disabled style (`--color-empty` background, `--color-muted` text, `not-allowed` cursor) and does not apply the hover filter.
- `PageShell`: optional `action?: { label: string; to: string }` replaces the default "Sign in" link; omitted, behaviour is unchanged. Optional `back?: { to: string }` replaces the whole header with a "Back" link and chevron.

## Screens

All three call `usePageTitle("Track That: …")` and render inside `PageShell`.

### Sign in (`/sign-in`)

Header action "Create account" to `/register`. `FormCard` titled "Sign in" with Email, `PasswordField`, error alert from `useFormSubmit`, and a primary submit "Sign in". Below the card: "New to Track That? Create an account". Valid when the email matches `/^\S+@\S+\.\S+$/` and the password is non-empty.

### Register (`/register`)

Header action "Sign in" to `/sign-in`. `FormCard` titled "Create your account" with Email, `PasswordField` (hint "At least 8 characters."), error alert, submit "Create account". Below the card: "Already have an account? Sign in". Valid when the email matches and the password is at least 8 characters.

### Confirm (`/confirm`)

`back` to `/register`. A 64px green-tint circle with a mail icon (`aria-hidden`), `h1` "Check your email", and "We sent a 6-digit code to **{email}**." (the design's "expires in 10 minutes" is dropped: it is not a documented Cognito setting here). `FormCard` with Confirmation code, a 64px input (32px, 0.4em letter spacing, centred, numeric, `autoComplete="one-time-code"`) that strips non-digits and caps at 6, the error alert, and submit "Verify and continue". Below: "Wrong email? Start over" to `/register`. Valid at exactly 6 digits.

## Behaviour

- Submit is disabled while the form is invalid or `pending`. Native `required` validation is replaced by this rule, hence `noValidate`.
- Existing flow is untouched: `useFormSubmit` runs the request, failures map through `messageFor`, `user-not-confirmed` still routes to `/confirm`.
- Links below cards are router `Link`s, not buttons, so the `onShowRegister` and `onShowSignIn` props are removed from `SignIn` and `Register` and `App` stops passing them. The screens now render inside a router, as `Landing` already does.

## Testing

- Component tests: `TextField` hint and error wiring, `PasswordField` toggle and labels, `FormCard` heading and submit, disabled `Button`, `PageShell` action and back variants (and the unchanged default).
- Screen tests: update assertions for changed names (Confirm submit is "Verify and continue"); add disabled-until-valid for all three, the digits-only and 6-character cap on the code, and the toggle on Sign in.
- Run `pnpm typecheck`, `lint`, `test` and `build`, then view the built app at 390px and at desktop width against the design.

## Risks

- Replacing native validation with a disabled button changes how users learn why they cannot submit; the hint under the password and the inline errors carry that. The design specifies this behaviour.
- Contrast: the design's disabled and muted colours are used as drawn; the check in the final review covers 4.5:1 for text.

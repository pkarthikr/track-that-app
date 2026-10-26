# Landing Page and Design System Design

Date: 2026-10-25
Status: Draft, awaiting review

## Goal

Visitors to the web app land on a styled marketing page with real URLs for each page, built on a reusable design system in `apps/web`. The visual source is the Design canvas "Track That MVP Screens" (artifact `0e161814-bc18-42ad-a4fa-37dfcb0ef23f`); its boards are a visual reference, not code to copy.

## Scope

In scope:

- A design system in `apps/web/src/design/`: tokens, self-hosted fonts, and components.
- Landing (`/`) and Features (`/features`) pages.
- React Router, replacing the `useState` view switch in `App.tsx`, with routes for the existing auth screens.
- Page metadata in `index.html` (title, description, `theme-color`, SVG favicon).
- A test that pins the CloudFront SPA fallback.

Out of scope (deliberately, YAGNI):

- Restyling the Sign in, Register and Confirm screens. Their markup stays; only navigation changes.
- The Home, New habit and Habit detail boards (they need a habits API that does not exist), the sticky blurred header, and the menu drawer.
- A dark theme, a component catalogue page, and a desktop-specific layout.
- Any change to infra, the CSP, or deploy workflows.

## Decisions

| Decision     | Choice                                                            | Why                                                                                                   |
| ------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Routing      | `react-router`, browser history                                   | Real URLs are needed for the demo. The CloudFront stack already answers 403/404 with `/index.html`.   |
| Styling      | Plain CSS files with custom properties, no styling library        | The CSP is `style-src 'self'` and assumes no inline styles; the design's inline `style=` would break. |
| Fonts        | `@fontsource-variable/bricolage-grotesque`, `@fontsource/dm-sans` | Bundled by Vite and served from `'self'`; the design's Google Fonts link would be blocked by the CSP. |
| Desktop      | Same centred 560px column as mobile                               | The design has no desktop layout; inventing one is out of scope.                                      |
| Auth screens | Unstyled, routed                                                  | Agreed scope: restyling is a follow-up feature.                                                       |

## Routes

| Path        | Screen                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/`         | Landing; signed-in visitors are redirected to `/home`                                                                    |
| `/features` | Features                                                                                                                 |
| `/sign-in`  | `SignIn`                                                                                                                 |
| `/register` | `Register`                                                                                                               |
| `/confirm`  | `Confirm`; the email travels in router state, and a missing email redirects to `/register` (for example after a refresh) |
| `/home`     | `SignedIn`; signed-out visitors are redirected to `/sign-in`                                                             |

`App` still takes an `auth: AuthApi` prop, checks the session once on mount, and shows "Loading…" until it resolves. Unknown paths redirect to `/`. `main.tsx` wraps `App` in a `BrowserRouter`; tests wrap it in a `MemoryRouter`. Existing screens keep their props (`onSignedIn`, `onShowRegister`, and so on); `App` implements them with `useNavigate`, so the screens and their tests change minimally.

## Design system (`apps/web/src/design/`)

### Tokens

`tokens.css` defines custom properties on `:root`; it is imported once from `main.tsx`.

- Neutrals: ground `#F5F6F1`, surface `#FFFFFF`, ink `#17231D`, muted `#5E6B63`, border `#E1E6DE`, empty cell `#E3E8E1`, ghost hover `#EEF0EA`, ghost border `#B9C4BC`.
- Brand green `#14804F`; the focus ring is a 3px solid outline in that colour with a 2px offset.
- Habit palette, seven colours with four steps each (step 4 is "full"):

| Colour | 1       | 2       | 3       | 4       |
| ------ | ------- | ------- | ------- | ------- |
| green  | #ACE0BA | #75C38D | #3DA565 | #14804F |
| teal   | #95E1E1 | #44C5C6 | #00A3A4 | #007F81 |
| blue   | #B3D4FF | #80B4F5 | #5493E2 | #3273C2 |
| violet | #D1C9FF | #B3A5F2 | #9682DF | #7963C0 |
| pink   | #F8BDD8 | #E795BC | #D16FA0 | #B25083 |
| coral  | #FFBFB8 | #F0968E | #DB7069 | #BB504B |
| orange | #F8C5A2 | #E89E6B | #D17A37 | #B25A00 |

The CSS names are `--habit-<colour>-<step>`. `palette.ts` exports the same values so components can pick a colour by name at runtime.

- Type: Bricolage Grotesque 700 for display, DM Sans 400/500/600 for body. Sizes (size/line-height): 40/44, 32/38, 24/30, 17/22, 16/24.
- Spacing on a 4px grid; radii 10, 12, 16, 20 and pill.

### Components

Each component has a co-located `.css` file and a test.

- `LogoMark`: the 2×2 rounded-square mark, `size` prop, and a `mono` variant (white at 38/58/80/100% opacity) for use on green.
- `Wordmark`: the mark plus "Track That", in horizontal and stacked forms.
- `Button`: `primary` and `ghost` variants, 52px tall. Renders a router `Link` when given `to`, and a `<button>` otherwise.
- `HabitCard`: colour ring, habit name, and a `WeekRow`.
- `WeekRow`: seven circles, each labelled for screen readers (for example "Monday: done"); today is outlined.
- `ColorSwatches`: the seven-dot row.
- `PageShell`: centred 560px column with the header (logo link and Sign in link).

Decorative copies of the week row are `aria-hidden`.

## Pages

### Landing (`/`)

Header; `h1` "Build habits you can see."; a sample `HabitCard` ("Go to the gym", coral, Monday/Wednesday/Friday done, Saturday as today); primary "Get started" to `/register`; ghost "Sign in" to `/sign-in`.

### Features (`/features`)

`h1` "Features"; two sample cards (Read 20 pages in blue, Water the plants in green); "Three steps, nothing else." with the three steps (Add a habit, Check in, Watch it fill in); "Your color, your habit." with `ColorSwatches` and without the design's "coming soon" line about lighter shades, because it describes an unbuilt feature; a closing card "Start with one habit." with a "Get started" button to `/register`; a footer with the small mark. The header logo links to `/`.

### Metadata

Each page sets `document.title` ("Track That: Welcome", "Track That: Features"). `index.html` gains a description, `theme-color` `#F5F6F1`, and an SVG favicon of the mark served from `'self'`.

## Testing

- Components: Button variants and element type, WeekRow labels, LogoMark sizing and mono variant.
- Pages: headings, link targets, and `aria-hidden` on the decorative sample.
- `palette.test.ts`: the exported hex values equal the table above.
- `App.test.tsx`: routing between screens, the signed-in redirects both ways, the `/confirm` fallback, and unknown paths.
- Infra: `web-stack.test.ts` already asserts the 403/404 fallback to `/index.html`; keep it as the guard for deep links.
- Verification before completion: `pnpm typecheck`, `lint`, `test`, `build`, then the built site served locally and checked in a browser at 390px and at desktop width.

## Risks

- Hard refresh on a deep link relies on the CloudFront fallback. It is asserted by the existing infra test but only proven by a real deploy; deploying is outside this work and needs the owner's go-ahead.
- Desktop layout is an assumption (the mobile column, centred). The owner confirmed it for the demo.
- The design canvas is third-party-editable; this spec records the values used so the build does not depend on re-reading it.

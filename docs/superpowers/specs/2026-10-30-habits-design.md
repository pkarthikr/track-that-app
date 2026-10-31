# Habits and Completions Design

Date: 2026-10-30
Status: Draft, awaiting review

## Goal

A signed-in user can create habits (a name, a color, and the weekdays it is meant to happen), log a completion for a habit on a given day, and see a streak per habit. Home shows this week's completion for every habit and lets the user log or undo today's. A detail screen shows one habit's last 365 days as a GitHub-style heatmap. Data is stored in DynamoDB behind an HTTP API, replacing `mockHabits.ts`.

## Scope

In scope:

- A DynamoDB table, a Lambda, and an HTTP API with a Cognito JWT authorizer, all in `ApiStack`.
- Habit create, list, get, rename or recolor, and archive.
- Log and undo a completion for a date.
- Current streak per habit, computed on read.
- Web: Home on real data, a new-habit screen, a habit detail screen with the heatmap.

Out of scope (deliberately, YAGNI):

- Editing a habit's weekdays (locked at creation), restoring or hard-deleting archived habits, an archived list.
- Completion extras (count, tag, note), reminders and notifications. The model leaves room for them (see "Growth").
- Longest streak, sharing, and any cross-user feature.
- A custom domain, API monitoring dashboards, and a second environment.

## Decisions

| Decision                         | Choice                                                                 | Why                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Streak                           | Consecutive scheduled days; rest days neither break nor extend it      | Makes the chosen weekdays meaningful                                                |
| Completion on an unscheduled day | Allowed; shown on the grid and heatmap, ignored by the streak          | Matches the current Home screen, where inactive habits can still be ticked          |
| Schedule edits                   | Not allowed; weekdays are fixed at creation                            | Past streaks can never change under the user; no schedule history needed            |
| Removing a habit                 | Archive (flag), completions kept                                       | Nothing is lost; restore or delete-forever can be added later without a data change |
| "Today"                          | The client sends its local date; the server stores it as given         | Travel works and evening completions land on the right day                          |
| Streak storage                   | Computed on read, never stored                                         | Back-fill and undo would keep invalidating a stored value                           |
| Table layout                     | One table, one partition per user, items told apart by sort-key prefix | One table to define, back up and grant; both screens are single range queries       |
| API                              | HTTP API + one Lambda + Cognito JWT authorizer                         | Built-in token check, cheapest, no server; avoids hand-written token verification   |
| Home week                        | Calendar week, Sunday to Saturday, today highlighted, later days faded | Matches "that week's completion"                                                    |

## Data model

One table. Every item belongs to one user, and the partition key is that user's Cognito `sub` taken from the verified token, never from the request.

| Item       | `PK`         | `SK`                          | Attributes                                                                                                  |
| ---------- | ------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Habit      | `USER#<sub>` | `HABIT#<ulid>`                | `name`, `color`, `weekdays` (number set 0-6, Sunday first), `createdAt`, `archivedAt` (absent while active) |
| Completion | `USER#<sub>` | `COMP#<habitId>#<yyyy-mm-dd>` | none yet beyond the key                                                                                     |

- Habit ids are ULIDs, so habits sort by creation time within the partition.
- Weekday numbering matches `WeekRow` (0 is Sunday).
- The completion key is deterministic, so logging twice is the same write (idempotent) and undo is a delete.
- Table settings: on-demand billing, point-in-time recovery on, and a `RETAIN` removal policy because this is user data.

### Access patterns

| #   | Operation                               | How it is served                                                                                                          |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | List a user's active habits             | Query `PK`, `SK begins_with HABIT#`, filter out items with `archivedAt`                                                   |
| 2   | This week's completions for every habit | One Query per habit on the `COMP#<habitId>#` prefix, run in parallel; the week is the dates on or after the week's Sunday |
| 3   | Log or undo a completion                | `PutItem` or `DeleteItem` on the deterministic key                                                                        |
| 4   | One habit and its last 365 days         | `GetItem` for the habit, plus one range Query on `COMP#<habitId>#<today-364>` to `...#<today>`                            |
| 5   | A habit's current streak                | The same `COMP#<habitId>#` Query (all pages); the streak is computed in memory                                            |
| 6   | Create a habit                          | `PutItem`, conditional on the key not existing                                                                            |
| 7   | Rename, recolor, archive                | `UpdateItem`, conditional on the habit existing                                                                           |

Patterns 2 and 5 share one read per habit: every completion date for that habit, all pages, then the week, the streak and the 365-day window are derived in memory. At personal scale (a daily habit is about 365 tiny items a year) this is cheap. An early-stopping descending read is a later optimization if long histories ever make Home slow. If it ever becomes slow, a GSI keyed by date serves the whole week in one query. DynamoDB can add a GSI to a live table, so this design does not close that door.

### Growth

A completion's count, tag or note are new attributes on the completion item and need no migration. A reminder is a new attribute on the habit item, with scheduling handled separately.

## Streak rule

Given a habit's weekdays, its completed dates, and the client's `today`:

1. Start at `today`. If `today` is a scheduled day and is not completed, start from the previous scheduled day instead (the day is not over, so it does not break the streak yet).
2. Walk backwards over scheduled days only. Each completed one adds 1. The first scheduled day without a completion ends the walk.
3. Completions on unscheduled days are ignored.
4. A habit created today, or with no completions, has a streak of 0.

This is a pure function in `packages/core` (no AWS dependency) and carries the bulk of the unit tests.

## API

An HTTP API with a Cognito JWT authorizer against the existing user pool. Unauthenticated requests are rejected by API Gateway before the Lambda runs. CORS allows any origin: access is controlled by the bearer token in the `Authorization` header (no cookies), and naming the CloudFront origin would make `ApiStack` and `WebStack` depend on each other.

The Lambda is a single function with a small router, which is the shape `services/api` already has. The user id comes from the verified `sub` claim.

| Route                                    | Behavior                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET /habits?today=D`                    | Active habits, each with `streak` and `weekDone` (completed dates in the current Sunday-Saturday week) |
| `POST /habits`                           | Create from `{name, color, weekdays}`; returns 201 with the habit                                      |
| `PATCH /habits/{id}`                     | Accepts `name`, `color`, `archived: true`; rejects `weekdays`                                          |
| `GET /habits/{id}?today=D`               | The habit, its `streak`, and `done` (completed dates in the last 365 days)                             |
| `PUT /habits/{id}/completions/{date}`    | Log a completion; same result when repeated                                                            |
| `DELETE /habits/{id}/completions/{date}` | Undo; same result when repeated                                                                        |

Validation, enforced on the server:

- `name`: 1 to 60 characters after trimming.
- `color`: one of the seven palette names.
- `weekdays`: a non-empty set of integers 0 to 6.
- `today` and `{date}`: real calendar dates in `yyyy-mm-dd`. A completion date may be at most one day after the server's UTC date (time-zone slack) and at most 366 days before it (365 days plus the same slack), since `PUT` carries no `today`.
- At most 50 habits per user, archived ones included.
- Logging a completion for an archived or unknown habit returns 404.

Errors use a small JSON body with a stable `code` and 4xx status for the caller's mistakes, 500 otherwise. Names and ids are never echoed into log lines unescaped.

## Shared code

- `packages/shared`: the `Habit` and `HabitColor` types, `HABIT_COLORS`, weekday and date-string types, and the validators used by both the API and the web form. `HabitColor` moves here from the web palette file, which re-exports it.
- `packages/core`: the streak function and the week and date helpers (week start for a date, day arithmetic on `yyyy-mm-dd` strings without time-zone surprises).

## Web app (`apps/web`)

- **Habits API client** (`src/habits/api.ts`): an interface plus an implementation that calls `VITE_API_URL` with the Cognito ID token in `Authorization`. The token comes from `fetchAuthSession()` in `aws-amplify/auth` (a direct dependency of `apps/web`), because `@pkarthikr/auth-client` has no token accessor. Components receive it as a prop, as `AuthApi` does, so tests use a fake. `.env.example` gains `VITE_API_URL`, and the deploy workflow gains the matching repository variable.
- **Content security policy**: `WebStack`'s `connect-src` must allow the API origin. `WebStack` takes the API endpoint from `ApiStack` as a prop; `ApiStack` takes nothing from `WebStack`, so there is no cycle.
- **Home**: loads `GET /habits?today=D` and renders `HabitRow`s from the result. Ticking updates the screen immediately and rolls back with an inline error if the request fails. Each row shows its streak. The empty state shows when there are no active habits.
- **Week grid**: `WeekRow` renders the calendar week, today highlighted, and gains an `upcoming` state for days after today. Upcoming days are faded and cannot be ticked. A scheduled past day without a completion is `open`, an unscheduled day is `rest`. Every non-upcoming cell on Home is tappable to log or undo that day, which is how a missed day is back-filled; the heatmap on the detail screen is read-only.
- **New habit** (`/habits/new`, opened from the existing + button): name field, the existing `ColorSwatches`, and seven weekday chips with at least one required.
- **Habit detail** (`/habits/:id`, opened by tapping a habit): a heatmap component of 53 weeks by 7 days, completed days in the habit's color and all others muted, the current streak, and an Archive action with a confirmation.
- `mockHabits.ts` is deleted. `Home`, `HabitRow` and their tests move to the real types.

## Infrastructure (`infra`)

`ApiStack` gains the table, the Lambda (granted read and write on that table only), the HTTP API, the authorizer, and outputs for the API URL. It needs the user pool and client from `AuthStack`, passed in as props. Nothing is deployed by this work. CI continues to run `cdk synth`, and a stack test asserts the table keys, the retain policy, and that no route is left without the authorizer.

The Lambda is bundled by `pnpm --filter @trackthat/api build` (esbuild) and read from `services/api/dist`, so CI and the Deploy workflow gain a build step before `cdk`, and `ApiStack` fails with a clear message when the bundle is missing, as `WebStack` does for the web build.

Deploying is a separate, manual step through the existing Deploy workflow, and needs the owner's go-ahead for that exact action. The first rollout takes two Deploy runs, as the auth pool swap did: `VITE_API_URL` does not exist until `TrackThatApi` is deployed, so run one uses a placeholder value, then the variable is set to the `ApiUrl` stack output and run two publishes a web build that points at it.

## Testing

- **Unit** (`packages/core`): the streak rule across schedules, misses, back-fill, unscheduled-day completions, today-not-yet-done, long streaks, and week boundaries.
- **Unit** (`packages/shared`): each validator, including edge dates.
- **Handler** (`services/api`): every route against an in-memory fake of the table interface: validation errors, idempotent put and delete, archived and unknown habits, the 50-habit cap, and that one user can never read or write another's items.
- **Stack** (`infra`): the assertions above.
- **Web**: Home, new habit, detail and heatmap with a fake habits client, including rollback on a failed tick.
- Browser behavior of the finished screens cannot be checked from this environment and is left for the owner's manual pass.

## Risks

- The Deploy workflow's OIDC role must be able to deploy the new resources through the CDK bootstrap roles. This is checked early in the plan, and any change to `GithubOidcStack` needs the owner's manual deploy, as before.
- The 365-day cap and the 50-habit cap are product choices that are easy to change later (constants in `packages/shared`).

# FocusGuard

FocusGuard is a full-stack distraction-management starter app. It includes a React dashboard, an Express REST API, PostgreSQL persistence through Prisma, and a Manifest V3 Chrome extension. The dashboard manages domain rules, daily site-use limits, and weekly schedules; the extension applies the current policy and records active-domain time.

## Requirements

- Node.js 20 or newer and npm
- PostgreSQL 14 or newer
- Google Chrome or Chromium for the extension

## Run locally

1. Create a PostgreSQL database named `focusguard` (or change the database name in `.env`).
2. Copy `.env.example` to `.env`, set `DATABASE_URL`, and replace `JWT_SECRET` with a long random value.
3. From the repository root, run `npm install`.
4. Run `npm run db:generate` and `npm run db:migrate`.
5. Run `npm run dev`. The dashboard is at `http://localhost:5173` and the API is at `http://localhost:4000`.
6. Create an account in the dashboard.
7. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps/extension`.
8. Open the FocusGuard extension and sign in with the same account. Keep the API running while the extension is in use.

The extension requests access to websites so it can apply your block rules and measure the active tab's domain. Rules and usage records are tied to the signed-in account.

## Project layout

```text
apps/
  api/                 Express API, Prisma schema, and database access
  extension/           Chrome Manifest V3 extension
  web/                 React + TypeScript dashboard
```

### Root files

- `package.json` — npm workspaces and commands for running/building the API and dashboard.
- `.env.example` — local database, JWT, and API configuration template.
- `.gitignore` — generated output, dependencies, and local secrets to keep out of source control.
- `README.md` — setup guide, architecture overview, and API route summary.

### `apps/api`

- `package.json`, `tsconfig.json` — API dependencies and TypeScript build settings.
- `prisma/schema.prisma` — PostgreSQL data model for users, rules and their optional daily limits, schedules, usage, and focus sessions.
- `src/index.ts` — starts the HTTP server and connects it to PostgreSQL.
- `src/app.ts` — Express middleware, route mounting, and error handling.
- `src/lib/prisma.ts` — shared Prisma client.
- `src/lib/tokens.ts` — JWT creation and validation settings.
- `src/middleware/auth.ts` — protects signed-in API routes.
- `src/routes/auth.ts` — account registration, sign-in, and current-user endpoint.
- `src/routes/rules.ts` — create, list, edit, and delete block/allow rules.
- `src/routes/schedules.ts` — create, list, edit, and delete weekly schedules.
- `src/routes/extension.ts` — returns the effective block list and accepts usage segments from Chrome.
- `src/routes/analytics.ts` — summarizes recent browsing time and focus sessions.
- `src/routes/focus.ts` — starts, reads, and ends a focus session.
- `src/services/policy.ts` — evaluates a user's schedules and determines which domains should be blocked now.
- `src/services/time.ts` — converts account-local dates into reliable day boundaries for analytics and usage limits.

### `apps/web`

- `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html` — dashboard build and development server configuration.
- `src/main.tsx` — mounts the React application.
- `src/App.tsx` — sign-in flow and main dashboard for overview, rules, schedules, and focus sessions.
- `src/api.ts` — typed fetch helpers and JWT storage.
- `src/vite-env.d.ts` — TypeScript definitions for Vite's environment variables.
- `src/styles.css` — responsive dashboard styles.

### `apps/extension`

- `manifest.json` — Chrome permissions, popup, background worker, and block page configuration.
- `service-worker.js` — syncs block rules, blocks matching domains, and records active-domain usage.
- `popup.html`, `popup.js`, `popup.css` — compact extension sign-in and connection status UI.
- `blocked.html`, `blocked.css`, `blocked.js` — page and back button displayed when a matching block rule redirects a tab.

## REST API overview

All routes are prefixed with `/api/v1`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create account and return a JWT |
| `POST` | `/auth/login` | Sign in and return a JWT |
| `GET` | `/auth/me` | Return the signed-in user |
| `GET`, `POST` | `/rules` | List or create domain rules |
| `PATCH`, `DELETE` | `/rules/:id` | Update or remove a domain rule |
| `GET`, `POST` | `/schedules` | List or create weekly schedules |
| `PATCH`, `DELETE` | `/schedules/:id` | Update or remove a schedule |
| `GET` | `/extension/policy` | Return domains that should be blocked now |
| `POST` | `/extension/usage` | Save a measured browsing-time segment |
| `GET` | `/analytics/summary` | Return daily totals, top domains, and focus time |
| `GET` | `/focus/current` | Return the active focus session, if any |
| `POST` | `/focus/start` | Start a focus session |
| `POST` | `/focus/stop` | End the active focus session |

## Notes

- The API rejects malformed inputs, hashes passwords, and keeps all data scoped to the authenticated user.
- Schedules use the timezone saved on the account. Registration saves the browser's timezone. Account timezone editing is not included in this first version.
- A block rule with no schedule and no daily limit blocks at all times. A daily-limit-only rule allows the site until its tracked time reaches the limit. When both a schedule and limit are set, the schedule blocks during its active hours and the limit blocks after its threshold.
- Starting a focus session temporarily activates every enabled block rule. The session ends when its timer finishes or when you stop it early.
- Usage is measured while the Chrome window is focused and a normal website tab is active. It is a lightweight productivity estimate, not an operating-system-wide screen-time monitor.
- The initial project is intended for local development. Before public deployment, set production origins and secrets, use HTTPS, and review the extension's site-access permissions.

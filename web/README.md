# disclaw-team Web UI

A local dashboard for managing your disclaw-team setup — bots, roles, assignments, and team status.

## What it does

- **Dashboard** — live team status, bot health, one-click start/stop
- **Bots** — add/remove bots, assign roles, view generated personalities
- **Roles library** — browse, edit, and create custom role archetypes
- **Team presets** — one-click role assignment templates (executive, dev team, etc.)
- **Profiles** — save and switch between team configurations
- **Schedules** — recurring tasks for your bots
- **Settings** — workspace directory, default model, danger zone

## Running locally

```bash
cd web
npm install
npm run dev
```

Dashboard available at `http://localhost:5173`.

## Building for production

```bash
npm run build
npm run start
```

## Docker

```bash
docker build -t disclaw-team-web .
docker run -p 3000:3000 -v ~/.disclaw-team:/root/.disclaw-team disclaw-team-web
```

Note: the web UI reads from and writes to `~/.disclaw-team/` on the host. Mount that directory when running in Docker.

## Tech stack

- React Router v7 (SSR)
- TailwindCSS v4
- Node.js 18+ (or Bun)

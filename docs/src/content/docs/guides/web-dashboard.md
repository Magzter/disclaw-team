---
title: Using the Web Dashboard
description: How to use the disclaw-team web dashboard to manage your team visually.
---

The web dashboard is the primary interface for managing your disclaw-team deployment. It provides visual controls for everything you can do from the CLI — plus features like drag-and-drop role assignment and a visual schedule builder.

## Starting the dashboard

```bash
cd web && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). If this is your first time, the onboarding wizard will guide you through setup.

## Dashboard pages

### Home (Dashboard)

The main view shows all your bots with live status indicators. From here you can:

- **Start/Stop All** — one-click to launch or shut down the entire team
- **Bot cards** — see each bot's name, role, token status, and whether it's running
- **Click a bot** — go to its detail page to swap roles, view logs, or restart individually

### Teams

Switch between team configurations:

- **Presets** — one-click to apply a preset (Executive, Dev Team, Content, Research, etc.)
- **Your Teams** — save the current configuration and load it later
- **Active indicator** — shows which team is currently running

### Roles

Browse and manage the role library:

- **Filter by type** — orchestrators, specialists, executors
- **Model badges** — see which model and reasoning level each role uses
- **Edit roles** — click to modify personality, instructions, model config
- **Create new roles** — add custom roles with the role editor

### Schedules

Set up recurring tasks with a visual cron builder:

- **Create schedules** — pick a bot, write a prompt, set the cron expression
- **Toggle on/off** — enable or disable without deleting
- **Run Now** — trigger a schedule immediately for testing

### Settings

Configure global options:

- **Discord Server ID** and **Channel ID**
- **Workspace directory**
- **Default model**
- **Danger zone** — reset all configuration

## Onboarding wizard

First-time users are redirected to a 4-step wizard:

1. **Discord** — paste your server ID and channel ID
2. **Bots** — add bot tokens (one per team member)
3. **Roles** — assign a role to each bot from the library
4. **Confirm** — review and launch

## Tips

- The dashboard polls for status every 3 seconds — no need to refresh
- After switching teams, you'll see a banner with **Stop All** / **Start All** buttons for a quick restart
- The role editor lets you customize personality, tone, and instructions per role
- Schedules are injected into bot sessions on startup — they persist across restarts

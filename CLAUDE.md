# disclaw-team

## What this project is

An open-source CLI tool + Claude Code plugin for deploying multi-bot AI teams to Discord. Each bot runs as a separate Claude Code session with its own personality, managed via tmux from a single command.

## Architecture

- Each bot = one Claude Code session + one MCP server instance
- All bots launched in a tmux session (`disclaw-team start`)
- Per-bot state in `~/.disclaw-team/bots/<bot-id>/` (access.json, CLAUDE.md, .env, mcp-config)
- Team config in `~/.disclaw-team/team.yaml`, tokens in `~/.disclaw-team/.env`
- Bot Discord IDs cached in `~/.disclaw-team/registry/` after first login
- Personality injected via `--append-system-prompt`
- Bot-to-bot visibility: all bots see all messages, engagement decisions via CLAUDE.md instructions

## Tech stack

- TypeScript (strict mode, ESM)
- Node.js 18+ (Bun also supported)
- discord.js v14
- @modelcontextprotocol/sdk
- Zod (config validation)
- tmux (process management)
- React Router v7 + Tailwind 4 (web dashboard)

## Key directories

- `src/cli/commands/` — CLI: init, start, stop, attach
- `src/server/server.ts` — MCP server (forked from stock Discord plugin)
- `src/config/` — Zod schema, config loader, writer
- `src/generator/` — Per-bot CLAUDE.md and access.json generators
- `src/templates/` — Team templates (executive, solo)
- `skills/` — Claude Code plugin skills (configure, start, status)

## Development

```bash
npm install                       # Install dependencies
npm run build                     # Compile TS → dist/
disclaw-team start                # Launch all bots
disclaw-team stop                 # Stop all
disclaw-team attach               # Attach to tmux session
npx tsc --noEmit                  # Type check

# Web dashboard
cd web && npm install && npm run dev   # http://localhost:5173
```

## Key design decisions

- **Separate sessions, not subagents** — each bot is an independent Claude instance with its own reasoning. This enables genuine discourse, disagreement, and independent perspectives. A single-session subagent approach was explored and rejected because it collapses into one mind wearing different masks.
- **Server doesn't filter engagement** — all bots see all messages. The CLAUDE.md instructions handle when to respond vs stay silent. This preserves full context for every bot.
- **Orchestrator delegates via Discord** — the orchestrator @mentions team members to assign work, never spawns subagents for specialist work. Specialists spawn subagents for their own deep work.
- **mentions_me metadata** — the server tags each notification with whether the bot was @mentioned, so CLAUDE.md rules can reference it programmatically.
